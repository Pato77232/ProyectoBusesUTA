# BOOK-04: Registrar pasajeros por asiento

- **Responsable:** Leslie
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** T1 autorizada para RN-42; persistencia y formulario pendientes.
- **Dependencias:** BOOK-01; BOOK-03 para T2/T3.

## 1. Objetivo
Exigir una cédula por cada asiento seleccionado.

## 2. Reglas
RN-42 exige cédula. RN-43 no autoriza inferir edad o discapacidad a partir del número sin una fuente aprobada.

## 3. Tareas
T1 objeto de dominio de pasajero vinculado a seatId y cédula obligatoria; T2 persistencia y autorización; T3 formulario por asiento. Rama inicial feature/BOOK-04-T1-pasajeros-dominio.

## 4. Flujo
Recibir un objeto interno, exigir identificador de asiento y cédula como cadenas no vacías, recortar espacios exteriores y devolver copia inmutable. No admitir propiedades de rol, precio, descuento ni cooperativa.

## 5. Datos
T1: {seatId, identificationNumber}. El identificador no se convierte a número: conserva ceros iniciales. Esta validación mínima no certifica una cédula real. No imponer longitud, dígito verificador, unicidad entre pasajeros, nombres ni acreditaciones hasta acordarlos. T2 verificará que el asiento pertenece a la reserva; T1 no accede a base de datos.

## 6. Endpoints
Ninguno en T1. La integración se define con BOOK-03; no crear un endpoint de datos personales sin propiedad y autorización aprobadas.

## 7. Criterios de aceptación
- [ ] Cédula ausente, vacía, nula o numérica produce error.
- [ ] Se conservan ceros iniciales y se recortan espacios exteriores.
- [ ] El asiento es obligatorio y no se aceptan campos extra.
- [ ] El resultado es inmutable y no modifica la entrada.
- [ ] No se calculan descuentos ni se afirma validez documental.

## 8. Casos borde
Entrada no objeto, arrays, espacios y datos adicionales. Las reglas de documentos extranjeros e invitados permanecen abiertas.

## 9. Pruebas
Unitarias de T1; integración de asociación, autorización y privacidad en T2; formulario y mensajes en T3. No registrar cédulas en logs.

## 10. Preguntas abiertas
Formato, algoritmo o servicio de validación; datos mínimos adicionales; acreditación de beneficios; conservación de datos personales. No se simula una consulta de identidad en producción.

## 11. Defecto inducido
No aplica.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. No se atribuye aprobación a otros integrantes. Los contratos reales pendientes están en `docs/reservas-contratos.md`; esta rama no implementa código, endpoints, tablas ni pantallas. Los avances de dominio existentes se conservan en sus ramas de tarea separadas.
## Avance
T1 mínima implementada y probada. La validación ecuatoriana acordada en docs/reservas-decisiones.md se añadirá como tarea T1b independiente, antes de persistencia y formulario. No se presenta este objeto mínimo como cédula validada.

### T1b: estructura ecuatoriana
Validador independiente para 10 dígitos, conservación de ceros y módulo 10; rechaza el valor nulo numérico de diez ceros. No certifica expedición, provincia, nacionalidad ni titularidad. No modifica la validación mínima de T1 ni sus pruebas: la futura captura completa compondrá ambos objetos y los datos de identidad. Fuente técnica: [INEC, metodología de registros](https://www.ecuadorencifras.gob.ec/documentos/web-inec/Bibliotecas/Libros/Metod_para_transformar_registros_admin_en_registros_estad.pdf), tabla de cédulas; [SRI, validación del dígito](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/128d9357-9043-41ce-833b-885da7a34a7f/TALLER_SOCIALIZACI%C3%93N_MARZO_2019_v2.pdf). Rama feature/BOOK-04-T1b-valida-cedula. Pruebas con secuencias sintéticas, verificador cero, ceros iniciales, longitud, caracteres y dato numérico. No usar este algoritmo para documentos extranjeros.
