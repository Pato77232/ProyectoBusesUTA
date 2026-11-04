# Ejemplos de cotización configurada para L-01

Fecha: 2 de noviembre de 2026. Responsable de preparación: Leslie, con asistencia de Codex.
Spec: [BOOK-05-L01](specs/BOOK-05-L01.md). Estado: propuesta de casos y resultados para revisión; no aprobación de implementación ni suite funcional ejecutada.

## Alcance y supuestos explícitos

Datos sintéticos, sin pasajeros reales ni tarifas oficiales. El 50 % aparece solo como un ejemplo configurable, nunca como valor por defecto ni autoridad de la política nueva. Los casos VIP anticipan el contrato: Fleet actual solo entrega NORMAL. No ofrecer VIP en producción hasta disponer de inventario real autorizado.

En los casos monetarios que conceden un beneficio, la elegibilidad y acreditación se asumen ya verificadas por una fuente confiable para aislar el cálculo; esta tabla no implementa esa fuente. Leslie confirmó acreditar antes del total aceptado/pago, aplicar solo el mayor beneficio y conservar las categorías empatadas.

Los resultados numéricos calculables de las reglas confirmadas se distinguen de casos cuyo comportamiento operativo sigue pendiente (total cero, techo final, fechas ambiguas y proveedor de acreditación).

## Fórmula exacta y unidad

- B: tarifa explícita del par, en centavos enteros positivos. No sumar tramos consecutivos.
- V: vipSurchargeBps de la hoja solo cuando el asiento confiable es VIP; para NORMAL el recargo aplicable es cero aunque la hoja tenga recargo VIP configurado.
- D: mayor porcentaje entre beneficios elegibles y acreditados, entero en bps; sin categorías elegibles se aplica cero. La política debe incluir todos sus porcentajes expresamente, incluso cuando sean cero.
- 100 bps = 1 %; 125 bps = 1,25 %; rango aprobado 0..10000 bps.
- Recargo exacto: B × V / 10000.
- Subtotal exacto: B × (10000 + V) / 10000.
- Beneficio exacto: B × (10000 + V) × D / 100000000.
- Total exacto: B × (10000 + V) × (10000 - D) / 100000000.
- Total por pasajero: mitad hacia arriba del total exacto al centavo entero. Para importes no negativos, con N numerador entero, equivale a cociente entero (N + 50000000) / 100000000.

Usar aritmética entera/racional exacta; una multiplicación intermedia puede superar Number.MAX_SAFE_INTEGER aunque el resultado final no lo haga. Las comas de la tabla son separadores decimales de centavos exactos; no representan dinero guardado como decimal binario. USD 10,00 equivale a 1000 centavos.

## Tabla monetaria

