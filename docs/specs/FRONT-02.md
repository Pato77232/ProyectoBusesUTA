# FRONT-02: Cierre del flujo web para la segunda revisión

- **ID local:** FRONT-02
- **Ticket externo:** pendiente; el equipo evalúa Jira para la gestión de cambios. No se inventan claves.
- **Módulo:** frontend (imagen y proxy Nginx, portada, búsqueda, reservas, flota, pagos), una lectura adicional en Reservas (backend) y el almacenamiento de comprobantes en Docker Compose.
- **Responsable:** Edwin (pato77232).
- **Revisor propuesto / confirmado:** Leslie (T3 y T6), Shirley (T7 y T8, Pagos) y otro integrante para el resto. Pendiente de confirmar.
- **Estado:** En desarrollo; cambios locales sin commit ni push.
- **Prioridad y dependencias:** Alta, para la revisión del miércoles 11 de noviembre de 2026. T3 depende del contrato vigente de `findPurchaseContext` (ROUTE-SHEETS, David) y no lo modifica.
- **Rama / PR / base comprobada:** `feature/FRONT-02-cierre-flujo-web` desde `origin/develop` `162c80b` (v0.2.1), comprobada el 10 de noviembre de 2026. Sin PR.
- **Autorización de alcance:** Edwin aprobó las specs de frontend de estos faltantes el 10 de noviembre de 2026 («Cuando termines quedan aprobadas las specs de fronted») y pidió agruparlas en una sola spec y una sola rama. Esto no sustituye la revisión técnica humana.

## 1. Objetivo

Que un cliente pueda recorrer el flujo de compra en la aplicación servida por Docker y que una cooperativa nueva pueda preparar su flota desde la web. La prueba en `develop` v0.2.1 (10 de noviembre de 2026, `http://localhost:8088`) encontró estos faltantes:

1. **T1:** la imagen del frontend no copia `pages/acreditaciones.html`, `pages/historial-reservas.html`, `pages/buses.html` ni `src/styles/benefits.css`, así que esas páginas devuelven 404. Sin acreditación, el oficinista no puede verificar la fecha de nacimiento y el cliente no pasa del resumen (`BOOKING_BENEFIT_REVIEW_REQUIRED`).
2. **T2:** la portada dice que la búsqueda y la compra «aún no están disponibles», aunque ya lo están.
3. **T3:** el selector de asientos muestra el UUID («Asiento fc92d4ab-…») en vez del número y la distribución del bus, lo que contradice RN-12 y el paso 3 del flujo de compra.
4. **T4:** no existe una pantalla para crear grupos de buses. Una cooperativa nueva no puede registrar buses (RN-11) sin usar la API a mano.
5. **T5:** `package.json` del frontend repite las claves `test` y `lint`; la segunda anula a la primera y excluye `tests/tickets` y `src/tickets`.

Durante la verificación de T1–T5 aparecieron tres bloqueos más del mismo flujo:

