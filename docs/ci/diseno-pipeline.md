# Diseño del pipeline: superficie de rutas y revisión adversarial

> **Fecha:** 2026-10-25, ejecuciones en GitHub del 2026-10-26 (UTC) ·
> **Estado:** el workflow determinista (`.github/workflows/route-surface.yml`)
> **se ejecutó en GitHub**, en el fork `pablo-wpify/flowsync-ai4devs`: un
> camino positivo y uno negativo (ver
> [Ejecuciones en GitHub](#ejecuciones-en-github-2026-10-26-utc)). **No es un
> check obligatorio.** La revisión adversarial tiene un **workflow preparado
> localmente y desactivado** (`.github/workflows/ai-review.yml`): nunca se
> probó en GitHub ni con un modelo, y la calibración tampoco (ver
> [Revisión adversarial](#revisión-adversarial-workflow-preparado-sin-activar)).
>
> **Origen:** propuesta nuestra para el módulo 5. Se contrastó con el prework
> y la guía escrita del módulo. Los videos y el PDF de prompts **siguen sin
> revisar**.

Marcas: **[L]** comprobado localmente · **[G]** observado en el log de una
ejecución real en GitHub · **[D]** documentado (ver [Fuentes](#fuentes)) ·
**[I]** inferido de la documentación · **[?]** pendiente de verificar en
GitHub.

## Tres permisos distintos

No hay que confundirlos:

| Plano | Qué decide | Dónde se configura |
|---|---|---|
| **Token de GitHub del workflow** | Qué puede hacer el job en el repositorio: leer el código, comentar, etiquetar | `permissions:` del workflow. Al declarar uno, los no nombrados quedan en `none` **[D]** |
| **Identidad de GitHub de la acción de Claude** | Con qué identidad publica: la app de GitHub (requiere `id-token: write`) o el `GITHUB_TOKEN` | Instalación de la app (requiere ser admin del repo) o el input `github_token` **[D]** |
| **Autenticación del modelo** | Quién paga y autoriza las llamadas al modelo | Un secreto con `anthropic_api_key` o con `claude_code_oauth_token`, o Bedrock, Vertex o Foundry **[D]** |

**Leer el código no es lo mismo que poder publicar.**

- **Leer** requiere `contents: read`: el checkout y la lectura de archivos.
- **Publicar comentarios** requiere un permiso de escritura en el PR.
  - La documentación de GitHub dice que `pull-requests: write` permite, por
    ejemplo, agregar una etiqueta, y que `issues: write` permite comentar en
    un issue.
  - El ejemplo oficial de revisión de la acción comenta con
    `pull-requests: write` **[D]**. Que alcance para un comentario general con
    el `GITHUB_TOKEN` está **[?]** pendiente de verificar. El revisor
    preparado no publica comentarios sobre líneas.
  - El job determinista no publica nada y no tiene permisos de escritura.

## El control no verifica su propia integridad

Un PR puede modificar **el checker**
(`backend/scripts/check_route_surface.ts`), **la referencia**
(`backend/contracts/route_surface.v1.json`) y **el propio workflow**. Con
`pull_request`, el workflow corre sobre el commit de merge del PR **[D]**
**[G]**, así que su definición también es la del PR **[I]**. Por eso:

- Un resultado verde **no garantiza la integridad del checker ni de la
  referencia**: solo dice que el código del PR coincide con la referencia
  **del PR**, según el checker **del PR**.
- Un cambio en cualquiera de esos tres archivos requiere revisión humana
  explícita: es parte del diff, no algo que el control pueda validar.
- No usar `pull_request_target` para tomar el workflow de la base: corre con
  los secretos del repo base, y la guía de seguridad pide no ejecutar ahí
  código del PR **[D]**.
- Cubrir esto exigiría una protección externa al PR, como propietarios de
  código obligatorios para esos archivos o un ruleset. Es una decisión
  pendiente.

## Job determinista: `route-surface`

| Aspecto | Decisión |
|---|---|
| Evento | `pull_request` hacia `main`, con los tipos por defecto (`opened`, `synchronize`, `reopened`) **[D]**. **Sin filtro de rutas:** la superficie depende de muchos archivos, y un check obligatorio en estado `skipped` cuenta como aprobado **[D]** |
| Token | `permissions: contents: read`. Checkout con `persist-credentials: false`. Permisos efectivos según el log: `Contents: read` y `Metadata: read` **[G]** |
| Secretos | Ninguno. En PRs de forks no se pasan secretos y el token es de solo lectura **[D]** |
| Node | `24.8.0`, la versión con la que se verificó **[L]**. `setup-node` la descargó e instaló: `node: v24.8.0`, `npm: 11.6.0` **[G]** |
| Acciones | Fijadas por SHA completo, tomado con `git ls-remote` de `github.com/actions/*` **[L]**: `actions/checkout` v7.0.1 = `3d3c42e5aac5ba805825da76410c181273ba90b1`, `actions/setup-node` v7.1.0 = `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| Caché | Desactivada (`package-manager-cache: false`): menos superficie de ataque y una instalación que no depende de corridas anteriores |
| Instalación | `npm ci --ignore-scripts` desde el lockfile versionado. Evita **solo los scripts de instalación de las dependencias** (los de `@swc/core` y `better-sqlite3`, y la descarga de binarios). El control no los necesita **[L]** |
| Código del PR | **El job sigue ejecutando código del PR:** `routes:check` corre el script del PR, y `ace list:routes` arranca la aplicación del PR (rutas, configuración, providers, controladores). Ese código corre con el token de solo lectura y sin secretos. El workflow no le pasa el `GITHUB_TOKEN` a los pasos `run` **[I]**, y `persist-credentials: false` evita que quede en `.git/config` |
| Entorno | Variables sintéticas en el job, sin archivo `.env`. `APP_KEY` es un relleno declarado como no secreto |
| Tiempo | `timeout-minutes: 10`. El valor por defecto es 360 **[D]** |
| Concurrencia | Un grupo por número de PR, con `cancel-in-progress: true`. Solo es correcto mientras `pull_request` sea el único evento: con `push` o `workflow_dispatch` el número quedaría vacío y todas esas ejecuciones compartirían un grupo |
| Fallos | Cualquier salida distinta de 0 hace fallar el job, y **en GitHub el `1` y el `2` se ven igual: un paso en rojo**. Para distinguirlos hay que leer el log: `Route surface differs …` (diferencias) o `Route surface check failed: …` (generación o formato). Un `1` sin esa primera línea viene de Node, por ejemplo porque no pudo cargar el script |
| `NODE_ENV` | `development` en todo el job. Con `production`, `npm ci` omitiría las devDependencies, que el script necesita |
| Bloqueo | **Ninguno todavía.** No es un check obligatorio: no hay protección de rama ni ruleset. En el fork, la API informó 0 rulesets, 0 reglas sobre `main` y `main` sin protección (2026-10-26). Que el workflow falle no bloquea el merge por sí solo. No se intentó un merge con el check en rojo |

### Verificación local (2026-10-25)

En una copia descartable de `backend/`, tomada del commit `b660617`:

- **Lockfile:** el versionado en ese commit, idéntico byte a byte, sin
  modificar ni resolver los lockfiles locales. Siguió idéntico después de la
  instalación.
- **Instalación:** `npm ci --ignore-scripts --no-audit --no-fund` contra
  `https://registry.npmjs.org/`, con caché propia en la copia y sin la
  configuración de npm del usuario. Node 24.8.0 y npm 11.6.0. Salida `0`, en
  unos 6,5 s. `node_modules` propio, de 199 MB.
- **Comprobación:** `npm run routes:check` **sin `.env`**, con un entorno
  vacío (`env -i`) más las mismas variables del workflow. Salida **`0`**
  (`Route surface matches …`).
- **Control negativo:** con las mismas variables pero sin `APP_KEY`, salida
  **`2`** (`EnvValidationException`).
- Sin binarios nativos compilados (no existe `better-sqlite3/build`).
- Sin cambios en el repositorio real. La copia se borró.

Esto **no** prueba el runner de GitHub (`ubuntu-24.04`), la descarga de Node
por `setup-node`, ni los disparadores y permisos reales. El YAML se validó
solo como YAML (`yaml.safe_load`), no con un validador de workflows. Esa
parte se observó después en GitHub (sección siguiente).

### Ejecuciones en GitHub (2026-10-26 UTC)

En el fork `pablo-wpify/flowsync-ai4devs`, con PRs desde ramas **del mismo
repositorio** hacia `main`. El workflow es el de `ca44349`, sin cambios en
ninguna de las dos ejecuciones.

**Camino positivo:** PR [#1](https://github.com/pablo-wpify/flowsync-ai4devs/pull/1)
(`publicacion/repaso-clases-1-a-5` → `main`, head
`ca44349cde87f203c9ecf118d2fea0283d7c72d1`). Ejecución
[40248596507](https://github.com/pablo-wpify/flowsync-ai4devs/actions/runs/40248596507)
(job [121335356122](https://github.com/pablo-wpify/flowsync-ai4devs/actions/runs/40248596507/job/121335356122)),
conclusión `success`.

- Disparada por `pull_request`. El checkout fue del commit de merge `7c9aa0b`
  (`Merge ca44349… into a699566…`), con `persist-credentials: false`.
- Permisos efectivos del `GITHUB_TOKEN`, según el log: `Contents: read` y
  `Metadata: read`. El workflow solo declara `contents: read`.
- Acciones descargadas por los SHA fijados. Runner `ubuntu-24.04`, imagen
  `20261012.334.1`.
- `setup-node` descargó Node 24.8.0: `node: v24.8.0`, `npm: 11.6.0`.
- `npm ci --ignore-scripts --no-audit --no-fund` desde el lockfile
  versionado: `added 557 packages in 4s`, con un aviso de paquete obsoleto
  (`prebuild-install`).
- `Route surface matches contracts/route_surface.v1.json`. Job de unos 16 s.

**Camino negativo:** PR [#2](https://github.com/pablo-wpify/flowsync-ai4devs/pull/2),
desde una rama temporal creada a partir de `ca44349`. Ejecución
[40248947378](https://github.com/pablo-wpify/flowsync-ai4devs/actions/runs/40248947378)
(job [121336401522](https://github.com/pablo-wpify/flowsync-ai4devs/actions/runs/40248947378/job/121336401522)),
conclusión `failure`.

- **Mutación:** un solo commit,
  `107918387234fa008d9454605935c8d4bec3649c`, que borra únicamente
  `.use(middleware.auth())` del grupo `account` en `backend/start/routes.ts`.
  `git diff --stat ca44349 1079183` muestra solo ese archivo, con una línea
  borrada: **la referencia, el checker y el workflow no cambiaron**. El autor
  del commit figura con el correo noreply de la cuenta; el commit **no está
  firmado**.
- **Base `main`:** el workflow solo se dispara con PRs hacia `main` y no se
  cambió el filtro para la prueba. Por eso el diff del PR #2 también incluía
  el trabajo acumulado de la rama de publicación.
- Checkout del commit de merge `0f10c3f`, mismos permisos efectivos,
  `node: v24.8.0`, `npm: 11.6.0`, `added 557 packages in 3s`.
- `Check the route surface` terminó con `exit code 1`, con
  `Route surface differs from contracts/route_surface.v1.json`. En `[public]`
  y en `[internal]`, `GET /api/v1/account/profile` y
  `POST /api/v1/account/logout` pasan de `middleware=[auth]` (en `[internal]`,
  `auth:#middleware/auth_middleware.handle`) a `middleware=[]`. Es una falla
  por diferencias, no de instalación ni de generación.
- **Cierre:** el PR #2 se cerró sin merge, con un comentario que resume el
  resultado. La rama temporal se borró en local y en el remoto: la API
  responde 404. El PR #1 sigue abierto, con head `ca44349`.
- **Ejecución local previa, que no cuenta como prueba:** antes de subir la
  rama, `npm run routes:check` en el clone de publicación salió con `2`,
  porque ese clone no tenía dependencias instaladas (falta
  `@poppinss/ts-exec`). No llegó a comprobar rutas. La evidencia local de
  esta mutación es la de una copia descartable, en el
  [informe del control de rutas](../verificaciones/2026-10-25-contrato-superficie-rutas.md).

**Qué no prueban estas dos ejecuciones:** PRs desde otro fork (secretos y
aprobación manual), borradores, una salida `2` en GitHub, el bloqueo de un
merge, el timeout del job ni nada de la revisión adversarial. Son dos
ejecuciones, una por camino.

## Revisión adversarial: workflow preparado, sin activar

### Estado

- **Archivos:** `.github/workflows/ai-review.yml`, más
  `.github/ai-review/prompt.md` (instrucciones) y
  `.github/ai-review/schema.json` (formato de la salida).
- **Preparado localmente y desactivado.** Solo corre si la variable del
  repositorio `AI_REVIEW_ENABLED` vale `true`. Además necesita el secreto
  `ANTHROPIC_API_KEY` y la etiqueta `ai-review`. Ninguno de los tres existe.
- **Nunca se probó en GitHub ni con un modelo.**
- **Validado localmente [L]:**
  - sin el secreto, el prechequeo deja `outcome=no-credentials` y el paso
    del modelo no corre;
  - el YAML se parsea;
  - `bash -n` sobre los tres scripts;
  - los pasos de preparación, de control del resultado y de publicación se
    ejecutaron con un `gh` simulado, por los caminos de las tablas de abajo.

  `actionlint`, `shellcheck` y `zizmor` no están instalados.
- **Revisado** por `adversarial-reviewer` contra las fuentes de la acción. Sus
  hallazgos se corrigieron en el workflow y en este documento.
- **Acción fijada por SHA:** `anthropics/claude-code-action` v1.0.262 =
  `925afb53776cf1a2b738c6bdbed37b4d4000ef13`, tomado con `git ls-remote`
  **[L]**.
- Marca extra en esta sección: **[C]** leído en el código fuente de la acción
  en ese SHA; no está documentado y puede cambiar entre versiones.

### Disparo, etiquetas y commit revisado

- **Evento:** `pull_request` con `types: [labeled]`. Los dos jobs exigen:
  - la variable `AI_REVIEW_ENABLED == 'true'`;
  - la etiqueta `ai-review`;
  - un PR que no sea borrador;
  - la rama del PR en este mismo repositorio (`head.repo.full_name ==
    github.repository`).
- **Sin filtro de rama base:** la etiqueta la pone una persona. Ver
  [Rama base para la primera prueba](#rama-base-para-la-primera-prueba).
- **Casos en que no corre ni publica nada:**
  - etiquetar un borrador: el job queda omitido;
  - un PR con conflicto de merge: GitHub no ejecuta workflows de
    `pull_request` hasta que se resuelva **[D]**.
- La acción solo actúa para usuarios con permiso de escritura **[D]**. No se
  usan `allowed_bots` ni `allowed_non_write_users`.

| Situación | Qué pasa | Base |
|---|---|---|
| Se agrega otra etiqueta | Se crea una ejecución en el grupo `ai-review-<PR>-<etiqueta>`, distinto del de la revisión, y sus jobs se omiten por la condición. No cancela la revisión en curso ni publica nada | Concurrencia **[D]** y condiciones del workflow; sin probar en GitHub |
| Se quita una etiqueta, cualquiera | No se crea ninguna ejecución: el evento `unlabeled` no está en `types` | **[D]** |
| Se vuelve a poner `ai-review` durante una revisión | La ejecución nueva cancela la anterior, del mismo grupo. `publish` usa `!cancelled()`, así que la ejecución cancelada no publica; publica solo la nueva | **[D]** (`cancelled()` es verdadero si se canceló el workflow); sin probar |
| Un push mientras corre la revisión | El diff ya se fijó al commit del evento: la API de compare con `base.sha...head.sha`, no el diff vivo del PR. Antes de publicar, `publish` consulta el head actual; si cambió, o no se puede consultar, **no publica el resultado** y lo dice | **[L]** con `gh` simulado |
| Un push después de la revisión | No dispara nada. El comentario nombra el commit revisado | **[D]** y workflow |
| Timeout del job `review` | `publish` debería correr e informar el resultado del job. Que un timeout de job no cuente como cancelación del workflow está **[?]** sin verificar | — |

Queda una ventana mínima entre la consulta del head y la publicación del
comentario. Si el head cambia justo ahí, el comentario igual nombra el commit
al que corresponde.

### Qué puede leer el modelo y qué credenciales recibe

**Opciones usadas y lo que documentan:**

| Opción | Qué documenta | Qué **no** documenta |
|---|---|---|
| `--restricted` (Claude Code ≥ v2.1.248) | Quita las herramientas que ejecutan comandos o código y `WebFetch`, salvo que se nombren en `--tools`. «Confina» las herramientas de archivos a los directorios de trabajo. Carga solo la configuración administrada y la de `--settings`. Rechaza `bypassPermissions` y las sesiones en la nube **[D]** | No dice cómo se hace cumplir el confinamiento. No promete aislar el entorno del proceso, los secretos, la red ni la lectura de `CLAUDE.md` |
| `--settings '{"permissions":{"blockReadsOutsideWorkingDirectories":true}}'` (Claude Code ≥ v2.1.257) | `Read`, `Grep`, `Glob` y `LSP` rechazan rutas fuera de los directorios de trabajo en todos los modos de permisos. Siguen legibles los archivos que Claude Code necesita, como skills, reglas, agentes, comandos y el `CLAUDE.md` de `~/.claude/` **[D]** | No se probó en este contexto |
| `--disallowedTools 'Edit,Write,NotebookEdit,WebSearch,WebFetch,mcp__*'` | Un nombre sin patrón quita la herramienta del contexto **[D]** | Que alcance a las MCP de la acción está **[?]**. Según el código, la acción solo agrega sus servidores MCP si `--allowedTools` los nombra, y aquí no los nombra **[C]** |
| Sin `--allowedTools` | Las lecturas dentro de los directorios de trabajo no requieren aprobación **[D]**. Una regla `Read` sin ruta podría aprobar lecturas fuera **[I]** | — |
| Sin `--tools` | Una lista cerrada podría dejar afuera `StructuredOutput`, la herramienta con la que Claude Code entrega la salida de `--json-schema` **[D]** | — |

- **Versión:** la acción instala Claude Code v2.1.310 **[C]**, que cumple las
  dos versiones mínimas.
- `--restricted` no carga la configuración del proyecto ni la del usuario
  **[D]**. Por lo tanto **no se aplica** el `permissions.deny: ["Read(.env)"]`
  de `.claude/settings.json`, ni el input `settings` de la acción, que escribe
  `~/.claude/settings.json` **[C]**. Por eso la regla va en `--settings`.

**Qué podría leer, si todo funciona como está documentado:** solo el
directorio de trabajo, más las excepciones de Claude Code.

- Los archivos de la rama base en `base.sha`, incluido `.git/`. No hay
  credenciales en `.git/config`, por `persist-credentials: false` **[D]**.
- Los archivos de configuración que la acción restaura desde **la punta** de
  la rama base (`git fetch origin <base.ref>`): `.claude/`, `.mcp.json`,
  `CLAUDE.md` y otros **[C]**. La punta puede ser más nueva que `base.sha`.
  Ese fetch no lleva credenciales; funciona porque el fork es público **[L]**.
- `.claude-pr/`, la copia que la acción hace de esos archivos antes de
  restaurarlos **[C]**. Aquí son los de la base, porque el checkout es de la
  base.
- `.ai-review/pr.diff` y `.ai-review/files.txt`.
- Los archivos propios de Claude Code que la excepción deja legibles **[D]**.

**Qué credenciales recibe el proceso de Claude Code** **[C]**: una copia del
entorno del paso, menos las variables para pedir tokens OIDC y el volcado de
inputs. Eso incluye:

- `ANTHROPIC_API_KEY`, que el CLI necesita;
- `GITHUB_TOKEN` y `GH_TOKEN` con el token del job, que solo tiene
  `contents: read`;
- el resto de las variables del runner que haya en ese paso. Cuáles son
  exactamente está **[?]**.

El modelo no tiene herramientas para leer variables de entorno ni para usar
la red. El riesgo es que lea `/proc/self/environ` u otro archivo fuera del
directorio de trabajo. La documentación dice que la configuración de arriba
lo impide, pero **no está demostrado**: eso lo prueba una ejecución real.

### Permisos

En el nivel del workflow, `permissions: {}`: cada job declara solo lo suyo.

| Job | Permiso | Operación |
|---|---|---|
| `review` | `contents: read` | Checkout de la base y la API de compare para el diff y la lista de archivos, que exigen `Contents: read` **[D]**. Que la acción no necesite más con su `github_token` está **[?]** |
| `publish` | `pull-requests: write` | Consultar el head actual (`gh pr view`) y un único `gh pr comment`. El ejemplo oficial `pr-review-comprehensive.yml` usa este permiso para comentar; `pr-review-filtered-paths.yml` declara `pull-requests: read` **[D]**. Que alcance para `gh pr comment` con el `GITHUB_TOKEN` está **[?]** |
| — | `id-token: write` | **No se concede:** no se usa la app de GitHub ni la federación de identidad |

- El job con el secreto del modelo nunca tiene permiso de escritura.
- El job que escribe no tiene el secreto ni ejecuta la salida del modelo:
  solo la convierte en texto con `jq`.

### Autenticación: GitHub y modelo por separado

**GitHub.** Se pasa `github_token: ${{ github.token }}`, el token del job,
con `contents: read`.

- Si se omite, la acción se autentica como la app de Claude para GitHub, que
  requiere instalarla y conceder `id-token: write` **[D]**. Aquí no hace
  falta, porque el modelo no publica.
- Que el modo agente funcione con ese token está **[?]** sin probar.
- El comentario lo publica `github-actions[bot]` desde el job `publish`.

**Modelo, recomendado: clave de API** (`anthropic_api_key`, secreto
`ANTHROPIC_API_KEY`).

- Pago por uso, con una clave dedicada que se puede revocar.
- La documentación la recomienda para un secreto que no dependa de una
  persona **[D]**.
- Si están las dos, la clave tiene precedencia sobre el token OAuth **[D]**:
  configurar solo una.

**Alternativa: token OAuth de suscripción** (`claude_code_oauth_token`,
generado con `claude setup-token`).

- Requiere un plan Pro, Max, Team o Enterprise, dura aproximadamente un año y
  consume la suscripción de quien lo generó **[D]**.
- Si los términos admiten usarlo en CI está **[?]** sin confirmar.
- Cambiar a esta opción requiere editar el input en el workflow.

**Más adelante:** la federación de identidad de cargas de trabajo evita un
secreto estático. A cambio, necesita `id-token: write` y configuración en la
consola de Anthropic **[D]**.

### Límites

| Límite | Valor | Mecanismo | Tipo |
|---|---|---|---|
| Tamaño del diff | 500 líneas del diff unificado (encabezados incluidos), 100 000 bytes y líneas de hasta 1000 caracteres | El paso de preparación mide; por encima de cualquiera no lanza el modelo y publica que no se revisó. **Nunca trunca** | **Efectivo [L]:** probado con 500 líneas (revisa), 501 (no), 120 kB en 300 líneas (no), una línea de 1001 caracteres (no) y de 1000 (revisa) |
| Turnos | 10 | `--max-turns`, que la acción pasa como `maxTurns` al SDK | Según el código, una ejecución que no termina bien hace fallar el paso **[C]**. Sin probar |
| Tiempo | 10 min el job `review`, 5 min el job `publish` | `timeout-minutes` | **Efectivo:** GitHub cancela el job **[D]** |
| Gasto | Aproximadamente 1 USD por ejecución | `--max-budget-usd 1.00` | **Aproximado:** usa una estimación del cliente, que puede diferir de la factura y pasarse del tope **[D]**. Que la acción lo pase al CLI: **[C]**, sin probar |
| Modelo | `claude-sonnet-5-5` | `--model` | Decide qué modelo se usa, no el gasto |
| Salida | Hallazgos de gravedad alta y media, todos; sugerencias menores, como máximo 3 | Las instrucciones piden 3 como máximo; el paso de publicación muestra 3 y dice cuántas llegaron si son más. El esquema no usa `maxItems`, para que 4 sugerencias no anulen una revisión | **[L]** en el paso de publicación |

### Salida: cobertura declarada y filtro de secretos

**Cobertura declarada, no calidad.** La ejecución queda en verde solo si:

- el modelo devuelve `status: complete`;
- `not_reviewed` está vacío;
- todos los archivos del diff figuran en `reviewed_files`;
- el head del PR no cambió.

Eso demuestra **cobertura declarada**: que el modelo **dice** haber revisado
cada archivo. No demuestra que lo haya leído entero, que la revisión sea
completa ni que sus hallazgos sean correctos. El comentario usa esa misma
denominación.

**Filtro de secretos: una defensa limitada.** El paso «Check the result»
descarta la salida si contiene, **literalmente**, la clave del modelo o el
token del job **[L]**. No detecta:

- una clave transformada: codificada, partida, invertida o resumida;
- otros secretos o variables del entorno del runner;
- datos sensibles leídos de archivos.

Tampoco se verificó qué hace GitHub con los outputs de un job que contienen
secretos. **No es una garantía contra filtraciones.** Los controles
principales son que el modelo no tenga cómo leer el entorno (sección
anterior, sin demostrar) y que el comentario sea público solo después de
pasar este filtro.

Además, el comentario publica texto del modelo con un único filtro: el de
las menciones (`@`). Enlaces, imágenes y HTML en Markdown pasan tal cual.

### Fallos: nunca «sin hallazgos»

- **Un fallo de la acción hace fallar su paso.** Si la ejecución no termina
  bien (turnos, autenticación, presupuesto u otro error) o no entrega
  `structured_output`, la acción lanza una excepción: el paso queda en rojo y
  el output `conclusion` no llega a escribirse **[C]**.
- **El paso tiene `continue-on-error: true`**, para que el job siga y el paso
  «Check the result» registre `review=failed`.
- **Solo la cobertura declarada completa, sobre el head vigente, deja la
  ejecución en verde.** Todo lo demás publica el motivo y sale con `1`.

| Situación | Comentario | Salida |
|---|---|---|
| Cobertura declarada completa, sin hallazgos | «Cobertura declarada…», más «El modelo no informó hallazgos sólidos» y lo declarado como revisado | `0` |
| Cobertura declarada completa, con hallazgos | Hallazgos con gravedad, `archivo:línea`, escenario y causa; como máximo 3 sugerencias menores | `0` |
| Cobertura declarada incompleta: así la declara el modelo, o hay archivos del diff que no figuran | «Cobertura declarada incompleta», más lo no revisado | `1` |
| El head cambió, o no se pudo consultar | «No hay revisión: …»; no publica el resultado | `1` |
| Diff por encima de los límites, con líneas demasiado largas, vacío o imposible de obtener | «No hay revisión: …», con el motivo | `1` |
| Instrucciones o esquema ausentes en la base | «No hay revisión: …» | `1` |
| Falta el secreto `ANTHROPIC_API_KEY` | «No hay revisión: falta el secreto…, así que no se invocó al modelo» | `1` |
| Error de la acción: autenticación, turnos, presupuesto, ejecución o falta de `structured_output` | «No hay revisión: la revisión no terminó…», que remite al log | `1` |
| La salida contiene la clave o el token, literalmente | «No hay revisión: … se descartó» | `1` |
| Job `review` fallido o con timeout | «No hay revisión: el job terminó en …» | `1` |
| Salida sin el formato esperado | «No hay revisión: …» | `1` |

Cada «No hay revisión» agrega: «Esto no significa “sin hallazgos”». Cada
comentario empieza con el head del PR al poner la etiqueta (`head.sha` del
evento) y aclara que todo el comentario se refiere a ese commit.

**Sin credencial del modelo, el modelo no se invoca:** el paso de
preparación recibe solo un booleano, `secrets.ANTHROPIC_API_KEY != ''`, nunca
el valor. Un secreto sin definir se evalúa como cadena vacía **[D]**. Si es
`false`, el resultado es `no-credentials`, y el paso del modelo, que exige
`outcome == 'ready'`, no corre **[L]**, probado con valores `false`, vacío y
`true`. No depende de que la acción falle. **No hay reintento automático.** Quien revisa
el PR acepta, corrige o descarta cada punto, con un motivo. **El modelo no
aprueba ni bloquea.**

### Riesgos

- **El contenido del PR no es confiable.** Las instrucciones dicen que el diff
  es dato, no instrucción. La acción limpia algunas formas de contenido
  oculto, pero advierte que pueden aparecer otras **[D]**.
- **Secretos en el proceso del modelo:** ver [Qué puede leer el modelo y qué
  credenciales recibe](#qué-puede-leer-el-modelo-y-qué-credenciales-recibe)
  y [Filtro de secretos](#salida-cobertura-declarada-y-filtro-de-secretos).
- **El workflow es el del PR.** Con `pull_request`, un PR puede editar
  `ai-review.yml` para leer otras instrucciones, quitar restricciones o hacer
  otra cosa con el secreto. Que las instrucciones vengan de la base no protege
  de eso. Es el mismo límite que el de `route-surface`, y solo lo cubren la
  revisión humana y, más adelante, propietarios de código o un ruleset.
- **Lo que instala la acción** **[C]**: `bun install --production` de sus
  propias dependencias, y Claude Code v2.1.310 con
  `curl -fsSL https://claude.ai/install.sh | bash`. La versión está fijada en
  el código de la acción; el script se descarga sin fijar.
- **Repositorio público:** los logs de Actions son públicos. No se activa
  `show_full_output`, que puede exponer secretos en el log **[D]**.

### Rama base para la primera prueba

La rama base del PR de prueba tiene que contener `.github/ai-review/`. Si no,
el workflow publica que faltan las instrucciones. `main` no lo tiene, y no
hace falta hacer merge del PR #1 para eso: el workflow no filtra la rama base.

**Recomendada: usar `publicacion/repaso-clases-1-a-5` como base.**

1. Commit y push de este cambio a esa rama, cuando se decida. El PR #1 lo
   incorpora, como el resto del trabajo acumulado; no se hace merge a `main`.
2. Una rama temporal desde ese commit, con un defecto pequeño y conocido (por
   ejemplo, la mutación de `auth` del camino negativo de `route-surface`).
3. Un PR de esa rama hacia `publicacion/repaso-clases-1-a-5`, no hacia `main`.
   Su diff es solo la mutación, y las instrucciones salen de un commit que
   revisó Pablo.
4. Una sola etiqueta. Después, cerrar el PR sin merge y borrar la rama.

**Alternativa, sin tocar el PR #1:** una rama base temporal desde `main`, con
un único commit que agregue solo `.github/ai-review/` y el workflow. La rama
de prueba sale de ella. Su desventaja: la base no tiene el resto del trabajo,
y hay que borrarla al terminar.

**En las dos, la confianza en la base es por acceso, no por una regla:** sin
protección de rama, cualquiera con permiso de escritura puede cambiar la
rama base. Y la acción toma la configuración de Claude de la **punta** de esa
rama, no de `base.sha` **[C]**.

### Prueba única propuesta

Una sola ejecución inicial, con un límite aproximado de **1 USD**
(`--max-budget-usd 1.00`, una estimación del cliente que puede pasarse).
**Pendiente de autorización:** no se ejecuta ningún modelo hasta entonces.
No se estima el costo con precios: se registra el que informe la consola
después de la prueba.

**Antes, una prueba sin credenciales,** con la variable activada y **sin**
crear el secreto. El prechequeo impide invocar la acción del modelo. La
etiqueta debería publicar «No hay revisión: falta el secreto
ANTHROPIC_API_KEY, así que no se invocó al modelo». Eso prueba:

- el disparo y la condición de etiqueta;
- el checkout de la base;
- el diff fijado por la API de compare con `contents: read`;
- los límites;
- `gh pr view` y `gh pr comment` con `pull-requests: write`;
- el head en el comentario.

En el log, el paso «Review (advisory)» tiene que figurar como omitido.

### Lo que requiere una prueba real

- Que GitHub acepte el workflow, y las condiciones de disparo, etiquetas y
  concurrencia.
- Que la acción funcione con un token de solo `contents: read` y sin la app.
- Que `--restricted`, `--settings`, `--disallowedTools`, `--json-schema` y
  `--max-budget-usd` lleguen al CLI, y que juntos no impidan la salida
  estructurada.
- Que la lectura fuera del directorio de trabajo, por ejemplo de
  `/proc/self/environ`, se rechace de verdad.
- Que `pull-requests: write` alcance para `gh pr view` y `gh pr comment`.
- `--max-turns`, el comportamiento ante un timeout y el costo real.
- La calibración: los casos de
  [`revision-adversarial-calibracion.md`](revision-adversarial-calibracion.md).

## Validado localmente, observado en GitHub y pendiente

| Validado localmente | Observado en GitHub (fork, 2026-10-26) | Pendiente |
|---|---|---|
| Instalación limpia desde el lockfile versionado; `routes:check` sin `.env`, sobre una copia hecha con `git archive` (solo archivos versionados, incluidos `.adonisjs/` y `tmp/.gitkeep`); la falla con salida `2`; SHA y tags de las acciones en sus repositorios oficiales; el YAML se parsea como YAML. **No** se validó con un validador de workflows: `actionlint`, `zizmor` y `check-jsonschema` no están instalados | GitHub acepta el workflow; el disparo por `pull_request` hacia `main` desde una rama del mismo repo; checkout del commit de merge; permisos efectivos `Contents: read` y `Metadata: read`; `setup-node` instalando 24.8.0 (npm 11.6.0); `npm ci` desde el lockfile; salida `0` con la superficie intacta y `1` con diferencias al quitar `auth`; job de 15 a 16 s | Comportamiento con PRs desde otro fork y con borradores; la aprobación manual que puede exigirse para PRs de colaboradores externos nuevos; la salida `2` en GitHub; bloqueo del merge con un check obligatorio (no hay ruleset); **todo el revisor de IA en GitHub y con un modelo**: ver [Lo que requiere una prueba real](#lo-que-requiere-una-prueba-real). Del revisor, solo los scripts de preparación, control del resultado y publicación se probaron localmente, con un `gh` simulado |

## Decisiones externas pendientes

1. **Dónde correr:** `origin` es `LIDR-academy/flowsync-ai4devs`, el repo del
   curso. Instalar la app y cargar secretos requiere ser admin. ¿Es el repo
   del curso u otro donde lo seas? El job determinista ya corrió en el fork
   `pablo-wpify/flowsync-ai4devs`, sin secretos. El revisor de IA sigue sin
   lugar decidido.
2. **Autenticación del modelo:** recomendada, una clave de API dedicada
   (secreto `ANTHROPIC_API_KEY`). Alternativa: un token OAuth de suscripción,
   que requiere cambiar el input. Ver
   [Autenticación](#autenticación-github-y-modelo-por-separado).
3. **Identidad de GitHub de la acción:** el workflow preparado usa el
   `GITHUB_TOKEN` del job, sin la app de Claude. Se puede reconsiderar si la
   prueba muestra que la acción no funciona con un token de solo lectura.
4. **Protección:** si `route-surface` pasa a ser un check obligatorio, con qué
   ruleset, si sin excepción para admins, y cómo se protegen el checker, la
   referencia y el workflow (por ejemplo, con propietarios de código).
5. **Valores de los límites:** propuestos 500 líneas, 100 000 bytes y líneas
   de hasta 1000 caracteres de diff, 10 turnos, 10 minutos y un límite
   aproximado de 1 USD por ejecución. **Una sola ejecución inicial, pendiente
   de autorización.** Si conviene además un tope de gasto en la consola de
   Anthropic está **[?]** sin verificar.
6. **Lockfiles locales:** quedan fuera; CI usa los versionados.
7. **Activación del revisor:** crear la etiqueta `ai-review`, el secreto y la
   variable `AI_REVIEW_ENABLED=true`, y elegir la rama base de la prueba, que
   debe contener `.github/ai-review/` (ver
   [Rama base para la primera prueba](#rama-base-para-la-primera-prueba)).

## Fuentes

Consultadas el 2026-10-25:

- GitHub, eventos que disparan workflows:
  <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>
- GitHub, sintaxis de workflows (`permissions`, `timeout-minutes`,
  `concurrency`, `paths`):
  <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>
- GitHub, uso seguro de Actions (`pull_request_target`, inyección en
  scripts, privilegio mínimo, fijado por SHA):
  <https://docs.github.com/en/actions/reference/security/secure-use>
- GitHub, ramas protegidas y checks obligatorios:
  <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>
- `actions/checkout` v7.0.1:
  <https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/README.md>
- `actions/setup-node` v7.1.0:
  <https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/README.md>
- `anthropics/claude-code-action` v1.0.262, leído en el SHA fijado
  (consultado el 2026-10-26):
  <https://github.com/anthropics/claude-code-action/blob/925afb53776cf1a2b738c6bdbed37b4d4000ef13/action.yml>,
  <https://github.com/anthropics/claude-code-action/blob/925afb53776cf1a2b738c6bdbed37b4d4000ef13/docs/security.md>,
  <https://github.com/anthropics/claude-code-action/blob/925afb53776cf1a2b738c6bdbed37b4d4000ef13/docs/usage.md>,
  <https://github.com/anthropics/claude-code-action/blob/925afb53776cf1a2b738c6bdbed37b4d4000ef13/docs/faq.md>,
  <https://github.com/anthropics/claude-code-action/blob/925afb53776cf1a2b738c6bdbed37b4d4000ef13/examples/pr-review-comprehensive.yml>;
  código **[C]**:
  <https://github.com/anthropics/claude-code-action/blob/925afb53776cf1a2b738c6bdbed37b4d4000ef13/src/entrypoints/run.ts>,
  <https://github.com/anthropics/claude-code-action/blob/925afb53776cf1a2b738c6bdbed37b4d4000ef13/base-action/src/run-claude-sdk.ts>,
  <https://github.com/anthropics/claude-code-action/blob/925afb53776cf1a2b738c6bdbed37b4d4000ef13/base-action/src/parse-sdk-options.ts>
- Claude Code, GitHub Actions, autenticación y salida estructurada:
  <https://code.claude.com/docs/en/github-actions>,
  <https://code.claude.com/docs/en/authentication>,
  <https://code.claude.com/docs/en/agent-sdk/structured-outputs>
- `anthropics/claude-code-action`, versión anterior consultada el 2026-10-25:
  <https://github.com/anthropics/claude-code-action>,
  <https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md>,
  <https://github.com/anthropics/claude-code-action/blob/main/docs/security.md>,
  <https://github.com/anthropics/claude-code-action/blob/main/docs/faq.md>,
  <https://github.com/anthropics/claude-code-action/blob/main/docs/solutions.md>
- Referencia del CLI de Claude Code (`--max-turns`, `--max-budget-usd`,
  `--model`, `--allowedTools`, `--json-schema`):
  <https://code.claude.com/docs/en/cli-reference>
