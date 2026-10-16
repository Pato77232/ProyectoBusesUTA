# Arquitectura

## 1. Estilo
Monolito modular con **arquitectura limpia**. Cada módulo funcional es dueño de sus cuatro capas. Un integrante del equipo es dueño de uno o varios módulos.

## 2. Estructura del repositorio
```
backend/
  src/
    modules/
      <modulo>/
        domain/           entidades, value objects, errores de dominio, puertos (interfaces)
        application/      casos de uso y DTOs
        infrastructure/   repositorios PostgreSQL, adaptadores externos
        interfaces/       http: rutas, controladores, esquemas de validación
        index.js          API pública del módulo
    shared/               config, logger, pool de BD, errores base, middlewares (auth, tenant, errores)
    app.js                composición de Express
    server.js             arranque
  migrations/             migraciones SQL versionadas
  tests/
    unit/<modulo>/
    integration/<modulo>/
frontend/                 Bootstrap 5 (ver ADR 0003)
docs/
docker-compose.yml
```

## 3. Módulos (propuesta)
| Módulo (carpeta) | Alcance de commit | Contenido |
|---|---|---|
| `auth` | `autenticacion` | Login, JWT, roles, invitados |
| `tenants` | `cooperativas` | Alta de cooperativas, configuración institucional |
| `fleet` | `flota` | Buses, grupos, fotos, plantillas de asientos |
| `frequencies` | `frecuencias` | Frecuencias, paradas, resolución ANT, estado |
| `route-sheets` | `hojas-ruta` | Hojas de ruta, días de parada, generación automática |
| `search` | `busqueda` | Búsqueda consolidada de viajes |
| `bookings` | `reservas` | Selección de asientos, pasajeros, descuentos, reserva y expiración |
| `payments` | `pagos` | Comprobantes, bandeja del oficinista, aprobación y rechazo |
| `tickets` | `boletos` | Emisión de boleto, QR, historial |

## 4. Reglas de dependencia
```
interfaces ─▶ application ─▶ domain ◀─ infrastructure
```
| Capa | Puede importar | No puede importar |
|---|---|---|
| `domain` | Solo JavaScript estándar y otros archivos de `domain` del mismo módulo | Express, `pg`, `application`, `infrastructure`, `interfaces`, otros módulos |
| `application` | `domain` del mismo módulo, `shared` | Express, `pg`, `infrastructure`, `interfaces` |
| `infrastructure` | `domain` (para implementar puertos), `shared`, librerías externas (`pg`) | `interfaces`, lógica de negocio |
| `interfaces` | `application`, `shared`, Express | `infrastructure` directamente (la composición se hace en un punto único) |

- **Entre módulos:** un módulo solo usa la API pública (`index.js`) de otro, nunca sus carpetas internas. Si el módulo A necesita datos de B, se define un **puerto** en A que B implementa a través de su API pública.
- **Composición:** las dependencias concretas (repositorios, servicios) se inyectan en un único lugar (`app.js` o un archivo de composición por módulo). No se instancian dentro de casos de uso.
- Estas reglas se pueden hacer cumplir con ESLint (`no-restricted-imports` o `eslint-plugin-boundaries`).

## 5. Multi-tenant (ver ADR 0002)
- Estrategia: una base de datos compartida con `cooperative_id` en cada tabla de datos de cooperativa.
- El `cooperative_id` sale del **token del usuario autenticado**, nunca del cuerpo de la petición.
- Un middleware de tenant deja el contexto disponible y los repositorios **siempre** filtran por `cooperative_id`.
- La búsqueda pública es de solo lectura y consulta varias cooperativas explícitamente.

## 6. API
- REST con JSON bajo el prefijo `/api/v1`.
- Errores con formato único: `{ "error": { "code": "FREQUENCY_ALREADY_EXISTS", "message": "..." } }`.
- Los errores de dominio (clases que extienden `DomainError`) se traducen a códigos HTTP en un solo middleware de errores.
- Autenticación con JWT. Autorización por rol en un middleware reutilizable.
- Validación de entrada en la capa `interfaces`; las reglas de negocio se validan en `domain` y `application`.

## 7. Datos
- PostgreSQL. Tablas y columnas en `snake_case`, tablas en plural.
- Todo cambio de esquema mediante una **migración nueva**. Una migración ya fusionada no se edita.
- Concurrencia de asientos: transacción con bloqueo (`SELECT ... FOR UPDATE`) o restricción única sobre (viaje, asiento) para impedir doble reserva.
- Expiración de reservas: tarea periódica o consulta que libera reservas vencidas. El plazo viene de configuración (RN-50).

## 8. Despliegue
Docker Compose con tres servicios: `backend`, `frontend` y `db` (PostgreSQL). Versiones de imágenes fijas, sin `latest`. Configuración por variables de entorno (`.env.example` documentado).

## 9. Pruebas
- **Unitarias** (dominio y casos de uso, con puertos simulados): rápidas, sin base de datos.
- **Integración** (repositorios y endpoints) contra PostgreSQL de prueba.
- Los flujos críticos (reserva, comprobante, emisión de boleto) tienen pruebas de extremo a extremo de la API.
