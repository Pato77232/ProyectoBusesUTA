# BOOK-03 — contactos para entrega de boletos

Responsable: Leslie; coordinar consumo con Shirley/Pablo (BOLETOS-02).
RN-41/42. Base develop 5b0ecb6. No compra invitada ni SMTP.

Se captura contact.email por pasajero; si es menor de 18 al embarque, exige
contact.guardian con fullName y birthDate de un adulto al embarque. Para un
adulto el correo corresponde al pasajero y no se acepta guardian. Captura
declarada, sin afirmar verificación de identidad o titularidad del correo.
Correo máximo 254, nombre responsable máximo 200, sin caracteres de control.
Se muestra en el resumen; cambiar contacto cambia revisión/huella de compra.
Se conserva en summary JSON existente, sin migración ni modificación histórica.

Compatibilidad: las solicitudes anteriores sin contact conservan su contrato;
la nueva pantalla lo captura obligatoriamente. Las reservas históricas no
reciben un destinatario inventado y el futuro emisor debe exigir contacto antes
de enviar. No se habilita correo automático con este PR. Contacto no acredita
beneficios y no modifica el hash de documentos/identidad de la acreditación.
Sin almacenamiento persistente de PII en navegador. Diseño: frontend/DESIGN.md.

Por petición expresa se omiten nuevas pruebas y ejecución de suites. Lint,
formato, sintaxis y diff son controles estáticos; revisión humana, integración
con BD y QA de formulario pendientes. PR borrador para coordinación de contrato.
