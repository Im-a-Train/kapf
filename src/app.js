import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize as normPath, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAuth } from './auth.js';
import { createRiddles } from './riddles.js';
import { toCsv, validateRegistration } from './registration.js';

const PUBLIC_DIR = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
};

export function createApp({ event, riddles, store, secret, adminPassword }) {
  const auth = createAuth({ secret, adminPassword });
  const riddleSet = createRiddles(riddles);
  const routes = [];
  const route = (method, path, handler) => {
    const keys = [];
    const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`);
    routes.push({ method, re, keys, handler });
  };
  const requireAdmin = (handler) => (ctx) =>
    auth.verifyAdminToken(ctx.cookies.admin) ? handler(ctx) : json(ctx.res, 401, { error: 'Nicht eingeloggt' });

  // --- Öffentlich -------------------------------------------------------
  route('GET', '/api/event', ({ res }) => json(res, 200, event));

  route('GET', '/api/riddle', ({ res, url }) => json(res, 200, riddleSet.random(url.searchParams.get('not'))));

  route('POST', '/api/riddle/solve', async ({ req, res }) => {
    const { id, answer } = await body(req);
    if (!riddleSet.check(id, answer)) return json(res, 200, { ok: false });
    return json(res, 200, { ok: true, token: auth.issueRiddleToken(id) });
  });

  route('POST', '/api/registrations', async ({ req, res }) => {
    if (event.registrationDeadline && Date.now() > Date.parse(event.registrationDeadline)) {
      return json(res, 403, { errors: ['Anmeldeschluss ist vorbei. Sorry!'] });
    }
    const input = await body(req);
    if (!auth.verifyRiddleToken(input.riddleToken)) {
      return json(res, 403, { code: 'RIDDLE', errors: ['Zuerst das Rätsel lösen, du Schlaumeier.'] });
    }
    const { data, errors } = validateRegistration(input, event);
    if (errors.length) return json(res, 400, { errors });
    const created = await store.create({ ...data, note: '' });
    return json(res, 201, { id: created.id, name: created.name, attending: created.attending });
  });

  // --- Admin ------------------------------------------------------------
  route('POST', '/api/admin/login', async ({ req, res }) => {
    const { password } = await body(req);
    if (!auth.checkPassword(password)) return json(res, 401, { error: 'Falsches Passwort' });
    setCookie(req, res, 'admin', auth.issueAdminToken(), 7 * 24 * 3600);
    return json(res, 200, { ok: true });
  });

  route('POST', '/api/admin/logout', ({ req, res }) => {
    setCookie(req, res, 'admin', '', 0);
    return json(res, 200, { ok: true });
  });

  route('GET', '/api/admin/registrations', requireAdmin(async ({ res }) => {
    const list = await store.list();
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(res, 200, list);
  }));

  route('GET', '/api/admin/registrations.csv', requireAdmin(async ({ res }) => {
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="anmeldungen.csv"',
    });
    res.end('﻿' + toCsv(await store.list()));
  }));

  route('PATCH', '/api/admin/registrations/:id', requireAdmin(async ({ req, res, params }) => {
    const existing = await store.get(params.id);
    if (!existing) return json(res, 404, { error: 'Nicht gefunden' });
    const input = await body(req);
    const { data, errors } = validateRegistration({ ...existing, ...input }, event);
    if (errors.length) return json(res, 400, { errors });
    const note = String(input.note ?? existing.note ?? '').slice(0, 1000);
    return json(res, 200, await store.update(params.id, { ...data, note }));
  }));

  route('DELETE', '/api/admin/registrations/:id', requireAdmin(async ({ res, params }) => {
    if (!(await store.remove(params.id))) return json(res, 404, { error: 'Nicht gefunden' });
    return json(res, 200, { ok: true });
  }));

  // --- Handler ----------------------------------------------------------
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      for (const r of routes) {
        const m = r.method === req.method && url.pathname.match(r.re);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        return await r.handler({ req, res, url, params, cookies: parseCookies(req) });
      }
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Unbekannt' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Nope' });
      return await serveStatic(url.pathname, res);
    } catch (err) {
      if (err.status) return json(res, err.status, { error: err.message });
      console.error(err);
      return json(res, 500, { error: 'Da ist etwas explodiert.' });
    }
  });
}

async function serveStatic(pathname, res) {
  let file = join(PUBLIC_DIR, normPath(decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Nope' });
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 – Hier ist kein Kapf.');
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function body(req, limit = 20_000) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw Object.assign(new Error('Zu viel Text'), { status: 413 });
  }
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw Object.assign(new Error('Ungültiges JSON'), { status: 400 });
  }
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie ?? '').split(';').filter(Boolean).map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    }),
  );
}

function setCookie(req, res, name, value, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}
