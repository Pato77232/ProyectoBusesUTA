# BOOK-03 T3 R: recuperación idempotente de creación

- Responsable: Leslie Coello. Revisor propuesto: PabloToapanta.
- Fecha: 29 de octubre de 2026. Especificación previa al código.
- Autorización: Leslie pide continuar los pendientes del plan; el paso anunciado es recuperar una creación tras pérdida de conexión. Mantener un solo PR funcional de BOOK-03 hacia develop y commits por tarea en español.
- Rama: feature/BOOK-03-resumen-creacion-dominio, base local 98ecaff. origin/develop consultado en f26415d; cambios remotos no incorporados aún. Aplicar AGENTS.md, arquitectura, calidad y reglas RN-02/40/42/43/50.

## Comportamiento

Una clave UUID v4 canónica en minúsculas identifica un intento de compra del comprador autenticado. Es referencia de reintento, nunca credencial. La futura pantalla la genera una vez antes del primer envío y la conserva ante timeout; una compra distinta requiere una clave nueva. Transporte HTTP y persistencia del lado cliente se resolverán en T4; no guardar datos personales en logs o almacenamiento del navegador por este incremento.

createBooking acepta opcionalmente requestKey para consumidores internos existentes. Cuando está presente, exige UUID v4 válido y activa reserveOnce; una clave presente inválida (incluido undefined/null) rechaza antes de proveedores. El flujo HTTP futuro debe exigirla, no usar la ruta antigua sin protección. La ruta privada sin clave mantiene el comportamiento previo para compatibilidad y sus pruebas.

El comprador se vuelve a resolver en cada llamada mediante buyerIdentity.resolve(authContext). Nunca se recupera por clave sola ni por propietario del body. Para la compra de CUSTOMER, la clave queda vinculada globalmente dentro de su propietario, aunque compre a varias cooperativas. La lectura de recuperación filtra por owner_id verificado y clave exacta; obtiene cooperativa/viaje de esa reserva, no del cliente. No habilita consultas internas CLERK sin tenant ni acceso a otro comprador.

Huella SHA-256 versionada de la solicitud copiada: viaje/tramo, orden de selección de asientos, pasajeros por campos explícitos en orden estable de asiento y revisión aceptada. No registrar la huella como acreditación ni aceptar precios del cliente. Cambiar pasajeros, viaje, tramo, asientos o revisión con la misma clave produce BOOKING_REQUEST_KEY_REUSED. Cambiar orden de propiedades JSON o de la lista de pasajeros sin alterar asignaciones no genera conflicto artificial.

## Transacción y esquema

Migración nueva posterior a T2: añadir a bookings creation_request_key UUID nullable y creation_request_fingerprint text nullable con validación de 64 hexadecimales minúsculos, ambas presentes o ambas ausentes y unicidad (owner_id, creation_request_key). No editar migraciones previas, no tabla de claves con PII duplicada. No exponer estos metadatos en la respuesta privada.

reserveOnce({ownerId, requestKey, requestFingerprint}, locate, prepare) abre transacción READ COMMITTED y obtiene bloqueo asesor transaccional con hash PostgreSQL de la pareja JSON [ownerId, requestKey]. No requiere extensión; colisiones solo serializan de más, la autorización usa valores exactos. Orden fijo: bloqueo de intento, luego bloqueo de inventario T2. No hay ruta de inventario que tome después el bloqueo de intento.

Bajo ese bloqueo busca la reserva por propietario/clave: si coincide la huella, devuelve la representación privada persistida (estado actual), ID, total y fechas originales, sin volver a ejecutar catálogo, acreditación, reloj de pago, newId o escritura. No prolonga plazo ni reactiva una reserva. Si cambia la huella, conflicto sin nueva ocupación.

Si no existe, locate resuelve cooperativa/viaje del catálogo real; se adquiere bloqueo T2 y prepare(scope) relee contexto/resumen como T3. Verificar que el propietario preparado coincide con la operación. Reserva, todas las ocupaciones y metadatos del intento se insertan en la misma transacción. Ninguna clave se consume cuando la transacción revierte. Un fallo de COMMIT es resultado desconocido: no afirmar rollback ni repetir con clave nueva; la siguiente llamada con la misma clave y autorización resuelve qué quedó persistido.

La representación recuperada no consulta catálogo, aun si este cae o el viaje deja de estar comercializable después del éxito. Esto recupera la reserva existente; no permite crear una nueva con precios viejos. Una misma clave de otro propietario no revela la compra anterior y sigue las validaciones normales de una compra nueva.

