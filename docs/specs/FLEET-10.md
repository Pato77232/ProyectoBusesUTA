# FLEET-10: Consultar el inventario de buses de una cooperativa

- **ID local:** FLEET-10; no existe una spec previa con este ID en la base `origin/develop` local `5ff50d9` (4 de noviembre de 2026).
- **Ticket externo:** no aplica antes de decidir el gestor tras la primera revisión.
- **Módulo:** `fleet` y su pantalla de inventario en `frontend`.
- **Responsable:** Edwin (tarea intercambiada por confirmación del solicitante el 4 de noviembre de 2026).
- **Revisor propuesto / confirmado:** David, según revisión habitual de Fleet; aceptación pendiente.
- **Estado:** En desarrollo; el solicitante autorizó inventario administrativo, pantalla y ficha con fotos en el chat del 4 de noviembre de 2026. Revisión humana de código pendiente.
- **Prioridad y dependencias:** la base `origin/develop` local `5ff50d9` contiene el backend de registro, lectura de asientos y clasificación ACCESSIBLE. La pantalla requiere comprobar la integración del login y cliente HTTP vigentes. No se actualizó la referencia desde GitHub por fallo de red.
- **Rama / PR / base comprobada:** `feature/FLEET-10-listado-detalle-buses`, checkout separado creado desde `origin/develop` local `5ff50d9`; no se pudo consultar GitHub directamente para actualizar la referencia remota.
- **Autorización de alcance:** el solicitante confirmó el inventario administrativo de buses el 4 de noviembre de 2026 y delegó la decisión sobre las fotos. Se adopta lectura privada de fotos con autenticación y aislamiento por cooperativa.

## 1. Objetivo

Permitir que `COOPERATIVE_ADMIN` consulte los buses de su cooperativa y abra una ficha de un bus propio. Hoy existen consultas internas de Fleet (`busQueries.findByCooperativeId` y `findById`), pero no endpoints HTTP de consulta ni una pantalla de inventario.

## 2. Reglas de negocio involucradas

- **RN-01:** validar el rol en backend en cada endpoint.
- **RN-02:** filtrar siempre por `cooperative_id` de la identidad autenticada; no aceptar una cooperativa seleccionada por URL o cuerpo.
- **RN-10/11/12:** presentar el bus y su configuración existente sin alterar datos ni convertir la lectura en edición.

## 3. Alcance

**Incluye (propuesta):**

- `GET /api/v1/buses` para listar el inventario de la cooperativa autenticada.
- `GET /api/v1/buses/:busId` para consultar una ficha del bus de esa misma cooperativa.
- Una pantalla autenticada de inventario, estados de carga/vacío/error y navegación a la ficha.
- Ficha de solo lectura con datos de identificación y configuración que Fleet ya expone a sus consultas internas, sujeto a minimizar campos sensibles.
- Enlace desde la navegación autenticada correspondiente, si ya existe en la base actual.

**No incluye:**

- Consulta pública por clientes o relación con viajes publicados.
- Crear, editar, desactivar o eliminar buses.
- Cambiar grupos, plantillas o inventario de asientos.
- Venta de espacios accesibles (spec separada de Reservas pendiente de contrato).
- Exponer VIN u otros identificadores internos en una pantalla pública.

## 4. Flujo principal

1. El administrador con sesión vigente abre su inventario.
2. La pantalla solicita `GET /api/v1/buses`; el backend deriva el tenant de la identidad y devuelve sus buses.
3. Al elegir un bus, la pantalla solicita `GET /api/v1/buses/:busId`.
4. El backend devuelve solo la ficha autorizada; un bus ajeno o inexistente responde como no encontrado, sin revelar otro tenant.

## 5. Datos

**Lista:** `id`, `unitNumber`, `plate`, `busGroupId`, `busGroupName`, `capacity`, `photoCount`.

**Ficha:** `id`, `plate`, `vin`, `unitNumber`, `bodyworkBrand`, `color`, `busGroup` (`id`, `name`), `seatLayout` (snapshot/version), `capacity`, `seats` (`seatId`, `layoutSeatKey`, `label`, `deck`, `row`, `column`, `category`, `offered`) y `photos` (`id`, `contentType`, `size`, `order`). Todos los datos son de lectura y corresponden al tenant autenticado.

Los bytes de cada foto se obtienen por una ruta privada que valida sesión, rol, tenant, bus y foto; respuesta `Cache-Control: no-store`, nunca una ruta de disco o URL pública. Se conserva el tipo MIME validado al registrar. No incluir `storage_key` en DTOs.

Sin migraciones previstas. No devolver `cooperativeId` innecesariamente. La lista se ordena por `unitNumber` y no pagina, como el listado actual de buses por cooperativa.

## 6. Endpoints

| Método | Ruta                                   | Roles               | Respuestas propuestas                                                     |
| ------ | -------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| GET    | `/api/v1/buses`                        | `COOPERATIVE_ADMIN` | 200 `{ buses }`, 401 sesión requerida, 403 rol no permitido               |
| GET    | `/api/v1/buses/:busId`                 | `COOPERATIVE_ADMIN` | 200 `{ bus }`, 401, 403, 404 bus no visible                               |
| GET    | `/api/v1/buses/:busId/photos/:photoId` | `COOPERATIVE_ADMIN` | 200 bytes privados con MIME almacenado, 401, 403, 404 bus/foto no visible |

