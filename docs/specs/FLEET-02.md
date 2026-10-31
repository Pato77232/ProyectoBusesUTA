# FLEET-02: Registrar un bus

- **ID local:** FLEET-02 (nuevo identificador local, no ticket externo).
- **Responsable:** Edwin, responsable de Fleet.
- **Revisor propuesto:** David; aceptación pendiente.
- **Estado:** Borrador. No autoriza implementación.
- **Fecha:** 29 de octubre de 2026, America/Guayaquil.
- **Base comprobada:** origin/develop `f26415d`; rama `feature/FLEET-02-registro-buses`.
- **Autorización:** Edwin solicitó trabajar en buses y asientos; esta primera tarea prepara el registro de un bus. Las decisiones indicadas como propuestas no están aprobadas.
- **Dependencias:** FLEET-01, auth, cooperativas, [FLEET-03: catálogo de plantillas](FLEET-03.md) (borrador) y acuerdos de datos/fotografías de esta spec.

## 1. Objetivo

Permitir al administrador operativo registrar un bus real de su cooperativa. Es el primer incremento para que hojas de ruta pueda consultar buses y reservas pueda obtener posteriormente su inventario de asientos. Crear un bus no acredita por sí solo disponibilidad por viaje.

## 2. Reglas de negocio

- RN-01: permisos comprobados en backend.
- RN-02: cooperativa obtenida de la identidad autenticada y verificada; no del cuerpo.
- RN-10: chasis, marca de carrocería, color y fotografías obligatorios.
- RN-11: los buses se organizan mediante grupos existentes de su cooperativa.
- RN-12: cada bus tiene una plantilla visual de asientos. Edwin confirmó elegirla al registrar el bus y exigirla antes de habilitarlo para viajes.

## 3. Alcance propuesto

**Incluye:** un caso de uso de registro, persistencia mediante migraciones nuevas, validación, permisos, CSRF y pruebas. La forma de adjuntar fotografías se cerrará antes de implementar.

**Fuera de este incremento:** listar/consultar buses por HTTP o API pública, edición y eliminación, frontend, definir/consultar plantillas, viajes, disponibilidad, reservas y cambios en módulos ajenos. Estos resultados necesitan tareas separadas; no se implementa Fleet completo en una sola sesión.

## 4. Flujo propuesto

1. Autenticar y autorizar al administrador operativo; verificar CSRF.
2. Validar el contrato de entrada acordado, rechazando campos extra e identidad de cooperativa aportada por el cliente.
3. Verificar que el grupo pertenece a la cooperativa autenticada.
4. Validar los datos RN-10 y las fotografías según el contrato pendiente.
5. Persistir el bus y sus referencias de archivos de forma consistente.
6. Devolver la identidad del bus sin rutas internas de almacenamiento.

## 5. Datos y contratos pendientes

| Dato | Fuente o propuesta | Decisión pendiente |
|---|---|---|
| Chasis | Número identificador VIN del chasis, obligatorio conforme a RN-10; Edwin confirmó unicidad global | Formato y normalización |
| Marca de carrocería | Obligatoria, RN-10 | Texto libre o catálogo |
| Color | Obligatorio, RN-10 | Texto libre o catálogo |
| Fotografías | RN-10; Edwin confirmó de 1 a 10 por bus, JPEG o PNG, hasta 5 MB por archivo y almacenamiento local persistente | Forma de carga/entrega y recuperación ante fallos |
| Cooperativa | Edwin confirma que cada bus solo puede estar registrado en una cooperativa; identidad obtenida del servidor. Placa y VIN únicos globalmente impiden repetir esos identificadores en otra cooperativa | Sin decisión pendiente sobre pertenencia o ámbito de unicidad |
| Grupo | RN-11 y FLEET-01 definen LONG_ROUTE, CANTONAL y URBAN_RURAL | Edwin sugirió uno/dos pisos o con/sin paradas; resolver la clasificación sin reemplazar silenciosamente RN-11. Confirmar pertenencia a un único grupo al alta |
| Placa y número de unidad | Obligatorios; placa única en todo el sistema y número de unidad único por cooperativa, confirmado por Edwin | Formato y normalización de ambos identificadores |
| Identidad del bus | Propuesta: UUID generado por servidor | Contrato compartido con David y Leslie |
| Plantilla | Edwin confirma que se elige una plantilla existente al registrar el bus y debe estar asignada antes de habilitarlo para viajes | Definir catálogo, propiedad, copia o vínculo y contrato con Leslie y David; la capacidad proviene de la plantilla, no de una cantidad fija por piso |