## Pruebas

- Unidad: clave inválida antes de proveedores; huella determinista y sensible a cambios; ruta sin clave conserva contrato; operación usa propietario verificado y copia entrada antes de esperas; errores no se ocultan.
- PostgreSQL real: pérdida de respuesta después de COMMIT y recuperación desde instancia nueva del repositorio/caso de uso; no doble escritura, mismo ID/total/plazo aunque reloj y precios cambien; proveedores caídos no impiden recuperar con identidad válida.
- Dos solicitudes concurrentes misma clave/datos esperan bloqueo asesor, ejecutan preparación una sola vez y obtienen mismo ID.
- Misma clave/datos distintos, incluso otra cooperativa o viaje: conflicto; propietario distinto no obtiene reserva ajena.
- Dos claves distintas por mismos asientos: una reserva y un conflicto, manteniendo coordinación T2.
- Fallo en segundo asiento y fallo en COMMIT antes de enviarlo: rollback sin clave consumida, reintento posterior puede crear.
- No permitir colgar metadatos de un propietario sobre otro. Migración reversible/reaplicable y restricciones verificadas.
- La prueba previa de reversibilidad de T2 supone que su migración es la última. Añadir recorrido por nombre objetivo conservando todas sus aserciones; no borrar ni debilitar pruebas.
- Ejecutar lint, formato, npm test con base PostgreSQL exclusiva y registrar resultados reales. Sin cambios de composición, dependencias ni secretos.

## SOLID, usabilidad y alcance

Dominio define clave/huella/errores; aplicación coordina identidad y solicitud; infraestructura mantiene atomicidad y bloqueos. Reutilizar el guardado T2 en vez de duplicar SQL. Puerto estrecho documentado, sin importar capas internas ajenas.

Sin pantalla en este incremento. T4 deberá informar resultado recuperado, conservar plazo y clave ante respuesta desconocida, y pedir clave nueva solo para compra nueva o resumen modificado. No se publica PR por este paso, ni se declara completada la API/pantalla/proveedores reales. Pagos/expiración siguen en sus propias entregas.


## Resultado verificado — 29 de octubre de 2026

Implementado localmente: clave UUID v4 validada, huella canónica, reserva recuperable por propietario autenticado, bloqueo asesor del intento antes del bloqueo de inventario y metadatos atómicos en nueva migración 1793232000000-booking-creation-idempotency. La escritura original y reserveOnce comparten el guardado transaccional; no se duplicaron reglas de disponibilidad.

53 pruebas nuevas: 32 unitarias y 21 de integración con PostgreSQL real. Las 44 pruebas de integración de reservas pasaron juntas, conservando las anteriores. Se verificaron respuesta perdida después de COMMIT, recuperación con instancia nueva y proveedores caídos, conservación de plazo/total, concurrencia de igual clave y de claves distintas, reutilización con datos distintos, aislamiento de comprador, rollback antes de COMMIT y tras fallo de segundo asiento, restricciones de base y reversibilidad del esquema.

npm test completo aprobado: 725 unitarias y 151 de integración = 876 pruebas, 58 suites. npm run lint aprobado. Formato de todos los archivos nuevos/modificados aprobado; format:check global falla en los mismos 27 archivos preexistentes ajenos. Se conservaron las aserciones de reversibilidad de T2 y se agregaron diez líneas para encontrar su migración objetivo antes de revertir. No se editaron migraciones previas, dependencias, pruebas de otros módulos ni app.js/server.js.

Base aislada nueva busesuta_test/test_user en Compose busesuta-leslie-book03-reintentos. Se comprobaron cero tablas antes de migrar y se retiraron exclusivamente su contenedor y red al terminar. No se leyó .env ni se utilizaron bases de otros proyectos. Los proveedores de identidad/catálogo/acreditación de pruebas son dobles explícitos; transacciones y SQL son reales.

La reversión de la migración conserva reservas y asientos pero elimina sus metadatos de reintento; reaplicarla no recupera claves anteriores. La compatibilidad privada sin requestKey sigue sin recuperación automática. T4 deberá exigir clave, autenticar y proteger con CSRF; catálogo/plantillas/acreditación reales, interfaz y actualización de base con develop siguen pendientes. Sin PR nuevo ni aprobación humana por este incremento.
