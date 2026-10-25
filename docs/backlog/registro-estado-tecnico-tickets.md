# Tickets — Registro de afirmaciones técnicas con evidencia

> Derivados de las historias
> [`registro-estado-tecnico-historias.md`](registro-estado-tecnico-historias.md)
> y del PRD
> [`docs/prd/registro-estado-tecnico-mvp.md`](../prd/registro-estado-tecnico-mvp.md)
> (borrador 0.5). Ejercicio de la clase 2 de AI4Devs. **No se cargan en Jira.**
>
> Los criterios de las historias se citan como `H<historia>-C<número>`.

## 0. Estado del trabajo

Tres cosas distintas, que no hay que confundir:

- **Backlog documentado y revisado.** El PRD, las historias y estos tickets
  están escritos y se revisaron en conversación con Pablo, con comprobaciones
  automáticas de consistencia (criterios citados existentes, RF coherentes,
  cobertura completa, enlaces). **No pasaron una revisión adversarial.**
- **Decisiones técnicas pendientes.** Las de la sección 2 marcadas como
  abiertas o propuestas. Mientras sigan así, los tickets que bloquean **no
  están listos para implementar**. **T-01 está terminado** (ver su ficha);
  de los demás, hoy ninguno está listo.
- **Funcionalidades no implementadas.** Ninguna de las funcionalidades de este
  backlog existe todavía en FlowSync: no hay migraciones, modelos, rutas,
  pantallas ni tests de partes, afirmaciones, evidencias o pendientes. T-01 es
  infraestructura de tests, no una funcionalidad del producto.

La Definition of Done (sección 7) describe **cómo se cerrarán** los tickets.
Ninguna de sus verificaciones se ejecutó.

## 1. Decisiones de producto cerradas para el ejercicio

Son decisiones del ejercicio, no necesidades validadas en el caso real.

- **P-1. Navegación.** Tras el login se conserva `/profile` como destino. Un
  enlace «Estado técnico» lleva a la lista de partes (RF12).
- **P-2. Fecha de comprobación.** Fecha de calendario sin hora. Se rechazan
  fechas posteriores al día actual del usuario. Cómo se determina ese día se
  decide en el contrato técnico (DT-9).
- **P-3. Longitudes máximas**, validadas después de quitar espacios exteriores:
  nombre de parte 120; descripción de parte 1.000; descripción de afirmación,
  descripción de pendiente y cada texto de evidencia 2.000.

## 2. Decisiones técnicas

Convenciones del proyecto que se respetan en todas las decisiones (verificadas
en el código actual):

- Columnas definidas por migraciones; `node ace migration:run` regenera
  `database/schema.ts`; los modelos extienden la clase generada.
- Rutas en `start/routes.ts` bajo `/api/v1`, protegidas con
  `middleware.auth()`; controllers referenciados vía `#generated/controllers`.
- Respuestas envueltas en `{ data }` mediante `serialize()`, con campos
  elegidos por transformers.
- Validación con VineJS en `app/validators/`. Los errores de validación ya
  llegan como `422` con `errors: [{ message, rule, field, meta? }]`.
- Frontend: `src/lib/api.ts` es el único punto de contacto con la API;
  `src/lib/errors.ts` traduce errores a texto.

### Cerradas

- **DT-3. Propiedad de los datos.** Se resuelve siguiendo las relaciones del
  usuario autenticado: toda búsqueda de una parte, afirmación, evidencia o
  pendiente parte del usuario y recorre sus relaciones. **No se agrega una
  librería de permisos.**
- **DT-7. Verificación funcional del frontend.** Por ahora se hace en el
  navegador, siguiendo los criterios del ticket. Incorporar un runner de tests
  en el frontend sería una decisión técnica futura, no un cambio de producto.
- **DT-8. Cliente de la API.** Se mantiene el cliente `fetch` manual de
  `src/lib/api.ts`. **No se usa Tuyau.**
- **DT-6. Base exclusiva para tests.** **Resuelta para el alcance de T-01**
  (opción A): `config/database.ts` usa `tmp/db.test.sqlite3` cuando el entorno
  es de tests, y `tests/bootstrap.ts` verifica la configuración antes de
  abrir, borrar o migrar cualquier base, toma una marca de ejecución exclusiva
  y migra sin regenerar `database/schema.ts`. Requisitos vigentes:
  [`openspec/specs/aislamiento-de-tests/spec.md`](../../openspec/specs/aislamiento-de-tests/spec.md).
  Diseño, tareas y evidencia:
  [cambio archivado `2026-10-25-aislar-base-de-tests`](../../openspec/changes/archive/2026-10-25-aislar-base-de-tests/design.md).
  La evidencia vale para Linux con sistema de archivos local; la recuperación
  de un `.lock.reap` abandonado es manual.

