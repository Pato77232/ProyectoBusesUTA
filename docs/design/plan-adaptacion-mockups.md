# Plan de adaptación de mockups e identidad

- Fecha: 25 de octubre de 2026.
- Solicitante y coordinador de referencia: Pablo.
- Estado: **Identidad confirmada por Pablo; referencias y adaptación de T1 implementadas localmente. Revisión e integración pendientes**.
- Contexto local: `feature/FRONT-01-base-compartida`, T1 implementada, con commits autorizados por Pablo; T2–T4 pendientes. No se actualizó la referencia remota de develop en esta revisión documental.
- Alcance inicial: inspeccionar las ocho páginas del PDF y preparar este plan. Tras revisarlo, Pablo confirmó nombre, logo y paleta, y delegó la decisión de conservar referencias. Se incorporan originales y catálogo; HTML, CSS, favicon y backend siguen sin cambios en este incremento.

## 1. Qué aporta cada fuente

| Fuente | Uso propuesto | Límite |
|---|---|---|
| business-rules.md, specs y ADR | Comportamiento, roles, contratos y alcance autorizado | Una pantalla no sustituye ni modifica estas reglas |
| Mockups aportados | Organización de información, recorrido y componentes por pantalla | Los ejemplos, botones, tarifas y temporizadores no son requisitos aprobados |
| frontend/DESIGN.md | Tokens, tipografía, espaciado, superficies y estados accesibles | Identidad y paleta confirmadas por Pablo; revisar usabilidad y ampliar con cada pantalla |
| Logo transViaje aportado | Logo definitivo confirmado por Pablo | Preparar derivados de uso sin sustituir el original |
| Referencia visual ClickUp | Antecedente de la guía adaptada | No incorpora marca ni funcionalidades de ClickUp |

Decisión confirmada por Pablo: nombre público transViaje, logo aportado definitivo y paleta blanco/negro/violeta. Los mockups son únicamente guía, sin exigir reproducción exacta. El logo monocromático puede convivir con esa paleta sin recolorearlo. Usar Bootstrap 5 y CSS compartido; no cambiar de framework ni reconstruir todas las pantallas en T1.

## 2. Fuentes inspeccionadas y estructura prevista

PDF original recibido: `Mockups – Venta de Pasajes Interprovincial (1).pdf`, ocho páginas, 2549207 bytes. SHA-256: `54aa608f720076dff14d06e466b4932986460d6f4a6f1fb091ca5a4971ac7de2`.

Logo recibido: PNG 1600 × 1446, bus con carretera/localizador y texto «transViaje». Presenta fondo claro y amplios márgenes; no se debe dar por hecho que sea transparente ni que exista un SVG. SHA-256: `1bf553b535b0fbbf0d2ffdba7289fb57e31ad078da02af64022e39e34f7e6889`.

Estructura incorporada tras la confirmación de Pablo y la posterior adaptación de identidad:

```text
docs/design/
  plan-adaptacion-mockups.md
  README.md                       # catálogo, fuentes, fechas, estado y huellas
  references/
    clickup-style-reference.md     # antecedente existente
    mockups-transviaje-original.pdf
    logo-transviaje-original.png
  pantallas.md                    # matriz página → RN → spec → estado → evidencia
frontend/
  DESIGN.md                       # decisiones visuales adoptadas y excepciones
  assets/brand/                   # solo derivados aprobados que use la aplicación
    README.md                     # origen, transformación y condiciones de uso
```

Los originales, README y catálogo ya están incorporados localmente; assets/brand y el favicon derivado se incorporaron después, por instrucción de continuar de Pablo. El PDF original de unos 2,55 MB puede versionarse directamente en Git sin introducir Git LFS por esta entrega. No guardar todas las capturas del PDF o perfiles de navegador como recursos de producción. Si aparece el archivo editable de origen, registrarlo como fuente adicional sin sobrescribir el PDF recibido.

## 3. Matriz de adaptación por página

La matriz se mantiene en [pantallas.md](pantallas.md), como catálogo orientativo y sin duplicar su estado aquí. Ninguna de sus páginas obliga a implementar un recorrido.

