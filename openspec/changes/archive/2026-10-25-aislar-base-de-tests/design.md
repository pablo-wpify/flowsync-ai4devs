# Design

> **Estado:** la opción A de DT-6 está **aprobada como dirección de diseño**,
> con los ajustes de esta versión (separar resolución y evaluación, respetar
> mayúsculas del sistema de archivos, ejecución exclusiva, comprobaciones antes
> de borrar y orden real de arranque).

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: ver
`specs/aislamiento-de-tests/spec.md`.

Estado actual comprobado en el código (solo lectura):

- `config/database.ts` define una única conexión SQLite cuyo archivo es
  siempre `app.tmpPath('db.sqlite3')`, sin distinción por entorno, y no fija
  `journal_mode`.
- `bin/test.ts` fija `NODE_ENV = 'test'` antes de arrancar la aplicación, y
  AdonisJS expone `app.inTest`.
- `tests/bootstrap.ts` exporta `runnerHooks.setup` y `runnerHooks.teardown`
  (hoy vacíos) y arranca el servidor HTTP en la configuración de las suites
  `functional`, `browser` y `e2e`. No existen `tests/unit/` ni
  `tests/functional/`.
- `testUtils.db().migrate()` de Lucid ejecuta `migration:run` con
  `--no-schema-generate` y devuelve una función que ejecuta `migration:reset`.
  Migrar así **no regenera** `database/schema.ts`.
- **Orden de arranque** (leído en el código de Japa y de Lucid, a confirmar en
  ejecución con la comprobación de D2):
  1. los providers arrancan; el de Lucid solo registra el adaptador, las
     utilidades de test, la REPL y las reglas de VineJS, y **no abre la
     conexión**: se abre de forma diferida, con la primera consulta;
  2. los preloads (`start/routes`, `start/kernel`, `start/validator`) no
     consultan la base;
  3. Japa ejecuta `runnerHooks.setup` **antes** de importar los archivos de
     tests y antes de la configuración de cada suite, que es donde arranca el
     servidor HTTP.
- `tmp/*` está ignorado por Git.
- Durante el trabajo, el servidor de desarrollo está corriendo y escribe en
  `tmp/db.sqlite3` por su cuenta.

## Goals / Non-Goals

**Goals:**

- Una base de tests elegida por el entorno, sin variables nuevas que puedan
  faltar.
- Una salvaguarda que se ejecute antes de cualquier acceso a una base y que
  distinga los datos que consulta del sistema de archivos de la decisión que
  toma.
- Una sola ejecución a la vez sobre la base de tests.
- Borrar solo el archivo autorizado, comprobándolo justo antes.
- Probar la salvaguarda sin acercar nunca la ejecución real a la base de
  desarrollo.
- Ejecuciones repetibles y tests aislados entre sí.

**Non-Goals:**

- Cambiar el motor de base de datos o la forma de migrar en desarrollo.
- Tests de las funcionalidades del registro de estado técnico.
- Proteger contra comandos ejecutados a mano fuera de la suite de tests (por
  ejemplo, `node ace migration:run` en desarrollo sigue apuntando a la base de
  desarrollo, como hoy).

## Decisions

### D1. Selección de la base exclusiva

`config/database.ts` elige el archivo según el entorno: `tmp/db.test.sqlite3`
cuando `app.inTest` es verdadero, y `tmp/db.sqlite3` en cualquier otro caso.

- **Por qué:** el entorno de tests ya lo fija `bin/test.ts`; no hace falta una
  variable nueva que pueda faltar y hacer caer en la base de desarrollo.
- **Alternativas consideradas:**
  - *Variable de entorno con la ruta:* si falta, el valor por defecto sería la
    base de desarrollo. Descartada como mecanismo principal.
  - *SQLite en memoria:* no está comprobado que el pool de Lucid comparta una
    única base en memoria entre la suite y el servidor HTTP del mismo proceso.
  - *Una segunda conexión con nombre propio:* agrega configuración sin aportar
    seguridad frente a D1.

### D2. Dónde y cuándo se verifica

