// Misma comprobación que el servidor (estructura y dígito verificador, módulo 10).
// Solo evita un envío condenado a fallar; no acredita identidad.
const COEFFICIENTS = Object.freeze([2, 1, 2, 1, 2, 1, 2, 1, 2]);

export function cedulaProblem(value) {
  const cedula = typeof value === "string" ? value.trim() : "";
  if (!/^\d{10}$/.test(cedula) || cedula === "0000000000")
    return "La cédula debe tener 10 dígitos.";
  const sum = COEFFICIENTS.reduce((total, coefficient, index) => {
    const product = Number(cedula[index]) * coefficient;
    return total + (product > 9 ? product - 9 : product);
  }, 0);
  const expected = (10 - (sum % 10)) % 10;
  if (Number(cedula[9]) !== expected)
    return "La cédula no es válida: revisa que los 10 dígitos estén bien escritos.";
  return null;
}
