# Reglas de negocio

> Precisión de cotización confirmada por Leslie el 4 de noviembre de 2026: [BOOK-05-L01 §16](specs/BOOK-05-L01.md). Edad en fecha local del embarque elegido; nacidos el 29 de febrero cumplen el 1 de marzo en años no bisiestos. Desglose exacto y ajuste explícito de redondeo. Oficinista de la cooperativa acredita identidad/nacimiento o discapacidad antes del total aceptado y pago, con resultado, beneficio, referencia privada de evidencia, actor, fecha y versión; el comprador solo consulta resultados de sus pasajeros. La revisión del comprobante de pago es posterior e independiente. Este acuerdo no acredita implementación de verificación documental, permisos o conexión comercial.

> Precisión tarifaria confirmada por el solicitante el 1 de noviembre: [ROUTE-SHEETS-05 §10](specs/ROUTE-SHEETS-05.md). Un solo descuento, el mayor acreditado; VIP primero y después descuento. Recargo VIP y descuentos entre 0–100 %, hasta dos decimales, cero explícito; base positiva hasta USD 99 999 999,99. Configuración por administrador, congelación al publicar y renovación mediante copia editable en nuevo borrador. Tarifas explícitas de todas las combinaciones, sin suma automática. Resuelve los pendientes anteriores incompatibles; no acredita implementación de publicación ni adaptación de Bookings.

> Precisión vigente de programación, 1 de noviembre de 2026: [ROUTE-SHEETS-04](specs/ROUTE-SHEETS-04.md), aceptación de propuestas por Edwin/Leslie reportada por el solicitante y concreción técnica delegada. Patrón manual en días con salida/llegada fechadas y margen obligatorio explícito, ubicación continua o traslado registrado; validar bloqueos y cobertura, no solo conteos. Dos ciclos totales incluida base; solo períodos confirmados habilitan ventas. Horizonte desde inicio del primer ciclo hasta fin exclusivo del último consecutivo confirmado (máximo dos), no «hoy + 2L». Cierre en el instante de embarque del punto elegido. Renovación confirmada permite siguiente período cuando acaba el primero, sin alterar historia ni superar dos períodos no terminados confirmados. No desactivar frecuencias con servicios futuros publicados o pasajeros afectados. Los pendientes anteriores sobre estos puntos quedan resueltos para este contrato; implementación todavía pendiente. No se modifica alcance de tarifas, accesibilidad ni sustitución de pasajeros.

> Actualización del 1 de noviembre de 2026, documentada en [ACUERDOS-01](specs/ACUERDOS-01.md) y [acuerdos de primera entrega](acuerdos-primera-entrega.md). Confirmaciones comunicadas por el solicitante; no acredita implementación ni aprobación individual de otros integrantes.

## Actualización normativa de la primera entrega

Estas reglas reemplazan expresamente los párrafos históricos incompatibles de este documento y las specs. Las propuestas técnicas de acuerdos-primera-entrega.md no son reglas aprobadas por esta referencia.

