# BOOK-08 — evidencia del incremento C, 4 de noviembre de 2026

## Contexto y alcance

Leslie autoriza continuar con guardado de verificación tras B. Rama feature/BOOK-08-acreditacion-web, base local 46a96a2, conservando cambios B sin commit. Fetch observa develop 432ae27 con registro web/política documental, sin incorporar esos cambios a esta rama ni rehacerlos. Se aplica guia-proyecto y spec §12. Sin commit/push/PR/merge nuevos.

Implementados revisión CLERK por solicitud/tenant, referencias privadas, versión 1→2, huella de intención y recuperación. INSERT en la fuente real booking_benefit_reviews y UPDATE de resultado en una transacción, con row lock; catálogo antes del lock para no agotar conexiones del pool; comparación de snapshot/revisión y ventana final con reloj de PostgreSQL. No se afirma atomicidad con cambios de frecuencia ni reserva de asientos; resumen/creación revalidan su catálogo.

Migración nueva 1794290000000-booking-benefit-request-reviews (entrada 32), sin editar B ni migraciones anteriores. Restricciones/trigger preservan contexto y revisión terminada. Se rechaza down con evidencia. No dependencias, frontend o timeout nuevos. D sigue pendiente.

## Pruebas dirigidas

- Primera ejecución unitaria combinada: 65 aprobadas/9 fallidas (74). El fixture nuevo usaba structuredClone con Date de otra instancia de VM de Jest, incompatible con la comprobación de tipo de fecha. Se cambió solo su copia a JSON/ISO como DTO válido, conservando la validación productiva y las expectativas. Segunda ejecución 74/74 aprobadas.
- Se añadió prueba de integridad de huella persistida; suite C final 28/28 aprobada. B y catálogo conservaron sus comprobaciones previas.
- HTTP real: 18/18 aprobadas, 8.704 s; incluye los diez casos B y ocho de C. Servidor/Auth/CSRF/Fleet/Frequencies/Route Sheets/PG reales. Una revisión válida permite el resumen con descuento configurado y una fecha no acreditada mantiene 409. Dos intentos iguales conservan una sola acreditación; dos oficinistas tienen un solo ganador; propietario no recibe evidencia/actor y bandeja no expone PII.
- Fallos de UPDATE y pérdida de respuesta después de COMMIT se inducen en un wrapper QA del cliente PG, con SQL/catálogo reales. Los actores de esos casos de persistencia usan contexto interno sintético con usuario leído de una sesión HTTP verificada; no sustituyen las pruebas separadas de autorización HTTP real. Rollback deja cero acreditaciones y solicitud pendiente; pérdida posterior a COMMIT conserva una acreditación y recuperación HTTP no la duplica.
- Unitarias B/C y migraciones B/C: 64/64, cuatro suites, 8.87 s (antes de añadirse el caso adicional de integridad, que aprobó después en la suite C de 28). Ambas migraciones conservan filas previas, se revierten cuando su estado lo permite y rechazan pérdida de datos/evidencia.
- Las pruebas propias de B se adaptan por nombre de migración al añadirse C; conservan down protegido y conservación de filas. La expectativa de revisión inexistente pasa a exigir 400 para comando vacío, ya que C implementa la ruta; se añaden casos reales de éxito y denegación. No se eliminan garantías, pruebas o límites históricos.

## Entorno

Node 24.21.0; PostgreSQL 16.13 efímero en leslie-book08-revision-pg, tmpfs, 127.0.0.1:55439 y busesuta_test. Bases aleatorias de pruebas de migración con guard de nombre y sufijo _test. No .env, secretos o bases persistentes del equipo. La referencia documental es QA; no se afirma comprobar autenticidad física de un documento con estas pruebas.

## Verificación global

- npm test final: aprobado, salida 0. Unitarias: 114 suites y 2049 pruebas, 11.229 s. Integración: 63 suites y 686 pruebas, 509.517 s. Total: 177 suites y 2735 pruebas. Los errores registrados durante escenarios de fallo no representan suites fallidas; todas las suites terminaron aprobadas.
- Lint y format:check global aprobados. No cambios de producto después de esta ejecución completa.
- Arranque real desde server.start: health 200, GET de solicitudes y POST de revisión sin sesión 401, ambos Cache-Control:no-store; stop ordenado. Solo PostgreSQL aislado, sin proveedor de correo ni datos reales.
- Revisión del diff completo: composición B, migraciones nuevas B/C y catálogo, aplicación/dominio/repositorio/router propios, pruebas y documentación. Las migraciones anteriores y timeouts no cambiaron; diff --check aprobado. Revisión de IA local no equivale a revisión humana.
- Base temporal retirada al terminar las comprobaciones; no se modificaron servicios persistentes ni los respaldos Git previos.

## Límites y consumo

[Contrato B/C](../../contratos/solicitudes-acreditacion.md). Revisión humana e integración pendientes. Sin pantalla, corrección de comprobantes, invitado, caja, archivos digitales, QR o correo. La API anterior mantiene su semántica y el verificador real sigue leyendo su última revisión: no se afirma impedir una revisión posterior de ese endpoint legado. No se requiere ni se almacena una sesión durable para reintentos.

## Autorización posterior

Tras la validación, Leslie autoriza commit y push de B/C en la rama de trabajo. Sin cambios funcionales posteriores a las 2735 pruebas aprobadas. Las menciones anteriores a trabajo sin commit corresponden al momento de comprobación. Revisión humana, pantalla D e integración siguen pendientes.