### Abiertas o propuestas

Cada una indica qué tickets bloquea directamente y cuándo debe resolverse.

- **DT-1. Modelo de datos.** Entidades, columnas y relaciones de partes,
  afirmaciones, evidencias y pendientes, con la cadena de propiedad usuario →
  parte → afirmación → evidencias y pendientes (DT-3).
  - Estado: abierta. No se fijan nombres de tablas ni columnas en este
    documento.
  - Bloquea: T-02, T-03, T-04, T-05a y T-05b.
  - Resolver: al diseñar el contrato (DT-2), antes de iniciar T-02.
- **DT-2. Contrato HTTP de cada operación.** Rutas, métodos (incluido el método
  de corrección), forma de las peticiones y respuestas, nombres de campos en
  JSON y reglas de validación con su `rule` para los mensajes por campo
  (obligatorio, máximo, fecha futura).
  - Estado: abierta.
  - Bloquea: T-02, T-03, T-04, T-05a, T-05b, T-06, T-07, T-08, T-09a, T-09b,
    T-10a y T-10b.
  - Resolver: en un paso de diseño previo a T-02, para todas las operaciones a
    la vez, documentando el resultado en este archivo.
- **DT-4. Respuesta idéntica para datos ajenos e inexistentes.**
  - Estado: **propuesta**, pendiente de aceptación.
  - Propuesta:
    - Toda operación que identifica una parte, afirmación, evidencia o
      pendiente que no existe **o** no pertenece al usuario autenticado
      responde `404` con exactamente este cuerpo:
      `{ "errors": [{ "message": "Resource not found" }] }`.
    - El cuerpo es idéntico en ambos casos y para todo tipo de recurso: no
      incluye identificadores, nombre de modelo, tipo de recurso ni traza.
    - La existencia y la propiedad se comprueban **antes** de validar el cuerpo
      de la petición, para que un cuerpo inválido sobre un recurso ajeno no
      responda distinto que sobre uno inexistente.
    - La propiedad se resuelve buscando desde el usuario autenticado (DT-3), de
      modo que un recurso ajeno resulta, para el código, igual que uno
      inexistente.
    - La respuesta se genera en un único punto, para garantizar que el cuerpo
      sea siempre el mismo. Hoy Lucid lanza `E_ROW_NOT_FOUND` (404, «Row not
      found») y guarda el modelo en el error; **no se verificó** qué cuerpo
      produce el manejador de excepciones en desarrollo, así que T-02 debe
      comprobar que no exponga el modelo ni una traza.
    - El frontend muestra un único mensaje para ese `404`, por ejemplo «No
      encontramos el elemento solicitado». El texto final se acuerda en T-07.
  - Bloquea: T-02, T-03, T-04, T-05a, T-05b, T-06, T-07, T-08, T-09a, T-09b,
    T-10a y T-10b.
  - Resolver: aceptar o ajustar antes de iniciar T-02.
- **DT-5. Forma de la consulta de una parte.**
  - Estado: **propuesta**: una sola respuesta con la parte, sus afirmaciones y,
    en cada afirmación, su implementación declarada, sus evidencias completas y
    sus pendientes con su estado. Una parte sin afirmaciones devuelve la lista
    vacía. La respuesta no incluye ningún campo de evaluación.
  - Bloquea: T-06 y T-08.
  - Resolver: junto con DT-2, antes de iniciar T-02.
- **DT-9. Día actual del usuario para validar la fecha de comprobación.**
  - Estado: abierta. Propuesta para discutir: el frontend envía la zona horaria
    del navegador y el backend calcula «hoy» en esa zona; la fecha viaja como
    `AAAA-MM-DD`. Alternativa: el frontend envía su fecha local actual.
  - Bloquea: T-05b y T-10b.
  - Resolver: antes de iniciar T-05b.
- **DT-10. Normalización de textos.**
  - Estado: **propuesta**: se valida y se guarda el valor sin espacios
    exteriores.
  - Bloquea: T-02, T-03, T-04 y T-05a.
  - Resolver: junto con DT-2, antes de iniciar T-02.

## 3. Prioridad, tamaño y orden

### Prioridad

