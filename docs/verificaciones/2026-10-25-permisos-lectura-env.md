# Verificación: regla de permisos contra la lectura de `.env`

> **Fecha:** 2026-10-25 · **Claude Code:** 2.1.310 · **Rama:**
> `chore/clase-3-tests-aislados` (sin commit).
>
> **Naturaleza de este informe:** registra **observaciones** de pruebas
> manuales sobre un archivo señuelo. El señuelo se borró al terminar. No
> demuestra una protección completa de secretos.

## Resumen

- **Read bloqueado** en el agente principal y en el subagente
  `adversarial-reviewer`: **observado**.
- **Grep bloqueado** en el subagente: **observado**.
- **`cat` por Bash rechazado: causa no determinada.** No prueba por sí solo que
  actuara la regla `deny`.
- **`.env.example` sigue disponible según el patrón documentado.** No se
  ejecutó ninguna prueba sobre él.
- **Alcance:** es un control acotado a Claude Code y a archivos llamados
  exactamente `.env`. **No es una protección general de secretos.**

## Objetivo

La regla «no leer ni mostrar secretos de `.env`» era solo una instrucción: ni
`.claude/settings.json` ni `.claude/settings.local.json` tenían reglas `deny`,
y el `adversarial-reviewer` («solo lectura») tiene `Read` sin restricciones.
Este ejercicio la convierte en una regla de permisos que aplica Claude Code, y
mide hasta dónde llega.

## Regla

En `.claude/settings.json`, conservando el hook de Prettier sin cambios:

```json
"permissions": {
  "deny": ["Read(.env)"]
}
```

## Comportamiento documentado

Fuentes consultadas el 2026-10-25 (documentación oficial vigente, no
específica de la versión instalada):
[Configure permissions](https://code.claude.com/docs/en/permissions),
[Settings files and precedence](https://code.claude.com/docs/en/settings),
[Subagents](https://code.claude.com/docs/en/sub-agents).

- **Sintaxis:** los patrones de `Read` siguen gitignore. Un nombre suelto
  coincide a cualquier profundidad bajo el directorio actual: `Read(.env)`
  equivale a `Read(**/.env)`. Coincide solo con archivos llamados exactamente
  `.env`, así que, según ese patrón, **`.env.example` sigue legible** sin
  necesidad de una excepción `!`. Es una conclusión de la documentación: no
  se probó.
- **Precedencia:** se evalúa `deny`, luego `ask`, luego `allow`. Un `deny` de
  cualquier ámbito no puede revertirse con un `allow` de otro (por ejemplo,
  de `settings.local.json`). Las reglas `deny` del archivo compartido aplican
  sin esperar la confianza en la carpeta.
- **Cobertura:** las reglas `Read` aplican a las herramientas de archivos,
  «best-effort» a Grep y Glob, y a comandos de Bash que Claude Code reconoce
  (`cat`, `head`, `tail`, `sed`, `tee`, redirecciones). **No** aplican a
  comandos que leen sin nombrar el archivo (`grep -r` desde el directorio) ni
  a subprocesos que abren archivos por su cuenta (scripts de Python o Node).
  Para eso la documentación remite al sandbox.
- **Subagentes:** la documentación indica que las reglas de `permissions.deny`
  «apply to the main conversation and to subagents».
- **Recarga:** Claude Code vigila los archivos de configuración y aplica los
  cambios de `permissions` sin reiniciar.

## Pruebas y resultados observados

Señuelo: `backend/tmp/guardrail-canary/.env`, ignorado por Git (`tmp/*`), con
un marcador ficticio. No se leyó, buscó ni probó nada sobre los `.env` reales.

| # | Prueba | Configuración | Resultado observado |
|---|---|---|---|
| 1 | `Read` desde el agente principal | sin la regla | Devolvió el marcador |
| 2 | `Read` desde el agente principal | con la regla, sin reiniciar | Rechazado: `File is in a directory that is denied by your permission settings.` |
| 3 | `Read` desde `adversarial-reviewer` | con la regla | Rechazado, mismo mensaje |
| 4 | `Grep` (patrón `CANARY`, `path` = el señuelo) desde `adversarial-reviewer`¹ | con la regla | Rechazado: `Permission to read …/guardrail-canary/.env has been denied.` |
| 5 | `cat` del señuelo por Bash, desde el agente principal | con la regla | Rechazado: `Permission to use Bash with command cat … has been denied.` |
| 6 | `rm` del señuelo y `rmdir` de su carpeta (limpieza) | con la regla | **Permitido**: la regla no impide borrar |

¹ La sesión principal no tenía la herramienta Grep disponible; por eso la
prueba se hizo desde el revisor.

**Lectura de los resultados.** Las pruebas 2 a 4 coinciden con lo documentado
y muestran que la regla se cargó sin reiniciar y que el subagente la hereda.
En la prueba 5, el mensaje no dice qué rechazó el comando: la sesión corría en
modo auto, donde un clasificador también puede rechazar comandos. La causa
**no está determinada** y esta prueba no demuestra por sí sola que actuara la
regla `deny`.

## Límites

- **Control acotado, no una protección general de secretos.** Solo actúa
  dentro de Claude Code y solo sobre archivos llamados exactamente `.env`. No
  cubre `.env.local` (`frontend/`), `.env.test`, `.env.production` ni otros
  archivos con secretos.
- **Bash solo en parte.** Según la documentación, no cubre lecturas sin nombrar
  el archivo ni subprocesos. No se probaron, por consigna: no se buscó eludir
  el rechazo.
- **No impide borrar ni, según la documentación, `NotebookEdit`.** El borrado
  se observó en la limpieza; para cambios haría falta una regla `Edit`.
- **Anclada al directorio de la sesión (respaldado por la documentación, no
  probado).** La página de settings dice que Claude Code lee el
  `.claude/settings.json` compartido desde el directorio de trabajo principal
  de la sesión, y que para usar el de la raíz del repositorio hay que iniciar
  Claude Code allí. La página de permisos dice que un patrón sin prefijo es
  relativo al directorio actual. De ahí se deduce que una sesión iniciada en
  `backend/` no cargaría esta regla. No se ejecutó esa prueba.
- **Solo Claude Code.** No afecta a personas, editores, otras herramientas ni
  sesiones en la nube con otra configuración.
- **Sin sandbox.** No hay aislamiento a nivel de sistema operativo.
- **Pruebas manuales sobre un señuelo, sin artefactos.** No certifican otras
  versiones ni configuraciones.

## Cómo revertir

En `.claude/settings.json`, eliminar únicamente `"Read(.env)"` de
`permissions.deny`. Si `deny` queda vacío, retirar solo la estructura que
sobre: el arreglo `deny` y, si no le queda otra clave, el objeto
`permissions`. Conservar el hook de Prettier y cualquier otro permiso que se
haya agregado después. Según la documentación, Claude Code recarga el archivo
sin reiniciar.
