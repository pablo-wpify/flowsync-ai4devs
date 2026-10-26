# PRD — Registro de afirmaciones técnicas con evidencia (MVP)

> **Versión:** borrador 0.5 — ejercicio de la clase 2 de AI4Devs.
> Historias derivadas: [`docs/backlog/registro-estado-tecnico-historias.md`](../backlog/registro-estado-tecnico-historias.md).
> Tickets: [`docs/backlog/registro-estado-tecnico-tickets.md`](../backlog/registro-estado-tecnico-tickets.md).
>
> **Naturaleza del documento:** caso inspirado en una revisión técnica real de
> WPify. **El problema no está validado comercialmente**: se apoya en un único
> episodio. WPify no se modifica ni se conecta. La base técnica propuesta es
> FlowSync, que hoy ofrece registro, inicio de sesión y perfil.
>
> El documento separa dos planos:
>
> - **Caso real** — lo aportado sobre WPify: **[Hecho]** o **[Desconocido]**.
> - **Propuesta de producto** — lo definido para este ejercicio:
>   **[Decisión]** si ya está acordado, **[Propuesta]** si sigue abierto a
>   revisión. **[Hipótesis]** marca algo que creemos y no está comprobado.
>   Las decisiones son **del ejercicio**: no son necesidades validadas en el
>   caso real.

## 1. Problema y contexto

### Caso real

- [Hecho] Durante una revisión de la arquitectura orientada a eventos de WPify,
  quien lo desarrolla y su socio necesitaron reconstruir qué estaba
  implementado, qué estaba probado y qué seguía pendiente.
- [Hecho] La pregunta concreta fue: «¿La confiabilidad de los webhooks ya estaba
  funcionando o solo teníamos código validado localmente?».
- [Hecho] Para responderla cruzaron el código local, los resultados de los
  tests, las pruebas de la migración en una base local descartable, el estado de
  Git y dictámenes anteriores. Ninguna fuente alcanzó sola.
- [Hecho] La conclusión fue: código validado localmente, no integrado en un
  producto funcionando en un entorno compartido. No había producción.
- [Hecho] El objetivo era avanzar sobre una base confiable. Preocupaba que una
  falla generara inconsistencias para un merchant y afectara su experiencia y su
  calificación. Es un riesgo que se quería evitar, no un incidente ocurrido.

### Problema que el ejercicio intenta abordar

- [Hipótesis] Quien decide qué construir no tiene un lugar donde ver, para una
  parte del sistema, qué afirmaciones tienen evidencia registrada, de qué fuente
  sale esa evidencia y qué sigue pendiente. Por eso reconstruye esa relación a
  mano cada vez.
- [Hipótesis] Una afirmación puede tener a la vez una implementación declarada,
  evidencias y pendientes abiertos. Reducirla a un solo estado oculta
  precisamente lo que importa para decidir.

## 2. Usuario inicial

- [Hecho] Una persona que desarrolla un producto y debe decidir cómo avanzar
  sobre una parte del sistema. En el caso de origen, quien desarrolla WPify con
  un socio.
- [Desconocido] Si el socio comparte la misma necesidad.
- [Decisión] El **MVP es individual**: cada usuario ve solo sus propios datos.
  No hay proyectos, colaboración ni permisos compartidos.
- **No es usuario:** el merchant. Es un afectado potencial en el caso real y no
  utiliza esta herramienta.

## 3. Resultado esperado

**Confirmado en el caso real:**

- Poder decidir si una parte del sistema está suficientemente resuelta para
  construir encima, o si primero hay que resolver un pendiente.
- Saber qué está implementado, qué está probado y qué sigue pendiente.

**Propuesta de producto para este ejercicio:**

- Ver en un solo lugar, para una parte del sistema, sus afirmaciones, la
  implementación declarada, las evidencias registradas con su referencia a la
  fuente original y los pendientes abiertos y cerrados.
- Poder llegar desde cada evidencia a su fuente original para verificarla. La
  herramienta no reemplaza esas fuentes.
- **La decisión la toma el usuario.** La herramienta no evalúa si la evidencia
  es suficiente, vigente o confiable, ni concluye si es seguro construir encima.

## 4. Alcance propuesto y exclusiones

### Vocabulario

- **Parte del sistema:** un área que se quiere evaluar, por ejemplo «Webhooks».
- **Afirmación:** un comportamiento concreto de esa parte, por ejemplo «una
  entrega repetida no se procesa dos veces».
