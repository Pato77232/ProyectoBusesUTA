# test(pagos): verifica lectura con el proveedor real de reservas

Añade una prueba de contrato explícita para conectar el consumidor ca63a36 a la
API pública real de Bookings del snapshot 901d308, con Auth, PostgreSQL y archivos
privados reales. Sustituye la evidencia anterior limitada a un lector controlado
por una comprobación de compatibilidad entre estas dos revisiones.

Incluye script tests/contracts/real-bookings-payment-review.cjs, comando npm
test:contract:bookings, inclusión de CJS en lint y evidencia reproducible. El
snapshot se obtiene con git archive, se monta de solo lectura y usa sus
migraciones originales; no se incorpora código de Bookings ni cambia src.

12 grupos aprobados: DTO/total/plazo persistidos, contexto/roles, aislamiento,
límites temporales, lecturas sin efectos, archivos privados e integridad 500.
Regresión en base separada: 1317 unitarias y 388 integraciones aprobadas. Lint,
formato propio y diff aprobados; formato global mantiene 17 archivos previos.

No activa producción ni acredita recepción/venta/expiración. Los registros de
reservas y recepción son fixtures exclusivos de QA. Revisión humana pendiente.

Depende de PR #55. Base de la PR: develop, conforme a las convenciones. Publicar
en borrador mientras #55 siga abierta: la comparación incluirá también su commit
ca63a36. Integrar primero #55 y revisar nuevamente el diff antes de integrar este
ensayo. Revisor: Pablo. Asistencia de IA en prueba/documentación.

Evidencia: docs/evidence/PAGOS-02/2026-11-03-contrato-real.md.
Refs: docs/specs/PAGOS-02.md

## Verificación actualizada para la conciliación con develop

Base verificada: develop c95cc732b7a895fc3f4d1b00f39aa1dd9fb2345e, con #54, #55, #60 y #62 integradas. El contrato real con snapshot actual terminó con salida 0 y 12 grupos aprobados. La regresión del candidato pasó con 1747 unitarias y 545 integraciones; lint y Prettier de los archivos propios aprobaron. format:check global reportó 17 archivos previos de Route Sheets y se conservaron sin cambios. Revisión humana de Pablo y CI pendientes; la PR sigue en borrador.
