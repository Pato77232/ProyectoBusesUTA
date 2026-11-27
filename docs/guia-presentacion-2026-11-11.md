# Guía de comprobación para la presentación — 11 de noviembre de 2026

## 1. Qué versión se revisó

- Rama: `feature/FRONT-02-cierre-flujo-web`, HEAD `162c80b`.
- Referencias remotas actualizadas el 11/11: `origin/develop` también está en `162c80b`; `origin/main` en `e7b12b5` (0.2.1).
- Los cambios de FRONT-02, BOOK-CAJA-02 y BOLETOS-03 están locales, sin commit. Presentar esta pila no equivale a presentar exclusivamente la versión de `main`.
- Aplicación observada: <http://127.0.0.1:8088/>. Edwin confirmó que la base principal de demostración está expuesta en **55432**.
- Esta guía combina lectura del código, comprobaciones actuales e instrucciones manuales. Las casillas son pendientes de ejecución humana; no significan pruebas aprobadas.

**Protección de datos:** no ejecutar Jest de integración, `TRUNCATE`, reversión de migraciones ni scripts de limpieza contra 55432. Usar cuentas y pasajeros de demostración, archivos ficticios y operaciones nuevas. No borrar los datos preparados para exponer.

## 2. Cómo funciona el sistema

```text
SYSTEM_ADMIN crea cooperativa y administrador
  → COOPERATIVE_ADMIN crea oficinistas, grupos y buses
  → define frecuencias, programación y tarifas
  → publica la hoja: habilita los viajes y congela su inventario comercial
  → CUSTOMER busca viaje y tramo, elige asientos e ingresa pasajeros
  → CLERK acredita documentos; el servidor calcula descuentos y resumen
  → CUSTOMER acepta el resumen: reserva asientos por un plazo configurable
  → sube comprobante; CLERK revisa y aprueba o rechaza
  → aprobación: venta SOLD y asientos vendidos; consulta de boletos con QR
```

La búsqueda pública reúne varias cooperativas. Las operaciones internas deben quedar limitadas a la cooperativa de la sesión. El mapa aporta número, piso y posición; la disponibilidad aporta ocupación por viaje y tramo. Un asiento de plantilla y el identificador estable del asiento del bus son conceptos distintos.

La venta presencial nueva tiene otra entrada: **CLERK → Vender en boletería → pasajeros sin cuenta → acreditación presencial → resumen → reserva → cobro exacto en efectivo → boletos**. No crea clientes ficticios ni autocompleta datos por cédula. La implementación local guarda el recibo en Reservas; esa decisión aún necesita revisión de los responsables de Reservas y Pagos.

## 3. Preparación antes de exponer

- [ ] Abrir la aplicación en 8088 y comprobar que responde `/api/v1/health`. Health solo comprueba salud del servicio/base, no certifica el negocio.
- [ ] Tener una cuenta de cada rol: SYSTEM_ADMIN, COOPERATIVE_ADMIN, CLERK y CUSTOMER. No pegar contraseñas en esta guía.
- [ ] Usar perfiles de navegador separados para cliente y oficinista. Dos pestañas del mismo perfil comparten sesión; incógnito y un perfil normal permiten separar actores.
- [ ] Tener una segunda cooperativa y sus usuarios para probar aislamiento.
- [ ] Preparar un viaje **futuro**, con frecuencia activa, hoja publicada, tarifa para el tramo y asientos libres. Un borrador no aparece en venta. Ejemplo: Ambato → Quito del 12/11, solo si ese viaje existe en la pila actual.
- [ ] Anotar grupo, placa, número de unidad, recorrido, fecha, hora, tarifa y tres asientos libres. No reutilizar un asiento ya vendido en el mismo tramo.
- [ ] Tener un PNG/JPG/PDF ficticio menor de 5 MiB para subirlo como comprobante.
- [ ] Preparar una persona adulta, una menor y una de 65 años o más con cédulas de prueba válidas y datos coherentes. El validador estructural de cédula no consulta la identidad en un servicio externo.
- [ ] Anotar los porcentajes de descuento y el plazo de pago configurados para esa cooperativa. No asumir que todas tienen los mismos valores.
- [ ] Guardar evidencia: caso, rol, dato de prueba, resultado esperado, resultado observado y captura sin secretos ni datos reales.

## 4. Recorrido por funcionalidades

