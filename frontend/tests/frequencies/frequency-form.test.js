import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDraft,
  segments,
  editField,
  addStop,
  editStop,
  moveStop,
  removeStop,
  editPrice,
  reviewDraft,
} from '../../src/frequencies/frequency-form.js';

function direct() {
  let draft = createDraft();
  for (const [key, value] of Object.entries({
    origin: ' Ambato ',
    destination: 'Quito',
    departure_time: '00:00',
    ant_resolution_number: ' ANT-PRUEBA ',
  }))
    draft = editField(draft, key, value);
  return draft;
}
function prices(draft, values) {
  return segments(draft).reduce(
    (result, segment, index) => editPrice(result, segment.key, values[index]),
    draft,
  );
}
function withStop(draft, name) {
  draft = addStop(draft);
  return editStop(draft, draft.stops.at(-1).id, name);
}

test('directa válida: medianoche, trim y estado inicial; no añade tenant ni precios comerciales', () => {
  const result = reviewDraft(prices(direct(), ['4,50']));
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.data, {
    origin: 'Ambato',
    destination: 'Quito',
    departure_time: '00:00',
    ant_resolution_number: 'ANT-PRUEBA',
    status: 'ACTIVE',
    stops: [],
    segment_prices: [4.5],
  });
});
test('paradas ordenadas tienen un valor independiente por enlace, sin calcular boleto', () => {
  const draft = prices(withStop(direct(), 'Latacunga'), ['2', '3']);
  assert.deepEqual(reviewDraft(draft).data.segment_prices, [2, 3]);
  assert.deepEqual(reviewDraft(draft).data.stops, ['Latacunga']);
  assert.equal('amountCents' in reviewDraft(draft).data, false);
});
test('agregar parada borra el antiguo precio directo', () => {
  const before = prices(direct(), ['8']);
  const after = withStop(before, 'Latacunga');
  assert.deepEqual(Object.values(after.prices), ['', '']);
  assert.deepEqual(Object.values(before.prices), ['8']);
});
test('renombrar una parada borra solo sus enlaces y conserva los demás', () => {
  const before = prices(withStop(withStop(direct(), 'Latacunga'), 'Machachi'), [
    '2',
    '3',
    '4',
  ]);
  const after = editStop(before, before.stops[0].id, 'Salcedo');
  assert.deepEqual(Object.values(after.prices), ['', '', '4']);
});
test('reordenar no reasigna valores; volver al orden anterior no resucita valores', () => {
  const before = prices(withStop(withStop(direct(), 'Latacunga'), 'Machachi'), [
    '2',
    '3',
    '4',
  ]);
  const moved = moveStop(before, before.stops[1].id, -1);
  assert.deepEqual(
    moved.stops.map((row) => row.value),
    ['Machachi', 'Latacunga'],
  );
  assert.deepEqual(Object.values(moved.prices), ['', '', '']);
  assert.deepEqual(
    Object.values(moveStop(moved, moved.stops[0].id, 1).prices),
    ['', '', ''],
  );
  assert.equal(moveStop(before, before.stops[0].id, -1), before);
});
test('quitar parada exige volver a capturar el precio del enlace combinado', () => {
  const before = prices(withStop(direct(), 'Latacunga'), ['2', '3']);
  const after = removeStop(before, before.stops[0].id);
  assert.deepEqual(Object.values(after.prices), ['']);
});
test('cambiar origen invalida su enlace, no el enlace final; cambiar ANT no borra precios', () => {
  const before = prices(withStop(direct(), 'Latacunga'), ['2', '3']);
  assert.deepEqual(
    Object.values(editField(before, 'origin', 'Pelileo').prices),
    ['', '3'],
  );
  assert.deepEqual(
    editField(before, 'ant_resolution_number', 'OTRA').prices,
    before.prices,
  );
});
test('paradas vacías, repetidas o iguales a extremos muestran el campo afectado', () => {
  for (const names of [
    [''],
    [' ambato '],
    ['QUITO'],
    ['Latacunga', ' LATACUNGA '],
  ]) {
    let draft = direct();
    for (const name of names) draft = withStop(draft, name);
    const result = reviewDraft(draft);
    assert.ok(result.errors[draft.stops.at(-1).id]);
    assert.equal(result.data, null);
  }
});
test('campos obligatorios vacíos y extremos iguales no generan datos válidos', () => {
  assert.equal(Object.keys(reviewDraft(createDraft()).errors).length, 5);
  assert.ok(
    reviewDraft(editField(direct(), 'destination', ' ambato ')).errors
      .destination,
  );
});
test('valores deben ser USD explícitos, positivos y con hasta dos decimales', () => {
  for (const invalid of [
    '',
    '0',
    '-1',
    '1.234',
    '1,234',
    '1e2',
    '1 000',
    '1,000.00',
    'Infinity',
    '999999999',
    'abc',
  ]) {
    assert.ok(
      reviewDraft(prices(direct(), [invalid])).errors['price-0'],
      invalid,
    );
  }
  for (const valid of ['0.01', '12.30', '12,30', '99999999.99'])
    assert.deepEqual(reviewDraft(prices(direct(), [valid])).errors, {});
});
test('hora y estado inválidos se rechazan, sin inventar normalización', () => {
  for (const value of ['24:00', '12:60', '7:00', ''])
    assert.ok(
      reviewDraft(editField(direct(), 'departure_time', value)).errors
        .departure_time,
    );
  assert.ok(reviewDraft(editField(direct(), 'status', 'SOLD')).errors.status);
});
test('texto de lugares no se interpreta como HTML ni se modifica al revisar', () => {
  const draft = prices(
    editField(direct(), 'origin', '<img src=x onerror=alert(1)>'),
    ['1'],
  );
  const before = JSON.stringify(draft);
  assert.equal(reviewDraft(draft).data.origin, '<img src=x onerror=alert(1)>');
  assert.equal(JSON.stringify(draft), before);
});
test('no acepta campo tenant ni valores de un tramo ajeno', () => {
  assert.throws(() => editField(direct(), 'cooperative_id', 'otro'), TypeError);
  assert.throws(() => editPrice(direct(), 'desconocido', '10'), TypeError);
});
