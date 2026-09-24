import { resolve } from 'node:path';
import { createApp } from './app.js';
import { createJsonStore } from './store.js';
import { event, riddles } from '../config/event.js';

const PORT = Number(process.env.PORT ?? 3000);
const DATA_FILE = resolve(process.env.DATA_FILE ?? 'data/registrations.json');

if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD ist nicht gesetzt – das Admin-UI bleibt gesperrt.');
}

const app = createApp({
  event,
  riddles,
  store: createJsonStore(DATA_FILE),
  secret: process.env.SECRET,
  adminPassword: process.env.ADMIN_PASSWORD,
});

app.listen(PORT, () => console.log(`🎂 Kapf läuft auf http://localhost:${PORT}  (Admin: /admin)`));
