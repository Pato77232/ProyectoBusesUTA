const {
  createCounterSales,
  counterClerk,
} = require('../../../src/modules/bookings/application/counter-sales');
const BookingCashError = require('../../../src/modules/bookings/domain/booking-cash-error');

const COOP = '8f1c2a4e-0b7d-4f3e-9a51-3c2d1e0f9a87';
const CLERK_ID = '1a2b3c4d-0b7d-4f3e-9a51-3c2d1e0f9a87';
const RECEIPT = '6f1c2a4e-0b7d-4f3e-9a51-3c2d1e0f9a87';
const clerkContext = (user = {}) => ({
  sid: 'sesion',
  user: { id: CLERK_ID, role: 'CLERK', cooperative_id: COOP, ...user },
});

describe('BOOK-CAJA-02: oficinista de boletería', () => {
  test('la cooperativa y el propietario salen de la sesión del oficinista', () => {
    expect(counterClerk(clerkContext())).toEqual({
      actorId: CLERK_ID,
      cooperativeId: COOP,
      ownerId: `counter:${COOP}`,
    });
  });

  test('otros roles o sesiones incompletas no usan la boletería', () => {
    expect(() => counterClerk(clerkContext({ role: 'CUSTOMER' }))).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => counterClerk(clerkContext({ cooperative_id: null }))).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => counterClerk({ user: clerkContext().user })).toThrow(
      expect.objectContaining({ code: 'UNAUTHENTICATED' }),
    );
  });
});

describe('BOOK-CAJA-02: cobro en efectivo', () => {
  const setup = (confirmCash = jest.fn(async (input) => ({ ...input, status: 'SOLD' }))) => ({
    confirmCash,
    sales: createCounterSales({ dependencies: {}, cashSales: { confirmCash } }),
  });

  test('envía el cobro con la cooperativa y el actor de la sesión', async () => {
    const { confirmCash, sales } = setup();
    await sales.confirmCash('b-1', { cashReceiptId: RECEIPT, amountCents: 550 }, clerkContext());
    expect(confirmCash).toHaveBeenCalledWith({
      bookingId: 'b-1',
      cashReceiptId: RECEIPT,
      amountCents: 550,
      actorId: CLERK_ID,
      cooperativeId: COOP,
      ownerId: `counter:${COOP}`,
    });
  });

  test.each([
    ['sin recibo', { amountCents: 550 }],
    ['recibo que no es UUID v4', { cashReceiptId: 'recibo-1', amountCents: 550 }],
    ['importe cero', { cashReceiptId: RECEIPT, amountCents: 0 }],
    ['importe decimal', { cashReceiptId: RECEIPT, amountCents: 5.5 }],
    ['campos extra', { cashReceiptId: RECEIPT, amountCents: 550, cooperativeId: COOP }],
  ])('rechaza un cobro %s sin llamar al registro', async (_, body) => {
    const { confirmCash, sales } = setup();
    await expect(sales.confirmCash('b-1', body, clerkContext())).rejects.toMatchObject({
      code: 'BOOKING_VALIDATION_ERROR',
    });
    expect(confirmCash).not.toHaveBeenCalled();
  });

  test('un fallo desconocido se informa como incierto para no cobrar dos veces', async () => {
    const { sales } = setup(
      jest.fn(async () => {
        throw new Error('red');
      }),
    );
    await expect(
      sales.confirmCash('b-1', { cashReceiptId: RECEIPT, amountCents: 550 }, clerkContext()),
    ).rejects.toMatchObject({ code: 'BOOKING_CASH_UNCERTAIN' });
  });

  test('los errores de cobro conocidos se conservan', async () => {
    const { sales } = setup(
      jest.fn(async () => {
        throw new BookingCashError('BOOKING_CASH_EXPIRED');
      }),
    );
    await expect(
      sales.confirmCash('b-1', { cashReceiptId: RECEIPT, amountCents: 550 }, clerkContext()),
    ).rejects.toMatchObject({ code: 'BOOKING_CASH_EXPIRED' });
  });
});