La salvaguarda es la **primera** función de `runnerHooks.setup` en
`tests/bootstrap.ts`, antes de adquirir la exclusividad, borrar, migrar o
limpiar.

- Lee la configuración **efectiva** de la conexión desde la configuración de
  la aplicación ya cargada, no un valor recalculado.
- Compara contra la base protegida, `app.tmpPath('db.sqlite3')`, calculada de
  forma independiente del entorno.
- **Comprobación del orden real:** la salvaguarda también falla si la
  conexión de Lucid ya está abierta en ese momento. Si en la ejecución
  apareciera un acceso previo, la salvaguarda se movería a un punto anterior a
  ese acceso y se documentaría.
- Si falla, lanza un error explícito; el runner termina con código distinto de
  cero y no se ejecuta ningún otro hook ni test.

### D3. Resolución de rutas e identidad, separada de la evaluación

Son dos funciones distintas:

- **Resolución (consulta el sistema de archivos):** para una ruta, devuelve un
  descriptor con: la ruta absoluta normalizada (sin `.` ni `..`); la ruta real,
  resolviendo enlaces simbólicos sobre el ancestro existente más largo y
  agregando los segmentos que aún no existen; si existe; si la última parte de
  la ruta es un enlace simbólico; si es un archivo regular; y su identidad
  física (dispositivo e inodo) cuando existe. No decide nada.
- **Evaluación (no consulta el sistema de archivos):** recibe los descriptores
  ya resueltos de la base de tests, de las bases protegidas y del directorio
  autorizado, más el entorno y si la conexión ya está abierta, y devuelve la
  lista de motivos de rechazo. Es determinista y se prueba con descriptores
  construidos a mano.

Reglas de la evaluación, todas obligatorias:

1. **Entorno:** debe ser el de tests.
2. **Conexión:** no debe estar abierta todavía (D2).
3. **Forma:** la ruta de tests es una ruta de archivo; se rechazan `:memory:` y
   cadenas vacías.
4. **Nombre:** el nombre de archivo es exactamente `db.test.sqlite3`.
5. **Directorio:** el directorio real de la base de tests es exactamente el
   directorio real autorizado (`tmp/` del backend).
6. **Enlace:** si la base de tests existe, no puede ser un enlace simbólico y
   debe ser un archivo regular.
7. **Ruta:** la ruta real de la base de tests es distinta de la de cada base
   protegida.
8. **Identidad física:** si ambas existen, sus identidades (dispositivo e
   inodo) son distintas. Esto cubre los enlaces duros.

**Mayúsculas:** las rutas se comparan tal como las devuelve el sistema de
archivos, sin pasarlas a minúsculas. En un sistema que no distingue
mayúsculas, dos rutas que solo difieren en ellas apuntan al mismo archivo, y la
regla 8 lo detecta por identidad física; además, el nombre esperado
(`db.test.sqlite3`) no coincide con el protegido (`db.sqlite3`) aun ignorando
mayúsculas.

**Módulo:** `tests/support/test_database_guard.ts`, en `snake_case` como el
resto de los archivos del backend, importable como
`#tests/support/test_database_guard`.

### D4. Prueba de configuraciones peligrosas con una base testigo

- **Evaluación:** tests unitarios con descriptores construidos a mano, sin
  sistema de archivos, que cubren cada regla de D3.
- **Resolución y salvaguarda completa:** tests unitarios sobre un directorio
  temporal propio, fuera del proyecto, con un archivo descartable que hace de
  **base testigo** y de base protegida. Casos: misma ruta; ruta con `..`;
  enlace simbólico al testigo; archivo en un directorio enlazado fuera del
  directorio autorizado; enlace duro al testigo; entorno distinto; nombre
  inesperado; conexión ya abierta; y un caso válido. En cada caso peligroso se
  compara la huella del testigo antes y después.
- **Borrado acotado (D8):** el mismo tipo de directorio temporal, con un
  destino de borrado que es un enlace simbólico, un directorio y un enlace duro
  al testigo: el borrado debe rechazarse y el testigo no debe cambiar.
- **Exclusividad (D7):** una marca creada por un proceso activo bloquea, y una
  marca de un proceso inexistente se reemplaza, siempre en el directorio
  temporal.