- **RN-01/03:** SYSTEM_ADMIN crea cooperativa y designa su administrador principal; COOPERATIVE_ADMIN crea oficinistas solo de su cooperativa. Recuperación de contraseña y verificación de correo dentro del alcance solicitado, todavía requieren specs; MFA pendiente. Chofer/Controlador sigue fuera de esta fase. Su verificación física/cobro de diferencia se registra para fase futura.
- **RN-12:** cubrir NORMAL, VIP y accesibilidad; las tres plantillas normales actuales no cubren toda la regla. Configuración ordinaria del bus se congela para la hoja establecida; cambios para la siguiente. Inventario accesible y sustitución excepcional requieren contratos adicionales.
- **RN-20–23:** resolución ANT obligatoria, sin trámite/verificación externa. Recorrido con paradas ordenadas que admiten embarque; mostrar fecha y hora local del punto elegido, incluido cambio de día. Desactivar después del ciclo sin servicios futuros publicados ni pasajeros RESERVED/SOLD afectados. No cambiar origen, destino ni hora de la frecuencia.
- **RN-30–32:** hoja por grupo operativo; viaje fechado vinculado a asignación, frecuencia y bus. Un bus puede realizar varias frecuencias compatibles. Validar salida/llegada fechadas, preparación explícita no negativa, ubicación inicial y continuidad o traslado registrado, bloqueos y cobertura de cada servicio requerido. Descanso/mantenimiento no equivalen a respaldo disponible. Patrón manual repetible en días según ROUTE-SHEETS-04; no deducir duración/rotación de conteos.
- **Ciclos y compra:** dos ciclos totales incluida base, de L días cada uno, con intervalo desde S hasta S+2L exclusivo si ambos están confirmados. Solo ciclos consecutivos publicados habilitan venta. El límite no se recalcula desde hoy. Cerrar compra al instante de embarque del punto elegido. Renovación explícita tras acabar el primer ciclo permite el siguiente manteniendo máximo de dos períodos no terminados confirmados e historia intacta. Ver ROUTE-SHEETS-04 para límites y validación del patrón.
- **Tarifas/RN-43:** directa con tarifa origen–destino; paradas con precio explícito por combinación válida, sin suponer suma de tramos. COOPERATIVE_ADMIN configura precios, porcentajes de recargo VIP y descuento. Menor de 18, desde 65 o discapacidad acreditada; primero recargo y después beneficio. Reemplaza el 50 % fijo histórico. La hoja congela importes y porcentajes; cambios a siguiente hoja. Conservar USD, centavos y redondeo de mitad hacia arriba al final por pasajero. Límites, beneficio prevalente e instante de congelación requieren precisión. No se presenta configuración académica como certificación legal.
- **RN-41/42:** correo por pasajero adulto, responsable adulto/contacto para menores; documentos extranjeros fuera de primera entrega. Comprador accede a todos los boletos de su compra, cada pasajero/responsable recibe el correspondiente. Historial por cédula requiere titularidad verificada, nunca acceso/autocompletado de terceros por conocer un número. Invitado mantiene acceso secreto; duración/reenvío e integración pendientes.
- **RN-50–54:** plazo inicial configurable 3–5 minutos desde reserva al aceptar resumen, inicial documentado 5. Sin recepción aceptada a tiempo, expirar y liberar atómicamente. Edición de comprobante durante 3 minutos desde primera carga; aprobación previa bloquea cambios. Después solo por solicitud del oficinista, con 15 minutos y aviso por correo. Solicitud de corrección es distinta de rechazo definitivo justificado. Referencia/vencimiento de los 15 minutos y límites de solicitudes pendientes. Ediciones no reinician plazo inicial ni liberan automáticamente una reserva en revisión. Tamaño máximo confirmado 5 MiB por archivo; PDF, JPEG y PNG ratificados por Shirley el 2 de noviembre, con validación de contenido, extensión y MIME. Fuente: [dependencias de Pagos](dependencias-pagos.md). No acredita implementación.
- **Pagos:** no efectivo requiere comprobante y validación; en caja el oficinista registra efectivo y confirma venta. Métodos concretos, tarjeta e instrucciones/cuentas receptoras pendientes. No afirmar pasarela real o simulación autorizada. La emisión/entrega idempotente y reintentos de boleto son propuestas técnicas pendientes de spec.
- **RN-55:** Wallet después de primera entrega; no disponible el 4 de noviembre.

Preguntas pendientes vigentes: [acuerdos §§1–8](acuerdos-primera-entrega.md). El apartado histórico de preguntas al final se conserva para trazabilidad, pero no reabre porcentajes fijos, edad menor de 12, Wallet inmediato ni venta en efectivo ya decidida. Se necesita reconciliar todas las implementaciones afectadas mediante specs pequeñas.

Fuente: *Project Charter y Modelo de Negocio* (octubre 2026). Cada regla tiene un ID (RN-xx) para citarla en specs, pruebas y PRs. Si algo no está aquí, **no se inventa**: se agrega a "Preguntas abiertas" y se resuelve con el equipo.

