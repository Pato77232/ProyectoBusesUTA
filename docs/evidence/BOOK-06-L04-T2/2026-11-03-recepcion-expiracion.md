# BOOK-06-L04-T2: recepción y expiración coordinadas

## Base y alcance

3 de noviembre de 2026. Rama local feature/BOOK-06-recepcion-expiracion desde f0a9c2f, sin commits nuevos ni publicación. PR #51 y su rama publicada permanecen intactas. Origin/develop contrastado en 1a411ef; no se incorpora a este trabajo local. Los cambios posteriores de Pagos en develop no aportan el proveedor de recepción. La delegación real de Leslie se registra en la spec §11; no se inventan aprobaciones individuales de Pablo/Shirley.

Incremento B: nueva migración 1793910000000-booking-proof-receipts, catálogo de 20 entradas, resultados durables por comprobante, dominio y dos casos de uso, repositorio PostgreSQL y capacidades públicas de composición interna. Lector y adaptador preparado admiten EXPIRED con carga deshabilitada. Las migraciones ya confirmadas no cambian. No hay dependencias nuevas, nuevas rutas HTTP ni temporizador.

El puerto receiptSource es obligatorio y su implementación productiva sigue pendiente. Las pruebas lo implementan con una tabla QA persistida en esquema aleatorio; no es una API de Payments ni una credencial Auth. No se declara conexión productiva, aprobación de venta o liberación por rechazo.

## Comprobaciones y resultados

- PostgreSQL 16.13 aislado, proyecto exclusivo busesuta-leslie-recepcion, puerto 55433, tmpfs; sin bases persistentes ni lectura de .env.
- Primera ejecución de recepción: 19/21. Dos fallos de la barrera QA: solo contaba bloqueos directos y dejaba operaciones pendientes al fallar, interfiriendo con la limpieza siguiente. Se corrigió el observador para incluir la cadena real de bloqueos y esperar todas las operaciones antes de propagar el error. Se mantienen las dos operaciones concurrentes, sus aserciones y los límites originales.
- Repetición dirigida de recepción y catálogo: 34/34 aprobadas. La suite de catálogo verifica base vacía, copia de develop con datos/VIP conservados, historial inesperado sin cambios y rollback DDL.
- Backend unitario: 1657/1657, 85 suites. Lint aprobado. Formato global conserva los 17 archivos ajenos ya documentados; no se reformatean.
- Frontend: lint y 181/181 aprobados. Solo se ajusta la limpieza de la fixture de navegador por la nueva FK; no hay cambio de interfaz.
- npm test completo: 1657 unitarias + 514 integraciones = 2171 aprobadas, 124 suites, salida 0. Integración duró 276,846 s. Incluye arranque real: health 200 y disponibilidad 503 sin proveedor real, sin simular compra exitosa. Fotografías aprobadas en esta ejecución, sin cambiar timeout ni aserciones.
- Después se añade el caso exigido de dos expiradores concurrentes con barrera PostgreSQL: ambos recuperan exactamente el mismo expiredAt, dos ocupaciones inactivas y ningún resultado de recepción ficticio. Repetición dirigida: 22 integraciones de recepción + 16 unitarias de catálogo = 38/38 aprobadas. No se vuelve a atribuir el conteo global anterior a una suite completa con este caso adicional.
- Formato aplicado solo a cuatro fixtures modificadas cuya línea TRUNCATE se alargó; ninguna aserción cambia. Lint repetido aprobado y formato propio de todos los JS modificados/nuevos aprobado. El control global conserva los 17 pendientes ajenos.
- Diff completo revisado, incluidas altas; git diff --check aprobado. Las migraciones ya confirmadas permanecen sin cambios. No se introducen defectos académicos.
- Limpieza comprobada: contenedor y red busesuta-leslie-recepcion eliminados; consultas por etiqueta devuelven cero recursos propios. Ningún servicio ajeno detenido.

## Límites y siguiente incremento

C debe implementar la consulta pública persistida de Payments, conectar la autorización inicial UPLOAD_PROOF con Auth real y traducir ACCEPTED/REJECTED_EXPIRED sin marcar entregado cualquier retorno ni borrar evidencia por errores de fuente/vínculo/timeout. El consumidor actual no se conecta directamente.

D debe definir y probar ejecución periódica y recuperación de candidatos tras reinicio. La recuperación idempotente de resultados entre instancias de B no equivale a ese planificador. Venta, rechazo justificado, corrección, caja e invitado conservan sus contratos separados.

Leslie autoriza guardar y publicar este incremento con su mensaje: «listo sigamos entonces con el commit y el push verdad ??». La revisión humana del código permanece pendiente. No se integra ni se cierra la tarea por pasar pruebas locales.
