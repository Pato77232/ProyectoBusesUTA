# FLEET-02: Registrar un bus

- **ID local:** FLEET-02 (nuevo identificador local, no ticket externo).
- **Responsable:** Edwin, responsable de Fleet.
- **Revisor propuesto:** David; aceptación pendiente.
- **Estado:** En revisión. T1/T2 publicados en PR #27; T3 en 36b9255 y T4 preparados para actualizar esa PR por petición de Edwin el 31 de octubre. Implementación backend verificada con 985 pruebas; revisión humana e integración pendientes. FLEET-03/PR #26 ya integrada en develop 4937892 al comprobarla.
- **Fecha:** 29 de octubre de 2026, America/Guayaquil.
- **Base de implementación:** `d1d3542`, rama `feature/FLEET-02-contrato-alta`, que conserva la dependencia FLEET-03. Origin/develop comprobado en `56dc55a` el 31 de octubre, sin incorporarlo mediante merge/rebase.
- **Autorización:** aprobación explícita de Edwin el 31 de octubre de 2026 para comenzar FLEET-02; se entrega T1 primero conforme al plan de incrementos pequeños. No supone aprobación de Leslie/David ni revisión humana de código.
- **Dependencias:** FLEET-01, auth, cooperativas y [FLEET-03: catálogo de plantillas](FLEET-03.md), implementada en d1d3542 y PR #26 lista para revisión al comprobarla. Contrato de consulta de inventario por viaje con Leslie/David fuera de esta tarea.

## 1. Objetivo

Permitir al administrador operativo registrar un bus real de su cooperativa. Es el primer incremento para que hojas de ruta pueda consultar buses y reservas pueda obtener posteriormente su inventario de asientos. Crear un bus no acredita por sí solo disponibilidad por viaje.

## 2. Reglas de negocio

- RN-01: permisos comprobados en backend.
- RN-02: cooperativa obtenida de la identidad autenticada y verificada; no del cuerpo.
- RN-10: chasis, marca de carrocería, color y fotografías obligatorios.
- RN-11: los buses se organizan mediante grupos existentes de su cooperativa.
- RN-12: cada bus tiene una plantilla visual de asientos. Edwin confirmó elegirla al registrar el bus y exigirla antes de habilitarlo para viajes.

## 3. Alcance propuesto

**Incluye:** un caso de uso de registro y un endpoint; datos del bus, selección de una base/version y posiciones no ofrecidas al alta, creación de identidades estables de sus asientos, fotografías locales persistentes y sus referencias, migraciones nuevas, permisos, CSRF y pruebas. Contrato técnico de secciones 5 y 6 aprobado por Edwin el 31 de octubre; implementar por pasos de sección 10, sin mezclar todos los incrementos en una sesión.

**Fuera de este incremento:** listar/consultar buses por HTTP o API pública, edición y eliminación, frontend, definir/consultar plantillas, viajes, disponibilidad, reservas y cambios en módulos ajenos. Estos resultados necesitan tareas separadas; no se implementa Fleet completo en una sola sesión.

## 4. Flujo propuesto

1. Autenticar y autorizar al administrador operativo; verificar CSRF.
2. Leer multipart con límites, validar metadatos/archivos y rechazar campos extra, duplicados o identidad de cooperativa aportada por el cliente.
3. Verificar grupo de la cooperativa autenticada, base/version real y posiciones deshabilitadas; derivar asientos/capacidad desde el catálogo, nunca del cliente.
4. Preparar archivos con claves generadas por servidor en directorio temporal propio de esta operación, dentro del volumen de Fleet.
5. Insertar bus, configuración de asientos y referencias de fotos en una transacción; publicar el directorio final de fotos antes de confirmar la transacción.
6. Si confirma, responder 201; si falla, revertir/compensar conforme a sección 6. No prometer atomicidad conjunta de PostgreSQL y el sistema de archivos.

## 5. Datos y contratos pendientes

| Dato | Fuente o propuesta | Decisión pendiente |
|---|---|---|
| Chasis | VIN obligatorio y único globalmente; Edwin confirmó conversión a mayúsculas y recorte de espacios exteriores | No se acordaron longitud, patrón ni verificación externa adicionales; no incorporarlos como requisitos implícitos |
| Marca de carrocería | Texto libre obligatorio, confirmado por Edwin conforme a RN-10 | Sin catálogo adicional; recortar espacios exteriores y rechazar texto vacío |
| Color | Texto libre obligatorio, confirmado por Edwin conforme a RN-10 | Sin catálogo adicional; recortar espacios exteriores y rechazar texto vacío |
| Fotografías | RN-10; Edwin confirmó de 1 a 10 por bus, JPEG o PNG, hasta 5 MB por archivo y almacenamiento local persistente | Contrato técnico propuesto en sección 6 |
| Cooperativa | Edwin confirma que cada bus solo puede estar registrado en una cooperativa; identidad obtenida del servidor. Placa y VIN únicos globalmente impiden repetir esos identificadores en otra cooperativa | Sin decisión pendiente sobre pertenencia o ámbito de unicidad |
| Grupo | Edwin confirmó un único grupo operativo existente de su misma cooperativa; se conservan las categorías RN-11/FLEET-01 LONG_ROUTE, CANTONAL y URBAN_RURAL | Sin decisión pendiente de cardinalidad o clasificación; no confundir grupo con pisos ni paradas |
| Placa | Obligatoria y única globalmente; Edwin confirmó tres letras y cuatro dígitos, guardada/comparada sin guion y mostrada con guion, por ejemplo TBM-2213 | Contrato de normalización descrito en sección 8; no se verifica registro ante la ANT |
| Número de unidad | Entero positivo obligatorio y único por cooperativa; Edwin confirmó que 01 y 1 representan la misma unidad | Identidad canónica numérica; no se conservan ceros iniciales como identidad diferente |
| Identidad del bus | UUID generado por servidor, conforme al modelo conceptual aceptado por Edwin | Su consulta por otros módulos se acuerda por separado; no crear tablas de viajes/reservas |
| Plantilla | Base y versión de FLEET-03 elegidas al alta; se guarda una copia de sus posiciones y configuración del bus, con trazabilidad a la base | Contrato técnico de este registro en sección 5.1; consultas por viaje pendientes de Leslie/David |

Las secciones siguientes concretan la propuesta técnica sin cambiar las decisiones funcionales confirmadas. Usar una migración nueva posterior a todas las existentes en la base elegida; no renombrar ni editar migraciones de pagos ni desactivar el control de orden.

### 5.1. Metadatos del alta

Un único campo de texto multipart `data`, que contiene un objeto JSON con estos campos, sin propiedades adicionales:

| Campo | Contrato técnico |
|---|---|
| plate | Texto obligatorio, normalización y presentación confirmadas en sección 8 |
| vin | Texto obligatorio no vacío después de trim; mayúsculas, sin agregar longitud/patrón o verificación ANT no acordados |
| unitNumber | Entero seguro positivo o texto decimal de dígitos con trim; normalizar 01 a 1, rechazar fracción, signo, exponente o conversión parcial en la variante textual. No aceptar coerciones boolean/null. El límite técnico es Number.MAX_SAFE_INTEGER, no una capacidad operativa de flota |
| bodyworkBrand / color | Textos obligatorios no vacíos después de trim; sin catálogos ni cambios internos de texto |
| busGroupId | UUID de un grupo existente de la cooperativa autenticada |
| seatLayoutId / seatLayoutVersion | Código de base de FLEET-03 y versión entera positiva que exista en el catálogo real |
| disabledSeatKeys | Arreglo opcional, por defecto vacío, de claves de posiciones SEAT de esa base/version. Rechazar valores repetidos, desconocidos o claves de servicios. No aceptar etiquetas visibles como sustitución de claves |

