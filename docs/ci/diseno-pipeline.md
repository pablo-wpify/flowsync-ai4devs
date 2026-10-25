# Diseño del pipeline: superficie de rutas y revisión adversarial

> **Fecha:** 2026-10-25 · **Estado:** el workflow determinista está escrito
> (`.github/workflows/route-surface.yml`) pero **nunca se ejecutó en GitHub**.
> La revisión adversarial es **solo diseño**: no hay workflow ejecutable.
>
> **Origen:** propuesta nuestra para el módulo 5. Se contrastó con el prework
> y la guía escrita del módulo. Los videos y el PDF de prompts **siguen sin
> revisar**.

Marcas: **[L]** comprobado localmente · **[D]** documentado (ver
[Fuentes](#fuentes)) · **[I]** inferido de la documentación · **[?]**
pendiente de verificar en GitHub.

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
  - Qué permiso exacto necesita un comentario general en un PR, y cuál uno
    sobre una línea, está **[?]** pendiente de verificar.
  - El job determinista no publica nada y no tiene permisos de escritura.

## El control no verifica su propia integridad

Un PR puede modificar **el checker**
(`backend/scripts/check_route_surface.ts`), **la referencia**
(`backend/contracts/route_surface.v1.json`) y **el propio workflow**. Con
`pull_request`, el workflow corre sobre el commit de merge del PR **[D]**, así
que su definición también es la del PR **[I]**. Por eso:

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
| Token | `permissions: contents: read`. Checkout con `persist-credentials: false` |
| Secretos | Ninguno. En PRs de forks no se pasan secretos y el token es de solo lectura **[D]** |
| Node | `24.8.0`, la versión con la que se verificó **[L]** |
| Acciones | Fijadas por SHA completo, tomado con `git ls-remote` de `github.com/actions/*` **[L]**: `actions/checkout` v7.0.1 = `3d3c42e5aac5ba805825da76410c181273ba90b1`, `actions/setup-node` v7.1.0 = `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| Caché | Desactivada (`package-manager-cache: false`): menos superficie de ataque y una instalación que no depende de corridas anteriores |
| Instalación | `npm ci --ignore-scripts` desde el lockfile versionado. Evita **solo los scripts de instalación de las dependencias** (los de `@swc/core` y `better-sqlite3`, y la descarga de binarios). El control no los necesita **[L]** |
| Código del PR | **El job sigue ejecutando código del PR:** `routes:check` corre el script del PR, y `ace list:routes` arranca la aplicación del PR (rutas, configuración, providers, controladores). Ese código corre con el token de solo lectura y sin secretos. El workflow no le pasa el `GITHUB_TOKEN` a los pasos `run` **[I]**, y `persist-credentials: false` evita que quede en `.git/config` |
| Entorno | Variables sintéticas en el job, sin archivo `.env`. `APP_KEY` es un relleno declarado como no secreto |
| Tiempo | `timeout-minutes: 10`. El valor por defecto es 360 **[D]** |
| Concurrencia | Un grupo por número de PR, con `cancel-in-progress: true`. Solo es correcto mientras `pull_request` sea el único evento: con `push` o `workflow_dispatch` el número quedaría vacío y todas esas ejecuciones compartirían un grupo |
| Fallos | Cualquier salida distinta de 0 hace fallar el job, y **en GitHub el `1` y el `2` se ven igual: un paso en rojo**. Para distinguirlos hay que leer el log: `Route surface differs …` (diferencias) o `Route surface check failed: …` (generación o formato). Un `1` sin esa primera línea viene de Node, por ejemplo porque no pudo cargar el script |
| `NODE_ENV` | `development` en todo el job. Con `production`, `npm ci` omitiría las devDependencies, que el script necesita |
| Bloqueo | **Ninguno todavía.** No es un check obligatorio: no hay protección de rama ni ruleset. Que el workflow falle no bloquea el merge por sí solo |

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
solo como YAML (`yaml.safe_load`), no con un validador de workflows.

## Revisión adversarial: diseño (sin workflow)

### Disparo y alcance

- **Evento:** `pull_request` con `types: [labeled]`. El job corre solo si
  `github.event.label.name == 'ai-review'`. La etiqueta la pone una persona,
  y cada nueva revisión requiere quitarla y volver a ponerla.
- **Exclusiones:**
  - **Borradores:** `github.event.pull_request.draft == false`.
  - **Forks:** `github.event.pull_request.head.repo.full_name ==
    github.repository`. En un fork tampoco habría secretos **[D]**.
  - La acción solo responde a usuarios con permiso de escritura, y bloquea
    los bots salvo que se los habilite con `allowed_bots` **[D]**. No usar
    `allowed_non_write_users`.
- **Alcance:** el diff del PR contra su base y los archivos que toca. **No
  instala dependencias ni ejecuta código del PR:** solo lee.

### Permisos

- Token del workflow: `contents: read` más el permiso de escritura para
  comentar, que está **[?]** pendiente de verificar (ver «Tres permisos
  distintos»). Más `id-token: write` solo si se usa la app de GitHub **[D]**.
- Herramientas: lectura (`Read`, `Grep`, `Glob`), `gh pr diff` y
  `gh pr view`, y las herramientas de comentario de la acción. Sin `Edit`,
  sin `Write` y sin otros comandos de Bash. La acción ya deja Bash desactivado
  por defecto **[D]**.
- Las instrucciones son las del archivo de calibración, incluidas en el
  `prompt`. Que la acción cargue `.claude/agents/adversarial-reviewer.md`
  está **[?]** sin verificar.

### Límites

| Límite | Mecanismo | Tipo |
|---|---|---|
| Tiempo del job | `timeout-minutes: 15` | **Efectivo:** GitHub cancela el job **[D]** |
| Turnos | `--max-turns 15` en `claude_args` | **Efectivo en el CLI**, que termina con error al llegar al límite **[D]**. Que la acción lo respete está **[?]** pendiente |
| Tamaño del diff | Un paso previo que cuente las líneas del diff y no lance la revisión por encima de, por ejemplo, 1500 | **Efectivo** si se implementa así. El valor es a decidir |
| Concurrencia | Un grupo por PR, con `cancel-in-progress: true` | **Efectivo** **[D]** |
| Modelo | `--model sonnet` | **Efectivo** sobre qué modelo se usa, no sobre el gasto |
| Gasto | `--max-budget-usd` | **Aproximado:** usa una estimación del cliente, que puede diferir de la factura y pasarse del tope **[D]**. Que la acción lo respete está **[?]** pendiente |
| Gasto mensual y costo por revisión | Consola del proveedor, a posteriori | **Solo observación.** Si existen topes de gasto en la consola está **[?]** sin verificar |

### Fallos

- La revisión es **consultiva:** no será un check obligatorio. Que falle por
  tiempo, turnos, presupuesto o autenticación no bloquea el avance.
- Un fallo deja el run en rojo en la pestaña Actions. Quien lleva el PR
  decide si reintentar, volviendo a poner la etiqueta.
- **No hay reintento automático.**
- Si el diff supera el tope de tamaño, se deja constancia de que no se revisó
  y por qué. **Nunca se publica «sin hallazgos» por una revisión que no se
  hizo.**

### Dónde aparecen los hallazgos y quién decide

- Un comentario general (`use_sticky_comment`), más comentarios sobre líneas
  cuando haya un archivo y una línea concretos **[D]**.
- Quien revisa el PR acepta, corrige o descarta cada hallazgo, con un motivo.
  **El modelo no aprueba ni bloquea.**

### Riesgos

- **El contenido del PR no es confiable:** el diff, los comentarios y un
  `CLAUDE.md` modificado pueden traer instrucciones. La acción limpia algunas
  formas de contenido oculto, pero advierte que pueden aparecer otras **[D]**.
  Mitigaciones: herramientas de solo lectura más comentarios, ninguna
  ejecución de código, decisión humana.
- **El secreto del modelo está en el runner:** por eso este job no ejecuta
  código del PR.
- **Cadena de suministro:** fijar `anthropics/claude-code-action` por SHA,
  verificado desde su repositorio oficial cuando se escriba el workflow.

## Validado localmente y pendiente en GitHub

| Validado localmente | Requiere una ejecución real en GitHub |
|---|---|
| Instalación limpia desde el lockfile versionado; `routes:check` sin `.env`, sobre una copia hecha con `git archive` (solo archivos versionados, incluidos `.adonisjs/` y `tmp/.gitkeep`); la falla con salida `2`; SHA y tags de las acciones en sus repositorios oficiales; el YAML se parsea como YAML. **No** se validó con un validador de workflows: `actionlint`, `zizmor` y `check-jsonschema` no están instalados | Que GitHub acepte el workflow; disparadores y condiciones; permisos efectivos del token; comportamiento con forks y borradores; la aprobación manual que puede exigirse para PRs de colaboradores externos nuevos; `setup-node` instalando 24.8.0; tiempo real del job; autenticación de la acción de Claude; qué permiso necesita cada tipo de comentario; si la acción respeta `--max-turns` y `--max-budget-usd`; costo real; bloqueo del merge con un check obligatorio |

## Decisiones externas pendientes

1. **Dónde correr:** `origin` es `LIDR-academy/flowsync-ai4devs`, el repo del
   curso. Instalar la app y cargar secretos requiere ser admin. ¿Es el repo
   del curso u otro donde lo seas?
2. **Autenticación del modelo:** clave de API (pago por uso) o token OAuth de
   suscripción.
3. **Identidad de GitHub de la acción:** la app de Claude (instalación por un
   admin) o el `GITHUB_TOKEN`.
4. **Protección:** si `route-surface` pasa a ser un check obligatorio, con qué
   ruleset, si sin excepción para admins, y cómo se protegen el checker, la
   referencia y el workflow (por ejemplo, con propietarios de código).
5. **Valores de los límites:** tope del diff, turnos, tiempo y presupuesto.
6. **Lockfiles locales:** quedan fuera; CI usa los versionados.

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
- `anthropics/claude-code-action`:
  <https://github.com/anthropics/claude-code-action>,
  <https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md>,
  <https://github.com/anthropics/claude-code-action/blob/main/docs/security.md>,
  <https://github.com/anthropics/claude-code-action/blob/main/docs/faq.md>,
  <https://github.com/anthropics/claude-code-action/blob/main/docs/solutions.md>
- Referencia del CLI de Claude Code (`--max-turns`, `--max-budget-usd`,
  `--model`, `--allowedTools`, `--json-schema`):
  <https://code.claude.com/docs/en/cli-reference>
