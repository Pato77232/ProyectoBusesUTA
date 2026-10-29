# Evidencia de reservas

## Base
Referencia local de develop: 1de771370a06a7d478d4f4a0d8c56f209139070d. Copia aislada; autor de commits Leslie Coello. No se ha actualizado la referencia remota mediante red ni integrado trabajo ajeno.

## BOOK-01 — especificaciones
- Ocho specs y decisiones de producto documentadas conforme autorización de Leslie.
- Node 24.21.0; dependencias de package-lock instaladas sin cambiar versiones. El primer intento falló por permisos y el segundo por corte de red; el reintento terminó correctamente.
- npm run lint: aprobado.
- npm test: 175 pruebas unitarias aprobadas; 81 de integración fallidas por ausencia de base de pruebas y restricciones de conexión local. No se omitieron pruebas ni se cambió su contenido. Docker no estaba disponible en la revisión de entorno.
- Es un commit documental local; no se considera una integración aprobada ni se acredita funcionamiento completo del módulo.

## Operaciones Git
Cada incremento se conserva en una rama de tarea. Los incrementos posteriores pueden estar apilados sobre la rama anterior: revisar únicamente su diferencia respecto del padre indicado. Las recomendaciones de PR no ejecutan push ni merge. Revisor: Edwin.

## Preparación del PR documental en la carpeta original
Los seis commits se trasladaron previamente a la carpeta original de OneDrive por instrucción de Leslie. Esta rama documental se prepara allí. Se verificó por la conexión GitHub que develop sigue en la misma base; Git por HTTPS presenta cortes de conexión.

Se aclararon las decisiones autorizadas por Leslie y los contratos todavía no confirmados. No se presenta aprobación del equipo ni del revisor. Se conservaron los seis commits locales y las ramas de código.

Se intentó iniciar Docker y su servicio; Windows denegó acceso al servicio y el motor siguió ausente. No se alteraron privilegios del sistema ni bases de datos existentes. Los resultados de pruebas históricos anteriores corresponden a sus ejecuciones; la verificación de esta rama se registra al finalizar.

Verificación de esta rama documental en la carpeta original: lint y formato aprobados; npm test ejecutado con 175 unitarias y 4 HTTP aprobadas, 77 de integración fallidas por falta de URL/base de pruebas. El comando completo sigue fallido. No incluye las pruebas nuevas de dominio, que permanecen en sus ramas de código.
## BOOK-02 T1 — disponibilidad de dominio
- Base: feature/BOOK-01-especificaciones-reservas. Rama: feature/BOOK-02-T1-disponibilidad-dominio.
- Implementada consulta pura por viaje, cooperativa, asiento y tramo; no hay endpoint, persistencia ni pantalla todavía.
- 32 pruebas nuevas; 207 unitarias aprobadas en total. Lint y formato de archivos nuevos aprobados.
- npm test: integración sigue fallida (81 pruebas) por la configuración de entorno ya descrita. Sin cambios en pruebas existentes.
- No valida concurrencia de escritura: eso corresponde al bloqueo transaccional de BOOK-03.

## BOOK-04 T1 — pasajero por asiento
- Base: feature/BOOK-02-T1-disponibilidad-dominio. Rama: feature/BOOK-04-T1-pasajeros-dominio.
- Objeto mínimo inmutable; exige asiento y cédula como texto, conserva ceros y rechaza propiedades extra. No acredita documentos ni incorpora persistencia o formulario.
- 25 pruebas nuevas; 232 unitarias aprobadas en total. Lint y formato de archivos nuevos aprobados.
- npm test ejecutado: integración continúa sin base de pruebas; no es aceptación de producción.