- **Implementación declarada:** indicación del usuario de que, según él, el
  comportamiento está implementado. Es una declaración, no una verificación.
  **«Sin implementación declarada»** significa que el usuario no hizo esa
  declaración; **no** significa que el comportamiento esté sin implementar.
- **Evidencia:** registro de algo que se comprobó. Tiene tres datos
  obligatorios en texto libre —qué se comprobó, una referencia a la fuente
  original y el contexto en que se obtuvo— y una fecha de comprobación opcional.
- **Pendiente:** algo que falta comprobar o resolver sobre una afirmación. Puede
  estar abierto o cerrado.

### Cómo se combinan

- [Decisión] Implementación declarada, evidencias y pendientes son
  **dimensiones independientes que pueden coexistir**, no estados excluyentes:
  una afirmación puede tener las tres a la vez, o cualquier combinación.
- [Decisión] Una afirmación con al menos una evidencia se muestra como **«con
  evidencia registrada»**, nunca como «probada».
- [Decisión] Los pendientes se asocian **únicamente a afirmaciones**.

### Tres funcionalidades

- [Decisión] **F1. Registrar partes del sistema y afirmaciones**, con su
  implementación declarada, y gestionar los pendientes de cada afirmación.
  Incluye el acceso a la lista de partes.
- [Decisión] **F2. Agregar evidencias a las afirmaciones.** Descripción,
  referencia y contexto son obligatorios. El contexto es obligatorio por
  decisión de este ejercicio, no porque se haya validado como necesidad en la
  entrevista.
- [Decisión] **F3. Consultar evidencias y pendientes de una parte**, en una
  vista de solo lectura.

[Decisión] Se pueden **corregir** partes, afirmaciones y evidencias, y abrir,
cerrar o reabrir pendientes. Tras una corrección válida, la consulta muestra los
datos nuevos; una corrección inválida se rechaza y se conservan los datos
anteriores. **No hay historial de auditoría**: el MVP no ofrece ver valores
anteriores. Este documento no define reglas de borrado físico ni de copias de
seguridad. **No se puede eliminar** ninguna parte, afirmación ni evidencia en
este MVP.

### Exclusiones

- Carga automática desde cualquier fuente: todo se registra a mano.
- Integraciones con Git, CI o Jira.
- Evaluar suficiencia, vigencia o confiabilidad de la evidencia, y certificar o
  recomendar si se puede construir encima.
- Exigir que se prueben todos los escenarios de fallo.
- Historial de auditoría de cambios.
- Eliminación de partes, afirmaciones o evidencias.
- Proyectos, equipos, colaboración y permisos compartidos.
- Gestión general de tareas: asignaciones, plazos, tableros.
- Cualquier conexión con WPify.

## 5. Requisitos funcionales con resultados observables

### Reglas comunes

- [Propuesta] Todos los requisitos requieren haber iniciado sesión, algo que
  FlowSync ya resuelve.
- [Decisión] Los textos se validan **después de quitar los espacios
  exteriores**. Un texto obligatorio que queda vacío se rechaza como dato
  faltante.
- [Decisión] Longitudes máximas, medidas después de quitar espacios exteriores:
  - nombre de una parte: 120 caracteres;
  - descripción de una parte (opcional): 1.000 caracteres;
  - descripción de una afirmación: 2.000 caracteres;
  - descripción de un pendiente: 2.000 caracteres;
  - cada texto de una evidencia (qué se comprobó, referencia, contexto): 2.000
    caracteres.

  Un texto que supera su máximo se rechaza con un mensaje que lo indica.
- [Decisión] Una corrección rechazada no modifica nada: la consulta sigue
  mostrando los datos anteriores.

### F1. Partes del sistema, afirmaciones y pendientes

- **RF1. Crear una parte del sistema** con nombre (obligatorio) y descripción
  (opcional).
  *Resultado observable:* la parte aparece en la lista del usuario. Si falta el
  nombre o algún texto supera su máximo, se rechaza con un mensaje que lo indica.
- **RF2. Corregir una parte del sistema:** nombre y descripción, con las mismas
  reglas que RF1.
  *Resultado observable:* tras una corrección válida, la lista y la consulta
  muestran los datos nuevos; tras una inválida, siguen mostrando los anteriores.
- **RF3. Registrar una afirmación** dentro de una parte, con descripción
  (obligatoria) e indicación de si tiene implementación declarada.
  *Resultado observable:* la afirmación aparece en la parte con «implementación
  declarada» o «sin implementación declarada», y con «sin evidencia
  registrada». Si falta la descripción o supera su máximo, se rechaza con un
  mensaje que lo indica.