No recibir id del bus/asiento/foto, cooperativa, capacidad, número de pisos, geometría, tipo de asiento, rutas de archivo ni URLs de fotos desde el cliente. UUID del bus, de cada asiento y de cada foto generados por el servidor.

Se copia el snapshot de posiciones y versión al alta; cada asiento físico de esa copia tiene UUID propio, clave de posición de origen, etiqueta, piso, coordenadas, categoría NORMAL y `offered` derivado de disabledSeatKeys. No se renumera. No ofrecido no significa reservado/vendido. La capacidad ofrecida se calcula desde la copia, no desde un número enviado por el navegador.

Regla confirmada por Edwin el 30 de octubre: dejar al menos un asiento ofrecido para dar de alta el bus. Rechazar todas las posiciones deshabilitadas con 400 VALIDATION_ERROR antes de preparar archivos o persistir datos. El mínimo se comprueba contra la base/version seleccionada y las posiciones efectivamente ofrecidas, no contra una cantidad enviada por el cliente.

La configuración y sus identidades quedan inmutables en este incremento: no hay endpoint de edición. Persistir un bus con plantilla no crea viajes ni acredita su comercialización; esa habilitación pertenece al contrato de viajes y sus validaciones. No inventar una tabla de viajes ni un estado público de operación en Fleet.

### 5.2. Persistencia prevista

Una migración nueva de Fleet, sin tocar migraciones anteriores:
- `buses`: UUID, cooperative_id, bus_group_id, placa canónica, VIN normalizado, unidad, marca de carrocería, color, base/version, snapshot de distribución y fechas. Unicidad global de placa y VIN y compuesta de cooperativa/unidad.
- `bus_seats`: UUID propio, bus_id, cooperative_id, clave de origen, etiqueta/piso/coordenadas, NORMAL y offered. Unicidad de clave de origen y etiqueta por bus. Las relaciones de bus/cooperativa se conservan con FK compuesta.
- `bus_photos`: UUID, bus_id, cooperative_id, clave interna de almacenamiento, MIME validado, tamaño y orden de carga. Unicidad de orden por bus y claves de almacenamiento. Sin guardar el contenido binario ni nombres/rutas elegidos por el usuario.
- Pertenencia del grupo: consulta filtrada por cooperative_id y FK compuesta a bus_groups. Si es necesaria una restricción única auxiliar `(id, cooperative_id)` en bus_groups, añadirla mediante esta migración nueva de Fleet y revertirla al final de su down, sin modificar la migración original.

Todos los datos del alta se insertan en la misma transacción. Los índices/restricciones son la autoridad ante concurrencia; una consulta previa no basta para garantizar duplicados. Down respeta dependencias (fotos/asientos antes de buses) y no borra tablas de otros módulos. Las pruebas revierten por nombre objetivo sin asumir que esta es la última migración.

## 6. Endpoint y fotografías: contrato técnico consolidado

`POST /api/v1/buses`, exclusivamente COOPERATIVE_ADMIN con sesión vigente, contexto de cooperativa verificado y cabecera X-CSRF-Token válida. Mantener orden autenticar → autorizar → CSRF → parser multipart → caso de uso. No leer ni escribir archivos de un operador no autorizado.

### 6.1. Solicitud y límites

- Content-Type multipart/form-data con boundary. Un campo `data` JSON de sección 5.1 y de 1 a 10 partes de archivo con el mismo nombre `photos`, en el orden elegido. Rechazar segundo `data`, otros campos/partes, JSON no objeto, archivos vacíos, carga incompleta o multipart malformado. El frontend futuro debe dejar que el navegador genere el boundary.
- Máximo por archivo: **5 000 000 bytes** (5 MB decimales), inclusivo. Máximo de suma de archivos: **50 000 000 bytes**. Límite técnico total de petición: **50 065 536 bytes**, incluidos límites/headers/metadata. `data` máximo **32 768 bytes**; son límites de transporte, no nuevos límites de contenido funcional de campos individuales. Nombrarlos como constantes, probar exactamente el límite y un byte más.
- JPEG y PNG solamente. Validar extensión original permitida (.jpg/.jpeg/.png), MIME declarado compatible y contenido real de imagen; ninguna comprobación aislada es suficiente. Archivos falsos, truncados o de otro formato no se aceptan aunque tengan extensión/MIME correctos. No se transforma ni reescala la imagen en este incremento.
- Usar un parser multipart y validación de imagen mantenibles, con límites aplicados mientras se lee; no acumular peticiones ilimitadas ni copiar/importar parsers o almacenamiento internos de pagos. La librería concreta de parser/decodificación debe justificarse y anunciarse antes de instalar; esta spec no instala ni autoriza una dependencia por nombre implícitamente.

### 6.2. Almacenamiento y entrega

- Directorio raíz de fotos de Fleet configurable mediante `BUS_PHOTO_STORAGE_DIR`, en carpeta del host montada como volumen Docker y fuera de la imagen/repositorio. No reutilizar el directorio privado ni credenciales de pagos. Añadir configuración/documentación de ejemplo al implementar, sin leer `.env` existente.
- El servidor genera claves UUID y organiza archivos en directorios propios del alta. El nombre de archivo enviado se usa solo para validar su extensión; nunca como ruta, clave ni nombre persistido. Mantener todos los destinos dentro de la raíz configurada y evitar sobrescrituras.
- Preparación en un directorio `.staging` único por operación y promoción al directorio final del bus dentro del mismo volumen. No hacer accesibles los temporales. El directorio final no se publica automáticamente mediante Express static.
- La respuesta del alta entrega identificadores y metadatos de fotos, no rutas de la laptop ni claves privadas. No se incluye endpoint adicional de descarga/listado de imágenes: la lectura autorizada y eventual uso público se especifican en una tarea posterior. La futura pantalla puede usar previsualización local de los archivos elegidos mientras prepara el alta.
- Copias de seguridad de BD y carpeta y traslado conjunto al desplegar. Recrear el contenedor no debe quitar fotos; eliminar el volumen/carpeta deliberadamente sí puede hacerlo. La guía y las pruebas no prometerán persistencia si se borra el almacenamiento.

### 6.3. Consistencia y recuperación

1. Validar toda la entrada antes de crear archivos persistentes. Si el parser usa temporales por límites de memoria, eliminarlos en todos los caminos de salida; su directorio pertenece a la operación.
2. Preparar todas las fotos con claves de servidor. Si una preparación falla, eliminar solo los archivos creados por esta alta; no insertar un bus incompleto.
3. Abrir transacción PostgreSQL; verificar grupo con filtro de cooperativa y registrar bus/asientos/referencias. Restricciones resuelven duplicados concurrentes. Antes de COMMIT, promover el directorio temporal al destino final; no sobreescribir un destino preexistente.
4. Si hay un rechazo de validación, conflicto SQL o fallo de promoción antes de confirmar, ejecutar ROLLBACK y compensar los archivos de esta operación. No borrar archivos de otros buses o intentos ni responder 201 con referencias incompletas.
5. Si COMMIT confirma, no limpiar sus archivos. Responder 201 solo después de confirmación positiva y con todas las referencias disponibles.
6. Si se pierde la conexión durante COMMIT, el resultado puede ser incierto: no afirmar que se revirtió ni borrar el directorio final. Responder error genérico si todavía hay conexión HTTP, registrar identificadores internos de operación/bus (sin archivos, contenido de fotos ni datos personales) y preservar archivos para reconciliar con BD. Un fallo de respuesta al cliente posterior a un COMMIT confirmado tampoco elimina el alta.
7. Si falla la limpieza o el proceso cae, puede quedar un directorio no referenciado. Registrar el incidente y conservarlo privado; procedimiento operativo de reconciliación compara UUID de operación/bus y referencias en BD antes de retirar exclusivamente archivos huérfanos. No ocultar el fallo ni prometer transacción atómica entre archivos y BD. No crear una cola ni un segundo endpoint como parte de esta tarea. Implementar y documentar un procedimiento verificable de recuperación, con temporales de prueba y sin limpiar automáticamente directorios de altas activas.

