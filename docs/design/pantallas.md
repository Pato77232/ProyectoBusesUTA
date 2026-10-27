# Catálogo orientativo de pantallas

Fuente: [mockups originales](references/mockups-transviaje-original.pdf), aportados por Pablo. Fecha de registro: 25 de octubre de 2026. **Solo guía, sin obligación de reproducir páginas, funciones, datos o distribución.** La aclaración humana confirma ese carácter orientativo; una spec puede adoptar, adaptar o descartar elementos justificándolo contra las reglas vigentes.

Identidad confirmada por Pablo: transViaje, logo adjunto definitivo y blanco/negro/violeta. Esto no equivale a aprobar las funcionalidades de este catálogo ni a asignar nuevas tareas. [Procedencia y decisiones](README.md).

M-01–M-08 son referencias locales a páginas del PDF, no tickets ni specs nuevas. Las responsabilidades son las de referencia del equipo, no nuevas asignaciones confirmadas. Antes de programar una pantalla debe existir su propia spec y un contrato backend comprobado.

| Referencia | Pantalla y coordinación de referencia | Adaptación propuesta | Dependencia / punto a resolver |
|---|---|---|---|
| M-01, p. 1 | Acceso; Pablo | Mantener identidad y formulario simple; español consistente («Iniciar sesión»), etiquetas persistentes, errores comprensibles y estados de envío | UI de login en spec aparte después de la base FRONT-01; AUTH-01–04. Registro separado. No mostrar recuperación de contraseña como función disponible: fuera del alcance actual de autenticación |
| M-02, p. 2 | Búsqueda y detalle; responsable por confirmar | Filtros origen/destino/fecha, tarjetas de resultados y detalle de bus; móvil en una columna; estados carga, vacío y error | Contrato de viajes/búsqueda y fotos; tarifas y horas provienen del backend. El ejemplo «Directo» muestra paradas: aclarar escalas autorizadas frente a recorrido antes de mostrarlo. No imponer login para la búsqueda o compra invitada (RN-41) |
| M-03, p. 3 | Asientos/pasajeros, Leslie; plantilla Edwin; viaje David; comprobante Shirley | Separar selección, pasajeros, resumen/confirmación y pago. Asientos con nombre, estado y teclado; no comunicar disponibilidad solo por color | RN-40–43 y RN-50/51. Descuentos automáticos con validación, no selección libre de tarifa. El temporizador depende del plazo configurado y vencimiento del backend; no copiar 04:32. Acordar contrato de reserva–pago y concurrencia |
| M-04, p. 4 | Operación de cooperativa; Edwin y David | Dividir alta de bus, plantilla, frecuencia y hoja de ruta en tareas/pantallas pequeñas. Menú según rol y funciones existentes | El bloque «Nueva hoja de ruta» mezcla campos de frecuencia. Frecuencia conserva origen/destino/hora inmutables y resolución ANT; hoja de ruta vincula grupos y frecuencias activas. Alta de bus exige fotos RN-10. No convertir «12 de 12» o adjunto PDF en requisito sin spec |
| M-05, p. 5 | Administración del sistema; Pablo | Priorizar alta de cooperativa y asignación de administrador como recorridos pequeños. Separar configuración de la gestión académica | Contratos TENANTS/AUTH y roles RN-01–03; contrastar campos RUC/soporte con contrato real antes de incluirlos. Plazo configurable 3–5 min. Wallet, soporte y auditoría requieren alcance propio; métricas del ejemplo no son datos reales |
| M-06, p. 6 | Boleto digital; Shirley | Datos reales, QR generado y legible, estado de pago accesible; diseño móvil e impresión/descarga solo si la spec las incluye | RN-54: emitir tras aprobación. No reutilizar el QR dibujado del mockup. Recuperación de boleto invitado y datos como andén requieren contrato; Wallet sigue como pregunta abierta |
| M-07, p. 7 | Validación de pagos; Shirley | Bandeja por cooperativa, consulta de comprobante y acciones separadas; rechazo con justificación obligatoria, confirmación y errores recuperables | RN-02 y RN-52–54; definir estados/tiempos con Leslie. El ejemplo de efectivo/venta en caja no define su flujo: resolver pregunta abierta de venta física antes de implementarlo |
| M-08, p. 8 | Gestión de cambios académica; coordinación Pablo/Shirley según referencia | Conservar como referencia del proceso de configuración; recomendar evidencia versionada y PRs durante esta fase | No convertirlo en módulo del sistema de pasajes por aparecer en el PDF. El comité, sus aprobaciones y cifras no están acreditados por el mockup. No crear Jira, tickets o RFC reales a partir de sus datos de ejemplo |

La palabra «Conductor» en el mapa de asientos identifica la posición física; no autoriza implementar el rol Chofer/Controlador.


## Enlace con la implementación

Las filas anteriores son análisis de referencia, no tareas en desarrollo. No se han creado specs de pantalla ni aprobado responsables adicionales por incorporarlas. Cuando se autorice una pantalla, añadir a su fila la spec, RN aplicables, diferencias frente al original, estado real, revisor confirmado y enlaces a código, pruebas, commit y PR. Hasta entonces esos datos quedan pendientes, sin inventar claves.

FRONT-01 aporta únicamente la base compartida; no acredita implementación de M-01–M-08. La gestión académica de M-08 se conserva como antecedente y no entra al alcance del producto por estar dibujada.
