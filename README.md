# 🚌 NOMBRE-DEL-PROYECTO — Venta de pasajes interprovinciales

Aplicación web para la **gestión y venta de boletos de transporte interprovincial en Ecuador**. Permite a las cooperativas administrar sus buses, frecuencias y hojas de ruta, a los oficinistas vender y validar pagos, y a los usuarios finales buscar viajes, elegir asientos y comprar boletos con código QR.

Para trabajar con Codex, empieza por la [guía del equipo](docs/flujo-codex.md) y el [estado por integrante](docs/estado-proyecto.md). Puedes pedir: «Soy Edwin, revisa qué me corresponde ahora y explícame cómo empezar». Las tareas propuestas requieren spec y acuerdo antes de implementarse.

> Proyecto del segundo parcial de **Manejo y Configuración de Software**  
> Carrera de Software — Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI)  
> Universidad Técnica de Ambato

![version](https://img.shields.io/badge/version-0.1.0-blue)
![license](https://img.shields.io/badge/license-GPLv3-blue)
![node](https://img.shields.io/badge/node-20.x-339933)
![postgres](https://img.shields.io/badge/postgresql-16-336791)

---

## 📑 Tabla de contenidos

1. [Características](#-características)
2. [Roles del sistema](#-roles-del-sistema)
3. [Stack tecnológico](#-stack-tecnológico)
4. [Requisitos previos](#-requisitos-previos)
5. [Instalación y ejecución con Docker](#-instalación-y-ejecución-con-docker)
6. [Variables de entorno](#-variables-de-entorno)
7. [Estructura del repositorio](#-estructura-del-repositorio)
8. [Flujo de trabajo y gestión de cambios](#-flujo-de-trabajo-y-gestión-de-cambios)
9. [Documentación del repositorio](#-documentación-del-repositorio)
10. [Equipo](#-equipo)
11. [Cómo citar este repositorio](#-cómo-citar-este-repositorio)
12. [Licencia](#-licencia)

---

## ✨ Características

- CRUD de cooperativas, buses, frecuencias y hojas de ruta.
- Buses con configuraciones de asientos (normal, VIP, discapacitados, dos pisos) basadas en plantillas.
- Frecuencias respaldadas por una resolución de la ANT, con paradas intermedias.
- Búsqueda de viajes por origen, destino y fecha, con filtros por cooperativa, tipo de asiento, marca de chasis/carrocería y tipo de viaje (directo o con paradas).
- Compra de boletos entre paradas intermedias (ej.: Latacunga – Cuenca en la ruta Quito – Loja).
- Selección de asientos y registro de pasajeros por cédula, con descuentos para menor de edad, tercera edad y discapacidad.
- Pago por depósito o transferencia con carga de comprobante y validación manual del oficinista.
- Boleto descargable con **código QR**, disponible en cualquier momento desde el historial.
- Notificaciones por correo y dentro de la aplicación en cada paso relevante.
- Configuración de la aplicación (logo, colores, redes sociales, soporte).

> **Fuera del alcance de esta entrega:** módulo del bus (chofer/controlador): lectura de boletos, inicio y fin de viaje, cobro en ruta.

## 👥 Roles del sistema

| Rol | Responsabilidad |
|---|---|
| **Administrador** | Crea cooperativas, designa a su responsable, da soporte y configura la aplicación. |
| **Cooperativa** | Gestiona sus buses, frecuencias y hojas de ruta. |
| **Oficinista** | Vende boletos en ventanilla y aprueba o rechaza los pagos en línea. |
| **Usuario final** | Busca viajes, compra boletos y consulta su historial. |
| **Chofer / controlador** | Valida boletos y administra el viaje (*módulo pendiente*). |

## 🧰 Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | HTML + EJS (plantillas del servidor) + **Bootstrap 5** |
| Backend | **Node.js 20** + Express (monolito) |
| Base de datos | **PostgreSQL 16** |
| ORM y migraciones | Prisma |
| Autenticación | Sesiones (`express-session`) + `bcrypt` |
| Correo / QR | Nodemailer / `qrcode` |
| Pruebas y calidad | Jest, ESLint, Prettier |
| Convenciones de commit | commitlint + husky |
| Contenedores | Docker y Docker Compose |
| Gestión de cambios | Git; gestor Jira o GitHub Issues pendiente después del 4 de noviembre de 2026 |

## ✅ Requisitos previos

- [Git](https://git-scm.com/) 2.40 o superior
- [Docker](https://www.docker.com/) y Docker Compose v2
- (Opcional, para desarrollo sin contenedor) Node.js 20 y npm 10

## 🚀 Instalación y ejecución con Docker

```bash
# 1. Clonar el repositorio
git clone https://github.com/ORGANIZACION/NOMBRE-DEL-PROYECTO.git
cd NOMBRE-DEL-PROYECTO

# 2. Crear el archivo de variables de entorno
cp .env.example .env

# 3. Levantar la aplicación y la base de datos
docker compose up --build

# 4. Aplicar migraciones y datos de ejemplo (en otra terminal)
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run seed
```

La aplicación queda disponible en **http://localhost:3000**.

### Comandos útiles

| Comando | Descripción |
|---|---|
| `docker compose up -d` | Levanta los servicios en segundo plano |
| `docker compose logs -f app` | Muestra los logs de la aplicación |
| `docker compose exec app npm test` | Ejecuta las pruebas |
| `docker compose exec app npm run lint` | Revisa el estilo del código |
| `docker compose down -v` | Detiene todo y borra los volúmenes (reinicia la BD) |

## 🔐 Variables de entorno

Copia `.env.example` a `.env`. **Nunca subas `.env` al repositorio.**

| Variable | Descripción | Ejemplo |
|---|---|---|
| `PORT` | Puerto de la aplicación | `3000` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://user:pass@db:5432/pasajes` |
| `SESSION_SECRET` | Secreto de las sesiones | `cambiar-esto` |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Servidor de correo | — |
| `UPLOAD_DIR` | Carpeta de comprobantes de pago | `./uploads` |

## 🗂️ Estructura del repositorio

```
.
├── .github/                 # Plantillas de issues/PR, CODEOWNERS, workflows
├── docs/                    # Arquitectura, decisiones (ADR), manual de usuario
├── prisma/                  # schema.prisma y migraciones
├── src/
│   ├── app.js               # Configuración de Express
│   ├── server.js            # Punto de entrada
│   ├── config/              # Configuración general
│   ├── middlewares/         # Autenticación, roles, errores
│   ├── modules/             # Un módulo por dominio (routes, controller, service)
│   │   ├── auth/
│   │   ├── cooperativas/
│   │   ├── buses/
│   │   ├── frecuencias/
│   │   ├── hojas-ruta/
│   │   ├── boletos/
│   │   └── pagos/
│   ├── views/               # Plantillas EJS
│   └── public/              # CSS, JS e imágenes
├── tests/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── CHANGELOG.md
├── CITATION.cff
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── SECURITY.md
└── README.md
```

## 🔀 Flujo de trabajo y gestión de cambios

- **Control de versiones:** Gitflow (`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`).
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).
- **Versionado:** [Versionamiento Semántico 2.0.0](https://semver.org/lang/es/).
- **Gestión de cambios:** peticiones de cambio identificadas mediante specs locales hasta elegir Jira o GitHub Issues después de la primera revisión; evaluadas por el **comité de control de cambios (CCB)**.

Todo el detalle está en [CONTRIBUTING.md](CONTRIBUTING.md). Versiones solo `MAJOR.MINOR.PATCH`. La entrega funcional del 4 de noviembre de 2026 incluirá en `main` los errores inducidos autorizados según [el protocolo académico](docs/errores-inducidos.md).

## 📚 Documentación del repositorio

| Documento | Propósito |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guía de contribución y flujo de trabajo |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Normas de convivencia del equipo |
| [SECURITY.md](SECURITY.md) | Cómo reportar vulnerabilidades |
| [CHANGELOG.md](CHANGELOG.md) | Historial de versiones |
| [LICENSE](LICENSE) | Licencia GNU GPL v3.0 |
| [CITATION.cff](CITATION.cff) | Metadatos para citar el repositorio |
| [docs/](docs/) | Arquitectura y decisiones técnicas |

## 🧑‍💻 Equipo

| Integrante | Rol en el proyecto | Área principal | GitHub |
|---|---|---|---|
| NOMBRE 1 | Miembro del CCB / Líder | | @usuario |
| NOMBRE 2 | Miembro del CCB | | @usuario |
| NOMBRE 3 | Desarrollador | | @usuario |
| NOMBRE 4 | Desarrollador | | @usuario |
| NOMBRE 5 | Desarrollador | | @usuario |

## 📎 Cómo citar este repositorio

Este repositorio incluye un archivo [`CITATION.cff`](CITATION.cff). En GitHub, usa el botón **"Cite this repository"** de la barra lateral para obtener la cita en formato APA o BibTeX.

## 📄 Licencia

Este proyecto es software libre distribuido bajo la **GNU General Public License v3.0** (`GPL-3.0-only`). Puedes usarlo, estudiarlo, modificarlo y redistribuirlo, siempre que las obras derivadas se distribuyan bajo la misma licencia y con su código fuente.

El texto completo está en el archivo [LICENSE](LICENSE) y en <https://www.gnu.org/licenses/gpl-3.0.html>.

```
Copyright (C) 2026 NOMBRES DEL EQUIPO

Este programa es software libre: puedes redistribuirlo y/o modificarlo bajo los
términos de la Licencia Pública General de GNU publicada por la Free Software
Foundation, ya sea la versión 3 de la Licencia o (a tu elección) cualquier
versión posterior... [ver LICENSE]
```

## Frontend de bienvenida (WEB-01)

La página pública de transViaje se sirve en http://localhost:8080/ mediante el
servicio `frontend` de Docker Compose. Incluye Bootstrap local, logo y diseño
adaptable; no requiere autenticación. `/api/v1` se reenvía al backend y la
bienvenida permanece visible cuando este no está disponible.

Arranque, alcance y pruebas: [frontend/README.md](frontend/README.md).
Spec: [WEB-01](docs/specs/WEB-01.md). No incluye formularios de acceso ni compra.