Los puertos separan preparación/promoción/eliminación de archivos y registro transaccional. El error de COMMIT incierto debe distinguirse internamente de un rollback confirmado para que la compensación no destruya un alta posiblemente persistida. Los fallos técnicos propagan error genérico; no se convierten en lista vacía ni se aceptan fotos ficticias.

### 6.4. Respuestas

- 201 `{ "bus": { "id", "plate", "vin", "unitNumber", "bodyworkBrand", "color", "busGroupId", "seatLayoutId", "seatLayoutVersion", "capacity", "photos": [{ "id", "contentType", "size", "order" }], "created_at", "updated_at" } }`. plate formateada con guion; VIN normalizado; unidad numérica; capacidad derivada. IDs UUID y fechas de servidor. Sin cooperative_id, geometría enviada por cliente, claves de almacenamiento ni listado de ocupaciones. Los UUID de asientos se guardan para la consulta posterior; no crear un endpoint de inventario aquí.
- 400 VALIDATION_ERROR: datos, imagen, claves de posición o multipart inválidos, cantidad menor/mayor a 1–10, campos adicionales o partes duplicadas.
- 401 UNAUTHENTICATED; 403 FORBIDDEN o CSRF_TOKEN_INVALID según middlewares existentes.
- 404 BUS_GROUP_NOT_FOUND para grupo inexistente o ajeno, con el mismo mensaje genérico en ambos casos. No revelar si un grupo de otra cooperativa existe.
- 400 SEAT_LAYOUT_NOT_FOUND para base/version no disponible en el catálogo de servidor; una avería del proveedor no es una base ausente y responde error técnico.
- 409 BUS_ALREADY_EXISTS para conflicto de placa, VIN o unidad; mensaje genérico sin bus, cooperativa ni campo que identifique datos de terceros. No crear archivos/filas parciales al perder la carrera.
- 413 PAYLOAD_TOO_LARGE para tamaño total/metadata/archivo sobre los límites, manteniendo limpieza de temporales.
- 415 UNSUPPORTED_MEDIA_TYPE si la petición no es multipart/form-data. Un archivo que no sea JPEG/PNG dentro de multipart es 400 VALIDATION_ERROR.
- 500 INTERNAL_ERROR para fallo técnico, incluido resultado incierto de COMMIT, con formato central del proyecto `{ "error": { "code", "message" } }`, sin stack ni detalles internos.

No añadir reintentos automáticos del alta ni declarar idempotencia inexistente. Tras un resultado incierto, la operación se contrasta antes de repetir; una repetición con identificadores únicos ya confirmados puede responder 409. La consulta para soporte y el reintento no justifican cambiar datos/esquema a mano.

## 7. Criterios de aceptación propuestos

- Administrador autorizado, CSRF y datos completos: un bus persistido en su cooperativa.
- Sin sesión válida, con otro rol o CSRF inválido: rechazo sin escrituras ni archivos huérfanos.
- Grupo ajeno o inexistente: rechazo sin revelar datos de otra cooperativa.
- Datos RN-10 ausentes o campos extra: rechazo sin persistencia parcial.
- Archivo inválido o fallo previo a COMMIT: rollback/limpieza verificables, sin alta parcial. Ante COMMIT incierto, conservar archivos y reconciliar; no exigir ausencia de filas como si un resultado incierto equivaliera a rollback.
- Fotografías: aceptar entre 1 y 10 archivos JPEG o PNG, cada uno de hasta 5 MB; rechazar ausencia de fotos, exceso de cantidad, otro formato o tamaño superior sin persistencia parcial. Verificar el contenido del archivo, no solo su extensión o el tipo declarado por el cliente.
- Placa o VIN repetido: rechazar, aunque el bus se intente registrar en otra cooperativa, sin revelar datos del registro existente.
- Placa: aceptar TBM-2213 y TBM2213 (incluidas minúsculas normalizables) como la misma identidad; persistir TBM2213 y presentar TBM-2213. Rechazar combinaciones distintas de tres letras y cuatro dígitos, guiones mal ubicados o espacios internos. Conservar ceros iniciales del bloque numérico, por ejemplo TBM-0013.
- Número de unidad repetido en la misma cooperativa: rechazar. El mismo número en cooperativas distintas está permitido si placa y VIN son distintos.
- VIN: convertir a mayúsculas y recortar espacios exteriores antes de persistir y comprobar unicidad global. Rechazar texto vacío; no eliminar espacios internos ni imponer longitud/patrón/consulta externa no acordados.
- Número de unidad: exigir entero positivo, no cero, negativo ni fraccionario. Normalizar 01 y 1 a la misma identidad para impedir duplicados dentro de una cooperativa. Esa identidad puede repetirse entre cooperativas distintas.
- Concurrencia: ante registros con la misma placa, el mismo VIN o el mismo número de unidad dentro de una cooperativa, solo uno puede persistir; imponer la unicidad en PostgreSQL, no únicamente con una consulta previa.
- Migración reversible y reaplicable sin asumir que Fleet es la última del proyecto.
- Exigir selección de una plantilla existente al registrar el bus; no ofrecer inventario ni habilitarlo para viajes sin la plantilla exigida por RN-12. Implementación pendiente del contrato y del catálogo real de plantillas, no de datos ficticios.

## 8. Acuerdos necesarios

### Decisión: pertenencia e identificación del bus

- **Estado:** En revisión. T1/T2 publicados en PR #27; T3 en 36b9255 y T4 preparados para actualizar esa PR por petición de Edwin el 31 de octubre. Implementación backend verificada con 985 pruebas; revisión humana e integración pendientes. FLEET-03/PR #26 ya integrada en develop 4937892 al comprobarla.
- **Respuesta humana:** un bus solo puede estar registrado en una cooperativa; placa y número de unidad son obligatorios para control de unidades y auditorías.
- **Aclaración y decisión de Edwin:** chasis significa número identificador VIN, no marca. Tras considerar usar solo placa, confirmó conservar el VIN del chasis obligatorio conforme a RN-10 el 29 de octubre de 2026. Queda descartada la propuesta de omitirlo o hacerlo opcional; no se cambia RN-10.
- **Fuente de validación:** su referencia anterior a la ANT era una duda, no una fuente verificada ni un requisito de integración. No se añade consulta a la ANT.
- **Control de duplicados confirmado por Edwin:** placa y VIN únicos en todo el sistema; número de unidad único dentro de cada cooperativa. Ejemplo explícito aprobado: puede existir una unidad 1 de Cooperativa Loja y otra unidad 1 de Cooperativa Santa, con placas y VIN diferentes.
- **Persistencia prevista:** restricciones únicas globales para placa y VIN y restricción única compuesta para cooperativa/número de unidad, mediante una migración nueva. Normalización y formatos se documentarán antes de implementar; no inferirlos de la unicidad.
- **Grupo confirmado el 30 de octubre:** Edwin aceptó un solo grupo operativo por bus, perteneciente a su misma cooperativa. Se conservan LONG_ROUTE, CANTONAL y URBAN_RURAL de RN-11/FLEET-01. Pisos corresponden a la plantilla y paradas a la frecuencia; no se cambia RN-11.
- **Marca de carrocería y color confirmados el 30 de octubre:** textos libres obligatorios, sin catálogos adicionales. Recortar espacios exteriores y rechazar valores vacíos; no fijar límites funcionales adicionales no acordados.
- **Formato de placa confirmado por Edwin:** para este alcance de alta de buses se exige tres letras y cuatro dígitos, con ejemplo TBM-2213. Identidad canónica para persistencia/índice único: TBM2213. Representación para respuestas al usuario y futura pantalla: TBM-2213, calculada desde la identidad canónica; no almacenar dos valores editables independientes. No se afirma que este contrato abarque todos los tipos o placas históricas del país.
- **Normalización de placa:** recortar espacios exteriores, convertir letras a mayúsculas y aceptar con o sin un único guion separador entre letras y dígitos. Validar tres letras ASCII A–Z y cuatro dígitos 0–9; quitar solo ese guion para persistir y comparar. Rechazar guiones en otras posiciones, puntuación o espacios internos en lugar de eliminarlos indiscriminadamente. El bloque numérico es texto para preservar ceros iniciales.
- **Concurrencia de placa:** la restricción única global debe operar sobre la identidad canónica; TBM-2213, tbm2213 y TBM2213 no permiten filas distintas. Probar también registros simultáneos con variantes de presentación. La API de alta devolverá la placa formateada; el índice interno no cambia la presentación.
- **VIN y unidad confirmados por Edwin el 30 de octubre:** VIN en mayúsculas con recorte de espacios exteriores; número de unidad entero positivo, con 01 equivalente a 1. Aplicar esa normalización antes de persistir y comparar, conservando unicidad global del VIN y por cooperativa de la unidad. No se ha aprobado un patrón ni longitud adicional para VIN ni una consulta a la ANT.
- **Contrato técnico propuesto:** unitNumber dentro del JSON `data` de multipart, entero seguro positivo o texto decimal estricto normalizado, sin truncar fracciones ni aceptar conversiones parciales; límite de precisión Number.MAX_SAFE_INTEGER, sin inventar límites operativos de flota.
- **Impacto:** validar campos obligatorios y pertenencia; verificar unicidad global y por cooperativa, concurrencia y errores sin filtración de información.

