# Historias de usuario — Registro de afirmaciones técnicas con evidencia

> Derivadas del PRD
> [`docs/prd/registro-estado-tecnico-mvp.md`](../prd/registro-estado-tecnico-mvp.md)
> (borrador 0.5). Ejercicio de la clase 2 de AI4Devs.
> Tickets derivados:
> [`registro-estado-tecnico-tickets.md`](registro-estado-tecnico-tickets.md).
>
> Los datos de los criterios son **ficticios**: «Webhooks» y la referencia
> `abc1234` vienen del recorrido del PRD; «Pagos» es un nombre inventado para
> los datos de otro usuario.
>
> Los criterios se citan como `H<historia>-C<número>`; por ejemplo, `H2-C3`.
>
> **Reglas comunes a las tres historias:**
>
> - Todas requieren haber iniciado sesión.
> - Los textos se validan después de quitar los espacios exteriores. Un texto
>   obligatorio que queda vacío se rechaza como dato faltante.
> - Máximos: 120 caracteres para el nombre de una parte; 1.000 para su
>   descripción; 2.000 para la descripción de una afirmación, la de un
>   pendiente y cada texto de una evidencia.
> - Datos de otro usuario y datos inexistentes producen **el mismo mensaje
>   visible**, sin revelar contenido. Los códigos de respuesta técnicos no se
>   fijan aquí.
> - Tras una corrección válida, la consulta muestra los datos nuevos. Una
>   corrección inválida se rechaza y se conservan los datos anteriores. No se
>   ofrece historial de valores anteriores.

## H1 — Registrar partes del sistema, afirmaciones y pendientes (F1)

**Como** persona que decide cómo avanzar sobre un sistema,
**quiero** registrar partes del sistema, sus afirmaciones y los pendientes de
cada afirmación,
**para** tener en un solo lugar qué declaré y qué falta resolver.

**Cubre:** RF1, RF2, RF3, RF4, RF5, RF6, RF11 (modificaciones) y RF12.

### Criterios de aceptación

1. **Acceso a la lista de partes (RF12).**
   **Dado** que inicio sesión,
   **cuando** termina el login,
   **entonces** llego a mi perfil;
   **y cuando** sigo el enlace «Estado técnico», veo mi lista de partes.
2. **Crear una parte (RF1).**
   **Dado** que inicié sesión,
   **cuando** creo una parte con el nombre «Webhooks»,
   **entonces** aparece en mi lista de partes.
3. **Parte sin nombre (RF1).**
   **Dado** que inicié sesión,
   **cuando** intento crear una parte con el nombre vacío o compuesto solo por
   espacios,
   **entonces** se rechaza, el mensaje indica que falta el nombre y no se crea
   ninguna parte.
4. **Límites de texto de una parte (RF1).**
   **Dado** que inicié sesión,
   **cuando** intento crear una parte con un nombre de 121 caracteres, o con
   una descripción de 1.001 caracteres, medidos sin los espacios exteriores,
   **entonces** se rechaza con un mensaje que indica qué campo supera su
   máximo, y no se crea ninguna parte;
   **y cuando** el nombre tiene 120 caracteres más espacios exteriores, se
   acepta.
5. **Corregir una parte (RF2).**
   **Dado** que tengo la parte «Webhooks»,
   **cuando** corrijo su nombre y su descripción con datos válidos,
   **entonces** mi lista y la consulta de la parte muestran los datos nuevos.
6. **Corrección inválida de una parte (RF2).**
   **Dado** que tengo la parte «Webhooks»,
   **cuando** intento corregirla dejando el nombre vacío o con más de 120
   caracteres,
   **entonces** se rechaza con un mensaje que lo indica y mi lista y la
   consulta siguen mostrando los datos anteriores.
7. **Afirmación con implementación declarada (RF3).**
   **Dado** que tengo la parte «Webhooks»,
   **cuando** registro la afirmación «Una entrega repetida no se procesa dos
   veces» con implementación declarada,
   **entonces** aparece en esa parte con «implementación declarada» y «sin
   evidencia registrada».
8. **Afirmación sin declaración (RF3).**
   **Dado** que tengo la parte «Webhooks»,
   **cuando** registro una afirmación sin declarar su implementación,
   **entonces** aparece con «sin implementación declarada», y ningún texto
   sugiere que el comportamiento esté sin implementar.
9. **Afirmación sin descripción o demasiado larga (RF3).**
   **Dado** que tengo la parte «Webhooks»,
   **cuando** intento registrar una afirmación con la descripción vacía,
   compuesta solo por espacios o de más de 2.000 caracteres,
   **entonces** se rechaza con un mensaje que indica el motivo y no se crea
   ninguna afirmación.
