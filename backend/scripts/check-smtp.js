const { randomUUID } = require('node:crypto');
const { createSmtpMailer } = require('../src/shared/mail/smtp-mailer');
async function run({
  env = process.env,
  args = process.argv.slice(2),
  createMailer = createSmtpMailer,
  output = (value) => process.stdout.write(JSON.stringify(value) + '\n'),
} = {}) {
  try {
    if (args.length > 1 || (args.length === 1 && !['--verify', '--send-test'].includes(args[0]))) {
      output({ status: 'FAILED', code: 'MAIL_COMMAND_INVALID' });
      return 1;
    }
    const mailer = createMailer(env);
    if (args[0] === '--send-test') {
      if (!env.SMTP_TEST_TO) {
        output({ status: 'FAILED', code: 'MAIL_TEST_RECIPIENT_REQUIRED' });
        return 1;
      }
      output(
        await mailer.send({
          to: env.SMTP_TEST_TO,
          notificationId: randomUUID(),
          subject: 'Prueba de correo de transViaje',
          text: 'Prueba solicitada por el operador. Confirma la recepción en tu propio buzón.',
        }),
      );
    } else output(await mailer.verify());
    return 0;
  } catch (error) {
    const known = [
      'MAIL_NOT_CONFIGURED',
      'MAIL_CONFIG_INVALID',
      'MAIL_CONNECTION_FAILED',
      'MAIL_INVALID_MESSAGE',
      'MAIL_OUTCOME_UNCERTAIN',
      'MAIL_NOT_ACCEPTED',
    ];
    output({
      status: 'FAILED',
      code: known.includes(error?.code) ? error.code : 'MAIL_CHECK_FAILED',
    });
    return 1;
  }
}
if (require.main === module)
  run().then((code) => {
    process.exitCode = code;
  });
module.exports = { run };