Realizar primero el camino exitoso. Reservar las pruebas de rechazo y vencimiento para compras separadas.

| Caso | Acción manual | Resultado esperado |
| --- | --- | --- |
| ACC-01 | Entrar con cada rol y salir desde su página. | Sistema → Cooperativas; administrador de cooperativa → Operaciones; oficinista → Comprobantes; cliente → Mi cuenta. Tras salir, no se puede repetir una operación privada sin autenticarse. |
| ACC-02 | Abrir una página de otro rol e intentar una operación privada. | El servidor impide la operación; ocultar botones no es la única protección. |
| ACC-03 | Registrar un cliente nuevo, probar contraseña incorrecta y luego la correcta. | Validaciones comprensibles, acceso correcto y panel vacío en una cuenta sin compras. |
| ADM-01 | Como SYSTEM_ADMIN, crear cooperativa y asignar su administrador; como este, crear un oficinista. | Cada usuario conserva su rol y cooperativa. Un cliente no puede crear cooperativas ni personal. Usar altas nuevas de demostración. |
| FL-01 | Operaciones → Grupos de buses: crear uno y repetir el mismo dato para comprobar duplicados. | Grupo visible; duplicado rechazado según el contrato. Categorías: rutas largas, cantonales y urbanas/rurales. |
| FL-02 | Registrar bus con placa, unidad, VIN, carrocería, color, grupo, plantilla y fotos. | Alta visible en inventario, placa presentada con guion y fotografías consultables por usuarios autorizados. |
| FL-03 | Repetir placa o VIN; repetir unidad en la misma cooperativa. | Rechazo sin crear un segundo bus. Placa y VIN únicos en el sistema; unidad única dentro de cada cooperativa. |
| FL-04 | Revisar plantillas de uno y dos pisos, 2+2 y 2+1; cambiar asientos ofrecidos y categoría cuando la pantalla lo permita. | Numeración, pasillo y espacios de escalera coherentes; capacidad acorde a los asientos ofrecidos. Un espacio accesible no se convierte en un asiento NORMAL por su posición. |
| FR-01 | Crear frecuencia con resolución ANT; intentar sin resolución. | Alta válida y rechazo del dato incompleto. Origen, destino y hora no se editan después de crearla. |
| FR-02 | Consultar frecuencia directa y otra con paradas; comprobar activa/inactiva usando datos de prueba. | Solo las activas y comercialmente habilitadas aparecen en búsqueda. No desactivar la frecuencia del recorrido principal durante la exposición. |
| HR-01 | Crear hoja con grupo, buses, frecuencias, fechas y tarifas; guardar borrador. | El borrador conserva lo guardado y todavía no ofrece viajes a compradores. Un bus de otro grupo no se puede asignar. |
| HR-02 | Publicar hoja y buscar el viaje; comprobar día de parada si está preparado. | La publicación habilita salidas válidas y no produce viaje para una asignación de parada. |
| HR-03 | En datos de ensayo, renovar un período. | Se crea un nuevo borrador que exige publicación explícita. No presentar esto como un optimizador automático de rotaciones. |
| BUS-01 | Sin sesión, buscar origen, destino y fecha válidos, luego una fecha sin viajes. | Resultados con recorrido, fecha/hora, cooperativa y tarifa; vacío comprensible. La fecha corresponde al embarque local del tramo. |
| BUS-02 | Buscar un tramo entre paradas de un recorrido más largo. | Precio explícito de ese tramo y horarios de esas paradas; no sumar tarifas por inferencia. |
| RES-01 | Como cliente, abrir un resultado y elegir asientos en el mapa. | Etiquetas visibles, pisos y posiciones; no UUID como nombre. Ocupados no seleccionables. |
| RES-02 | Ingresar pasajeros y solicitar acreditación; como oficinista, revisar y registrar decisiones. | Sin acreditación suficiente no hay resumen aceptable. El cliente recupera el resultado y solicita un resumen nuevo. Cambiar pasajeros/tramo requiere la revisión que corresponda. |
| RES-03 | Probar adulto, menor, tercera edad y discapacidad acreditada. | El servidor calcula el descuento configurado y muestra base, descuento y total. No se escribe un descuento manual. No asumir acumulación de beneficios. |
| RES-04 | Aceptar resumen y confirmar una vez; actualizar estado si la respuesta fue incierta. | Una reserva con plazo visible y asientos reservados. No crear otra compra a ciegas ni cambiar claves para forzar un reintento. |
| PAG-01 | Subir el archivo ficticio durante el plazo. | Recepción confirmada y aparición en la bandeja de la misma cooperativa. Rechazo claro de formato inválido o tamaño excesivo. |
| PAG-02 | Oficinista abre el archivo, confirma revisión y aprueba. | Reserva vendida, asientos vendidos y acceso al boleto. El formulario exige la confirmación de revisión. |
| BOL-01 | Cliente abre Mis boletos e imprime o previsualiza impresión. | Un boleto por pasajero, QR, recorrido, fecha, importe y código. El QR contiene código opaco, no datos personales. Una reserva ajena no entrega boletos. |
| HIS-01 | Revisar Mi cuenta e historial después de vender. | Próximos viajes y recientes coherentes; enlaces a reserva o boleto. Recargar no crea reservas ni ventas nuevas. |
| CAJ-01 | Como CLERK, abrir Vender en boletería y buscar un viaje propio. | Solo viajes propios en la pantalla; no requiere cuenta del pasajero ni búsqueda de sus datos por cédula. |
| CAJ-02 | Elegir asientos, escribir pasajeros, marcar acreditación física y revisar total. | Nacimiento verificado obligatorio para obtener el resumen; beneficios calculados por el servidor. |
| CAJ-03 | Confirmar reserva y registrar efectivo exacto dentro del plazo; abrir boletos. | Venta SOLD y QR. Reintentar con el mismo recibo no crea otro cobro. Importe distinto u otro recibo producen conflicto. Esta comprobación sigue pendiente en la pila actual de esta revisión. |