10. **Corregir una afirmación (RF4).**
    **Dado** que tengo una afirmación con implementación declarada,
    **cuando** corrijo su descripción y quito la declaración,
    **entonces** la consulta muestra la descripción nueva con «sin
    implementación declarada».
11. **Corrección inválida de una afirmación (RF4).**
    **Dado** que tengo una afirmación con descripción e implementación
    declarada,
    **cuando** intento corregirla dejando la descripción vacía o con más de
    2.000 caracteres,
    **entonces** se rechaza con un mensaje que indica el motivo y la consulta
    sigue mostrando la descripción y la declaración anteriores.
12. **Abrir un pendiente (RF5).**
    **Dado** que tengo una afirmación,
    **cuando** abro el pendiente «Integrar y verificar en un entorno
    compartido»,
    **entonces** aparece como abierto en esa afirmación.
13. **Pendiente sin descripción o demasiado largo (RF5).**
    **Dado** que tengo una afirmación,
    **cuando** intento abrir un pendiente con la descripción vacía, compuesta
    solo por espacios o de más de 2.000 caracteres,
    **entonces** se rechaza con un mensaje que indica el motivo y no se crea
    ningún pendiente.
14. **Cerrar y reabrir un pendiente (RF6).**
    **Dado** que una afirmación tiene un pendiente abierto,
    **cuando** lo cierro,
    **entonces** se muestra como cerrado en la misma afirmación;
    **y cuando** lo reabro, vuelve a mostrarse como abierto.
15. **Modificar datos ajenos o inexistentes (RF11).**
    **Dado** que otro usuario tiene sus propias partes, afirmaciones y
    pendientes,
    **cuando** intento corregir, abrir o cerrar algo que le pertenece, o algo
    que no existe,
    **entonces** en ambos casos veo el mismo mensaje, que no revela contenido,
    y los datos del otro usuario no cambian.

## H2 — Agregar evidencias a una afirmación (F2)

**Como** persona que decide cómo avanzar sobre un sistema,
**quiero** registrar qué se comprobó de una afirmación, con su referencia y su
contexto,
**para** poder volver a la fuente original sin reconstruir la relación a mano.

**Cubre:** RF7, RF8 y RF11 (modificaciones).

### Criterios de aceptación

1. **Evidencia completa sin fecha de comprobación (RF7).**
   **Dado** que tengo una afirmación sin evidencias,
   **cuando** agrego una evidencia con qué se comprobó («tests de idempotencia
   en verde»), referencia («commit `abc1234`, suite de webhooks») y contexto
   («local, base descartable»), sin fecha de comprobación,
   **entonces** la evidencia aparece junto a la afirmación con su fecha de
   registro automática y el texto «fecha de comprobación no informada», y la
   afirmación se muestra como «con evidencia registrada (1)», sin que aparezca
   en ningún lugar el término «probada».
2. **Evidencia con fecha de comprobación (RF7).**
   **Dado** que tengo una afirmación,
   **cuando** agrego una evidencia completa con una fecha de comprobación igual
   o anterior a mi día actual,
   **entonces** la evidencia muestra esa fecha, sin hora, además de la fecha de
   registro.
3. **Fecha de comprobación futura (RF7).**
   **Dado** que tengo una afirmación,
   **cuando** intento agregar una evidencia con una fecha de comprobación
   posterior a mi día actual,
   **entonces** se rechaza con un mensaje que indica el motivo y no se guarda
   ninguna evidencia.
4. **Falta un dato obligatorio (RF7).**
   **Dado** que tengo una afirmación sin evidencias,
   **cuando** intento agregar una evidencia sin referencia,
   **entonces** se rechaza, el mensaje indica que falta la referencia, no se
   guarda ninguna evidencia y la afirmación sigue como «sin evidencia
   registrada»;
   lo mismo ocurre si falta qué se comprobó o el contexto.
5. **Dato obligatorio solo con espacios (RF7).**
   **Dado** que tengo una afirmación,
   **cuando** intento agregar una evidencia con el contexto compuesto solo por
   espacios,
   **entonces** se rechaza indicando que falta el contexto.
6. **Texto de evidencia demasiado largo (RF7).**
   **Dado** que tengo una afirmación,
   **cuando** intento agregar una evidencia en la que qué se comprobó, la
   referencia o el contexto supera los 2.000 caracteres sin los espacios
   exteriores,
   **entonces** se rechaza con un mensaje que indica qué campo supera su
   máximo y no se guarda ninguna evidencia.
