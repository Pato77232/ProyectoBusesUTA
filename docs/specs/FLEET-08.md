# FLEET-08: Identificar los espacios accesibles de un bus

- **ID local:** FLEET-08; libre en las specs y ramas accesibles al comprobarlo el 2 de noviembre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `fleet`; lo consumen `bookings` y `route-sheets` mediante la API pública de Fleet
- **Responsable:** Edwin
- **Revisor propuesto / confirmado:** Leslie propuesta, por consumir el inventario; sin confirmación registrada
- **Estado:** Primer alcance autorizado por Edwin el 4 de noviembre de 2026; revisión humana pendiente. Las preguntas históricas de §10 quedan resueltas solo para la identificación sin venta descrita a continuación.
- **Prioridad y dependencias:** depende de FLEET-02 y FLEET-03, en develop, y de FLEET-06, sin publicar. Conviene hacerla después de [FLEET-07](FLEET-07.md), porque toca los mismos archivos.
- **Rama / PR / base comprobada:** sin rama propia; borrador local en `feature/FLEET-06-T1-lectura-asientos` sobre `e37051e`, 2 de noviembre de 2026; sin PR.
- **Autorización de alcance:** el 2 de noviembre de 2026 Edwin pidió agregar accesibilidad y separarla de VIP. Esta spec no autoriza implementar: faltan las decisiones de la sección 10.

## 1. Objetivo

### Alcance confirmado el 4 de noviembre

Edwin confirma «identificación sin venta automática»: posición de una celda de la plantilla como espacio de silla de ruedas, categoría ACCESSIBLE separada de NORMAL/VIP, siempre offered=false. No aumenta la capacidad comercial; acompañante en asiento normal independiente. No se presume reserva accesible disponible ni se modifica un bus ya registrado. La misma clave no puede ser VIP y accesible. Claves accesibles opcionales en el alta; existentes conservan sus valores. Nueva migración, sin cambiar las anteriores, con down bloqueado si hay espacios accesibles persistidos.

La API pública de Fleet identifica ACCESSIBLE. El consumidor de inventario comercial de Route Sheets valida que nunca esté ofrecido y lo excluye de la copia vendible; sigue fallando si una fuente intenta ofrecerlo. No cambian los DTO de los asientos comerciales NORMAL/VIP congelados. Es una adaptación mínima del consumidor, no una implementación de reserva accesible. DESIGN.md aplicado: campo explícito por piso reutilizando controles, tokens y teclado existentes; texto aclara que identificar no habilita ventas. Sin dependencias nuevas. Verificar registro/lectura/aislamiento, exclusión comercial, migración protegida, interfaz y regresión aislada.

RN-12 exige espacios para silla de ruedas, pero hoy ningún asiento se identifica como accesible. Reservas necesita distinguirlos para no venderlos como asientos normales.

## 2. Reglas de negocio involucradas

- **RN-12:** el bus mapea sus espacios para silla de ruedas; el inventario accesible requiere un contrato adicional.
- **Acuerdos §4:** los espacios accesibles no se convierten automáticamente en asientos normales. Siguen pendientes cómo se reservan, capacidad y acompañante, configuración visual y compatibilidad de sustituciones.

## 3. Alcance

**Incluye, según lo que se decida:**

- Indicar en el alta qué posiciones son espacios accesibles.
- Nueva migración para representarlos en `bus_seats`.
- Exponerlos en `seatQueries.listByBus`.
- Selección en el formulario de registro.

**No incluye:**

- Reserva o venta de un espacio accesible, que corresponde a Reservas.
- Editar un bus ya registrado o cambiar las plantillas publicadas.
- Sustitución de buses por avería.

## 4. Flujo principal

1. El administrador elige plantilla y marca las posiciones accesibles.
2. Fleet valida las claves contra la plantilla y guarda la identificación.
3. Reservas la lee con `listByBus` y aplica la regla que se acuerde.

## 5. Datos

Propuesta sujeta a la sección 10. Entrada nueva en `data` del alta:

| Campo | Tipo | Validación |
|---|---|---|
| `accessibleSeatKeys` | lista de `layoutSeatKey` | Opcional; claves existentes y sin repetir |

Los buses ya registrados no tendrán espacios accesibles identificados. La migración existente no se edita.

## 6. Endpoints

Sin rutas nuevas. `POST /api/v1/buses` acepta el campo anterior, con 400 si es inválido. `seatQueries.listByBus` los identifica, lo que cambia el contrato con Reservas.

## 7. Criterios de aceptación

- [ ] Dada una clave accesible válida, cuando se registra el bus, entonces esa posición queda identificada como accesible.
- [ ] Dado un espacio accesible, cuando se consulta, entonces no se presenta como asiento `NORMAL`.
- [ ] Dada una clave inexistente en la plantilla, cuando se registra el bus, entonces responde 400 y no crea nada.
- [ ] Dado un bus registrado antes de este cambio, cuando se consulta, entonces ninguna posición aparece como accesible.

## 8. Casos borde y errores

| Caso | Comportamiento |
|---|---|
| Espacio que ocupa más de una celda | Pendiente; hoy cada asiento ocupa una celda |
| Misma posición marcada como VIP y accesible | Depende de la decisión de representación |

## 9. Pruebas esperadas