### Decisión: almacenamiento de fotografías

- **Estado:** En revisión. T1/T2 publicados en PR #27; T3 en 36b9255 y T4 preparados para actualizar esa PR por petición de Edwin el 31 de octubre. Implementación backend verificada con 985 pruebas; revisión humana e integración pendientes. FLEET-03/PR #26 ya integrada en develop 4937892 al comprobarla.
- **Respuesta humana:** tras reconsiderar la propuesta externa y comparar opciones, Edwin confirmó fotos en una carpeta persistente de su laptop conectada al backend mediante un volumen Docker, con referencias en PostgreSQL.
- **Decisión:** almacenamiento de archivos local persistente mediante un puerto de almacenamiento. La carpeta está fuera de la imagen del contenedor; reconstruirlo no debe eliminar las fotografías. No se contrata un proveedor externo en este alcance.
- **Operación:** al desplegar en otro servidor se deben trasladar los archivos y respaldar tanto la base como la carpeta. No versionar fotografías cargadas ni datos reales. La ruta concreta se definirá al implementar la configuración, sin leer archivos `.env`.
- **Límites confirmados por Edwin:** entre 1 y 10 imágenes por bus, formatos JPEG o PNG y hasta 5 MB por archivo. Confirmación explícita del 29 de octubre de 2026. Estos límites no aprueban la implementación completa.
- **Contrato técnico consolidado para aprobación:** sección 6, multipart de data/photos, 5 000 000 bytes por imagen, almacenamiento de Fleet separado del de pagos, referencias públicas por ID, limpieza compensatoria y manejo de COMMIT incierto. No implica que ya esté implementado ni revisado por otro integrante.
- **Prueba prevista:** cargar fotografías de prueba, recrear el contenedor sin eliminar el almacenamiento persistente y verificar archivos/referencias. Probar fallos de almacenamiento y persistencia conforme al flujo acordado.
- **Casos de límites:** 0, 1, 10 y 11 archivos; JPEG/PNG válidos, contenido de otro formato aunque tenga extensión permitida, archivo exactamente en el límite de tamaño y archivo que lo supera.

### Inventario de asientos para reservas y hojas de ruta

- **Estado:** En revisión. T1/T2 publicados en PR #27; T3 en 36b9255 y T4 preparados para actualizar esa PR por petición de Edwin el 31 de octubre. Implementación backend verificada con 985 pruebas; revisión humana e integración pendientes. FLEET-03/PR #26 ya integrada en develop 4937892 al comprobarla.
- **Decisión de Edwin:** elegir una plantilla existente al registrar el bus; debe estar asignada antes de habilitarlo para viajes. No se contempla en esta spec un alta sin plantilla.
- **Capacidades citadas:** Edwin mencionó aproximadamente 36 asientos para un piso y 42 para dos pisos, expresando incertidumbre. Son ejemplos orientativos, no capacidades aprobadas, universales ni valores predeterminados. El catálogo y las distribuciones concretas deben definirse; la capacidad se deriva de sus asientos.
- **Referencias visuales aportadas después:** dos imágenes de distribución de Flota Imbabura, compartidas por Edwin. La de un piso muestra 42 asientos en disposición 2+2 con última fila parcial; la de dos pisos muestra 44 asientos arriba y 16 abajo (60 en total), disposición 2+2 con espacios de escaleras/servicios. Estos recuentos describen las referencias, no una capacidad universal. Las imágenes se usan como referencia de distribución; no autorizan reutilizar marca, mascota ni datos de contacto.
- **Bases solicitadas por Edwin:** plantilla de un piso según referencia, plantilla de dos pisos según referencia y variante de dos pisos con disposición 2+1 (dos asientos juntos y uno individual separados por pasillo). La variante 2+1 queda definida por las confirmaciones siguientes.
- **Aclaración posterior de Edwin para 2+1:** respetar las filas y espacios de escaleras/servicios de la imagen; los asientos individuales van al lado de la escalera (derecha en la referencia). Su corrección deja sin usar el recuento previo de 22 arriba y 8 abajo/30 total. No convertir el espacio de escaleras en asiento.
- **Distribución 2+1 confirmada por Edwin:** 34 asientos arriba (12 pares a la izquierda y 10 individuales a la derecha de la referencia) y 12 abajo (4 pares a la izquierda y 4 individuales a la derecha): 46 en total. Conserva filas y espacios de escaleras, baños, equipaje y otros servicios; individuales del lado de la escalera. Edwin confirmó expresamente esta distribución el 29 de octubre de 2026. Es la capacidad de esta base concreta, no de todos los buses de dos pisos. El contrato de identificadores con Leslie y David sigue pendiente.
- **Numeración 2+1 confirmada por Edwin:** comenzar por el segundo piso, de adelante hacia atrás, numerando primero los asientos juntos (1 y 2) y luego el individual (3) de la primera fila; continuar de la misma forma por cada fila. Numerar únicamente asientos existentes, no escaleras ni servicios. Con la distribución de 34/12 acordada, la secuencia corresponde a 1–34 arriba y 35–46 abajo. En filas sin asiento individual por la escalera, continuar por los dos asientos reales sin crear una posición adicional. Esta numeración visible no sustituye los identificadores estables pendientes del contrato compartido.
- **Configuración de capacidad confirmada por Edwin:** cada cooperativa determina cuántos asientos tiene cada uno de sus buses al configurar su plantilla. La capacidad pertenece al bus seleccionado, no es un único valor para toda la cooperativa. La creación de cooperativas permanece fuera del alcance; la distribución corresponde a Fleet.
- **Adaptación visual aceptada por Edwin, condicionada a mantenerla sencilla:** elegir una base y activar/desactivar posiciones por bus; derivar la capacidad de las que permanezcan ofrecidas y mostrarla al configurar. No incluye arrastrar asientos, agregar posiciones, dibujar distribuciones ni alterar escaleras/servicios. La cantidad sola no determina qué posiciones físicas faltan; no quitar automáticamente los últimos números ni modificar la base compartida. Una cantidad superior a la base requiere otra distribución. Si la implementación exige ampliar este alcance, plantearlo antes de continuar.
- **Límite del primer incremento de configuración:** la selección se realiza durante el alta del bus; cambiar posiciones de un bus ya habilitado con viajes o reservas queda fuera hasta acordar el contrato con Leslie y David. No renumerar los asientos restantes al desactivar posiciones.
- **Separación de estados propuesta:** una posición no ofrecida no forma parte del inventario vendible del bus; no equivale a un asiento reservado o vendido por viaje (RN-40). Conservar identidad/etiqueta de los asientos que permanezcan ofrecidos, sin renumerarlos por ocultar posiciones. Acordar con Leslie y David el cambio de configuración cuando existan viajes o reservas antes de implementar esa operación.
- **Propuesta:** cada asiento tiene un identificador estable distinto de su etiqueta visible; pertenece a un bus y a una versión identificable de su plantilla. Definir pisos, tipos y espacios para silla de ruedas conforme a RN-12.
- **Modelo conceptual aceptado por Edwin:** separar los asientos del bus de sus reservas. Cada asiento tiene una identidad estable vinculada a su bus, además del número visible. Un viaje identifica una salida concreta con fecha y bus; la reserva contiene el tramo y sus asientos. El mismo asiento puede reservarse en viajes o días distintos y en tramos no superpuestos de un mismo viaje; no permitir ocupaciones efectivas superpuestas conforme a RN-40.
- **Identidad propuesta:** UUID generado por servidor para cada asiento del bus. Desactivar otros asientos no cambia sus identificadores ni etiquetas. Edwin aceptó esta propuesta conceptual; falta contrastar contrato y tipos concretos con los consumidores.
- **Tablas ilustrativas discutidas:** buses, bus_seats, trips, bookings y booking_seats. Describen responsabilidades, no un esquema aprobado entre módulos. Antes de fijar nombres, ubicación o nuevas tablas, revisar lo implementado y las specs de Leslie y David; no crear ni modificar tablas de viajes/reservas dentro de Fleet por este acuerdo.
- **Concurrencia y tramos:** una unicidad aislada sobre viaje/asiento no representa ventas válidas por tramos adyacentes. Leslie debe definir y verificar en su módulo la coordinación transaccional que impida superposiciones; esta spec no prescribe una implementación de bloqueo ni un nuevo estado de reserva.
- **Por acordar:** identidad cuando se cambia la plantilla, qué espacios pueden reservarse y qué ocurre si ya hay reservas. No decidir una política de cambios dentro del registro de buses.
- **Frontera:** Fleet proporciona buses/plantillas mediante su API pública; David resuelve el bus asignado al viaje; reservas controla ocupación por viaje y tramo. Un grupo no equivale a un inventario.
- **Trabajo independiente:** cerrar esta spec de alta mientras se acuerda el contrato de asientos; consultas e inventario serán tareas posteriores.
- **Confirmaciones recibidas:** Edwin confirmó cuándo elegir plantilla y aceptó separar identidad estable por bus de ocupación por viaje/tramo. Leslie y David aún no aprobaron el contrato de inventario/identificadores ni las tablas ilustrativas. El mensaje de Leslie solicita la conexión; no aprueba este diseño.
- **Confirmación del 30 de octubre de 2026:** Edwin mantiene tal como está la propuesta de coordinación preparada para David y Leslie: Fleet entregará asientos ofrecidos con identidad, número y piso; se solicita a David precisar viaje, bus y recorrido y a Leslie contrastar consumo/ocupación por viaje y tramo. No hay respuesta registrada de David ni Leslie; no se envió el mensaje desde Codex. Esta confirmación no aprueba por sí sola todos los puntos pendientes de la spec.

