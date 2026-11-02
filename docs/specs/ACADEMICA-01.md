# ACADEMICA-01: Propuestas de defectos visuales de bajo impacto

- **Estado:** Borrador; candidatos propuestos, no autorizados individualmente ni introducidos.
- **Fuente:** solicitud humana del 1 de noviembre de 2026 de proponer defectos superficiales para primera entrega.
- **Responsable de introducción y revisor:** pendientes de asignar/aceptar.
- **Dependencias:** [errores-inducidos.md](../errores-inducidos.md), pantalla objetivo implementada, spec visual propia y frontend/DESIGN.md.
- **Versión objetivo:** entrega del 4 de noviembre; número MAJOR.MINOR.PATCH pendiente. No asignar tag ni afirmar presencia en main.

La autorización general para proponer defectos no confirma un defecto concreto. Esta PR solo documenta candidatos; una implementación posterior exige elegirlos expresamente, completar responsables/versión y aprobar su spec. No introducir errores de dinero, identidad, asientos, horarios, permisos, vencimientos, validación, correo ni QR.

| ID local | Comportamiento correcto | Desviación propuesta | Reproducción y prueba que evidencia el defecto | Impacto y límite |
|---|---|---|---|---|
| DI-VIS-01 | Portada usa la identidad transViaje blanco/negro/violeta | Un separador decorativo de portada aparece gris en lugar de violeta | En pantalla de 1280×800 abrir portada; comparar separador con token aprobado. Comprobación de estilo/color debe fallar por valor incorrecto; conservar captura y resultado real | Solo adorno. No modificar botones, foco, texto, contrastes informativos ni estados de compra |
| DI-VIS-02 | Tarjetas informativas estáticas de portada mantienen separación vertical uniforme | Una tarjeta informativa tiene 8 px extra de margen inferior | Misma pantalla/zoom 100 %; medir márgenes contra el valor aprobado y comparar captura. Prueba de uniformidad debe fallar | Solo espacio decorativo. No ocultar contenido, desplazar controles fuera de pantalla ni causar desbordamiento móvil |

Los selectores concretos y el token correcto se identificarán en la spec aprobada de introducción; no se inventa evidencia de una pantalla ni prueba ya existente. Los 8 px son la desviación propuesta, no un cambio realizado.

## Aceptación y evidencias antes de introducir

- Confirmar cada candidato elegido, responsable, revisor humano, spec de pantalla y versión exacta.
- Documentar regla de identidad/usabilidad afectada, selector, referencia correcta, datos y pasos reproducibles; el recorrido compra/venta debe seguir funcionando.
- Añadir/verificar prueba del comportamiento correcto sin debilitarla. Reportar el fallo deliberado y su excepción humana de aceptación; pruebas con fallos siguen fallidas.
- Verificar accesibilidad, móvil y ausencia de impacto en controles/operación; si no se conserva el límite, descartar el candidato.
- Registrar commit de introducción, versión entregada, captura, resultado, revisión y estado. La integración en main corresponde al flujo humano.
- Preparar tarea separada de corrección con commit/versión y prueba que pasa tras corregir.

## Auditoría y gestión

El comité rotativo se decidirá después de la primera entrega; esto no elimina aprobación humana previa del defecto ni revisión por otra persona ahora. Registro por spec/PR hasta elegir gestor. No simular cifras de cambios, aprobaciones ni reportes de auditoría. La entrega funcional pendiente no se clasifica como defecto inducido.
