# FEAT-EJEMPLO: Crear frecuencia

> Ejemplo de spec bien escrita. Sirve de modelo; se reemplaza por la spec real del módulo.

- **Issue:** #00
- **Módulo:** `frequencies`
- **Responsable:** David
- **Estado:** Borrador

## 1. Objetivo
Permitir al Usuario de Cooperativa registrar una frecuencia habilitada legalmente para su cooperativa.

## 2. Reglas de negocio involucradas
- RN-02: la frecuencia pertenece a la cooperativa del usuario autenticado.
- RN-20: origen, destino y hora de salida definen la frecuencia y no se modifican después.
- RN-21: el número de resolución ANT es obligatorio.
- RN-22: puede tener paradas intermedias autorizadas.
- RN-23: se crea con estado *Activa* o *Inactiva*.

## 3. Alcance
**Incluye:** crear y consultar una frecuencia, con o sin paradas.
**No incluye:** editar origen, destino u hora (prohibido por RN-20), hojas de ruta, venta de pasajes.

## 4. Flujo principal
1. El usuario envía origen, destino, hora de salida, resolución ANT, estado y paradas opcionales.
2. El sistema valida los datos y verifica que no exista una frecuencia idéntica en la cooperativa.
3. Se guarda la frecuencia con el `cooperative_id` del usuario autenticado.
4. Se devuelve la frecuencia creada.

## 5. Datos
| Campo | Tipo | Validación |
|---|---|---|
| origin | texto | obligatorio, distinto de destination |
| destination | texto | obligatorio |
| departure_time | hora `HH:mm` | obligatorio |
| ant_resolution_number | texto | obligatorio, no vacío |
| status | `ACTIVE` \| `INACTIVE` | opcional, por defecto `ACTIVE` |
| stops | lista ordenada de lugares | opcional; no repite origen ni destino |

Migración nueva: tablas `frequencies` y `frequency_stops` con `cooperative_id`, restricción única (`cooperative_id`, `origin`, `destination`, `departure_time`).

## 6. Endpoints
| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| POST | /api/v1/frequencies | Usuario de Cooperativa | 201, 400, 401, 403, 409 |
| GET | /api/v1/frequencies/:id | Usuario de Cooperativa | 200, 404 |

## 7. Criterios de aceptación
- [ ] Dado un usuario de cooperativa, cuando crea una frecuencia válida, entonces recibe 201 y la frecuencia queda ligada a su cooperativa.
- [ ] Dado un cuerpo sin resolución ANT, cuando crea la frecuencia, entonces recibe 400 con el código `FREQUENCY_REQUIRES_ANT_RESOLUTION`.
- [ ] Dada una frecuencia existente, cuando intenta crear otra con el mismo origen, destino y hora, entonces recibe 409.
- [ ] Dada una frecuencia de otra cooperativa, cuando se consulta por id, entonces recibe 404.
- [ ] No existe ningún endpoint para modificar origen, destino u hora.

## 8. Casos borde y errores
- Origen igual a destino.
- Parada repetida o igual al origen o destino.
- Hora con formato inválido.
- Usuario con rol distinto a Usuario de Cooperativa.

## 9. Pruebas esperadas
- Unitarias: entidad `Frequency` (inmutabilidad, resolución obligatoria), caso de uso `CreateFrequency` con repositorio simulado.
- Integración: repositorio PostgreSQL, endpoint POST y aislamiento entre cooperativas.

## 10. Preguntas abiertas
- ¿Hay un formato específico para el número de resolución ANT?
