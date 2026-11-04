# BOOK-07: uso de la API de confirmación de Bookings

4 de noviembre de 2026. Incremento local en feature/BOOK-07-confirmacion-venta, sobre df3370b. API de módulo del servidor, sin endpoint nuevo ni autorización por conocer tres IDs. Proveedor productivo de intención de Payments y conexión de aprobación todavía no publicados; la API de Bookings no prueba esa integración.

## Construcción

createBookingsModule expone createPaymentSaleConfirmer({approvalSource}). approvalSource debe ser una función interna de la composición confiable que consulte la API pública real de Payments. No tiene valor por defecto, no usa adaptador simulado y no se recibe en el body HTTP. La fábrica falla si falta esa función.

Ejemplo de consumo (requiere implementar/importar antes la consulta real de Payments):

```js
const saleConfirmer = bookings.createPaymentSaleConfirmer({
  approvalSource: readAuthorizedVersionedIntent,
});
const result = await saleConfirmer.confirmSale({
  bookingId,
  cooperativeId,
  paymentProofId,
});
```

readAuthorizedVersionedIntent es el nombre ilustrativo del adaptador de composición, no una función disponible en Payments ni una nueva firma acordada para ese módulo. Shirley puede publicar su consulta con los nombres de su API; el adaptador debe entregar los datos canónicos siguientes, sin importar repositorios privados ni compartir clientes SQL.

## Entrada y fuente

confirmSale recibe exactamente {bookingId, cooperativeId, paymentProofId}, textos opacos no vacíos conservados sin recorte. No admite proofVersion, actor, propietario, importe o rol del navegador. La fuente recibe una copia congelada de los tres identificadores; devuelve exactamente:

```json
{
  "bookingId": "reserva-qa",
  "cooperativeId": "cooperativa-qa",
  "paymentProofId": "comprobante-qa",
  "proofVersion": 1,
  "requestedBy": "oficinista-qa",
  "requestedAt": "2026-11-04T14:02:00.000Z"
}
```

Datos ficticios. proofVersion entero seguro positivo, actor no vacío, fecha ISO UTC canónica con milisegundos. Los nombres son representación interna de Bookings; un adaptador deberá proyectar/convertir el DTO público de Payments si difiere. No adjuntar archivos, rutas, tokens, sesiones ni datos de pasajero a esta respuesta.

Responsabilidad de la fuente real: probar intención persistida obtenida por flujo autorizado, vínculo de reserva/cooperativa/comprobante, actor/fecha originales y versión del contenido bloqueada transaccionalmente. No basta UPLOADED ni existencia de archivo/actor. El bloqueo permanece con resultado pendiente o incierto. Actor en texto y una función cualquiera de tests no acreditan permiso de producción. La revisión del importe transferido pertenece a Payments/oficinista según contrato, y el total esperado proviene de Bookings; esta API no verifica bancos ni recalcula tarifas.

Consulta obligatoria en cada llamada, también al repetir una venta: sin fuente verificable no se consulta/expone resultado por tres IDs solos. Ante caída después de COMMIT, se conserva incertidumbre hasta que la fuente vuelva a responder; no se compensa la posible venta.

## Resultado

Devuelve solo resultado persistido, copiado/inmutable, después de COMMIT: mismos tres vínculos, proofVersion, requestedBy, requestedAt, currency USD, totalPriceCents y confirmedAt ISO UTC. No retorna true: la traducción a true pertenece al adaptador de Payments y solo tras recibir este resultado verificado.

Reintento válido devuelve el original aunque haya pasado el plazo inicial, sin reevaluar reloj/precio o cambiar actor. Otra versión/vínculo no es repetición. Pago con recepción aceptada conserva asientos durante revisión; la venta los mantiene SOLD/active y expiración no los libera.

## Errores y traducción acordada

| Código de Bookings | Significado | Adaptación de Payments |
| --- | --- | --- |
| BOOKING_VALIDATION_ERROR | Forma de llamada inválida, sin acceder a fuente/repositorio | Error de entrada interna; no aprobar |
| BOOKING_SALE_NOT_CONFIRMABLE | Reserva ausente o estado no confirmable | BookingSaleRejectedError |
| BOOKING_SALE_LINK_MISMATCH | Vínculos incompatibles | BookingSaleRejectedError |
| BOOKING_SALE_VERSION_MISMATCH | Versión distinta de la venta previa | BookingSaleRejectedError |
| BOOKING_SALE_DATA_INTEGRITY_ERROR | Fuente/registro incoherentes, sin resultado verificable | BookingSaleUncertainError; revisar integridad |
| BOOKING_SALE_UNAVAILABLE | Fuente ausente/caída, resultado ausente o fallo técnico/COMMIT incierto | BookingSaleUncertainError; reintentar mismo intento |

La traducción es el contrato, no un adaptador productivo nuevo implementado por esta documentación. Payments no debe importar clases internas de Bookings; puede interpretar los códigos documentados y lanzar sus clases propias. false/null no son confirmación; el caso de uso de Bookings rechaza resultados no verificados del repositorio.

Un rechazo de la solicitud de confirmación no equivale a marcar el comprobante REJECTED ni liberar asientos. Rechazo justificado/liberación pertenecen a su operación separada. Comprobantes antiguos sin versión acreditada no reciben un 1 automático: se conservan para conciliación, manteniendo bloqueos existentes.

## Composición y limitación actual

La composición futura necesita una fuente pública de Payments construible antes de vincular su caso de uso de aprobación, como factoría/consulta separada por API pública. Crear Bookings, construir su confirmador con esa fuente y entregar el confirmador al módulo de Payments sin SQL privado ni ciclos de inicialización. No fijar aquí el nombre de una función que Shirley todavía no ha publicado.

No se cambia server.js ni createPaymentsModule para fabricar una fuente desde columnas antiguas sin versión. La aprobación actual de Payments sigue con confirmador simulado, una limitación preexistente que esta API no presenta como flujo real terminado. La conexión productiva requiere rama/commit del proveedor versionado, persistencia/bloqueo y adaptador de aprobación de Shirley. Leslie confirmó que no tiene esa implementación compartida.

## Comprobación

Unitarias del caso de uso: validación/copia, errores seguros, fuente en cada intento, histórico sin versión y resultado booleano/malformado no son venta. Integración public-sale-api.test.js construye la API pública y persiste ventas en PostgreSQL real. Usa una fuente QA explícita almacenada en esquema aislado, no el proveedor productivo de Payments ni una prueba de autenticación de oficinista. Prueba concurrencia mediante bloqueo PostgreSQL observado, recuperación por otra instancia, COMMIT real perdido y ausencia de escrituras ante fuentes inválidas.

Los resultados de ejecución se registran en la evidencia, sin CI o aprobación humana inferidos. Sin frontend, migraciones nuevas o dependencias en este incremento. Conexión pendiente antes de presentar PR como compra/aprobación completa.
