import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import User from './models/user.model.js';
import Message from './models/message.model.js';
import Session from './models/session.model.js';

const publicUser = (u) => ({ _id: String(u._id), fullName: u.fullName, username: u.username });
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
const usernamePattern = /^[a-z0-9_]{3,24}$/;
const cookieName = 'chattersphere_session';
const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const frontend = fileURLToPath(new URL('../frontend/dist/', import.meta.url));

export function createApplication({
  secret,
  origin = 'http://localhost:3000',
  production = false,
  trustProxy = false,
} = {}) {
  if (!secret || secret.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters');
  const allowedOrigin = new URL(origin).origin;
  if (production && !allowedOrigin.startsWith('https://'))
    throw new Error('APP_ORIGIN must use HTTPS in production');
  const app = express();
  const server = createServer(app);
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'connect-src': ["'self'", allowedOrigin.replace(/^http/, 'ws')],
          'upgrade-insecure-requests': production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 240,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again shortly.' },
    }),
  );
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // Explicit origin validation also protects login/signup from cross-site session swapping.
    if (req.get('Origin') !== allowedOrigin)
      return res.status(403).json({ error: 'Request origin is not allowed' });
    if (!req.is('application/json'))
      return res.status(415).json({ error: 'Send application/json' });
    next();
  });
  const io = new Server(server, {
    maxHttpBufferSize: 16384,
    cors: { origin: allowedOrigin, credentials: true },
    // Same-origin polling GETs can omit Origin; cross-origin browser requests cannot.
    // A verified HttpOnly session is still mandatory for every connection.
    allowRequest: (req, callback) =>
      callback(null, !req.headers.origin || req.headers.origin === allowedOrigin),
  });
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/' };
  async function authenticate(cookies = {}) {
    try {
      const payload = jwt.verify(cookies[cookieName], secret, { algorithms: ['HS256'] });
      if (!validId(payload.userId) || typeof payload.sid !== 'string') return null;
      const session = await Session.findOne({
        _id: payload.sid,
        userId: payload.userId,
        expiresAt: { $gt: new Date() },
      });
      if (!session) return null;
      const user = await User.findById(payload.userId).select('fullName username');
      return user ? { user, sid: session._id, expiresAt: session.expiresAt } : null;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError)
        return null;
      throw error;
    }
  }
  const protect = route(async (req, res, next) => {
    const identity = await authenticate(req.cookies);
    if (!identity) return res.status(401).json({ error: 'Please sign in again' });
    req.identity = identity;
    next();
  });
  async function signIn(user, res) {
    const sid = randomUUID();
    await Session.create({
      _id: sid,
      userId: user._id,
      expiresAt: new Date(Date.now() + sessionDuration),
    });
    const token = jwt.sign({ userId: String(user._id), sid }, secret, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionDuration });
  }
  const authLimiter = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
  });
  app.get('/api/health', (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable' });
  });
  app.post(
    '/api/auth/signup',
    authLimiter,
    route(async (req, res) => {
      const { fullName, username, password, confirmPassword } = req.body ?? {};
      if (
        typeof fullName !== 'string' ||
        fullName.trim().length < 2 ||
        fullName.trim().length > 60 ||
        typeof username !== 'string' ||
        !usernamePattern.test(username) ||
        typeof password !== 'string' ||
        password.length < 10 ||
        Buffer.byteLength(password) > 72 ||
        password !== confirmPassword
      ) {
        return res.status(400).json({
          error:
            'Use a name (2–60 characters), a username (3–24 lowercase letters, numbers or _), and matching passwords (10–72 bytes).',
        });
      }
      const user = await User.create({
        fullName: fullName.trim(),
        username,
        password: await bcrypt.hash(password, 12),
      });
      await signIn(user, res);
      res.status(201).json(publicUser(user));
    }),
  );
  app.post(
    '/api/auth/login',
    authLimiter,
    route(async (req, res) => {
      const { username, password } = req.body ?? {};
      if (
        typeof username !== 'string' ||
        !usernamePattern.test(username) ||
        typeof password !== 'string' ||
        Buffer.byteLength(password) > 72
      ) {
        return res.status(400).json({ error: 'Enter a valid username and password' });
      }
      const user = await User.findOne({ username }).select('+password');
      // Run bcrypt even for unknown accounts to avoid a simple account timing oracle.
      const correct = await bcrypt.compare(
        password,
        user?.password ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5sLYRrxYIyzzqxZ9skivjYlwLHeXZ3e',
      );
      if (!user || !correct)
        return res.status(401).json({ error: 'Username or password is incorrect' });
      await signIn(user, res);
      res.json(publicUser(user));
    }),
  );
  app.get('/api/auth/me', protect, (req, res) => res.json(publicUser(req.identity.user)));
  app.post(
    '/api/auth/logout',
    protect,
    route(async (req, res) => {
      await Session.deleteOne({ _id: req.identity.sid });
      io.in(`session:${req.identity.sid}`).disconnectSockets(true);
      res.clearCookie(cookieName, cookieOptions).json({ message: 'Signed out' });
    }),
  );
  app.get(
    '/api/users',
    protect,
    route(async (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
      const filter = { _id: { $ne: req.identity.user._id } };
      if (req.query.after) {
        if (!validId(req.query.after)) return res.status(400).json({ error: 'Invalid cursor' });
        filter._id.$gt = req.query.after;
      }
      if (q) {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { username: { $regex: escaped, $options: 'i' } },
          { fullName: { $regex: escaped, $options: 'i' } },
        ];
      }
      const users = await User.find(filter).select('fullName username').sort({ _id: 1 }).limit(31);
      res.json({
        users: users.slice(0, 30).map(publicUser),
        nextCursor: users.length > 30 ? String(users[29]._id) : null,
      });
    }),
  );
  app.get(
    '/api/conversations',
    protect,
    route(async (req, res) => {
      const me = req.identity.user._id;
      const conversations = await Message.aggregate([
        { $match: { $or: [{ senderId: me }, { receiverId: me }] } },
        { $sort: { _id: -1 } },
        {
          $group: {
            _id: { $cond: [{ $eq: ['$senderId', me] }, '$receiverId', '$senderId'] },
            lastMessage: { $first: '$$ROOT' },
          },
        },
        { $sort: { 'lastMessage._id': -1 } },
        { $limit: 100 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'person' } },
        { $unwind: '$person' },
        {
          $project: {
            _id: 0,
            user: {
              _id: '$person._id',
              fullName: '$person.fullName',
              username: '$person.username',
            },
            lastMessage: 1,
          },
        },
      ]);
      res.json(conversations);
    }),
  );
  app.get(
    '/api/messages/:id',
    protect,
    route(async (req, res) => {
      const other = req.params.id;
      if (!validId(other) || (req.query.before && !validId(req.query.before)))
        return res.status(400).json({ error: 'Invalid conversation or cursor' });
      const me = req.identity.user._id;
      const filter = {
        $or: [
          { senderId: me, receiverId: other },
          { senderId: other, receiverId: me },
        ],
      };
      if (req.query.before) filter._id = { $lt: req.query.before };
      const messages = await Message.find(filter).sort({ _id: -1 }).limit(41).lean();
      const page = messages.slice(0, 40).reverse();
      res.json({ messages: page, nextCursor: messages.length > 40 ? String(page[0]._id) : null });
    }),
  );
  const messageLimiter = rateLimit({
    windowMs: 60000,
    limit: 60,
    keyGenerator: (req) => String(req.identity.user._id),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'You are sending too quickly. Wait a moment.' },
  });
  app.post(
    '/api/messages/send/:id',
    protect,
    messageLimiter,
    route(async (req, res) => {
      const { message, clientMessageId } = req.body ?? {};
      const receiverId = req.params.id.toLowerCase();
      const senderId = req.identity.user._id;
      if (
        !validId(receiverId) ||
        receiverId === String(senderId) ||
        typeof message !== 'string' ||
        !message.trim() ||
        message.length > 4000 ||
        typeof clientMessageId !== 'string' ||
        !/^[a-f0-9-]{36}$/i.test(clientMessageId)
      )
        return res.status(400).json({ error: 'Send 1–4000 characters to a valid recipient' });
      if (!(await User.exists({ _id: receiverId })))
        return res.status(404).json({ error: 'Recipient not found' });
      let saved;
      try {
        saved = await Message.create({
          senderId,
          receiverId,
          message: message.trim(),
          clientMessageId,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        saved = await Message.findOne({ senderId, clientMessageId });
        if (String(saved.receiverId) !== receiverId || saved.message !== message.trim())
          return res.status(409).json({ error: 'This message ID was already used' });
        return res.json(saved);
      }
      // One atomic document is the source of truth; no conversation message-ID array to desynchronize.
      io.to(`user:${receiverId}`).to(`user:${senderId}`).emit('newMessage', saved);
      res.status(201).json(saved);
    }),
  );
  const presence = new Map();
  io.use(async (socket, next) => {
    try {
      const req = { headers: socket.request.headers };
      cookieParser()(req, {}, () => {});
      const identity = await authenticate(req.cookies);
      if (!identity) return next(new Error('Unauthorized'));
      socket.data.identity = identity;
      next();
    } catch {
      next(new Error('Authentication unavailable'));
    }
  });
  io.on('connection', async (socket) => {
    const { user, sid, expiresAt } = socket.data.identity;
    const id = String(user._id);
    socket.join(`session:${sid}`);
    // Join the revocation room before rechecking. A concurrent logout either
    // disconnects this socket through the room or is caught by this final lookup.
    try {
      const active = await Session.exists({ _id: sid, expiresAt: { $gt: new Date() } });
      if (!active || !socket.connected) return socket.disconnect(true);
    } catch {
      return socket.disconnect(true);
    }
    socket.join(`user:${id}`);
    const connections = presence.get(id) ?? new Set();
    connections.add(socket.id);
    presence.set(id, connections);
    io.emit('getOnlineUsers', [...presence.keys()]);
    const timeout = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, expiresAt.getTime() - Date.now()),
    );
    timeout.unref();
    socket.on('disconnect', () => {
      clearTimeout(timeout);
      connections.delete(socket.id);
      if (!connections.size) presence.delete(id);
      io.emit('getOnlineUsers', [...presence.keys()]);
    });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
  app.use(express.static(frontend));
  app.get('*', (_req, res) => res.sendFile(path.join(frontend, 'index.html')));
  app.use((error, _req, res, _next) => {
    if (error.code === 11000)
      return res.status(409).json({ error: 'That username is already taken' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'Request is too large' });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ error: 'Invalid JSON' });
    console.error('Request failed:', error.name);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return { app, server, io };
}