## 5. Casos que demuestran las reglas importantes

### Concurrencia y tramos

1. Dos clientes en perfiles separados abren el mismo viaje y tramo y seleccionan el mismo asiento libre.
2. El primero confirma. El segundo intenta confirmar su resumen anterior.
3. Debe haber una sola reserva activa para ese asiento y tramo; el segundo recibe conflicto y actualiza disponibilidad.
4. Repetir en dos viajes/días distintos: usar el mismo número de asiento debe ser posible, si está libre en cada viaje.
5. Con un viaje A → B → C preparado, comprobar bloqueo en tramos solapados y reutilización en tramos consecutivos sin solapamiento. No asumir que estar ocupado en A → B bloquea B → C.

### Rechazo justificado

1. Crear una compra nueva y recibir su comprobante.
2. Intentar rechazar sin motivo: no debe aceptar la decisión.
3. Rechazar con motivo de prueba. El cliente debe ver «Rechazada», sin formulario de carga, y el asiento debe volver a estar disponible.
4. La pantalla actual no muestra al cliente el motivo del rechazo; FRONT-02 lo deja fuera porque la lectura de reservas no lo entrega. No anunciarlo como implementado.

### Vencimiento sin comprobante

1. Crear otra reserva y anotar su hora límite real. No cambiar el reloj de la máquina ni modificar la base.
2. Esperar el plazo configurado (3–5 minutos), actualizar estado y disponibilidad.
3. Debe pasar a vencida y liberar asientos. Subir el comprobante tarde debe rechazarse; no producir una venta.
4. Una reserva con comprobante ya recibido no se trata como abandono sin comprobante. No confundir este plazo con el futuro flujo de corrección de 15 minutos.

### Aislamiento entre cooperativas

- Usar cuentas de dos cooperativas y comparar inventario, hojas, bandeja y acreditaciones: cada cuenta interna solo debe acceder a lo propio.
- Probar también una petición directa a un identificador ajeno, no solo los elementos visibles en una lista.
- **Hallazgo de lectura de código:** en `backend/src/modules/bookings/interfaces/counter-router.js`, las rutas GET `/availability` y `/seat-map` pasan solamente el viaje/tramo a las consultas compartidas. No pasan el contexto de la sesión ni comprueban su cooperativa. En `bookings/index.js` tampoco se inyecta un catálogo específico del oficinista para esas lecturas. La pantalla filtra resultados, pero no protege una consulta directa de un viaje ajeno. Cotizar/reservar y cobrar tienen controles posteriores; no equivalen a proteger estas dos lecturas. Corregir y añadir cobertura cruzada antes de dar BOOK-CAJA-02 por listo para integrar. Este hallazgo no fue reproducido con sesiones reales en esta revisión.

## 6. Funciones que requieren una comprobación aparte