- **Unitarias:** validación de claves y derivación de la identificación.
- **Integración con PostgreSQL aislado:** alta, buses existentes y lectura por `listByBus`.
- **Frontend:** selección en el formulario y prueba de pantalla.

## 10. Preguntas abiertas

Nada de esta sección está acordado.

### Decisión: ¿cómo se representa un espacio accesible?

- Estado: Propuesta
- Fecha y participantes consultados: pendiente; Edwin y Leslie
- Reglas, specs y contratos afectados: RN-12, acuerdos §4 y BOOK-02
- Opciones y recomendación: (A) tercera categoría `ACCESSIBLE`; (B) campo aparte, para combinarlo con VIP. Se recomienda A por ser un solo campo; solo B permite un espacio accesible VIP.
- Respuesta humana y evidencia de confirmación: pendiente
- Decisión y justificación: pendiente
- Responsable de aplicarla y revisor: Edwin; Leslie propuesta
- Criterios de aceptación/pruebas que cambian: secciones 5 y 7
- Trabajo dependiente e independiente: depende T1
- Decisión anterior que reemplaza, si aplica: ninguna

### Decisión: ¿cómo se reserva un espacio accesible?

- Estado: Propuesta
- Fecha y participantes consultados: pendiente; Edwin, Leslie y David
- Reglas, specs y contratos afectados: acuerdos §4, BOOK-02 y BOOK-03
- Opciones y recomendación: (A) reservable como un asiento; (B) solo por oficinista; (C) identificado pero no vendible en esta entrega. Se recomienda C mientras no se acuerde la regla, avisando que RN-12 queda cubierta solo en parte. Con A o B hay que definir capacidad y acompañante.
- Respuesta humana y evidencia de confirmación: pendiente
- Decisión y justificación: pendiente
- Responsable de aplicarla y revisor: Leslie; Edwin como consultado
- Criterios de aceptación/pruebas que cambian: segundo criterio de la sección 7
- Trabajo dependiente e independiente: depende la venta en Reservas; T1 solo necesita la decisión anterior
- Decisión anterior que reemplaza, si aplica: ninguna

### Otras preguntas

1. **Configuración visual:** qué necesita mostrar la pantalla de asientos.
2. **Sustituciones:** cómo se comprueba la compatibilidad de espacios accesibles; participa David.

## 11. Defecto inducido

No aplica.

## 12. Diseño SOLID y usabilidad

- **Responsabilidades:** Fleet identifica el espacio; Reservas decide si se reserva y cómo.
- **Usabilidad:** el administrador debe distinguir accesible, VIP y desactivado sin depender solo del color, con teclado y en pantalla pequeña. Se verificará en T2.

## 13. Plan y evidencias

| Paso | Resultado comprobable | Archivos compartidos |
|---|---|---|
| T1: accesibilidad en backend | Espacios identificados en alta y consulta | Los mismos de FLEET-07 T1 |
| T2: formulario | Selección en la pantalla de registro | `bus-form.js`, `bus-form-view.js`, de la PR #37 |

**Evidencias:** pendientes; no hay implementación.

## 14. Revisión y cierre

Pendientes. Próxima acción: consultar con Leslie y David las decisiones de la sección 10.

### Implementación del alcance confirmado, 4 de noviembre de 2026

Backend/formulario implementados en `feature/FLEET-08-espacios-accesibles`, sobre la combinación INTEG-01 publicada (16e7a1c), no sobre develop integrado. Los apartados históricos anteriores conservan su fecha; el contrato vigente es el confirmado al inicio. `accessibleSeatKeys` opcional crea ACCESSIBLE/false; VIP simultáneo o clave inválida se rechazan. La capacidad incluye solo los asientos ofrecidos. La copia comercial valida ACCESSIBLE no ofrecido y lo excluye; el contrato vendible sigue NORMAL/VIP. Nueva migración 1794270000000, catálogo de 30 entradas; down rechaza degradar espacios persistidos. Sin editar migraciones existentes.

Resultados propios: frontend 317/317 y diez comprobaciones Chrome aprobadas (incluyen conflicto VIP/accesible, envío y limpieza de marcas, teclado y reflujo móvil). Captura `accesibilidad-1280.png` inspeccionada visualmente en QA temporal `entrega-fleet08-qa`, sin añadir datos reales. Lint backend aprobado; unitarias 1931/1931. Primera integración completa 648 aprobadas/2 fallidas: las comparaciones antiguas de definición esperaban exactamente la categoría NORMAL/VIP. Se actualiza exclusivamente esa definición a NORMAL/VIP/ACCESSIBLE, manteniendo todas las demás comparaciones y añadiendo rechazo SQL de ACCESSIBLE ofrecido y categoría desconocida. Repetición de catálogo y lectura de asientos: 28/28 aprobadas. No se presenta esa repetición como otra ejecución global completa.

Un primer Chrome detectó que reutilizar la clase del grupo de desactivación duplicaba sus leyendas en el selector de la prueba; se separó la clase accesible conservando su apariencia y las aserciones anteriores. Repetición diez comprobaciones aprobadas. No se desactiva ninguna prueba ni timeout. PostgreSQL 16.13 efímero con sufijo _test y Node 24; sin .env. Publicación/revisión humana pendientes. No reserva accesible, sustitución, edición de buses ni categorías accesibles VIP. Asistencia de Codex.
