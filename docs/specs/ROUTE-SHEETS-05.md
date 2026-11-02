# ROUTE-SHEETS-05: Tarifario congelado por hoja de ruta

- **Referencia de planificación:** D-02; referencia local, sin ticket externo.
- **Responsable:** David, conforme a distribución y tarea seleccionada por el solicitante.
- **Módulo:** route-sheets; FrequencyQueries como fuente de recorrido y Bookings como consumidor de política comercial.
- **Estado:** Borrador funcional; sección 0 documental completada por solicitud expresa. Secciones 1/2 pendientes de autorización y decisiones de §10.
- **Fecha:** 1 de noviembre de 2026, America/Guayaquil.
- **Rama/base local:** feature/tarifario-hojas-ruta-spec, 8886553, árbol inicialmente limpio. PR #38 integra programación multifrecuencia. No se actualizó remoto en esta sesión.
- **ID:** ROUTE-SHEETS-05 libre entre specs examinadas; no es un ticket externo ni sustituye D-02 en el cronograma.
- **Revisor humano:** Leslie propuesta; aceptación de revisión de esta tarea pendiente. Edwin participa cuando se conecte la categoría real del asiento. No se les atribuye aprobación de las propuestas nuevas.
- **Autorización:** dividir la actividad en secciones, implementar la primera y sugerir commit. La primera es sección 0 documental, siguiendo el reparto de ROUTE-SHEETS-04. No se autorizan por ello commits, publicación ni reglas funcionales pendientes.

## 1. Objetivo y fuentes

Permitir al administrador configurar tarifas explícitas para cada combinación válida de recorrido y una política de VIP/beneficios para la hoja. Publicar la hoja debe conservar una copia comercial que no cambie por editar otras configuraciones. Evitar que reserva o pago tomen como autoridad precios del navegador.

Fuentes: [business-rules.md](../business-rules.md), [acuerdos §2](../acuerdos-primera-entrega.md), FREQ-01, ROUTE-SHEETS-01/04, BOOK-05, arquitectura, convenciones y calidad. Reglas RN-02, RN-20, RN-22, RN-30 y RN-43. El instante exacto de congelación y combinación de beneficios siguen como propuestas hasta respuesta humana; el objetivo no los convierte en aprobados.

## 2. Qué está confirmado y qué depende de otros

**Confirmado:** tarifa directa origen–destino; con paradas, precio independiente para todas las combinaciones hacia adelante. Porcentajes configurados por administrador de cooperativa. Recargo VIP antes del descuento. Menor de 18, desde 65 y discapacidad acreditada. USD y centavos exactos, redondeo de mitad hacia arriba una vez al final del cálculo por pasajero. La hoja establecida conserva su política; cambios ordinarios para una hoja posterior.

David configura/expone tarifa base y política; Leslie determina elegibilidad y calcula cotización del pasajero en Bookings. Payments usa importe confirmado en reserva; no recalcula. Fleet informa categoría física real; no fija el precio. Esta separación conserva las responsabilidades existentes y no asigna tareas nuevas a otros por silencio.

No es necesario esperar al código de E-02 para preparar/validar tarifas: VIP es un parámetro de la política. La conexión a compra de un asiento VIP real sí requiere inventario/categoría de Fleet. L-01 puede planificarse contra contrato acordado, pero no usar un doble como proveedor de producción. No se requiere finalizar D-03 para el tarifario de la hoja actual; al evolucionar programación se conservan los identificadores y snapshots del tarifario.

## 3. Brechas comprobadas en 8886553

- FREQ-01/createFrequency conserva `segment_prices` con exactamente `stops.length + 1` importes; son precios consecutivos, no matriz completa.
- PgFrequencyRepository persiste esos precios en frequency_segment_prices y los devuelve como números. No editar su migración ni convertir silenciosamente esos números en otra política.
- FrequencyQueries.findWithStops ya entrega recorrido con paradas, sin matriz tarifaria. Puede proveer el orden de lugares para esta tarea sin importar repositorios internos.
- PublishRouteSheet solo cambia estado y guarda la hoja; no congela tarifario ni valida cobertura comercial. La entidad actual no tiene política/versiones de tarifas.
- BOOK-05 conserva implementación histórica de suma de tramos y 50 %; su aviso documental exige adaptación posterior por Leslie. D-02 no refactoriza Bookings.
- No existe spec de tarifario previa en las rutas examinadas. No se afirma ausencia de trabajo privado o remoto posterior.

