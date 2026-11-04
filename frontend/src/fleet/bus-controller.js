// FLEET-05 T3: conecta el formulario con la API. El backend decide; aquí solo se orienta.
const SESSION = '/api/v1/auth/me';
const BUS_GROUPS = '/api/v1/bus-groups';
const SEAT_LAYOUTS = '/api/v1/seat-layouts';
const BUSES = '/api/v1/buses';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNCERTAIN_STATUSES = [502, 503, 504];
const UNCERTAIN_CODES = ['NETWORK_ERROR', 'RESPONSE_INVALID'];

const REJECTIONS = {
  VALIDATION_ERROR: 'Revisa los datos y las fotografías. El servidor no pudo aceptarlos.',
  SEAT_LAYOUT_NOT_FOUND: 'La plantilla elegida ya no está disponible. Recarga la página.',
  BUS_ALREADY_EXISTS:
    'La placa, el chasis o el número de unidad ya están registrados. No se creó otro bus.',
  PAYLOAD_TOO_LARGE: 'Las fotografías superan el tamaño permitido.',
  UNSUPPORTED_MEDIA_TYPE: 'El envío no tiene el formato esperado. Recarga la página.',
  CSRF_TOKEN_INVALID: 'La solicitud venció. Puedes volver a enviarla para renovar su protección.',
};
const UNCERTAIN =
  'No pudimos confirmar si el bus se registró. Comprueba si ya existe antes de volver a enviarlo: ' +
  'si se registró, un nuevo envío indicará que la placa ya existe.';

function isAdmin(user) {
  return user?.role === 'COOPERATIVE_ADMIN' && UUID.test(user.id) && UUID.test(user.cooperative_id);
}

function isRegisteredBus(bus) {
  return (
    UUID.test(bus?.id) &&
    typeof bus.plate === 'string' &&
    Number.isSafeInteger(bus.unitNumber) &&
    Number.isSafeInteger(bus.capacity)
  );
}

function busFormData(data, files) {
  const formData = new FormData();
  formData.set('data', JSON.stringify(data));
  for (const file of files) formData.append('photos', file, file.name);
  return formData;
}

export function createBusController({ client, view }) {
  let busy = false;
  let actor = null;

  function accessError(error) {
    if (error?.status === 401)
      view.signedOut('Tu sesión no está disponible o venció. Inicia sesión.');
    else if (error?.status === 403) view.blocked('No tienes permiso para registrar buses.');
    else view.blocked('No pudimos cargar la pantalla. Comprueba la conexión y recarga la página.');
  }

  // La cooperativa nunca sale del formulario: se toma de la sesión verificada.
  async function verifySession() {
    const { user } = (await client.request(SESSION)) ?? {};
    if (!isAdmin(user)) {
      view.blocked('Necesitas una sesión de administrador de cooperativa para registrar buses.');
      return false;
    }
    if (actor && (actor.id !== user.id || actor.cooperative_id !== user.cooperative_id)) {
      view.blocked('La sesión cambió de usuario o cooperativa. Recarga la página.');
      return false;
    }
    actor = { id: user.id, cooperative_id: user.cooperative_id };
    return true;
  }

  async function start() {
    view.status('Comprobando tu sesión…', 'info');
    try {
      if (!(await verifySession())) return;
      const [{ busGroups }, { seatLayouts }] = await Promise.all([
        client.request(BUS_GROUPS),
        client.request(SEAT_LAYOUTS),
      ]);
      view.mount({ busGroups, seatLayouts, onValid: submit });
    } catch (error) {
      accessError(error);
    }
  }

  async function reloadGroups() {
    try {
      const { busGroups } = await client.request(BUS_GROUPS);
      view.replaceGroups(busGroups);
      view.status(
        'El grupo elegido ya no está disponible. Elige otro de la lista actualizada.',
        'error',
      );
    } catch (error) {
      accessError(error);
    }
  }

  function rejected(error) {
    if (error?.status === 401 || (error?.status === 403 && error.code !== 'CSRF_TOKEN_INVALID'))
      return accessError(error);
    if (error?.status === 404) return reloadGroups();
    if (UNCERTAIN_STATUSES.includes(error?.status) || UNCERTAIN_CODES.includes(error?.code))
      return view.status(UNCERTAIN, 'error');
    view.status(
      REJECTIONS[error?.code] ??
        'No se aceptó el registro. Revisa los datos o inténtalo más tarde.',
      'error',
    );
  }

  async function submit(data, files) {
    if (busy) return;
    busy = true;
    view.busy(true);
    view.status('Registrando el bus y subiendo las fotografías…', 'info');
    try {
      if (!(await verifySession())) return;
      const response = await client.request(BUSES, {
        method: 'POST',
        formData: busFormData(data, files),
      });
      // Un éxito sin los datos esperados no prueba ni el alta ni el rechazo.
      if (isRegisteredBus(response?.bus)) view.registered(response.bus);
      else view.status(UNCERTAIN, 'error');
    } catch (error) {
      rejected(error);
    } finally {
      busy = false;
      view.busy(false);
    }
  }

  return { start, submit };
}