## BOOK-06 T1 — plazo configurable
- Base: feature/BOOK-04-T1-pasajeros-dominio. Rama: feature/BOOK-06-T1-plazo-reserva.
- Política pura sin configuración oculta: plazo explícito de 180 a 300 segundos, comparación en el límite y protección de comprobante en revisión.
- 24 pruebas nuevas; 256 unitarias aprobadas en total. Lint y formato de archivos nuevos aprobados.
- npm test ejecutado; integración sigue sin base de pruebas en esta ejecución. Aún no hay liberación persistida ni proceso periódico: T2/T3 dependen de BOOK-03 y pagos.

## BOOK-04 T1b — comprobación local de cédula
- Base: feature/BOOK-06-T1-plazo-reserva. Rama: feature/BOOK-04-T1b-valida-cedula.
- Validador independiente de estructura/módulo 10 con fuentes oficiales y datos sintéticos. No consulta identidad real ni modifica el objeto mínimo o pruebas de T1.
- 15 pruebas nuevas; 271 unitarias aprobadas en total. Lint y formato de archivos nuevos aprobados. npm test ejecutado con integración sin base de pruebas.
- Se intentó iniciar Docker en segundo plano, pero su motor siguió sin estar disponible. No se creó ni limpió ninguna base de datos existente.

## BOOK-05 T2 — cotización individual
- Base: feature/BOOK-04-T1b-valida-cedula. Rama: feature/BOOK-05-T2-calcula-descuentos.
- Política de T1 registrada en reservas-decisiones.md; cálculo puro de tarifa por tramos en centavos, edad en salida, descuento único y redondeo por pasajero. No acredita identidad, no cobra ni obtiene tarifas del navegador.
- 32 pruebas nuevas; 303 unitarias aprobadas en total, de las cuales 128 pertenecen a las tareas de reservas.
- npm run lint y npm run format:check aprobados. Formato de todas las pruebas nuevas también aprobado.
- Verificación final npm test fuera de la restricción de conexión local: 303 unitarias y 4 pruebas HTTP de infraestructura aprobadas; 77 pruebas de integración fallidas por falta de URL/base de pruebas. El comando completo sigue fallido. Docker continúa sin motor disponible incluso fuera del sandbox.
- No se cambió ninguna prueba existente, migración, versión de dependencia ni configuración global de Git. Trabajo asistido por Codex siguiendo las convenciones y archivos de OpenCode, con autorización de Leslie para ramas y commits.

## Próximo incremento y PR
Recomendar ahora PR documental de feature/BOOK-01-especificaciones-reservas hacia develop para que Edwin revise alcance y decisiones. Los incrementos de código se pueden revisar en borrador contra su rama padre; no recomendar integrarlos como funcionalidad completa hasta verificar PostgreSQL y los contratos reales.

El siguiente incremento ejecutable de extremo a extremo es BOOK-02 T2: acordar e implementar puertos/adaptadores de viaje y plantilla. BOOK-03 requiere esas fuentes y un contrato de comprador. BOOK-06 T2 y BOOK-07 requieren la operación atómica de reserva/comprobante de Shirley. BOOK-08 requiere una base frontend conectada. No se sustituyen con datos ficticios en producción ni se declara el módulo terminado.

## BOOK-04 T1c — datos completos del pasajero
Trabajo en la carpeta original el 25 de octubre de 2026. Base feature/BOOK-05-T2-calcula-descuentos (19fe2d8); rama feature/BOOK-04-T1c-datos-pasajero. Se compone el pasajero mínimo con validación local de cédula, nombre Unicode y nacimiento civil no futuro respecto de una fecha explícita de servidor. No se certifica identidad ni beneficios.

65 pruebas nuevas; 368 unitarias aprobadas. Lint y formato aprobados. npm test completo fallido: 4 HTTP aprobadas y 77 pruebas de integración fallidas por ausencia de URL/base PostgreSQL. No se usó una base de datos existente. La rama documental del PR #12 se conserva sin cambios. Se conserva esta tarea en commit local por autorización de Leslie; no es una aceptación de integración.

