# BOOK-06-L04-T2: actualización con develop para PR

3 de noviembre de 2026, America/Guayaquil. Leslie autoriza actualizar, comprobar y publicar feature/BOOK-06-recepcion-expiracion antes de crear la PR. HEAD previo 4233811; develop incorporado 5a40702. GitHub confirma PR #51 integrada por Leslie a las 17:48:31Z, con HEAD d56ae01. La consulta de PR propias abiertas no devuelve una PR de este incremento; no se inventa un número ni se crea una duplicada.

## Resolución y alcance

Un conflicto textual en docs/estado-proyecto.md. Se conservan los bloques completos de ambas ramas y su alcance histórico. Se actualiza la cabecera de BOOK-06-L04-T2 con la integración comprobada de PR #51; esa aprobación no equivale a revisión de este incremento.

La combinación no cambia el código de recepción/expiración ni sus migraciones respecto a 4233811. Catálogo activo de 20 entradas, originales intactos y validación estricta. Se conservan los comandos conjuntos de frontend y el empaquetado de Reservas/Comprobantes ya integrados. No dependencias nuevas, cambios visuales, proveedores simulados conectados ni planificador.

Se añade una regresión de actualización desde las 19 migraciones de develop con datos: reservas NOT_RECEIVED, RECEIVED y UNKNOWN, sus ocupaciones y filas representativas de otros módulos. La actualización debe conservar sus datos, añadir expired_at nulo sin inventar resultados y permitir repetir sin efectos. Se mantienen las pruebas de base vacía, historiales inesperados, conservación VIP y rollback anteriores.

## Verificación

Node 24.21.0 y PostgreSQL 16.13 temporal exclusivo busesuta-leslie-book06-base, tmpfs y puerto 55433. Base principal busesuta_test y segunda base busesuta_book06_browser_test para Chrome, evitando competir con la limpieza de la suite global. No .env ni bases persistentes.

- Backend unitario: 1658/1658, 86 suites. Lint aprobado.
- Format:check global conserva los 17 archivos ajenos ya documentados. No se reformatean.
- Frontend: lint y 205/205 aprobadas, con Reservas y Pagos incluidos.
- Nginx real reconstruido: configuración, usuario, recursos/MIME de ambas pantallas, exclusiones y 404 aprobados; comprobador limpia su contenedor/red.
- Chrome: ocho grupos aprobados, con Auth/API/PostgreSQL reales; catálogo/acreditación son fixtures. Comprueba sesión, tarifa actualizada, respuesta perdida y recuperación, revocación y error de proveedor. No acredita conexión comercial productiva ni nueva inspección visual de las capturas.
- npm test completo, salida 0: 1658 unitarias (86 suites) + 515 integraciones (39 suites) = 2173 aprobadas, 125 suites. Integración 275,337 s, incluido arranque real y fotografías con timeout/aserciones originales.
- Regresión de actualización añadida después de iniciar la suite global: catálogo ampliado 14/14 aprobado, 26,752 s. El caso nuevo comprueba todas las filas previas, ventanas/recepción y tres ocupaciones, expired_at nulo y resultados vacíos; reintento sin cambios. Este caso adicional no se incluye retroactivamente en el conteo global de 515.
- Lint repetido aprobado tras añadir la regresión; formato propio de todos los JS del diff contra develop aprobado. No se debilitan pruebas ni se amplían timeouts.
- Diff completo revisado, git diff --check y comprobación de staging aprobados. Sin archivos en conflicto, migraciones existentes y código productivo de B idénticos a 4233811.
- Contenedor/red busesuta-leslie-book06-base retirados, incluidas ambas bases QA. Filtros de recursos propios de Compose/Nginx vacíos. Servicios ajenos conservados.

## Revisión y límites

La descripción preparada para PR distinguirá los resultados locales del estado de integración. El diff contra develop debe mostrar únicamente el incremento B, no repetir la compra/lector de PR #51. No se integra ninguna PR ni se atribuye aprobación humana por pasar pruebas.

Pendientes C: fuente pública real de Payments, autorización inicial UPLOAD_PROOF y traducción segura de outcomes/compensación. Pendiente D: planificador y recuperación de candidatos. Venta, rechazo justificado, correcciones, caja e invitado siguen fuera de este incremento.

La actualización se guarda/publica mediante commit de conciliación con padres 4233811 y 5a40702. El hash se consulta en Git; no se declara creada ni integrada la PR nueva. [Descripción preparada](descripcion-pr.md) para crearla hacia develop, con revisión humana pendiente.