## 1. Alcance
Plataforma web transaccional y multi-tenant para buscar, comparar y comprar pasajes interprovinciales de varias cooperativas, con boleto electrónico (QR) y gestión interna de flotas, frecuencias y hojas de ruta.
**Fuera de alcance en esta fase:** el rol Chofer/Controlador (iniciar o finalizar rutas, escanear QR, vender asientos libres en paradas).

## 2. Roles
| Rol | Responsabilidades |
|---|---|
| Administrador del Sistema | Soporte técnico. Registra cooperativas y asigna su administrador principal. Configura parámetros base. |
| Usuario de Cooperativa (Administrador Operativo) | Configuración institucional (colores, logo). Gestiona buses y grupos. Gestiona frecuencias y hojas de ruta. |
| Oficinista | Venta física de boletos. Valida comprobantes de pago (aprueba o rechaza). |
| Cliente (Usuario Final) | Busca viajes, elige asientos, compra. Mantiene historial de viajes y compras. Puede entrar como invitado. |
| Chofer / Controlador | **No se implementa en esta fase.** |

- **RN-01** Cada usuario tiene exactamente un rol. Los permisos se validan en el backend, no solo en la interfaz.
- **RN-02 (multi-tenant)** Cada cooperativa es un inquilino aislado. Usuarios de cooperativa y oficinistas solo ven y modifican datos de su cooperativa. La búsqueda pública de viajes es de solo lectura y consolida varias cooperativas.
- **RN-03** Solo el Administrador del Sistema da de alta cooperativas y asigna su administrador principal.

## 3. Flota
- **RN-10** Al registrar un bus se exigen: chasis, marca de carrocería, color y fotografías.
- **RN-11** Los buses se agrupan en **Grupos** según su categoría operativa:
  - *Rutas largas:* alto confort (dos pisos, baño, VIP).
  - *Rutas cantonales (cortas):* estándar, sin baño.
  - *Rutas urbanas/rurales:* tipo ranchera.
- **RN-12** Cada bus tiene una **plantilla de asientos** visual que mapea su distribución: uno o dos pisos, asientos VIP, espacios para silla de ruedas.

## 4. Frecuencias
- **RN-20** Una frecuencia se define por **origen, destino y hora de salida** (ej. Ambato–Quito, 14:00). Esos tres valores **no se pueden modificar** una vez creada.
- **RN-21** Toda frecuencia debe tener un **número de resolución de la ANT** obligatorio.
- **RN-22** Una frecuencia es *directa* (sin escalas) o tiene **paradas intermedias autorizadas** (ej. Quito–Loja con paradas en Latacunga, Riobamba y Cuenca).
- **RN-23** Una frecuencia puede estar *Activa* o *Inactiva* según la estrategia comercial de la cooperativa. Solo las activas se ofrecen en la búsqueda.

## 5. Hojas de ruta
- **RN-30** La hoja de ruta es la asignación operativa diaria: vincula un **Grupo de Buses** con las **Frecuencias** activas de la cooperativa.
- **RN-31** Se puede generar de forma **manual o automática**.
- **RN-32** Si hay más vehículos que frecuencias operativas, el sistema contempla **días de parada** (descanso) para ciertos buses.

## 6. Búsqueda y compra
Flujo del cliente:
1. **Búsqueda:** origen, destino y fecha. Resultados consolidados de todas las cooperativas con hora, bus, cooperativa y valor.
2. **Detalle:** el cliente puede ver fotos y datos del bus.
3. **Asientos:** se muestra la plantilla visual para elegir asientos disponibles.
4. **Pasajeros:** se pide la cédula de cada asiento. Se aplican descuentos automáticos validando la información.
5. **Resumen y bloqueo:** al aceptar el resumen, los asientos pasan a *Reservado*.
6. **Pago y validación:** transferencia, depósito o tarjeta. En depósito o transferencia se sube un comprobante dentro del plazo.
7. **Emisión:** una vez aprobado, se genera el boleto digital con código de barras o QR, guardado en el historial del cliente.

