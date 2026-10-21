import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { io as connect } from 'socket.io-client';
import { createApplication } from '../backend/app.js';
import User from '../backend/models/user.model.js';
import Message from '../backend/models/message.model.js';
import Session from '../backend/models/session.model.js';

const origin = 'http://localhost:3000';
const secret = 'test-only-secret-with-more-than-32-characters';
let mongo, service, url, alice, bob, eve;
const sockets = [];
const post = (path, cookie) =>
  request(service.app)
    .post(path)
    .set('Origin', origin)
    .set('Cookie', cookie || '');
const get = (path, cookie) =>
  request(service.app)
    .get(path)
    .set('Cookie', cookie || '');
const cookieFrom = (res) => res.headers['set-cookie'][0].split(';')[0];
function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, handler);
      reject(new Error(`Timed out: ${name}`));
    }, 5000);
    function handler(data) {
      clearTimeout(timer);
      resolve(data);
    }
    socket.once(name, handler);
  });
}
function socket(cookie, extra = {}) {
  const client = connect(url, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
    extraHeaders: { Origin: origin, Cookie: cookie || '' },
    ...extra,
  });
  sockets.push(client);
  return client;
}
async function register(username) {
  const res = await post('/api/auth/signup')
    .send({
      fullName: `${username} Example`,
      username,
      password: 'correct-horse-123',
      confirmPassword: 'correct-horse-123',
    })
    .expect(201);
  assert.equal(res.body.password, undefined);
  return { ...res.body, cookie: cookieFrom(res) };
}
before(
  async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all([User.init(), Message.init(), Session.init()]);
    service = createApplication({ secret, origin });
    await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${service.server.address().port}`;
    alice = await register('alice');
    bob = await register('bobby');
    eve = await register('evelyn');
  },
  { timeout: 180000 },
);
after(async () => {
  sockets.forEach((s) => s.disconnect());
  if (service) await new Promise((resolve) => service.io.close(resolve));
  await mongoose.disconnect();
  await mongo?.stop();
});

test('protected HTTP routes reject missing, forged and expired tokens without leaking data', async () => {
  await get('/api/users').expect(401);
  await get('/api/auth/me', 'chattersphere_session=forged').expect(401);
  await get(`/api/messages/${bob._id}`).expect(401);
  await get('/api/auth/me', alice.cookie)
    .expect(200)
    .expect(({ body }) => assert.equal(body.username, 'alice'));
  const jwt = (await import('jsonwebtoken')).default;
  const expired = jwt.sign({ userId: alice._id, sid: 'not-a-session' }, secret, { expiresIn: -1 });
  await get('/api/auth/me', `chattersphere_session=${expired}`).expect(401);
});
test('signup validates data and rejects object-based query injection and duplicate names', async () => {
  await post('/api/auth/signup')
    .send({ username: { $ne: '' }, fullName: 'x', password: 'x' })
    .expect(400);
  await post('/api/auth/login')
    .send({ username: { $ne: '' }, password: 'x' })
    .expect(400);
  await post('/api/auth/signup')
    .send({
      fullName: 'Another Alice',
      username: 'alice',
      password: 'correct-horse-123',
      confirmPassword: 'correct-horse-123',
    })
    .expect(409);
  await post('/api/auth/login').send({ username: 'alice', password: 'wrong-password' }).expect(401);
  const login = await post('/api/auth/login')
    .send({ username: 'alice', password: 'correct-horse-123' })
    .expect(200);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  assert.match(login.headers['set-cookie'][0], /SameSite=Strict/);
  assert.equal(login.body.password, undefined);
  const stored = await User.findById(alice._id).select('+password');
  assert.notEqual(stored.password, 'correct-horse-123');
});
test('cross-site writes and socket connections are rejected, oversized input is bounded', async () => {
  await request(service.app)
    .post('/api/auth/login')
    .set('Origin', 'https://evil.example')
    .send({})
    .expect(403);
  await request(service.app)
    .post('/api/auth/login')
    .set('Origin', origin)
    .type('form')
    .send('username=alice')
    .expect(415);
  await post('/api/auth/login')
    .send({ payload: 'x'.repeat(20000) })
    .expect(413);
  const bad = socket(alice.cookie, {
    extraHeaders: { Origin: 'https://evil.example', Cookie: alice.cookie },
  });
  const failed = event(bad, 'connect_error');
  bad.connect();
  await failed;
});
test('sockets require a real session and ignore client-supplied identity', async () => {
  const anonymous = socket('', { query: { userId: alice._id } });
  const failed = event(anonymous, 'connect_error');
  anonymous.connect();
  assert.match((await failed).message, /Unauthorized/);
  const authenticated = socket(alice.cookie, { query: { userId: bob._id } });
  const presence = event(authenticated, 'getOnlineUsers');
  authenticated.connect();
  const ids = await presence;
  assert.ok(ids.includes(alice._id));
  assert.ok(!ids.includes(bob._id));
  authenticated.disconnect();
});
test('real messages are stored once, delivered to all recipient devices, and isolated from a third user', async () => {
  const b1 = socket(bob.cookie),
    b2 = socket(bob.cookie),
    a = socket(alice.cookie),
    e = socket(eve.cookie);
  for (const s of [b1, b2, a, e]) {
    const connected = event(s, 'connect');
    s.connect();
    await connected;
  }
  let leaked = false;
  e.on('newMessage', () => {
    leaked = true;
  });
  const deliveries = [event(b1, 'newMessage'), event(b2, 'newMessage'), event(a, 'newMessage')];
  const clientMessageId = randomUUID();
  const payload = {
    message: 'Hello Bob <script>alert(1)</script>',
    clientMessageId,
    senderId: eve._id,
  };
  const response = await post(`/api/messages/send/${bob._id}`, alice.cookie)
    .send(payload)
    .expect(201);
  for (const delivered of await Promise.all(deliveries))
    assert.equal(delivered._id, response.body._id);
  assert.equal(response.body.senderId, alice._id);
  await post(`/api/messages/send/${bob._id}`, alice.cookie).send(payload).expect(200);
  assert.equal(await Message.countDocuments({ senderId: alice._id, clientMessageId }), 1);
  await post(`/api/messages/send/${bob._id}`, alice.cookie)
    .send({ ...payload, message: 'Changed payload' })
    .expect(409);
  const history = await get(`/api/messages/${alice._id}`, bob.cookie).expect(200);
  assert.ok(history.body.messages.some((m) => m._id === response.body._id));
  const forbidden = await get(`/api/messages/${bob._id}`, eve.cookie).expect(200);
  assert.equal(forbidden.body.messages.length, 0);
  const inbox = await get('/api/conversations', bob.cookie).expect(200);
  assert.equal(inbox.body[0].user._id, alice._id);
  assert.equal(inbox.body[0].user.password, undefined);
  assert.equal(leaked, false);
  const update = event(b2, 'getOnlineUsers');
  b1.disconnect();
  assert.ok((await update).includes(bob._id));
  for (const s of [b2, a, e]) s.disconnect();
});
test('message validation rejects malformed IDs, nonexistent recipients and blank messages', async () => {
  for (const id of ['wrong-id', alice._id])
    await post(`/api/messages/send/${id}`, alice.cookie)
      .send({ message: 'hi', clientMessageId: randomUUID() })
      .expect(400);
  await post(`/api/messages/send/${bob._id}`, alice.cookie)
    .send({ message: ' ', clientMessageId: randomUUID() })
    .expect(400);
  await post(`/api/messages/send/${bob._id}`, alice.cookie)
    .send({ message: 'x'.repeat(4001), clientMessageId: randomUUID() })
    .expect(400);
  await post('/api/messages/send/111111111111111111111111', alice.cookie)
    .send({ message: 'hi', clientMessageId: randomUUID() })
    .expect(404);
  await get('/api/messages/invalid', alice.cookie).expect(400);
  await get(`/api/messages/${bob._id}?before=invalid`, alice.cookie).expect(400);
});
test('history pagination returns non-overlapping pages and people search excludes secrets', async () => {
  await Message.insertMany(
    Array.from({ length: 45 }, (_, n) => ({
      senderId: alice._id,
      receiverId: bob._id,
      message: `Page message ${n}`,
      clientMessageId: randomUUID(),
    })),
  );
  const first = await get(`/api/messages/${bob._id}`, alice.cookie).expect(200);
  assert.equal(first.body.messages.length, 40);
  assert.ok(first.body.nextCursor);
  const second = await get(
    `/api/messages/${bob._id}?before=${first.body.nextCursor}`,
    alice.cookie,
  ).expect(200);
  assert.equal(second.body.messages.length, 6);
  assert.ok(second.body.messages.every((m) => !first.body.messages.some((n) => n._id === m._id)));
  const users = await get('/api/users?q=bob', alice.cookie).expect(200);
  assert.equal(users.body.users[0].username, 'bobby');
  assert.equal(users.body.users[0].password, undefined);
  const literal = await get('/api/users?q=%2E%2A', alice.cookie).expect(200);
  assert.equal(literal.body.users.length, 0);
});
test('logout revokes replayed cookies and disconnects only that authenticated session', async () => {
  const active = socket(alice.cookie),
    other = socket(bob.cookie);
  for (const s of [active, other]) {
    const connected = event(s, 'connect');
    s.connect();
    await connected;
  }
  const disconnected = event(active, 'disconnect');
  await post('/api/auth/logout', alice.cookie).send({}).expect(200);
  await disconnected;
  assert.equal(other.connected, true);
  await get('/api/auth/me', alice.cookie).expect(401);
  const replay = socket(alice.cookie),
    failed = event(replay, 'connect_error');
  replay.connect();
  await failed;
  other.disconnect();
});
test('health, security headers and unknown API errors are explicit', async () => {
  await get('/api/health').expect(200).expect('x-content-type-options', 'nosniff');
  await get('/api/missing').expect(404).expect('Content-Type', /json/);
  assert.throws(() => createApplication({ secret: 'short' }), /JWT_SECRET/);
  assert.throws(() => createApplication({ secret, production: true, origin }), /HTTPS/);
});

test('production responses mark session cookies Secure and enforce an HTTPS origin', async () => {
  const production = createApplication({
    secret,
    production: true,
    origin: 'https://chat.example.com',
  });
  const response = await request(production.app)
    .post('/api/auth/login')
    .set('Origin', 'https://chat.example.com')
    .send({ username: 'bobby', password: 'correct-horse-123' })
    .expect(200);
  assert.match(response.headers['set-cookie'][0], /; Secure/);
  assert.match(response.headers['strict-transport-security'], /max-age=/);
  await new Promise((resolve) => production.io.close(resolve));
});
test('session expiration closes an already connected socket and prevents replay', async () => {
  const sid = randomUUID();
  await Session.create({ _id: sid, userId: bob._id, expiresAt: new Date(Date.now() + 600) });
  const jwt = (await import('jsonwebtoken')).default;
  const token = jwt.sign({ userId: bob._id, sid }, secret, { expiresIn: '1h' });
  const cookie = `chattersphere_session=${token}`;
  const client = socket(cookie);
  const connected = event(client, 'connect');
  const disconnected = event(client, 'disconnect');
  client.connect();
  await connected;
  await disconnected;
  await get('/api/auth/me', cookie).expect(401);
});
test('authentication and per-user send limits return structured 429 errors', async () => {
  let authLimited = false;
  for (let i = 0; i < 31; i++) {
    const response = await post('/api/auth/login').send({ username: {}, password: 'x' });
    if (response.status === 429) {
      assert.match(response.body.error, /Too many/);
      authLimited = true;
      break;
    }
  }
  assert.ok(authLimited);
  let messageLimited = false;
  for (let i = 0; i < 61; i++) {
    const response = await post(`/api/messages/send/${eve._id}`, bob.cookie).send({
      message: ' ',
      clientMessageId: randomUUID(),
    });
    if (response.status === 429) {
      assert.match(response.body.error, /too quickly/);
      messageLimited = true;
      break;
    }
  }
  assert.ok(messageLimited);
});