6. **T6:** después de confirmar la reserva, ninguna pantalla permite subir el comprobante, aunque `POST /api/v1/payment-proofs` (PAGOS-01) existe. Además, el proxy Nginx limita los cuerpos a 1 MB y el backend admite hasta 5 MB.
7. **T7:** la bandeja `comprobantes.html` solo permite abrir archivos; dice que aprobar y rechazar «estarán disponibles cuando su integración esté lista», aunque `approve` y `reject` ya están integrados (PAGOS-02, INTEG-01).
9. **T9 (reportado por Edwin el 10 de noviembre de 2026):** al iniciar sesión solo aparece «Sesión iniciada» y no se entra a la aplicación. AUTH-WEB-01 excluyó a propósito la redirección por rol; FRONT-02 la añade con autorización de Edwin.
10. **T10 (pedido por Edwin el 10 de noviembre de 2026):** el cliente necesita un panel con sus viajes recientes al entrar, y no solo el aviso «Sesión iniciada».
11. **T11 (reportado por Edwin el 10 de noviembre de 2026):** con la sesión iniciada, la portada y «Buscar viajes» siguen mostrando «Iniciar sesión», porque el enlace es fijo en el HTML. Los roles ya existen (AUTH-01/AUTH-03); no hace falta una asignación nueva.
12. **T12 (reportado por Pablo y comunicado por Edwin el 10 de noviembre de 2026):** las páginas del administrador del sistema, del administrador de cooperativa y del oficinista no tienen un botón para cerrar sesión; solo existe en el login y en «Mi cuenta» del cliente.
13. **T13 (recorrido de Edwin y Codex del 10 de noviembre de 2026):** al recorrer un comprobante rechazado y una reserva vencida en la pila QA, la pantalla del cliente fallaba en cuatro cosas. Decía «Estado pendiente de actualización» en vez de «Rechazada» o «Vencida». Mantenía visible el formulario del comprobante aunque el plazo hubiera terminado. Al subirlo tarde respondía «Inténtalo de nuevo». En «Mis reservas» mostraba el identificador interno del asiento. Además, «Confirmar reserva» seguía deshabilitado sin explicar por qué. El backend se comportó bien en ambos casos. Mostrar al cliente el motivo del rechazo queda fuera: la API de reservas no lo devuelve y requiere su propia spec en Pagos.
14. **T14 (reportado por Edwin el 10 de noviembre de 2026, con capturas):** en «Operaciones», «Grupos de buses» y «Crear frecuencia» salían como enlaces sueltos, desalineados respecto de los botones. Además, el administrador de cooperativa y el oficinista tenían en la cabecera «Mi cuenta» o «Mi sesión», que solo abrían el login con el aviso de sesión activa. En «Comprobantes», «Área de cooperativa» parecía un enlace sin serlo.
15. **T15 (reportado por Edwin el 11 de noviembre de 2026):** en el login, «Volver al inicio» era un enlace suelto subrayado, distinto de las cabeceras con botón. Lo mismo pasaba en registro, recuperación y restablecimiento de contraseña.
16. **T16 (reportado por Leslie y comunicado por Edwin el 11 de noviembre de 2026):** la hoja de ruta no se guardaba siguiendo la guía de pruebas y las tarifas no se podían guardar. Causa: la programación se repite cada ciclo y el bus terminaba en Quito sin un traslado de regreso a Ambato (`assertRepeatable`), así que el servidor rechazaba el guardado con «El bus requiere un traslado explícito hasta el siguiente origen». Las tarifas solo se habilitan después de guardar la programación. No era un defecto; la guía omitía el traslado y el mensaje no decía cuál faltaba.
8. **T8:** en Docker, `PAYMENT_PROOF_STORAGE_DIR` no está definido y el valor por defecto (`/app/private-storage`) no es escribible por el usuario `node`, así que la carga responde 500.

## 2. Reglas de negocio involucradas

- **RN-11:** los grupos de buses se clasifican en rutas largas, cantonales y urbanas/rurales. La pantalla de T4 usa exactamente esas tres categorías (`LONG_ROUTE`, `CANTONAL`, `URBAN_RURAL`).
- **RN-12 y flujo de compra, paso 3:** el cliente ve la plantilla visual del bus (pisos, filas, columnas) para elegir asientos disponibles.
- **RN-40:** el estado del asiento (Disponible, Reservado, Vendido) lo sigue entregando solo `/bookings/availability`. La lectura de T3 no informa estados.
- **RN-01/02 y multi-tenant:** la cooperativa sale del contexto del servidor. `/bookings/seat-map` exige rol `CUSTOMER`, igual que la disponibilidad, y lee la copia publicada del viaje. Grupos de buses: `COOPERATIVE_ADMIN` y CSRF, ya implementados en FLEET-01.

## 3. Alcance

