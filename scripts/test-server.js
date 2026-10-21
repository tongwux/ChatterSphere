// Ephemeral local/CI database only. Production always uses backend/server.js.
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApplication } from '../backend/app.js';
import User from '../backend/models/user.model.js';
import Message from '../backend/models/message.model.js';
import Session from '../backend/models/session.model.js';
if (process.env.NODE_ENV === 'production') throw new Error('Test server cannot run in production');
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());
await Promise.all([User.init(), Message.init(), Session.init()]);
const app = createApplication({
  secret: 'local-test-only-secret-at-least-32-characters',
  origin: 'http://127.0.0.1:5000',
});
app.server.listen(5000, '127.0.0.1', () =>
  console.log('Ephemeral test preview: http://127.0.0.1:5000'),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await new Promise((resolve) => app.io.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  });
