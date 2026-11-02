# AUTH-INVITADO-01: Acceso autorizado limitado a una compra

- **ID local:** AUTH-INVITADO-01; sin ticket externo.
- **Responsable de preparación:** Pablo. **Participantes:** Leslie y Shirley;
  revisión/aceptación del contrato exacto pendientes.
- **Estado:** Borrador técnico; diseño base aceptado por Shirley, no implementado.
- **Base/fecha:** origin/develop 8fdf7e4; 2 de noviembre de 2026.
- **Referencias:** [reservas](../reservas-decisiones.md), [acuerdos](../dependencias-pagos.md),
  [RN-41/42 y RN-50–54](../business-rules.md), [arquitectura](../architecture.md).

## Objetivo y alcance aceptado

Auth valida acceso secreto y entrega un contexto interno limitado a la compra.
Pagos comprueba pertenencia de la reserva a esa compra, estado y plazo para cargar
o corregir. Invitado no obtiene rol CUSTOMER/CLERK ni cuenta automática. Conocer
UUID, cédula o email no concede acceso. Guardar hash del secreto, nunca secreto
recuperable; no incluirlo en logs, capturas o documentación.
Fuera: vinculación de historial, MFA, cambio de roles, cobro, emisión y pantalla.
No se habilita acceso invitado sustituyéndolo con un CUSTOMER ficticio.

## Propuesta de intercambio; pendiente de Leslie y Shirley

Proponer canjear enlace por contexto de sesión limitado, retirando el secreto de
la URL tras validar, antes de usar Pagos. Elegir canal seguro del enlace y prevención
de filtraciones en historial, referrer y herramientas de observabilidad. El medio
exacto (cookie/sesión u otro) y CSRF no están aprobados; no heredar automáticamente
JWT CUSTOMER ni crear una política alternativa en el frontend.

Contexto interno candidato, emitido exclusivamente por Auth:
- principalType=GUEST_PURCHASE y purchaseId autorizado.
- grantId para revocación/auditoría, expiresAt y permisos de compra acordados.
- cooperativeId únicamente si deriva de compra autorizada y si el modelo de Leslie
  confirma una cooperativa por compra; nunca elegido por body.
Campos, nombres e invariantes pendientes. Pagos no acepta este objeto del navegador.
Bookings valida propiedad/asociación de la reserva por su API pública; Pagos no
consulta tablas de reservas ni asume que purchaseId equivale a reservationId.
Permisos candidatos separados: consultar compra, subir y corregir comprobante;
poseer acceso no elimina reglas de estado, aprobación ni plazos.

## Preguntas para cerrar en conjunto antes de implementar

| Pregunta | Recomendación para discutir | Afectados |
|---|---|---|
| Compra y reservas | Acordar relación/identificadores y si abarca varias cooperativas | Leslie, Shirley, Pablo |
| Vencimiento | Reloj explícito, duración configurable y revocación efectiva | Los tres |
| Uso del enlace | Canje de un solo uso por sesión limitada; confirmar recuperación | Los tres |
| Reenvío | Límites, verificación de destinatario y revocación del acceso anterior | Los tres |
| CSRF y transporte | Sesión del mismo origen protegida para mutaciones; revisar ADR 0004 | Pablo, Shirley |
| Corrección | Separar vencimiento del acceso y plazo de corrección; no reiniciar reserva | Leslie, Shirley |
| Errores | Respuestas genéricas ante enlace inválido/vencido/revocado, sin enumeración | Los tres |

No asignar duraciones, cantidades o estados finales por inferencia. El correo
necesita su contrato/adaptador; CORREO-01 cubre inicialmente corrección y boletos,
no autoriza ya el envío del enlace. Preparar su incremento después del acuerdo.

## Criterios y pruebas previstas

- [ ] Compra A no permite leer/cargar/corregir sobre compra B o reserva ajena.
- [ ] Un UUID/cédula/email o contexto forjado no concede permisos.
- [ ] Secreto inválido, vencido o revocado es rechazado antes de leer archivos.
- [ ] Autorización válida no salta aprobación previa ni vencimiento de corrección.
- [ ] CSRF/repetición/concurrencia se comprueban conforme al mecanismo acordado.
- [ ] Reenvío/revocación y confirmación de correo no exponen existencia de compras.
- [ ] Sin credenciales, secretos ni datos personales en respuestas de error/logs.

Unitarias de concesiones/reloj, integración Auth–Bookings–Pagos por APIs públicas
y QA aislado; no se declara probado antes de existir implementación. Plan: acuerdo
→ spec cerrada → validación/canje y persistencia → adaptadores de autorización
→ pruebas conjuntas. Cada incremento necesita su alcance antes de programar.
SOLID: Auth acredita, Bookings decide propiedad y Pagos valida acción/plazo;
puertos pequeños, sin repositorios internos cruzados. Sin UI en este alcance;
futura vista debe explicar enlace vencido y recuperación sin revelar compras.
Sin defecto inducido ni dependencias nuevas. Asistencia de Codex.