| Caso | Escenario sintético | Base (ct) | VIP (bps) | Beneficio máximo (bps) | Recargo exacto (ct) | Descuento exacto tras VIP (ct) | Total exacto (ct) | Total redondeado (ct) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C01 | NORMAL sin beneficio | 1000 | 0 | 0 | 0 | 0 | 1000 | 1000 |
| C02 | VIP 25 %, sin beneficio | 1000 | 2500 | 0 | 250 | 0 | 1250 | 1250 |
| C03 | VIP 25 %, sin beneficio; mitad exacta | 450 | 2500 | 0 | 112,5 | 0 | 562,5 | 563 |
| C04 | VIP 25 % y beneficio 50 %; sin redondeo intermedio | 450 | 2500 | 5000 | 112,5 | 281,25 | 281,25 | 281 |
| C05 | NORMAL, beneficio 30 % | 1000 | 0 | 3000 | 0 | 300 | 700 | 700 |
| C06 | VIP 25 %, beneficio 30 % | 1000 | 2500 | 3000 | 250 | 375 | 875 | 875 |
| C07 | Un centavo, beneficio 50 % | 1 | 0 | 5000 | 0 | 0,5 | 0,5 | 1 |
| C08 | Un centavo, beneficio 50,01 % | 1 | 0 | 5001 | 0 | 0,5001 | 0,4999 | 0 |
| C09 | Un centavo, beneficio 49,99 % | 1 | 0 | 4999 | 0 | 0,4999 | 0,5001 | 1 |
| C10 | NORMAL, beneficio 100 % | 1000 | 0 | 10000 | 0 | 1000 | 0 | 0 |
| C11 | VIP 100 %, beneficio 100 % | 1000 | 10000 | 10000 | 1000 | 2000 | 0 | 0 |
| C12 | VIP 100 %, sin beneficio | 1000 | 10000 | 0 | 1000 | 0 | 2000 | 2000 |
| C13 | VIP 0 % explícito y beneficio 0 % explícito | 1000 | 0 | 0 | 0 | 0 | 1000 | 1000 |
| C14 | VIP 1,25 %, beneficio 12,34 % | 10000 | 125 | 1234 | 125 | 1249,425 | 8875,575 | 8876 |
| C15 | VIP 33,33 %, beneficio 33,33 % | 100 | 3333 | 3333 | 33,33 | 44,438889 | 88,891111 | 89 |
| C16 | Menor 30 % y discapacidad 40 %: máximo | 1000 | 0 | 4000 | 0 | 400 | 600 | 600 |
| C17 | Menor 40 % y discapacidad 40 %: empate | 1000 | 0 | 4000 | 0 | 400 | 600 | 600 |
| C18 | Tercera edad 40 % y discapacidad 40 %: empate | 1000 | 2500 | 4000 | 250 | 500 | 750 | 750 |
| C19 | Tercera edad 60 % y discapacidad 40 %: máximo | 1000 | 2500 | 6000 | 250 | 750 | 500 | 500 |
| C20 | A→C explícito 450; A→B 200 y B→C 300 | 450 | 0 | 0 | 0 | 0 | 450 | 450 |
| C21 | Hoja H1: VIP 25 %, beneficio 30 % | 1000 | 2500 | 3000 | 250 | 375 | 875 | 875 |
| C22 | Hoja H2: VIP 10 %, beneficio 40 % | 1000 | 1000 | 4000 | 100 | 440 | 660 | 660 |
| C23 | Base máxima del proveedor y VIP 100 %; techo matemático | 9999999999 | 10000 | 0 | 9999999999 | 0 | 19999999998 | 19999999998 |
| C24 | Base máxima y bps extremos; precisión intermedia | 9999999999 | 9999 | 9999 | 9998999999,0001 | 19997000098,00029999 | 1999899,99980001 | 1999900 |

### Observaciones que debe verificar la futura implementación

- C03/C04: no redondear 562,5 a 563 antes del beneficio. C04 da 281,25 → 281; redondear antes produciría 282, que es incorrecto.
- C07/C08/C09: comprobar justo en mitad, por debajo y por encima de mitad.
- C10/C11/C08: el resultado aritmético puede ser cero. La tarifa base sigue siendo positiva. Falta acordar el flujo de venta cuando no hay importe que transferir; no exigir archivo ficticio ni introducir mínimo de cobro para cambiar el cálculo.
- C13: cero explícito es configuración válida; porcentaje ausente no equivale a cero.
- C16: categorías elegibles MINOR/DISABILITY; solo DISABILITY tiene el porcentaje máximo.
- C17: categorías empatadas en el máximo MINOR/DISABILITY; se conservan ambas, no se aplican dos descuentos.
- C18: empate SENIOR/DISABILITY; se conservan ambas. C19: ambas elegibles pero solo SENIOR tiene el porcentaje máximo.
- MINOR y SENIOR no pueden ser simultáneos para una misma fecha de edad válida. No inventar un pasajero con las tres categorías a la vez para probar empates.
- C20: la matriz ofrece A→C = 450; A→B + B→C sería 500. El importe autorizado es 450.
- C23: techo matemático derivado de base máxima admitida por David y VIP 100 %. No constituye aprobación del límite de total/pago/compra; confirmar ese límite al cerrar el contrato de Bookings.
- C24: entradas en límites válidos exigen exactitud intermedia; total exacto 1999899,99980001 → 1999900. El numerador excede el rango entero seguro de Number.

