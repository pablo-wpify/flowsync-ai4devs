# Verificación: contrato de superficie de rutas

> **Fecha:** 2026-10-25 · **Base:** commit `b19a2f5` más los archivos nuevos
> (sin commit) · AdonisJS core 7.3.5 · Node 24.8.0 · Linux.
>
> **Naturaleza de este informe:** observaciones de ejecuciones manuales. Las
> copias descartables, las trazas y las salidas se borraron al terminar. La
> sección [Ejecuciones en GitHub](#ejecuciones-en-github-2026-10-26-utc) es
> distinta: se apoya en los logs de GitHub Actions, enlazados ahí.

## Qué es y qué compara

Un control local y determinista que compara la superficie de rutas que
registra la aplicación con una referencia versionada:

- **Fuente:** `node ace list:routes --json`, que ya trae `@adonisjs/core`. No
  levanta un servidor HTTP.
- **Referencia:** `backend/contracts/route_surface.v1.json`, revisada a mano.
- **Script:** `backend/scripts/check_route_surface.ts` (Node, sin dependencias
  nuevas).

Cada ruta se guarda en dos partes, y las dos se comparan:

- **`public`:** métodos, patrón y lista ordenada de nombres de middleware.
- **`internal`:** nombre de la ruta, handler (controlador y método, o closure)
  y módulo y método de cada middleware.

Se conserva el orden de registro de las rutas y el de los middleware, y se
incluyen las rutas anónimas (`GET /`).

**HEAD queda excluido:** `list:routes` no lo lista ni tiene una opción para
mostrarlo, y AdonisJS lo agrega a cada ruta `GET`. La exclusión está escrita en
la propia referencia (`excluded.HEAD`).

## Uso

Desde `backend/`, con **Node 24** y un `.env` válido:

| Comando | Qué hace | Salida |
|---|---|---|
| `npm run routes:check` | Compara. **Nunca escribe la referencia.** | `0` coincide · `1` diferencias · `2` generación o formato inválidos |
| `npm run routes:update` | Regenera la referencia a propósito | `0` escrita · `2` cualquier fallo (generación, formato, escritura o uso) |

**Fallos (`2`):**

- `ace` termina con un código distinto de 0, por una señal o por superar 120
  s.
- La salida de `ace` no es JSON.
- **Formato estricto:** claves de más o de menos, un tipo de handler
  desconocido, un método fuera de `GET/POST/PUT/PATCH/DELETE/OPTIONS`, una
  lista de métodos vacía.
- Una referencia ausente, que no es JSON, con otra versión, con middleware
  público e interno incoherentes, o que no está en la forma exacta que escribe
  `--update`. Esto último incluye claves duplicadas, otro orden de claves u
  otro formato.

**Qué muestran los mensajes:** nombran ubicaciones y nombres de claves (de la
fuente o de la referencia), nunca valores. Si `ace` falla, solo se informa cómo
terminó y, si la primera línea no vacía de su salida empieza con un nombre de
excepción (`…Error:` o `…Exception:`), ese nombre. **La salida cruda no se
imprime**, porque puede contener rutas absolutas o valores del entorno.

**Superficie no representable:** un middleware sin nombre (closure) o un
método fuera de la lista no son un error de la aplicación, sino algo que el
contrato no sabe representar. El control sale con `2` con el mensaje «the
contract cannot represent it; extending it requires changing this script», y
`--update` tampoco puede registrarlo.

## Candidato temporal

- **Cuando hay diferencias:** se imprime primero el diff por líneas, separado
  en `[public]` e `[internal]` (`-` referencia, `+` actual). Después se guarda
  el candidato en `$TMPDIR/route-surface-XXXXXX/route_surface.candidate.json`
  (por defecto en `/tmp`), y se imprimen su ruta y el comando para borrarlo:
  `rm -r <directorio>`. **No se borra solo.**
- **Si no se puede escribir**, se avisa y la salida sigue siendo `1`: el diff
  ya se mostró.
- **Sin diferencias o con fallo:** no se escribe ningún candidato.
- **`--update`** escribe un temporal propio junto a la referencia
  (`….v1.json.<pid>.tmp`, creado con `wx`) y lo renombra. Si algo falla, lo
  borra. No hace `fsync`.

## Actualización deliberada

Cuando un cambio de rutas es intencional:

1. `npm run routes:update`. Escribe la referencia solo si el candidato se
   generó y validó.
2. Revisar `git diff backend/contracts/route_surface.v1.json`.
3. Commitear la referencia junto con el cambio de rutas.

## Verificación previa del comando fuente

En una copia descartable, con el mismo aislamiento descrito abajo (sin
`TMPDIR` propio ni script), se trazó una ejecución de `list:routes --json` con `strace -f -y`
(llamadas de archivos, `bind`, `listen`, `connect`):

- **Bases de datos:** ninguna mención de `*.sqlite3` en la traza, ni siquiera
  consultas de metadatos. La base testigo quedó con huella, inodo y fecha
  idénticos.
- **Escrituras:** solo a `/dev/null`. Ninguna en la copia ni fuera de ella.
- **Red:** ningún `bind`, `listen` ni `connect`.
- **Repo real:** solo dos consultas de metadatos al directorio raíz. Ninguna
  apertura de archivos del repo ni de sus `.env`.
- **Salida válida:** sin valores del entorno ni rutas personales.
- **Salida con error:** el comando termina con `1` y escribe el error en la
  salida estándar, con códigos de color. El error de sintaxis incluía la ruta
  absoluta del archivo.
- **Determinismo:** dos ejecuciones dieron una salida idéntica byte a byte.

Las ejecuciones del script **no** se trazaron.

## Revisión adversarial

`adversarial-reviewer` revisó el incremento completo, sin ejecutar nada.

| Hallazgo | Decisión |
|---|---|
| Si Node no puede cargar el script (Node < 24), Node sale con `1`, que se confunde con «diferencias» | Documentado en el script, en `CLAUDE.md` y aquí. Observado: Node 20 sale con `1` |
| Middleware sin nombre o método no listado: salida `2` y no se puede registrar | Decisión consciente: el mensaje lo nombra como no representable y está documentado |
| Si falla la escritura del candidato, el diff se oculta y sale `2` | Corregido: el diff va primero y el candidato es de mejor esfuerzo, con salida `1` |
| `execFile` sin timeout; una señal se informaba como «exit code unknown» | Corregido: 120 s, y se informan el timeout y la señal |
| La expresión regular tomaba la primera coincidencia de toda la salida, y no leía stderr | Corregido: solo el inicio de la primera línea no vacía, sin códigos de color, en stdout o stderr |
| La referencia aceptaba claves duplicadas, otro orden, otro formato y middleware incoherente | Corregido: tiene que estar en la forma exacta de `--update`, y se comparan los nombres de middleware |
| `join()` para comparar claves | Corregido: `JSON.stringify` |
| Dos clases de error tratadas igual | Corregido: una sola, `CheckError` |
| Validación duplicada entre fuente y referencia; diff por subsecuencia común | Se mantienen: los dos formatos difieren, y el diff hace legible la diferencia |
| `--update` sin `fsync`, falla genérica si falta `contracts/`, no avisa si cambió | Documentado. Sin cambios |
| El informe decía que `--update` solo sale con `2` si no pudo generar | Corregido en la tabla de uso |

## Resultados anteriores (versiones previas del script)

Antes de la revisión, en otra copia descartable: coincidencia (`0`), mutación de
`auth` (`1`), sin `APP_KEY` (`2`), middleware anónimo (`2`), referencia
inválida o con clave extra (`2`), referencia intacta. Esas versiones quedaron
reemplazadas. Las pruebas se repitieron sobre la versión final.

## Resultados sobre la versión final

En una copia descartable del backend:

- `git archive` del commit, más el script final, `package.json` y la
  referencia;
- `node_modules` **copiado de verdad**, sin enlaces que salgan de la copia;
- `.env` sintético generado desde `.env.example`, con una `APP_KEY` aleatoria;
- base testigo ficticia;
- `TMPDIR` dentro de la copia.

«Hijo» es el código de `node ace list:routes --json` ejecutado aparte en el
mismo estado. «Checker» es el código del script.

| # | Prueba | Hijo | Checker | Resultado |
|---|---|---|---|---|
| 1 | Comprobación inicial | — | **0** | `Route surface matches …` |
| 2 | Quitar `.use(middleware.auth())` del grupo `account` (**solo en la copia**) | 0 | **1** | `-` `middleware=[auth]` / `+` `middleware=[]` en `profile` y `logout`, en `[public]` y en `[internal]`. Se informan la ruta del candidato y el comando para borrarlo |
| 2b | Igual que 2, con `TMPDIR` inexistente | 0 | **1** | El diff completo, y «The candidate could not be written …» |
| 3a | `.env` sin `APP_KEY` | 1 | **2** | `… failed (exit code 1), EnvValidationException; its output is not shown` |
| 3b | Middleware anónimo (closure) en el grupo `account` | 0 | **2** | `source[0].routes[3].middleware[1].type: not a named middleware; the contract cannot represent it …` |
| 3c | Referencia con JSON inválido | no se ejecuta | **2** | `… is not valid JSON` |
| 3d | Referencia con una clave extra | no se ejecuta | **2** | `…public: expected keys [methods,middleware,pattern], got [extra,…]` |
| 3e | Referencia con el mismo contenido en otro formato | no se ejecuta | **2** | `… is not in the form --update writes …` |
| 3f | Referencia con una clave duplicada | no se ejecuta | **2** | Igual que 3e |
| 3g | Referencia con middleware público e interno incoherentes | no se ejecuta | **2** | `… public and internal middleware names differ` |
| 4 | Huella, inodo y fecha de la referencia, antes y después de 1, 2, 2b, 3a, 3b y otra comprobación | — | — | **Idénticos** |
| — | `--update` con las rutas sin cambios | 0 | **0** | Contenido idéntico al anterior |
| — | Node 20.20.2 (el de la shell por defecto) | — | **1** (de Node) | No puede cargar el `.ts` |

En 3c a 3g el script falla al leer la referencia, antes de lanzar `ace`, así
que el hijo no se ejecuta.

Al terminar se borraron los candidatos y la copia. El testigo quedó intacto.
Después se corrigió solo la extracción del nombre de excepción (los códigos de
color) y se repitió la serie completa. La tabla corresponde a esa última
versión.

**En el repositorio real**, con la versión final: `npm run routes:check` dio
**0**, y la referencia quedó con huella, inodo y fecha idénticos. Esa
ejecución usa el `backend/.env` real: lo lee la aplicación, no se mostró ni se
copió. No quedaron candidatos en `/tmp`.

`eslint`, `prettier --check` y `tsc --noEmit` pasan con el script final.

## Ejecuciones en GitHub (2026-10-26 UTC)

El workflow `route-surface` corrió en el fork `pablo-wpify/flowsync-ai4devs`,
con PRs desde ramas del mismo repositorio hacia `main`. Detalle de permisos,
runner y pasos en
[`docs/ci/diseno-pipeline.md`](../ci/diseno-pipeline.md#ejecuciones-en-github-2026-10-26-utc).

| Camino | PR | Ejecución | Commit del PR | Resultado |
|---|---|---|---|---|
| Positivo | [#1](https://github.com/pablo-wpify/flowsync-ai4devs/pull/1) | [40248596507](https://github.com/pablo-wpify/flowsync-ai4devs/actions/runs/40248596507) | `ca44349cde87f203c9ecf118d2fea0283d7c72d1` | `success`. Node 24.8.0 y npm 11.6.0 vía `setup-node`; `npm ci --ignore-scripts` desde el lockfile (`added 557 packages`); `Route surface matches contracts/route_surface.v1.json` |
| Negativo | [#2](https://github.com/pablo-wpify/flowsync-ai4devs/pull/2) | [40248947378](https://github.com/pablo-wpify/flowsync-ai4devs/actions/runs/40248947378) | `107918387234fa008d9454605935c8d4bec3649c` | `failure`, `exit code 1`: `Route surface differs …`, con `profile` y `logout` pasando de `middleware=[auth]` a `middleware=[]` en `[public]` y en `[internal]` |

En las dos, los permisos efectivos del token fueron `Contents: read` y
`Metadata: read`.

- **Mutación del camino negativo:** solo se borró `.use(middleware.auth())`
  del grupo `account`. La referencia, el checker y el workflow no cambiaron:
  el commit toca un único archivo, `backend/start/routes.ts`. Es la misma
  mutación que la prueba 2 de la tabla anterior, ahora en GitHub. El commit no
  está firmado; el correo noreply es solo su dirección de autor.
- **Base `main`:** el workflow filtra PRs hacia `main` y no se tocó el filtro.
  El diff del PR #2 incluía, por eso, el trabajo acumulado de la rama de
  publicación.
- **Cierre:** el PR #2 se cerró sin merge y la rama temporal se borró en
  local y en el remoto. El PR #1 sigue abierto.
- **No cuenta como prueba:** antes de subir la rama, `routes:check` en el
  clone de publicación salió con `2` porque faltaban las dependencias
  (`@poppinss/ts-exec`). No llegó a comprobar rutas.
- **El check no es obligatorio:** no hay ruleset ni protección de rama en el
  fork, así que un resultado en rojo no bloquea el merge.
- **Pendiente:** el revisor de IA no tiene workflow y su calibración no se
  probó con ejecuciones reales.

## Límites

- **Solo la superficie de rutas.** No verifica validadores (campos ni
  reglas), respuestas (campos del transformer), códigos de estado, el
  envoltorio `{ data }`, el middleware global ni el comportamiento de las
  rutas. Que las rutas coincidan no dice nada de entradas ni respuestas.
- **HEAD no se compara.** La exclusión se basa en el comportamiento de
  AdonisJS, no en una verificación propia.
- **Superficie no representable:** los middleware sin nombre y los métodos
  fuera de la lista hacen fallar el control con `2` hasta que se amplíe el
  script.
- **Los códigos valen una vez que el script corre.** Con Node < 24, o si el
  script no carga, Node sale con `1`. Ante un `1`, las diferencias se
  reconocen por la línea `Route surface differs …`.
- **No bloquea commits ni merges.** Ningún hook lo llama. El workflow
  `route-surface` lo ejecuta en PRs hacia `main`, pero no es un check
  obligatorio: no hay ruleset ni protección de rama. Además, un PR puede
  cambiar el checker, la referencia y el workflow.
- **Depende de `list:routes`.** Un cambio de su formato hace fallar el control
  con `2`, no lo hace pasar.
- **Requiere arrancar la aplicación:** Node 24 y un `.env` válido. Que no abra
  la base ni escriba fuera de `/dev/null` se observó en una sola ejecución
  trazada de esta versión.
- **El candidato no se borra solo** cuando hay diferencias.
- **El timeout de 120 s no se probó.**
