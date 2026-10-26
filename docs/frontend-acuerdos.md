# Acuerdos para el frontend compartido

Referencia: [FRONT-01](specs/FRONT-01.md). Fecha de registro: 25 de octubre de 2026. Estado: **Recomendaciones F-A1–F-A6 acordadas, según confirmación reportada por Pablo**. Pablo autorizó posteriormente implementar solo T1; T2–T4 siguen pendientes.

## Constancia de la confirmación

- Pablo informó en este chat: «todos estuvieron de acuerdo con tus recomendaciones», por comunicación directa.
- Equipo al que se refiere la propuesta: Pablo, Edwin, David, Leslie y Shirley.
- Fuente de la constancia: reporte humano de Pablo; no se cuenta con respuestas individuales adjuntas, acta firmada ni canal específico identificado. No se inventan esos datos ni se exige reconstruirlos para registrar el reporte.
- Alcance confirmado: recomendaciones generales de F-A1–F-A6 de la tabla inferior. No implica que se hayan elegido versiones o puertos concretos, que todos tengan endpoints listos ni que Shirley haya aceptado una revisión específica.
- La fecha indicada corresponde al registro de la confirmación; no se conoce la hora o fecha exacta de cada conversación.
- Este acuerdo de enfoque no es una revisión de código ni una integración en develop. No requiere Jira para conservar su trazabilidad.

## Qué ya está decidido

ADR 0003: HTML + JavaScript en módulos ES + Bootstrap 5 y contenedor propio. ADR 0004: cookie HttpOnly y protección CSRF. Cada autor realiza sus pantallas; Pablo prepara la base. No hace falta volver a elegir un framework ni cambiar la autenticación para esta tarea.

## Recomendaciones confirmadas según el reporte

| Referencia local | Pregunta / opciones | Recomendación y motivo | Personas afectadas |
|---|---|---|---|
| F-A1 | ¿Un origen con proxy o frontend/API en orígenes diferentes con CORS? | Un origen; permite rutas relativas y evita añadir configuración de CORS/cookies entre orígenes | Pablo y los cuatro autores de pantallas |
| F-A2 | ¿Páginas HTML separadas o enrutamiento SPA? | Páginas HTML con módulos ES compartidos; navegación pequeña y explícita sin router/framework nuevo | Todos |
| F-A3 | ¿Bootstrap local o CDN? | Archivos locales de una versión 5.x exacta por confirmar; reproducibilidad y demostración sin depender de CDN. Comprobar licencia y procedencia antes de incorporar | Pablo y autores de pantallas |
| F-A4 | ¿Servidor estático y configuración local? | Proponer Nginx con imagen fija, puerto local configurable y override de desarrollo; acordar versión/puerto y compatibilidad HTTP/HTTPS antes del contenedor | Pablo y revisor de infraestructura |
| F-A5 | ¿Quién cambia navegación, estilo y cliente HTTP comunes? | Pablo coordina; cada autor usa contratos pequeños y evita editar los archivos comunes en paralelo sin aviso. El revisor se confirma por tarea | Todos |
| F-A6 | ¿Qué pantallas se conectan primero? | Tras la base, Pablo propone login como tarea aparte; los demás señalan sus endpoints listos y diseñan escenarios propios sin simular backend de producción | Todos |

F-A1–F-A6 son referencias locales de decisiones, no tickets. Las recomendaciones de la tabla se aceptaron como enfoque; su redacción conserva las alternativas consideradas. Versión exacta de Bootstrap/imagen, puerto y configuración concreta de proxy son detalles técnicos que Pablo seleccionará y documentará antes del paso que los utilice, respetando el enfoque confirmado y justificando cualquier dependencia nueva. No hace falta volver a votar el enfoque por cada detalle interno.

## Consulta original conservada como antecedente

> Compañeros, preparé la propuesta FRONT-01 para que todos podamos empezar nuestras pantallas sobre la misma base. Conservamos HTML/JavaScript y Bootstrap 5. Propongo usar una sola dirección para página y API, con un proxy, páginas HTML separadas y un cliente común que maneje cookies, CSRF y errores. Cada uno seguiría haciendo las pantallas de sus tareas.
>
> Antes de programar, revisemos F-A1–F-A6: ¿están de acuerdo o qué alternativa proponen y por qué? Indiquen si ya empezaron frontend, qué endpoint tienen listo para conectar y si necesitan algo del cliente común. Después registramos las decisiones y escogemos solo el primer paso de implementación. Los detalles de servidor, versiones y entorno local los revisamos con la persona que confirme la revisión de infraestructura.

