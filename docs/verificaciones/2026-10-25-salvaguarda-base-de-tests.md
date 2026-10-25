# Verificación: salvaguarda de la base de tests (T-01)

> **Fecha:** 2026-10-25 · **Commit verificado:** `6f2827d`
> («test: aislar la base de tests y verificar su exclusividad»).
>
> **Naturaleza de este informe:** registra **observaciones reportadas** de dos
> ejecuciones concretas. Las trazas, los registros, la copia y los scripts de
> análisis **se eliminaron** al terminar, así que estos resultados no se pueden
> inspeccionar de nuevo: solo se pueden reproducir repitiendo el procedimiento.
>
> **Incluye un incidente:** durante la ejecución segura se modificó un archivo
> de caché fuera de la copia (ver [Incidente](#incidente-escritura-en-una-caché-compartida)).

## Objetivo

Resolver dos huecos de verificación del requisito «Salvaguarda antes de tocar
datos» y del requisito «Base de datos exclusiva para tests»
([`openspec/specs/aislamiento-de-tests/spec.md`](../../openspec/specs/aislamiento-de-tests/spec.md)):

1. **Hueco 1:** nunca se había observado, a nivel de suite, que una
   configuración peligrosa aborte antes de cualquier migración, limpieza,
   borrado o test. Solo existían tests de la función y el orden de los hooks
   por construcción.
2. **Hueco 2:** la evidencia previa (huella, tamaño, fecha de modificación e
   inodo) mostraba que la base protegida **no se modificó**, pero no que **no
   se abrió**.

El requisito no cambia por este informe: la base de desarrollo MUST NOT
abrirse durante una ejecución de tests.

## Procedimiento

- **Copia descartable** del backend del commit `6f2827d`, obtenida con
  `git archive` (solo archivos versionados: sin `.env` real, sin bases, sin
  `node_modules`).
- **Configuración sintética:** `.env` generado a partir de `.env.example` con
  una `APP_KEY` creada para la prueba.
- **Dependencias:** `node_modules` de la copia era un **enlace simbólico** al
  `backend/node_modules` del repositorio (ver el incidente).
- **Base testigo:** `tmp/db.sqlite3` de la copia, una base SQLite descartable
  con datos sintéticos (8192 bytes). Es la ruta que la salvaguarda protege
  como base de desarrollo.
- **Traza:** `strace -f -e trace=%file`, que sigue al proceso y a todos sus
  hijos y registra las llamadas con ruta (`open`, `openat`, `openat2`,
  `creat`, familia `stat`, `access`, `readlink`, `unlink`, `rename`, `link`,
  `mkdir`, etc.). `strace` 5.16.

### Diferencias de la copia respecto del commit

Solo en la copia, nunca en el repositorio:

- `tests/bootstrap.ts`: una función `mark()` que escribe una línea en un
  archivo de marcas (si existe la variable `MARKERS_FILE`) y seis llamadas:
  salvaguarda superada, entrada a la exclusividad, a la limpieza, inicio y fin
  de la migración, y entrada al teardown. La salvaguarda en sí no se modificó.
- `tests/unit/zz_marker.spec.ts`: un test adicional que deja una marca desde su
  cuerpo.
- `config/database.ts`: en la **ejecución peligrosa**, el archivo de tests
  apuntaba a `tmp/db.sqlite3` (el testigo); en la **ejecución segura**, se
  restauró el valor del commit (`tmp/db.test.sqlite3`).

## Resultados

### Ejecución peligrosa (tests apuntando al testigo)

- **Código de salida 1** con `UnsafeTestDatabaseError` y dos motivos: el
  archivo no se llama `db.test.sqlite3` y resuelve a la base protegida.
- **Ninguna marca alcanzada:** no se superó la salvaguarda, ni se entró a la
  exclusividad, la limpieza, la migración o el teardown, ni se ejecutó el
  cuerpo de ningún test. El archivo de marcas no llegó a crearse.
- **Testigo:** solo consultas de metadatos (6 `statx` sobre el archivo y 2
  sobre cada auxiliar `-journal`, `-wal`, `-shm`), **ninguna apertura de
  contenido** y ninguna modificación. Sin menciones por ruta relativa.
- **Base de tests y marca de exclusividad:** ninguna llamada.
- Huella, tamaño, fecha de modificación e inodo del testigo idénticos; ningún
  archivo nuevo ni borrado en la copia.
- **No se observaron escrituras** fuera de la copia ni en las dependencias
  compartidas.

### Ejecución segura (configuración del commit)

- **Código de salida 0** con **59 tests aprobados**: los 58 de la suite más el
  test adicional de marca.
- **Marcas, en orden:** salvaguarda superada → exclusividad → limpieza →
  inicio de migración → fin de migración → cuerpo de test → teardown.
- **Testigo:** solo consultas de metadatos (30 `statx` sobre el archivo y 20
  sobre cada auxiliar), **ninguna apertura de contenido** y ninguna
  modificación. Huella, tamaño, fecha de modificación e inodo idénticos.
- **Base de tests de la copia:** una apertura de contenido y consultas de
  metadatos; se conserva al terminar.
- **Marca de exclusividad y temporales** de la suite: en el `tmp/` de la copia.
- **Escrituras fuera de la copia, por categoría:**
  - el archivo de marcas de la instrumentación;
  - los directorios temporales propios de los tests unitarios
    (`/tmp/flowsync-test-db-*`, `/tmp/flowsync-lock-race-*`), incluidas 92
    operaciones relativas a un descriptor de directorio, todas resueltas
    dentro de esos directorios;
  - **la caché de Japa en el `node_modules` del repositorio** (ver el
    incidente). **No es cierto que todas las escrituras quedaran en la copia o
    en `/tmp`.**

### Qué demuestran

- **Hueco 1, para esta configuración peligrosa:** la suite real abortó en la
  salvaguarda antes de exclusividad, limpieza, migración y cualquier test.
- **Hueco 2, para estas dos ejecuciones:** la base protegida recibió solo
  consultas de metadatos, que no contradicen «no abrir la base», y ninguna
  apertura de contenido. Sin una apertura no existe un descriptor sobre el
  archivo, así que no hubo lecturas ni escrituras por esa vía.

## Alcance y límites

- **Dos ejecuciones concretas**, en Linux con sistema de archivos local. No
  certifican ejecuciones futuras ni otros entornos.
- **Una sola variante peligrosa a nivel de suite:** la ruta igual a la base
  protegida. Las demás (enlace simbólico, mismo inodo, directorio enlazado,
  entorno distinto, conexión abierta) siguen cubiertas solo por los tests
  unitarios de la salvaguarda.
- **La traza registra llamadas con ruta.** No se trazaron mecanismos sin ruta
  ajenos a una apertura (por ejemplo, un descriptor heredado), que no tienen
  un origen plausible en estas ejecuciones.
- **La copia estaba instrumentada.** Las marcas agregan escrituras propias y un
  test adicional; no alteran la salvaguarda.
- **Sin artefactos:** trazas, registros, copia y scripts se eliminaron. Los
  números de este informe son observaciones reportadas.
- **La comprobación de «conexión ya abierta» cubre la conexión primaria de
  Lucid.** No detecta cualquier acceso futuro a una base por otras vías (otra
  conexión, un uso directo del driver de SQLite u otro código que se agregue).
  Hoy no hay ninguno según la inspección del código; es un límite de la
  salvaguarda, no un defecto actual demostrado.
- **Procesos externos que alteren archivos entre la comprobación y el uso**
  (por ejemplo, reemplazar la base de tests por un enlace entre la salvaguarda
  y la migración) quedan **fuera del alcance verificado**. La marca de
  exclusividad solo coordina ejecuciones de tests entre sí. No es un defecto
  actual demostrado: no se probó ni se observó.

## Incidente: escritura en una caché compartida

- **Qué pasó:** en la ejecución segura, Japa reescribió su caché de tests
  fallidos **en el repositorio real**, a través del enlace simbólico de la
  copia:
  `backend/node_modules/.cache/@japa/runner/summary.json`
  (traza: un `mkdir` del directorio que falló con `EEXIST` y un `openat` con
  `O_WRONLY|O_CREAT|O_TRUNC`). Fecha de modificación posterior:
  2026-10-25 17:15:55 −03:00. Contenido posterior: `{"tests":[]}`. La
  ejecución peligrosa no escribió ahí.
- **Contenido anterior: desconocido.** No se guardó una copia antes de la
  prueba. Que sea probable que ya contuviera lo mismo no lo demuestra.
- **No se intentó restaurarlo:** restaurar un contenido desconocido no es
  posible sin inventarlo.
- **Impacto:** el archivo está ignorado por Git y solo lo usa
  `node ace test --failed`. Que `HEAD` y `git status` del repositorio no
  cambiaran **no equivale a un entorno intacto**: los archivos ignorados por
  Git, como esta caché, no aparecen en esas comprobaciones.
- **Por qué no se detectó en el momento:** el análisis de la traza buscaba
  escrituras con la ruta real de `node_modules`; la escritura usó la ruta del
  enlace dentro de la copia y se contó como «dentro de la copia». Se descubrió
  al comparar fechas de modificación de `node_modules`.

## Recomendación para futuras pruebas

Una dependencia compartida mediante un enlace simbólico **no es de solo
lectura**: las herramientas pueden escribir cachés dentro de ella. Antes de
repetir una prueba así, hace falta una de estas dos cosas:

- **aislamiento efectivo:** dependencias propias de la copia, o un montaje de
  solo lectura; o
- **redirigir las escrituras conocidas** (por ejemplo, la caché de Japa) a la
  copia, **y verificar todos los destinos de escritura** de la traza
  resolviendo enlaces simbólicos y descriptores, no solo por prefijo de ruta.

Conviene además guardar, antes de la prueba, el estado de lo que se comparte
(por ejemplo, una huella de los archivos de caché), para poder comparar
después.