## 9. Arquitectura, SOLID y usabilidad

Dominio: datos/errores y puertos pequeños. Aplicación: un caso de uso con dependencias inyectadas. Infraestructura: PostgreSQL y almacenamiento. HTTP: traducción, validación y permisos; composición por la API pública de Fleet. No importar capas internas de otros módulos.

Separar registro y almacenamiento permite una responsabilidad clara y probar fallos sin acoplar dominio a Express o archivos. Los adaptadores deben respetar el mismo contrato, incluido aislamiento y errores. No introducir jerarquías para escenarios hipotéticos.

Sin pantalla en este alcance. Mensajes de error en español y formato de API existente; la usabilidad de un formulario no queda verificada por pruebas de backend.

## 10. Plan y pruebas

1. Implementación del contrato consolidado aprobada por Edwin el 31 de octubre. Revisor David aún propuesto, sin confirmación registrada; no sustituir su revisión por la aprobación de alcance.
2. T1: dominio de identificación/configuración y pruebas de placa, VIN, unidad, grupo y base/version. No crear viajes ni tablas de reservas.
3. T2: migración nueva y repositorio transaccional. Probar duplicados de placa/VIN entre cooperativas, unidad repetida dentro de una cooperativa, unidad 1 válida en Loja y Santa, FKs, snapshot/asientos y concurrencia de cada restricción.
4. T3: puerto/adaptador local de fotos con temporales de prueba, promoción, limpieza y recuperación. Probar fallo en la segunda foto, disco/escritura fallida, promoción fallida, conflicto SQL, rollback, fallo de limpieza y COMMIT incierto sin borrado destructivo. Distinguir desconexión del cliente tras commit confirmado.
5. T4: parser con límites mientras lee y endpoint real. Probar 0/1/10/11 fotos; contenido falso/truncado; extensiones/MIME incompatibles; multipart/JSON malformado, campos repetidos/extra, request interrumpido; tamaños exactos y un byte más. Auth/rol/CSRF deben preceder al consumo/almacenamiento.
6. Verificar arranque real y volumen persistente con fotos ficticias: registrar, recrear contenedor y comprobar archivos/referencias. Confirmar que no hay rutas estáticas de acceso ni nombres privados en respuestas/logs. Este ensayo usa entorno descartable, nunca la carpeta real de fotos del usuario.
7. Desde backend ejecutar lint, formato y suite completa con PostgreSQL aislado según `docs/testing-database.md`; reportar resultados reales sin arreglos incidentales de otros módulos. Revisar licencias/justificación de dependencias antes de instalar cualquier paquete.

Cada paso de implementación se autoriza y entrega por separado. Conservar pruebas anteriores y reportar fallos reales. No instalar dependencias sin avisar y justificar.

## 11. Defectos inducidos

No aplica. No se propone ni autoriza ningún defecto académico.

## 12. Evidencia y cierre

29 de octubre: preparación documental sobre `f26415d`, sin código, migraciones ni nuevas dependencias. Registradas las confirmaciones de Edwin sobre cooperativa única, placa/unidad obligatorias y almacenamiento local persistente de fotografías. Sin pruebas de producto ejecutadas para esta tarea; aún no hay implementación. Revisión humana, decisiones restantes, commit y PR pendientes. No marcar Integrada ni Cerrada.

30 de octubre: revisión de Git autorizada por Edwin. Rama local `feature/FLEET-02-registro-buses`, base `f26415d`, solo documentación sin commit. Fetch comprobó origin/develop `1d9381d`, dos commits posteriores relativos a la caché CSRF del frontend y su documentación; incluye cambios al registro de estado compartido. No se incorporaron al checkout ni se realizaron merge/rebase/push/commits. La PR #24 está integrada y #25 (arranque de frecuencias) está abierta al consultar. `git diff --check` sin errores. Esta revisión es documental y de historial; no se ejecutaron pruebas de producto ni se acredita una implementación nueva de Fleet.

Preparada el 30 de octubre la spec separada [FLEET-03](FLEET-03.md), en borrador, para catálogo/consulta de plantillas como dependencia del alta. No incluye persistir configuración por bus ni la pantalla. El acuerdo conceptual no sustituye el contrato real con Leslie y David ni autoriza tablas de otros módulos.

