# Errores inducidos: registro histórico y protocolo para actividades futuras

## Candidatos documentados el 1 de noviembre

[ACADEMICA-01](specs/ACADEMICA-01.md) propone DI-VIS-01 (color de separador decorativo) y DI-VIS-02 (espaciado de tarjeta informativa). Estado **propuesto**, sin introducción, selección/autor/revisor ni versión confirmados. La petición de ayuda con defectos superficiales no sustituye la autorización específica de cada candidato. No se modifica producto en ACUERDOS-01. Se mantienen todos los requisitos del protocolo siguiente y las pruebas del comportamiento correcto.

## Decisión para la primera entrega
Edwin indicó el 4 de noviembre de 2026 que la versión **v0.1.0 no requiere errores inducidos**, según [las notas de la versión](releases/v0.1.0.md#3-errores-académicos). Los candidatos DI-VIS-01 y DI-VIS-02 permanecen propuestos y no introducidos; su existencia documental no autoriza implementarlos. Esta decisión sustituye la obligación anterior de poner defectos en `main` para esa entrega. No se atribuye aceptación individual a otros integrantes.

Un fallo de integración imprevisto, como el bloque duplicado de `server.js` observado en v0.1.0, es un defecto normal que debe corregirse y probarse; no es un error académico inducido. Si el docente pide una actividad posterior con defectos deliberados, primero deben definirse y autorizarse concretamente en una spec y versión objetivo. Las personas realizan la integración mediante el flujo de revisión; los agentes mantienen la prohibición de ejecutar merge, push o tags.

Se usa SemVer `MAJOR.MINOR.PATCH` (tag `vMAJOR.MINOR.PATCH`), sin sufijos ni cuarto componente. Los defectos conocidos se identifican en la documentación de la versión, no en su número.

## Identificación y autorización
No hay defectos inducidos autorizados para v0.1.0. Antes de introducir uno en una actividad futura, documentar en una spec aprobada:
- ID único del defecto y referencia a la spec.
- Propósito académico, responsable y aprobación humana.
- Regla o criterio afectado: comportamiento correcto y desviación deliberada.
- Alcance, impacto y recorrido funcional que debe seguir funcionando.
- Pasos, datos de prueba y resultado que permiten reproducirlo.
- Prueba que evidencia el defecto y resultado esperado de esa ejecución.
- Versión objetivo; posteriormente, commit de introducción, evidencia y versión entregada.
- Estado: propuesto, autorizado, introducido, verificado o corregido; cuando se corrija, referencia a la tarea, commit y versión de corrección.

No inventar defectos a partir de estos candidatos históricos. Si falta una definición o autorización, preguntar antes de implementar. Jira o GitHub Issues se decidirá después del 4 de noviembre por petición del docente; hasta entonces la trazabilidad se mantiene mediante IDs de specs, commits y revisiones, sin exigir tickets externos.

## Instrucciones para todos los agentes
- Leer este protocolo y la spec antes de planificar, implementar, revisar o probar un cambio.
- Solo tratar un fallo como inducido si coincide con un defecto autorizado para la versión y el alcance indicados. El resto son defectos normales.
- No corregir incidentalmente un defecto inducido autorizado. Su corrección necesita una tarea explícita; si impide otra tarea, reportar el conflicto.
- Mantener la regla funcional correcta y las pruebas que la verifican. No borrar, saltar, debilitar pruebas ni cambiar expectativas para que el fallo parezca correcto.
- Ejecutar lint y pruebas y reportar resultados reales: aprobadas, fallos inducidos identificados y fallos inesperados. Una ejecución con fallos sigue siendo una ejecución fallida.
- Los fallos inducidos de una actividad futura no autorizan a ignorar cualquier fallo ni a desactivar controles globalmente. Antes de integrar, las personas deben definir y registrar la excepción de aceptación concreta. Un fallo inesperado continúa bloqueando la aceptación.
- Auditar que el recorrido funcional acordado sigue operativo y que cada defecto de la entrega puede reproducirse. Conservar evidencia de la versión defectuosa y de su corrección posterior.

## Responsabilidad por rol
- **architect:** incluir el defecto autorizado, su impacto, reproducción y verificación en el plan; preguntar por definiciones pendientes.
- **implementer:** introducir o corregir únicamente el defecto indicado en la tarea aprobada, con un cambio atómico y trazable.
- **reviewer:** separar defectos académicos autorizados de fallos inesperados; no exigir corregir los primeros como condición rutinaria ni ocultarlos en el veredicto.
- **tester:** comprobar el comportamiento correcto y mostrar qué prueba falla por cada defecto autorizado; conservar la evidencia sin modificar código de producción.
