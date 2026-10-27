# Equipo, tareas pequeñas y acuerdos

## Referencia de responsabilidades

Origen: propuesta `Division.md` aportada por el solicitante, fuera del repositorio, incorporada aquí en forma de referencia mantenible por INFRA-04. La migración está autorizada por el solicitante; las personas afectadas deben confirmar las nuevas asignaciones y revisiones. No hay aprobaciones colectivas implícitas.

| Integrante | Coordinación de referencia | Revisor habitual propuesto | Evidencia de gestión |
|---|---|---|---|
| Pablo | Infraestructura, autenticación y cooperativas | Shirley | Integraciones, versiones y preparación de entrega |
| Edwin | Flota | David | Inventario de elementos de configuración |
| David | Frecuencias, hojas de ruta y viajes | Leslie | Trazabilidad entre reglas, specs y cambios |
| Leslie | Reservas | Edwin | Pruebas de aceptación y registro de defectos |
| Shirley | Pagos y boletos | Pablo | Auditorías y reportes de entrega |

Cada autor incorpora las pantallas de sus funcionalidades y sus pruebas. Pablo prepara la base compartida del frontend. Si se redistribuye una tarea, registrar responsable, revisor y aceptación de los afectados; coordinar un módulo no obliga a implementar todas sus tareas.

La propuesta original plantea un comité con Pablo y Shirley y Edwin como suplente. Su constitución y quién aprueba cada cambio siguen pendientes de confirmación humana; no usar esta propuesta como evidencia de aprobación. Nadie aprueba su propio PR. Una revisión de IA no reemplaza al revisor humano.

## Cómo dividir trabajo

- Conservar los módulos de architecture.md y separar funcionalidades: por ejemplo, registrar bus, consultar buses y definir plantilla de asientos.
- Una tarea produce un comportamiento pequeño verificable, con reglas, entradas/salidas, pruebas y criterio de terminado. Un endpoint puede requerir varios pasos de implementación sin convertirse en un módulo completo.
- Una pantalla puede ser otra tarea cuando su contrato backend está definido. Evitar repartir solo por capas sin un responsable del resultado completo.
- Antes de asignar, revisar dependencias, dificultad, disponibilidad y archivos compartidos. Evitar ediciones simultáneas de app.js, server.js, plantilla de specs o registro de estado sin coordinación.
- Los candidatos de [estado-proyecto.md](estado-proyecto.md) no autorizan implementación. Elegir uno, acordar alcance, crear su spec con ID libre y confirmar responsable/revisor. Crear la rama solo cuando se empieza.

## Cómo alcanzar un acuerdo

1. **Delimitar:** Codex explica la pregunta en lenguaje sencillo, la regla/spec afectada, quién necesita la respuesta y qué trabajo depende de ella.
2. **Comparar:** presentar alternativas pertinentes, sus efectos en datos/API/pantallas/pruebas y una recomendación razonada. Si ya hay una decisión aprobada, citarla en vez de reabrirla.
3. **Consultar:** preparar un mensaje que el responsable comparte con las personas afectadas. Codex no contacta a otros ni toma el silencio como aceptación.
4. **Decidir:** las personas acuerdan una opción o dejan pendiente el desacuerdo. Consultar a los responsables de ambos módulos para contratos compartidos; los cambios de alcance o RN requieren la decisión humana prevista por el equipo.
5. **Registrar:** usar la plantilla inferior en la spec pertinente y enlazarla desde las otras specs afectadas. Si cambia una RN, actualizar business-rules.md tras su aprobación; si es una decisión arquitectónica duradera, crear un ADR.
6. **Continuar:** implementar solo cuando el acuerdo necesario exista. Mientras tanto, avanzar en trabajo independiente autorizado, sin asumir formatos, precios, porcentajes o permisos pendientes.

No pedir un acuerdo colectivo por nombres internos o detalles reversibles que el responsable puede decidir dentro de la spec. Antes de volver a pedir aprobación, comprobar la autorización ya existente y su alcance.

### Registro de decisión compartida

```markdown
### Decisión: <pregunta concreta>
- Estado: Propuesta | Pendiente | Acordada | Reemplazada
- Fecha y participantes consultados:
- Reglas, specs y contratos afectados:
- Opciones y recomendación:
- Respuesta humana y evidencia de confirmación:
- Decisión y justificación:
- Responsable de aplicarla y revisor:
- Criterios de aceptación/pruebas que cambian:
- Trabajo dependiente e independiente:
- Decisión anterior que reemplaza, si aplica:
```

Ejemplo de consulta, sin decisión tomada: «Leslie y Shirley, necesitamos acordar cuándo comienza el plazo configurable RN-50 y qué sucede si el comprobante llega al vencer. Propongo revisar un ejemplo con horas concretas y definir el resultado esperado para ambos lados. ¿Qué opción confirmamos y qué pruebas debemos compartir?». No elegir una duración ni resolver una regla por este ejemplo.
