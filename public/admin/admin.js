const $ = (s) => document.querySelector(s);
const api = async (path, method = 'GET', body) => {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/admin/login') showLogin();
  return { ok: res.ok, status: res.status, data };
};

let registrations = [];

function showLogin() {
  $('#login').hidden = false;
  $('#dashboard').hidden = true;
  $('#logout').hidden = true;
}

async function load() {
  const { ok, data } = await api('/api/admin/registrations');
  if (!ok) return;
  registrations = data;
  $('#login').hidden = true;
  $('#dashboard').hidden = false;
  $('#logout').hidden = false;
  render();
}

function render() {
  const q = $('#search').value.toLowerCase();
  const filter = $('#filter').value;
  const list = registrations.filter((r) =>
    (!filter || r.attending === filter) &&
    (!q || [r.name, r.email, r.companionNames, r.diet, r.message, r.note].join(' ').toLowerCase().includes(q)));

  const yes = registrations.filter((r) => r.attending === 'yes');
  const stats = [
    ['Anmeldungen', registrations.length],
    ['Zusagen', yes.length],
    ['Personen total', yes.reduce((n, r) => n + 1 + (r.companions || 0), 0)],
    ['Absagen', registrations.length - yes.length],
    ['Übernachten (Pers.)', yes.filter((r) => r.sleepover === 'yes').reduce((n, r) => n + 1 + (r.companions || 0), 0)],
    ['Mit Essenswunsch', yes.filter((r) => r.diet).length],
  ];
  $('#stats').replaceChildren(...stats.map(([label, n]) => el('div', { class: 'stat' }, el('b', {}, n), label)));

  $('#rows').replaceChildren(...list.map((r) => el('tr', { class: r.attending },
    el('td', {}, el('strong', {}, r.name), r.email ? el('div', { class: 'muted' }, r.email) : ''),
    el('td', {}, el('span', { class: `badge ${r.attending}` }, r.attending === 'yes' ? 'Ja' : 'Nein')),
    el('td', {}, r.companions || ''),
    el('td', { class: 'wrap' }, r.companionNames),
    el('td', {}, r.sleepover === 'yes' ? '🏕️' : ''),
    el('td', { class: 'wrap' }, r.diet),
    el('td', { class: 'wrap' }, r.message),
    el('td', { class: 'wrap' }, r.note),
    el('td', { class: 'nowrap muted' }, new Date(r.createdAt).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })),
    el('td', { class: 'nowrap' },
      el('button', { class: 'small ghost', onclick: () => edit(r) }, 'Bearbeiten'), ' ',
      el('button', { class: 'small danger', onclick: () => remove(r) }, 'Löschen')),
  )));
  $('#empty').hidden = list.length > 0;
}

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children.map((c) => (c instanceof Node ? c : String(c ?? ''))));
  return node;
}

// ---------- Bearbeiten ----------
let editing = null;
function edit(r) {
  editing = r;
  const f = $('#edit-form').elements;
  for (const k of ['name', 'email', 'attending', 'companions', 'companionNames', 'diet', 'message', 'note']) f[k].value = r[k] ?? '';
  f.sleepover.value = r.sleepover === 'yes' ? 'yes' : 'no';
  $('#edit-error').textContent = '';
  $('#edit').showModal();
}

$('#save').addEventListener('click', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData($('#edit-form')));
  const { ok, data } = await api(`/api/admin/registrations/${editing.id}`, 'PATCH', body);
  if (!ok) { $('#edit-error').textContent = (data.errors ?? [data.error]).join(' '); return; }
  $('#edit').close();
  load();
});

async function remove(r) {
  if (!confirm(`Anmeldung von «${r.name}» wirklich löschen?`)) return;
  await api(`/api/admin/registrations/${r.id}`, 'DELETE');
  load();
}

// ---------- Login ----------
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { ok, data } = await api('/api/admin/login', 'POST', { password: e.target.elements.password.value });
  $('#login-error').textContent = ok ? '' : data.error;
  if (ok) { e.target.reset(); load(); }
});
$('#logout').addEventListener('click', async () => { await api('/api/admin/logout', 'POST'); showLogin(); });
$('#search').addEventListener('input', render);
$('#filter').addEventListener('change', render);
$('#reload').addEventListener('click', load);

load();