- La ejecución real **nunca** se redirige hacia la base de desarrollo; un test
  funcional comprueba que la configuración real pasa la salvaguarda.

### D5. Preparación, aislamiento y limpieza

Orden de `runnerHooks.setup`:

1. Salvaguarda (D2, D3).
2. Adquirir la exclusividad (D7).
3. Borrar el estado anterior de la base de tests, con las comprobaciones de
   D8: el archivo principal y sus auxiliares de SQLite (`-journal`, `-wal`,
   `-shm`).
4. `testUtils.db().migrate()`, que deja el esquema listo sin regenerar
   `database/schema.ts` y devuelve la función de `migration:reset`.

Aislamiento por test: los grupos funcionales abren una transacción global
antes de cada test y la revierten después
(`testUtils.db().withGlobalTransaction()`). Si un caso necesitara datos
confirmados, la alternativa es vaciar tablas, siempre sobre la base de tests.

Limpieza al terminar, en `runnerHooks.teardown`: ejecutar el `migration:reset`
del paso 4, cerrar todas las conexiones de Lucid y, recién entonces, liberar
la exclusividad, para que otra ejecución no borre la base mientras esta
todavía la tiene abierta. **La base de tests se conserva** con las
migraciones revertidas; el paso 3 de la ejecución siguiente garantiza el punto
de partida aunque una ejecución se interrumpa.

### D6. Documentación

`CLAUDE.md` explica: qué base usan los tests, la salvaguarda, la exclusividad,
cómo ejecutar las suites y que la verificación de integridad de la base de
desarrollo requiere detener todas sus conexiones.

### D7. Una sola ejecución a la vez

- La exclusividad se marca con un archivo `tmp/db.test.sqlite3.lock` que
  contiene el identificador del proceso. Se crea **ya con su contenido**: el
  identificador se escribe en un archivo temporal propio, que después se
  enlaza (enlace duro) con el nombre de la marca. El enlace falla si ya existe
  cualquier entrada con ese nombre, incluido un enlace simbólico, sin seguirlo,
  así que la marca nunca se ve vacía.
- Si la marca existe y su proceso sigue activo, la ejecución aborta **antes de
  borrar o migrar nada**.
- Si la marca existe pero su proceso ya no existe, se considera abandonada y se
  reemplaza **dentro de una sección crítica**: un directorio
  `tmp/db.test.sqlite3.lock.reap` creado de forma atómica. Dentro, se vuelve a
  leer el dueño; si cambió, otra ejecución tomó la marca y esta aborta. Así dos
  ejecuciones no pueden reemplazar la misma marca abandonada y creer ambas que
  la tienen. Si el directorio ya existe, se aborta.
- Si la marca desaparece entre el intento de crearla y su lectura, se
  reintenta la adquisición.
- Si el identificador fue reutilizado por otro proceso, se trata como activa y
  se aborta: el error es por exceso de cautela, nunca por borrar de más.
- La marca se libera en el teardown y al salir el proceso, y solo si sigue
  conteniendo el identificador propio.
- **Módulo:** `tests/support/test_database_lock.ts`.

### D8. Comprobación justo antes de borrar

Inmediatamente antes de cada borrado del paso 3 de D5, y por separado para el
archivo principal y cada auxiliar:

- la ruta coincide exactamente con la autorizada (principal o principal más
  sufijo auxiliar) y está en el directorio autorizado;
- la ejecución tiene la exclusividad (D7);
- si no existe, no se hace nada;
- si existe, no es un enlace simbólico, es un archivo regular y su identidad
  física es distinta de la de cada base protegida y sus auxiliares.

Si alguna comprobación falla, se aborta sin borrar ese ni ningún otro archivo
restante.

## Risks / Trade-offs

- [El análisis del orden de arranque es estático] → La regla 2 de D3 lo
  comprueba en cada ejecución; si falla, se reubica la salvaguarda.
- [Ventana entre la comprobación y el borrado] → La exclusividad (D7) impide
  que otra suite actúe en paralelo; la comprobación se repite justo antes de
  cada borrado (D8).