La prioridad indica **qué aporta valor primero**; las dependencias indican
**qué tiene que existir antes**. Son independientes: un ticket P1 puede quedar
bloqueado, y uno P2 puede no tener bloqueos.

- **P1 — Recorrido mínimo.** Lo imprescindible para completar el recorrido
  principal del PRD (sección 6): entrar desde el perfil, crear una parte,
  registrar afirmaciones, agregar y corregir una evidencia, abrir un pendiente
  y consultar la parte. Incluye siempre las validaciones obligatorias, los
  máximos de texto y la privacidad (RF11), que no se postergan.
- **P2 — Completa las tres funcionalidades.** Lo que el recorrido no usa pero
  el PRD exige: corregir partes y afirmaciones, cerrar y reabrir pendientes, y
  la fecha de comprobación. **Ningún requisito se elimina:** P2 se hace
  después, no se descarta.

Cómo se relacionan P1, P2 y el cierre de tickets:

- **P1 es un hito parcial**: permite completar el recorrido principal, pero no
  es el MVP.
- **El MVP completo incluye P1 y P2.**
- Varios tickets mezclan alcance P1 y P2. Como el alcance P2 es pequeño, se
  mantiene dentro del ticket y se marca. Se puede trabajar primero su parte P1
  para alcanzar el hito, pero **un ticket con criterios de ambas prioridades
  solo se cierra cuando cumple todos sus criterios**: completar su parte P1 no
  lo da por terminado.

### Tamaño

Tamaños orientativos y relativos entre sí, sin horas:

- **Pequeño (S):** sigue un patrón ya establecido por otro ticket, con pocas
  reglas.
- **Mediano (M):** introduce un patrón nuevo o combina varias reglas y estados.
- **Grande (L):** varias entidades o pantallas a la vez, o mucha
  incertidumbre. **Ningún ticket quedó en L:** los que lo eran se dividieron
  (T-05, T-09 y T-10).

### Orden de ejecución propuesto

Respeta dependencias y pone P1 antes que P2:

1. Paso de diseño (no es un ticket): resolver DT-1, DT-2, DT-4, DT-5 y DT-10.
2. **T-01** — terminado (DT-6 resuelta).
3. **T-02**.
4. **T-03** y, en paralelo, **T-07**.
5. **T-04** y **T-05a**.
6. **T-06**.
7. **T-08**.
8. **T-09a**, **T-09b** y **T-10a**. Con esto el recorrido mínimo está
   completo.
9. P2 sin alcance P1: **T-05b** (tras resolver DT-9) y después **T-10b**.

## 4. Tickets

### T-01 — Base exclusiva y tests funcionales del backend

- **Objetivo:** poder verificar automáticamente los criterios de las historias
  sin alterar la base de desarrollo.
- **Alcance:**
  - configurar una base SQLite exclusiva para el entorno de tests (DT-6);
  - aplicar las migraciones a esa base antes de ejecutar los tests;
  - crear `tests/functional/` y un test de ejemplo que inicie sesión con un
    usuario de prueba y llame a una ruta protegida existente;
  - una salvaguarda que impida ejecutar los tests si la conexión apunta al
    archivo de la base de desarrollo;
  - documentar en `CLAUDE.md` cómo se ejecutan los tests y qué base usan.
- **Exclusiones:** tests de las funcionalidades nuevas; tests unitarios;
  rollback o truncate sobre la base de desarrollo como mecanismo de
  aislamiento.
- **Dependencias:** DT-6 (resuelta).
- **Estado:** **terminado.** Implementado y verificado mediante el cambio de
  OpenSpec
  [`2026-10-25-aislar-base-de-tests`](../../openspec/changes/archive/2026-10-25-aislar-base-de-tests/proposal.md)
  (propuesta, diseño, tareas y evidencia), con sus requisitos vigentes en
  [`openspec/specs/aislamiento-de-tests/spec.md`](../../openspec/specs/aislamiento-de-tests/spec.md).
  Los criterios verificables de esta ficha se cumplieron (tareas 3.1, 4.1 y la
  salvaguarda de las tareas 1.2–2.2 del cambio). **Diferencia con el alcance
  original:** se agregaron tests unitarios, pero solo de la propia
  infraestructura de tests (salvaguarda, borrado acotado y marca de
  exclusividad), no de funcionalidades. **Límites:** la evidencia vale para
  Linux con sistema de archivos local; la recuperación de un `.lock.reap`
  abandonado es manual (procedimiento en `CLAUDE.md`).