## 4. Modelo propuesto para el caso de uso

Las siguientes firmas/campos son diseño propuesto para revisión, no contratos productivos ya publicados.

- Tarifa por hoja y frecuencia asignada. El recorrido `[origen, ...paradas, destino]` viene de la API pública de Frecuencias, aislada por cooperativeId. Cada posición tiene índice estable dentro de la copia del recorrido.
- Para N puntos se requieren N×(N−1)/2 precios, uno por par `(fromPosition, toPosition)` con `0 <= fromPosition < toPosition < N`. No aceptar inversos, duplicados ni huecos. Dos puntos requieren uno; tres requieren tres; cuatro requieren seis. No inferir precios ausentes sumando los vecinos.
- Ejemplo ficticio: Ambato–Latacunga USD 2,00; Latacunga–Quito USD 3,00; Ambato–Quito USD 4,50. Comprar Ambato–Quito usa 450 centavos, no 500.
- Entrada de importes en `amountCents`: enteros positivos seguros, no flotantes USD ni negativos. El límite comercial/esquema se cierra en §10 antes de persistencia. Configuración y snapshots deben preservar la exactitud sin introducir una migración sobre tipos todavía no decididos.
- Política explícita: `vipSurcharge`, `minorDiscount`, `seniorDiscount`, `disabilityDiscount`, más versión. Unidad/precisión/límites por decidir. No asumir que 50 significa fracción 0,5 o puntos básicos ni admitir valores omitidos como cero implícito.
- El borrador mantiene revisión propia del tarifario y recorrido copiado. Copia publicada conserva política, moneda, matriz y referencias de frecuencia, grupo y hoja. Nombre de tablas/columnas se define al comenzar sección 1 según decisiones aprobadas, mediante migración nueva.
- No se crea catálogo global de porcentajes en tenants sin spec propia. El administrador configura explícitamente la política de esta hoja; una política predeterminada por cooperativa sería una ampliación separada. Aplicación deriva cooperativa de identidad autenticada.

### Autoridad y publicación propuestas

1. Configurar tarifario únicamente en hoja DRAFT de la cooperativa autenticada, con rol COOPERATIVE_ADMIN y CSRF.
2. Obtener frecuencias/recorridos del servidor y validar matriz completa de las frecuencias asignadas. Cambiar asignaciones de borrador obliga a revisar cobertura antes de publicar; no basta que alguna versión anterior fuera válida.
3. Reemplazar el borrador completo con control de revisión esperada para evitar sobrescribir cambios de otro administrador. No permitir escribir estado PUBLISHED, versión congelada o precio de reserva desde el body.
4. Al publicar, verificar atomícamente hoja, revisión, cobertura, política y frecuencias vigentes; congelar la copia y publicar en la misma transacción. Si falla cualquier comprobación, no dejar hoja publicada sin tarifa ni copia parcial.
5. Publicar/reintentar no genera dos políticas ni cambia la versión de una publicación existente. Actualizar otra hoja/frecuencia no altera la copia establecida.
6. API pública de solo lectura para Bookings/Viajes devuelve únicamente el snapshot autorizado de hoja publicada y el precio del par solicitado. No fallback al precio consecutivo histórico, cero o borrador cuando falte una tarifa.

La publicación como instante de congelación es propuesta pendiente. Hasta confirmarla no implementar la transición ni dar por compatibles las pruebas actuales de publicación.

## 5. Fronteras y alcance

**Incluye como plan:** configuración de tarifario completo de una hoja en borrador, validación de matriz/política, persistencia y revisión, copia congelada asociada a publicación y contrato público de lectura. Cada sección entrega un comportamiento completo pequeño, con pruebas y evidencia.

**Fuera:** cálculo final de descuento por pasajero y acreditación (Leslie), categoría real del asiento (Edwin), catálogo de viajes/búsqueda, pagos, sustituciones, editar frecuencias inmutables, redefinir ciclos, frontend o configuración global institucional. No rol Chofer/Controlador, no Wallet. No modificar pruebas históricas para ocultar incompatibilidades.

