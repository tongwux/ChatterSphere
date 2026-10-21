import 'dotenv/config';
import mongoose from 'mongoose';
import { createApplication } from './app.js';
import User from './models/user.model.js';
import Message from './models/message.model.js';
import Session from './models/session.model.js';

async function main() {
  if (!process.env.MONGO_DB_URI) throw new Error('MONGO_DB_URI is required');
  const application = createApplication({
    secret: process.env.JWT_SECRET,
    origin: process.env.APP_ORIGIN,
    production: process.env.NODE_ENV === 'production',
    trustProxy: process.env.TRUST_PROXY === '1',
  });
  await mongoose.connect(process.env.MONGO_DB_URI, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([User.init(), Message.init(), Session.init()]);
  application.server.listen(Number(process.env.PORT) || 5000, '0.0.0.0', () =>
    console.log('ChatterSphere is ready'),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      application.io.close();
      application.server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    });
}
main().catch((error) => {
  console.error('Startup failed:', error.name);
  process.exit(1);
});
