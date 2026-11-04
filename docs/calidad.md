# Calidad: SOLID y usabilidad

Referencia de INFRA-04 para nuevas specs y cambios. Estos criterios no certifican el código existente ni autorizan refactorizaciones fuera de alcance. Las reglas funcionales siguen en [business-rules.md](business-rules.md).

## SOLID en la arquitectura del proyecto

| Principio | Aplicación práctica | Evidencia en revisión |
|---|---|---|
| S — Responsabilidad única | Cada caso de uso resuelve una acción; el controlador traduce HTTP y el repositorio persiste | Se puede explicar la responsabilidad de cada componente y probarlo por separado |
| O — Abierto a extensión | Extender por puertos cuando existe una variación real, por ejemplo un adaptador de almacenamiento | La extensión conserva los contratos existentes; no se crean jerarquías para necesidades hipotéticas |
| L — Sustitución | El repositorio PostgreSQL y su doble de pruebas cumplen el mismo contrato | Coinciden en retornos, errores, ausencia de resultados y aislamiento; el doble no oculta reglas que fallan en producción |
| I — Segregación de interfaces | El consumidor define un puerto pequeño con las operaciones que necesita | Un caso de uso no depende de métodos ajenos; un módulo consume otro por su API pública |
| D — Inversión de dependencias | El caso de uso recibe sus puertos; la composición conecta adaptadores concretos | Dominio/aplicación no importan Express ni pg; se revisan index.js, app.js y server.js |

Usar funciones o clases según lo que simplifique el caso. No exigir una clase por archivo, una interfaz artificial o un patrón para cada letra. La spec explica los principios relevantes y justifica los que no aplican. Mantener la política de dependencias de [architecture.md](architecture.md): application puede usar domain del mismo módulo y shared sin dependencias de transporte o persistencia.

## Usabilidad como característica del sistema

El usuario debe entender qué puede hacer, qué ocurrió y cómo continuar. Cada tarea de interfaz define un escenario del rol, una acción y un resultado observable. El backend contribuye con errores consistentes y estados fiables; la facilidad de uso se verifica también en la pantalla real.

| Criterio | Comprobación para las pantallas afectadas |
|---|---|
| Comprensión | Etiquetas visibles y términos consistentes en español; formatos de fecha, hora y USD claros; instrucciones antes de confirmar |
| Retroalimentación | Distinguir carga, éxito, error y lista vacía; indicar estado y plazo cuando corresponda; evitar envíos duplicados |
| Recuperación | Explicar el error y la siguiente acción; conservar campos no sensibles que sigan siendo válidos; nunca persistir contraseñas para este fin |
| Prevención | Mostrar un resumen antes de una compra; advertir consecuencias relevantes; validar sin sustituir los controles del backend |
| Teclado | Completar el escenario con Tab, Shift+Tab, Enter y Escape cuando aplique, con foco visible y sin bloqueos |
| Lectura y adaptación | Verificar a 360 y 1280 píxeles de ancho; texto ampliado al 200 % sin perder acciones; no depender solo de color; revisar contraste de texto normal de al menos 4,5:1 |

Son objetivos para cambios futuros, no una declaración de conformidad con una norma. Si otro escenario exige un criterio distinto, documentarlo y acordarlo antes de implementar.

## Cómo incorporar y comprobar los criterios

1. Seleccionar criterios relevantes en la spec y expresarlos como «Dado / Cuando / Entonces». Una tarea solo de backend puede indicar «sin interfaz en este alcance» y precisar qué contrato permitirá mensajes útiles.
2. El autor registra pasos, entorno/dispositivo, resultado esperado, resultado observado y evidencia sin datos personales. Si no existe la pantalla o no pudo ejecutarse, registrar Pendiente, nunca Aprobado.
3. Otro integrante reproduce el escenario. Cuando sea posible, observar a alguien que no lo haya implementado, sin guiar cada clic, y registrar dónde se atasca.
4. Registrar hallazgos como pendientes trazables y acordar sus correcciones. No inventar porcentajes de éxito, tiempos de tarea ni resultados de pruebas de usuarios.

Ejemplo: «Dado un formulario de cooperativa con RUC inválido, cuando se envía, entonces se identifica el campo y cómo corregirlo, se conserva el nombre no sensible y no se crea la cooperativa». Las validaciones concretas proceden de su spec; el ejemplo no agrega reglas de dominio.
