# Crear el primer administrador del sistema

Procedimiento AUTH-BOOTSTRAP-01. Ejecutarlo una vez por base de datos desde una terminal del operador con acceso al backend.

## Preparación
Usar Node.js 24 y las dependencias del proyecto instaladas. PostgreSQL debe estar disponible. Configurar `DATABASE_URL` en el entorno del proceso para la base que se quiere inicializar. El comando no carga archivos `.env` ni muestra la URL; no guardar credenciales en Git.

Desde la raíz del repositorio:

```sh
cd backend
npm run migrate
npm run bootstrap:admin
```

El comando solicita:
- Email: se recortan espacios exteriores y se convierte a minúsculas.
- Contraseña: entre 15 y 128 caracteres; conserva espacios y no se muestra mientras se escribe. Confirmar la entrada con Enter. Ctrl+C cancela.

No se entrega una contraseña predeterminada. Este procedimiento sirve en terminales de Linux y Windows compatibles con Node; la verificación automatizada se realizó en Linux.

## Resultado
- Si no hay SYSTEM_ADMIN y el email está libre, crea el administrador con contraseña Argon2id y sin cooperativa.
- Si ya existe cualquier SYSTEM_ADMIN, informa que no hubo cambios. No cambia su email, rol ni contraseña, aunque se proporcionen otros datos válidos.
- Si el email pertenece a otro usuario, rechaza el alta y conserva esa cuenta.
- Dos ejecuciones simultáneas se serializan mediante una transacción y un bloqueo de escrituras en users. No se crean dos administradores por este mecanismo.
- El código de salida es 0 al crear o al detectar un administrador existente; 1 ante un error. Los errores no imprimen detalles de conexión ni credenciales.

Si falla, revisar datos, conexión, migraciones y disponibilidad del email. Repetir este comando no sirve para recuperar una contraseña ni convertir una cuenta existente.

## Acceso posterior
Iniciar sesión mediante el login existente (`POST /api/v1/auth/login`), con cookies y CSRF obtenidos de `/api/v1/auth/csrf`. Renovar CSRF después del login. `/api/v1/auth/me` debe mostrar SYSTEM_ADMIN y cooperative_id nulo.
Puede crear una cooperativa con `POST /api/v1/cooperatives`. El alta de su administrador operativo requiere integrar AUTH-05, que se desarrolla en una rama separada.

## Automatización
Sin terminal interactiva, el comando lee un único objeto JSON con `email` y `password` por entrada estándar. Un gestor de secretos o proceso autorizado puede suministrarlo por un pipe; no pasar la contraseña como argumento ni escribirla en comandos que queden en el historial. La entrada máxima es 4096 bytes. No ejecutarlo con datos reales en herramientas que registren el contenido de la entrada.
