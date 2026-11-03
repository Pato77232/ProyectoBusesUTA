# BOOK-07-L05-T1: persistencia contractual y lectura autorizada de pagos

- **Planificación:** L-05, primer incremento; complementa [BOOK-07-L05](BOOK-07-L05.md) y [BOOK-06-L04](BOOK-06-L04.md). Identificador local de spec, no ticket externo.
- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Pablo para contexto/arquitectura; Shirley para compatibilidad del consumidor. No se atribuye aceptación de revisión de este incremento.
- **Estado:** Pasos A–C implementados y verificados localmente; revisión humana pendiente. Autorizados por Leslie el 2 de noviembre de 2026.
- **Autorización actual:** Leslie solicita empezar lo pendiente después de indicar que corresponde completar esta spec. Leslie respondió expresamente «si autorizo sigamos porfavor» a la solicitud de implementar pasos A–C de esta spec. Autorización de implementación registrada; revisión humana de código pendiente.
- **Rama local:** feature/BOOK-03-resumen-creacion-dominio, HEAD c7ceed9; cambios documentales posteriores sin commit.
- **Remoto comprobado:** origin/develop 1daa3c4, 2 de noviembre de 2026; no incorporado localmente.
- **Contrato de destino:** [PR #46, contrato publicado](https://github.com/Pato77232/ProyectoBusesUTA/blob/e414f7ad4bcc35a4bd208abc468867d91ee84200/docs/contratos/lectura-reservas-pagos.md). Diseño seleccionado según delegación reportada por Pablo; no reabrir firma/contexto/errores como propuestas genéricas.
- **Consumidor:** PR #47 integrada, adaptador preparado pero sin conexión real en rutas. Proveedor implementado y probado localmente en este incremento; rutas productivas de Payments aún no conectadas.

## 1. Objetivo

Guardar los hechos necesarios del plazo y recepción en Bookings y proporcionar paymentQueries.findForPayment autorizado contra PostgreSQL real. Esta lectura debe ser compatible con el DTO de PR #46 y no inventar datos históricos.

## 2. Reglas y decisiones aplicadas

RN-02/40/41/50/51. Plazo inicial entero 180..300 segundos capturado al aceptar resumen y crear bloqueo; inicio explícito independiente de createdAt. Precio/propiedad/tenant persistidos y confiables, sin recotización desde configuración actual.

PENDING_PAYMENT es el único estado de reserva soportado inicialmente. La recepción aceptada es un hecho distinto del estado de workflow. Preparar su almacenamiento no habilita recibir un comprobante ni implementar estados de revisión/venta. Corrección de 15 minutos conserva asientos al vencer por confirmación de Leslie; ese flujo no se implementa aquí.

## 3. Alcance y exclusiones

Incluye:
1. Una migración nueva de datos de plazo/conocimiento de recepción, sin modificar migraciones existentes.
2. Adaptar exclusivamente la escritura de nuevas reservas ya existente para capturar esos hechos atómicamente.
3. Lectura autorizada y DTO de pagos con errores públicos seleccionados.
4. Pruebas unitarias, PostgreSQL, composición/arranque y evidencia correspondientes.

No incluye markPaymentProofReceived, confirmSale, releaseBooking, coordinador de expiración, escrituras desde Payments, reconciliación automática de historia, estados de venta/revisión, versiones de archivo, caja, invitado, correo, acreditador ni modificación de pantallas. Tampoco activar carga productiva con el lector como sustituto de recepción.

La fila de base de reservas no se rehace: reutilizar reserva/idempotencia/bloqueo actuales. La adaptación de tarifas/VIP de L-01 y relación de viajes/hojas se realiza aparte.

## 4. Flujo verificable

### Creación ya existente

Después del bloqueo actual de inventario y revalidación del resumen, el servidor toma inicio confiable y configuración efectiva. Persiste reserva, resumen/pasajeros, ocupaciones, idempotencia, inicio de plazo, duración y ausencia inicial conocida de recepción en una única transacción. Fallo de cualquier asiento o dato revierte todo. Recuperación de creación ya confirmada conserva fechas originales.

### Consulta nueva

Validar consulta y contexto de solicitud autenticada → resolver permiso → SELECT filtrado por propietario o tenant → null para ausente/ajena → validar datos persistidos → evaluar reloj confiable → DTO inmutable.

La lectura no escribe, bloquea para una futura mutación, libera ni expira. No consulta catálogo, tarifas vigentes, acreditador o tablas privadas de Payments.

## 5. Modelo físico propuesto del incremento

Nombres internos, no ampliación del DTO público:

| Columna nueva de bookings | Tipo | Semántica |
| --- | --- | --- |
| proof_window_started_at | timestamptz nullable para historia desconocida | Inicio efectivo una vez capturado |
| proof_window_seconds | integer nullable para historia desconocida | Duración efectiva 180..300 |
| proof_reception_state | text NOT NULL | UNKNOWN, NOT_RECEIVED o RECEIVED, conocimiento del hecho, no workflow de reserva |
| accepted_proof_id | text nullable | Identidad opaca del primer comprobante aceptado |
| proof_received_at | timestamptz nullable | Instante de primera recepción aceptada |

Restricciones propuestas:
- Filas migradas: proof_reception_state UNKNOWN, metadatos nuevos nulos. No rellenar inicio desde createdAt ni asumir “sin comprobante”.
- UNKNOWN exige accepted_proof_id y proof_received_at nulos; el lector produce integridad por información no acreditada.
- NOT_RECEIVED requiere inicio/duración válidos y ambos campos de aceptación nulos.
- RECEIVED requiere inicio/duración, ID no vacío e instante aceptado válidos; solo uno de esos campos presente es inconsistente.
- Estados conocidos: expires_at = proof_window_started_at + duración exacta; 180..300 segundos enteros; fechas nuevas con precisión de milisegundos sin truncar/normalizar para esconder diferencias.
- Recepción conocida: instante no anterior al inicio y estrictamente menor que expires_at. No habilitar inserción de aceptación mediante API nueva en este incremento.
- Inicio/duración/vencimiento de contexto conocido se protegen como hechos originales frente a modificaciones ordinarias. No exigir que created_at sea igual al inicio explícito.
- La migración puede usar UNKNOWN como valor de clasificación de registros anteriores; no NOT_RECEIVED como default histórico. La creación nueva debe especificar NOT_RECEIVED y sus datos, no depender de una clasificación implícita.
- Ninguna FK física hacia tablas de Payments ni triggers que consulten datos ajenos. No exponer estado de conocimiento interno en el DTO.

La restricción histórica bookings_window_check relaciona vencimiento con created_at. Sustituirla desde la migración nueva por una regla compatible: mantener invariantes históricas para filas UNKNOWN y validar contra inicio explícito para contexto conocido. No dejar restricciones contradictorias que hagan createdAt igual a inicio por accidente.

Protección de inmutabilidad propuesta: restricción/trigger local que impida editar inicio/duración/vencimiento conocidos y el primer par de recepción una vez aceptado, dejando posible la transición autorizada NOT_RECEIVED→RECEIVED de un incremento posterior. UNKNOWN→conocido no se expone aquí como operación genérica; reconciliación histórica necesita tarea, evidencia y auditoría propias. No imponer una solución SQL que bloquee inevitablemente la recepción futura.

### Reversión y compatibilidad

Down conserva reservas/ocupaciones/resúmenes existentes pero elimina los metadatos nuevos, por lo que pierde conocimiento del contrato. Reaplicar no inventa esos datos: vuelve a UNKNOWN para filas previas. Documentar esa pérdida; no vender la reversión como conservación de información nueva.

Si un registro conocido ya usa inicio diferente de createdAt e impide restaurar la restricción histórica, down debe fallar atómicamente con mensaje controlado y preservar datos, sin alterar fechas para poder revertir. Cubrir reversión/reaplicación compatible y caso no reversible sin conversión autorizada.

Versiones antiguas de la aplicación que escriban sin los metadatos no deben producir elegibilidad afirmativa; esas filas quedan UNKNOWN. No truncar datos para simplificar despliegue.

### Integridad monetaria existente

El DTO admite entero no negativo según PR #46; la migración local actual exige total_price_cents > 0 y fórmula sin VIP. Este incremento no cambia esas restricciones ni crea venta gratuita. Leer cero solo será posible si otro alcance autorizado soporta su persistencia; no falsificar el esquema ni usar cero como fallback.

## 6. API pública y contexto

```js
bookings.paymentQueries.findForPayment({ bookingId, purpose }, authContext)
// authContext: { userId, role, cooperativeId }
```

Consulta estricta; bookingId texto opaco no vacío, sin imponer UUID ni convertir a número. Propósito UPLOAD_PROOF/REVIEW_PAYMENT fijado por servidor. Contexto proyectado de solicitud Auth autenticada; no forma serializada del body, no verificación por bandera. No conservar tokens/sesión para trabajador.

| Contexto | Propósito | Filtro de Bookings |
| --- | --- | --- |
| CUSTOMER, tenant null | UPLOAD_PROOF | ID + owner_id = userId; tenant sale de la reserva |
| CLERK, tenant válido | REVIEW_PAYMENT | ID + cooperative_id del principal |
| Sin identidad/contexto válido | Cualquiera | Denegar antes del repositorio |
| Otros roles o combinación incompatible | Cualquiera | Denegar antes del repositorio |

API pública expuesta junto al router existente, sin retirarlo. Sin endpoint público nuevo. La forma mínima del contexto no prueba autenticidad: composición y Auth mantienen la frontera; la operación comprueba integridad/permisos sin duplicar JWT ni importar internals de Auth.

## 7. DTO, elegibilidad y errores

DTO exacto del contrato: bookingId, cooperativeId, status, totalPriceCents, currency USD, createdAt, proofWindowStartedAt, proofWindowSeconds, expiresAt, evaluatedAt, canUploadProof; ownerId solo UPLOAD_PROOF. Inmutable, fechas ISO UTC canónicas. Sin pasajeros, cédulas, nacimiento, discapacidad, documentos, rutas/keys/credenciales o JSONB completo.

Validar row/cooperativa/propietario conforme al filtro. Validar moneda contra resumen persistido, total seguro y coherente con reserva, fechas/duración y recepción. Filtrar autorización antes de informar corrupción de una reserva ajena.

Para PENDING_PAYMENT con metadatos válidos:
- NOT_RECEIVED y evaluatedAt < expiresAt: canUploadProof true.
- NOT_RECEIVED en igualdad o después: false.
- RECEIVED validado: false incluso después del plazo original.
- UNKNOWN, datos incompletos o estado de reserva distinto del soportado: error de integridad, nunca false para ocultar falta de información.

Leer una fila de pruebas que represente recepción conocida permite verificar el lector; no acredita operación pública de aceptación ni revisión real F11. No se agrega workflow de revisión en este incremento.

| Condición | Código seleccionado |
| --- | --- |
| Contexto ausente/sin userId válido | UNAUTHENTICATED |
| Rol/propósito prohibido o tenant inconsistente | FORBIDDEN |
| Consulta malformada/campos extra | BOOKING_VALIDATION_ERROR |
| Inexistente/ajena con contexto autorizado | null |
| Datos persistidos inválidos o historia UNKNOWN | BOOKING_DATA_INTEGRITY_ERROR |
| Fallo temporal identificado del proveedor | BOOKING_QUERY_UNAVAILABLE |
| Fallo no clasificado | INTERNAL_ERROR |

401/403/400/500/503 son traducciones del consumidor conforme al contrato; null se vuelve BOOKING_NOT_FOUND/404 genérico donde corresponde. No modificar middleware común unilateralmente ni importar clases privadas de otros módulos. En bandeja, relación null inesperada se trata como integridad, no se elimina fila silenciosamente.

Clasificación técnica de temporales en infraestructura: lista explícita de fallos de conectividad/indisponibilidad, revisada en implementación y probada por código; no toda excepción pg es temporal. Errores SQL, detalles de conexión y datos corruptos no se revelan.

## 8. Casos verificables de aceptación

| Caso local | Comprobación esperada |
| --- | --- |
| T01 | Migrar reservas históricas conserva cada dato/ocupación y las marca UNKNOWN sin inventar recepción/inicio |
| T02 | Nueva creación guarda todos los hechos con ausencia conocida junto a reserva/asientos/clave |
| T03 | Fallo al insertar un asiento revierte también metadatos e idempotencia; no éxito parcial |
| T04 | 180 y 300 válidos; 179/301/fracción rechazados, sin redondeo |
| T05 | createdAt distinto del inicio explícito no cambia el vencimiento del contrato conocido |
| T06 | Inicio/duración/recepción incoherentes o modificaciones prohibidas fallan conforme a restricciones |
| T07 | UNKNOWN, metadatos ausentes y par de aceptación incompleto producen integridad, nunca elegibilidad |
| T08 | CUSTOMER dueño obtiene DTO y ownerId; ajeno e inexistente devuelven mismo null |
| T09 | CLERK de tenant correcto obtiene DTO sin ownerId; otro tenant devuelve null |
| T10 | Administradores/invitados/trabajador/contexto inconsistente denegados sin SELECT de reserva |
| T11 | Reloj antes/en/después del límite devuelve true/false/false sin escrituras |
| T12 | Recepción conocida y válida devuelve false sin liberar; no prueba mutación receptora |
| T13 | Cambiar configuración/tarifa después no modifica plazo/total persistido |
| T14 | Reintento de creación ya confirmada devuelve mismo ID/plazo y conserva metadatos |
| T15 | Fallo temporal clasificado da 503 por consumidor; desconocido da 500, no null |
| T16 | DTO elimina PII/internals, no muta filas/contexto y mantiene tipo exacto compatible con adaptador |
| T17 | Down/up compatible conserva negocio y vuelve a UNKNOWN; down incompatible falla sin pérdida |
| T18 | Arranque real conserva routers de Auth/Pagos/Bookings y no conecta simulaciones como lector real |

Ningún caso está marcado ejecutado. Mantener F01–F20 como referencia con ajustes PR #46; F11 de workflow en revisión espera L-04. Las pruebas antiguas conservan su comportamiento/expectativas de negocio; nuevos campos del esquema se verifican con pruebas adicionales, sin borrar aserciones.

## 9. Pruebas y entorno

Unitarias de consulta/identidad/DTO/reloj/errores y escritura de metadatos con puertos. PostgreSQL aislado para migración, restricciones, autorizaciones por filtro SQL, rollback e idempotencia real. Probar denegación antes de leer mediante espías y luego aislamiento real con dos compradores/cooperativas.

Prueba de compatibilidad con la forma exacta de PR #47; el adaptador consumidor vive solo en develop, no en la rama local actual. Si no se incorpora ese código mediante operación autorizada, no afirmar integración ejecutada contra el adaptador real: verificar contrato local y registrar comparación estática. La conexión real de rutas de Shirley es incremento posterior.

Desde backend ejecutar npm run lint, npm run format:check y npm test con Node 24 y PostgreSQL exclusivo según [testing-database.md](../testing-database.md), sin leer .env. Registrar fallos ajenos con evidencia y no atribuir causa sin investigar. Comprobar start real por cambios de composición y retirar recursos propios. Sin instalación de dependencias prevista.

## 10. Archivos previstos y secuencia pequeña

| Paso | Archivos de implementación previstos | Resultado |
| --- | --- | --- |
| A, persistencia | Una migración nueva posterior al máximo remoto/local; infrastructure/pg-booking.repository.js; dominio/contexto de creación solo si necesario | Nuevas reservas con metadatos atómicos; historia UNKNOWN |
| B, lector | application/find-for-payment.use-case.js, validación/DTO/errores propios, lectura específica por dueño/tenant en infraestructura | Lectura autorizada compatible, sin efectos |
| C, composición/verificación | bookings/index.js; tests/unit/bookings y tests/integration/bookings; spec/evidencia | API pública verificable y arranque; sin conectar rutas nuevas de Payments |

Nombres nuevos orientativos y locales; reutilizar helpers existentes donde mantengan separación de responsabilidades. No expandir router HTTP con lógica de proveedor ni heredar la identidad CUSTOMER existente para CLERK sin delimitar permisos.

La migración debe tener un identificador libre posterior tanto a las migraciones locales de Bookings como a las remotas (máximo consultado 1793730000000). No retrofechar ni editar esas migraciones.

Un único resultado funcional futuro para PR hacia develop: persistencia y lector con specs/código/pruebas. Sin PR por este documento. En esta sesión no commit, push, merge, rebase, tag o cambio a main/develop.

## 11. Dependencias actuales y propuestas posteriores

El diseño del lector de PR #46 no requiere otra aprobación genérica de Shirley. El esquema interno UNKNOWN/NOT_RECEIVED/RECEIVED y restricciones de esta spec son una propuesta técnica concreta para revisar antes de implementación, no estados de workflow decididos en una respuesta humana.

Viajes comercializables ya publicados e integrados por PR #49 en origin/develop 1daa3c4; no seguir diciendo que la API no existe. No implica que esta rama de Leslie ya la consume ni adaptación de cotización/inventario. No se amplía este incremento para conectarlos.

Recepción/expiración, versiones, venta/liberación, acreditación, corrección/caja e invitado permanecen separados. El lector no autoriza por sí solo ninguna escritura posterior.

## 12. Diseño y usabilidad

Dominio JavaScript estándar, aplicación con puertos mínimos, infraestructura dueña de SQL y composición pública en index.js. Sin dependencias cíclicas ni repositorios de Payments prestados. No se agrega una clase por campo o un framework.

Sin interfaz nueva; DESIGN.md no requiere cambios en este incremento. La UI existente y su temporizador conservan carácter informativo; no se afirma nueva QA visual. Ningún defecto académico introducido; aplicar errores-inducidos.md.

## 13. Evidencia de preparación

2 de noviembre: rama y cambios locales inspeccionados; fetch de origin, PR accesibles y contrato/consumidor revisados; esquema/historia de migraciones y código de creación/identidad contrastados. Se conserva c7ceed9 y todo el trabajo previo. Preparación solo Markdown, sin ejecutar SQL ni suites de producto.

La búsqueda de PR de Bookings no encontró proveedor equivalente publicado entre los resultados relevantes. No acredita ausencia de código privado de otros integrantes. La tarea continúa sobre el trabajo local existente.

## 14. Puerta de implementación, revisión y cierre

Pasos A–C autorizados por Leslie e implementados/verificados localmente. Próxima acción: revisión humana del código y coordinación de integración autorizada. No pedir de nuevo firma, contexto o errores ya seleccionados en PR #46. No interpretar esta redacción como autorización de escrituras de pagos.

Después: implementar, ejecutar comprobaciones reales, actualizar resultados y solicitar revisión humana del incremento. Integración/cierre requieren evidencia de commit/PR autorizados y pruebas posteriores; no se declaran al terminar una sesión. No se inventa fecha de publicación ni entrega exitosa para el 4 de noviembre.
## Resultado de implementación A–C — 2 de noviembre de 2026

Leslie autorizó expresamente pasos A–C en este chat. Migración nueva 1793740000000, captura atómica del contexto original, UNKNOWN histórico, restricciones/inmutabilidad, lector con filtros por dueño/tenant y API pública paymentQueries implementados. Inicio/duración se capturan directamente del contexto validado antes de esperar ocupaciones; la prueba de mutación durante await confirma que no se alteran.

[Evidencia y uso](../reservas-lector-pagos.md). Resultado final: npm run lint aprobado; npm test 839 unitarias + 206 integraciones = 1045 aprobadas en 68 suites. De ellas, 66 unitarias y 18 integraciones nuevas. Arranque real y Auth/sesión/revocación comprobados. Compatibilidad con consumidor PR #47 cargado desde Git en memoria y PostgreSQL: 9 comprobaciones aprobadas; no conexión de rutas productivas ni integración de ramas.

Formato de los 10 JS modificados/nuevos aprobado; formato global falla en 24 archivos ajenos. Prueba antigua de reversión de idempotencia adaptada únicamente para bajar hasta su migración objetivo y restaurar después; conserva todas las aserciones previas y añade control de historial. Primera suite global falló por su supuesto de “última migración”; repetición final completa aprobada. Historial de intentos/entorno en la guía. Sin dependencias nuevas ni migraciones anteriores editadas.

T01–T18 tienen evidencia distribuida entre las pruebas nuevas y las suites anteriores conservadas. F11 de workflow en revisión no se declara implementado; semilla RECEIVED solo verifica restricciones/lector. Ninguna operación pública de recepción/venta/liberación creada. La historia UNKNOWN no se concilia automáticamente ni se oculta como false. Down/up pierde metadatos nuevos expresamente; down incompatible falla sin cambiar datos.

Código local sin commit ni PR. Pendiente revisión humana, autorización/publicación cuando corresponda e integración real con Payments. No cierre ni despliegue. Retirada confirmada: contenedor y red del proyecto busesuta-leslie-lector eliminados; sin recursos propios restantes.
