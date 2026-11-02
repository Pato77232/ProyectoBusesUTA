# Coordinación de dependencias de Pagos — 2 de noviembre de 2026

Base consultada origin/develop 8fdf7e4. Rama documental
feature/ACUERDOS-01-contratos-pagos. Fuente humana: Pablo compartió el mensaje
de Shirley y solicitó realizar la preparación. No se enviaron mensajes a terceros.
No hay respuesta nueva de Leslie ni autorización para implementar contratos abiertos.

## Registro de decisiones y evidencia

### Decisión: revisión y coordinación de módulos
- Estado: Acordada según confirmación de Shirley reportada por Pablo.
- Participantes: Pablo y Shirley; sin aceptación individual adicional atribuida a Leslie.
- Respuesta: Shirley toma la aceptación de Pablo para revisar Pagos en PR separadas,
  la creación CLERK, QA y coordinación frontend. Conciliará con Leslie las specs
  y compartirá decisiones antes de implementar lo dependiente; incluirán a Pablo
  antes de cerrar cambios de autenticación o permisos.
- Alcance: Pablo revisa PAGOS-02 y después PAGOS-03, PAGOS-CORR-01 y PAGOS-CAJA-01
  en entregas separadas; no implica aprobación anticipada ni disponibilidad comprometida.
- Pantallas: Shirley implementa las de su módulo con cliente común; coordina archivos
  compartidos antes de cambiarlos; Pablo revisa, salvo redistribución acordada.
- QA: crear CLERK por endpoint cuando exista solo en entorno aislado; mientras tanto,
  identidades ficticias de pruebas. No guardar/compartir contraseña en Git o chats.
- Specs de Pagos citadas por Shirley no fueron encontradas en develop ni ramas de
  Pagos accesibles consultadas; solicitar su rama/PR para revisar sin recrearlas.

### Decisión: autoridad del alta CLERK
- Estado: Acordada en reglas previas y aceptada por Shirley; contrato técnico por revisar.
- RN-01/02/03: solo COOPERATIVE_ADMIN de la misma cooperativa; email/password;
  rol fijo CLERK, cooperativa de sesión y CSRF. Sin elegir SYSTEM_ADMIN como alternativa.
- Responsable: Pablo prepara spec/endpoint; Shirley revisa necesidades de Pagos.
- Próxima evidencia: revisión de [AUTH-06](specs/AUTH-06.md), no endpoint implementado.

### Decisión: diseño base de correo y acceso invitado
- Estado: Base aceptada por Shirley; detalles pendientes, no implementación autorizada.
- Correo: pendiente, aceptación del proveedor, entrega confirmada y fallos
  temporales/definitivos. Avisos identificables e idempotentes; ningún fallo de
  envío repite cobros o deshace venta. [CORREO-01](specs/CORREO-01.md).
- Invitado: Auth acredita contexto interno limitado a compra; Pagos comprueba
  pertenencia, estado y plazo. [AUTH-INVITADO-01](specs/AUTH-INVITADO-01.md).
- Pendientes: proveedor/contratos/confirmaciones/reintentos con Shirley; contexto,
  vencimiento, revocación, reenvío y CSRF con Leslie y Shirley.
- No se toma el silencio de Leslie como aceptación; las propuestas de campos y
  transporte son borradores, no decisiones colectivas.

### Decisión: formatos del comprobante
- Estado: Ratificados por Shirley y registrados por solicitud de Pablo.
- RN-50–54 / PAGOS-01: PDF, JPEG y PNG, máximo 5 MiB por archivo (5 242 880 bytes).
  Validar contenido real, extensión y MIME; el Content-Type declarado no basta.
- Conserva los plazos aprobados y evidencia previa; no certifica adaptación del
  código. No extrapolar fotos de Fleet ni habilitar otros formatos.
- Revisión e implementación: Shirley en su módulo; Pablo revisa según acuerdo.

## Consultas listas para compartir; todavía no enviadas