**Incluye:**
- T1: copiar a la imagen las páginas y la hoja de estilos que faltan.
- T2: actualizar los textos de la portada que describen funciones ya disponibles, sin prometer funciones que no existen.
- T3: un endpoint de solo lectura `GET /api/v1/bookings/seat-map` y el render del selector por piso, fila y columna, con el número del asiento.
- T4: la página `pages/grupos-buses.html`, que lista y crea grupos, más los enlaces desde Operaciones y desde el registro de buses cuando no hay grupos.
- T5: unir las claves duplicadas de `package.json` del frontend.
- T2 también corrige el doble punto de la hora en los resultados de búsqueda («8:30 a. m..»).
- T6: formulario de carga del comprobante en el recibo de la reserva (JPG, PNG o PDF, hasta 5 MB) y `location = /api/v1/payment-proofs` en el proxy, con `client_max_body_size` de 5 MB más el margen multipart del backend.
- T7: aprobar (con confirmación de revisión) y rechazar (con motivo obligatorio, RN-53) desde la bandeja.
- T9: tras un inicio de sesión correcto, la página de login redirige según el rol:

  | Rol | Destino |
  |---|---|
  | `SYSTEM_ADMIN` | `cooperativas.html` |
  | `COOPERATIVE_ADMIN` | `operaciones-cooperativa.html` |
  | `CLERK` | `comprobantes.html` |
  | `CUSTOMER` | `historial-reservas.html` |

  El retorno `next` de una reserva conserva la prioridad. Con una sesión previa no redirige: muestra el enlace al destino y conserva «Cambiar cuenta». Un rol desconocido se queda en la página.
- T10: `pages/mi-cuenta.html`, el panel del cliente.
  - Saluda con el correo de la cuenta y ofrece «Buscar viajes», «Todas mis reservas» y «Cerrar sesión».
  - «Próximos viajes» muestra las reservas pagadas o pendientes con salida futura, de la más cercana a la más lejana.
  - «Viajes recientes» muestra las cinco anteriores, vencidas o rechazadas.
  - Cada viaje indica origen y destino del tramo, fecha y hora, estado, número de pasajeros, total y un enlace a sus boletos o a la reserva.
  - Usa `GET /api/v1/bookings?limit=50` (BOOK-08), sin cambios de backend; una reserva sin recorrido verificable se omite.
  - El destino del cliente pasa a ser `mi-cuenta.html`, también con una sesión ya abierta, porque el panel tiene su propio cierre de sesión. Los otros roles siguen viendo «Cambiar cuenta» en el login.
- T11: `src/auth/session-link.js` consulta `GET /api/v1/auth/me` y cambia los enlaces marcados con `data-session-link` por el panel del rol («Mi cuenta», «Operaciones de cooperativa», etc.). Además oculta lo marcado con `data-guest-only` («Crear cuenta» en la portada). Sin sesión, ante un error o con un rol desconocido, conserva «Iniciar sesión». Es solo presentación: el backend sigue autorizando cada operación. Se aplica en `index.html`, `buscar-viajes.html`, `historial-reservas.html` y `boletos.html`. En «Buscar viajes» el enlace quedaba pegado al logo, y «Mis reservas» y «Mis boletos» tenían cabeceras de enlaces sueltos sin logo. Las dos últimas ahora comparten la cabecera de la portada: logo, «Buscar viajes», «Mis reservas», «Mis boletos» y el enlace de sesión, con la página actual marcada mediante `aria-current`.
- T12: `src/auth/logout.js` pide `POST /api/v1/auth/logout` y vuelve al login aunque se pierda la respuesta. Mientras cierra, los botones quedan deshabilitados con «Cerrando sesión…» y se ignora un segundo clic. `src/auth/logout-page.js` conecta los botones marcados con `data-logout`. El botón «Cerrar sesión» se agrega a la cabecera de las 13 páginas del personal: cooperativas, administrador-cooperativa, oficinistas, operaciones-cooperativa, grupos-buses, buses, registrar-bus, frecuencias, crear-frecuencia, hojas-ruta, programar-hoja, comprobantes y acreditaciones. Los enlaces existentes de la cabecera no cambian.
- T13: `src/bookings/booking-outcome.js` traduce el estado de la reserva en título, mensaje y acciones. Con el estado pendiente y el plazo cumplido, retira el formulario del comprobante y pide «Actualizar estado». Las reservas rechazada y vencida explican que los asientos se liberaron y ofrecen «Elegir asientos de nuevo», que cierra el intento guardado y vuelve al mismo viaje. `BOOKING_NOT_PAYABLE` muestra «Esta reserva ya no admite comprobantes». En «Mis reservas», el detalle consulta el mapa de asientos para mostrar «asiento 7»; si el mapa no responde, muestra «asiento asignado» y nunca el identificador interno. Junto a «Confirmar reserva» se muestra la indicación de marcar la casilla de aceptación, enlazada con `aria-describedby`.
- T14: cada tarjeta de «Operaciones» agrupa sus acciones como botones alineados: el oscuro para la acción principal y el contorneado para la secundaria. Se conservan los mismos destinos y en el mismo orden. Se quitó «Mi cuenta» de «Operaciones», donde ya está el administrador, y en «Oficinistas» se cambió por «Volver a operaciones». «Comprobantes» y «Acreditar beneficios» comparten la navegación `nav-list` del oficinista con la página actual marcada mediante `aria-current`, sin «Mi sesión» ni «Área de cooperativa». «Cambiar sesión» dentro de «Acreditaciones» se mantiene.
- T15: el enlace de cabecera de `login.html` y `registro.html` («Volver al inicio») y el de `recuperar-cuenta.html` y `restablecer.html` («Iniciar sesión») usan `btn btn-outline-dark`, igual que el resto de cabeceras. Solo cambia la clase; destino y texto se mantienen.
- T16 (módulo Route Sheets, de David): mismo código `BUS_AGENDA_LOCATION_CONFLICT` e identificadores, con mensajes que nombran los lugares. Al repetir el ciclo: «La programación se repite cada ciclo: el bus termina en Quito y el ciclo siguiente empieza saliendo de Ambato. Añade, dentro del ciclo, un traslado de Quito a Ambato.» Entre actividades: «El bus llega a X y su siguiente actividad sale de Y. Añade un traslado de X a Y.» Con la ubicación inicial distinta, propone cambiarla. El conflicto de hora al repetir el ciclo también explica la causa. La guía de pruebas publicada incluye ahora el traslado, la habilitación de tarifas y el límite de dos ciclos sin terminar por grupo.
- T8: directorio `/home/node/payment-proofs` en la imagen del backend, la variable `PAYMENT_PROOF_STORAGE_DIR` y el volumen `payment_proofs` en `docker-compose.yml`.