## Cómo registrar una respuesta

En la spec o este documento, añadir por cada decisión: estado, fecha, participantes que respondieron, opción confirmada, justificación, objeciones pendientes y tareas afectadas. Una recomendación de Codex no cuenta como respuesta. Si solo acuerdan parte del alcance, avanzar únicamente en esa parte tras su autorización y mantener lo demás pendiente.

## Próxima acción de Pablo

La confirmación está guardada junto con la spec y el estado en el commit documental `50dac78`: no repetir la consulta original. Al publicar la tarea, referenciar FRONT-01 en su PR para que el equipo pueda revisarla.

El incremento actual es **T1: esqueleto HTML accesible y recursos locales**, autorizado al solicitar guardar el commit documental y comenzar el código. Se eligió Bootstrap 5.3.8, con CSS local, licencia MIT y huella publicada comprobada; procedencia en frontend/assets/vendor/bootstrap-5.3.8/README.md. La verificación y los límites de T1 se registran en la spec. T2 conectará el contenedor y la API, con su política local de cookies, después de revisar el resultado de T1. No se vuelven a pedir los acuerdos generales ya reportados.

## Referencia visual posterior — FRONT-01 T1

Pablo solicitó cambiar el diseño con el contenido adjunto de DESIGN.md. La adaptación local y sus decisiones están en [frontend/DESIGN.md](../frontend/DESIGN.md); el original se conserva separado. Mantiene Bootstrap, recursos locales y el alcance T1. Los acuerdos F-A1–F-A6 anteriores no acreditan aceptación de esta nueva dirección visual por cada integrante. Se implementa como propuesta local para revisión; adopción general y revisión humana del diseño pendientes.

## Identidad confirmada posteriormente por Pablo

Pablo confirmó en este chat el nombre **transViaje**, el logo adjunto como definitivo y blanco/negro/violeta. Aclaró que los mockups son solo guía y delegó decidir su incorporación. Se conservaron los originales para trazabilidad, sin convertirlos en requisitos. [Constancia y fuentes](design/README.md), [catálogo orientativo](design/pantallas.md). La revisión de la aplicación y las futuras pantallas sigue pendiente; no es una aceptación individual atribuida al equipo. Pablo autorizó después adaptar la identidad visible: portada, metadatos, logo y favicon ya implementados localmente; revisión humana e integración pendientes.

## Guardado del avance

Pablo solicitó los commits atómicos. Recursos en `152f5a2`, documentación visual en `98d20bd` y portada/pruebas/estado en el commit de implementación que incluye esta constancia, todos con referencia FRONT-01. T1 sigue pendiente de revisión humana, publicación e integración; registrar commits no cierra la tarea ni autoriza T2.

## Preparación de T2 autorizada

Pablo autorizó preparar el siguiente incremento mientras T1 está en la PR #16. [Plan](frontend-t2-plan.md): Nginx con versión exacta propuesta, puerto loopback 8081 configurable y composición local independiente para no heredar NODE_ENV=production o datos existentes. Son detalles del enfoque F-A1–F-A4 ya confirmado, no una nueva votación del stack.

Solo se preparan documentos en `feature/FRONT-01-T2-proxy`; implementación y comprobaciones reales pendientes. La política de confianza de proxy/IP queda delimitada explícitamente antes de login integrado o despliegue. No se cambian reglas, autenticación ni criterios de aprobación humana.

## T2.1 autorizado e implementado localmente

Pablo pidió continuar con el empaquetado. Imagen Nginx fijada por versión/digest, portada servida sin root y prueba real del contenedor aprobada, sin añadir paquetes. Backend/API siguen sin conectar: 503 explícito en `/api/v1`; no se atribuyen pruebas de cookies o autenticación al servidor estático. Evidencia en FRONT-01, sección 19; próximo incremento propuesto T2.2. Sin commit/push y sin modificar la PR de T1.

## Guardado de T2.1 y continuidad recomendada

Pablo autorizó commits atómicos: plan en 2815747 y empaquetado/pruebas/estado en el commit de implementación que incluye esta constancia. Comprobada PR #16 abierta y sin revisiones registradas; develop sigue en c89b1b9. Codex recomienda esperar el resultado de T1 antes de ampliar T2.2, conservando la revisión por incrementos. Esta recomendación no inventa aprobación del equipo ni cierra/bloquea técnicamente FRONT-01. No se hace push.