## Límites de edad y acreditación

Para A01–A06 fijar categoría NORMAL, base 1000 centavos, minorDiscountBps = 3000, seniorDiscountBps = 4000, disabilityDiscountBps = 5000 y discapacidad no acreditada/ausente explícitamente según el contrato que se apruebe. Nacimiento y fecha de edad son datos confiables. No se resuelve aquí si la fecha comercial aplicable cambia al embarcar después de medianoche.

| Caso | Nacimiento | Fecha usada para edad | Edad cumplida | Categoría por edad | Total (ct) |
| --- | --- | --- | ---: | --- | ---: |
| A01 | 2008-11-02 | 2026-11-01 | 17 | MINOR | 700 |
| A02 | 2008-11-02 | 2026-11-02 | 18 | Ninguna | 1000 |
| A03 | 2008-11-02 | 2026-11-03 | 18 | Ninguna | 1000 |
| A04 | 1961-11-02 | 2026-11-01 | 64 | Ninguna | 1000 |
| A05 | 1961-11-02 | 2026-11-02 | 65 | SENIOR | 600 |
| A06 | 1961-11-02 | 2026-11-03 | 65 | SENIOR | 600 |

| Caso adicional | Entrada/escenario | Resultado o pendiente |
| --- | --- | --- |
| A07 | Nacimiento posterior a fecha de edad | Rechazar dato, sin cotización final |
| A08 | Nacimiento 2026-02-30 o fecha imposible | Rechazar dato, sin normalizar silenciosamente |
| A09 | Nacimiento 2008-02-29, fecha 2026-02-28 frente a 2026-03-01 | Política histórica usa 1 de marzo en año no bisiesto; conservar evidencia. Reconfirmar aplicabilidad de esa convención a la nueva política antes de fijar expectativas nuevas |
| A10 | Viaje sale 2026-11-01 y embarque elegido es 2026-11-02; cumple 18/65 el 2 | Acordar con David fecha autoritativa de edad antes de fijar categoría. No usar fecha de compra/navegador |
| A11 | Solo cédula estructuralmente válida, sin acreditación de nacimiento/discapacidad | No dar por verificada elegibilidad ni cerrar total con ese beneficio; respuesta y flujo de acreditación pendientes |
| A12 | Adulto de 30 años con discapacidad acreditada y política 5000 bps | DISABILITY, total 500 ct con base 1000; no exige minoría/tercera edad |
| A13 | Menor y discapacidad acreditada, ambos porcentajes explícitos 0 | Elegibilidad no implica ahorro. Total 1000 con base 1000; conservar categorías elegibles en trazabilidad, pero presentación exacta de “beneficio aplicado 0” por cerrar |

## Cambios entre hojas y revalidación

| Caso | Situación | Resultado esperado |
| --- | --- | --- |
| H01 | H1 congelada con política de C21; después se configura H2 como C22 | Viaje de H1 sigue en 875 ct; viaje de H2 usa 660 ct |
| H02 | Cambia configuración ordinaria tras publicar H1 | La copia congelada de H1 y las reservas previas no se recalculan con H2 |
| H03 | Dos hojas tienen revision = 1 pero distintas políticas | No confundirlas: identidad de hoja y contexto de viaje además de revisión; schemaVersion = 1 no identifica versión comercial |
| H04 | Antes de crear reserva, cambia el snapshot aceptado de tarifa, recorrido, asiento o acreditación | Revalidar bajo protocolo de concurrencia y exigir nueva aceptación si el resumen cambia; no cargar otro total silenciosamente |
| H05 | Reintento de una creación ya confirmada con igual dueño/clave/datos, aunque haya otra hoja/configuración | Recuperar reserva, total y plazo persistidos; no recalcular ni crear una segunda |
| H06 | Timeout al leer tarifa/hoja | Error recuperable sin reserva ni tarifa de sustitución; no interpretar como cero |
| H07 | Asiento NORMAL aunque vipSurchargeBps de la hoja sea 2500 | Recargo aplicable cero; para base 1000 sin beneficio, total 1000 |
| H08 | offered false o asiento ajeno al bus confiable | No permitir reserva; no basta con que exista una tarifa |