**No incluye:**
- Cambiar el contrato de `/bookings/availability`. La prueba `real-availability.test.js` fija que solo entrega `seatId` y `status`.
- Modificar Route Sheets, Flota (backend) ni migraciones.
- Editar o borrar grupos de buses.
- Mostrar el número de asiento en el boleto: sigue como «Pasajero 1 de la compra» (BOLETOS-01 §148).
- Corregir el formato de la referencia de documentos en Acreditaciones (ver §10).
- Congelar el número de asiento en la reserva o en el boleto (BOLETOS-01 §148 sigue abierto).
- El rol Chofer/Controlador.

## 4. Flujo principal

1. El administrador de cooperativa abre Operaciones → Grupos de buses, crea «Rutas largas» (categoría Rutas largas) y ve el grupo en la lista.
2. Registra un bus en ese grupo, programa y publica la hoja de ruta (pantallas existentes).
3. El cliente busca el viaje, abre la reserva y ve los asientos por piso, con su número y su estado.
4. Elige un asiento, ingresa al pasajero y solicita la revisión de documentos.
5. El oficinista abre Acreditaciones (ahora servida por la imagen) y verifica la fecha de nacimiento.
6. El cliente obtiene el resumen, confirma la reserva y sube el comprobante; el oficinista lo aprueba y el cliente ve su boleto e historial.

## 5. Datos

`GET /api/v1/bookings/seat-map?tripId&fromPosition&toPosition` responde con `{ seats: [{ seatId, label, deck, row, column, category }] }`:
- `seatId`: UUID en minúsculas, el mismo que devuelve la disponibilidad.
- `label`: entero ≥ 1, único en el viaje.
- `deck`: 1 o 2.
- `row`, `column`: enteros ≥ 0.
- `category`: `NORMAL` o `VIP`.

Solo incluye asientos ofrecidos de la copia publicada, en orden de piso descendente y número. Si la fuente está incompleta o es inconsistente, la respuesta es 500 `BOOKING_TRIP_DATA_INTEGRITY_ERROR`, nunca una lista parcial. Sin tablas ni migraciones nuevas.

## 6. Endpoints

| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| GET | /api/v1/bookings/seat-map | CUSTOMER | 200, 400, 401, 403, 404, 500, 503; `Cache-Control: no-store` |
| GET / POST | /api/v1/bus-groups (existente, FLEET-01) | COOPERATIVE_ADMIN | 200 / 201, 400, 401, 403, 409 |
| POST | /api/v1/payment-proofs (existente, PAGOS-01) | CUSTOMER | 201, 400, 401, 403, 409, 413 |
| POST | /api/v1/payment-proofs/:id/approve y /reject (existentes, PAGOS-02) | CLERK | 200, 400, 401, 403, 404, 409 |

## 7. Criterios de aceptación

- [ ] T1: en el contenedor, `/pages/acreditaciones.html`, `/pages/historial-reservas.html`, `/pages/buses.html` y `/src/styles/benefits.css` responden 200.
- [ ] T2: la portada no afirma que la búsqueda o la compra no están disponibles y enlaza a «Buscar viajes».
- [ ] T3: dado un viaje publicado, cuando el cliente abre la reserva, entonces cada botón muestra «Asiento N» con el número del bus, agrupado por piso y en su fila y columna, y el UUID no aparece en pantalla.
- [ ] T3: los nombres accesibles y la leyenda de cada pasajero usan el número del asiento.
- [ ] T3: si la distribución no se puede leer o no coincide con la disponibilidad, la pantalla muestra un error y no ofrece asientos.
- [ ] T4: dado un administrador de cooperativa, cuando crea un grupo válido, entonces ve un mensaje de éxito y el grupo en la lista. Un nombre repetido muestra «Ya existe un grupo con ese nombre».
- [ ] T4: un cliente u otro rol ve un aviso de permiso y no el formulario; sin sesión se ofrece iniciar sesión.
- [ ] T5: `npm test` y `npm run lint` del frontend incluyen `admin` y `tickets`.
- [ ] T6: dado una reserva pendiente, cuando el cliente sube un JPG, PNG o PDF válido, entonces ve «Comprobante recibido» y el formulario se oculta. Un archivo de otro tipo o de más de 5 MB se rechaza antes de enviarlo.
- [ ] T7: el oficinista no puede aprobar sin marcar que revisó el archivo y el total, ni rechazar sin motivo. Al aprobar, el cliente ve «compra aprobada» y su boleto con QR.
- [ ] T9: dado un usuario sin sesión, cuando inicia sesión correctamente, entonces llega al destino de su rol. Si abre el login con una sesión ya activa, ve el enlace a su destino y puede cambiar de cuenta.
- [ ] T10: dado un cliente, cuando inicia sesión o abre el login con la sesión activa, entonces llega a «Mi cuenta» y ve sus próximos viajes y los recientes, o los mensajes de lista vacía. «Cerrar sesión» lo devuelve al formulario de login.
- [ ] T11: dado un usuario con sesión, cuando abre la portada o «Buscar viajes», entonces ve el acceso a su panel en lugar de «Iniciar sesión» y, en la portada, no ve «Crear cuenta». Sin sesión ve ambos enlaces originales.
- [ ] T12: dado un usuario del personal con sesión, cuando pulsa «Cerrar sesión» en cualquiera de sus páginas, entonces la sesión se revoca en el backend y vuelve al login; si la respuesta se pierde, también vuelve al login.
- [ ] T13: dada una reserva rechazada o vencida, cuando el cliente actualiza su estado, entonces ve el resultado, que los asientos se liberaron y la opción de elegir asientos de nuevo, sin formulario de comprobante. En «Mis reservas» ve el número del asiento.
- [ ] T14: dado el administrador de cooperativa o el oficinista, cuando abre sus páginas, entonces ve las acciones como botones alineados y la cabecera solo ofrece navegación útil y «Cerrar sesión», sin enlaces que lleven al login con la sesión activa.
- [ ] T8: con `docker compose up`, la carga del comprobante responde 201 y el archivo persiste en el volumen `payment_proofs`.

## 8. Casos borde y errores

