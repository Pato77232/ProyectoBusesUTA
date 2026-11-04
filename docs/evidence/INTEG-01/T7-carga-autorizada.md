# INTEG-01 T7 — carga con lectura autorizada real

4 de noviembre de 2026. Edwin autoriza completar y publicar los incrementos de entrega. Pagos recibía paymentQueries pero consultaba un lector simulado vacío; la carga propia respondía 404. La carga ahora consume BookingsPaymentQueryAdapter cuando se proporciona la API pública real, conservando propietario/tenant derivados de Auth y el protocolo de recepción. El reloj inyectado llega al controlador. La bandeja real conserva su composición separada.

Los cuatro casos originales de authorized-payment-upload.http.test.js pasan con PostgreSQL/HTTP reales, sin cambiar expectativas. La combinación final local (incluidos incrementos posteriores) aprobó 1929 unitarias y 649 integraciones; no atribuir esa regresión completa a esta cabeza aislada. Lint/formato propio y diff aprobados; formato global conserva 15 archivos ajenos. Sin migraciones/dependencias nuevas ni .env. Asistencia de Codex; revisión humana/integración pendientes.
