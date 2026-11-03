# BOOK-08 / L-06: pantallas de compra real

- **Planificación:** L-06; no es una spec aprobada ni un ID externo.
- **Spec existente:** [BOOK-08](BOOK-08.md).
- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Pablo, conforme a la preferencia previa de Leslie; aceptación de este incremento pendiente. Coordinar contratos con los responsables indicados.
- **Estado:** Borrador; implementación de los nuevos incrementos no autorizada.
- **Base:** rama `feature/BOOK-03-resumen-creacion-dominio`, `c7ceed9`; remoto `origin/develop b60201e`, consultado el 1 de noviembre de 2026, sin integrar.
- **Autorización:** el usuario pidió preparar specs antes de implementar; no se infiere aprobación de este borrador.
- **Referencias:** [plan y evidencia](../reservas-plan-primera-entrega.md), [acuerdos vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/b60201e/docs/acuerdos-primera-entrega.md), arquitectura y calidad del proyecto.

## 1. Objetivo

Adaptar las pantallas locales existentes al recorrido real de selección, pasajeros, resumen y consulta de compra, por tareas separadas.

## 2. Reglas

RN-01/02/12/40–43/50/51. Compra y precios de servidor; correo por adulto y responsable/contacto para menor. Conocer una cédula no autoriza autocompletado ajeno. expiresAt del servidor solo informa en pantalla.

## 3. Alcance

Reutilizar pages/reservas.html y src/bookings; revisar transporte compartido nuevo de Pablo antes de adaptarlo. No reimplementar login ni sobrescribir cliente HTTP común. Pantallas de pagos/boletos de Shirley se conectan solo con contrato disponible.

## 4. Flujo

Viaje/tramo real → asientos reales → pasajeros/contactos/acreditaciones → resumen autorizado → aceptación y reserva → consulta propia/paso al pago. Si falta un proveedor, mostrar error recuperable sin afirmar éxito.

## 5. Datos y privacidad

Viaje y posiciones desde navegación validados por backend; inventario/categoría del servidor. Captura por pasajero de datos acordados, correo adulto y responsable adulto/contacto del menor. Falta definir campos exactos de responsable y acreditaciones, almacenamiento privado y permisos de acceso.

No recuperar datos ajenos por cédula ni guardar documentos/contraseñas/PII en URL o almacenamiento persistente del navegador. La clave opaca de intento local no es credencial suficiente de consulta.

## 6. Endpoints

Reutilizar availability, summary, POST bookings y attempts propios cuando estén adaptados/componiendo proveedores reales. GET de compra propia/listado y acceso invitado siguen pendientes de contrato; no presentar GET de intento como historial completo.

## 7. Criterios de aceptación pendientes

- [ ] Selección muestra inventario real, categoría y estados con texto además del color.
- [ ] Menor exige responsable adulto/contacto conforme al contrato; no expone datos de otro pasajero.
- [ ] Resumen muestra base, VIP, beneficio, total y política autorizados; cambio exige nueva aceptación.
- [ ] Conflicto de asiento conserva datos permitidos y pide corregir selección; no finge reserva exitosa.
- [ ] Sesión vencida retira datos privados y permite recuperación autorizada sin repetir compra.
- [ ] Temporizador no extiende expiresAt ni libera asientos desde navegador.
- [ ] Compra registrada y, cuando exista contrato, invitada se verifican por separado.
- [ ] Consulta propia impide acceso cruzado y recupera estado real tras recarga/timeout.

## 8. Casos borde

Red caída, servicio no disponible, precio nuevo, asiento tomado, comprobante en revisión y acceso invitado sin secreto válido; estado de emisión pendiente distinto de venta fallida.

## 9. Pruebas previstas

Unitarias de flujo/transporte, HTTP con backend y PostgreSQL reales, integración de proveedores y navegador. Recuperación tras respuesta perdida, cambio de política, sesión vencida y privacidad de cédula. Datos sintéticos identificados; una fixture no acredita disponibilidad comercial real.

## 10. Decisiones necesarias

Contratos de L-01/L-02/L-03 y consulta de L-05; navegación desde búsqueda, acreditaciones/responsable y acceso invitado con Pablo/Shirley. No habilitar invitado con identificador público ni considerar el correo enviado hasta probar proveedor real.

## 11. Defecto inducido

No aplica. No introducir ni corregir incidentalmente defectos académicos; seguir errores-inducidos.md.

## 12. Diseño SOLID y usabilidad

Aplicación declarada de [frontend/DESIGN.md](../../frontend/DESIGN.md): marca transViaje, recursos locales, Bootstrap 5, tokens blanco/negro/violeta, foco visible y mensajes claros. Revisado también el diff de DESIGN.md en develop; no requiere rediseño ni dependencia nueva.

Separar vista, estado de flujo y transporte. A 360/1280 px comprobar ausencia de desbordamiento, teclado completo, foco, contraste de texto ≥4,5:1 y estados carga/vacío/error/éxito. Dada ampliación del 200 %, todas las acciones siguen accesibles; registrar si fue zoom nativo o emulación CSS. No afirmar certificación de accesibilidad.

## 13. Incrementos y archivos previstos

1. Selección de asiento real: HTML/estilos locales/src/bookings y pruebas.
2. Pasajeros/contactos/acreditación: mismo flujo con contratos mínimos y validación de servidor.
3. Resumen configurado, aceptación y recuperación idempotente: desglose real y conflictos.
4. Consulta de compra y paso a pagos; registrado primero, invitado solo cuando su acceso esté definido.

Autorizar cada tarea después de componer su API real. Ejecutar frontend lint/test y QA visual; para cambio funcional backend ejecutar lint, format:check y npm test con PostgreSQL aislado, y arranque si corresponde. No sustituir evidencias históricas por resultados nuevos inventados.
## 14. Revisión y cierre

Revisión humana, autorización de incremento e integración pendientes. Ningún criterio futuro se marca aprobado por la existencia de este borrador. Evidencia documental de esta sesión en el plan; resultados de producto pendientes.
