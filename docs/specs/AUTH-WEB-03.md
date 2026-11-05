# AUTH-WEB-03: altas administrativas desde la web

- **Responsable:** Pablo.
- **Estado:** contrato aprobado por Pablo el 4 de noviembre de 2026; implementación pendiente.
- **Base comprobada:** `origin/develop` `d7ea282`, 4 de noviembre de 2026; rama `feature/AUTH-WEB-03-administracion`.
- **Reglas:** RN-01/02/03, [TENANTS-01](TENANTS-01.md), [AUTH-05](AUTH-05.md), [AUTH-06](AUTH-06.md), [ADR 0004](../adr/0004-autenticacion-sesiones-credenciales.md).
- **Diseño:** aplicar `frontend/DESIGN.md` D-02, D-03, D-04 y D-07: tipografía y colores existentes, tarjetas sencillas, etiquetas, foco visible, mensajes en vivo y reflujo móvil. Sin dependencias visuales nuevas.

## Objetivo y decisiones

Permitir completar desde la web las tres altas que hoy solo tienen API: una
cooperativa, su administrador principal y un oficinista. Pablo confirmó agregar
consulta de cooperativas para elegir una existente al asignar administrador.
El backend sigue siendo la autoridad de rol y cooperativa; ocultar un enlace o
formulario en el cliente no sustituye la autorización del servidor.

## Contratos existentes que se reutilizan

| Acción | Endpoint | Rol | Entrada y resultado |
|---|---|---|---|
| Crear cooperativa | `POST /api/v1/cooperatives` | `SYSTEM_ADMIN` | `name`, `ruc`, `email`, `phone`, `address`; `201 {cooperative}`. Nombre y RUC obligatorios; RUC de 13 dígitos. |
| Crear administrador principal | `POST /api/v1/cooperatives/:cooperativeId/admins` | `SYSTEM_ADMIN` | `email`, `password`; `201 {user}`. Una cuenta nueva por cooperativa; conflicto `409`. |
| Crear oficinista | `POST /api/v1/auth/clerks` | `COOPERATIVE_ADMIN` | `email`, `password`; `201 {user}`. La cooperativa se obtiene de la sesión, nunca del formulario. |

Las tres escrituras usan sesión y CSRF mediante el cliente HTTP compartido.
Las contraseñas siguen la política de Auth: 15–128 puntos de código, sin recortar,
con confirmación en pantalla. No se guardan en almacenamiento del navegador, no
se muestran después del envío y no se mandan por correo. La creación no inicia
sesión para la cuenta nueva.

## Consulta nueva aprobada

`GET /api/v1/cooperatives`, exclusivamente `SYSTEM_ADMIN` con sesión vigente,
devuelve `200 { cooperatives: [{ id, name, ruc }] }`, ordenadas por nombre e ID.
No expone datos de contacto, usuarios ni credenciales. La respuesta lleva
`Cache-Control: no-store`. Sin sesión devuelve `401`; otro rol, `403`.
La consulta es global únicamente para la administración autorizada por RN-03;
no habilita lectura de cooperativas para usuarios internos. Se implementa en
Tenants con caso de uso y puerto de repositorio; HTTP solo traduce la petición.
No se añade edición, eliminación ni búsqueda pública. Si el tamaño del catálogo
requiere paginación, se acordará en otra spec antes de ampliar este contrato.

## Pantallas aprobadas

1. `pages/cooperativas.html`: `SYSTEM_ADMIN` consulta el catálogo y registra
   cooperativas. Muestra el ID y los datos devueltos por el servidor al crear;
   el nuevo registro queda disponible para asignar administrador. Estado vacío,
   carga, error y éxito son distinguibles. Un resultado incierto no repite el
   `POST` automáticamente.
2. `pages/administrador-cooperativa.html`: `SYSTEM_ADMIN` elige cooperativa del
   catálogo, introduce correo, contraseña y confirmación y registra su
   administrador principal. El formulario no acepta rol ni `cooperative_id` en
   el cuerpo. Tras `201` muestra identidad pública y cooperativa; ante `409`
   indica que no se pudo completar el alta y conserva la selección. Si se abre
   desde el alta de una cooperativa, su ID puede precargar la selección solo si
   consta en el catálogo recibido del servidor.
3. `pages/oficinistas.html`: `COOPERATIVE_ADMIN` crea oficinistas con correo,
   contraseña y confirmación. Muestra su cooperativa de la identidad verificada
   solo como contexto; no permite elegirla ni enviarla. Tras `201` muestra la
   identidad pública; permite otra alta con campos sensibles vacíos.

Cada pantalla consulta `GET /api/v1/auth/me` antes de habilitar el formulario y
presenta acceso denegado si el rol no corresponde. En `401`, ofrece ir al login
sin conservar contraseñas. El login enlaza la pantalla adecuada tras confirmar
la sesión, según el rol devuelto por `/auth/me`. La autorización real permanece
en cada endpoint. Se usa el cliente HTTP y el proxy existentes; la imagen
frontend copia las páginas y módulos nuevos.

## Errores y usabilidad

- Validar en cliente campos obligatorios, correo, RUC, longitud y confirmación
  antes del envío; el backend vuelve a validarlos.
- Mensajes de `400`, `401`, `403`, `409`, error de red y respuesta incierta con
  texto útil, sin revelar contraseñas ni datos privados de otras cooperativas.
- Mientras se envía, deshabilitar duplicados. Ante respuesta incierta de un alta,
  indicar cómo comprobarla antes de reintentar: catálogo para cooperativa;
  revisión administrativa para cuentas, porque no existe listado de usuarios.
- Enlazar errores con el campo y mover el foco al mensaje o control pertinente;
  teclado y ancho móvil de 360 px utilizables.

## Incrementos y comprobación

1. Consulta de cooperativas con pruebas de rol, sesión, orden, proyección y
   ausencia de datos de contacto; integración PostgreSQL aislado.
2. Página de cooperativas con consulta y alta; pruebas de estados y errores.
3. Página de administrador principal con selección y alta; pruebas de permisos,
   `409`, validación y duplicados.
4. Página de oficinistas con alta ligada a la sesión; pruebas de rol, ausencia
   de tenant elegido y errores.
5. Navegación desde login, imagen frontend y recorrido real. Ejecutar
   `npm run lint`, `npm run format:check` y `npm test` en backend; lint y test
   frontend; construir la imagen y comprobar acceso/CSRF con servidor real.

No se introducen defectos académicos. No se modifican migraciones existentes ni
se añaden dependencias. Revisión humana e integración se registrarán con su
evidencia, sin inferir aprobación de otras personas.
