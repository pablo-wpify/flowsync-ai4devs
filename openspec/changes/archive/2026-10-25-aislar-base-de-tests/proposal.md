# Proposal

> Cambio asociado al ticket **T-01** y a la decisión técnica **DT-6** de
> [`docs/backlog/registro-estado-tecnico-tickets.md`](../../../../docs/backlog/registro-estado-tecnico-tickets.md).
> **Estado:** propuesta en revisión. DT-6 sigue como *propuesta* y T-01 como
> *pendiente* hasta que se apruebe el diseño. No hay implementación.

## Why

Hoy el backend usa un único archivo SQLite (`tmp/db.sqlite3`) para todos los
entornos, de modo que cualquier test funcional escribiría sobre los datos de
desarrollo. Sin una base exclusiva para tests no se pueden verificar con
seguridad los tickets de backend del registro de estado técnico (T-02 a T-06).

## What Changes

- Los tests del backend usan una **base de datos exclusiva**, distinta de la de
  desarrollo.
- Antes de migrar, limpiar o ejecutar cualquier test, una **salvaguarda**
  comprueba la configuración y **aborta** si la base de tests coincide con la
  de desarrollo (también a través de enlaces o del mismo archivo físico) o si
  el entorno no es el de tests.
- Cada ejecución parte de un estado conocido y **se puede repetir**; cada test
  queda aislado de los demás.
- Solo **una ejecución a la vez** puede preparar o usar la base de tests; una
  segunda ejecución simultánea se detiene sin borrar nada.
- Se crean las carpetas de tests y un test funcional de ejemplo sobre una ruta
  protegida existente.
- Se documenta en `CLAUDE.md` cómo se ejecutan los tests y qué base usan.

No cambia ningún comportamiento visible para quienes usan la aplicación.

## Capabilities

### New Capabilities

- `aislamiento-de-tests`: garantiza que la ejecución de los tests del backend
  use una base exclusiva, detecte configuraciones peligrosas antes de tocar
  datos, no altere la base de desarrollo y sea repetible.

### Modified Capabilities

Ninguna: el proyecto todavía no tiene especificaciones en `openspec/specs/`.

## Impact

- **Código del backend:** la configuración de la base de datos y el arranque
  de los tests (`tests/bootstrap.ts`); carpetas nuevas `tests/unit/` y
  `tests/functional/`.
- **Archivos locales:** un archivo SQLite nuevo para tests dentro de `tmp/`,
  que Git ya ignora.
- **Dependencias:** ninguna nueva; no cambian `package.json` ni los lockfiles.
- **Documentación:** `CLAUDE.md` (cómo ejecutar tests) y, al cerrar el cambio,
  el estado de T-01 y DT-6 en el archivo de tickets.
- **Fuera de alcance:** tests de las funcionalidades del registro de estado
  técnico, el modelo de datos y los contratos de la API (DT-1, DT-2, DT-4,
  DT-5, DT-10), y cualquier cambio en el frontend.
