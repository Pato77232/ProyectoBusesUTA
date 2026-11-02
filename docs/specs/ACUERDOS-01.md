# ACUERDOS-01: Consolidar acuerdos de la primera entrega

- **Estado:** En revisión documental local; no integrada.
- **Responsable de preparación:** solicitante del chat con asistencia de Codex; referencia de trazabilidad David, sin atribuir identidad autenticada ni aceptación de otros integrantes.
- **Fecha:** 1 de noviembre de 2026.
- **Rama/base:** `feature/acuerdos-funcionales-primera-entrega`, `0b4041e`.
- **Autorización:** petición humana de actualizar documentación en la rama existente, sin implementar producto ni hacer commits.
- **Revisor humano:** pendiente de designar; debe ser otra persona.

## Objetivo y alcance

Consolidar las respuestas humanas, contradicciones y dependencias en [acuerdos-primera-entrega.md](../acuerdos-primera-entrega.md), actualizar reglas funcionales y señalar contratos históricos reemplazados. Incluye propuestas de programación/fronteras y defectos visuales; no autoriza su ejecución. No crea endpoints, migraciones, dependencias, cuentas, roles ni cambios visuales. Sin comandos Git de integración/publicación.

## Reglas y diseño

RN-01–03, RN-12, RN-20–23, RN-30–32, RN-40–43 y RN-50–55. Mantener fuente de verdad en business-rules.md y enlaces de reemplazo en specs afectadas. Conservar evidencia histórica, no presentar decisiones propuestas como aceptadas. Arquitectura vigente; la distribución de contratos es propuesta hasta cerrar las specs de implementación. No interfaz modificada; usabilidad pendiente de pruebas de cada pantalla y frontend/DESIGN.md en su futura spec.

## Criterios de aceptación

- [x] Registrar respuestas humanas y distinguirlas de propuestas y vacíos.
- [x] Registrar cambios de reglas y señalar qué specs necesitan adaptación.
- [x] Respetar exclusión actual de Chofer/Controlador y aplazamiento de Wallet.
- [x] Actualizar estado con alcance documental, sin declarar entrega completa.
- [x] Proponer defectos visuales con reproducción, sin introducirlos.
- [ ] Revisar acuerdos con responsables afectados y resolver pendientes bloqueantes de sus respectivas implementaciones.
- [ ] Revisión humana e integración verificable.

## Verificación y evidencia

Se leyeron apuntes adjuntos y documentos versionados sin secretos. Diff documental revisado; `git diff --check` aprobado; 130 referencias locales comprobadas sin destinos inexistentes, excluyendo enlaces externos y anclas. Alcance: 26 documentos existentes y tres nuevos, sin producto. No se ejecutan suites backend porque no se modifica código ni configuración ejecutable; ninguna prueba histórica acredita las nuevas reglas. No hay defectos inducidos introducidos. No commit, push, merge, rebase ni tag. Avisos de normalización CRLF→LF en tres documentos, sin errores de diff.

## Próxima acción

Revisar el diff documental y elegir revisor humano. Resolver cada pendiente antes de su spec de producto; luego dividir implementación por caso de uso/endpoint. PR y commit solo mediante petición/autorización correspondiente; no declarar cierre por terminar esta redacción.


## Seguimiento documental — 2 de noviembre de 2026

Pablo pidió realizar el orden de trabajo tras compartir la aceptación de Shirley.
Se registra evidencia en [dependencias de Pagos](../dependencias-pagos.md), se
ratifican formatos sin reescribir evidencia histórica y se preparan tres specs
en borrador (AUTH-06, CORREO-01, AUTH-INVITADO-01). Sin producto ni decisiones
pendientes inventadas; Leslie todavía debe responder el contrato de invitado.
Revisión APPROVED de PR #42 verificada en GitHub; no implica merge ni aprobación
de estas nuevas specs. Rama feature/ACUERDOS-01-contratos-pagos desde 8fdf7e4.
Pablo solicitó posteriormente publicar esta documentación para revisión.
Sin cambios de producto ni integración. Asistencia de Codex.

Validación documental: diff completo revisado, git diff --check aprobado y
112 enlaces locales comprobados sin destinos faltantes. No se encontraron specs
homónimas de los tres IDs nuevos en las referencias remotas consultadas.
No se ejecutan lint/Jest ni se reutilizan conteos como pruebas nuevas: únicamente
cambian documentos. Revisiones y mensajes humanos se distinguen de propuestas.


## Publicación y conciliación del lector

Se recuperó el trabajo resguardado en stash sin borrarlo; nueva rama documental
feature/ACUERDOS-01-contratos-pagos desde develop 8fdf7e4 para conservar PR #42.
Specs/registro guardados por cambio lógico separado de la conciliación de
[lectura Reservas–Pagos](../contratos/lectura-reservas-pagos.md), ratificación de
formatos y seguimiento. Se publicará PR documental en borrador para revisión;
no autoriza implementación dependiente ni sustituye respuestas de Leslie/Shirley.
Validación final: diff completo revisado y enlaces locales comprobados, sin
destinos faltantes. No lint/Jest nuevos: solo cambian documentos. Se conservan
como históricos los resultados anteriores y el formato backend pendiente.


### Selección del lector por delegación — 2 de noviembre

Pablo reportó aceptación general de sus decisiones por Leslie/Shirley y delegó
la selección técnica. Se fija el diseño del lector en
[contrato](../contratos/lectura-reservas-pagos.md), sin inventar que createdAt
ya coincide con el inicio contractual o que recepción aceptada ya se persiste.
Se exige inicio explícito inmutable y evidencia persistida de recepción; se
actualizan DTO y requisitos de pruebas. No hay producto nuevo ni aprobación
de código; la revisión humana de los incrementos sigue vigente. Pablo solicitó
guardar/publicar esta actualización en PR #46. Diff completo revisado y 65 enlaces
locales comprobados sin destinos faltantes. No se ejecutaron suites nuevas por
cambiar solo Markdown. Asistencia de Codex.


### Resolución de conflictos documentales — 2 de noviembre

Develop avanzó a 3d053a4 al integrar PR #45. PR #46 quedó en conflicto por
inserciones concurrentes en estado-proyecto.md y specs/AUTH-WEB-01.md.
Se conserva la spec de login exactamente como está integrada en develop y
se reubica el seguimiento de Pagos al final del estado, manteniendo decisiones
y evidencia en sus documentos propios. El seguimiento actual indica PR #45
integrada sin inventar cierre global ni pruebas nuevas.

Resolución comprobada por comparación textual de tres vías: ambos archivos
sin conflictos y resultado idéntico al contenido preparado. Diff revisado,
enlaces locales comprobados y sin marcadores. No merge/rebase ni cambios de
producto: el commit documental conserva ambas líneas de trabajo y permite
actualizar la misma PR. No se ejecutaron suites por cambiar solo Markdown.
