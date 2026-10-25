# Spec Delta

## Purpose

Garantizar que los tests del backend se ejecuten sobre una base de datos
exclusiva, que una configuración peligrosa se detenga antes de tocar datos y
que la base de desarrollo nunca se modifique por ejecutar tests.

## ADDED Requirements

### Requirement: Base de datos exclusiva para tests
La ejecución de los tests del backend SHALL usar un archivo de base de datos
distinto del de desarrollo, comparando rutas normalizadas e identidad física.
La base de desarrollo MUST NOT abrirse durante una ejecución de tests.

#### Scenario: La suite usa la base de tests
- **WHEN** se ejecuta cualquier suite de tests del backend
- **THEN** la conexión activa apunta al archivo de base de tests
- **AND** ese archivo no es, por ruta ni por identidad física, el archivo de desarrollo

#### Scenario: La base de tests se crea si no existe
- **WHEN** se ejecuta la suite y el archivo de base de tests no existe
- **THEN** se crea y se prepara antes del primer test, sin tocar el archivo de desarrollo

### Requirement: Salvaguarda antes de tocar datos
Antes de migrar, limpiar, borrar o ejecutar cualquier test, el sistema SHALL
verificar la configuración de la base y MUST abortar con un error explícito si
no es segura. La verificación MUST ocurrir antes de cualquier acceso a una base.

#### Scenario: Misma ruta que desarrollo
- **WHEN** la base configurada para tests resuelve a la misma ruta normalizada que la de desarrollo
- **THEN** la ejecución aborta con un error que lo indica
- **AND** no se ejecuta ninguna migración, limpieza, borrado ni test

#### Scenario: Enlace simbólico peligroso
- **WHEN** la base configurada para tests es un enlace simbólico, o está en un directorio que resuelve fuera del directorio autorizado
- **THEN** la ejecución aborta con un error que lo indica

#### Scenario: Mismo archivo físico
- **WHEN** la base configurada para tests es otro nombre del mismo archivo físico que la base protegida
- **THEN** la ejecución aborta con un error que lo indica

#### Scenario: Entorno distinto del de tests
- **WHEN** la salvaguarda se ejecuta fuera del entorno de tests
- **THEN** la ejecución aborta con un error que lo indica

#### Scenario: Conexión abierta antes de la verificación
- **WHEN** la conexión a la base ya está abierta en el momento de la verificación
- **THEN** la ejecución aborta con un error que lo indica

#### Scenario: La base testigo no cambia
- **WHEN** la salvaguarda se prueba con una base descartable que hace de base protegida, en cualquiera de los casos peligrosos
- **THEN** la salvaguarda aborta
- **AND** la huella de la base testigo es idéntica antes y después

### Requirement: Borrado acotado al archivo autorizado
El sistema SHALL borrar únicamente el archivo de base de tests autorizado y
sus archivos auxiliares de SQLite, y MUST comprobar justo antes de cada borrado
que el destino es ese archivo regular y no un enlace ni otro archivo físico.

#### Scenario: Destino de borrado inseguro
- **WHEN** el destino a borrar es un enlace simbólico, no es un archivo regular o comparte identidad física con una base protegida
- **THEN** la ejecución aborta con un error que lo indica
- **AND** no se borra ningún archivo

#### Scenario: Archivos auxiliares de una ejecución anterior
- **WHEN** quedan archivos auxiliares de SQLite de la base de tests de una ejecución anterior
- **THEN** se borran con las mismas comprobaciones que el archivo principal

### Requirement: Una sola ejecución a la vez
Solo una ejecución SHALL preparar o usar la base de tests a la vez. Una
ejecución que encuentra otra activa MUST detenerse sin borrar ni migrar nada.

#### Scenario: Otra ejecución en curso
- **WHEN** se inicia una ejecución mientras otra ejecución activa usa la base de tests
- **THEN** la nueva ejecución aborta con un error que lo indica
- **AND** la base de tests y sus archivos auxiliares no se modifican

#### Scenario: Marca de una ejecución que ya terminó
- **WHEN** queda la marca de exclusividad de una ejecución cuyo proceso ya no existe
- **THEN** la nueva ejecución la reemplaza y continúa

### Requirement: Datos de desarrollo intactos
Ejecutar los tests SHALL NOT modificar la base de desarrollo ni sus archivos
auxiliares de SQLite.

#### Scenario: Huella de desarrollo sin cambios
- **WHEN** se ejecuta la suite completa sin ningún otro proceso conectado a la base de desarrollo
- **THEN** la huella del archivo de desarrollo es idéntica antes y después
- **AND** no aparecen ni cambian archivos auxiliares de SQLite de la base de desarrollo

### Requirement: Ejecuciones repetibles
Cada ejecución de tests SHALL partir de un estado conocido de la base de tests,
de modo que ejecutar la suite varias veces seguidas dé el mismo resultado.

#### Scenario: Dos ejecuciones consecutivas
- **WHEN** se ejecuta la suite completa dos veces seguidas sin cambios de código
- **THEN** ambas ejecuciones terminan con el mismo resultado

#### Scenario: Ejecución anterior interrumpida
- **WHEN** una ejecución anterior se interrumpió y dejó datos en la base de tests
- **THEN** la ejecución siguiente parte igualmente de un estado conocido y no falla por esos datos

#### Scenario: La base de tests se conserva al terminar
- **WHEN** una ejecución termina
- **THEN** el archivo de base de tests sigue existiendo, con las migraciones de la aplicación revertidas

### Requirement: Aislamiento entre tests
Los datos que crea un test SHALL NOT quedar visibles para los tests siguientes.

#### Scenario: Datos de un test no visibles en otro
- **WHEN** un test crea un registro en la base de tests y termina
- **THEN** el test siguiente no encuentra ese registro
