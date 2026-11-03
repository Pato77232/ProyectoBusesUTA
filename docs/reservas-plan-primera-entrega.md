# Reservas: planificación L-01 a L-06

Fecha: 1 de noviembre de 2026, America/Guayaquil. Responsable: Leslie Coello.
Estado: borradores preparados; ningún incremento nuevo de producto autorizado por esta planificación.

## Evidencia y alcance de esta sesión

- Rama original: `feature/BOOK-03-resumen-creacion-dominio`, HEAD `c7ceed9`; árbol limpio al comenzar. No se creó copia ni se cambió de rama.
- Fetch realizado: `origin/develop` está en `b60201e`. No se incorporó a la rama local.
- [Acuerdos vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/b60201e/docs/acuerdos-primera-entrega.md) y [reglas vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/b60201e/docs/business-rules.md) leídos desde esa referencia. La copia local anterior de business-rules.md conserva política histórica; no usarla como autorización para porcentajes fijos.
- PR #25 (frecuencias), #26 (plantillas), #27 (buses), #29 (consultas), #33 (hojas de ruta) y #35 (acuerdos) comprobados integrados con GitHub. PR #31 (pantalla de buses) abierto, no integrado.
- Ramas remotas de flota, hojas de ruta, frontend y acuerdos consultadas. No se encontró en la API pública de route-sheets de develop una consulta de viaje comercializable con política congelada.
- Fleet ya ofrece busQueries y catálogo de plantillas; no volver a proponer crear buses desde cero. No acredita inventario VIP/accesible completo ni configuración congelada por hoja.
- BOOK-03 local ya tiene almacenamiento atómico, bloqueo por viaje, resumen, idempotencia, API, pantalla y acceso de cliente. No están integrados en develop ni adaptados a los acuerdos nuevos.
- La planificación no modifica producto, migraciones, pruebas o dependencias. No commit, push, merge, rebase ni tag. Sin defectos académicos nuevos.

## Autoridad y decisiones

Las etiquetas L-01…L-06 son identificadores de planificación del solicitante, no tickets externos ni specs aprobadas. Cada borrador siguiente complementa una spec BOOK existente. Las autorizaciones históricas conservan su alcance original; no autorizan automáticamente los cambios de política.

Confirmado por Leslie en este chat el 1 de noviembre: cuando coincidan beneficios, aplicar solo el porcentaje mayor, sin acumular. Falta acordar el desempate de categorías si tienen el mismo porcentaje para el desglose. Esta confirmación no se atribuye individualmente a Shirley o David.

Pendiente: acreditación antes de cotizar frente a beneficio provisional sujeto a revisión del oficinista. La pregunta sigue pendiente; no se elige por silencio. También faltan límites y precisión de porcentajes, momento de congelación, contrato comercializable, acceso invitado y las precisiones de pagos descritas en los borradores.

## Incrementos propuestos

| Actividad | Spec en borrador | Resultado verificable por incremento | Puerta antes de implementar |
| --- | --- | --- | --- |
| L-01 | [BOOK-05-L01](specs/BOOK-05-L01.md) | 1 contrato/política; 2 cálculo exacto; 3 resumen versionado | Acreditación, configuración, congelación y aprobación del incremento |
| L-02 | [BOOK-02-L02](specs/BOOK-02-L02.md) | 1 contrato real; 2 adaptador/disponibilidad; 3 composición y acceso | Viaje fechado e inventario versionado reales |
| L-03 | [BOOK-03-L03](specs/BOOK-03-L03.md) | 1 propiedad/modelo; 2 persistencia extendida; 3 carreras/reintentos | L-01/L-02 y relaciones de hoja/asignación |
| L-04 | [BOOK-06-L04](specs/BOOK-06-L04.md) | 1 transiciones; 2 expiración/recepción atómicas; 3 coordinador recuperable | Contrato con Shirley y orden de bloqueo |
| L-05 | [BOOK-07-L05](specs/BOOK-07-L05.md) | 1 lectura de ocupaciones; 2 recepción/lectura de pago; 3 venta/liberación | Relación persistida y contratos autorizados |
| L-06 | [BOOK-08-L06](specs/BOOK-08-L06.md) | 1 selección; 2 pasajeros; 3 resumen; 4 consulta/pago | APIs reales de cada pantalla y acreditación/propiedad |

La prioridad de L-05, lectura de ocupaciones, puede adelantarse cuando L-03 persista hoja/asignación; no depende de implementar aprobación de pagos. No ejecutar seis actividades como un módulo completo de una vez. Mantener un PR futuro por funcionalidad revisable con sus specs, código y pruebas; no abrir PR por cada documento/commit. No se publica PR en esta sesión.

## Reutilización y límites de la evidencia histórica

Conservar BOOK-02/T2a, BOOK-03-T1/T2/T3/T3-R/T4/T4-B/T4-C y las pruebas existentes. El cálculo histórico usa 50 % y suma de tramos consecutivos: no es autoridad de L-01. La nueva cotización requiere una ruta versionada explícita y pruebas propias; no cambiar expectativas históricas solo para aparentar cumplimiento.

Evidencia histórica local: BOOK-03 registra 961 pruebas backend y T4-C 54 frontend con QA identificado; no se han vuelto a ejecutar en esta sesión ni prueban los nuevos acuerdos. Los datos de viaje/acreditación de esas pruebas son fixtures, no proveedores de producción.

## Verificación y siguiente paso

Revisar los seis borradores y resolver primero BOOK-05-L01 §10. Autorizar un incremento específico una vez cerrado su contrato. Los nombres de campos/API propuestos no crean tablas ni comprometen a otros responsables.

Esta sesión verifica referencias Markdown locales y diff documental. No se ejecutan lint, format:check, npm test, PostgreSQL ni arranque porque no hay cambio funcional o ejecutable. Cada incremento funcional exige esos controles desde backend, base PostgreSQL exclusiva cuando corresponda y arranque real si cambia composición. Frontend exige además DESIGN.md y QA de navegador. Revisión humana e integración pendientes.


Resultado documental: 62 referencias locales en los 14 documentos afectados comprobadas sin destinos inexistentes; revisión de espacios finales y git diff --check aprobados. Cambios exclusivamente Markdown; rama y HEAD c7ceed9 conservados. Git informa normalización CRLF a LF en dos documentos, sin error de diff.