- **Prioridad:** P1 (sin T-01 no se pueden verificar los tickets de backend).
- **Tamaño:** M.
  - Supuesto: alcanza con elegir otro archivo SQLite según el entorno.
  - Incertidumbre: `migration:run` regenera `database/schema.ts`; hay que
    comprobar que migrar la base de tests no reescriba ese archivo de forma
    inesperada. También, cómo integrar la migración en el arranque de Japa.
- **Criterios verificables:**
  - `node ace test functional` ejecuta al menos un test y pasa;
  - la huella (`sha256sum`) de `tmp/db.sqlite3` es idéntica antes y después de
    ejecutar la suite completa;
  - si la configuración de test apunta a `tmp/db.sqlite3`, la suite se detiene
    con un error explícito antes de ejecutar tests.
- **Referencias:** soporte de H1, H2 y H3; no cubre RF directamente.

### T-02 — Backend: partes del sistema

- **Objetivo:** crear, corregir y listar partes privadas del usuario.
- **Alcance:**
  - migración y modelo de la parte, vinculada al usuario (DT-1, DT-3);
  - validación: nombre obligatorio de hasta 120 caracteres, descripción
    opcional de hasta 1.000, tras quitar espacios exteriores (DT-10);
  - operaciones de crear, corregir y listar las partes propias (DT-2);
  - respuesta de DT-4 para partes ajenas o inexistentes, y verificación de que
    el cuerpo no expone modelo ni traza.
- **Exclusiones:** eliminar partes; consultar una parte con su contenido
  (T-06); frontend.
- **Dependencias:** T-01, DT-1, DT-2, DT-4, DT-10.
- **Estado:** bloqueado por DT-1, DT-2, DT-4 y DT-10 (la dependencia T-01 ya
  está cumplida).
- **Prioridad:** P1 (crear, listar, validaciones, privacidad). Alcance P2:
  corregir una parte.
- **Tamaño:** M.
  - Supuesto: es el primer recurso nuevo y fija el patrón (migración,
    validador, transformer, rutas, respuesta de DT-4) que repiten T-03 a T-05b.
  - Incertidumbre: el cuerpo real del 404 en desarrollo y cómo normalizarlo en
    un único punto.
- **Criterios verificables (tests funcionales):**
  - crear con nombre válido responde éxito y la parte aparece en la lista;
  - nombre vacío o solo espacios, nombre de 121 caracteres y descripción de
    1.001 se rechazan con error asociado al campo; un nombre de 120 caracteres
    con espacios exteriores se acepta;
  - una corrección válida se refleja en la lista;
  - una corrección inválida se rechaza y la lista conserva los datos
    anteriores;
  - el usuario B no ve en su lista las partes del usuario A;
  - corregir una parte ajena y una inexistente devuelve el mismo estado y el
    mismo cuerpo, byte a byte, y la parte ajena no cambia.
- **Referencias:** H1-C2, H1-C3, H1-C4, H1-C5, H1-C6, H1-C15, H3-C7.
  RF1, RF2, RF11.

### T-03 — Backend: afirmaciones

- **Objetivo:** registrar y corregir afirmaciones dentro de una parte propia.
- **Alcance:**
  - migración y modelo de la afirmación, vinculada a la parte (DT-1);
  - descripción obligatoria de hasta 2.000 caracteres (DT-10);
  - implementación declarada como dato de sí o no;
  - operaciones de registrar y corregir (DT-2);
  - respuesta de DT-4 para partes o afirmaciones ajenas o inexistentes.
- **Exclusiones:** evidencias, pendientes y consulta; eliminación; frontend.
- **Dependencias:** T-02, DT-1, DT-2, DT-4, DT-10.
- **Estado:** bloqueado por T-02, DT-1, DT-2, DT-4 y DT-10.
- **Prioridad:** P1 (registrar, validaciones, privacidad). Alcance P2:
  corregir una afirmación.
- **Tamaño:** S. Supuesto: reutiliza el patrón de T-02. Incertidumbre baja.
- **Criterios verificables:**
  - una afirmación con declaración queda registrada como declarada, y una sin
    declaración, como no declarada;
  - descripción vacía, solo espacios o de 2.001 caracteres se rechaza;
  - una corrección válida se refleja;
  - una corrección inválida se rechaza y se conservan la descripción y la
    declaración anteriores;
  - registrar en una parte ajena o inexistente, o corregir una afirmación
    ajena o inexistente, devuelve la respuesta de DT-4 sin crear ni modificar
    nada.
