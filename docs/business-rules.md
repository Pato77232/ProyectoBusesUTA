# Reglas de negocio

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
- **RN-43 (descuentos)** Se aplican automáticamente descuentos por: tercera edad, menor de edad y discapacidad. El porcentaje y la forma de validación están en "Preguntas abiertas".

## 7. Pagos y comprobantes
- **RN-50** Al pagar por depósito o transferencia, el cliente tiene un **plazo de 3 a 5 minutos** para subir el comprobante. El valor es **configurable** (no fijo en el código).
- **RN-51** Si el plazo vence sin comprobante, la reserva expira y los asientos vuelven a *Disponible*.
- **RN-52** El comprobante llega a la bandeja del **Oficinista**, que lo **aprueba** o **rechaza**.
- **RN-53** Al **rechazar** un comprobante, la **justificación es obligatoria**.
- **RN-54** Al aprobar, el sistema emite el boleto con código QR y los asientos pasan a *Vendido*.
- **RN-55** El boleto puede integrarse con billeteras digitales (Wallet) como opción.

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
1. **Descuentos:** ¿qué porcentaje aplica a tercera edad, menor de edad y discapacidad? ¿Hasta qué edad se considera menor?
2. **Validación por cédula:** ¿se valida solo el formato, se consulta un servicio externo o hay datos simulados?
3. **Tarjeta:** ¿se integra una pasarela real o se simula en esta fase?
4. **Precio:** ¿es por frecuencia completa o por tramo entre paradas?
5. **Wallet:** ¿qué alcance tiene en esta fase?
6. **Hoja de ruta automática:** ¿qué criterio de asignación y rotación se usa (por ejemplo, equidad de kilómetros)?
7. **Venta física:** ¿el oficinista vende asientos directamente sin pasar por reserva y comprobante?
8. **Invitado:** ¿qué datos mínimos se piden y cómo recupera su boleto?
9. **Viaje:** el concepto "Viaje" (frecuencia en una fecha con bus) se deduce del charter; confirmar con el equipo.