## BOOK-04 T1d — correspondencia entre pasajeros y selección
Trabajo en la carpeta original el 25 de octubre de 2026. Base feature/BOOK-04-T1c-datos-pasajero (1dd0e6c); rama feature/BOOK-04-T1d-pasajeros-seleccion. Se exige exactamente un pasajero completo por asiento seleccionado y se conserva el orden de la selección. Se rechazan cantidades diferentes, asientos repetidos, pasajeros ajenos o inválidos y listas dispersas, sin modificar entradas. No se añade una prohibición de cédula repetida no acordada.

38 pruebas nuevas; 406 unitarias aprobadas en total (103 nuevas en T1c/T1d). Lint y formato aprobados. npm test completo sigue fallido: 4 HTTP aprobadas y 77 pruebas de integración fallidas por falta de URL/base PostgreSQL. No se debilitó ninguna prueba anterior ni se usó una base existente.

Las ramas T1c/T1d son incrementos apilados sobre el código previo de reservas, no sobre el develop actual que ya incorpora flota. El PR documental #12 permanece en c98db4d. No se hicieron push, merge ni rebase. El PR de estos incrementos debe comparar cada tarea con su rama padre para revisar solo su diferencia; antes de integrarlos hacia develop se deben revisar las dependencias previas, disponer de la base aislada y resolver los resultados de integración. No se presenta una reserva persistida ni una pantalla funcional.

## BOOK-01 T2 — base actualizada en la carpeta original

Fecha: 25 de octubre de 2026. Rama feature/BOOK-01-T2-actualiza-base-reservas, creada desde origin/develop 67ee38d947058be53e17a0479f4404b1d3c42bf6. Se trasladaron con cherry-pick -x los dos commits documentales y los siete incrementos de código, conservando autoría y referencias de origen. Se conservaron ambas notas históricas cuando coincidían sus posiciones en las specs BOOK-04/05/06 y en este registro; no hubo conflictos de código.

Las ramas anteriores siguen en sus commits originales; feature/BOOK-04-T1d-pasajeros-seleccion conserva f62742d y la rama del PR #12 conserva c98db4d. Los archivos de código y pruebas de bookings son idénticos a los de f62742d. No hay diferencias de código ajeno, migraciones, dependencias o pruebas ajenas respecto de la nueva base. No se ejecutaron merge, rebase, push ni tags.

Validación real: lint aprobado; 470 pruebas unitarias aprobadas en 34 suites. npm test completo fallido: 4 pruebas HTTP aprobadas y 103 de integración fallidas porque no hay DATABASE_URL/base PostgreSQL de pruebas disponible en esta ejecución. Se eliminó DATABASE_URL solo del entorno temporal de la ejecución para no utilizar una base existente. No se leyeron archivos .env ni se cambiaron las pruebas.

Formato global fallido en 26 archivos ya presentes e idénticos a origin/develop, ajenos a reservas; formato del código y pruebas de bookings aprobado. No se reformatea código del equipo incidentalmente.

Docker Desktop está instalado; se intentó iniciarlo en segundo plano. El motor sigue ausente y com.docker.service está detenido. Se solicitó a Leslie abrir Docker Desktop e informar el estado del motor. No se creó, limpió ni conectó ninguna base existente. El Compose de pruebas del equipo ya define busesuta_test en localhost:55433, con almacenamiento efímero y credenciales exclusivas de pruebas; se utilizará cuando el motor esté disponible.

PabloToapanta aprobó el PR documental #12 sobre c98db4d el 25 de octubre. El PR sigue siendo independiente de esta rama. Se recomienda integrar la documentación conforme a las comprobaciones de GitHub; esta preparación no ejecuta ese merge ni declara aprobados los incrementos de código.

Se revisaron las APIs reales y se añadió el estado actual en reservas-contratos.md. Aún faltan viaje comercializable y plantilla de asientos; no se puede acreditar una reserva persistida ni la compra completa.