Continuación documental del 30 de octubre: la dependencia FLEET-03 ya está implementada en `d1d3542` y PR #26 lista para revisión (no integrada al comprobarla). Para mantener esa PR centrada en catálogo se prepara el contrato de alta en `feature/FLEET-02-contrato-alta`, basada en `d1d3542`; contiene la dependencia pendiente de integración. Edwin confirmó grupo único de su cooperativa y marca de carrocería/color como texto libre obligatorio. FLEET-02 sigue en borrador; sin código de alta, commits ni publicación de esta continuación documental.

Contrato técnico completado el 30 de octubre por petición de Edwin: campos, límites exactos, snapshot de asientos, almacenamiento, errores, recuperación y plan de pruebas definidos en secciones 5/6/10. Edwin confirmó también un asiento ofrecido como mínimo. Estado: listo para revisión/aprobación de implementación, no funcionalidad Cerrada. Solo se modificó documentación de Fleet/registro; no se tocaron pagos ni migraciones, no se instalaron dependencias ni se ejecutaron pruebas de producto. `git diff --check` correcto; no hay commit/push de esta continuación.

### T1 — Implementación autorizada el 31 de octubre de 2026

Edwin aprobó el contrato consolidado y pidió comenzar la implementación. Se entrega únicamente T1 en `feature/FLEET-02-contrato-alta`, sobre d1d3542; revisor técnico aún pendiente. Fetch comprobó origin/develop 56dc55a y PR #26 todavía abierta; no se integraron cambios remotos ni se modificó esa PR.

- `domain/bus-registration.js`: metadatos estrictos sin campos adicionales, placa canónica/presentación, VIN con trim/mayúsculas, unidad positiva segura, UUID de grupo y selección de plantilla/version. Contexto de cooperativa y grupo se comprueba con datos proporcionados por el servidor, nunca desde el body.
- `domain/bus-seat-configuration.js`: copia validada e inmutable de la plantilla de servidor, posiciones de asiento conservadas con etiqueta/piso/coordenadas/NORMAL, bandera offered por clave y capacidad derivada. Rechaza servicios/claves desconocidas, repetidas o todas deshabilitadas; no renumera ni altera la base compartida.
- `domain/bus-registration-error.js`: errores explícitos VALIDATION_ERROR, BUS_GROUP_NOT_FOUND y SEAT_LAYOUT_NOT_FOUND. La geometría inválida del proveedor conserva su error de configuración; no se disfraza como plantilla ausente.
- 93 pruebas nuevas en `tests/unit/fleet/bus-registration.test.js` y `bus-seat-configuration.test.js`, aprobadas de forma dirigida. Cubren límites de precisión de unidad, privacidad de grupo ausente/ajeno, contexto ausente, normalización, datos extra, capacidad, independencia por bus e inmutabilidad.
- No se generan todavía UUID de asientos persistidos ni se comprueban duplicados en BD: T2 debe imponer las restricciones y generar identidades; las claves de posición no sustituyen esos UUID. Sin repositorio, migraciones, fotos, parser, endpoint ni composición nueva.
- Diseño: funciones puras en dominio con JavaScript estándar y dependencias solo del dominio de Fleet. No se importan Express, pg, archivos ni capas internas de otro módulo. No hay cambios en pruebas anteriores, migraciones ni dependencias instaladas.
- Lint y formato de los cinco archivos nuevos correctos. Formato global fallido en los mismos 24 archivos previos sin modificar (Fleet anterior, hojas de ruta y migraciones).

Validación del 31 de octubre, Node 24 y PostgreSQL 16.13 aislado, proyecto `busesuta-fleet02-t1-test`, puerto local 55433 y base `busesuta_test`:
- Pruebas nuevas dirigidas: 93 aprobadas. `npm run lint` correcto; formato de archivos nuevos y `git diff --check` correctos.
- `npm run format:check`: fallido por 24 archivos previos no modificados; no se reformatearon migraciones ni módulos ajenos.
- `npm test`: 695 unitarias aprobadas; integración 123 aprobadas y 3 fallidas por superar los 20000 ms en `user-cooperative-integrity.test.js` (2) y `database.test.js` (1). La ejecución completa fue fallida.
- Repetición de `npm run test:integration` con una base recién creada y las mismas pruebas/configuración: 125 aprobadas y 1 fallida, nuevamente por tiempo agotado en `tests/integration/database.test.js`, caso de migraciones reversibles. Las pruebas de integridad pasaron en esta segunda ejecución. La integración sigue fallida; no se aumentó el timeout ni se modificó ninguna prueba anterior.
- Se comprobó actividad/recursos del contenedor sin consultar datos personales. El origen del tiempo de ejecución no se certifica; no se declara este fallo inducido ni se presenta la suite como aprobada. La prueba general de migraciones importa herramientas/esquema existentes, que no fueron cambiados por T1.
- Contenedor temporal retirado al terminar. No hubo cambios de composición, por lo que no hay un endpoint nuevo cuyo arranque pueda acreditarse; la integración existente sí incluye la prueba de arranque del catálogo FLEET-03.

Próxima comprobación pendiente: reproducir el timeout de migraciones en el entorno del revisor con `npm run test:integration --` o el comando Jest directo correspondiente y la misma base aislada/configuración; no integrar sin evaluar el fallo. Propuesta de commit atómico cuando Edwin lo solicite: `feat(flota): valida los datos y asientos del registro de buses`, con `Refs: docs/specs/FLEET-02.md`.

Comprobación adicional antes del commit solicitado por Edwin el 31 de octubre: misma suite y timeout original en Docker, imagen Node 24.21.0-bookworm-slim del Dockerfile y PostgreSQL 16.13, fuente montada en solo lectura y dependencias exactas del lock instaladas mediante npm ci en volumen temporal separado. `npm test` aprobó 695 unitarias y 126 integraciones (821 total); la prueba general de migraciones aprobó en 5,105 segundos. No se editaron pruebas, timeout, lock ni versiones. Los intentos fallidos de Windows se conservan como evidencia; no se certifica su causa ni se ocultan. npm ci informó 26 alertas de dependencias existentes (3 bajas, 22 moderadas, 1 alta); no se aplicó npm audit fix ni actualizaciones fuera de alcance.

T1 quedó guardado por petición de Edwin en 6123ca1. No se realizó push. La evidencia siguiente corresponde a T2, todavía sin commit; T3 y T4 siguen pendientes.

### T2: persistencia transaccional, 31 de octubre de 2026

- Nueva migración 1793440000000-register-buses.js: buses, bus_seats y bus_photos, unicidad global de placa/VIN y por cooperativa de unidad, claves foráneas compuestas para aislamiento. No se modificaron migraciones existentes ni su orden.
- Puerto/repositorio de alta: snapshot de plantilla, UUID por asiento y referencias privadas de fotos en una transacción. Fallos conocidos revierten todas las filas; pérdida de confirmación de COMMIT genera error explícito y no ordena borrar archivos. T3 implementará los archivos reales; T4 el caso de uso y HTTP.
- 58 pruebas nuevas aprobadas: 20 unitarias y 38 de integración, incluyendo concurrencia, aislamiento, reversión/reaplicación de migración sin asumir que sea la última y COMMIT efectivamente aplicado cuya confirmación se pierde.
- Edwin autorizó expresamente modificar solo la preparación de tres suites de frecuencias: se añadieron bus_photos, bus_seats y buses a sus listas TRUNCATE, sin cambiar datos esperados ni comprobaciones.
- Validación completa aislada en Node 24.21.0 y PostgreSQL 16.13: lint aprobado; 715 unitarias aprobadas; integración con 160 aprobadas y 4 fallidas en route-sheet-routes.test.js porque su lista TRUNCATE también debe incluir las nuevas tablas referenciadas. Edwin autorizó posteriormente agregar únicamente las tres tablas a esa lista, sin cambiar datos ni comprobaciones.
- Formato de archivos nuevos correcto; format:check global sigue fallando en los mismos 24 archivos anteriores fuera de alcance. No se añadieron dependencias ni se modificó el lock. T2 permanece local, no integrado ni cerrado.
- Repetición final tras el ajuste autorizado de preparación de hojas de ruta: lint aprobado y npm test aprobado, 715 unitarias + 164 integraciones = 879 pruebas, 63 suites. Incluye las pruebas afectadas de Fleet y hojas de ruta; integración completa en 48,838 segundos. Base busesuta_test aislada en Docker; sin lectura de .env ni cambios de composición. git diff --check aprobado. T2 sigue sin commit ni push.

