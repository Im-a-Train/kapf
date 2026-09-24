import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from '../src/app.js';
import { createJsonStore } from '../src/store.js';
import { event, riddles } from '../config/event.js';

let server, base, dir;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'kapf-'));
  server = createApp({ event, riddles, store: createJsonStore(join(dir, 'r.json')), adminPassword: 'geheim' });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

const call = async (path, { method = 'GET', body, cookie } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null), res };
};

test('Rätsel verrät die Antwort nicht', async () => {
  const { data } = await call('/api/riddle');
  assert.ok(data.id && data.question);
  assert.equal(data.answers, undefined);
});

test('Anmeldung ohne Rätsel wird abgelehnt', async () => {
  const { status, data } = await call('/api/registrations', { method: 'POST', body: { name: 'X', attending: 'yes' } });
  assert.equal(status, 403);
  assert.equal(data.code, 'RIDDLE');
});

test('Falsche Antwort gibt kein Token', async () => {
  const { data } = await call('/api/riddle/solve', { method: 'POST', body: { id: 'alter', answer: '119' } });
  assert.equal(data.ok, false);
  assert.equal(data.token, undefined);
});

test('Ganzer Ablauf: Rätsel → Anmeldung → Admin', async () => {
  const solved = await call('/api/riddle/solve', { method: 'POST', body: { id: 'handtuch', answer: '  HandTuch ' } });
  assert.equal(solved.data.ok, true);

  const bad = await call('/api/registrations', { method: 'POST', body: { riddleToken: solved.data.token, attending: 'yes' } });
  assert.equal(bad.status, 400);

  const reg = await call('/api/registrations', {
    method: 'POST',
    body: { riddleToken: solved.data.token, name: 'Heidi', attending: 'yes', companions: '2', diet: 'vegi', sleepover: 'on' },
  });
  assert.equal(reg.status, 201);

  assert.equal((await call('/api/admin/registrations')).status, 401);
  assert.equal((await call('/api/admin/login', { method: 'POST', body: { password: 'falsch' } })).status, 401);

  const login = await call('/api/admin/login', { method: 'POST', body: { password: 'geheim' } });
  const cookie = login.res.headers.get('set-cookie').split(';')[0];

  const list = await call('/api/admin/registrations', { cookie });
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].companions, 2);
  assert.equal(list.data[0].sleepover, 'yes');

  const patched = await call(`/api/admin/registrations/${reg.data.id}`, { method: 'PATCH', cookie, body: { attending: 'no', note: 'abgesagt per SMS' } });
  assert.equal(patched.data.attending, 'no');
  assert.equal(patched.data.companions, 0);
  assert.equal(patched.data.sleepover, 'no');
  assert.equal(patched.data.note, 'abgesagt per SMS');

  const csv = await fetch(`${base}/api/admin/registrations.csv`, { headers: { Cookie: cookie } });
  const csvText = await csv.text();
  assert.match(csvText, /Heidi/);
  assert.match(csvText, /sleepover/);

  assert.equal((await call(`/api/admin/registrations/${reg.data.id}`, { method: 'DELETE', cookie })).status, 200);
  assert.equal((await call('/api/admin/registrations', { cookie })).data.length, 0);
});

test('Event liefert Anfahrt (Koordinaten, Haltestelle, Startpunkte)', async () => {
  const { data } = await call('/api/event');
  assert.equal(data.stop.id, '8576713');
  assert.ok(data.coords.lat > 46.86 && data.coords.lon > 7.76);
  assert.deepEqual(data.origins.map((o) => o.label), ['Bärn', 'Oberdiessbach', 'Herblige', 'Schüpbach']);
});

test('Kalenderdatei', async () => {
  const res = await fetch(`${base}/api/event.ics`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/calendar/);
  const ics = await res.text();
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;TZID=Europe\/Zurich:20270522T160000\r\n/);
  assert.match(ics, /GEO:46\.86482;7\.767364/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
});

test('Statische Dateien & kein Path-Traversal', async () => {
  const res = await fetch(`${base}/`);
  assert.match(await res.text(), /Kapf/);
  const trav = await fetch(`${base}/..%2f..%2fpackage.json`);
  assert.notEqual(trav.status, 200);
});
