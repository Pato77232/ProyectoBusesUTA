# BOOK-03 T4 C: acceso de cliente en la pantalla de reservas

- Responsable: Leslie Coello. Revisor propuesto: PabloToapanta.
- Fecha: 29 de octubre de 2026. Spec previa al código, continuación autorizada por Leslie.
- Rama original feature/BOOK-03-resumen-creacion-dominio, base 1592199. origin/develop revisado en f26415d; sin nuevos proveedores de viajes/plantillas en las ramas consultadas.
- Consumir únicamente la API pública ya implementada de auth; no reimplementar reglas ni modificar capas internas de Pablo, portada o transporte común.

## Resultado

Panel de acceso dentro de pages/reservas.html para cuentas existentes, manteniendo DESIGN.md, tokens y componentes de la pantalla. Correo y contraseña con etiquetas, autocomplete username/current-password. Formulario method POST para no poner credenciales en URL si falla JavaScript; no enlaces ficticios a registro/recuperación. Backend valida credenciales, rol, sesión, CSRF y límites.

createBookingsApi añade signIn(credentials): GET auth/csrf y POST auth/login con transporte común. Login responde 200 vacío; no exigir JSON ni guardar cookie/token manualmente. session(): GET auth/me. Un pequeño controlador de acceso evita doble envío y comprueba que me devuelve CUSTOMER, id no vacío y cooperative_id null antes de continuar; éxito vacío de login por sí solo no acredita rol.

No persistir credenciales en local/sessionStorage ni estado del controlador, no logs ni query. Borrar campo contraseña antes de esperar la petición y después de cada intento; conservar correo introducido para corregir errores. Cookies continúan gestionadas por navegador/backend. 400/401/403/429/5xx se muestran en español; no probar otras contraseñas ni repetir login automáticamente.

## Continuidad de compra

Ante 401 o FORBIDDEN al consultar/confirmar, mostrar panel de acceso y retirar datos privados visibles: resumen, pasajeros, recibo y borradores en memoria. Añadir forgetPrivateData en el estado de reservas para descartar cuerpo/reintento de POST, manteniendo exclusivamente referencia ya guardada. No borrar referencia ni iniciar otra compra por un cambio de sesión.

Al cambiar de cuenta manualmente, retirar también datos privados antes de enviar credenciales. Durante login bloquear selección, edición y consultas incompatibles; solo una petición de acceso. Al éxito:
- Si hay referencia: consultar GET attempts primero, sin reenviar POST ni reconstruir pasajeros.
- Si no hay referencia y sí contexto de viaje: consultar disponibilidad.
- Sin contexto: orientar a elegir viaje, sin inventarlo.
Si el intento no aparece para la nueva cuenta, conservar referencia y no permitir otra compra automática. El servidor vuelve a verificar dueño y sesión; la UI no autoriza por sí sola.

El panel se abre con sesión requerida; no impedir acceso a la cuenta solo porque exista un intento pendiente. Un cliente autenticado no recibe un formulario obligatorio en cada interacción. Fuentes de viajes/acreditación faltantes siguen dando 503; este paso cierra acceso de pantalla, no inventa proveedores ni registro/recuperación de contraseña.

## Verificación

- Unidad: CSRF antes de login, 200 vacío seguido de me, solo CUSTOMER, bloqueo de envío doble, errores sin reintentos, ninguna credencial en estado/storage, descarte privado conserva solo clave.
- Navegador con Express/PostgreSQL/argon2/JWT/CSRF reales: contraseña incorrecta sin sesión; acceso correcto desde formulario, actualización de CSRF después de login, recorrido de reserva, respuesta perdida con COMMIT, recarga, sesión revocada con datos retirados y nuevo acceso recuperando el mismo intento sin otro POST.
- Mantener pruebas previas y sus aserciones. Reusar su fixture de viajes/acreditación solo en QA; no en server.js.
- 360/1280, teclado/foco y contraste de panel; capturas con datos sintéticos. Zoom nativo/lector de pantalla siguen pendientes y no se certifican.
- Pruebas/lint/formato frontend y empaquetado real. Sin cambios backend: usar la evidencia backend de 961 pruebas más QA real del acceso; si aparecen cambios backend, repetir validaciones correspondientes.
- Base exclusiva nueva y retiro de contenedor/red propios; sin .env ni datos del equipo.

Commit lógico en español con código/spec/pruebas en la entrega funcional de reservas. No publicar un PR por este paso. Quedan proveedores de viaje/plantilla/acreditación, entrada desde búsqueda y revisión humana.


## Resultado verificado — 29 de octubre de 2026

Implementado acceso dentro de la pantalla de reservas para cuentas existentes, con API real de auth y transporte común. Login acepta 200 vacío, después GET me comprueba CUSTOMER. Sin persistir credenciales ni guardarlas en estado; campo contraseña se vacía antes de esperar y al terminar. Un envío de acceso por vez, sin reintentos automáticos ni modificación de reglas/backend de Pablo.

Al perder sesión o cambiar cuenta se retiran pasajeros, borradores, resumen y recibo de DOM/memoria. Se conserva solo el UUID del intento y se descarta el cuerpo para impedir reenviarlo bajo otra sesión. Tras acceso correcto se consulta primero GET attempts si hay referencia; no se crea otra compra. Se mantienen consultas del servidor para autorización y propiedad.

npm test frontend: 54 aprobadas (45 previas y nueve nuevas). Lint y formato de los archivos modificados aprobados. No hubo cambios backend: sigue la evidencia de 961 pruebas del incremento anterior; no se presenta como ejecución nueva.

Chrome headless Windows con argon2, JWT, cookies, CSRF y PostgreSQL reales: contraseña incorrecta sin nueva sesión, contraseña correcta desde formulario sin inyectar cookie, rol CUSTOMER verificado por me, nuevo CSRF para el resumen, compra de fixture, pérdida de respuesta tras COMMIT, recarga y recuperación. Revocar sesión retira datos privados visibles; nuevo login recupera mismo ID/plazo sin POST adicional. Se mantuvieron las comprobaciones anteriores y se sustituyó el fixture directo de JWT/cookie por el login real, sin quitar aserciones funcionales. Solo viajes/acreditación son fixtures de QA.

Capturas del acceso a 1280/360 px inspeccionadas, sin desbordamiento. Contraste de muestras >=4.5:1 y recorrido anterior de teclado/foco continúan pasando. Campos de credenciales se rellenan programáticamente en QA y se envían con acción de teclado; no se afirma prueba manual completa con lector. Zoom nativo, lector de pantalla y dispositivos físicos pendientes.

Imagen real reconstruida: nuevo access.js servido con MIME JavaScript, recursos/documentos excluidos según listas, nginx sin root y 404 reales. Contenedor/red de esa prueba retirados. Base nueva busesuta-leslie-book03-acceso, cero tablas comprobadas antes de migrar, contenedor/red retirados al terminar. Sin .env, datos existentes ni dependencias nuevas; sin cambios de portada ni módulos internos de otros integrantes.

C implementada localmente y pendiente de revisión humana, sin publicar PR por paso. Proveedores reales de viaje/plantilla/acreditación, entrada desde búsqueda y revisión de entrega siguen pendientes antes de compra operativa.
