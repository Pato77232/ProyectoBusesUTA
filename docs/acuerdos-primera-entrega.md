# Acuerdos funcionales para la primera entrega

## Cierre del contrato de programación D-01 — 1 de noviembre de 2026

El solicitante reportó revisión conjunta con Edwin y Leslie, aceptación de las propuestas y delegó concretar los detalles. Registro completo en [ROUTE-SHEETS-04](specs/ROUTE-SHEETS-04.md): intervalos fechados, margen explícito por actividad, ubicación inicial, traslados, bloqueos, patrón manual repetible en días, dos ciclos totales incluida base, horizonte desde inicio del patrón y cierre en la hora de embarque. Renovación explícita mantiene máximo de dos períodos no terminados confirmados. Este registro reemplaza los pendientes incompatibles de §§1 y 3 para ese contrato; no acredita aprobación de código ni implementación. La planificación de las secciones 0–2 está autorizada, la ejecución de cada una espera petición humana. Tarifas, accesibilidad y reubicación de pasajeros conservan sus pendientes propios.

## Fuente, alcance y estado

Registro del 1 de noviembre de 2026, America/Guayaquil. Fuente: respuestas humanas del solicitante en el chat y apuntes adjuntos «actividades» leídos en esta sesión. Se registra lo comunicado por el solicitante; no se atribuyen respuestas individuales ni revisión de código a los otros integrantes. Base local examinada: `develop`/`origin/develop` `0b4041e`. No se pudo refrescar el remoto en la revisión previa; no se certifican cambios posteriores.

Rama documental: `feature/acuerdos-funcionales-primera-entrega`. Spec: [ACUERDOS-01](specs/ACUERDOS-01.md). Este documento registra decisiones y propuestas; no acredita implementación, entrega completa ni integración. Las reglas funcionales vigentes se resumen en [business-rules.md](business-rules.md). Las contradicciones de specs anteriores se resuelven por las actualizaciones explícitas enlazadas aquí, conservando su evidencia histórica.

Estados: **Confirmado** = respuesta humana comunicada; **Propuesto** = recomendación técnica del asistente, pendiente de validación de los responsables; **Pendiente** = decisión aún no tomada. La aprobación de este cambio documental no sustituye revisión de código ni aceptación individual de contratos compartidos.

## 1. Viajes y comercialización — confirmado

- La hoja de ruta es la fuente de programación. Cada hoja corresponde a un grupo operativo de buses (rutas largas, cantonales, urbanas/rurales); tipo operativo y categoría de asiento VIP/NORMAL son conceptos diferentes.
- Un viaje es una salida fechada vinculada a una asignación de hoja, frecuencia y bus, con identidad estable propia. Una frecuencia recurrente no sustituye al viaje.
- La venta requiere una salida programada con frecuencia y bus, asiento disponible en el tramo, reserva y validación del pago por un oficinista. Elegir un asiento no equivale a venderlo.
- Las frecuencias directas tienen origen, destino y hora de salida; las de paradas añaden puntos ordenados y horas de embarque. Las paradas pueden ser origen de compras. La resolución ANT es obligatoria; el proyecto no tramita ni verifica su aprobación ante un ente externo.
- Mostrar fecha y hora de embarque del punto elegido, incluyendo el día siguiente si se cruza medianoche. El solicitante aceptó esta propuesta expresamente.
- El horizonte de compra es dos veces la duración del ciclo: ciclo de 20 días, horizonte de 40 días. Se limita a dos la generación de ciclos. Renovar la programación requiere confirmación del administrador de cooperativa en cada renovación.
- Desactivar frecuencias se admite después de terminar el ciclo de la hoja; no habilita cancelar obligaciones de reservas/ventas existentes.
- Clientes y oficinistas consultan viajes; la búsqueda consolida cooperativas y sirve a compra en línea y presencial. Esto confirma usuarios del flujo, no asigna un implementador de `search`.

**Pendientes de precisión:** instante desde el que se cuentan los dos ciclos y límite inclusivo/exclusivo; cierre de venta antes de cada embarque; semántica exacta de «dos ciclos» (si incluye la hoja base); bloqueo de desactivación cuando otra hoja/ciclo confirmado o una venta futura siga dependiendo de la frecuencia. Mostrar hora no sustituye estas decisiones.

