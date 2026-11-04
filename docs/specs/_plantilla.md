# FEAT-XX: Título de la funcionalidad

- **ID local:** ID de esta spec
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** nombre
- **Responsable:** nombre
- **Revisor propuesto / confirmado:** nombre y confirmación
- **Estado:** Borrador | Aprobada | En desarrollo | En revisión | Integrada | Cerrada
- **Prioridad y dependencias:** tareas, contratos y decisiones necesarias
- **Rama / PR / base comprobada:** referencias y fecha de comprobación
- **Autorización de alcance:** persona, fecha y decisión; no confundir con revisión técnica

## 1. Objetivo
Qué problema resuelve y para quién (rol).

## 2. Reglas de negocio involucradas
RN-xx: breve descripción de cómo aplica.

## 3. Alcance
**Incluye:** ...
**No incluye:** ...

## 4. Flujo principal
1. ...
2. ...

## 5. Datos
Campos de entrada y salida, con tipos y validaciones. Tablas o migraciones nuevas.

## 6. Endpoints
| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| POST | /api/v1/... | ... | 201, 400, 403, 409 |

## 7. Criterios de aceptación
- [ ] Dado..., cuando..., entonces...
- [ ] ...

## 8. Casos borde y errores
- ...

## 9. Pruebas esperadas
- Unitarias: ...
- Integración: ...

## 10. Preguntas abiertas
- ...
- Para decisiones compartidas: participantes, opciones, recomendación y registro de la respuesta humana. Seguir el protocolo de coordinación de `docs/equipo-y-acuerdos.md`.

## 11. Defecto inducido (solo si aplica)
Completar los campos de `docs/errores-inducidos.md` y obtener aprobación humana antes de introducirlo. Indicar comportamiento correcto, desviación autorizada, reproducción, prueba que falla, impacto, versión objetivo y evidencia. Si no aplica, indicarlo expresamente.

## 12. Diseño SOLID y usabilidad

- Responsabilidades, puertos y contratos afectados; principios relevantes según `docs/calidad.md` y justificación de los que no aplican.
- Escenario del usuario, criterios Dado/Cuando/Entonces y forma de comprobarlos. Si no hay interfaz en este alcance, indicarlo sin marcar la usabilidad como verificada.
- Contratos entre backend/frontend, estados de carga/vacío/error/éxito, teclado y tamaños de pantalla que correspondan.

## 13. Plan y evidencias

- Pasos pequeños, resultado comprobable de cada uno y archivos compartidos que requieren coordinación.
- Comandos ejecutados, entorno, fecha y resultados reales de lint, formato, pruebas y arranque. Separar errores inesperados, fallos inducidos autorizados y limitaciones del entorno.
- Evidencia de revisión SOLID y de los escenarios de usabilidad aplicables.
- Actualización de la fila propia en `docs/estado-proyecto.md`.

## 14. Revisión y cierre

- Revisor humano, decisión y fecha; commit/PR de integración y verificación en develop.
- Próxima acción o motivo de bloqueo. No marcar Cerrada solo porque terminó la implementación.
