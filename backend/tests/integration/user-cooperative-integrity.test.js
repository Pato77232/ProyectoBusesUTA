const {randomUUID}=require('node:crypto');
const {runMigration,testPool}=require('../helpers/database');
const {assertTestDatabase}=require('../../scripts/test-database');
let pool,cooperativeId;
// Las pruebas de migración pueden dejar revertidas las tablas de frecuencias: se limpian solo si existen.
async function clean(){
 assertTestDatabase();
 const {rows}=await pool.query("SELECT to_regclass('frequencies') IS NOT NULL AS exists");
 const tables=rows[0].exists
  ?'auth_sessions, users, cooperatives, frequency_segment_prices, frequency_stops, frequencies'
  :'auth_sessions, users, cooperatives';
 await pool.query(`TRUNCATE ${tables}`);
}
async function insertUser(role,cooperative= null){
 const email=`${randomUUID()}@example.ec`;
 return pool.query('INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4) RETURNING id',[email,'unused-test-hash',role,cooperative]);
}

const { randomUUID } = require('node:crypto');
const { runMigration, testPool } = require('../helpers/database');
const { assertTestDatabase } = require('../../scripts/test-database');

let pool, cooperativeId;

// Limpia las tablas, incluso cuando las migraciones de frecuencias
// han sido revertidas.
async function clean() {
  assertTestDatabase();

  const { rows } = await pool.query(
    "SELECT to_regclass('frequencies') IS NOT NULL AS exists"
  );

  const tables = rows[0].exists
    ? 'auth_sessions, users, cooperatives, frequency_segment_prices, frequency_stops, frequencies'
    : 'auth_sessions, users, cooperatives';

  await pool.query(`TRUNCATE ${tables}`);
}

async function insertUser(role, cooperative = null) {
  const email = `${randomUUID()}@example.ec`;

  return pool.query(
    'INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4) RETURNING id',
    [email, 'unused-test-hash', role, cooperative]
  );
}

// Revierte todas las migraciones hasta incluir
// la de integridad entre usuarios y cooperativas.
async function revertThroughForeignKey() {
  const { rows } = await pool.query(
    'SELECT name FROM pgmigrations ORDER BY id DESC'
  );

  const target = '1792280001000-user-cooperative-integrity';

  expect(rows.map(row => row.name)).toContain(target);

  for (const row of rows) {
    runMigration('down');

    if (row.name === target) {
      break;
    }
  }
}

beforeAll(() => {
  runMigration();
  pool = testPool();
});

beforeEach(async () => {
  await clean();

  const result = await pool.query(
    "INSERT INTO cooperatives(name,ruc) VALUES('Fixture integridad','0012345678901') RETURNING id"
  );

  cooperativeId = result.rows[0].id;
});

afterEach(async () => {
  await clean();
  runMigration();
});

afterAll(async () => {
  if (pool) await pool.end();
});

test.each(['SYSTEM_ADMIN', 'CUSTOMER'])(
  '%s exige cooperativa nula',
  async (role) => {
    await expect(insertUser(role)).resolves.toMatchObject({
      rowCount: 1
    });

    await expect(
      insertUser(role, cooperativeId)
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'users_cooperative_role_check'
    });
  }
);

test.each(['COOPERATIVE_ADMIN', 'CLERK'])(
  '%s exige cooperativa existente',
  async (role) => {
    await expect(insertUser(role)).rejects.toMatchObject({
      code: '23514',
      constraint: 'users_cooperative_role_check'
    });

    await expect(
      insertUser(role, randomUUID())
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'users_cooperative_id_fk'
    });

    await expect(
      insertUser(role, cooperativeId)
    ).resolves.toMatchObject({
      rowCount: 1
    });
  }
);

test('actualizaciones y borrado respetan integridad sin eliminar usuarios', async () => {
  const { rows } = await insertUser('CLERK', cooperativeId);
  const id = rows[0].id;

  await expect(
    pool.query("UPDATE users SET role='CUSTOMER' WHERE id=$1", [id])
  ).rejects.toMatchObject({ code: '23514' });

  await expect(
    pool.query('UPDATE users SET cooperative_id=NULL WHERE id=$1', [id])
  ).rejects.toMatchObject({ code: '23514' });

  await expect(
    pool.query('DELETE FROM cooperatives WHERE id=$1', [cooperativeId])
  ).rejects.toMatchObject({ code: '23503' });

  expect(
    (await pool.query(
      'SELECT cooperative_id FROM users WHERE id=$1',
      [id]
    )).rows[0].cooperative_id
  ).toBe(cooperativeId);
});