- **Referencias:** H1-C7, H1-C8, H1-C9, H1-C10, H1-C11, H1-C15.
  RF3, RF4, RF11.

### T-04 — Backend: pendientes

- **Objetivo:** abrir, cerrar y reabrir pendientes de una afirmación propia.
- **Alcance:**
  - migración y modelo del pendiente, vinculado a la afirmación (DT-1);
  - descripción obligatoria de hasta 2.000 caracteres (DT-10);
  - estado abierto o cerrado; operaciones de abrir, cerrar y reabrir (DT-2);
  - respuesta de DT-4 para datos ajenos o inexistentes.
- **Exclusiones:** pendientes asociados a la parte; corrección del texto de un
  pendiente (no está en el PRD); eliminación; frontend.
- **Dependencias:** T-03, DT-1, DT-2, DT-4, DT-10.
- **Estado:** bloqueado por T-03, DT-1, DT-2, DT-4 y DT-10.
- **Prioridad:** P1 (abrir, validaciones, privacidad). Alcance P2: cerrar y
  reabrir.
- **Tamaño:** S. Supuesto: reutiliza el patrón de T-02 con un estado de dos
  valores. Incertidumbre baja.
- **Criterios verificables:**
  - un pendiente nuevo queda abierto; al cerrarlo queda cerrado; al reabrirlo,
    abierto;
  - descripción vacía, solo espacios o de 2.001 caracteres se rechaza sin
    crear el pendiente;
  - abrir un pendiente en una afirmación ajena o inexistente, o cerrar uno
    ajeno o inexistente, devuelve la respuesta de DT-4 sin cambios.
- **Referencias:** H1-C12, H1-C13, H1-C14, H1-C15. RF5, RF6, RF11.

### T-05a — Backend: evidencias (textos y corrección)

- **Objetivo:** agregar y corregir evidencias de una afirmación propia, sin la
  fecha de comprobación.
- **Alcance:**
  - migración y modelo de la evidencia, vinculada a la afirmación (DT-1), con
    lugar para la fecha de comprobación opcional aunque su validación se
    complete en T-05b;
  - qué se comprobó, referencia y contexto obligatorios, de hasta 2.000
    caracteres cada uno (DT-10);
  - fecha de registro automática, que no cambia al corregir;
  - operaciones de agregar y corregir (DT-2);
  - respuesta de DT-4 para datos ajenos o inexistentes.
- **Exclusiones:** aceptar o validar la fecha de comprobación (T-05b); evaluar
  suficiencia o vigencia; eliminación; frontend.
- **Dependencias:** T-03, DT-1, DT-2, DT-4, DT-10.
- **Estado:** bloqueado por T-03, DT-1, DT-2, DT-4 y DT-10.
- **Prioridad:** P1 (el recorrido agrega y corrige una evidencia).
- **Tamaño:** M. Supuesto: tres textos con las mismas reglas. Incertidumbre:
  si conviene definir la columna de fecha aquí o en T-05b (se resuelve en
  DT-1).
- **Criterios verificables:**
  - una evidencia completa se guarda con fecha de registro y sin fecha de
    comprobación;
  - si falta cualquiera de los tres textos, tiene solo espacios o supera 2.000
    caracteres, se rechaza con error asociado a ese campo y no se guarda nada;
  - una corrección válida conserva la fecha de registro;
  - una corrección inválida se rechaza y se conservan todos los datos
    anteriores de la evidencia;
  - agregar a una afirmación ajena o inexistente, o corregir una evidencia
    ajena o inexistente, devuelve la respuesta de DT-4 sin cambios.
- **Referencias:** H2-C1, H2-C4, H2-C5, H2-C6, H2-C7, H2-C8, H2-C9.
  RF7, RF8, RF11.

### T-05b — Backend: fecha de comprobación

- **Objetivo:** aceptar y validar la fecha de comprobación opcional de una
  evidencia.
- **Alcance:**
  - fecha de calendario sin hora, opcional, al agregar y al corregir;
  - rechazo de fechas posteriores al día actual del usuario, según DT-9.
- **Exclusiones:** fecha y hora; zonas horarias más allá de lo que defina
  DT-9; frontend.
- **Dependencias:** T-05a, DT-1, DT-2, DT-4, DT-9.
- **Estado:** bloqueado por T-05a, DT-1, DT-2, DT-4 y DT-9.
- **Prioridad:** P2.
- **Tamaño:** S. Incertidumbre alta por DT-9: si se elige calcular «hoy» con
  la zona horaria del usuario, puede crecer a M.
