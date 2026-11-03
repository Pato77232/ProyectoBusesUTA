# PAGOS-WEB-01: bandeja web de comprobantes

- Responsable: Shirley. Revisor: Pablo (revisión de pantallas aceptada en dependencias-pagos.md).
- Fecha: 2 de noviembre de 2026, America/Guayaquil.
- Estado: implementación local autorizada; revisión humana pendiente.
- Autorización: Shirley pidió continuar su frontend y preparar otra PR, y precisó
  «Por ahora termina la pantalla y prepara la PR». No autoriza decisiones nuevas
  sobre correcciones/caja ni publicación, commits o integración.
- Base local inicial: c1d638f, con PAGOS-02/PR #47 ya integrada según su evidencia.

## Objetivo y contrato existente

Pantalla `/pages/comprobantes.html` para CLERK. Aplica RN-02 y lectura de RN-52.
Consulta `/api/v1/auth/me` y después GET `/api/v1/payment-proofs`, con cursor
opaco opcional; nunca envía cooperativa o identidad elegidas por el navegador.
Consume el DTO real del controlador existente: items con id, bookingId,
totalCents, currency USD, status UPLOADED, fileName, mediaType, fileSizeBytes,
uploadedAt y nextCursor nullable. Archivo en GET
`/api/v1/payment-proofs/:paymentProofId/file`, siempre autorizado por backend.

La composición actual conserva lector de Reservas simulado. Las pruebas QA
inyectarán datos sintéticos de reservas en ese lector, con Auth, PostgreSQL,
Payments, archivos privados y proxy reales; no acredita proveedor productivo.
No incluye aprobación, rechazo, carga de comprador, correcciones, caja, QR ni
invitado. No crea reglas, endpoints, migraciones ni dependencias.

Al comprobar la apertura privada se detectó ausencia de Cache-Control en las
rutas de Payments. Se agrega `Cache-Control: no-store` a estas respuestas,
incluidas denegaciones, para evitar conservar listados/bytes privados en caché
HTTP. Es una corrección acotada de transporte para esta pantalla, sin cambiar
autorización ni comportamiento de Reservas. Prueba nueva, sin alterar anteriores.

## Diseño y responsabilidades

Adopta frontend/DESIGN.md: marca y logo locales, blanco/negro/violeta, Bootstrap
local, tokens existentes, foco visible y superficies adaptables. Estilos propios
de la pantalla delimitados; sin modificar tokens ni navegación compartida.
Controlador independiente de DOM con cliente/vista inyectados; vista usa nodos
y textContent, sin HTML de datos remotos. Entrada mínima por API pública HTTP.
No persiste comprobantes, cursores ni sesión en almacenamiento del navegador.

## Criterios de aceptación

- Sin sesión o con rol distinto de CLERK no se solicita el listado.
- Carga, vacío, error y resultados tienen mensajes en español y estado accesible.
- Un fallo no se representa como bandeja vacía; ofrece recuperación explícita.
- Paginación con siguiente/anterior, sin omisiones locales; no reutiliza un cursor
  de una identidad/cooperativa distinta. Doble clic no duplica solicitudes activas.
- Importes USD en centavos y fechas Ecuador; un DTO incompleto no inventa totales.
- Los nombres de archivo se representan como texto, incluso con marcado malicioso.
- Abrir archivo usa ruta propia validada y pestaña sin acceso a window.opener.
- Teclado, foco visible, ancho 360/1280 y zoom 200 % conservan acciones legibles.
- La imagen incluye página/módulos/estilos y excluye scripts y datos QA.
- Dos cooperativas reales de QA no ven archivos ni comprobantes ajenos.

## Validación prevista

Pruebas de controlador (sesión, roles, error, DTO, paginación, concurrencia),
suite frontend completa, lint y formato propios, navegador con imagen reconstruida
y proxy/BD aislados. Backend: lint, format:check y npm test, conservando fallos
previos y sin tocar sus pruebas. Registrar resultados y capturas en evidencia.
Revisión humana y comprobación de combinación con develop se reportan aparte.

## Resultado y preparación de PR

Copia de trabajo separada en feature/PAGOS-WEB-01-bandeja-pr sobre develop
5abc36d, sin merge/rebase ni alteración de borradores originales. Frontend: 168
pruebas aprobadas y navegador real aprobado. Backend: lint aprobado; 1298
unitarias y 372 integraciones aprobadas. Formato global falla en 17 archivos
previos. [Evidencia](../evidence/PAGOS-WEB-01/2026-11-02-verificacion.md) y
[descripción preparada](../evidence/PAGOS-WEB-01/descripcion-pr.md).
Sin commit/publicación/revisión humana; no se marca integrada o cerrada.