**Propuesta de seguridad operativa:** vender solo viajes generados y confirmados dentro del horizonte, nunca salidas hipotéticas. Usar publicación como confirmación de programación comercializable. Requiere validación en la spec de viajes.

## 2. Tarifas y beneficios — confirmado

**Implementación local posterior:** ROUTE-SHEETS-05 sección 2 incorpora congelación transaccional, lectura aislada y contrato de consulta confirmado expresamente por el solicitante: findPublishedByRouteSheetId y findPrice. Null para copia/par autorizado ausente; errores técnicos se propagan. La antigua mención de firma pendiente es histórica; integración con Bookings y revisión humana siguen pendientes. No se atribuye respuesta individual nueva de Leslie. Ver [spec §13](specs/ROUTE-SHEETS-05.md).

Plan de ejecución D-02: [ROUTE-SHEETS-05](specs/ROUTE-SHEETS-05.md), sección 0 documental preparada sobre 8886553. Las propuestas pendientes de esta sección siguen sin aprobación adicional; la nueva spec las delimita, no las convierte en decisiones humanas. Tres secciones: definición, configuración de borrador y congelación/consulta al publicar; un commit por sección si el humano lo solicita.

**Confirmación posterior del solicitante, 1 de noviembre:** mayor descuento acreditado sin acumular; congelar al publicar por administrador de cooperativa; renovación copia a borrador editable; porcentajes VIP/beneficios entre 0 y 100 % con dos decimales, cero explícito; máximo base USD 99 999 999,99; matriz completa ingresada sin deducir precios. Reemplaza los pendientes incompatibles que se conservan abajo como historia. Contrato público de lectura aún debe acordarse con Leslie; no se le atribuye respuesta individual nueva ni revisión del código. Implementación local de configuración en ROUTE-SHEETS-05 §12; congelación efectiva pendiente de sección 2.

- Frecuencia directa: tarifa origen–destino. Con paradas: precio explícito para cada combinación válida de subida y bajada en orden de recorrido. No suponer que se obtiene sumando tramos contiguos.
- El administrador de cooperativa define importes, porcentaje de recargo VIP y porcentajes de descuento. Se conserva minoría de edad **menor de 18 años**, tercera edad desde 65 y discapacidad acreditada. Reemplaza la propuesta intermedia de menores de 12 años y el porcentaje fijo del 50 % registrado anteriormente.
- Para un asiento VIP se aplica primero el incremento y después el descuento elegible sobre ese importe. La categoría del asiento y el beneficio del pasajero son independientes.
- Al establecer la hoja se congela su política tarifaria (precios y porcentajes); los cambios ordinarios se aplican a la siguiente hoja, no alteran compras ni salidas de la hoja ya establecida.
- Se conservan USD, centavos enteros, redondeo de mitad hacia arriba una vez al final por pasajero y desglose de base, recargo, descuento y total. El navegador no determina el importe autorizado.

**Pendientes:** si coinciden beneficios con distintos porcentajes, cuál prevalece (no se autoriza acumulación por silencio); límites permitidos de configuración; quién verifica la configuración antes de usarla; instante exacto de congelación (borrador o publicación). La configuración académica no acredita cumplimiento legal de tarifas reguladas y no debe presentarse como una regla legal.

**Propuesta:** un solo beneficio, el mayor aplicable, con fórmula `base × (1 + vip/100) × (1 - beneficio/100)`, aritmética exacta y redondeo final. Confirmar antes de implementar.

## 3. Programación, rotación y sustitución

**Confirmado:** el administrador asigna buses a frecuencias; un mismo bus puede realizar varias frecuencias. Ejemplo aportado: Ambato–Latacunga, Latacunga–Quito y Quito–Ambato. La duración de la hoja depende del patrón de buses/frecuencias; no existe duración fija aprobada. Días de parada sirven para descanso, mantenimiento o eventual sustitución. La configuración ordinaria del bus/hoja no cambia en la programación vigente; se prepara para la siguiente.

**Propuesta técnica para discutir con David y Edwin:**

