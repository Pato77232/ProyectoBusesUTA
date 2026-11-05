# BOOK-08 — historial web de reservas propias

Responsable: Leslie. Alcance autorizado por el solicitante: historial registrado,
sin compra invitada (Pablo). Base develop 5b0ecb6. RN-01/02/41; reutiliza
GET /bookings y /bookings/:id existentes. Página historial-reservas.html con
paginación, detalle, estados y enlace a boletos vendidos. No modifica reservas,
plazos ni APIs. Diseño: frontend/DESIGN.md, Bootstrap y recursos locales.

La identidad se comprueba antes y después de cada consulta; cambiar cuenta o
salir retira la información privada. Datos como texto, sin PII en storage/URL.
Sin pruebas nuevas ni ejecución de suites por instrucción expresa del usuario;
se comprueban lint, sintaxis y diff. QA real de navegador y revisión humana
pendientes; no se presenta como funcionalidad probada de punta a punta.