7. **Corregir una evidencia (RF8).**
   **Dado** que tengo una evidencia registrada,
   **cuando** corrijo su referencia con un valor válido,
   **entonces** la consulta muestra la referencia nueva y la misma fecha de
   registro.
8. **Corrección inválida de una evidencia (RF8).**
   **Dado** que tengo una evidencia registrada,
   **cuando** intento corregirla dejando vacío un dato obligatorio, con un
   texto de más de 2.000 caracteres o con una fecha de comprobación posterior
   a mi día actual,
   **entonces** se rechaza con un mensaje que indica el motivo y la consulta
   sigue mostrando todos los datos anteriores de la evidencia.
9. **Evidencias ajenas o inexistentes (RF11).**
   **Dado** que otro usuario tiene afirmaciones y evidencias,
   **cuando** intento agregar una evidencia a una de sus afirmaciones, corregir
   una de sus evidencias, o hacer lo mismo sobre una afirmación o evidencia que
   no existe,
   **entonces** en todos los casos veo el mismo mensaje, que no revela
   contenido, y los datos del otro usuario no cambian.

## H3 — Consultar evidencias y pendientes de una parte (F3)

**Como** persona que decide cómo avanzar sobre un sistema,
**quiero** ver en una sola vista, para cada afirmación, su implementación
declarada, sus evidencias y sus pendientes,
**para** tomar yo la decisión sabiendo qué está registrado y qué no.

**Cubre:** RF9, RF10 y RF11 (consulta).

En esta vista, **implementación declarada, evidencias y pendientes son tres
dimensiones independientes que pueden coexistir** en una misma afirmación. La
vista no agrupa las afirmaciones en categorías excluyentes.

### Criterios de aceptación

1. **Dimensiones de cada afirmación (RF9).**
   **Dado** que la parte «Webhooks» tiene una afirmación A con implementación
   declarada, una evidencia y un pendiente abierto, y una afirmación B con
   implementación declarada y sin evidencias ni pendientes,
   **cuando** consulto «Webhooks»,
   **entonces** cada afirmación muestra por separado sus tres dimensiones:
   - A: «implementación declarada»; «con evidencia registrada (1)», con lo
     comprobado, la referencia, el contexto, la fecha de registro y la fecha de
     comprobación o «fecha de comprobación no informada»; y su pendiente
     abierto;
   - B: «implementación declarada»; «sin evidencia registrada»; y ningún
     pendiente.
2. **Combinaciones posibles (RF9).**
   **Dado** que una afirmación no tiene implementación declarada pero sí tiene
   una evidencia y un pendiente abierto,
   **cuando** consulto su parte,
   **entonces** se muestran a la vez «sin implementación declarada», «con
   evidencia registrada (1)» y el pendiente abierto.
3. **Pendientes abiertos y cerrados (RF9).**
   **Dado** que una afirmación tiene un pendiente abierto y otro cerrado,
   **cuando** consulto su parte,
   **entonces** se muestran ambos, diferenciados como abierto y cerrado.
4. **Parte sin afirmaciones (RF9, RF10).**
   **Dado** que tengo una parte sin afirmaciones,
   **cuando** la consulto,
   **entonces** la vista indica que todavía no tiene afirmaciones y muestra la
   aclaración fija.
5. **Aclaración fija (RF10).**
   **Dado** que consulto cualquiera de mis partes,
   **cuando** se muestra la vista,
   **entonces** aparece el texto «Esta vista muestra lo registrado. No evalúa si
   la evidencia es suficiente, vigente ni confiable».
6. **Sin conclusiones automáticas (RF9, RF10).**
   **Dado** que consulto una parte,
   **cuando** se muestra la vista,
   **entonces** no aparece el término «probada» ni ninguna conclusión o
   recomendación sobre si es seguro construir encima.
7. **Lista privada (RF11).**
   **Dado** que otro usuario tiene la parte «Pagos»,
   **cuando** veo mi lista de partes,
   **entonces** «Pagos» no aparece.
8. **Consulta de datos ajenos o inexistentes (RF11).**
   **Dado** que otro usuario tiene la parte «Pagos»,
   **cuando** intento consultarla directamente, o intento consultar una parte
   que no existe,
   **entonces** en ambos casos veo el mismo mensaje, que no revela su nombre,
   sus afirmaciones, sus evidencias ni sus pendientes.

## Cobertura de requisitos

- RF1 a RF6 y RF12: H1.
- RF7 y RF8: H2.
- RF9 y RF10: H3.
- RF11: H1 y H2 (modificaciones) y H3 (lista y consulta).
