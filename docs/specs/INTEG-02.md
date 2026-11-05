# INTEG-02: orden del catálogo de migraciones tras BOOK-11

- **ID local:** INTEG-02
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** infraestructura (catálogo de migraciones)
- **Responsable:** Edwin
- **Revisor propuesto / confirmado:** autor de BOOK-11 y Leslie; sin confirmar
- **Estado:** En revisión local
- **Prioridad y dependencias:** bloquea el arranque de `develop` y el release; va antes de CORREO-02.
- **Rama / PR / base comprobada:** `feature/INTEG-02-catalogo-migraciones` desde `origin/develop` `22a77c0`, 5 de noviembre de 2026.
- **Autorización de alcance:** Edwin, 5 de noviembre de 2026: renumerar las dos migraciones de invitado sin cambiar su SQL.

## 1. Problema

Al integrar BOOK-11 (#107) en `develop`, sus dos migraciones quedaron en mitad del catálogo y con marcas de tiempo repetidas:

- `1794330000000-auth-guest-email-access`, igual que `1794330000000-booking-benefit-request-reviews`.
- `1794340000000-booking-guest-contact`, después de `1794300000000` pero antes de `1794310000000-create-tickets`.

`validateCatalog` exige que el catálogo coincida con los archivos ordenados, así que el migrador rechaza el catálogo al arrancar. En `develop` `22a77c0` fallan 3 pruebas unitarias del catálogo, y la prueba de longitud esperaba 36 cuando había 38.

## 2. Cambio

- Renombrar, sin cambiar su SQL:
  - `1794330000000-auth-guest-email-access` → `1794350000000-auth-guest-email-access`;
  - `1794340000000-booking-guest-contact` → `1794360000000-booking-guest-contact`.
- Catálogo: ambas quedan al final, después de `1794330000000-booking-benefit-request-reviews`.
- Pruebas del catálogo: longitud 38, posiciones 33 a 37 y la lista de migraciones posteriores a las 34 de `develop`.
- `tests/integration/bookings/benefit-request-reviews-migration.test.js`: revierte primero las migraciones posteriores para seguir probando la reversión de la suya. No se quitó ninguna aserción.

Ninguna migración de esta lista depende de las de invitado; moverlas al final no cambia el esquema resultante.

## 3. Impacto

- Ninguna de estas migraciones está en un release (`v0.1.1` llega a `1794270000000`).
- Quien ya aplicó las migraciones de invitado con su nombre anterior en una base local debe recrearla (`node frontend/scripts/dev.cjs down` y `up`, o la base de pruebas).

## 4. Criterios de aceptación

- [ ] Catálogo ordenado y sin marcas repetidas; las pruebas unitarias del catálogo pasan.
- [ ] Suite completa con PostgreSQL aislado y base nueva.
- [ ] Arranque real: el migrador aplica todas las migraciones y `/api/v1/health` responde 200.

## 5. Defecto inducido

No aplica.

## 6. Evidencia

Pendiente de completar con la ejecución de esta rama.
