const $ = (sel) => document.querySelector(sel);
const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
};

// ---------- Event-Infos ----------
let event = { maxCompanions: 3, date: '2027-05-22' };
api('/api/event').then(({ data }) => {
  event = { ...event, ...data };
  $('#title').textContent = event.title;
  splitTitle();
  $('#subtitle').textContent = event.subtitle;
  $('#date').textContent = event.dateLabel;
  $('#time').textContent = event.time ?? '';
  $('#location').textContent = event.location;
  $('#hosts').textContent = event.hosts.join(' · ');
  $('#signup-form').elements.companions.max = event.maxCompanions;
});

// ---------- Countdown ----------
function tick() {
  const secs = Math.max(0, Math.floor((new Date(`${event.date}T16:00:00`) - Date.now()) / 1000));
  $('#countdown').textContent = secs.toLocaleString('de-CH');
}
tick();
setInterval(tick, 1000);

// ---------- Rätsel ----------
const NOPE = [
  'Falsch. Aber schön geschrieben.',
  'Nope. Tim hätte das gewusst. Vielleicht.',
  'Knapp daneben ist auch vorbei.',
  'Nein. Röbu lacht dich gerade aus.',
  'Hast du es mit Ausdrucken und Anschauen probiert?',
  'Leider nein. Chrigu ist enttäuscht.',
];
let riddle = null;
let fails = 0;

async function loadRiddle() {
  const { data } = await api(`/api/riddle${riddle ? `?not=${encodeURIComponent(riddle.id)}` : ''}`);
  riddle = data;
  fails = 0;
  $('#riddle-question').textContent = riddle.question;
  $('#riddle-hint').textContent = riddle.hint ? `Tipp: ${riddle.hint}` : '';
  $('#riddle-hint').hidden = true;
  $('#riddle-hint-btn').hidden = true;
  $('#riddle-feedback').textContent = '';
  $('#riddle-answer').value = '';
}

$('#riddle-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fb = $('#riddle-feedback');
  const { data } = await api('/api/riddle/solve', { method: 'POST', body: { id: riddle.id, answer: $('#riddle-answer').value } });
  if (data.ok) {
    store.set('riddleToken', data.token);
    fb.className = 'feedback yes';
    fb.textContent = 'RICHTIG! Du darfst dich anmelden. 🥳';
    confetti();
    setTimeout(unlockSignup, 900);
  } else {
    fails++;
    fb.className = 'feedback';
    void fb.offsetWidth; // Animation neu starten
    fb.className = 'feedback nope';
    fb.textContent = NOPE[(fails - 1) % NOPE.length];
    if (fails >= 2 && riddle.hint) $('#riddle-hint-btn').hidden = false;
  }
});
$('#riddle-skip').addEventListener('click', loadRiddle);
$('#riddle-hint-btn').addEventListener('click', () => { $('#riddle-hint').hidden = false; });

function unlockSignup() {
  $('#riddle').hidden = true;
  $('#signup').hidden = false;
  $('#signup').scrollIntoView({ behavior: 'smooth' });
  $('#signup-form').elements.name.focus({ preventScroll: true });
}

// ---------- Formular ----------
const form = $('#signup-form');
const f = form.elements;
const QUIPS = ['Solo. Mutig.', 'Zu zweit. Herzig.', 'Kleine Gang.', 'Ganze Delegation?!'];

function syncCompanions() {
  const n = Number(f.companions.value);
  $('#companions-out').textContent = n;
  $('#companions-quip').textContent = QUIPS[Math.min(n, QUIPS.length - 1)];
  $('#companion-names-label').hidden = n === 0;
}
f.companions.addEventListener('input', syncCompanions);

form.addEventListener('change', () => {
  const no = f.attending.value === 'no';
  $('#companions-label').hidden = no;
  if (no) { f.companions.value = 0; syncCompanions(); }
});

// Der Knopf flieht ein paar Mal (nur mit Maus). Tastatur & Touch funktionieren immer.
const btn = $('#submit-btn');
const ESCAPES = ['Nope 😜', 'Zu langsam!', 'Fast …', 'OK, OK. Drück mich.'];
let escapes = 0;
btn.addEventListener('pointerenter', (e) => {
  if (e.pointerType !== 'mouse' || escapes >= ESCAPES.length - 1) return;
  const zone = btn.parentElement.getBoundingClientRect();
  const maxX = Math.max(0, zone.width - btn.offsetWidth);
  btn.style.left = `${Math.random() * maxX}px`;
  btn.style.top = `${Math.random() * 40 - 10}px`;
  btn.style.transform = `rotate(${Math.random() * 30 - 15}deg)`;
  btn.textContent = ESCAPES[escapes++];
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errs = $('#signup-errors');
  errs.innerHTML = '';
  const body = Object.fromEntries(new FormData(form));
  body.riddleToken = store.get('riddleToken');
  btn.disabled = true;
  const { status, data } = await api('/api/registrations', { method: 'POST', body });
  btn.disabled = false;
  if (status === 201) {
    $('#signup').hidden = true;
    $('#done').hidden = false;
    $('#done-text').textContent = data.attending === 'yes'
      ? `${data.name}, du bist dabei! Wir sehen uns am ${event.dateLabel} im ${event.location}.`
      : `Schade, ${data.name}. Wir trinken eins auf dich.`;
    $('#done').scrollIntoView({ behavior: 'smooth' });
    confetti();
    return;
  }
  if (data.code === 'RIDDLE') {
    store.set('riddleToken', '');
    $('#signup').hidden = true;
    $('#riddle').hidden = false;
    loadRiddle();
  }
  for (const msg of data.errors ?? [data.error ?? 'Unbekannter Fehler. Ruf Melu an.']) {
    const li = document.createElement('li');
    li.textContent = msg;
    errs.append(li);
  }
});

// ---------- Konfetti ----------
function confetti() {
  const bits = ['🎉', '🎂', '🍺', '🥳', '30', '🎈', '🍾', '✨'];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.textContent = bits[i % bits.length];
    s.style.left = `${Math.random() * 100}vw`;
    s.style.animationDuration = `${1.5 + Math.random() * 2}s`;
    s.style.animationDelay = `${Math.random() * 0.5}s`;
    document.body.append(s);
    s.addEventListener('animationend', () => s.remove());
  }
}

// ---------- Start ----------
if (store.get('riddleToken')) unlockSignup();
else loadRiddle();
syncCompanions();

// ---------- Mehr Bewegung ----------
// Titel in einzelne Buchstaben zerlegen, damit jeder für sich hüpfen kann
function splitTitle() {
  const h1 = $('#title');
  const text = h1.textContent;
  h1.setAttribute('aria-label', text);
  h1.replaceChildren(...[...text].map((c, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = c === ' ' ? ' ' : c;
    s.style.animationDelay = `${i * 0.08}s`;
    return s;
  }));
}
splitTitle();

// Glitzer hinter dem Mauszeiger
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastSparkle = 0;
if (!reduced) {
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.timeStamp - lastSparkle < 60) return;
    lastSparkle = e.timeStamp;
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = ['✨', '⭐', '💖', '🎉'][Math.floor(Math.random() * 4)];
    s.style.left = `${e.clientX + 6}px`;
    s.style.top = `${e.clientY + 6}px`;
    document.body.append(s);
    s.addEventListener('animationend', () => s.remove());
  });
}
