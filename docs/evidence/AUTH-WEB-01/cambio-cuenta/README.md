# Cambio de cuenta desde el login

Ampliación de AUTH-WEB-01 autorizada por el solicitante el 4 de noviembre de 2026.
Prueba: `node tests/change-account-smoke.cjs` desde frontend. En Windows definir
`BROWSER_BIN` con la ruta de Chrome. Reutiliza helpers del proyecto, sin instalar
dependencias y sin leer `.env`.

El harness crea un proyecto Compose exclusivo `transviaje-frontend-qa-cambio-cuenta`
con base efímera sin puerto público, credenciales aleatorias y dos usuarios
ficticios (`SYSTEM_ADMIN`, `CUSTOMER`). Construye imágenes reales y comprueba:

1. Login de administrador, identidad confirmada y botón de cambio de cuenta.
2. Tab/Enter, foco visible, POST logout y GET me posterior con 401.
3. Formulario vacío, foco en correo y enlace administrativo retirado.
4. Login de cliente sin acceso administrativo presentado.
5. Respuesta perdida después de logout real y doble clic: un POST, recuperación
   por GET y formulario habilitado solo tras 401.
6. Ausencia de desbordamiento horizontal a 360/1280 px y ampliación CSS 200 %.

Resultado final: aprobado. Capturas finales inspeccionadas visualmente:

- [Escritorio](desktop.png).
- [Móvil](mobile.png).
- [Ampliación CSS 200 %](zoom-200.png).

Los correos en las capturas son ficticios y terminan en `.invalid`. No contienen
contraseñas, tokens o cookies. A 200 % existe desplazamiento vertical normal;
no se certifican zoom nativo ni lector de pantalla.

Nueve pruebas unitarias nuevas cubren también sesión vencida, rechazo CSRF,
ausencia de sesión confirmada, fallo/malformación de GET y recuperación sin
repetir POST o ejecutar redirección para la cuenta anterior. Frontend completo:
361/361 y lint aprobados. El harness retira sus contenedores, red y perfil Chrome
al finalizar, incluso tras fallos. Revisión humana pendiente.

Backend: lint y formato aprobados; 2037/2037 unitarias, 692/693 integraciones.
Una prueba de fotografías Fleet superó sus 20 s; repetición aislada 17/18, mismo
fallo. No se modifica Fleet ni el límite de la prueba. La regresión general
permanece fallida, aunque el recorrido de cambio de cuenta está aprobado.