- **Criterios verificables:**
  - una fecha igual al día actual del usuario se acepta y se devuelve sin hora;
  - una fecha posterior se rechaza con error asociado al campo, sin guardar
    nada;
  - una corrección con fecha posterior se rechaza y se conservan los datos
    anteriores.
- **Referencias:** H2-C2, H2-C3, H2-C8. RF7, RF8.

### T-06 — Backend: consulta de una parte

- **Objetivo:** obtener en una sola respuesta las afirmaciones de una parte
  con sus tres dimensiones.
- **Alcance:**
  - operación de consulta de una parte propia según DT-5;
  - en cada afirmación: implementación declarada, evidencias con todos sus
    campos y su cantidad, y pendientes con su estado;
  - lista vacía si la parte no tiene afirmaciones;
  - respuesta de DT-4 para partes ajenas o inexistentes.
- **Exclusiones:** cualquier cálculo de «probada», suficiencia o
  recomendación; textos de interfaz como la aclaración fija.
- **Dependencias:** T-03, T-04, T-05a, DT-2, DT-4, DT-5.
- **Estado:** bloqueado por T-03, T-04, T-05a, DT-2, DT-4 y DT-5.
- **Prioridad:** P1.
- **Tamaño:** M. Supuesto: una sola consulta con relaciones anidadas.
  Incertidumbre: la forma final de DT-5. La fecha de comprobación se incluye
  en cuanto exista T-05b; hasta entonces se devuelve vacía.
- **Criterios verificables:**
  - una afirmación sin declaración, con una evidencia y un pendiente abierto,
    devuelve las tres dimensiones a la vez;
  - pendientes abiertos y cerrados se devuelven con su estado;
  - una parte sin afirmaciones devuelve la lista vacía;
  - la respuesta no incluye campos de evaluación;
  - consultar una parte ajena o inexistente devuelve la respuesta de DT-4.
- **Referencias:** H3-C1, H3-C2, H3-C3, H3-C8. RF9, RF11. Aporta además la
  lista vacía que necesita H3-C4; la aclaración fija de ese criterio (RF10) se
  cubre en T-08.

### T-07 — Frontend: acceso, lista y edición de partes

- **Objetivo:** que el usuario llegue a sus partes desde el perfil, las vea, las
  cree y las corrija.
- **Alcance:**
  - enlace «Estado técnico» en el perfil; el login sigue llevando a
    `/profile`;
  - ruta protegida para la lista de partes;
  - formularios de crear y corregir parte, con mensajes por campo en
    castellano (obligatorio y máximo);
  - mensaje único para el `404` de DT-4, con su texto final acordado aquí;
  - funciones nuevas en `src/lib/api.ts` y traducciones en `src/lib/errors.ts`.
- **Exclusiones:** la vista de consulta (T-08); eliminación.
- **Dependencias:** T-02, DT-2, DT-4.
- **Estado:** bloqueado por T-02, DT-2 y DT-4.
- **Prioridad:** P1 (acceso, lista, crear, privacidad). Alcance P2: corregir
  una parte.
- **Tamaño:** M. Supuesto: sigue los patrones de formularios y errores del
  login. Incertidumbre: si hacen falta componentes nuevos de shadcn/ui.
- **Criterios verificables (en el navegador, DT-7):**
  - tras el login se muestra el perfil, y el enlace «Estado técnico» abre la
    lista;
  - crear una parte la muestra en la lista;
  - nombre vacío o de más de 120 caracteres muestra el error en el campo;
  - una corrección válida se ve en la lista; una inválida muestra el error y la
    lista conserva los datos anteriores;
  - con dos usuarios, ninguno ve las partes del otro;
  - corregir una parte ajena (por ejemplo, alterando el identificador en la
    dirección) muestra el mismo mensaje que una inexistente;
  - `npm run build`, `npm run lint` y `npx prettier --check .` pasan.
- **Referencias:** H1-C1, H1-C2, H1-C3, H1-C4, H1-C5, H1-C6, H1-C15, H3-C7.
  RF1, RF2, RF11, RF12.

### T-08 — Frontend: vista de consulta de una parte

- **Objetivo:** mostrar las tres dimensiones de cada afirmación sin categorías
  excluyentes.
- **Alcance:**
  - vista de una parte con, por afirmación: implementación declarada; «con
    evidencia registrada (N)» o «sin evidencia registrada»; evidencias con
    fecha de registro y fecha de comprobación sin hora, o «fecha de comprobación
    no informada»; pendientes abiertos y cerrados diferenciados;
  - estado vacío y aclaración fija;
  - mensaje único de DT-4 para partes ajenas o inexistentes.