## BOOK-01 T2 — verificación con PostgreSQL operativo

Fecha: 25 de octubre de 2026. Leslie abrió Docker Desktop; el motor respondió correctamente. Se comprobó que el puerto 55433 estaba libre y se creó el proyecto Compose exclusivo busesuta-leslie-tests mediante docker-compose.test.yml. Antes de ejecutar la suite se verificaron la base busesuta_test, el usuario test_user y cero tablas de aplicación. No se usaron los contenedores de otros proyectos.

La URL del contenedor se configuró únicamente para la ejecución; no se leyeron ni editaron archivos .env. npm run lint aprobado. npm test completo aprobado: 470 pruebas unitarias en 34 suites y 107 de integración en 12 suites; 577 pruebas aprobadas, sin fallos. Las migraciones y recorridos de integración se verificaron contra PostgreSQL 16.13 del contenedor nuevo. No se cambiaron pruebas, código, migraciones ni dependencias para obtener este resultado.

Esta ejecución sustituye la limitación de PostgreSQL de la ejecución anterior, cuyo resultado histórico se conserva. El formato global sigue pendiente por los 26 archivos preexistentes ya identificados; el formato de bookings está aprobado. Las 577 pruebas no incluyen un flujo de compra de reservas de extremo a extremo, todavía no implementado.

Al terminar se detiene y elimina únicamente el proyecto Compose temporal busesuta-leslie-tests; su almacenamiento es efímero. Para repetir la comprobación: docker compose -p busesuta-leslie-tests -f docker-compose.test.yml up -d --wait; configurar la URL de pruebas del proyecto en la terminal y ejecutar npm test desde backend. Consultar docs/testing-database.md. No se publicó la rama ni se integró el PR #12.

## BOOK-02 T2a — caso de uso de disponibilidad

25 de octubre de 2026, carpeta original. Rama feature/BOOK-02-T2a-consulta-disponibilidad, base feature/BOOK-01-T2-actualiza-base-reservas en 20c7915. Se escribió primero la spec BOOK-02-T2a y se implementaron el caso de uso, la validación de consulta/snapshot, el error de viaje no disponible y los contratos internos de lectura. Se reutiliza sin cambios el cálculo de solapamiento de T1.

Se rechazan campos extra del cliente y se obtiene cooperativa e inventario del catálogo. Se valida identidad del viaje y límite de ruta antes de leer ocupaciones; errores de proveedores se propagan sin ofrecer asientos ficticios. El resultado conserva el orden de plantilla, es inmutable y solo expone seatId/status. Los dobles se encuentran exclusivamente en pruebas; no hay adaptador ni endpoint de producción todavía.

53 pruebas nuevas aprobadas. Verificación completa: 523 unitarias y 107 de integración, 630 aprobadas sin fallos. Lint y formato de reservas aprobados; formato global fallido en los mismos 26 archivos preexistentes del equipo. Sin cambios en pruebas anteriores, migraciones, dependencias o módulos ajenos. Base temporal nueva busesuta_test con cero tablas antes de ejecutar, proyecto Compose busesuta-leslie-book02 retirado al terminar. No se tocaron bases de otros proyectos.

El PR documental #12 ya fue integrado por Leslie en develop (b58d072). Esta rama mantiene los incrementos locales previos; al preparar un PR debe revisarse su alcance acumulado o compararse la tarea con su padre 20c7915. No se publica ni integra en esta tarea. Pendiente: acordar catálogo de viaje comercializable y plantilla con David/Edwin e implementar los adaptadores a través de sus APIs públicas.

## BOOK-03 T1 A — resumen compuesto de compra
27 de octubre de 2026. Carpeta original; rama feature/BOOK-03-resumen-creacion-dominio desde origin/develop e96a277, que integra el PR #15. Spec escrita antes de implementar. Se compone el contexto de viaje con el manifiesto de pasajeros y la cotización existente; valida pertenencia, límites, tarifas por tramo, beneficios explícitos y totales seguros. El resultado privado e inmutable no tiene estado, ID ni plazo de reserva, y no acredita identidad o descuentos oficialmente.