- **RF4. Corregir una afirmación:** descripción e implementación declarada, con
  las mismas reglas que RF3.
  *Resultado observable:* tras una corrección válida, la consulta muestra los
  datos nuevos; tras una inválida, sigue mostrando los anteriores.
- **RF5. Abrir un pendiente** en una afirmación, con descripción (obligatoria).
  *Resultado observable:* el pendiente aparece como abierto en esa afirmación.
  Si falta la descripción o supera su máximo, se rechaza con un mensaje que lo
  indica.
- **RF6. Cerrar o reabrir un pendiente.**
  *Resultado observable:* el pendiente pasa a mostrarse como cerrado o abierto,
  respectivamente, en la misma afirmación.

### F2. Evidencias

- **RF7. Agregar una evidencia** a una afirmación, con:
  - qué se comprobó (obligatorio, texto libre);
  - referencia a la fuente original (obligatoria, texto libre);
  - contexto en que se obtuvo (obligatorio, texto libre);
  - fecha de comprobación (opcional): una **fecha de calendario sin hora**,
    que no puede ser posterior al día actual del usuario.

  La fecha de registro se asigna automáticamente.
  *Resultado observable:* si falta un dato obligatorio, algún texto supera su
  máximo o la fecha de comprobación es posterior al día actual, se rechaza y el
  mensaje indica el motivo. Si es válida, la evidencia aparece junto a la
  afirmación y esta pasa a mostrarse como «con evidencia registrada».
- **RF8. Corregir una evidencia**, con las mismas reglas que RF7. La fecha de
  registro no cambia.
  *Resultado observable:* tras una corrección válida, la consulta muestra los
  datos corregidos; tras una inválida, sigue mostrando los anteriores.

### F3. Consulta

- **RF9. Consultar una parte del sistema.** Para cada afirmación, la vista
  muestra tres dimensiones independientes, que pueden coexistir:
  - su implementación declarada («implementación declarada» o «sin
    implementación declarada»);
  - «con evidencia registrada» con la cantidad de evidencias, o «sin evidencia
    registrada»;
  - cada evidencia con lo comprobado, la referencia, el contexto, la fecha de
    registro y la fecha de comprobación, o «fecha de comprobación no informada»
    si no se cargó;
  - sus pendientes, con los abiertos y los cerrados diferenciados.

  Si la parte todavía no tiene afirmaciones, la vista lo indica (estado vacío).
  *Resultado observable:* en cada afirmación se ve, por separado, si tiene
  implementación declarada, si tiene evidencia registrada y qué pendientes
  tiene; los pendientes abiertos se distinguen de los cerrados; una parte sin
  afirmaciones muestra el estado vacío.
- **RF10. Aclaración fija.** Toda consulta muestra el texto: «Esta vista muestra
  lo registrado. No evalúa si la evidencia es suficiente, vigente ni
  confiable».
  *Resultado observable:* el texto aparece en toda consulta, incluida la de una
  parte sin afirmaciones.
- **RF11. Privacidad.** Un usuario no puede ver, consultar ni modificar las
  partes, afirmaciones, evidencias ni pendientes de otro.
  *Resultado observable:* otro usuario no los ve en su lista. Un intento de
  acceder a datos ajenos produce **el mismo mensaje visible** que un intento de
  acceder a datos inexistentes, sin revelar contenido. Este documento no fija
  códigos de respuesta técnicos.

### Navegación

- **RF12. Acceso a la lista de partes.** Tras iniciar sesión, el usuario sigue
  llegando a su perfil. Desde ahí, un enlace «Estado técnico» lleva a su lista
  de partes.
  *Resultado observable:* después del login se muestra el perfil, y el enlace
  «Estado técnico» abre la lista de partes del usuario.

## 6. Recorrido principal de uso

[Propuesta] Los datos son **ficticios**, inspirados en el caso de WPify. La
referencia `abc1234` es inventada.

1. El usuario inicia sesión, llega a su perfil y sigue el enlace «Estado
   técnico».
2. Crea la parte «Webhooks».
3. Registra dos afirmaciones, ambas con implementación declarada:
   - «Una entrega repetida no se procesa dos veces».
   - «Un webhook recibido queda registrado antes de procesarse».
4. A la primera le agrega una evidencia:
   - qué se comprobó: «tests de idempotencia en verde»;
   - referencia: «commit `abc1234`, suite de webhooks»;
   - contexto: «local, base descartable»;
   - sin fecha de comprobación.
5. Advierte que la referencia está incompleta y la corrige para agregar el
   nombre del archivo de tests.
6. En la misma afirmación abre un pendiente: «Integrar y verificar en un
   entorno compartido».