## Reserva con varios pasajeros

R01: dos pasajeros NORMAL, base explícita de 1 centavo por pasajero y beneficio acreditado de 5000 bps para cada uno. Cada exacto vale 0,5 ct y cada total redondeado vale 1 ct; total de compra = 2 ct. No sumar exactos (1 ct) y redondear una sola vez para toda la compra.

R02: sumar los totales por pasajero con control de desbordamiento y límite de total a aprobar. No imponer aquí un máximo arbitrario de pasajeros o cobro.

## Entradas inválidas y ausencia de datos

| Caso | Dato/estado | Resultado esperado para el nuevo contrato |
| --- | --- | --- |
| E01 | Base -1, 0, 1,5 ct o mayor que 9999999999 ct | Rechazar conforme al límite de tarifa publicado; un total descontado cero no es lo mismo que base cero |
| E02 | Bps -1, 10001 o fracción 12,5 | Rechazar; los bps son enteros, la precisión decimal se expresa mediante 125, no 12,5 |
| E03 | Falta algún porcentaje o se recibe null/texto | Rechazar configuración incompleta; no aplicar defaults silenciosos |
| E04 | Falta precio del par o findPrice devuelve null | Tarifa no disponible, no sumar tramos ni usar cero |
| E05 | Cooperativa/hoja/frecuencia/posiciones de la respuesta no corresponden al viaje | Rechazar antes de cotizar; valores autoritativos no salen del body |
| E06 | Posición inversa, repetida, negativa, fraccionaria o fuera del recorrido | Rechazar antes de buscar ocupaciones |
| E07 | Categoría VIP declarada por navegador para asiento NORMAL | Mantener categoría confiable del proveedor; nunca usar la del navegador como autoridad |
| E08 | Categoría ausente o desconocida en proveedor | Error explícito; no degradar a NORMAL automáticamente |
| E09 | Error de proveedor de acreditación | No interpretar como “sin discapacidad”, “adulto” ni acreditación aprobada; flujo/error por definir con Shirley |
| E10 | Esquema/revisión de política incompleto o no compatible | Error explícito; no recuperar porcentajes históricos como sustitución |
| E11 | Importe propuesto por cliente, propietario o cooperativa en body | No aceptar como autoridad; aplicar validación de contrato HTTP y contexto de servidor |
| E12 | Hoja con tarifa publicada pero viaje no comercializable | No habilitar compra por existir tarifa; validar viaje/embarque con proveedor real |

## Desglose y residuo: propuesta todavía pendiente

La fórmula y los totales anteriores tienen resultado exacto; falta aprobar la representación del desglose. No redondear por separado los componentes y afirmar que concilian si no lo hacen.

Ejemplo C04: base 450 + recargo 112,5 - beneficio 281,25 = 281,25 ct exactos; redondeo final a 281 produce ajuste -0,25 ct. C03 produce ajuste +0,5 ct.

Propuesta para revisar: conservar importes racionales exactos para auditoría y total final entero, con ajuste de redondeo explícito; si la API exige cada componente entero, acordar otra representación y reparto del residuo antes de implementar. No escoger una regla contable silenciosa. Los ejemplos no conceden aprobación a una estructura de salida nueva.

## Evidencia, decisiones y siguiente incremento