- Seat map: asientos duplicados, etiquetas repetidas, un piso distinto de 1 o 2, categoría desconocida o un `seatId` ausente en la disponibilidad hacen que el frontend rechace la respuesta completa.
- Si un asiento accesible llega en `accessible-availability` sin número, se muestra como «Espacio accesible» en una sección propia, sin inventar número.
- Grupo de buses: nombre vacío o de solo espacios se rechaza en el cliente; los límites definitivos los valida el backend (400). Un 409 conserva lo escrito. Mientras se envía, el botón queda deshabilitado para evitar dobles altas.

## 9. Pruebas esperadas

- Unitarias backend: `getSeatMap` y su adaptador (mapeo, orden, fuente nula → 404, fuente inválida → error de integridad, solo asientos ofrecidos).
- Integración backend: ruta `/bookings/seat-map` con rol, `no-store`, parámetros extra → 400.
- Unitarias frontend: validación y agrupación del mapa de asientos; controlador de grupos de buses (carga, vacío, creación, 409, 403, 401).
- Manual en Docker: flujo principal completo en el navegador.

## 10. Preguntas abiertas

- **Leslie (Reservas):** confirmar que el endpoint adicional `seat-map` es aceptable frente a ampliar `availability`. Recomendación: el endpoint aparte, porque no rompe el contrato probado de disponibilidad. Respuesta: pendiente.
- **David (Route Sheets):** T3 solo consume `findPurchaseContext` tal como existe. Pendiente de que lo confirme.
- **Shirley (Pagos):** confirmar T6–T8, en especial que el texto «Los boletos del cliente quedan emitidos» refleja el contrato de aprobación (comprobado en Docker). Respuesta: pendiente.
- **Acreditaciones (hallazgo, fuera de alcance):** el backend exige que la referencia del documento empiece por `ref_` y tenga entre 8 y 128 caracteres. La pantalla solo lo insinúa en el placeholder y responde «Revisa las verificaciones y las referencias», sin explicar el formato. Se propone una mejora de usabilidad en BOOK-08 (Leslie).
- **Prueba de destinos (T9):** `tests/auth/operations-navigation.test.js` afirmaba que el cliente no tenía destino («no agrega accesos a otros roles»). T9 cambia ese requisito a propósito: la prueba ahora exige destinos para cliente y oficinista y sigue exigiendo `null` para roles desconocidos. Debe revisarlo un humano.
- **Prueba de humo:** `frontend/tests/admin-browser-smoke.cjs` comprueba la lista exacta de enlaces de Operaciones y el texto «crear grupos todavía no está disponible». T4 cambia ese comportamiento a propósito, así que la expectativa se actualiza en esta spec. No es un cambio para ocultar un fallo y debe revisarlo un humano.

## 11. Defecto inducido

No aplica. Esta spec no introduce ni corrige defectos registrados en `docs/errores-inducidos.md`.

## 12. Diseño SOLID y usabilidad

- **SRP:** el adaptador de infraestructura traduce la fuente de Route Sheets y el caso de uso solo orquesta. En el frontend, el mapa de asientos es un módulo puro (`seat-map.js`) separado del render, y el controlador de grupos se separa de la vista.
- **DIP:** `getSeatMap` recibe el catálogo como puerto; el controlador de grupos recibe `client` y `view`.
- **OCP:** la disponibilidad no cambia; el mapa se añade como lectura nueva.
- **ISP y LSP:** no se crean jerarquías nuevas.
- **Usabilidad:** estados de carga, vacío, error y éxito con `role="status"`; navegación por teclado (botones nativos, foco en mensajes); textos en español sin jerga; asientos con número visible y en `aria-label`; la cuadrícula se adapta a móvil con desplazamiento horizontal dentro del piso, no de la página.

## 13. Plan y evidencias