No fijar nombres definitivos de campos, restricciones de negocio ni esquema hasta resolver estas decisiones. Usar una migración nueva posterior a todas las existentes en la base elegida; no renombrar ni editar migraciones de pagos ni desactivar el control de orden.

## 6. Endpoint propuesto

`POST /api/v1/buses`, rol `COOPERATIVE_ADMIN`. Propuesta de respuestas: 201, 400, 401, 403 y 409 por conflicto de placa, VIN o número de unidad según los ámbitos acordados. El conflicto no debe revelar datos ni la cooperativa propietaria de otro bus. La entrada JSON/multipart y los errores por archivos quedan pendientes del flujo de fotografías.

## 7. Criterios de aceptación propuestos

- Administrador autorizado, CSRF y datos completos: un bus persistido en su cooperativa.
- Sin sesión válida, con otro rol o CSRF inválido: rechazo sin escrituras ni archivos huérfanos.
- Grupo ajeno o inexistente: rechazo sin revelar datos de otra cooperativa.
- Datos RN-10 ausentes o campos extra: rechazo sin persistencia parcial.
- Archivo inválido o fallo de almacenamiento/persistencia: resultado consistente y limpieza verificable según el contrato acordado.
- Fotografías: aceptar entre 1 y 10 archivos JPEG o PNG, cada uno de hasta 5 MB; rechazar ausencia de fotos, exceso de cantidad, otro formato o tamaño superior sin persistencia parcial. Verificar el contenido del archivo, no solo su extensión o el tipo declarado por el cliente.
- Placa o VIN repetido: rechazar, aunque el bus se intente registrar en otra cooperativa, sin revelar datos del registro existente.
- Número de unidad repetido en la misma cooperativa: rechazar. El mismo número en cooperativas distintas está permitido si placa y VIN son distintos.
- Concurrencia: ante registros con la misma placa, el mismo VIN o el mismo número de unidad dentro de una cooperativa, solo uno puede persistir; imponer la unicidad en PostgreSQL, no únicamente con una consulta previa.
- Migración reversible y reaplicable sin asumir que Fleet es la última del proyecto.
- Exigir selección de una plantilla existente al registrar el bus; no ofrecer inventario ni habilitarlo para viajes sin la plantilla exigida por RN-12. Implementación pendiente del contrato y del catálogo real de plantillas, no de datos ficticios.

## 8. Acuerdos necesarios

### Decisión: pertenencia e identificación del bus

- **Estado:** acuerdo parcial confirmado por Edwin el 29 de octubre de 2026.
- **Respuesta humana:** un bus solo puede estar registrado en una cooperativa; placa y número de unidad son obligatorios para control de unidades y auditorías.
- **Aclaración y decisión de Edwin:** chasis significa número identificador VIN, no marca. Tras considerar usar solo placa, confirmó conservar el VIN del chasis obligatorio conforme a RN-10 el 29 de octubre de 2026. Queda descartada la propuesta de omitirlo o hacerlo opcional; no se cambia RN-10.
- **Fuente de validación:** su referencia anterior a la ANT era una duda, no una fuente verificada ni un requisito de integración. No se añade consulta a la ANT.
- **Control de duplicados confirmado por Edwin:** placa y VIN únicos en todo el sistema; número de unidad único dentro de cada cooperativa. Ejemplo explícito aprobado: puede existir una unidad 1 de Cooperativa Loja y otra unidad 1 de Cooperativa Santa, con placas y VIN diferentes.
- **Persistencia prevista:** restricciones únicas globales para placa y VIN y restricción única compuesta para cooperativa/número de unidad, mediante una migración nueva. Normalización y formatos se documentarán antes de implementar; no inferirlos de la unicidad.
- **Clasificación pendiente:** Edwin sugirió grupos por uno/dos pisos o con/sin paradas. RN-11 y FLEET-01 ya establecen categorías operativas LONG_ROUTE, CANTONAL y URBAN_RURAL; RN-12 describe pisos/distribución de plantilla y RN-22 describe paradas de la frecuencia. Propuesta: conservar los grupos RN-11, expresar pisos en la plantilla y mantener las paradas en frecuencias. Si se desea otra clasificación de grupos, acordar primero el cambio de RN/specs y el impacto en datos existentes; este borrador no lo autoriza.
- **Pendiente:** número de grupos por bus, normalización/formato de cada identificador y representación de marca de carrocería/color (texto o catálogo).
- **Impacto:** validar campos obligatorios y pertenencia; verificar unicidad global y por cooperativa, concurrencia y errores sin filtración de información.

