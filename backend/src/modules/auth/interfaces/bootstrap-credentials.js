const { z } = require('zod');
const AuthError = require('../domain/auth-error');
const schema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().refine((value) => [...value].length >= 15 && [...value].length <= 128),
  })
  .strict();
function parseBootstrapCredentials(input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new AuthError('VALIDATION_ERROR');
  return result.data;
}
module.exports = parseBootstrapCredentials;