### T3: almacenamiento local y recuperación, 31 de octubre de 2026

Edwin solicitó publicar T1/T2 y continuar T3. T2 quedó en ebd547a y se publicó junto con T1 en la PR #27, en borrador hacia develop: https://github.com/Pato77232/ProyectoBusesUTA/pull/27. Depende de #26, aún abierta al consultar; no se realizaron merge/rebase ni cambios a la PR #26. Implementación y descripción de PR asistidas por Codex; no sustituyen revisión humana.

- Puerto BusPhotoStorage, adaptador LocalBusPhotoStorage y coordinador de aplicación persist-bus-with-photos. Reciben bytes y metadatos ya validados por el caso de uso/transporte de T4; no acreditan contenido JPEG/PNG ni reemplazan su futura decodificación.
- Raíz absoluta privada; carpetas/archivos propios con UUID y creación exclusiva, sin nombres del cliente. Preparación en .staging/OPERACION_UUID; reserva exclusiva de buses/BUS_UUID, manifiesto interno y promoción al subdirectorio photos mediante rename en el mismo volumen. Ninguna ruta estática ni endpoint de descarga. Rechaza destinos preexistentes y enlaces simbólicos de los directorios administrados al prepararlos/inspeccionarlos. El administrador debe controlar los padres de la raíz y el volumen: no alojarlos en una carpeta escribible por usuarios ajenos.
- Compensación limitada a la sesión que creó los archivos; un conflicto SQL o fallo de promoción no elimina archivos de otros intentos. Ante COMMIT incierto conserva los finales y registra UUID de bus/operación, sin rutas ni contenido. Limpieza fallida genera incidente explícito; no se responde éxito ni se oculta el fallo.
- Diagnóstico de soporte por API pública de Fleet y scripts/inspect-fleet-photo-operation.js: consulta parametrizada y filtrada por cooperativa, compara claves referenciadas con archivos/manifiesto y tamaños, sin escrituras ni borrado. Resultado PRESERVE solo con correspondencia completa; cualquier ausencia/discrepancia exige MANUAL_REVIEW. No es validador de imagen ni certifica ausencia global a partir de una consulta de un tenant.
- BUS_PHOTO_STORAGE_DIR documentada en .env.example con valor ficticio. T3 usa configuración explícita en adaptador/diagnóstico; el montaje y la composición del alta en server.js/docker-compose.yml quedan para T4, junto con el endpoint. No se instaló ninguna dependencia nueva ni se modificó el lock.
- Pruebas iniciales en Windows: 22 aprobadas/5 fallidas por EPERM de rename bajo la restricción de archivos. Repetición con los mismos casos y permisos de ejecución adecuados: 27 aprobadas. No se debilitaron comprobaciones ni se aumentó timeout.
- Prueba de persistencia del volumen: dos contenedores Node 24.21.0 consecutivos, ambos retirados con --rm, volumen temporal exclusivo y fixture PNG sin datos reales. El segundo proceso verificó igualdad exacta de bytes, manifiesto y referencia tras recrear el contenedor. Esto acredita el adaptador sobre el volumen, no un alta HTTP ni la composición de despliegue de T4.

#### Procedimiento de recuperación verificable (soporte, sin limpieza automática)

1. Detener todas las instancias que puedan registrar buses antes de evaluar huérfanos. Esperar a que terminen sus transacciones; no basarse solo en la antigüedad del directorio. Respaldar juntos PostgreSQL y la raíz privada. No ejecutar contra la carpeta real del usuario durante pruebas.
2. Obtener busId y operationId del incidente interno; comprobar la cooperativa correcta con el contexto autenticado registrado por soporte. Revisar el manifiesto operation.json correspondiente. Si faltó su escritura por fallo de disco, conservar el directorio y resolver manualmente, sin inferir propiedad por el nombre ni borrarlo a ciegas.
3. Configurar DATABASE_URL y BUS_PHOTO_STORAGE_DIR por entorno seguro de soporte (no leer ni imprimir .env). Desde backend ejecutar `node scripts/inspect-fleet-photo-operation.js BUS_UUID OPERACION_UUID COOPERATIVA_UUID`. La herramienta no cambia filas ni archivos; emite identificadores y resultado, nunca URL de conexión ni ruta de la laptop.
4. PRESERVE: el bus y todas sus referencias coinciden con archivos completos; conservar el alta incluso si se perdió la respuesta HTTP. MANUAL_REVIEW: no borrar nada aún. Comprobar el tenant y el resultado de la transacción; ausencia en una cooperativa equivocada no acredita un huérfano. Si hay referencias pero faltan archivos, restaurar los archivos desde respaldo y repetir la inspección; no corregir el esquema ni inventar referencias.
5. Solo con escritores detenidos, contexto correcto y ausencia comprobada de cualquier referencia al directorio/operación, un operador puede retirar exclusivamente el directorio huérfano identificado, primero a cuarentena privada fuera de las carpetas activas. Resolver y comprobar la ruta absoluta dentro de la raíz prevista antes de moverla. Conservar respaldo y evidencia; no aplicar barridos recursivos generales ni borrar directorios por fecha. Este paso es manual y no está implementado como cron, cola o endpoint.
6. Repetir el diagnóstico de los buses conservados, verificar sus referencias y bytes y reiniciar el servicio. Un diagnóstico fallido o manifiesto inconsistente exige revisión; nunca autoriza eliminación automática ni reintento ciego del alta.

Las pruebas reproducen COMMIT aplicado y COMMIT no ejecutado con resultado incierto, conservando archivos en ambos; también discrepancia de tenant, inspección CLI, fallo de disco/promoción/limpieza y restricciones SQL con BD aislada. T3 permanece local, sin commit ni publicación. T4 y revisión humana pendientes; no marcar FLEET-02 Cerrada.
Validación final T3: lint aprobado; npm test en Node 24.21.0 + PostgreSQL 16.13 aislado aprobó 724 unitarias y 191 integraciones (915 total, 66 suites), incluidas 36 pruebas nuevas de T3. Integración en 58,821 s, sin cambiar timeout. format:check global continúa fallando en los mismos 24 archivos previos; formato de todos los archivos nuevos/modificados de T3 y git diff --check correctos. Sin cambios de pruebas anteriores, pagos, migraciones ni dependencias durante T3.

### T4: alta HTTP y validación de fotografías, 31 de octubre de 2026

Edwin autorizó continuar T4. Implementado localmente sobre ebd547a con T3 todavía sin commit; no se publican estos incrementos sin una nueva petición. PR #27 conserva T1/T2 en borrador y dependencia de #26; esta implementación no equivale a integración ni revisión humana.