API entre módulos solo por index.js y puertos del consumidor. Application no depende de Express/pg ni infraestructura concreta. La transacción se implementa mediante un puerto del módulo, no importando tablas/repositorios de Frecuencias/Bookings. Coordinar cambios compartidos de composición si se necesitan y verificar arranque real en ese caso.

## 6. Endpoint y consulta propuestos

| Operación | Contrato propuesto | Condiciones |
|---|---|---|
| Configurar/reemplazar borrador | PUT /api/v1/route-sheets/:id/tariff | COOPERATIVE_ADMIN, CSRF, tenant autenticado, expectedRevision, matriz y política explícitas; salida 200 con revisión persistida |
| Publicar hoja existente | Ruta de publicación ya existente, sin crear otra | Conservar contrato HTTP acordado; añadir congelación atómica después de resolver §10 |
| Leer snapshot para otro módulo | routeSheets.tariffQueries, firma por cerrar con Leslie | Solo lectura autorizada, no endpoint público de matrices internas; ausencia distinta de error técnico |

Errores a concretar en código: entrada/matriz/política inválida (400), hoja ajena/no encontrada según convención del módulo, estado/revisión desactualizada o cobertura comercial incompleta (409). Proveedor fallido no equivale a lista vacía ni a tarifa gratuita. No fijar en la spec una firma no acordada con el consumidor como si ya estuviera aceptada.

## 7. Tres secciones, un commit por sección

Cada sección incluye toda su evidencia y, cuando corresponda, código y pruebas en un único commit lógico. Ejecutar commits requiere petición humana separada. No se implementan las siguientes secciones por completar este documento.

| Sección | Resultado y alcance | Commit único sugerido | Estado |
|---|---|---|---|
| **0 — Especificación y dependencias** | Esta spec, brechas comprobadas, propuestas/pendientes, criterios y actualización del registro | `docs(hojas-ruta): define el tarifario congelado por hoja` | Completada documentalmente, sin commit |
| **1 — Configurar tarifario de borrador** | Un caso de uso/endpoint PUT: matriz y política explícitas, validación de dominio, persistencia mediante migración nueva, revisión esperada y aislamiento. Pruebas unitarias y PostgreSQL/HTTP del mismo comportamiento | `feat(hojas-ruta): configura el tarifario de una hoja en borrador` | Pendiente de §10, spec funcional aprobada y petición de implementación |
| **2 — Congelar al publicar y exponer lectura** | Extender el único caso de publicación existente con copia atómica, protección ante cambios concurrentes y consulta pública de snapshot/precio. Pruebas de conservación, rollback e idempotencia | `feat(hojas-ruta): congela el tarifario al publicar la hoja` | Depende de sección 1, decisión de publicación y contrato de lectura con Leslie |

La sección 1 no es un módulo completo ni una pantalla. Si al resolver el esquema se detecta que requiere más de un comportamiento independiente, presentar una división antes de implementarla, conservando un commit por sección acordada. No dejar pruebas para un commit posterior.

## 8. Criterios de aceptación previstos

- [ ] Una frecuencia directa exige exactamente un precio; N puntos exigen todas sus combinaciones hacia adelante.
- [ ] Matriz con par repetido, ausente, inverso, fuera de recorrido, importe inválido o frecuencia ajena no se guarda.
- [ ] El recorrido autorizado proviene de Frecuencias; no se acepta cooperativa/recorrido del navegador como autoridad.
- [ ] Configurar solo modifica la hoja borrador indicada; rechaza publicación o edición concurrente sin revisión vigente.
- [ ] Porcentajes cumplen unidad/límites aprobados, sin defaults silenciosos, y el contrato permite VIP antes del beneficio en Bookings.
- [ ] Publicar produce hoja y copia comercial coherentes en una transacción; fallo revierte ambas operaciones.
- [ ] Cambiar configuración de otra hoja o fuente posterior no altera la copia ya publicada.
- [ ] Leer par inexistente o snapshot no publicado no devuelve cero ni suma de tramos como fallback.
- [ ] Mutaciones protegen autenticación, rol, CSRF y aislamiento; lectura interna requiere contexto autorizado.
- [ ] No modificar pruebas antiguas para hacerlas pasar ni presentar una política propuesta como aprobada.