**Shirley:** te comparto AUTH-06 y CORREO-01 para revisión documental. En CLERK,
revisemos ruta/respuesta/errores antes de implementar. Para correo necesitamos
proveedor, entradas/salidas, confirmaciones y política de errores/reintentos;
las opciones están separadas de las decisiones aceptadas. Pásame las ramas/PR
de tus nuevas specs de Pagos para enlazarlas sin duplicarlas.

**Leslie y Shirley:** revisemos AUTH-INVITADO-01. Necesitamos definir primero
qué identifica una compra frente a una reserva y su cooperativa, y después los
campos del contexto, vencimiento/revocación, canje/reenvío y CSRF. Propongo dejar
una tabla con escenario, resultado y responsable, más ejemplos de acceso a compra
propia/ajena y corrección vencida. La duración y los límites requieren su respuesta;
no se implementará la integración usando valores supuestos.

## Orden y condiciones de continuación

1. PR #42 integrada en 8fdf7e4; aprobación de shirley6126 sobre 58d4cbe
   comprobada el 2 de noviembre. Windows/lint y pruebas confirmados por revisora.
   El formato global sigue fallido en 17 archivos; aprobación no lo resuelve.
2. Revisar/guardar esta documentación en entregas lógicas; aprobación de producto
   o aprobación de PR #42 no aprueba automáticamente estas nuevas specs.
3. AUTH-06: cerrar revisión técnica y después implementar un incremento pequeño.
4. CORREO-01 y AUTH-INVITADO-01: cerrar sus consultas antes de programar lo dependiente.
5. Pantalla del login integrada separadamente desde PR #45 en 3d053a4,
   comprobado al resolver conflictos. No se mezcla código en estas dependencias
   ni se infiere cierre global de AUTH-WEB-01.

Publicación documental solicitada por Pablo tras la consulta de Shirley;
no equivale a aprobar contratos abiertos. Sin cambios de producto, pruebas o
dependencias. No se atribuyen pruebas nuevas
a esta documentación. Asistencia de Codex; revisión humana documental pendiente.


## Conciliación del lector con la consulta nueva de Shirley

[Contrato propuesto](contratos/lectura-reservas-pagos.md): origen/proyección de
authContext, vigencia por solicitud, matriz y traducción de errores. Los códigos
nuevos, contexto y DTO siguen por confirmar con Leslie/Shirley. La propuesta
separa reintentos durables; no entrega autorización de servicio al lector.
Referencia y huella del adjunto preservadas en el contrato, sin atribuir código
privado o pruebas de PAGOS-02 a develop. Consulta conjunta lista, no enviada.


## Decisión del lector por delegación reportada — 2 de noviembre de 2026

Pablo comunicó que Leslie/Shirley aceptan sus decisiones y delegó la selección
técnica en esta sesión. Fuente: mensaje de Pablo; no verificación individual de
propiedades del esquema ni aprobación de código por los otros integrantes.
[Contrato del lector](contratos/lectura-reservas-pagos.md), §§1–4, seleccionado:
firma de dos argumentos, contexto mínimo desde solicitud autenticada y códigos
explícitos; inicio del plazo proofWindowStartedAt persistido, separado de createdAt;
recepción aceptada persistida en Bookings como requisito de canUploadProof=true.

Leslie prepara datos/lector; Shirley adapta consumidor/errores; Pablo revisa
contrato y Auth. La asignación conserva responsabilidades de referencia, no
inventa fechas ni afirma implementación. Si los datos no existen, se incorporan
en el incremento correspondiente con migración nueva y pruebas; no se suplanta
la ausencia con null/false ni se habilita carga con true ficticio. No hace falta
otra aceptación genérica para este diseño; sí revisión de cada implementación.

Este registro reemplaza las consultas pendientes sobre decisiones del lector;
los detalles de correo, invitado y autorización de trabajadores siguen en sus
especificaciones separadas. Mensaje informativo listo en el contrato; no enviado.
Pablo solicitó guardar/publicar esta decisión en la rama de PR #46; el commit
que incluye esta constancia reúne contrato y trazabilidad como un cambio lógico.
Sin pruebas de producto nuevas ni comunicación enviada a terceros.