- Preparación autorizada por Leslie: completar tabla, no implementar el cálculo.
- 24 casos monetarios calculados con enteros/racionales exactos. 23 totales se contrastan contra resultados esperados escritos previamente; C24 se calcula y contrasta además por un método decimal independiente.
- Se comprueban por separado seis fronteras de edad y el ejemplo de suma por pasajero. Los otros escenarios son criterios previstos, no pruebas funcionales ejecutadas.
- No se ejecuta ni cambia passenger-quote.js: mantiene 50 % fijo como implementación histórica y no cumple todavía la política configurada. No se alteran tests históricos para que pasen con otros resultados.
- No frontend ni cambios de composición; no dependencias, migraciones, commits, push, merge, rebase o tags. No se ejecutan lint/Jest/PostgreSQL/arranque para este alcance documental.
- Pendientes de aprobación: esta tabla, representación/conciliación del desglose, proveedor de acreditación, fecha ambigua de edad, manejo de total cero y límites de total. Autorizar después un incremento puro de cálculo con sus pruebas reales, distinto de la integración comercial.

## Propuesta concreta para revisión — 4 de noviembre de 2026

Estado: propuesta pendiente de respuesta; no cambia las reglas vigentes ni implementa una API. Base técnica ae88e0c, después de PR #70. Numerador/denominador son textos de enteros exactos, en centavos; denominador positivo. La interfaz futura podrá formatearlos sin reinterpretar los textos como precios autorizados del cliente.

| Caso | Base entera | Recargo exacto | Descuento exacto | Ajuste exacto | Total entero |
| --- | ---: | --- | --- | --- | ---: |
| C03 | 450 | 225/2 | 0/1 | 1/2 | 563 |
| C04 | 450 | 225/2 | 1125/4 | -1/4 | 281 |
| C14 | 10000 | 125/1 | 49977/40 | 17/40 | 8876 |

Propuesta de un componente JSON: {"numerator":"-1","denominator":"4"} para el ajuste C04. No es un importe entero negativo cobrado al comprador; es el residuo exacto de redondear el total. Se conserva el total entero autorizado y la identidad base + recargo - descuento + ajuste = total. El caso C14 se deriva de 8875,575 y ajuste 0,425.

Caso adicional propuesto para edad: nacimiento 2008-11-02, salida del origen 2026-11-01 a las 23:00, embarque elegido 2026-11-02 a las 00:30 en la zona comercial confirmada. Si se acepta usar el embarque, tiene 18 y no obtiene MINOR. Nacimiento 1961-11-02 en el mismo embarque: tiene 65 y cumple SENIOR. Falta confirmar esta regla y el dato de zona; no extraer la fecha por recorte de una fecha UTC.

Recomprobación documental ejecutada con Fraction: 24/24 filas C01–C24 concilian componentes, total exacto y total redondeado. La primera ejecución del verificador tuvo un índice de columna incorrecto y no produjo un resultado; se corrigió el verificador, sin cambiar cifras de la tabla, y la segunda ejecución terminó correctamente. No se ejecutó el cálculo del producto ni se modificaron tests.

## Confirmaciones posteriores de Leslie — 4 de noviembre de 2026

Leslie confirma desglose exacto con ajuste explícito y fecha local de embarque para edad, conservando 1 de marzo en año no bisiesto para nacidos el 29 de febrero. Reemplaza los pendientes documentales incompatibles anteriores; no borra la evidencia histórica.

También confirma oficinista de la cooperativa, documentos de identidad/nacimiento y discapacidad, resultado/referencia privada/actor/fecha/versión, antes del total aceptado; el comprador solo ve resultados propios y la revisión del comprobante es posterior e independiente. No implica que exista ya el proveedor de acreditación.

Los casos C01–C24 se incorporan como expectativas de la nueva suite configured-passenger-quote.test.js. Hay pruebas adicionales de límites de edad, máximo/empates, cero explícito, aislamiento entre políticas y errores. El código puro recibe boardingDate previamente resuelta y datos acreditados: no convierte zona ni verifica documentos. No se cambia la cotización histórica ni se habilita el resumen de compra con datos simulados.