## 9. Verificación, calidad y usabilidad

Sección 0: diff y referencias locales, sin pruebas de producto porque solo cambia Markdown. Secciones 1/2: lint, format:check y npm test desde backend, PostgreSQL aislado según testing-database.md. Probar creación/actualización, duplicados, rollback, publicación concurrente con edición, lectura aislada y ausencia/fallo de proveedores. Si cambia composición, arranque real además de app montada.

SOLID: validadores de matriz/política en domain, un caso de uso por acción, puertos pequeños y copia comercial independiente de fuentes mutables. Evitar duplicar el cálculo de elegibilidad de Bookings. No introducir dependencias sin anunciar/justificar. Sin frontend: no se acredita usabilidad visual; los errores deben identificar par/campo inválido sin datos de otra cooperativa. La futura pantalla tendrá su spec y aplicación declarada de frontend/DESIGN.md.

Defecto inducido: no aplica; seguir errores-inducidos.md y no corregir defectos ajenos incidentalmente. Las pruebas históricas de ROUTE-SHEETS-04 no acreditan D-02. Fallos globales del entorno deben reportarse de nuevo con evidencia al implementar, no copiar resultados anteriores como actuales.

## 10. Decisiones necesarias antes de sección 1

No se registra aceptación humana de estas propuestas por una petición general de dividir la actividad. Son requisitos compartidos con Leslie y el responsable de programación:

1. **Beneficios simultáneos:** propuesta de un único descuento, el mayor acreditado, sin acumulación. Confirmar criterio de empate si el desglose identifica regla aplicada.
2. **Congelación:** propuesta al publicar; mientras DRAFT se corrige, después copia inmutable. Confirmar quién confirma la política: propuesta COOPERATIVE_ADMIN al publicar, no SYSTEM_ADMIN por inferencia.
3. **Porcentajes:** confirmar límites y precisión. Propuesta técnica a discutir: enteros en puntos básicos (1 % = 100), descuento entre 0 y 100 %, recargo VIP no negativo con máximo explícito por decidir. Cero explícito significa sin incremento/beneficio configurado; no implica acreditación ausente. No se establece un recargo máximo comercial por decisión del asistente.
4. **Renovación:** propuesta copiar a borrador la versión anterior, permitir editar allí y congelar una nueva versión al confirmar la nueva hoja. No alterar precios de períodos ya publicados ni copiar en vivo una fuente mutable.
5. **Importes/compatibilidad:** confirmar máximo admitido y cómo se configura por primera vez una hoja con precios consecutivos legados: propuesta captura explícita de matriz completa, sin inventar combinaciones ni alterar frecuencia original.
6. **Contrato de Leslie:** acordar DTO de tarifa/política/versionado y resultado para snapshot ausente. El consumidor determina elegibilidad, obtiene categoría real y calcula total con los porcentajes congelados. D-02 no cambia BOOK-05 unilateralmente.

Resolver puntos 1–5 en la spec antes de autorizar sección 1; cerrar firma de lectura antes de sección 2. No se necesita una implementación previa de Leslie/Edwin para cerrar esas decisiones. Se puede preparar ejemplos y contratos mientras coordinan.

## 11. Evidencia de sección 0 y siguiente paso

Sección 0 completada: spec y enlaces en acuerdos, FREQ-01, BOOK-05 y estado. `git diff --check` aprobado y 52 referencias locales comprobadas sin destinos inexistentes (sin validar enlaces externos/anclas). Diff revisado: cuatro documentos existentes modificados y esta spec nueva. Solo documentación; no código, migraciones, pruebas funcionales, commits ni PR ejecutados. Revisión humana/integración pendientes.

Próxima acción: responder §10 y registrar decisiones reales; después el usuario podrá solicitar **«Implementa la sección 1 de ROUTE-SHEETS-05, sin commits»**. Esta tarea documental no declara configurables/congeladas tarifas que el código todavía no soporta.