| Función | Qué se puede afirmar / qué falta |
| --- | --- |
| Recuperación de contraseña | Implementación existente; probar solicitud, recepción real del correo, enlace vigente, cambio y rechazo del enlace usado. La comprobación de hoy no envió correo ni leyó credenciales. |
| Google Wallet | Código y pruebas locales; sin configuración el botón debe estar oculto. BOLETOS-03 registra pendiente obtener emisor/clase y probar Android con Google real. Una firma con clave de prueba no acredita un pase guardado. No presentar una integración real ya terminada. |
| Correo de boletos e invitado | No confundir QR visible/imprimible con correo enviado. Confirmar la integración y recepción en el buzón antes de incluir esos recorridos en la demostración. |
| Correcciones de comprobantes | No hay flujo de solicitud de corrección en los archivos de Pagos revisados. Aprobar/rechazar no equivale a solicitar corrección de 15 minutos. |
| Asiento en el boleto | El mapa e historial mejoran con FRONT-02; la spec mantiene pendiente congelar/mostrar el número real en el boleto, que sigue identificando el orden del pasajero. |
| Datos/fotos del bus para comprador | Las fotos existen en Flota; no se encontró una vista de detalle fotográfico integrada en búsqueda/reserva en los archivos revisados. No equiparar inventario administrativo con detalle público. |
| Accesibilidad, tarjeta y control de embarque | Verificar los contratos y pantallas específicos antes de prometer venta accesible o pasarela. Chofer/Controlador y validación operativa del QR no forman parte de esta fase. |

## 7. Resultados ejecutados hoy por esta revisión

| Comprobación | Resultado real |
| --- | --- |
| `git diff --check` | Sin errores. |
| Backend `npm run lint` | Aprobado. |
| Backend `npm run format:check` | Aprobado. |
| Backend `npm run test:unit -- --runInBand` | **2224/2224**, 128 suites. Primera ejecución: 15 fallos por `EACCES` al conectar a servidores localhost; repetición con permiso de red local aprobada. |
| Frontend `npm run lint` | Aprobado. |
| Frontend `npm test` | **468/468**. |
| HTTP en 8088 | Health y páginas de boletería, grupos, acreditaciones, boletos, Mi cuenta, buses y `benefits.css`: **200**. No certifica sesión, venta ni correspondencia exacta de la imagen con cada archivo local. |
| Integración PostgreSQL | **No ejecutada hoy por esta revisión.** La creación de una base temporal propia no fue autorizada. La base principal 55432 se conserva. Los resultados de las specs del 10/11 y otras sesiones del 11/11 son evidencia histórica, no una repetición sobre todo el checkout actual. |
| Recorrido manual con navegador | No ejecutado por esta revisión. Aplicar las casillas de esta guía y registrar el resultado observado. |

Para repetir integración, seguir [testing-database.md](testing-database.md) con una instancia descartable propia, `NODE_ENV=test` y base terminada en `_test`. El puerto 55433 ya tenía un contenedor de pruebas activo al revisar; confirmar quién lo usa antes de reutilizarlo o retirarlo. **Nunca sustituir su URL por la de 55432.** Ejecutar `npm test` desde `backend/` cuando esa instancia aislada esté disponible.

## 8. Guion corto para exponer (15–20 minutos)

1. **Preparación, 3 minutos:** explicar roles y cooperativas; mostrar grupo, bus, frecuencia ANT y hoja ya publicada. No consumir toda la exposición creando los datos base.
2. **Compra, 5 minutos:** buscar viaje/tramo, mapa numerado, pasajeros, acreditación en el perfil del oficinista y resumen con precio del servidor.
3. **Pago y boleto, 4 minutos:** reservar, subir comprobante ficticio, aprobar, mostrar historial y boleto imprimible con QR.
4. **Reglas, 3 minutos:** conflicto entre dos clientes y rechazo sin motivo; mostrar una reserva vencida previamente preparada.
5. **Boletería y límites, 3–5 minutos:** venta en efectivo sin cuenta con datos ficticios. Declarar que es cambio local en revisión y mencionar pendientes de Wallet/correo; no presentar esas dependencias como conectadas.

Antes de cerrar: cada comportamiento mostrado debe tener un resultado observado; guardar defectos reales como pendientes. No ocultarlos ni introducir defectos académicos. No hubo commits, push, merge, rebase ni modificación de código de producto durante esta revisión.
