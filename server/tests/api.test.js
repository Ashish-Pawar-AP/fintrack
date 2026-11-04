// Integration tests: real Express app + in-memory MongoDB. Needs `npm install` (supertest, mongodb-memory-server).
// mongodb-memory-server downloads a mongod binary the first time it runs, so it needs network access once.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod, app;
const pw = 'Passw0rd!x';

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret-'.padEnd(48, 'x');
  process.env.NODE_ENV = 'test';
  await mongoose.connect(process.env.MONGO_URI);
  app = (await import('../src/app.js')).default;
});
after(async () => { await mongoose.disconnect(); await mongod.stop(); });

async function signup(tag) {
  const email = `${tag}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const r = await request(app).post('/api/v1/auth/register').send({ name: `User ${tag}`, email, password: pw });
  assert.equal(r.status, 201);
  return { email, token: r.body.data.accessToken, cookie: r.headers['set-cookie'][0].split(';')[0] };
}
const as = (u) => ({ Authorization: `Bearer ${u.token}` });
const post = (u, path, body) => request(app).post(`/api/v1${path}`).set(as(u)).send(body);
const get = (u, path) => request(app).get(`/api/v1${path}`).set(as(u));

test('private routes need a token', async () => {
  assert.equal((await request(app).get('/api/v1/accounts')).status, 401);
});

test('user B can never read, change or use user A data', async () => {
  const a = await signup('a'), b = await signup('b');
  const acc = (await post(a, '/accounts', { name: 'A savings', openingBalance: 1000 })).body.data;

  assert.equal((await get(b, '/accounts')).body.data.length, 0);
  assert.equal((await request(app).patch(`/api/v1/accounts/${acc._id}`).set(as(b)).send({ name: 'hacked' })).status, 404);
  assert.equal((await request(app).delete(`/api/v1/accounts/${acc._id}`).set(as(b))).status, 404);
  const tx = await post(b, '/transactions', { type: 'EXPENSE', account: acc._id, amount: 10 });   // B uses A's account
  assert.equal(tx.status, 404);
  assert.equal((await get(a, '/accounts')).body.data[0].name, 'A savings');
});

test('validation errors are 422 with field messages', async () => {
  const a = await signup('v');
  const acc = (await post(a, '/accounts', { name: 'Main', openingBalance: 0 })).body.data;
  const r = await post(a, '/transactions', { type: 'EXPENSE', account: acc._id, amount: -5 });
  assert.equal(r.status, 422);
  assert.ok(r.body.error.fields.amount);
  assert.equal((await post(a, '/accounts', { openingBalance: 5 })).status, 422);   // name missing
});

test('transfers move money but are not expenses', async () => {
  const u = await signup('t');
  const one = (await post(u, '/accounts', { name: 'One', openingBalance: 0 })).body.data;
  const two = (await post(u, '/accounts', { name: 'Two', openingBalance: 0 })).body.data;
  await post(u, '/transactions', { type: 'INCOME', account: one._id, amount: 1000, category: 'Salary' });
  assert.equal((await post(u, '/transactions', { type: 'TRANSFER', account: one._id, toAccount: two._id, amount: 300 })).status, 201);

  const bal = Object.fromEntries((await get(u, '/accounts')).body.data.map((x) => [x.name, x.balance]));
  assert.deepEqual(bal, { One: 700, Two: 300 });
  const d = (await get(u, '/dashboard')).body.data;
  assert.equal(d.expenses.value, 0);
  assert.equal(d.income.value, 1000);
  assert.equal(d.cash.value, 1000);
});

test('parallel refresh calls with the same cookie both succeed (grace window)', async () => {
  const u = await signup('r');
  const call = () => request(app).post('/api/v1/auth/refresh').set('Cookie', u.cookie).send({});
  const [x, y] = await Promise.all([call(), call()]);
  assert.equal(x.status, 200);
  assert.equal(y.status, 200);
  assert.equal((await request(app).post('/api/v1/auth/refresh').set('Cookie', 'rt=bogus').send({})).status, 401);
});

test('password reset: single-use token, signs out other sessions', async () => {
  const u = await signup('p');
  const logs = [];
  const orig = console.log;
  console.log = (...a) => { logs.push(a.join(' ')); };
  try {
    const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' });
    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email: u.email });
    assert.equal(unknown.status, 200);                       // same answer whether or not the account exists
    assert.equal(known.status, 200);
    await new Promise((r) => setTimeout(r, 50));             // mail is sent without blocking the response
  } finally { console.log = orig; }
  const token = logs.join('\n').match(/token=([a-f0-9]+)/)?.[1];
  assert.ok(token, 'a reset link should have been generated');

  assert.equal((await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'short' })).status, 422);
  assert.equal((await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'NewPassw0rd!y' })).status, 200);
  assert.equal((await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'AnotherPass1!z' })).status, 400);   // single use
  assert.equal((await request(app).post('/api/v1/auth/refresh').set('Cookie', u.cookie).send({})).status, 401);                    // old session gone
  assert.equal((await request(app).post('/api/v1/auth/login').send({ email: u.email, password: pw })).status, 401);
  assert.equal((await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'NewPassw0rd!y' })).status, 200);
});
