# INFRA-05: diagnóstico seguro de migraciones en pruebas

- **Módulo / responsable:** herramientas de desarrollo / David, por solicitud de sección 4.
- **Estado:** implementación técnica autorizada por el solicitante; revisión humana pendiente.
- **Revisión propuesta:** Edwin, según propuesta original; sin aceptación atribuida.
- **Fecha:** 4 de noviembre de 2026, America/Guayaquil.
- **Base:** última conocida `d7ea282`; Git exclusivamente humano, sin nueva consulta.
- **Referencia:** sección 4 de [SEARCH-01](SEARCH-01.md). Sin ticket externo inventado.

## Objetivo y alcance

Identificar etapa, migración, duración y código de un fallo sin exponer URL,
credenciales, SQL, stack o datos del motor. El CLI productivo conserva sus mensajes
y contrato. Se añade un comando de diagnóstico solo para bases terminadas en
`_test` y `NODE_ENV=test`, aplicando el guard existente antes de conectarse.

Tres suites históricamente afectadas aprobaron 36/36 sobre PostgreSQL 16.13 limpio
en Windows/Node 24.22.2; no se reproduce todavía el fallo histórico ni se atribuye
a Windows o timeout. Algunas migraciones rechazan down con datos deliberadamente.
El diagnóstico debe distinguir rechazo de conexión, catálogo, bloqueo y SQLSTATE.

## Contrato técnico autorizado

- `node scripts/diagnose-migrations.js status`: consulta historial; no cambia esquema.
- `node scripts/diagnose-migrations.js up`: ejecuta el migrador existente.
- `node scripts/diagnose-migrations.js down <nombre-activo>`: revierte una migración
  por vez, hasta incluir el objetivo. Exige objetivo explícito instalado y válido.
- Produce JSON con `ok`, `stage`, pasos completados, nombre activo y tiempo por
  paso. Up informa el lote de nombres pendientes; down identifica cada migración.
  Un fallo incluye código seguro y conserva los pasos anteriores completados.
- Finaliza al primer error, con salida no cero. No limpia datos, no reintenta,
  no ignora guards ni modifica archivos/historial/esquema mediante SQL propio.
- Down es destructivo para la base de prueba: solo entorno efímero dedicado.
  Cada migración conserva su transacción; un fallo no revierte pasos anteriores.
  No hay restauración automática; reaplicar con up cuando corresponda.
- No se cambia ningún timeout ni dependencia, migración existente, pruebas previas,
  configuración global, negocio o composición del servidor.

## Aceptación y pruebas

1. Entorno no test, URL inválida, dirección u objetivo inválido: rechazo antes de conexión.
2. Status no ejecuta migraciones; reporta solo nombres validados contra catálogo.
3. Up/down/up en base efímera mantiene el historial esperado.
4. Una acreditación persistida hace rechazar down en su migración protectora;
   el diagnóstico identifica nombre/código y los datos/historial de ese paso se conservan.
5. Mensajes que contengan URL, SQL o secretos no se incluyen en JSON, incluso en
   fallos de conexión o de consulta. El error no expone propiedades del objeto original.

Pruebas unitarias de validación/redacción y PostgreSQL aislado con CLI real.
Backend lint, formato y npm test; arranque adicional no necesario al no modificar
composición. SOLID proporcional: diagnóstico orquesta el migrador y guard ya
existentes; no replica su DDL, catálogo o bloqueos. Sin interfaz visual.

## Límites, trazabilidad y revisión

No se debilitan pruebas ni guards para obtener verde. Se preserva la evidencia
histórica de 30 fallos y la repetición posterior aprobada de 686 integraciones.
El rechazo controlado con datos prueba el diagnóstico, no demuestra que fuera
la causa exacta de los 30 fallos históricos. Formato global se verifica antes de
considerarlo deuda actual. Sin defecto inducido, Git o mensajes enviados a terceros.
Asistencia de Codex en herramientas, verificación y documentación.

## Evidencia de ejecución

Windows, Node 24.22.2 y PostgreSQL 16.13 efímero, proyecto Compose
`migraciones-seccion4` con `--env-file NUL`; sin lectura de `.env` ni instalación
de dependencias. Resultados reales del 4 de noviembre:

- Reproducción de tres suites previas: 36/36 integraciones aprobadas en 56,284 s.
- Diagnóstico dirigido: 12/12 unitarias y 2/2 integraciones CLI/PostgreSQL reales.
- `npm run lint` y `npm run format:check` globales: aprobados.
- `npm test` completo: **2029/2029 unitarias (117 suites)** y **688/688 integraciones
  (63 suites)**, integración en 314,885 segundos. Sin interrupciones en esta ejecución.
- El caso protector devuelve `stage: down`, migración
  `1794260000000-booking-benefit-reviews` y `P0001`. Conserva filas e historial de
  ese paso; reaplicar up conserva la auditoría. Los pasos anteriores sí quedan
  revertidos, según contrato. La base propia de la prueba se elimina al finalizar.
- Enlaces locales de documentación nueva contrastados; archivos de herramienta,
  pruebas y documentación revisados por lectura. Sin Git por instrucción humana.

No se reproduce la causa de los 30 fallos históricos; no se atribuye una corrección
de Windows, limpieza pendiente o timeout. Formato global no presenta deuda en esta
ejecución. No se repiten frontend/navegador ni arranque adicional, porque la nueva
herramienta no cambia UI o composición. Se retira el entorno temporal al terminar.
Revisión humana, integración y comparación de la rama por el humano pendientes.

Commit sugerido: `feat(infra): agrega diagnóstico seguro de migraciones de prueba`.
Referencia: `Refs: docs/specs/INFRA-05.md`. Texto de PR preparado en
[Markdown](../evidence/SEARCH-01/descripcion-pr.md), sujeto al diff que compruebe
el humano antes de publicarlo.