7. Consulta «Webhooks» y ve:
   - primera afirmación: «implementación declarada», «con evidencia registrada
     (1)», la evidencia con contexto «local, base descartable» y «fecha de
     comprobación no informada», y un pendiente abierto de integración;
   - segunda afirmación: «implementación declarada», «sin evidencia
     registrada», sin pendientes;
   - la aclaración fija de que la vista no evalúa suficiencia, vigencia ni
     confiabilidad.
8. Con esa información, el usuario decide cómo avanzar: por ejemplo, integrar
   primero, buscar evidencia para la segunda afirmación o revisar la fuente
   original a partir de la referencia. **La herramienta no recomienda ninguna
   opción** ni concluye si es seguro construir encima.

## 7. Cómo evaluaríamos si el ejercicio resulta útil

No hay mediciones previas: no se conoce el costo de la revisión real. Por eso
**no se fijan métricas numéricas**. [Propuesta] Evaluación cualitativa:

- **Distinguir lo conocido de lo pendiente.** Cargar a mano, con datos
  ficticios o anonimizados, el estado de los webhooks tal como se conoció en la
  revisión, y comprobar si con la consulta se separa lo que tiene evidencia
  registrada, lo que solo tiene implementación declarada y lo que sigue
  pendiente.
- **Llegar a las fuentes originales.** Comprobar si cada referencia permite
  ubicar su fuente (commit, salida de tests, dictamen) sin adivinar. **Volver a
  la fuente para verificar no es un fracaso**: es el uso previsto. El fracaso
  sería que la referencia no alcance para encontrarla.
- **Juicio del usuario.** Que el usuario de origen diga si la vista habría
  ayudado a orientar la decisión sobre los webhooks y qué faltó.
- **Señal de costo.** Registrar el esfuerzo de carga manual. Si registrar cuesta
  más que reconstruir, la hipótesis se debilita.

## 8. Supuestos, preguntas abiertas y decisiones

### Supuestos

- El problema se repite más allá de un episodio; hoy hay uno solo.
- Una carga manual es aceptable.
- Descripción, referencia y contexto bastan para que una evidencia sea útil.
- Separar implementación declarada, evidencias y pendientes ayuda a decidir más
  que un estado único.

### Preguntas abiertas del caso real

- Frecuencia del problema y costo actual de la reconstrucción.
- Si el socio comparte la necesidad.
- Por qué no alcanzaron los dictámenes que ya existían.
- Qué inconsistencia concreta podría ver un merchant.

### Preguntas abiertas de la propuesta

- Cómo advertiría el usuario que una evidencia dejó de reflejar el código
  actual. Hoy no se detecta y es una exclusión explícita.
- Si los pendientes cerrados deberían poder ocultarse cuando sean muchos.
- Vocabulario definitivo: «parte del sistema», «afirmación», «implementación
  declarada», «evidencia registrada».

### Decisiones tomadas (del ejercicio, no validadas en el caso real)

- MVP individual, sin proyectos ni colaboración.
- Implementación declarada, evidencias y pendientes como dimensiones que
  pueden coexistir; nunca se muestra «probada».
- Corrección de partes, afirmaciones y evidencias, sin historial de auditoría.
  Una corrección válida se refleja en la consulta; una inválida conserva los
  datos anteriores. Sin reglas de borrado físico ni de copias de seguridad en
  este documento.
- Sin eliminación de partes, afirmaciones ni evidencias.
- Contexto de evidencia obligatorio, en texto libre.
- Pendientes asociados únicamente a afirmaciones; abiertos y cerrados se
  muestran diferenciados.
- Fecha de registro automática. Fecha de comprobación opcional, de calendario y
  sin hora, no posterior al día actual del usuario; si falta, se muestra «fecha
  de comprobación no informada». Cómo se determina el día actual del usuario se
  define al diseñar el contrato técnico.
- «Sin implementación declarada» indica ausencia de declaración, no ausencia de
  implementación.
- Textos validados después de quitar espacios exteriores; un texto obligatorio
  vacío se rechaza. Máximos: 120 (nombre de parte), 1.000 (descripción de
  parte), 2.000 (descripción de afirmación, descripción de pendiente y cada
  texto de evidencia).
- Una parte sin afirmaciones muestra un estado vacío, con la aclaración fija.
- Datos ajenos e inexistentes producen el mismo mensaje visible, sin revelar
  contenido. Los códigos de respuesta técnicos se fijan fuera de este
  documento.
- Tras el login se conserva el perfil como destino; un enlace «Estado técnico»
  lleva a la lista de partes.