- [Un identificador de proceso reutilizado mantiene viva una marca abandonada]
  → Se aborta con un mensaje que explica cómo comprobar y quitar la marca a
  mano.
- [Una ejecución que muere dentro de la sección crítica deja el directorio
  `.reap`] → **Recuperación manual, no automática.** Las ejecuciones
  siguientes abortan sin tocar ninguna base, con un mensaje que indica
  quitarlo. Procedimiento en `CLAUDE.md`: confirmar que terminaron todas las
  ejecuciones de tests, borrar el directorio vacío con `rmdir` y volver a
  ejecutar. `pgrep` es solo una ayuda: no prueba que no haya procesos (por
  ejemplo, ejecuciones lanzadas de otra forma o desde otro usuario). Si no se
  puede confirmar que terminaron todas, no se borra el `.reap`. Limitación: el directorio no registra dueño, así que el código no
  distingue un reemplazo en curso de uno abandonado y nunca lo borra solo.
- [Carreras entre procesos reales] → `tests/unit/test_database_lock_concurrency.spec.ts`
  lanza procesos reales en un directorio descartable, los sincroniza con una
  barrera de arranque por IPC y puntos de pausa sobre FIFOs (sin esperas
  fijas), y comprueba que solo uno adquiere la marca y que solo uno entra en el
  reemplazo de una marca abandonada. Se comprobó que falla con una variante sin
  sección crítica y con otra de creación no atómica. Los puntos de pausa
  (`hooks`) son una opción de la marca usada solo por los tests.
- [La transacción global no se comparte entre la suite y el servidor HTTP del
  mismo proceso] → Verificarlo con el test de aislamiento; si falla, vaciar
  tablas por test.
- [La huella de `tmp/db.sqlite3` cambia por el servidor de desarrollo] → La
  verificación de integridad se hace con todas sus conexiones detenidas,
  considerando también sus archivos auxiliares de SQLite.

## Evidencia y alcance de la verificación

Lo que se comprobó, y en qué condiciones. No es una garantía universal.

- **Entorno:** Linux, sistema de archivos local, Node 24.8.0, una sola máquina.
- **Base de desarrollo intacta (tarea 4.1):** con el servidor de desarrollo
  detenido y sin procesos con `tmp/db.sqlite3` abierto (comprobado con
  `/proc`, `lsof` y `fuser`), la huella SHA-256, el tamaño, la fecha de
  modificación y el inodo de `tmp/db.sqlite3` fueron idénticos antes y
  después de la suite completa; sus auxiliares de SQLite seguían ausentes.
- **Exclusividad con procesos reales (tarea 4.5):** seis procesos por
  escenario, en un directorio descartable, sincronizados con una barrera de
  arranque por IPC y puntos de pausa sobre FIFOs, sin esperas fijas. Dos
  escenarios coordinados: adquisición simultánea (uno obtiene la marca) y
  reemplazo de una marca abandonada (uno solo entra en la sección crítica).
  Una ronda por escenario: el entrelazado está forzado, no es aleatorio.
- **Mutaciones detectadas:** una variante sin sección crítica (entraron seis
  procesos) y otra con creación no atómica de la marca (seis la obtuvieron)
  hicieron fallar la prueba; con el código actual pasa.
- **Otras verificaciones:** ejecución interrumpida y ejecución simultánea
  simuladas (4.3, 4.4), dos ejecuciones seguidas (4.2), aislamiento por test
  con su propia mutación, y casos peligrosos sobre bases testigo descartables.

**Límites que siguen abiertos:** no se probó con más procesos ni con carga
sostenida; la exclusividad depende de que `mkdir` y `link` sean atómicos, lo
que vale para sistemas de archivos locales de Linux y no se verificó en
sistemas de archivos de red ni en otros sistemas operativos; la recuperación
de un `.reap` abandonado es manual.

## Migration Plan

No hay despliegue: el cambio solo afecta al entorno local de tests. Para
revertirlo basta con deshacer los cambios de código y borrar
`tmp/db.test.sqlite3`, sus auxiliares y la marca de exclusividad; la base de
desarrollo no se toca en ningún caso.