1. Programar servicios con salida y llegada fechadas, ubicación inicial/final y margen de preparación explícito; incluir cambios de fecha. Se necesitan duraciones/horas de llegada que las frecuencias actuales no garantizan.
2. Permitir asignaciones múltiples del bus si no se solapan, termina en el origen del siguiente servicio y existe tiempo de preparación. Un traslado sin pasajeros también ocupa tiempo y necesita definición, no se supone instantáneo.
3. Validar cobertura de todos los servicios. La condición `frecuencias ≤ buses` deja de ser suficiente y no debe conservarse como regla general: dos buses pueden cubrir tres servicios compatibles, pero dos servicios simultáneos requieren dos buses.
4. Clasificar la parada como descanso, mantenimiento o disponibilidad de respaldo. Un bus en mantenimiento no es sustituto; un descanso no se interrumpe automáticamente. Autorizar únicamente un respaldo habilitado y compatible.
5. Primero acordar un patrón manual factible. El ciclo termina al repetir el patrón completo de asignaciones/descansos; no inventar una fórmula basada solo en cantidades. La generación automática copia/rota ese patrón únicamente después de validar disponibilidad, ubicación y cobertura.
6. Sustitución por avería: excepción auditada con motivo, autor y relación bus anterior/nuevo; comprobar compatibilidad, capacidad y correspondencia de cada asiento reservado/vendido. Si no existe correspondencia, no completar automáticamente. Resolver reubicación y comunicación con pasajeros mediante acuerdo operativo.

**Pendientes antes de implementar:** fuente de llegadas y márgenes, rotación/equidad concreta, duración del patrón, compatibilidad de tipos y tratamiento de reubicación sin capacidad. No se declara aprobado un algoritmo por este registro. Se debe reconciliar ROUTE-SHEETS-01 (un bus por hoja y conteos) con asignaciones múltiples.

## 4. Flota y asientos

**Confirmado:** cubrir asientos normales, VIP y espacios de accesibilidad; los cambios de configuración se aplican a la siguiente hoja. Las tres plantillas actuales normales no satisfacen por sí solas todo RN-12.

**Contrato propuesto, pendiente de Edwin–David–Leslie:** Fleet entrega por API pública bus, cooperativa, grupo, placa/unidad, características, fotos autorizadas e inventario de asientos con identidad estable, etiqueta, piso, geometría, categoría y condición de ofrecido. Los espacios de accesibilidad no se convierten automáticamente en asientos normales. Viajes obtiene la configuración versionada correspondiente a su hoja; Reservas calcula ocupación por viaje y tramo. El usuario no elige `cooperative_id` ni inventario como autoridad.

**Pendientes:** cómo se reserva un espacio accesible, capacidad/acompañante, configuración visual y compatibilidad de sustituciones. Una especificación posterior delimitará cada incremento; no se editan plantillas ya publicadas silenciosamente.

## 5. Personas, cuentas y acceso

**Confirmado:** correo obligatorio para comprar un puesto. Para menores debe identificarse un adulto responsable y usar sus datos de contacto. El comprador recibe todos los boletos y el comprobante de compra; cada pasajero adulto recibe su boleto al correo correspondiente y el responsable recibe el del menor. Documentos extranjeros fuera de la primera entrega.

La cédula relacionará pasajeros e historial; el comprador podrá autocompletar sus propios datos al identificarse. Vincular historial de pasajeros previos a una cuenta exige verificar titularidad: escribir una cédula no autoriza acceso ni autocompletado de datos de terceros. Este control es una propuesta técnica necesaria, no una integración de identidad ya disponible.

El pasajero aporta acreditaciones; el oficinista revisa los datos/documentos antes de aprobar. La verificación física de embarque y el eventual cobro de diferencia por acreditación incorrecta quedan como **requisito futuro Chofer/Controlador**, fuera de esta fase según AGENTS.md y los apuntes. No se introduce ese rol ni caja a bordo. Falta acordar el procedimiento externo de la primera entrega si se detecta una acreditación falsa; no se simula como resuelto.

**Propuesta para invitado:** enlace secreto de alta entropía por correo, hash persistido, vencimiento y reenvío limitado; autoriza solo la compra asociada. No acceso por cédula/UUID. Pendientes duración, límites, revocación y mecanismo de acreditación de titularidad para vincular historial.