45 pruebas nuevas; 595 unitarias aprobadas. Lint y formato de reservas aprobados. npm test completo fallido: 4 de integración aprobadas y 103 fallidas por falta de URL/base de pruebas. Docker Desktop no logró iniciar desde esta sesión; se solicitó a Leslie abrirlo. Formato global fallido en 27 archivos preexistentes de la base, sin cambios en ellos. No se alteraron pruebas previas, migraciones, dependencias ni módulos ajenos. La parte B se implementará como segundo commit de la misma entrega; no se publica un PR por cada paso. Código asistido por Codex; revisión humana pendiente.

## BOOK-03 T1 B — aceptación y valor inicial de reserva
27 de octubre de 2026. Misma rama de la parte A, cuyo commit es ae5f29d. Se añade creación pura de valor inicial PENDING_PAYMENT con aceptación explícita, ID/propietario del contexto de servidor y plazo de 180–300 segundos reutilizando BOOK-06. Recalcula el resumen, valida selección/pasajeros y usa fechas ISO inmutables. No persiste ni bloquea, no genera IDs ni simula identidad, viajes, acreditación de beneficios o correo. Precio cambiado, idempotencia de creación y versión del resumen quedan pendientes de acuerdo antes de escritura.

36 pruebas nuevas; 81 en conjunto con A. Resultado final: 631 unitarias aprobadas, lint y formato de reservas aprobados. npm test fallido por el entorno: 4 de integración aprobadas y 103 fallidas por falta de URL/base PostgreSQL de pruebas. Docker continúa sin motor disponible tras el intento de inicio. Formato global fallido en 27 archivos preexistentes, no modificados. Las cifras difieren de la rama documental anterior porque el PR #15 ya está integrado y esta base incluye además el dominio de payments.

No se modificaron pruebas anteriores, módulos ajenos, dependencias, migraciones ni composición. A y B son dos commits del mismo incremento de dominio; no se presentan como compra operativa ni se publica un PR por cada commit. Revisión humana y verificación de integración/bloqueo pendientes. No se ejecutaron push, merge, rebase ni tags.

## BOOK-03 T2 — persistencia y bloqueo transaccional
28 de octubre de 2026. Continuación de ae5f29d/7eb41ba en la misma rama y carpeta original. Leslie delega elegir los contratos de viajes/asientos por el acuerdo que transmite de David y Edwin. Spec BOOK-03-T2 y ADR 0005 escritos antes de implementar. Nueva migración de tres tablas propias y repositorio privado: coordinación por cooperativa/viaje con SELECT FOR UPDATE, contexto preparado después del bloqueo, cálculo de dominio, consulta de ocupaciones efectivas, inserción de reserva y todos los asientos en una transacción. Consulta privada filtrada por propietario/cooperativa e inventario sin datos personales. No hay FK ficticia a tablas de viaje ni dependencia de capas internas ajenas; las referencias externas son lógicas y deben verificarse en el futuro caso de uso.

16 pruebas nuevas de integración aprobadas, incluida carrera con barrera y espera observada en PostgreSQL, y rollback real tras fallo inyectado en la segunda ocupación. Suite completa: 631 unitarias + 123 de integración = 754 aprobadas. Lint y formato de archivos nuevos/adaptados aprobados. Formato global fallido en 27 archivos preexistentes de la base. Se adaptó el recorrido de la prueba de reversibilidad de flota para localizar su migración, conservando todas las aserciones; las migraciones previas y versiones de dependencias permanecen intactas.

