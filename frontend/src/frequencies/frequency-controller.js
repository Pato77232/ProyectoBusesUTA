const SESSION = '/api/v1/auth/me';
const FREQUENCIES = '/api/v1/frequencies';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_FIELDS = [
  'origin',
  'destination',
  'departure_time',
  'ant_resolution_number',
  'status',
  'stops',
  'segment_prices',
];
const REJECTIONS = {
  VALIDATION_ERROR:
    'Revisa los datos de la frecuencia. El servidor no pudo aceptarlos.',
  FREQUENCY_REQUIRES_ANT_RESOLUTION: 'Introduce el número de resolución ANT.',
  FREQUENCY_SEGMENT_PRICES_MISMATCH:
    'Revisa que cada tramo del recorrido tenga su valor.',
  FREQUENCY_ALREADY_EXISTS:
    'Ya existe una frecuencia con ese origen, destino y hora en tu cooperativa. No se ha creado otra.',
  CSRF_TOKEN_INVALID:
    'La solicitud venció. Puedes volver a enviarla para renovar su protección.',
};

function identity(user) {
  return (
    user?.role === 'COOPERATIVE_ADMIN' &&
    UUID.test(user.id) &&
    UUID.test(user.cooperative_id)
  );
}

function matchesResponse(value, data, cooperativeId) {
  if (!value || !UUID.test(value.id) || value.cooperative_id !== cooperativeId)
    return false;
  return REQUEST_FIELDS.every(
    (key) => JSON.stringify(value[key]) === JSON.stringify(data[key]),
  );
}

export function createFrequencyController({ client, view }) {
  let busy = false,
    mode = 'checking',
    actor = null,
    ambiguous = false;
  function show(next, message, extra = {}) {
    mode = next;
    view.render({ mode, message, ...extra });
  }
  async function verify() {
    const result = await client.request(SESSION);
    if (
      !result?.user ||
      !UUID.test(result.user.id) ||
      !['SYSTEM_ADMIN', 'COOPERATIVE_ADMIN', 'CLERK', 'CUSTOMER'].includes(
        result.user.role,
      ) ||
      (result.user.role === 'COOPERATIVE_ADMIN' &&
        !UUID.test(result.user.cooperative_id))
    )
      throw new Error('Sesión no verificable.');
    if (!identity(result?.user)) {
      show(
        'forbidden',
        'Necesitas una sesión de administrador de cooperativa para crear frecuencias.',
      );
      return false;
    }
    if (
      actor &&
      (actor.id !== result.user.id ||
        actor.cooperative_id !== result.user.cooperative_id)
    ) {
      show(
        'forbidden',
        'La sesión cambió de usuario o cooperativa. Recarga la página para empezar con la sesión actual.',
      );
      return false;
    }
    actor = { id: result.user.id, cooperative_id: result.user.cooperative_id };
    return true;
  }
  function accessError(error) {
    if (error?.status === 401)
      show(
        'signed-out',
        'Tu sesión no está disponible o venció. Inicia sesión y compruébala de nuevo.',
      );
    else if (error?.status === 403)
      show(
        'forbidden',
        'No tienes permiso para crear frecuencias con esta sesión.',
      );
    else
      show(
        'check-error',
        'No pudimos comprobar tu sesión. Comprueba la conexión y vuelve a verificarla.',
      );
  }
  async function checkSession() {
    if (busy || mode === 'success') return;
    busy = true;
    show('checking', 'Comprobando sesión…');
    try {
      if (await verify()) {
        if (ambiguous)
          show(
            'uncertain',
            'La sesión es válida, pero no se pudo confirmar el registro anterior. No lo reenvíes sin comprobar antes si ya existe.',
          );
        else
          show(
            'ready',
            'Sesión verificada. Completa los datos para crear la frecuencia.',
          );
      }
    } catch (error) {
      accessError(error);
    } finally {
      busy = false;
    }
  }
  async function submit(data) {
    if (busy || mode !== 'ready' || ambiguous) return;
    const request = Object.fromEntries(
      REQUEST_FIELDS.map((key) => [
        key,
        Array.isArray(data[key]) ? [...data[key]] : data[key],
      ]),
    );
    busy = true;
    show('saving', 'Verificando sesión y guardando frecuencia…');
    try {
      // Revalidar identidad antes de cada mutación; nunca enviar tenant del formulario.
      try {
        if (!(await verify())) return;
      } catch (error) {
        accessError(error);
        return;
      }
      const response = await client.request(FREQUENCIES, {
        method: 'POST',
        data: request,
      });
      if (!matchesResponse(response?.frequency, request, actor.cooperative_id))
        throw new Error('Respuesta de alta no verificable.');
      show(
        'success',
        'Frecuencia creada. El origen, destino y hora de salida quedan sin edición.',
        { frequency: response.frequency },
      );
    } catch (error) {
      if (
        error?.status === 401 ||
        (error?.status === 403 && error?.code !== 'CSRF_TOKEN_INVALID')
      )
        accessError(error);
      else if (
        [400, 409, 429].includes(error?.status) ||
        error?.code === 'CSRF_TOKEN_INVALID'
      ) {
        show(
          'ready',
          REJECTIONS[error.code] ||
            'No se aceptó la solicitud. Revisa los datos o inténtalo más tarde.',
          {
            errorField:
              error.code === 'FREQUENCY_REQUIRES_ANT_RESOLUTION'
                ? 'ant_resolution_number'
                : undefined,
          },
        );
      } else {
        ambiguous = true;
        show(
          'uncertain',
          'No pudimos confirmar el resultado. La frecuencia podría haberse creado. No se reenviará automáticamente; comprueba su existencia antes de repetir el registro.',
        );
      }
    } finally {
      busy = false;
    }
  }
  async function startAnother() {
    if (busy || mode !== 'success') return;
    view.reset();
    mode = 'checking';
    await checkSession();
  }
  return { checkSession, submit, startAnother };
}