- **Exclusiones:** formularios de afirmaciones, pendientes y evidencias
  (T-09a, T-09b, T-10a, T-10b); el término «probada» y cualquier
  recomendación.
- **Dependencias:** T-06, T-07, DT-2, DT-4, DT-5.
- **Estado:** bloqueado por T-06, T-07, DT-2, DT-4 y DT-5.
- **Prioridad:** P1.
- **Tamaño:** M. Supuesto: solo lectura. Incertidumbre: legibilidad cuando hay
  muchas evidencias o pendientes por afirmación.
- **Criterios verificables (en el navegador):**
  - con los datos ficticios del recorrido del PRD, la vista coincide con su
    paso 7;
  - una afirmación sin declaración, con evidencia y pendiente, muestra las tres
    dimensiones a la vez;
  - la aclaración fija aparece también en una parte vacía;
  - la dirección de una parte ajena muestra el mismo mensaje que la de una
    inexistente;
  - el texto «probada» no aparece;
  - build, lint y formato pasan.
- **Referencias:** H3-C1, H3-C2, H3-C3, H3-C4, H3-C5, H3-C6, H3-C8.
  RF9, RF10, RF11.

### T-09a — Frontend: afirmaciones

- **Objetivo:** registrar y corregir afirmaciones desde la vista de la parte.
- **Alcance:**
  - formularios de registrar y corregir afirmación (descripción y declaración
    de implementación);
  - mensajes por campo (obligatorio y máximo) y mensaje único de DT-4.
- **Exclusiones:** pendientes (T-09b); evidencias (T-10a, T-10b); eliminación.
- **Dependencias:** T-03, T-08, DT-2, DT-4.
- **Estado:** bloqueado por T-03, T-08, DT-2 y DT-4.
- **Prioridad:** P1 (registrar). Alcance P2: corregir una afirmación.
- **Tamaño:** S. Incertidumbre: puede requerir un componente nuevo de
  shadcn/ui para la declaración de implementación.
- **Criterios verificables (en el navegador):**
  - una afirmación registrada sin declaración se muestra como «sin
    implementación declarada»;
  - descripción vacía o de más de 2.000 caracteres muestra el error;
  - una corrección válida se ve en la vista; una inválida muestra el error y la
    vista conserva la descripción y la declaración anteriores;
  - operar sobre una afirmación ajena muestra el mismo mensaje que sobre una
    inexistente;
  - build, lint y formato pasan.
- **Referencias:** H1-C7, H1-C8, H1-C9, H1-C10, H1-C11, H1-C15.
  RF3, RF4, RF11.

### T-09b — Frontend: pendientes

- **Objetivo:** abrir, cerrar y reabrir pendientes desde la vista de la parte.
- **Alcance:**
  - formulario de abrir pendiente y acciones de cerrar y reabrir;
  - mensajes por campo (obligatorio y máximo) y mensaje único de DT-4.
- **Exclusiones:** corrección del texto de un pendiente; eliminación.
- **Dependencias:** T-04, T-08, DT-2, DT-4.
- **Estado:** bloqueado por T-04, T-08, DT-2 y DT-4.
- **Prioridad:** P1 (abrir). Alcance P2: cerrar y reabrir.
- **Tamaño:** S. Incertidumbre baja.
- **Criterios verificables (en el navegador):**
  - abrir un pendiente lo muestra como abierto; cerrarlo y reabrirlo cambia su
    marca en la vista;
  - descripción vacía o de más de 2.000 caracteres muestra el error;
  - operar sobre un pendiente ajeno muestra el mismo mensaje que sobre uno
    inexistente;
  - build, lint y formato pasan.
- **Referencias:** H1-C12, H1-C13, H1-C14, H1-C15. RF5, RF6, RF11.

### T-10a — Frontend: evidencias (textos y corrección)

- **Objetivo:** agregar y corregir evidencias desde la vista de la parte, sin
  la fecha de comprobación.
- **Alcance:**
  - formulario con qué se comprobó, referencia y contexto obligatorios;
  - corrección de evidencias;
  - mensajes por campo (obligatorio y máximo) y mensaje único de DT-4.
- **Exclusiones:** fecha de comprobación (T-10b); validar que la referencia
  apunte a una fuente existente; eliminación.