## 4. Tratamiento propuesto del logo

1. Conservar el PNG recibido sin modificar como fuente documental, con procedencia «aportado por Pablo» y fecha. Autoría y condiciones de uso se registran cuando se conozcan; no atribuirle una licencia por suponerla.
2. Usar el nombre público **transViaje**, confirmado por Pablo, y el logo aportado como definitivo. Puede mantenerse ProyectoBusesUTA como nombre técnico del repositorio: cambiar la marca no obliga a renombrar paquetes, base de datos o módulos.
3. Si se dispone del original vectorial, usarlo tras inspección. Si solo hay PNG, preparar más adelante un recurso recortado/optimizado que preserve el original. No renombrar el PNG como SVG ni presentar un trazado aproximado como original.
4. Revisar legibilidad del logotipo completo en encabezado y móvil. Para favicon o símbolo pequeño, proponer una variante simplificada con revisión humana; el detalle del bus y la palabra completa pueden perderse a 16–32 px.
5. Decidir con evidencia si hace falta transparencia; el fondo visible actual no debe verse como un rectángulo distinto sobre las superficies. No modificar el logo en esta etapa de planificación.
6. Documentar archivo fuente, transformación, derivado, responsable y aprobación en assets/brand/README.md. En HTML, usar dimensiones y texto alternativo adecuado; evitar anunciar el nombre dos veces si hay texto contiguo equivalente.

## 5. Incrementos pequeños y orden recomendado

| Paso | Resultado revisable | Situación |
|---|---|---|
| P1: revisar este plan | Confirmar identidad, relación mockups/guía y alcance diferido | Nombre, logo y paleta confirmados por Pablo; mockups solo guía |
| P2: incorporar fuentes y catálogo | Originales, hashes, matriz y vínculos desde DESIGN.md/FRONT-01; constancia real del acuerdo | Completado localmente; guardado en los commits autorizados, sin integración |
| P3: ajustar solo la identidad de T1 | Marca/logo aprobados en la portada actual, metadatos y favicon derivado; recursos locales y pruebas | Implementado localmente tras instrucción de Pablo; sin formularios ni pantallas del PDF, pendiente de revisión e integración |
| P4: continuar FRONT-01 | T2 proxy/entorno local, luego T3 cliente común y T4 integración, con revisión por incremento | No saltarse cookies/CSRF por tener un mockup |
| P5: primera pantalla real | Spec de login basada en M-01 y contrato de autenticación | Tarea/feature separada al comenzar; después registro y administración de cooperativas como tareas propias |
| P6: pantallas del resto del equipo | Una tarea pequeña con spec por recorrido y contrato listo | Coordinar dependencias antes de asignar fechas; no dividir solo por la página del PDF |

SOLID proporcional: la presentación consume el cliente API común y operaciones pequeñas. No replica descuentos, vencimiento, permisos o disponibilidad del backend. Compartir tokens y patrones; no crear un sistema genérico de componentes sin necesidad ni añadir dependencias por imitar el mockup.

## 6. Trazabilidad y revisión

Cadena propuesta: **archivo original + página M-xx → decisión documentada → RN y spec de la pantalla → rama/commit → pruebas y capturas → PR/revisión humana → evidencia en develop**.

Cada fila del catálogo registrará: fuente/página, objetivo, rol, reglas aplicables, diferencias respecto del original, spec, coordinación/revisor por confirmar, estado, enlaces a código/pruebas y commit/PR cuando existan. Un dato desconocido queda pendiente; no se inventa.

Al cambiar un mockup, conservar la fuente previa y registrar cuál sustituye y por qué. No es necesario numerar DESIGN.md con SemVer ni cambiar la versión del producto por cada edición del documento. Sin Jira, el ID de spec es la referencia local; M-xx solo localiza una pantalla.

Después de autorizar los cambios, commits sugeridos por tema:

- `docs(diseno): incorpora las referencias y la matriz de pantallas`
- `feat(interfaz): integra la identidad visual acordada`

