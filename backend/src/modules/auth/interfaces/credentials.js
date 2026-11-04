const { z } = require('zod');
const credentials = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().refine((value) => [...value].length >= 15 && [...value].length <= 128),
  })
  .strict();
function validateCredentials(req, res, next) {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Datos de acceso inválidos.' } });
  req.credentials = parsed.data;
  next();
}
module.exports = validateCredentials;
