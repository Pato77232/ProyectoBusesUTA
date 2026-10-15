# ADR 0003: Stack tecnológico

- **Estado:** Propuesta (pendiente de aprobación del equipo)
- **Fecha:** 2026-10
- **Decidido por:** equipo

## Contexto
El equipo definió Node.js, Bootstrap y PostgreSQL, con todo containerizado en Docker. Falta concretar librerías y la forma del frontend.

## Decisión (propuesta)
- **Backend:** Node.js LTS con Express, `pg` (node-postgres) sin ORM y una herramienta de migraciones SQL (por ejemplo `node-pg-migrate`). Validación de entrada con una librería de esquemas (por ejemplo Zod). JWT para autenticación y bcrypt o argon2 para contraseñas.
- **Pruebas:** Jest. **Calidad:** ESLint y Prettier.
- **Frontend:** Bootstrap 5 con HTML y JavaScript (módulos ES), servido por su propio contenedor y consumiendo `/api/v1`.
- **Base de datos:** PostgreSQL con versión fija en Docker Compose.

## Alternativas consideradas
- **ORM (Prisma, Sequelize):** acelera el CRUD, pero tiende a filtrar el modelo de persistencia al dominio y dificulta mantener la arquitectura limpia.
- **Frontend con plantillas del servidor (EJS):** menos piezas, pero acopla vistas y backend.
- **Frontend SPA (React o Vue):** más potente, pero agrega curva de aprendizaje y herramientas fuera del stack acordado.

## Consecuencias
- Más SQL escrito a mano, pero con control total y dominio limpio.
- Las librerías concretas se pueden ajustar; lo que no cambia es la separación en capas.
- Cualquier dependencia nueva se justifica en el PR.