Cada commit referenciará la spec que realmente autorice su alcance. No tratar esta propuesta como autorización de commit/push; Pablo autorizó posteriormente guardar T1 con commits atómicos; se separan recursos de terceros, documentación visual e implementación con pruebas, sin atribuirle un historial previo inexistente. No se obliga a abrir una rama por documento. Nuevas pantallas posteriores tendrán su spec y rama de trabajo conforme a Gitflow.

## 7. Comprobaciones previstas para la implementación

- Recursos locales, integridad y ausencia de enlaces a funciones no disponibles.
- Marca consistente en título, encabezado, descripciones y variantes aprobadas.
- 360/1280 px, zoom nativo 200 %, teclado, foco y etiquetas; contraste de texto e indicadores. Tablas adaptadas y asientos identificables sin depender del color.
- Pantallas con carga, vacío, errores, expiración y falta de permisos según su contrato; datos ilustrativos solo en fixtures/demostraciones explícitas.
- Cookies/CSRF y aislamiento multi-tenant verificados cuando exista integración; visibilidad del menú no sustituye autorización.
- Ejecutar pruebas pertinentes y lint/formato del repositorio; informar el resultado real, incluidos los 26 fallos de formato preexistentes si siguen presentes.
- Revisar imágenes de antes/después por pantalla y registrar la respuesta humana, sin asumir aprobación por pasar pruebas.

## 8. Decisiones confirmadas y siguiente paso

Pablo aclaró en este chat: los mockups son solo guía, el sistema se llamará transViaje, el logo adjunto será definitivo y se usará blanco/negro/violeta. Delegó a Codex decidir si convenía guardar las referencias. Se decidió conservarlas por su procedencia y trazabilidad, claramente marcadas como orientativas; esto no añade requisitos ni aceptación individual de los demás integrantes.

Pablo autorizó después continuar con la adaptación de la identidad de T1. Ya se incorporó localmente; el siguiente paso es revisar el resultado y guardar los commits autorizados por Pablo. No hace falta volver a elegir nombre, logo o paleta. Las pantallas y funciones futuras mantienen su flujo de spec y revisión.

Wallet, venta en caja, recuperación de contraseña y panel ITIL no necesitan resolverse para catalogar las referencias o revisar la identidad. Sus decisiones se posponen hasta las specs que dependan de ellas.

## Evidencia de esta sesión

Inspección de las ocho páginas renderizadas y extracción de texto con Poppler, contraste con business-rules.md, specs AUTH y estado local. Huellas SHA-256 calculadas sobre ambos originales. Solo se añadió este plan; no se alteraron los adjuntos ni la aplicación. Las imágenes de inspección están fuera del repositorio, en el directorio temporal. No se ejecutaron pruebas de producto porque no cambió código; tampoco se repitieron ni se presentan como nuevas las comprobaciones previas de T1.


### Incorporación documental posterior

Se copiaron PDF y PNG sin alteraciones y se verificaron sus SHA-256. Se añadió README de procedencia, catálogo de pantallas y vínculos desde DESIGN.md, FRONT-01 y estado. El análisis inicial se conserva como antecedente; la incorporación documental no equivale a implementar identidad o pantallas. No se hizo commit ni push. Solo se comprobaron integridad, enlaces y diff en este incremento documental; no se volvió a ejecutar la suite de producto.


### Adaptación de identidad implementada después

Pablo solicitó «hazlo» después de proponer adaptar la portada. Se actualizan título, descripción, encabezado, panel conceptual y pie a transViaje. El logo usa una copia exacta del PNG con encuadre CSS; favicon por encuadre del mismo PNG incrustado en SVG. No se generó un logo distinto ni se alteró el original. Procedencia y límites en frontend/assets/brand/README.md; resultados de la ejecución en FRONT-01, sección 16. Sin T2, commits ni push.


### Preparación de commits autorizada

Pablo solicitó explícitamente commits atómicos. Se separan recursos locales de terceros, documentación/referencias visuales y la portada con pruebas y registro de estado. Las frases «sin commits» de los antecedentes describen el momento de esas sesiones, no la autorización actual. No se hace push ni se declara integración.
