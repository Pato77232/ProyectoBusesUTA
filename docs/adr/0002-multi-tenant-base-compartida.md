# ADR 0002: Multi-tenant con base de datos compartida y `cooperative_id`

- **Estado:** Propuesta (pendiente de aprobación del equipo)
- **Fecha:** 2026-10
- **Decidido por:** equipo

## Contexto
El sistema agrupa varias cooperativas (RN-02). Cada una solo debe ver sus datos, pero la búsqueda pública debe consolidar viajes de todas.

## Decisión
Una sola base de datos PostgreSQL y un esquema compartido. Toda tabla con datos de una cooperativa incluye `cooperative_id`. El identificador sale del token del usuario autenticado, nunca de la petición. Los repositorios filtran siempre por `cooperative_id`. La búsqueda pública consulta varias cooperativas de forma explícita y solo lectura.

## Alternativas consideradas
- **Un esquema por cooperativa:** mejor aislamiento, pero migraciones más complejas y búsqueda consolidada más difícil.
- **Una base por cooperativa:** el aislamiento máximo, pero costo operativo desproporcionado para el proyecto.

## Consecuencias
- Simple de operar y de consultar de forma consolidada.
- El aislamiento depende de la disciplina del código: cada consulta debe filtrar. Se refuerza con pruebas de aislamiento entre cooperativas y con la revisión (`reviewer`).
- Se puede evaluar *Row Level Security* de PostgreSQL como refuerzo posterior.
