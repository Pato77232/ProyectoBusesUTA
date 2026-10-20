# Decisiones de reservas — Leslie

Fecha: 20 de octubre de 2026. Leslie autorizó al asistente a seleccionar las decisiones pendientes basándose en Ecuador. No equivale a aprobación del contrato de otro integrante ni a certificación legal de la aplicación.

## Tarifas y acreditación
- Política del proyecto: 50 % para pasajeros menores de 18 años, personas de 65 años cumplidos o más y personas con discapacidad acreditada. Aplicar una sola reducción del 50 %, sin acumular categorías. La edad se calcula en la fecha local de salida del viaje, no en la fecha de compra.
- Fuentes oficiales consultadas: [Reglamento de transporte, art. 46](https://www.gob.ec/sites/default/files/regulations/2019-12/REGLAMENTO_A_LA_LEY_DE_TRANSPORTE_TERRESTRE_TRANSITO_Y_SEGURIDAD_VIAL.pdf), que contempla tarifa reducida para niñez/adolescencia; [Ley de personas adultas mayores, art. 13](https://www.defensoria.gob.ec/wp-content/uploads/2019/06/Ley_organica_de_las_personas_adultas_mayores.pdf); [Ley de personas con discapacidad de 2025, art. 87](https://www.asambleanacional.gob.ec/es/system/files/ro_12.pdf). Son base para la política académica, sin inventar una integración con Registro Civil ni MSP.
- Datos declarados de edad o discapacidad no son acreditación oficial. La aplicación necesitará un verificador inyectado o revisión por personal autorizado antes de confirmar una tarifa preferencial. En pruebas se usan verificadores simulados y datos ficticios, identificados como tales. No bloquear toda reserva por no tener un servicio externo: ofrecer revisión asistida sin presentar al pasajero como verificado.
- Moneda USD. Calcular en centavos enteros; redondeo de mitad hacia arriba por pasajero después de sumar sus tramos. Registrar base, descuento y total, con regla aplicada. Esa es una decisión de cálculo del proyecto.

## Pasajeros e invitados
- Cédula: cadena de 10 dígitos y comprobación local de dígito verificador para documentos de persona natural; conservar ceros iniciales. Validar estructura no prueba identidad, titularidad, edad ni discapacidad. No consultar fuentes no autorizadas ni rechazar documentos extranjeros mediante una regla de cédula ecuatoriana: su soporte necesita una tarea delimitada.
- Pasajero: nombre completo, cédula, fecha de nacimiento y acreditación cuando corresponda. Un pasajero por asiento. No registrar documentos en logs ni devolverlos en listados públicos.
- Invitado: nombre y correo de contacto, sin crear una cuenta automáticamente. Recuperación mediante enlace secreto de alta entropía enviado al correo; guardar únicamente hash, no permitir acceso solo con cédula o UUID. Expiración y reenvío limitado del enlace se implementarán con correo y autenticación, sin fingir entregas de correo.

## Reserva y pago
- Para depósito/transferencia: plazo inicial de 5 minutos configurable entre 3 y 5. Comienza al aceptar el resumen y crear la reserva en el servidor. El dominio exige un valor explícito; el futuro adaptador configura el inicial.
- Comprobante recibido dentro del plazo: mantener los asientos reservados mientras el oficinista revisa. No liberar por transcurrir el plazo inicial y no marcar vendidos antes de aprobar.
- Sin comprobante al vencimiento: expirar y liberar de forma transaccional.
- Rechazo: exigir justificación; finalizar la reserva como rechazada y liberar sus asientos atómicamente. Para volver a intentar, crear una reserva nueva y revalidar disponibilidad/precio. Esta es una política del proyecto, no un plazo impuesto por la ley.
- Comprobante tardío: no reactivar una reserva vencida ni desplazar otra reserva. Responder conflicto e indicar atención por personal si hubo transferencia real; no afirmar devolución automática.
- Aprobación: venta idempotente, coordinada con pagos/boletos. Comprobante y expiración deben competir mediante una condición transaccional común.
- No hay un plazo automático de rechazo mientras se revisa; ese tiempo corresponde al proceso operativo. La pantalla muestra revisión pendiente.

## Dependencias reales pendientes
No existe en la base revisada una API de viajes, inventario de asientos ni servicio de comprobantes. Se puede implementar y probar el dominio, pero no publicar una reserva funcional con inventario o pagos inventados. La disponibilidad real, persistencia con referencias y pantallas conectadas dependen de esos contratos.

Estas decisiones cierran las preguntas de producto de BOOK-01/04/05/06/07/08 que no dependan de contratos ajenos. Prevalecen sobre los párrafos iniciales que las marcaban pendientes. Las tareas T1 delimitadas pueden implementarse por separado; la validación completa de pasajeros es una tarea posterior a su objeto mínimo.