La implementación debe reutilizar la sesión actual, sin CSRF para GET, y no incluir `cooperativeId` en filtros controlados por el navegador.

## 7. Criterios de aceptación

- [ ] Dado un administrador con buses, cuando consulta la lista, entonces ve únicamente los buses de su cooperativa.
- [ ] Dado un administrador, cuando consulta un bus propio, entonces recibe la ficha con campos acordados.
- [ ] Dado un bus de otra cooperativa o inexistente, cuando consulta su ficha, entonces recibe la misma respuesta 404.
- [ ] Dado un usuario sin sesión o con otro rol, cuando consulta cualquiera de las rutas, entonces no obtiene datos de Fleet.
- [ ] Dado un administrador cuya cooperativa no tiene buses, cuando abre el inventario, entonces ve un estado vacío con una acción de continuación coherente.
- [ ] Dado un fallo de red/servidor, cuando la pantalla no carga datos, entonces informa el error y permite reintentar sin presentar datos ficticios.
- [ ] La lista y ficha se pueden recorrer con teclado, muestran foco y se adaptan a 360 px y a ampliación del 200 % según `docs/calidad.md`.

## 8. Casos borde y errores

- Identificador de bus malformado: definir si se valida como 400 o se trata igual que 404; recomendación: 404 para no filtrar existencia.
- Doble envío de lectura: no crea operaciones ni duplica datos.
- Sesión vencida durante la consulta: seguir el comportamiento común del cliente y enlazar al login según contrato existente.
- Ausencia o fallo de fotos: no fallar la carga de los datos básicos; el tratamiento depende de decidir la ruta de lectura de fotos.

## 9. Pruebas esperadas

- Unitarias: filtros, DTO minimizado, errores y datos de la pantalla.
- Integración PostgreSQL: sesión/rol reales, aislamiento entre dos cooperativas, lista vacía, detalle propio y ocultamiento de bus ajeno/inexistente.
- Frontend: carga, vacío, error/reintento, detalle, navegación, sesión expirada, teclado y viewport 360/1280.
- Sin alterar pruebas anteriores para obtener aprobación.

## 10. Preguntas abiertas

1. Revisar los DTOs y la lectura de bytes privados con el revisor humano; no exponer VIN en rutas públicas.
2. Confirmar el punto de entrada en la navegación autenticada durante la integración visual. No incluir acciones de escritura.
3. Confirmar revisor humano; David es el revisor propuesto por responsabilidad habitual de Fleet, sin aceptación registrada.

## 11. Defecto inducido

No aplica. No introducir defectos sin autorización específica conforme a `docs/errores-inducidos.md`.

## 12. Diseño SOLID y usabilidad

El controlador traduce HTTP; el caso de uso valida identidad/entrada y llama un puerto; PostgreSQL implementa las lecturas; la API pública de Fleet expone solo la interfaz necesaria. La pantalla reutiliza el cliente HTTP y estilos comunes. No crear un modelo duplicado ni abstraer almacenamiento de fotos sin necesidad probada.

Escenario: administrador consulta inventario, distingue carga/vacío/error y abre detalle; foco visible, textos en español, sin depender solo del color, reflujo a 360 px y lectura a 200 %.

## 13. Plan y evidencias

1. Contrato de inventario administrativo y lectura privada de fotos definidos en esta spec.
2. Implementados los endpoints de listado, detalle y lectura de foto, con aislamiento por cooperativa.
3. Implementados la pantalla de inventario y el detalle, con accesibilidad de teclado y diseño adaptable.
4. Pruebas dirigidas backend: 11/11 unitarias aprobadas; pruebas de controlador frontend aprobadas.
5. Frontend completo: 325/325 pruebas, lint y smoke de navegador con API simulada aprobados; escenarios de teclado, escritorio 1280 px y móvil 360 px. Evidencia visual en `docs/evidence/FLEET-10/`.
6. Lint de archivos backend modificados aprobado. `npm run lint` global y la suite backend completa siguen bloqueados por defectos/dependencias preexistentes en esta base: duplicación de `payments` en `server.js`, pruebas HTTP con `EACCES` y módulos `busboy`/`nodemailer` ausentes. La ejecución global reportó 1894/1908 pruebas aprobadas; no atribuir esos fallos a esta tarea sin reproducirlos en base corregida.
7. No fue posible ejecutar integración PostgreSQL: Docker Desktop no tiene daemon disponible. El smoke de navegador usa API simulada; falta verificación de extremo a extremo contra servidor y PostgreSQL reales.
8. Formato de los archivos tocados debe verificarse tras el último ajuste. Revisión humana y PR pendientes.

## 14. Revisión y cierre

Contrato autorizado por el solicitante. Implementación local lista para revisión, con las limitaciones de validación descritas en §13. Revisión humana y PR pendientes. No se hizo commit ni publicación.