Docker respondió inicialmente, se perdió al crear la base y los intentos de CLI esperaron su arranque; el acceso de Computer Use a su ventana expiró sin autorización de la aplicación. Tras confirmación de Leslie volvió a responder. Se usó solo el contenedor nuevo busesuta-leslie-book03 y busesuta_test, con cero tablas antes de pruebas. La ejecución sin URL previa tuvo 119 fallos de integración y 4 HTTP aprobadas; la ejecución posterior completa con base aislada resolvió esos fallos. No se leyeron archivos .env ni datos reales ni se cambiaron protecciones o configuración del sistema. El contenedor temporal se retira tras comprobar los resultados.

T2 verificada localmente, pendiente de revisión humana. T3/T4, catálogo y plantilla reales, acreditación, identidad invitada, API de pagos y coordinación de expiración siguen pendientes; no se declara compra operativa. No se publican ramas ni PR por cada commit; se mantiene esta entrega con las dos partes de T1.

## BOOK-03 T3 — casos de uso de resumen y creación

29 de octubre de 2026. Misma carpeta original y rama de T1/T2. Se implementan getBookingSummary y createBooking con revisión del resumen, identidad resuelta por puerto confiable, acreditación explícita y relectura del contexto dentro de la transacción de T2. Un cambio de resumen exige nueva aceptación, sin cobrar otro precio silenciosamente. La revisión es detección de cambio, no autenticación ni promesa de disponibilidad.

69 pruebas nuevas en T3 (32 resumen, 30 creación y siete integración). Suite completa: 693 unitarias + 130 de integración = 823 aprobadas; lint y formato de archivos nuevos aprobados. Formato global conserva 27 archivos preexistentes ajenos. PostgreSQL 16.13 aislado en busesuta-leslie-book03-t3, vacío antes de migrar; sin .env ni datos existentes. No cambia app.js ni server.js. Proveedores de pruebas explícitamente simulados; no se habilita compra pública.

Leslie confirma entregas por funcionalidad: los commits se acumulan para un único PR de creación de reservas hacia develop. El contrato del PR #17 permanece conservado para la posterior implementación de pagos/expiración. T4, composición con catálogo/asientos/acreditación reales y recuperación de creación incierta siguen pendientes.

## BOOK-03 T3 R — recuperación tras respuesta perdida

29 de octubre de 2026. Se continúa en la carpeta y rama originales con una única entrega funcional. Spec BOOK-03-T3-R previa a código. requestKey opcional en el caso de uso privado, obligatorio para el futuro HTTP: se vincula al comprador verificado y al contenido aceptado. La transacción serializa el intento, recupera una reserva existente sin recalcular ni prolongar su plazo, o crea todos los asientos junto a sus metadatos. Una misma clave con otros datos da BOOKING_REQUEST_KEY_REUSED. La identidad se comprueba cada vez y la clave sola no permite lectura.

Nueva migración de columnas/índice/validación, sin editar las anteriores. El guardado T2 se comparte entre reserve y reserveOnce. Se añade a la prueba previa de reversibilidad el recorrido por migración objetivo, manteniendo todas sus aserciones. Los fallos de COMMIT se devuelven como resultado desconocido: puede reintentarse con la misma clave; no se afirma que siempre hubo rollback.

Pasaron 53 pruebas nuevas, 44 de integración de reservas y la suite completa de 876 pruebas (725 unitarias + 151 integración). Lint y formato de archivos afectados aprobados; formato global mantiene 27 archivos preexistentes ajenos. Base PostgreSQL exclusiva busesuta-leslie-book03-reintentos, vacía antes de migrar y retirada tras verificar. Sin .env, datos existentes, cambios de dependencias ni composición. origin/develop actualizado solo como referencia en f26415d; no se ejecutó merge ni se publicó un PR por este commit.

La migración inversa conserva reservas pero elimina las claves; su reaplicación no restaura metadatos perdidos. API, pantalla y composición real siguen pendientes; no se presenta una compra pública operativa ni una aprobación humana.

