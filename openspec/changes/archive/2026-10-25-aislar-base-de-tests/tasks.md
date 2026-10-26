# Tasks

> **Orden obligatorio:** no ejecutar `node ace test` en ninguna de sus formas
> hasta completar el grupo 1. Antes de eso, la configuración todavía apunta a
> la base de desarrollo.

## 1. Base exclusiva, salvaguarda y exclusividad (sin ejecutar tests)

- [x] 1.1 Seleccionar `tmp/db.test.sqlite3` en `config/database.ts` cuando `app.inTest` sea verdadero, manteniendo `tmp/db.sqlite3` en los demás entornos; verificar con `npm run typecheck` y revisando que el valor de desarrollo no cambió.
- [x] 1.2 Crear `tests/support/test_database_guard.ts` con la resolución de rutas e identidad, la evaluación sin acceso al sistema de archivos (reglas 1 a 8 de D3) y el borrado acotado de D8; verificar con `npm run typecheck` y `npm run lint`.
- [x] 1.3 Crear `tests/support/test_database_lock.ts` con la exclusividad de D7 (creación exclusiva, marca abandonada, liberación propia); verificar con `npm run typecheck` y `npm run lint`.
- [x] 1.4 Registrar en `runnerHooks.setup` de `tests/bootstrap.ts`, en este orden: salvaguarda, exclusividad, borrado acotado del estado anterior y `testUtils.db().migrate()`; y en `runnerHooks.teardown`, el `migration:reset` y la liberación de la exclusividad; verificar revisando el orden y con `npm run typecheck`.

## 2. Pruebas de la salvaguarda con base testigo

- [x] 2.1 Crear `tests/unit/` con tests de la evaluación que usen descriptores construidos a mano y cubran cada regla de D3; verificar con `node ace test unit`.
- [x] 2.2 Agregar tests unitarios de resolución, salvaguarda completa, borrado acotado y exclusividad sobre un directorio temporal propio con una base testigo, cubriendo los casos de D4; verificar con `node ace test unit` y que la huella del testigo no cambia en ningún caso peligroso.

## 3. Preparación, aislamiento y limpieza

- [x] 3.1 Crear `tests/functional/` con un test que compruebe que la conexión activa usa `tmp/db.test.sqlite3` y pasa la salvaguarda, y un test de ejemplo que inicie sesión con un usuario de prueba y llame a una ruta protegida existente; verificar con `node ace test functional` y que `database/schema.ts` no cambia (`git diff --quiet -- database/schema.ts`).
- [x] 3.2 Agregar el aislamiento por transacción global en los grupos funcionales, con un test que cree un registro y otro que compruebe que ya no existe; verificar con `node ace test functional`.
- [x] 3.3 Documentar en `CLAUDE.md` la base de tests, la salvaguarda, la exclusividad, cómo ejecutar las suites y que la verificación de integridad requiere detener las conexiones a la base de desarrollo; verificar que los comandos documentados coinciden con los usados en 2.1, 3.1 y 3.2.

## 4. Verificación de integridad, exclusividad y repetibilidad

- [x] 4.1 Con el servidor de desarrollo detenido por Pablo, registrar la huella de `tmp/db.sqlite3` y la presencia y huella de sus auxiliares, ejecutar la suite completa y compararlas; verificar que son idénticas.
- [x] 4.2 Ejecutar la suite completa dos veces seguidas; verificar que ambas terminan con el mismo resultado y que `tmp/db.test.sqlite3` se conserva al final.
- [x] 4.3 Simular una ejecución interrumpida dejando datos en la base de tests y una marca de exclusividad abandonada, y ejecutar la suite; verificar que pasa partiendo de un estado conocido.
- [x] 4.4 Simular una ejecución activa con una marca de exclusividad de un proceso vivo y ejecutar la suite; verificar que aborta antes de borrar o migrar y que la base de tests no cambia.
- [x] 4.5 Verificar la exclusividad con procesos reales en un directorio descartable (`tests/unit/test_database_lock_concurrency.spec.ts`): adquisición simultánea y reemplazo de una marca abandonada, sincronizados con barrera IPC y pausas sobre FIFOs; verificar con `node ace test unit --files=test_database_lock_concurrency`, que la prueba falla con una variante sin sección crítica y con otra de creación no atómica, y que no quedan procesos ni archivos.

## Workflow follow-up

- Pedir a Pablo que detenga manualmente el servidor de desarrollo antes de 4.1; no terminar procesos desde la sesión.
- Al terminar, actualizar en `docs/backlog/registro-estado-tecnico-tickets.md` el estado de T-01 y de DT-6, con un enlace a este cambio en lugar de duplicar sus criterios.
- Archivar el cambio solo después de la revisión y de verificar todas las tareas.