- POST /api/v1/buses conectado en la API pública de Fleet y en server.js. Se monta antes del parser JSON global para autenticar, autorizar COOPERATIVE_ADMIN y verificar CSRF antes de consumir cualquier cuerpo, incluso JSON malformado. No se modifican pagos ni sus adaptadores. Traducción de errores de Fleet a httpStatus en su router; el middleware central conserva el formato de respuesta y el error técnico genérico.
- Busboy lee el flujo con contador de bytes total, de archivos y metadata; límites originales de esta spec, incluidos límites exactos y un byte adicional. Retiene como máximo 50 MB de contenido de archivos por petición, con buffers temporales acotados; no crea temporales en disco durante el parser. Rechaza campos/partes adicionales, data repetido, foto vacía, exceso de cantidad, JSON inválido y multipart incompleto/interrumpido. Una carga interrumpida antes de terminar la validación no llega al almacenamiento.
- Validación de extensión, MIME y decodificación secuencial real con Sharp: metadata identifica formato y stats fuerza la lectura de píxeles con failOn=warning; metadata sola no basta para descartar truncamiento. Se exige además el chunk IEND completo al final de PNG: Sharp/libpng puede tolerar su ausencia aunque los píxeles estén disponibles. No se reescala ni transforma el original. Se mantienen las protecciones de decodificación por defecto de Sharp, incluido limitInputPixels; no se desactivan para aceptar imágenes patológicas.
- create-bus.use-case deriva la cooperativa del actor verificado, normaliza los datos, resuelve base/versión reales y calcula snapshot/capacidad antes de preparar archivos. UUID por servidor. Usa la coordinación de T3 y el repositorio de T2; las restricciones de BD resuelven las carreras. Sin consulta de inventario, edición, viajes ni reservas dentro de este alcance.
- Dependencias anunciadas y justificadas antes de instalar: busboy 1.6.0 (MIT) y sharp 0.35.5 (Apache-2.0), versiones exactas en package.json/lock. Licencias consultadas en los paquetes instalados; Sharp incluye componentes nativos y sus avisos. Fuentes: https://github.com/mscdex/busboy y https://sharp.pixelplumbing.com/api-constructor/. npm install no cambió versiones de paquetes ya existentes (comparación del lock); no se aplicó audit fix. Informó las mismas 26 alertas previas, sin corregir dependencias fuera de alcance ni reducir políticas de scripts.
- Primer lote de 64 pruebas nuevas dirigidas aprobado (35 unitarias, 29 HTTP/integración). Se añadieron seis casos de truncamiento mínimo de PNG/JPEG (uno, dos y ocho bytes): total T4 de 70 casos nuevos, 41 unitarios y 29 de integración. Cubren límites 0/1/10/11 fotos, tamaño exacto de archivo/metadata/petición y un byte más, suma exacta de 50 MB, JPEG/PNG y truncados/falsos, MIME/extensión incompatibles, abortos reales, autenticación antes de esperar cuerpo, CSRF, otros roles, datos/plantilla, grupo ajeno, duplicados y privacidad de errores/archivos. No se cambiaron datos esperados ni comprobaciones de pruebas anteriores durante T4.
- Primera suite completa: lint aprobado, 759 unitarias + 220 integraciones aprobadas (979 total). Después se ajustó el valor predeterminado de desarrollo para guardar fotos fuera del repositorio y se repitió la validación completa; resultado final registrado abajo. No se aumentaron timeouts ni se omitieron suites.

#### Configuración y comprobación operativa

- BUS_PHOTO_STORAGE_DIR es una ruta absoluta. En producción es obligatoria; fuera de producción, si falta, se usa .busesuta/fleet-photos dentro del directorio personal del usuario, fuera del repositorio. Ejemplo en .env.example; no se leyó .env.
- Docker Compose monta el volumen local fleet_photos en /home/node/fleet-photos. Dockerfile prepara la carpeta con propietario node; el servidor sigue sin privilegios de root. Docker Desktop conserva ese volumen en el almacenamiento local de la laptop; no se contrata un servicio externo. Es un volumen administrado por Docker, no una carpeta visible de Windows elegida por el usuario. Si se necesita un bind mount a una carpeta concreta, preparar sus permisos antes de sustituir el montaje y verificar otra vez su persistencia.
- Reconstruir/recrear contenedores y docker compose down conservan el volumen. Eliminar deliberadamente el volumen (por ejemplo down -v) elimina sus fotos: respaldar conjuntamente volumen y BD conforme al procedimiento de recuperación. No guardar fotos reales en el repositorio ni montar la carpeta de pagos.
- Verificación de Compose con --env-file NUL y valores ficticios: config --quiet aprobado, sin leer archivos de secretos. Imagen real construida mediante Dockerfile con dependencias de producción.
- Prueba real de imagen, NODE_ENV=production, usuario node y PostgreSQL aislado: primera instancia realizó login/CSRF y POST /api/v1/buses con imagen PNG generada y respondió 201. Se retiró el contenedor y se creó otro con la misma BD y volumen temporal; arrancó, verificó igualdad exacta de bytes, referencias y 42 asientos y confirmó 404 en ruta estática. No se usaron fotos ni directorios reales del usuario. Se retiraron los recursos temporales al terminar.
- Sin pantalla en este alcance: la accesibilidad/usabilidad de un formulario no se declara verificada. El backend permite a una pantalla futura distinguir validación, duplicado y error técnico sin exponer rutas privadas. Revisión humana de código y comprobación posterior en develop siguen pendientes.
Hallazgo adicional durante revisión T4: el sondeo mostró PNG truncados en 1, 2 y 8 bytes aceptados por la decodificación de Sharp, mientras JPEG se rechazaba. Se corrigió el código añadiendo verificación del cierre PNG y seis comprobaciones nuevas de truncamiento mínimo. La fixture de 5 MB ahora es un PNG completo con chunk auxiliar privado y CRC correcto, manteniendo el cierre al final; no se debilitó la expectativa de aceptar el límite exacto. No se escribió un decodificador de imagen ni un parser multipart propio.

Validación definitiva T4 después de la comprobación de cierre PNG: npm run lint aprobado; npm test en Node 24.21.0 + PostgreSQL 16.13 aislado aprobó 765 unitarias y 220 integraciones, 985 pruebas en 69 suites. Integración en 62,156 s. Incluye los 70 casos nuevos de T4 y mantiene todos los anteriores. Formato de todos los archivos JavaScript nuevos/modificados correcto y git diff --check aprobado. format:check global sigue fallando en los mismos 24 archivos anteriores fuera de alcance. T3/T4 permanecen locales sin commit/push; revisión humana e integración pendientes.

### Publicación para revisión, 31 de octubre de 2026

Edwin solicitó actualizar PR #27 con T3/T4 y dejarla lista para revisión. T3 guardado por separado en 36b9255; T4 y esta evidencia se guardan en el siguiente commit. Comprobación remota: #26 integrada, origin/develop en 4937892. Se conserva la rama feature/FLEET-02-contrato-alta sin merge/rebase ni cambios a main/develop; no se altera la PR #26. La descripción de #27 se reescribe alrededor del alta completa y conserva límites de formato/revisión. Validación existente aplicable: 765 unitarias + 220 integraciones (985), lint y formato del incremento correctos; arranque de imagen real y persistencia al recrear contenedor aprobados. No hubo cambios funcionales después de esa validación; la preparación de commits solo separó incrementos y normalizó saltos de línea. David sigue siendo revisor propuesto, sin aprobación humana registrada. No marcar Integrada ni Cerrada.

Resultado de publicación comprobado: T3 36b9255 y T4 369af70 publicados en PR #27, abierta y fuera de borrador. GitHub informa REVIEW_REQUIRED, sin checks CI registrados y mergeable=CONFLICTING (mergeStateStatus=DIRTY). Los archivos modificados por ambas ramas desde d1d3542 son backend/src/server.js y docs/estado-proyecto.md: develop añadió la composición de frecuencias y actualizaciones del registro compartido. No se ejecutó merge/rebase ni se resolvieron esos cambios de otros módulos incidentalmente. La revisión puede comenzar, pero la integración queda pendiente de conciliar esos archivos y volver a comprobar la combinación. Las 985 pruebas corresponden al contenido de Fleet verificado antes de publicar, no a una combinación con develop.