| Tarea | Archivos | Resultado comprobable |
|---|---|---|
| T1 | `frontend/Dockerfile` | 200 en el contenedor |
| T2 | `frontend/index.html` | Textos actualizados |
| T3 | `backend/src/modules/bookings/**`, `frontend/src/bookings/**` | Pruebas, más el número de asiento en el navegador |
| T4 | `frontend/pages/grupos-buses.html`, `frontend/src/fleet/bus-group-*.js`, Operaciones, registro de buses | Pruebas, más alta en el navegador |
| T5 | `frontend/package.json` | Lint y pruebas con todos los directorios |
| T6 | `frontend/src/bookings/{payment-proof,api,page}.js`, `reservas.html`, `nginx-proxy.conf` | Pruebas, más la carga en el navegador |
| T7 | `frontend/src/payments/{decision-controller,pending-view,pending-page}.js`, `comprobantes.html` | Pruebas, más la aprobación en el navegador |
| T8 | `backend/Dockerfile`, `docker-compose.yml` | 201 en la carga dentro de Docker |
| T10 | `frontend/pages/mi-cuenta.html`, `frontend/src/bookings/{customer-dashboard,dashboard-controller,dashboard-page}.js`, `app.css`, `frontend/Dockerfile` | Pruebas, más el panel en el navegador |
| T11 | `frontend/src/auth/session-link{,-page}.js`, `index.html`, `pages/buscar-viajes.html` | Pruebas, más la cabecera con y sin sesión |
| T12 | `frontend/src/auth/logout{,-page}.js`, cabeceras de las 13 páginas del personal | Pruebas, más el cierre real en Docker |
| T13 | `frontend/src/bookings/booking-outcome.js`, `page.js`, `payment-proof.js`, `history-controller.js`, `history-page.js`, `pages/reservas.html` | Pruebas, más las reservas rechazada y vencida en Docker |
| T14 | `pages/operaciones-cooperativa.html`, `oficinistas.html`, `comprobantes.html`, `acreditaciones.html` | Navegador con ambos roles |
| T9 | `frontend/src/auth/{login-view,login-controller,login-page}.js` | Pruebas, más el inicio de sesión de cada rol en el navegador |

### Evidencias (10 de noviembre de 2026, rama local sin commit)

- **Backend** (`backend/`, PostgreSQL 16.13 aislado de `docker-compose.test.yml`, proyecto `front02-test`):
  - `npm run lint` y `npm run format:check` sin errores.
  - `npm test`: 126 suites y 2196 pruebas unitarias; 72 suites y 735 pruebas de integración, todas en verde.
  - En una primera corrida falló una vez `tests/integration/fleet/bus-seat-immutability.test.js`. Pasó sola (9 de 9) y en la segunda corrida completa. No toca código de esta spec; queda anotado como posible prueba intermitente de Flota.
  - Antes se ejecutó `npm ci`: `node_modules` no tenía `nodemailer`, que ya estaba declarado en `package.json` de `develop`. No se agregaron dependencias.
- **Frontend** (`frontend/`): `npm test` 425 de 425 y `npm run lint` sin errores, ahora con `admin` y `tickets`. Prettier aplicado a los archivos nuevos y a los que ya cumplían en `develop`. `index.html`, `app.css`, `search-page.js` y `bus-form-view.js` ya no cumplían Prettier en `develop` y no se reformatearon completos.
- **Docker** (`docker compose --env-file NUL`, pila `qa-develop`, frontend en `127.0.0.1:8088` porque el 8080 está ocupado en el equipo de Edwin):
  - `nginx -t` correcto.
  - Las páginas de T1, `grupos-buses.html` y los módulos nuevos responden 200.
  - **Flujo completo en el navegador:**
    1. El administrador crea el grupo «Rutas cantonales QA» y lo ve en la lista; Operaciones enlaza a Grupos de buses.
    2. El cliente busca Ambato → Quito («8:30 a. m. · Llegada…», sin doble punto) y ve 42 asientos numerados en su posición, sin UUID.
    3. Elige el asiento 6 y solicita la revisión; el oficinista acredita la fecha de nacimiento.
    4. Resumen con «Asiento 6» y $5,50; reserva confirmada.
    5. El cliente sube un PNG (201) y el oficinista aprueba sin poder hacerlo antes de marcar la revisión.
    6. El cliente ve «compra aprobada» y su boleto con QR; el historial muestra la venta y una reserva anterior vencida.