### Decisión: almacenamiento de fotografías

- **Estado:** opción local confirmada por Edwin el 29 de octubre de 2026.
- **Respuesta humana:** tras reconsiderar la propuesta externa y comparar opciones, Edwin confirmó fotos en una carpeta persistente de su laptop conectada al backend mediante un volumen Docker, con referencias en PostgreSQL.
- **Decisión:** almacenamiento de archivos local persistente mediante un puerto de almacenamiento. La carpeta está fuera de la imagen del contenedor; reconstruirlo no debe eliminar las fotografías. No se contrata un proveedor externo en este alcance.
- **Operación:** al desplegar en otro servidor se deben trasladar los archivos y respaldar tanto la base como la carpeta. No versionar fotografías cargadas ni datos reales. La ruta concreta se definirá al implementar la configuración, sin leer archivos `.env`.
- **Límites confirmados por Edwin:** entre 1 y 10 imágenes por bus, formatos JPEG o PNG y hasta 5 MB por archivo. Confirmación explícita del 29 de octubre de 2026. Estos límites no aprueban la implementación completa.
- **Pendiente:** forma de carga/entrega y recuperación ante fallos. Al precisar el contrato técnico se documentará el tamaño exacto en bytes para aplicar el mismo límite en validación y pruebas.
- **Prueba prevista:** cargar fotografías de prueba, recrear el contenedor sin eliminar el almacenamiento persistente y verificar archivos/referencias. Probar fallos de almacenamiento y persistencia conforme al flujo acordado.
- **Casos de límites:** 0, 1, 10 y 11 archivos; JPEG/PNG válidos, contenido de otro formato aunque tenga extensión permitida, archivo exactamente en el límite de tamaño y archivo que lo supera.

### Inventario de asientos para reservas y hojas de ruta

- **Estado:** selección de plantilla al alta confirmada por Edwin; contrato compartido pendiente de Leslie y David.
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

1. Resolver preguntas, registrar respuestas humanas y aprobar el alcance/revisión.
2. Dominio y caso de uso con pruebas de reglas y puertos simulados.
3. Migración nueva, repositorio y flujo de fotografías acordado, con pruebas PostgreSQL y de fallos parciales. Cubrir duplicados de placa/VIN entre cooperativas, unidad repetida dentro de una cooperativa, unidad 1 válida en Loja y Santa y conflictos concurrentes para cada restricción.
4. Endpoint y composición mínima con pruebas de sesión, rol, CSRF y aislamiento.
5. Ejecutar lint, formato, unitarias e integración con PostgreSQL aislado según `docs/testing-database.md`; verificar arranque si cambia composición.

Cada paso de implementación se autoriza y entrega por separado. Conservar pruebas anteriores y reportar fallos reales. No instalar dependencias sin avisar y justificar.

## 11. Defectos inducidos

No aplica. No se propone ni autoriza ningún defecto académico.

## 12. Evidencia y cierre

29 de octubre: preparación documental sobre `f26415d`, sin código, migraciones ni nuevas dependencias. Registradas las confirmaciones de Edwin sobre cooperativa única, placa/unidad obligatorias y almacenamiento local persistente de fotografías. Sin pruebas de producto ejecutadas para esta tarea; aún no hay implementación. Revisión humana, decisiones restantes, commit y PR pendientes. No marcar Integrada ni Cerrada.

30 de octubre: revisión de Git autorizada por Edwin. Rama local `feature/FLEET-02-registro-buses`, base `f26415d`, solo documentación sin commit. Fetch comprobó origin/develop `1d9381d`, dos commits posteriores relativos a la caché CSRF del frontend y su documentación; incluye cambios al registro de estado compartido. No se incorporaron al checkout ni se realizaron merge/rebase/push/commits. La PR #24 está integrada y #25 (arranque de frecuencias) está abierta al consultar. `git diff --check` sin errores. Esta revisión es documental y de historial; no se ejecutaron pruebas de producto ni se acredita una implementación nueva de Fleet.

Preparada el 30 de octubre la spec separada [FLEET-03](FLEET-03.md), en borrador, para catálogo/consulta de plantillas como dependencia del alta. No incluye persistir configuración por bus ni la pantalla. El acuerdo conceptual no sustituye el contrato real con Leslie y David ni autoriza tablas de otros módulos.
