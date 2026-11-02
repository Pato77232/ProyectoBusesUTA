# PAGOS-02 §17: adaptador consumidor del lector

- Fecha: 2 de noviembre de 2026, America/Guayaquil.
- Rama local: `feature/PAGOS-02-aprobar-comprobante`, HEAD `4e6bbf7`, conservado.
- Alcance autorizado: [PAGOS-02 §17](../../specs/PAGOS-02.md#17-adaptador-consumidor-del-lector-decidido-en-pr-46), tras la solicitud humana de continuar trabajo y preparar PR.
- Contrato: [PR #46, ad74d25](https://github.com/Pato77232/ProyectoBusesUTA/blob/ad74d25eae8163094a287a2d4b854ddb04b036c6/docs/contratos/lectura-reservas-pagos.md). Revisión APPROVED de shirley6126 comprobada por GitHub sobre ese commit: conformidad documental del diseño, no implementación de proveedor o consumidor.

## Resultado del incremento

Se añadieron tres archivos: error seguro de consulta en dominio, adaptador de infraestructura y suite de 74 pruebas del contrato consumidor. El adaptador recibe paymentQueries por inyección; no importa internals de Bookings/Auth ni consulta sus tablas. No cambia controladores, casos de uso o index.js. Los 20 archivos backend premodificados mantienen sus SHA-256; tampoco se editó la suite HTTP añadida en la continuación anterior.

Se prepara el mapeo `totalPriceCents → total` y `canUploadProof → acceptsPaymentProof` con DTO mínimo e inmutable. No se interpreta createdAt como inicio: se valida proofWindowStartedAt/duración/vencimiento. Solo se reconoce el estado delimitado PENDING_PAYMENT; estados posteriores necesitan su contrato y pruebas. Null se conserva y la defensa ante propietario/tenant ajenos no entrega datos. La futura bandeja debe tratar una relación ausente como integridad, sin adaptar todavía su catch anterior.

El adaptador no autentica un objeto por su forma: exige contexto por llamada y proyecta los tres campos seleccionados. Su futura conexión debe recibirlo desde Auth verificado. No conserva tokens/contexto como autorización durable, no reintenta automáticamente ni acepta una escritura por una lectura previa. Bookings continúa siendo autoridad de recepción/expiración y de los datos persistidos.

## Pruebas y resultados reales

Windows, Node 24.15.0, npm 11.6.1 y PostgreSQL 16.13-alpine ya disponible. Contenedor exclusivo `pagos02-reader-qa-20261102`, base busesuta_test, puerto local dinámico 63289 y datos PostgreSQL en memoria. Retirado después de las pruebas; no se usó la base de desarrollo ni se leyeron archivos .env.

| Comprobación | Resultado |
| --- | --- |
| Suite dirigida del adaptador | 74/74 aprobadas; 1,299 s. |
| Desde backend, npm run lint | Aprobado, salida 0. |
| Desde backend, npm run format:check | Fallido, salida 1; mismos 48 archivos ajenos al incremento. |
| Prettier del incremento completo desde la base común, incluidos archivos nuevos y pruebas (32 JS) | Aprobado. |
| Desde backend, npm test completo | 45 suites / 668 unitarias y 14 suites / 134 integraciones aprobadas; 802 total, salida 0. Tiempos: 6,021 s y 52,445 s. |
| Conservación del trabajo previo | Los 20 archivos backend premodificados/no seguidos permanecen idénticos al snapshot anterior. |

Los 74 casos cubren API explícita, contexto mínimo, propósitos/roles/tenant, IDs opacos, DTO/privacidad, nulos, límite temporal, duración, importes/moneda, fechas, estado soportado y traducción de errores por el middleware HTTP real. El arnés HTTP de errores no es un endpoint de producto ni autentica solicitudes: las 14 pruebas HTTP anteriores ejercitan Auth/Payments reales con PostgreSQL y Reservas simulado.

No hubo fallo funcional en esta ejecución. Los intentos fallidos de sesiones anteriores conservan su evidencia histórica; no se reatribuyen a este adaptador. El formato global fallido no es una excepción académica autorizada ni se declara aprobado. No se repitió el arranque productivo porque no cambia composición y el adaptador no está conectado; los resultados anteriores de arranque conservan su fecha/alcance.

## Estado remoto y límites de revisión

GitHub comprobado: develop `3d053a48c7715ae876f9f16947ce15d640ded508`, PR #45 integrada y PR #46 abierta/fuera de borrador, con aprobación documental de Shirley. La colección de PR abiertas mostraba #44 y #46, ninguna de PAGOS-02. La comparación desde la base común `518c46b` muestra 80 commits posteriores en develop, sin cambios backend de Payments, pero sí composición y documentación compartida. No se incorporó ni se probó esa combinación. No hay proveedor público de lectura de Leslie acreditado por estas consultas.

Esta evidencia prueba el adaptador contra un doble del contrato publicado, no una reserva real, sesión verificada entre módulos, recepción aceptada, venta o recuperación durable de Bookings. El código anterior de carga/listado sigue con su firma previa y adaptadores simulados. No se presenta el adaptador nuevo como activado ni como implementación completa del contrato de lectura.

Comprobación final: PR #46 avanzó a `782f54a` para conciliar documentación con develop `3d053a4`; se revisó el delta y no modifica el contrato seleccionado en `ad74d25`. No se atribuye una aprobación nueva de Shirley sobre ese commit posterior. La verificación documental de diez archivos comprobó 89 enlaces locales sin destinos inexistentes y `git diff --check` aprobado; no valida anclas o enlaces externos.

Revisor principal: Pablo (@PabloToapanta), quien aceptó revisar PAGOS-02. Leslie: revisión complementaria propuesta de compatibilidad del contrato de Reservas, sin aceptación de una segunda revisión obligatoria registrada. Ninguna aprobación de PR #46 aprueba por anticipado este código.

Siguiente incremento: Leslie publica proveedor/persistencia y su spec/pruebas; Shirley adapta explícitamente controladores, casos de uso y composición al contexto nuevo, elimina la dependencia del lector simulado para esa conexión y verifica ambos módulos. Recepción/venta, versiones e importe observado conservan sus contratos propios; no se implementan como consecuencia de este adaptador.

## Preparación de PR

[Descripción detallada y reparto de revisión](descripcion-pr.md). La descripción cubre el trabajo acumulado de PAGOS-02 y distingue funcionalidad local, simuladores y adaptador preparado. Debe contrastarse con el diff que la persona seleccione/publique. No usar selección global de todos los archivos: CORR-01/CAJA-01 son borradores de planificación separados; al separarlos, revisar también sus referencias en el registro compartido para no publicar enlaces a archivos ausentes.

No se ejecutaron commits, push, merge, rebase ni tags. Sin dependencias nuevas, cambios de migraciones existentes, secretos, frontend o comunicación a terceros. Asistencia de Codex en implementación del adaptador, pruebas y documentación. Revisión humana e integración pendientes.
