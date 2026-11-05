const { randomBytes } = require('node:crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CODE_BYTES = 16;
const BITS_PER_CHAR = 5;

/** Código opaco de 128 bits aleatorios en base32 (26 caracteres, sin relleno). */
function randomTicketCode(bytes = randomBytes(CODE_BYTES)) {
  let bits = 0;
  let value = 0;
  let code = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= BITS_PER_CHAR) {
      code += ALPHABET[(value >>> (bits - BITS_PER_CHAR)) & 31];
      bits -= BITS_PER_CHAR;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) code += ALPHABET[(value << (BITS_PER_CHAR - bits)) & 31];
  return code;
}

module.exports = randomTicketCode;
