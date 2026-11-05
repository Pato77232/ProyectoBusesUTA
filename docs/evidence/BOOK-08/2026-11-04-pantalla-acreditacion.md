# BOOK-08 — evidencia del incremento D, 4 de noviembre de 2026

## Alcance comprobado

Rama `feature/BOOK-08-acreditacion-web`, sobre el commit publicado `9c045c5` de
los incrementos B/C. D agrega la pantalla de acreditación y el acceso de
solicitud desde Reservas. No modifica la API, las migraciones, dependencias ni
configuración de backend.

La vista de CLERK usa la API pública de solicitudes de acreditación: consulta
su sesión, muestra solo la bandeja de su cooperativa, recupera el detalle
autorizado y envía una revisión con `expectedRevision`. Los documentos se
representan por referencias opacas; no se suben archivos ni se reclama una
validación automática de autenticidad. El resultado incierto conserva la misma
intención para reintento; conflicto exige recargar y el cambio de sesión limpia
la vista privada.

El comprador puede solicitar revisión desde la pantalla de reservas y consultar
el resultado. La solicitud no crea reserva ni bloquea asientos. El nuevo total
se obtiene solo al volver a pedir el resumen al servidor.

## Pruebas

- `npm run lint` frontend: aprobado.
- `npm test` frontend: 333/333 aprobadas.
- Pruebas nuevas de controlador y transporte: 13/13 aprobadas. Cubren permisos
  de CLERK, paginación, detalle, idempotencia visual, resultado incierto,
  conflicto, cambio de sesión, respuesta tardía, comprador y URLs codificadas.
- Chrome y PostgreSQL 16.13 efímero: aprobado. Recorrido real de compra →
  solicitud → revisión CLERK → resumen autorizado. La revisión creó una sola
  acreditación y cero reservas/ocupaciones; un payload hostil se mostró con
  `textContent`; no hubo solicitudes externas.
- QA visual: reflujo sin scroll horizontal a 360 y 1280 píxeles; ampliación CSS
  al 200 % y recorrido de teclado hasta Guardar verificación comprobados. Las
  capturas temporales no se añadieron al repositorio.
- El backend no cambia en D. B/C conserva `npm test` aprobado con 2049 pruebas
  unitarias y 686 integraciones. Un intento posterior de repetir solo las
  integraciones en otra base aislada fue interrumpido por el entorno antes de
  devolver resultado; no se declara verde ni se modifica ninguna prueba para
  evitarlo.

## Límites y pendientes

No hay emisión de correo, carga digital de documentos, compra invitada, caja,
corrección de comprobantes ni integración humana. D permanece sin commit,
push, PR o aprobación humana al redactar esta evidencia.