## BOOK-03 T4 A — transporte HTTP y composición

29 de octubre de 2026. Se actualizó solo la rama feature/BOOK-03-resumen-creacion-dominio desde origin/develop f26415d; commit local 8df558a. Único conflicto en prueba de reversibilidad de flota: se conservó la versión revisada de develop con recorrido por nombre, aserciones y restauración. No se fusionó la entrega de Leslie hacia develop ni se reabrió PR #17.

Con spec BOOK-03-T4 previa, se añadieron index.js de reservas, adaptadores de identidad/configuración/fecha y router HTTP. app.js/server.js montan las rutas preservando pagos. POST de resumen/creación requieren sesión CUSTOMER y CSRF; creación exige Idempotency-Key válido. Proyección de disponibilidad sin personas; errores y respuestas privadas sin caché, incluidos errores del parser JSON. Configuración única BOOKING_PROOF_WINDOW_SECONDS (180 a 300, inicial 300).

Sin catálogo o verificador reales, las nuevas compras reciben 503; no se añade inventario de prueba al servidor. Recuperar una reserva ya guardada no consulta proveedores faltantes ni cambia su plazo. El contrato de transporte está en reservas-api.md. La prueba de arranque real confirma health y el montaje protegido, no una compra de producción ni la disponibilidad real de viajes.

Pasaron 27 unitarias nuevas y 25 HTTP con PostgreSQL/JWT/sesiones/CSRF reales. Suite completa sobre base actualizada: 766 unitarias + 185 integración = 951 aprobadas, 65 suites. Lint y formato de archivos propios aprobados; formato global conserva 24 archivos preexistentes ajenos. Sin migraciones/dependencias nuevas ni pruebas previas debilitadas.

Se usó solo la base temporal nueva busesuta-leslie-book03-http, cero tablas antes de migrar; se retiró su contenedor/red al terminar y se cerraron servidores/pools. No se leyó .env ni se usaron bases de otros proyectos. T4 B y proveedores reales pendientes; un único PR funcional futuro, sin publicación por este paso.

## BOOK-03 T4 B — pantalla y resultado recuperable

29 de octubre de 2026. Consulta GET propia implementada en 7a57e1c para recuperar la reserva sin persistir pasajeros en navegador; 961 pruebas backend aprobadas. La pantalla usa diseño local, transporte compartido y solo la referencia UUID en sessionStorage. Datos/precios/estado/plazo proceden del servidor; no hay inventario o acreditación simulada en producción.

Pasaron 45 pruebas frontend, lint, formato y Chrome headless Windows con backend/PostgreSQL/JWT/CSRF reales y fixtures explícitas de viajes/acreditación. Verificados tarifa cambiada con datos conservados, nueva aceptación, doble envío y 201 perdido después de COMMIT mediante 502 controlado, recarga con GET y mismo ID/plazo. 401/503/vacío informan sin inventar viajes; botón de consulta permite recuperarse cuando vuelve el servicio.

Capturas de escritorio/móvil y ampliación CSS 200% revisadas; contraste de muestras y teclado/foco verificados. Zoom nativo, lector de pantalla y dispositivos físicos pendientes. La portada anterior pasó su smoke sin cambiar comprobaciones. Imagen real empaqueta página/API/módulos con MIME correcto y excluye docs/tests; usuario nginx, 404 reales y retirada del contenedor/red de QA confirmados. Se corrigieron incidencias de la simulación de pérdida de respuesta, clasificación de URLs no HTTP y montaje del botón, repitiendo las verificaciones finales.

Base temporal busesuta-leslie-book03-pantalla retirada (Docker demoró el cierre y luego lo confirmó); sin .env, datos existentes o dependencias nuevas. Persisten 24 avisos preexistentes de formato backend. Pendientes proveedores reales/entrada desde búsqueda y login/revisión humana. Un solo PR funcional futuro, sin publicar este paso.
