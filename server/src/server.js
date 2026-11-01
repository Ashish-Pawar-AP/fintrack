import { config } from './config.js';
import mongoose from 'mongoose';
import cron from 'node-cron';
import app from './app.js';
import { runDue } from './services/recurring.js';

mongoose.set('strictQuery', true);
await mongoose.connect(config.mongoUri, { autoIndex: true, serverSelectionTimeoutMS: 10_000 });
cron.schedule('5 0 * * *', () => runDue().then((c) => console.log(`[cron] generated ${c} due transactions`)).catch((e) => console.error('[cron]', e)));

const server = app.listen(config.port, () => console.log(`FinTrack listening on :${config.port}`));
const shutdown = (sig) => {
  console.log(`${sig} received, shutting down`);
  server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
};
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(s)));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