**Confirmado:** SYSTEM_ADMIN crea cooperativa y su administrador; COOPERATIVE_ADMIN gestiona datos de su cooperativa y crea oficinistas de esa misma cooperativa. Oficinista vende en caja y valida comprobantes. Recuperación de contraseña y verificación de correo forman parte del alcance solicitado; necesitan specs propias. MFA no fue confirmado separadamente y permanece pendiente.

## 6. Reserva, comprobante y venta

**Confirmado:**

1. Al aceptar resumen se crea reserva y bloqueo por tramo; plazo inicial de carga configurable entre 3 y 5 minutos, inicial documentado de 5. Sin recepción aceptada dentro del plazo, expira y libera atómicamente.
2. Todo pago no efectivo necesita comprobante y validación del oficinista. La afirmación no decide integración de tarjeta: métodos no especificados no se habilitan con simulaciones presentadas como reales.
3. Máximo 5 MiB por comprobante. PDF/JPEG/PNG se conservan como propuesta hasta ratificar formatos.
4. Tras subir el comprobante, se permiten correcciones durante 3 minutos contados desde la primera carga. El oficinista puede aprobar antes: desde la aprobación ya no se permite reemplazo.
5. Tras esos 3 minutos, solo una solicitud de corrección del oficinista reabre la edición; el comprador dispone de 15 minutos y recibe aviso por correo. Se distingue solicitud de corrección de rechazo definitivo (que mantiene justificación obligatoria).
6. La revisión mantiene asientos reservados y no vende antes de aprobación. En caja, el oficinista puede registrar pago en efectivo y completar la venta autorizada sin exigir al cliente un archivo de depósito.
7. Mostrar instrucciones según el medio de pago. Falta definir la configuración de las cuentas receptoras y medios concretos.

**Propuesta de estados:** reserva pendiente de comprobante → en revisión ↔ corrección solicitada → confirmada; expiración inicial y rechazo definitivo liberan según sus reglas. No son nombres de tablas/columnas aprobados.

**Pendientes:** desde cuándo corren los 15 minutos (recomendado: registro de la solicitud en servidor); qué pasa si vencen sin corrección; límite de solicitudes; cómo se protege una revisión frente a reemplazo concurrente. Propuesta: versiones de archivo/auditoría, aprobación sobre versión vigente, bloqueo transaccional por reserva y aviso durable. Conservar el comprobante y reintentar ante resultado incierto; no borrar evidencia de pago por un timeout. La recepción/expiración inicial ya acordada sigue vigente; no reiniciar el plazo inicial con cada reemplazo.

## 7. Boletos y recuperación ante fallos

**Confirmado:** boleto individual por pasajero, acceso del comprador a todos y envío a pasajero/responsable. Wallet se pospone expresamente hasta después de la primera entrega; no mostrar una integración ficticia.

**Propuesta técnica:** al aprobar, confirmar venta y registrar aviso durable de emisión en la misma transacción que corresponda al dueño de la venta. Tickets consume idempotentemente, emite un boleto por pasajero y registra envío de correo reintentable. Si falla emisión: venta confirmada con emisión pendiente; si falla correo: boleto disponible para descarga y envío pendiente. No liberar un asiento vendido ni repetir cobro por un fallo de correo. Separar venta, emisión y entrega. Contrato técnico y recursos de correo/QR aún requieren specs; no es evidencia de implementación.

## 8. Fronteras propuestas entre módulos

| Módulo | Dueño de información y responsabilidad | Intercambio público propuesto |
|---|---|---|
| auth | Cuentas, sesiones, roles, recuperación/verificación, contexto autorizado | Identidad verificada, permisos y acceso invitado delimitado |
| tenants | Cooperativa y configuración institucional | Configuración autorizada; asignar propiedad de política comercial con la spec correspondiente |
| fleet | Buses/grupos, versiones de configuración, fotos y asientos físicos | Inventario estable y características; no ocupación por viaje |
| frequencies | Recorrido, horarios, resolución ANT y estado | Consultas públicas aisladas; configuración base de tarifas por acordar |
| route-sheets | Programación, ciclos, asignaciones y copia congelada de política comercial | Viajes fechados, recorrido/embarque, bus, política e inventario asociados a hoja |
| search | Lectura pública consolidada | Resultados sanitizados; no reserva ni escritura de cooperativas |
| bookings | Pasajeros, cotización, propiedad, ocupaciones por tramo, reserva y expiración | Disponibilidad; consultas de pasajeros ya acordadas; operaciones autorizadas para pagos |
| payments | Archivos/versiones, revisión, efectivo e instrucciones de pago | Recepción, corrección, aprobación/rechazo; no recalcular precios ni escribir tablas de reservas |
| tickets | Boleto individual/QR, recuperación y entrega | Emisión idempotente por venta; consulta autorizada y reintentos de envío |