- **T9** (frontend 427 de 427, lint en verde; Docker y navegador): el cliente llega a Mis reservas, el oficinista a Comprobantes, el administrador de cooperativa a Operaciones y el del sistema a Cooperativas. Con la sesión activa, el login muestra «Mis reservas» y «Cambiar cuenta» sin redirigir.
- **T10** (frontend 436 de 436, lint en verde; Docker y navegador):
  - Con la sesión activa, el login redirige a «Mi cuenta»; el panel muestra Ambato → Quito del jueves 12 de noviembre, 8:30 a. m., «Pagado · 1 pasajero · $5,50» con «Ver boletos», y la reserva vencida en recientes.
  - «Cerrar sesión» vuelve al formulario.
  - Una cuenta recién registrada entra al panel y ve los dos mensajes de lista vacía.
- **T11** (frontend 440 de 440, lint en verde; Docker y navegador): con sesión de cliente, «Buscar viajes» muestra «Mi cuenta» a la derecha y la portada cambia «Iniciar sesión» por «Mi cuenta» y oculta «Crear cuenta». Tras cerrar sesión vuelven «Iniciar sesión» y «Crear cuenta». «Mis reservas» y «Mis boletos» muestran la nueva cabecera con la página actual marcada; a 375 px de ancho los enlaces pasan a una segunda línea sin desplazamiento horizontal.
- **T12** (frontend 445 de 445, lint en verde; Docker y navegador): con `qa.coop@example.test`, «Cerrar sesión» en «Operaciones de cooperativa» lleva al login y `GET /api/v1/auth/me` responde 401 después. A 375 px, comprobantes, acreditaciones, registrar-bus y cooperativas cargan el script y no tienen desplazamiento horizontal.
- **T13** (frontend 454 de 454, lint en verde; Docker y navegador): en la pila QA, el oficinista no pudo rechazar sin motivo; con motivo, la reserva pasó a REJECTED y el asiento 7 quedó libre. Otra reserva venció a los 5 minutos, liberó el asiento 9 y el servidor rechazó el comprobante tardío con 409 `BOOKING_NOT_PAYABLE`. Con la corrección, «Mis reservas» muestra «Ana Prueba Rechazo · asiento 7». La reserva vencida muestra «La reserva venció», sin formulario y con «Elegir asientos de nuevo», que vuelve a un mapa de 42 asientos con el 9 libre. El retiro automático del formulario al cumplirse el plazo y el mensaje de `BOOKING_NOT_PAYABLE` se cubrieron con pruebas unitarias, no en el navegador.
- **T14** (frontend 454 de 454, lint en verde; Docker y navegador): con `qa.coop@example.test`, «Operaciones» muestra en la cabecera solo «Cerrar sesión». Flota tiene «Grupos de buses» y «Registrar bus» en una fila, y Frecuencias tiene «Crear frecuencia» y «Consultar frecuencias». El orden de destinos coincide con el que espera `admin-browser-smoke.cjs`. Con `qa.oficinista@example.test`, «Comprobantes» muestra Comprobantes (actual), Acreditar beneficios y «Cerrar sesión», sin desplazamiento horizontal. La prueba de humo no se ejecutó.
- **T15** (frontend 459 de 459; Docker y navegador): el login muestra «Volver al inicio» como botón contorneado que lleva a `../index.html`, sin desplazamiento horizontal.
- **T16** (backend 2235 unitarias y 749 de integración, lint y formato en verde; 3 pruebas nuevas en `validate-route-pattern.test.js`, sin cambiar las existentes). En QA, con `qa.coop`: sin traslado, la API responde 409 con el mensaje nuevo; con un traslado Quito → Ambato, en «Rutas cantonales QA» se guardan programación y tarifas, se publica la hoja del 14/11 y el viaje aparece en las próximas salidas. Además se comprobó el límite de dos ciclos sin terminar en «Rutas largas QA», que dejó un borrador vacío del 14/11 que no se puede borrar.
- **Limitaciones:**
  - `frontend/tests/bookings/browser.cjs` y `container.cjs` (pruebas manuales de BOOK-03) crean Reservas sin Route Sheets. Con T3, `seat-map` responde 503 en ese montaje y la pantalla no ofrece asientos; esas fixtures deben ampliarse con la distribución. No se ejecutaron.
  - `admin-browser-smoke.cjs` se actualizó (§10) pero no se ejecutó.

## 14. Revisión y cierre

Pendiente de revisión humana. Sin commits, push ni PR hasta que Edwin lo pida.
