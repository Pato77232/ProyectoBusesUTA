# AGENTS.md — Reglas del proyecto

Sistema Centralizado de Gestión y Venta de Pasajes Interprovinciales (Ecuador). Proyecto académico de Gestión de Configuración de Software, equipo de 5 personas. Plataforma web multi-tenant donde varias cooperativas de transporte publican viajes y los clientes compran boletos con QR.

## Stack
Node.js (LTS) + Express · PostgreSQL · Bootstrap 5 · Docker y Docker Compose · Jest · ESLint + Prettier.

## Documentos que debes respetar
- `docs/business-rules.md`: reglas de negocio (RN-xx). Es la fuente de verdad funcional.
- `docs/architecture.md`: capas, estructura de carpetas y reglas de dependencia.
- `docs/conventions.md`: nombres, errores, pruebas, commits y ramas.
- `docs/specs/<ID>.md`: la spec de la tarea actual. Si no existe spec, pide que se escriba antes de implementar.
- `docs/adr/`: decisiones de arquitectura ya tomadas.

## Arquitectura (resumen)
Arquitectura limpia por módulos: `backend/src/modules/<modulo>/{domain,application,infrastructure,interfaces}`.
- `domain` no depende de nada (ni de Express, ni de `pg`).
- `application` depende solo de `domain`.
- `infrastructure` implementa las interfaces (puertos) definidas en `domain`.
- `interfaces` (HTTP) solo traduce HTTP a casos de uso. **Sin lógica de negocio en controladores.**
- Un módulo no importa las capas internas de otro; solo su API pública (`index.js`).

## Reglas de dominio que nunca se violan
- Frecuencia = origen + destino + hora de salida, **inmutable** una vez creada.
- Toda frecuencia exige número de resolución ANT.
- Multi-tenant: cada cooperativa solo ve y modifica sus datos. Todo acceso filtra por `cooperative_id`.
- El plazo para subir el comprobante es de 3 a 5 minutos y es configurable, no un número fijo en el código.
- Rechazar un comprobante exige justificación.
- Descuentos automáticos: tercera edad, menor de edad y discapacidad.
- El rol Chofer/Controlador **no** se implementa en esta fase.

## Cómo trabajar
1. Una tarea pequeña por vez (un caso de uso o un endpoint). No hagas módulos completos de una sola vez.
2. Lee la spec y las reglas antes de escribir código. Si algo no está definido, **pregunta**; no inventes requisitos.
3. Escribe pruebas junto con el código. Antes de terminar ejecuta `npm run lint` y `npm test` y reporta el resultado real.
4. Código limpio: funciones cortas, nombres que expresan intención, sin números mágicos, errores de dominio explícitos.
5. Sesiones cortas, una por tarea.

## Git
- Trabajas solo en ramas `feature/*`, `bugfix/*` o `hotfix/*`. Nunca en `main` ni `develop`.
- **No ejecutes** `git push`, `merge`, `rebase`, `tag` ni cambies a `main`/`develop`.
- **No hagas commits** salvo que el humano lo pida. Sugiere el mensaje con el formato de `docs/conventions.md`: `tipo(alcance): descripción` con tipo en inglés, alcance y descripción en español, verbo en imperativo.
- Un commit = un cambio lógico. Si el cambio mezcla temas, propón cómo dividirlo.

## Prohibido
- Modificar o borrar pruebas para que pasen. Si una prueba falla, corrige el código o avisa.
- Editar migraciones ya existentes (se crea una nueva) o cambiar el esquema a mano.
- Instalar o actualizar dependencias sin avisar y justificarlo.
- Tocar archivos fuera del alcance de la tarea o refactorizar de paso.
- Leer, mostrar o commitear secretos o archivos `.env`.
- Implementar funcionalidad del Chofer/Controlador o de fases futuras.