Viajes se propone como API pública del núcleo de hojas de ruta; crear un módulo `trips` separado requeriría decisión arquitectónica, no se crea en este cambio. El consumidor declara su puerto y el adaptador usa solo `index.js` del proveedor; `server.js` compone. Ningún módulo importa repositorios internos ni consulta tablas ajenas como sustituto de un contrato. Evitar dependencia circular: reservas recibe catálogo comercial y hojas recibe consultas de ocupación mediante composición explícita. Los contratos exactos y las transacciones se definen en tareas pequeñas antes de codificar.

## 9. Entrega y trabajo pendiente verificable

Este registro no garantiza que todo el alcance se complete el 4 de noviembre. Orden propuesto para contrastar con cada responsable, no asignaciones nuevas aceptadas:

1. David/Edwin: resolver horarios de llegada, patrón, cobertura y duración; spec pequeña de viaje comercializable. Reconciliar restricciones antiguas de ROUTE-SHEETS-01.
2. Edwin: inventario público, VIP y accesibilidad por specs separadas; David: configuración congelada y tarifas por combinación. Leslie: cotización con porcentajes configurados y relación persistida de viaje/asiento.
3. Leslie/Shirley: recepción, correcciones, efectivo y venta; cerrar vencimiento de corrección y contrato autorizado. Mantener pruebas de concurrencia.
4. Shirley/Pablo según responsabilidades de referencia: emisión/entrega y correo/acceso. Cada autor cubre su pantalla; base compartida no demuestra pantallas completas.
5. Verificar en Docker el recorrido búsqueda → asiento/tramo → pasajero → resumen → reserva → comprobante/efectivo → validación → boleto/consulta. Probar expiración, dos compradores simultáneos, aislamiento, reintentos y errores de correo/QR. Registrar resultados reales, revisión humana y base integrada.
6. Auditar README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, licencia, plantillas de PR/issues y evidencias de colaboración conforme a apuntes. Confirmar licencia y política antes de publicarlas; esta tarea no inventa su aprobación ni una auditoría realizada.
7. Comité rotativo e instrumento de tickets quedan para después de la primera entrega por confirmación del solicitante. La revisión por otro humano y la autorización de excepciones académicas siguen siendo necesarias ahora. Conservar solicitudes/decisiones por spec y PR, sin inventar Jira/Issues externos.
8. Defectos visuales: ver [ACADEMICA-01](specs/ACADEMICA-01.md). Solo propuestas, sin defectos introducidos ni versión asignada. No sustituir funcionalidad faltante por un defecto académico.

## 10. Registro de confirmación y reemplazos

- Participante que comunicó decisiones: solicitante del chat; fecha 1 de noviembre de 2026. No existe constancia individual nueva de los cinco integrantes.
- Reemplazadas: porcentaje fijo del 50 %; suma obligatoria de tramos como único precio; un único comprobante no reemplazable; exclusión general de recuperación/verificación; Wallet como pendiente de alcance inmediato. La política vigente y sus pendientes están arriba.
- Conservadas: umbrales menor de 18/desde 65, USD/redondeo, identidad de asientos, aislamiento, plazo inicial 3–5 minutos, revisión sin liberar por el plazo inicial, rechazo definitivo justificado, venta idempotente y rol Chofer/Controlador fuera de fase.
- Cambios a producto todavía no ejecutados: restricciones de asignación múltiple, tarifario configurable/congelado, flota VIP/accesible, correcciones, identidad/historial, correo/boletos y nuevas pantallas. Las pruebas históricas verifican contratos anteriores, no este nuevo alcance.