test('down conserva datos y up reaplica las restricciones', async () => {
  const { rows } = await insertUser('CLERK', cooperativeId);

  await revertThroughForeignKey();

  expect(
    (await pool.query('SELECT id FROM users')).rows
  ).toEqual(rows);

  runMigration();

  await expect(insertUser('CLERK')).rejects.toMatchObject({
    code: '23514'
  });
});

test.each([null, 'missing'])(
  'datos previos incompatibles (%s) hacen fallar up sin pérdida ni restricciones parciales',
  async (reference) => {
    await revertThroughForeignKey();

    const { rows } = await insertUser(
      'CLERK',
      reference === null ? null : randomUUID()
    );

    expect(() => runMigration()).toThrow();

    expect(
      (await pool.query('SELECT id FROM users')).rows
    ).toEqual(rows);

    const constraints = await pool.query(
      "SELECT conname FROM pg_constraint WHERE conname IN ('users_cooperative_role_check','users_cooperative_id_fk')"
    );

    expect(constraints.rows).toHaveLength(0);
  }
);

beforeAll(()=>{runMigration();pool=testPool();});
beforeEach(async()=>{
 await clean();const result=await pool.query("INSERT INTO cooperatives(name,ruc) VALUES('Fixture integridad','0012345678901') RETURNING id");cooperativeId=result.rows[0].id;
});
afterEach(async()=>{await clean();runMigration();});
afterAll(async()=>{if(pool)await pool.end();});
test.each(['SYSTEM_ADMIN','CUSTOMER'])('%s exige cooperativa nula',async(role)=>{
 await expect(insertUser(role)).resolves.toMatchObject({rowCount:1});
 await expect(insertUser(role,cooperativeId)).rejects.toMatchObject({code:'23514',constraint:'users_cooperative_role_check'});
});
test.each(['COOPERATIVE_ADMIN','CLERK'])('%s exige cooperativa existente',async(role)=>{
 await expect(insertUser(role)).rejects.toMatchObject({code:'23514',constraint:'users_cooperative_role_check'});
 await expect(insertUser(role,randomUUID())).rejects.toMatchObject({code:'23503',constraint:'users_cooperative_id_fk'});
 await expect(insertUser(role,cooperativeId)).resolves.toMatchObject({rowCount:1});
});
test('actualizaciones y borrado respetan integridad sin eliminar usuarios',async()=>{
 const {rows}=await insertUser('CLERK',cooperativeId);const id=rows[0].id;
 await expect(pool.query("UPDATE users SET role='CUSTOMER' WHERE id=$1",[id])).rejects.toMatchObject({code:'23514'});
 await expect(pool.query('UPDATE users SET cooperative_id=NULL WHERE id=$1',[id])).rejects.toMatchObject({code:'23514'});
 await expect(pool.query('DELETE FROM cooperatives WHERE id=$1',[cooperativeId])).rejects.toMatchObject({code:'23503'});
 expect((await pool.query('SELECT cooperative_id FROM users WHERE id=$1',[id])).rows[0].cooperative_id).toBe(cooperativeId);
});
test('down conserva datos y up reaplica las restricciones',async()=>{
 const {rows}=await insertUser('CLERK',cooperativeId);

test('down conserva datos y up reaplica las restricciones', async () => {
  const { rows } = await insertUser('CLERK', cooperativeId);

  await revertThroughForeignKey();

  expect(
    (await pool.query('SELECT id FROM users')).rows
  ).toEqual(rows);

  runMigration();

  await expect(insertUser('CLERK')).rejects.toMatchObject({
    code: '23514'
  });
});

test.each([null, 'missing'])(
  'datos previos incompatibles (%s) hacen fallar up sin pérdida ni restricciones parciales',
  async (reference) => {
    await revertThroughForeignKey();

    const { rows } = await insertUser(
      'CLERK',
      reference === null ? null : randomUUID()
    );

    expect(() => runMigration()).toThrow();

    expect(
      (await pool.query('SELECT id FROM users')).rows
    ).toEqual(rows);

    const constraints = await pool.query(
      "SELECT conname FROM pg_constraint WHERE conname IN ('users_cooperative_role_check','users_cooperative_id_fk')"
    );

    expect(constraints.rows).toHaveLength(0);
  }
);

 expect((await pool.query('SELECT id FROM users')).rows).toEqual(rows);
 const constraints=await pool.query("SELECT conname FROM pg_constraint WHERE conname IN ('users_cooperative_role_check','users_cooperative_id_fk')");
 expect(constraints.rows).toHaveLength(0);
});