- **RN-40** Un asiento solo puede estar en un estado a la vez: *Disponible*, *Reservado* o *Vendido*. Un asiento reservado o vendido no puede ser elegido por otro cliente (control de concurrencia).
- **RN-41** Se puede comprar como invitado o como cliente registrado.
- **RN-42** Se pide la cédula por cada asiento seleccionado.
- **RN-43 (descuentos)** Se aplican automáticamente descuentos por tercera edad, minoría de edad y discapacidad. Política vigente comunicada por el solicitante: porcentajes configurables por cooperativa según la actualización anterior, menor de 18 años, 65 años cumplidos o discapacidad acreditada. Las decisiones históricas autorizadas por Leslie se conservan en `docs/reservas-decisiones.md` y BOOK-05; no atribuirle aprobación individual de este cambio. No confundir cálculo de elegibilidad con acreditación de identidad.

## 7. Pagos y comprobantes
- **RN-50** Al pagar por depósito o transferencia, el cliente tiene un **plazo de 3 a 5 minutos** para subir el comprobante. El valor es **configurable** (no fijo en el código).
- **RN-51** Si el plazo vence sin comprobante, la reserva expira y los asientos vuelven a *Disponible*.
- **RN-52** El comprobante llega a la bandeja del **Oficinista**, que lo **aprueba** o **rechaza**.
- **RN-53** Al **rechazar** un comprobante, la **justificación es obligatoria**.
- **RN-54** Al aprobar, el sistema emite el boleto con código QR y los asientos pasan a *Vendido*.
- **RN-55** Wallet se implementará después de la primera entrega.

Estados del comprobante: *Pendiente* → *Aprobado* | *Rechazado* | *Expirado*.

## 8. Glosario de dominio (español → identificador en código)
| Español | Código |
|---|---|
| Cooperativa | `Cooperative` |
| Bus | `Bus` |
| Grupo de buses | `BusGroup` |
| Plantilla de asientos | `SeatLayout` |
| Frecuencia | `Frequency` |
| Parada | `Stop` |
| Hoja de ruta | `RouteSheet` |
| Viaje (frecuencia en una fecha con bus asignado) | `Trip` |
| Reserva | `Booking` |
| Pasajero | `Passenger` |
| Comprobante de pago | `PaymentProof` |
| Boleto | `Ticket` |
| Oficinista | `Clerk` |
| Cliente | `Customer` |

## 9. Preguntas abiertas (resolver antes de implementar lo que afecten)
1. **Descuentos:** política seleccionada por autorización de Leslie en `docs/reservas-decisiones.md` y BOOK-05. La acreditación real requiere una fuente o revisión autorizada; no simularla en producción.
2. **Validación por cédula:** estructura de 10 dígitos y módulo 10 para esta fase; no acredita titularidad, edad ni discapacidad. Fuente y alcance en BOOK-04. No se ha contratado una consulta externa.
3. **Tarjeta:** ¿se integra una pasarela real o se simula en esta fase?
4. **Precio:** resuelto: directa con tarifa completa; con paradas, tarifa explícita por cada combinación válida. Configuración/congelación y pendientes en actualización anterior.
5. **Wallet:** después de la primera entrega, sin implementación en esta fase.
6. **Hoja de ruta automática:** ¿qué criterio de asignación y rotación se usa (por ejemplo, equidad de kilómetros)?
7. **Venta física:** confirmado pago en efectivo registrado por oficinista; precisa spec de reserva/venta autorizada, sin exigir archivo de depósito al comprador en caja.
8. **Invitado:** nombre y correo de contacto; enlace secreto de recuperación con hash persistido, según `docs/reservas-decisiones.md`. Implementación del contrato de acceso y envío de correo pendiente de integración.
9. **Viaje:** confirmado como salida fechada vinculada a asignación de hoja de ruta, frecuencia y bus. Catálogo real pendiente de spec.