- **Dependencias:** T-05a, T-08, DT-2, DT-4.
- **Estado:** bloqueado por T-05a, T-08, DT-2 y DT-4.
- **Prioridad:** P1.
- **Tamaño:** M. Supuesto: un formulario de tres campos largos, para alta y
  corrección. Incertidumbre: comodidad de edición de textos de hasta 2.000
  caracteres.
- **Criterios verificables (en el navegador):**
  - una evidencia completa cambia la afirmación a «con evidencia registrada
    (1)» y muestra «fecha de comprobación no informada»;
  - si falta la referencia, el error aparece en ese campo y no se guarda nada;
  - un texto de más de 2.000 caracteres muestra el error del campo;
  - tras una corrección válida, la fecha de registro sigue igual; tras una
    inválida, la vista conserva todos los datos anteriores;
  - operar sobre una evidencia o afirmación ajena muestra el mismo mensaje que
    sobre una inexistente;
  - build, lint y formato pasan.
- **Referencias:** H2-C1, H2-C4, H2-C5, H2-C6, H2-C7, H2-C8, H2-C9.
  RF7, RF8, RF11.

### T-10b — Frontend: fecha de comprobación

- **Objetivo:** cargar y corregir la fecha de comprobación de una evidencia.
- **Alcance:**
  - campo de fecha sin hora, opcional, en el alta y la corrección;
  - mensaje de error para una fecha futura.
- **Exclusiones:** fecha y hora; zonas horarias más allá de DT-9.
- **Dependencias:** T-05b, T-10a, DT-2, DT-4, DT-9.
- **Estado:** bloqueado por T-05b, T-10a, DT-2, DT-4 y DT-9.
- **Prioridad:** P2.
- **Tamaño:** S. Incertidumbre: depende de cómo DT-9 determine el día actual.
- **Criterios verificables (en el navegador):**
  - una fecha válida se muestra sin hora junto a la fecha de registro;
  - una fecha futura muestra el error y no guarda nada;
  - una corrección con fecha futura muestra el error y conserva los datos
    anteriores;
  - build, lint y formato pasan.
- **Referencias:** H2-C2, H2-C3, H2-C8. RF7, RF8.

## 5. Cobertura historia → tickets

- **H1:** T-02 (partes), T-03 (afirmaciones), T-04 (pendientes), T-07 (acceso
  y partes en la interfaz), T-09a (afirmaciones en la interfaz), T-09b
  (pendientes en la interfaz).
- **H2:** T-05a y T-05b (backend), T-10a y T-10b (interfaz). H2-C8 se reparte
  entre los textos (T-05a, T-10a) y la fecha (T-05b, T-10b).
- **H3:** T-06 (backend), T-08 (interfaz); H3-C7 también en T-02 y T-07;
  H3-C4 se completa entre T-06 (lista vacía) y T-08 (estado vacío y
  aclaración fija).
- **Soporte transversal:** T-01.

## 6. Resumen de prioridad y tamaño

- **P1:** T-01 (M), T-02 (M), T-03 (S), T-04 (S), T-05a (M), T-06 (M),
  T-07 (M), T-08 (M), T-09a (S), T-09b (S), T-10a (M).
- **P2 sin alcance P1:** T-05b (S, puede crecer a M por DT-9), T-10b (S).
- **Alcance P2 dentro de tickets P1:** corregir partes (T-02, T-07), corregir
  afirmaciones (T-03, T-09a), cerrar y reabrir pendientes (T-04, T-09b).

## 7. Definition of Done común

Describe cómo se cerrará cada ticket; **ninguna de estas verificaciones se
ejecutó todavía**. Un ticket está terminado cuando:

- todos sus criterios verificables se comprobaron, y el informe distingue lo
  probado de verdad, lo simulado y lo no probado;
- **backend:** sus tests funcionales pasan contra la base exclusiva de tests,
  la huella de `tmp/db.sqlite3` no cambió, y `npm run lint` y
  `npm run typecheck` pasan; si hubo migración, `database/schema.ts` y
  `.adonisjs/` regenerados quedan incluidos en el cambio;
- **frontend:** `npm run build`, `npm run lint` y `npx prettier --check .`
  pasan, y los criterios se verificaron en el navegador;
- lo implementado coincide con las decisiones técnicas documentadas; si alguna
  cambió, este archivo se actualizó;
- la interfaz no muestra «probada» ni recomendaciones, y no se registran datos
  reales ni secretos;
- pasó por la revisión adversarial con el diff y los archivos nuevos, y cada
  hallazgo quedó resuelto o justificado;
- `CLAUDE.md` refleja cualquier convención nueva.
