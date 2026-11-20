// Planung der Gastgeber (ursprünglich ein Claude-Artifact).
// Der Stand liegt auf dem Server (/api/admin/planning) und wird automatisch gespeichert.
const PEOPLE = [
  { id: 'chrigu', name: 'Chrigu', role: 'Getränke & Bar', emoji: '🍺' },
  { id: 'tim', name: 'Tim', role: 'Musik & Technik', emoji: '🎸' },
  { id: 'roebu', name: 'Röbu', role: 'Projektleitung & Finanzen', emoji: '📋' },
  { id: 'melu', name: 'Melu', role: 'Essen', emoji: '🥨' },
];
const P = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));
const BAND_MIN = 1500, BAND_MAX = 2000;
const PARTY = new Date(2027, 4, 22);
const API = '/api/admin/planning';

let state = null, version = 0;
let active = 'roebu';
try { const t = sessionStorage.getItem('kapf-tab'); if (t && P[t]) active = t; } catch {}
let dirty = false, saving = false, msg = '', timer = null;
const root = document.getElementById('root');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chf = (n) => 'CHF ' + Math.round(n || 0).toLocaleString('de-CH');
const num = (v) => { const n = parseFloat(String(v).replace(/[’' ]/g, '').replace(',', '.')); return isFinite(n) ? n : null; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const planOf = (id) => sum(state.items.filter((i) => i.owner === id), (i) => i.plan);
const actOf = (id) => sum(state.items.filter((i) => i.owner === id), (i) => i.actual);
const fmtDate = (d) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return dd + '.' + m + '.' + y.slice(2); };
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function shell() {
  const days = Math.ceil((PARTY - new Date().setHours(0, 0, 0, 0)) / 864e5);
  const tick = '+++ TIM +++ RÖBU +++ CHRIGU +++ MELU +++ 30 +++ KAPF +++ 22.05.27 +++ BUDGET IM GRIFF BEHALTEN +++ ';
  root.innerHTML = `<div class="ticker" aria-hidden="true"><span>${tick.repeat(3)}</span></div>
  <div class="wrap">
   <nav class="topnav"><a href="/admin/">← Anmeldungen</a><small id="stamp"></small></nav>
   <header class="hero"><h1>4 × 30 im Kapf</h1>
    <p>Samstag, 22. Mai 2027 · Planung von Chrigu, Tim, Röbu und Melu</p>
    <div class="count"><b>${days > 0 ? days : 0}</b><span>${days === 1 ? 'Tag bis zur Party' : days > 0 ? 'Tage bis zur Party' : 'Es ist so weit!'}</span></div>
   </header>
   <section class="box" id="budget"></section>
   <nav class="tabs" role="tablist" id="tabs"></nav>
   <section class="box panel" id="panel"></section>
   <section class="box" id="due"></section>
   <section class="box" id="settle"></section>
  </div>
  <div class="savebar" id="savebar" hidden></div>`;
  renderAll();
}
function renderAll() { renderBudget(); renderTabs(); renderPanel(); renderDue(); renderSettle(); renderSave(); }
function renderSummaries() { renderBudget(true); renderTabs(); renderDue(); renderSettle(); renderPanelSums(); }

function renderBudget(keepInputs) {
  const el = document.getElementById('budget');
  const plan = sum(state.items, (i) => i.plan), act = sum(state.items, (i) => i.actual);
  const total = Math.max(state.budget || 0, plan) || 1;
  const left = (state.budget || 0) - plan;
  const tim = planOf('tim');
  const timChip = tim < BAND_MIN ? '<span class="chip bad">unter Ziel</span>' : tim > BAND_MAX ? '<span class="chip bad">über Ziel</span>' : '<span class="chip good">im Ziel</span>';
  const rows = PEOPLE.map((p) => `<tr><td><span class="dot" style="background:var(--${p.id})"></span>${esc(p.name)} <span style="color:var(--muted)">· ${esc(p.role)}</span>${p.id === 'tim' ? `<br><small style="color:var(--muted)">Ziel Band + Technik: ${chf(BAND_MIN)}–${BAND_MAX.toLocaleString('de-CH')}</small>${timChip}` : ''}</td><td class="n">${chf(planOf(p.id))}</td><td class="n">${chf(actOf(p.id))}</td></tr>`).join('');
  const segs = PEOPLE.map((p) => `<i style="width:${planOf(p.id) / total * 100}%;background:var(--${p.id})" title="${esc(p.name)}"></i>`).join('');
  const overMark = plan > (state.budget || 0) ? `<span class="over" style="left:${(state.budget || 0) / total * 100}%"></span>` : '';
  const html = `<h2>Budget</h2>
  ${keepInputs ? '' : `<div class="kv"><label>Gesamtbudget (CHF)<input type="number" inputmode="numeric" data-k="budget" value="${esc(state.budget)}"></label><label>Gäste (geschätzt)<input type="number" inputmode="numeric" data-k="guests" value="${esc(state.guests)}"></label></div>`}
  <div id="budgetlive"><div class="bar" role="img" aria-label="Geplant ${chf(plan)} von ${chf(state.budget)}">${segs}${overMark}</div>
  <div class="barmeta"><span>Geplant ${chf(plan)} von ${chf(state.budget)}</span><span class="status ${left < 0 ? 'bad' : 'good'}">${left < 0 ? 'Über Budget: ' + chf(-left) : 'Noch frei: ' + chf(left)}</span></div>
  <div class="barmeta" style="margin-top:-8px"><span>Effektiv ausgegeben: ${chf(act)}</span><span>${state.guests > 0 ? '≈ ' + chf(plan / state.guests) + ' pro Gast' : ''}</span></div>
  <table><thead><tr><th>Ressort</th><th class="n">Geplant</th><th class="n">Effektiv</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  if (keepInputs) { const live = document.getElementById('budgetlive'); const tmp = document.createElement('div'); tmp.innerHTML = html; live.replaceWith(tmp.querySelector('#budgetlive')); }
  else el.innerHTML = html;
}
function renderTabs() {
  document.getElementById('tabs').innerHTML = PEOPLE.map((p) => { const open = state.tasks.filter((t) => t.owner === p.id && !t.done).length; return `<button role="tab" data-tab="${p.id}" aria-selected="${p.id === active}" style="--c:var(--${p.id})"><span>${p.emoji}</span>${esc(p.name)}<small style="font-weight:600">${open} offen</small></button>`; }).join('');
}
function panelSums(id) { return `<div class="sums" id="psums"><div>Geplant<b>${chf(planOf(id))}</b></div><div>Effektiv<b>${chf(actOf(id))}</b></div></div>`; }
function renderPanelSums() { const s = document.getElementById('psums'); if (s) s.outerHTML = panelSums(active); }
function renderPanel() {
  const p = P[active]; const el = document.getElementById('panel'); el.style.setProperty('--c', `var(--${p.id})`);
  const tasks = state.tasks.filter((t) => t.owner === p.id).sort((a, b) => (a.done - b.done) || ((a.due || '9') < (b.due || '9') ? -1 : 1));
  const items = state.items.filter((i) => i.owner === p.id);
  const opts = (v) => ['', ...PEOPLE.map((x) => x.id)].map((o) => `<option value="${o}" ${o === v ? 'selected' : ''}>${o ? esc(P[o].name) : '—'}</option>`).join('');
  el.innerHTML = `<div class="phead"><div><h2>${p.emoji} ${esc(p.name)}</h2><p>${esc(p.role)}</p></div>${panelSums(p.id)}</div>
  ${p.id === 'tim' ? `<p class="note">Rahmen für Band und Technik: ${chf(BAND_MIN)} bis ${chf(BAND_MAX)}.</p>` : ''}
  <h3>Aufgaben</h3>
  ${tasks.length ? `<ul class="tasks">${tasks.map((t) => `<li class="${t.done ? 'done' : ''}"><input type="checkbox" data-k="done" data-id="${t.id}" ${t.done ? 'checked' : ''} aria-label="Erledigt"><input type="text" data-k="text" data-id="${t.id}" value="${esc(t.text)}" aria-label="Aufgabe"><input type="date" data-k="due" data-id="${t.id}" value="${esc(t.due)}" aria-label="Fällig am"><button class="del" data-del-task="${t.id}" aria-label="Aufgabe löschen">✕</button></li>`).join('')}</ul>` : '<p class="empty">Noch keine Aufgaben. Leg die erste unten an.</p>'}
  <div class="addrow"><input type="text" id="newtask" placeholder="Neue Aufgabe" aria-label="Neue Aufgabe"><button class="btn" data-add-task>Hinzufügen</button></div>
  <h3>Budgetposten</h3>
  ${items.length ? `<div class="items">${items.map((i) => `<div class="item"><label class="lbl">Posten<input type="text" data-k="label" data-id="${i.id}" value="${esc(i.label)}"></label><label>Geplant<input type="number" inputmode="decimal" data-k="plan" data-id="${i.id}" value="${i.plan ?? ''}"></label><label>Effektiv<input type="number" inputmode="decimal" data-k="actual" data-id="${i.id}" value="${i.actual ?? ''}" placeholder="—"></label><label>Bezahlt von<select data-k="paidBy" data-id="${i.id}">${opts(i.paidBy)}</select></label><button class="del" data-del-item="${i.id}" aria-label="Posten löschen">✕</button></div>`).join('')}</div>` : '<p class="empty">Noch keine Budgetposten.</p>'}
  <div class="addrow"><button class="btn ghost" data-add-item>+ Posten hinzufügen</button></div>`;
}
function renderDue() {
  const today = todayISO();
  const open = state.tasks.filter((t) => !t.done && t.due).sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 7);
  document.getElementById('due').innerHTML = `<h2>Als Nächstes fällig</h2>${open.length ? `<ul class="due">${open.map((t) => `<li><time class="${t.due < today ? 'late' : ''}">${fmtDate(t.due)}</time><span><span class="dot" style="background:var(--${t.owner})"></span>${esc(t.text)} <span style="color:var(--muted)">· ${esc(P[t.owner].name)}</span>${t.due < today ? ' <span class="chip bad">überfällig</span>' : ''}</span></li>`).join('')}</ul>` : '<p class="empty">Alles mit Datum ist erledigt. 🎉</p>'}`;
}
function renderSettle() {
  const paid = Object.fromEntries(PEOPLE.map((p) => [p.id, 0]));
  state.items.forEach((i) => { if (i.paidBy && paid[i.paidBy] !== undefined) paid[i.paidBy] += (i.actual || 0); });
  const total = sum(PEOPLE, (p) => paid[p.id]); const share = total / 4;
  const bal = PEOPLE.map((p) => ({ id: p.id, b: paid[p.id] - share }));
  const cred = bal.filter((x) => x.b > 0.5).map((x) => ({ ...x })), debt = bal.filter((x) => x.b < -0.5).map((x) => ({ ...x, b: -x.b }));
  const tx = []; let i = 0, j = 0;
  while (i < debt.length && j < cred.length) { const a = Math.min(debt[i].b, cred[j].b); tx.push([debt[i].id, cred[j].id, a]); debt[i].b -= a; cred[j].b -= a; if (debt[i].b < 0.5) i++; if (cred[j].b < 0.5) j++; }
  document.getElementById('settle').innerHTML = `<h2>Abrechnung</h2>
  <p class="note" style="margin:0 0 12px">Zählt alle Posten mit effektivem Betrag und «Bezahlt von». Kosten werden durch vier geteilt.</p>
  <table><thead><tr><th>Person</th><th class="n">Bezahlt</th><th class="n">Saldo</th></tr></thead><tbody>${PEOPLE.map((p) => { const b = paid[p.id] - share; return `<tr><td><span class="dot" style="background:var(--${p.id})"></span>${esc(p.name)}</td><td class="n">${chf(paid[p.id])}</td><td class="n" style="color:${b > 0.5 ? 'var(--ok)' : b < -0.5 ? 'var(--warn)' : 'inherit'}">${b > 0.5 ? '+' : ''}${chf(b)}</td></tr>`; }).join('')}</tbody></table>
  <p class="note">Anteil pro Person: <strong>${chf(share)}</strong></p>
  ${tx.length ? `<h3>Ausgleich</h3><ul class="due">${tx.map(([a, b, n]) => `<li><span>${esc(P[a].name)} zahlt <strong>${chf(n)}</strong> an ${esc(P[b].name)}</span></li>`).join('')}</ul>` : (total > 0 ? '<p class="empty">Alles ausgeglichen.</p>' : '')}`;
}
function renderSave() {
  const bar = document.getElementById('savebar');
  if (msg) { bar.hidden = false; bar.innerHTML = `<span>${esc(msg)}</span>${dirty ? '<button class="btn" data-save>Nochmals speichern</button>' : ''}`; return; }
  if (!dirty) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = saving ? '<span>Speichert …</span>' : '<span>Änderungen noch nicht gespeichert</span><button class="btn" data-save>Jetzt speichern</button>';
}
function renderStamp(updatedAt) {
  const s = document.getElementById('stamp');
  if (s) s.textContent = updatedAt ? 'Gespeichert ' + new Date(updatedAt).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' }) : '';
}

function change(structural) {
  dirty = true; msg = '';
  if (structural) renderPanel();
  renderSummaries(); renderSave();
  clearTimeout(timer); timer = setTimeout(autosave, 3000);
}
function editing() {
  const a = document.activeElement;
  return a && root.contains(a) && /INPUT|SELECT/.test(a.tagName) && a.type !== 'checkbox';
}
function autosave() {
  if (editing()) { timer = setTimeout(autosave, 2500); return; }
  save();
}

function apply(doc) {
  state = doc.state; version = doc.version;
  renderAll(); renderStamp(doc.updatedAt);
}

async function request(method, body) {
  const res = await fetch(API, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { location.href = '/admin/'; throw new Error('login'); }
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function save() {
  clearTimeout(timer);
  if (!dirty || saving) return;
  saving = true; renderSave();
  try {
    const { status, data } = await request('PUT', { version, state });
    saving = false;
    if (status === 200) { dirty = false; msg = ''; version = data.version; renderSave(); renderStamp(data.updatedAt); }
    else if (status === 409) { dirty = false; msg = 'Jemand anderes hat gleichzeitig gespeichert. Neuer Stand ist geladen, bitte deine letzte Änderung nochmals machen.'; apply(data); }
    else { msg = data.error || 'Speichern hat nicht geklappt. Nochmals versuchen.'; renderSave(); }
  } catch (err) {
    saving = false;
    if (err.message === 'login') return;
    msg = 'Speichern hat nicht geklappt (keine Verbindung?). Nochmals versuchen.'; renderSave();
  }
}

// Neuen Stand holen, wenn jemand anderes gespeichert hat und hier nichts offen ist.
async function refresh() {
  if (dirty || saving || editing() || document.hidden) return;
  try {
    const { status, data } = await request('GET');
    if (status === 200 && data.version !== version && !dirty) { msg = ''; apply(data); }
  } catch {}
}

root.addEventListener('input', (e) => {
  const t = e.target, k = t.dataset.k; if (!k || !state) return;
  if (k === 'budget' || k === 'guests') { state[k] = num(t.value) || 0; return change(false); }
  const id = t.dataset.id;
  const task = state.tasks.find((x) => x.id === id), item = state.items.find((x) => x.id === id);
  if (task) { if (k === 'done') { task.done = t.checked; return change(true); } task[k] = t.value; return change(false); }
  if (item) { if (k === 'plan' || k === 'actual') item[k] = t.value === '' ? null : num(t.value); else item[k] = t.value; return change(false); }
});
function addTask() { const inp = document.getElementById('newtask'); const v = inp && inp.value.trim(); if (!v) { inp && inp.focus(); return; } state.tasks.push({ id: uid(), owner: active, text: v, due: '', done: false }); change(true); const n = document.getElementById('newtask'); n && n.focus(); }
root.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !state) return;
  if (b.dataset.tab) { active = b.dataset.tab; try { sessionStorage.setItem('kapf-tab', active); } catch {} renderTabs(); renderPanel(); return; }
  if (b.hasAttribute('data-save')) return save();
  if (b.hasAttribute('data-add-task')) return addTask();
  if (b.hasAttribute('data-add-item')) { state.items.push({ id: uid(), owner: active, label: '', plan: null, actual: null, paidBy: '' }); change(true); const ins = document.querySelectorAll('#panel .item .lbl input'); ins.length && ins[ins.length - 1].focus(); return; }
  if (b.dataset.delTask) { state.tasks = state.tasks.filter((t) => t.id !== b.dataset.delTask); return change(true); }
  if (b.dataset.delItem) { state.items = state.items.filter((i) => i.id !== b.dataset.delItem); return change(true); }
});
root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'newtask') { e.preventDefault(); addTask(); } });
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', refresh);
setInterval(refresh, 30_000);

(async () => {
  try {
    const { status, data } = await request('GET');
    if (status !== 200) throw new Error();
    state = data.state; version = data.version;
    shell(); renderStamp(data.updatedAt);
  } catch (err) {
    if (err.message !== 'login') root.innerHTML = '<p class="loading">Planung konnte nicht geladen werden.</p>';
  }
})();
