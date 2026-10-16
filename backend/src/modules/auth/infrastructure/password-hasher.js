const argon2 = require('argon2');
const { randomBytes } = require('node:crypto');
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};
async function createHasher() {
  const hash = (password) => argon2.hash(password, { ...HASH_OPTIONS, salt: randomBytes(16) });
  const dummyHash = await hash(randomBytes(32).toString('hex'));
  return { hash, dummyHash, verify: (digest, password) => argon2.verify(digest, password) };
}
module.exports = { createHasher, HASH_OPTIONS };
