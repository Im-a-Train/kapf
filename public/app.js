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
    confetti(200);
    confetti(80, { x: innerWidth / 2, y: innerHeight / 2 });
    setTimeout(unlockSignup, 900);
  } else {
    fails++;
    fb.className = 'feedback';
    void fb.offsetWidth; // Animation neu starten
    fb.className = 'feedback nope';
    fb.textContent = NOPE[(fails - 1) % NOPE.length];
    const r = fb.getBoundingClientRect();
    confetti(15, { x: r.left + 40, y: r.top, bits: ['💩', '🙈', '❌', '🤡'] });
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
    confetti(300);
    [0.2, 0.5, 0.8].forEach((fx, i) => setTimeout(() => confetti(60, { x: innerWidth * fx, y: innerHeight * 0.6 }), i * 400));
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
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EMOJI = ['🎉', '🎂', '🍺', '🥳', '30', '🎈', '🍾', '✨', '🥨', '🎊'];
const COLORS = ['#ff22ff', '#ffff00', '#00ff66', '#0000ff', '#ff3300', '#00e5ff', '#000'];
const MAX_PIECES = 400;
let live = 0;

// n Stück, entweder als Regen von oben oder als Explosion ab (x, y)
function confetti(n = 80, { x, y, bits = EMOJI } = {}) {
  if (reduced) return;
  const burst = x !== undefined;
  for (let i = 0; i < n && live < MAX_PIECES; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    if (Math.random() < 0.55 && bits === EMOJI) {
      // farbiger Papierschnipsel
      s.classList.add('paper');
      s.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
      s.style.width = `${6 + Math.random() * 8}px`;
      s.style.height = `${8 + Math.random() * 12}px`;
      if (Math.random() < 0.3) s.style.borderRadius = '50%';
    } else {
      s.textContent = bits[Math.floor(Math.random() * bits.length)];
      s.style.fontSize = `${18 + Math.random() * 22}px`;
    }
    const startX = burst ? x : Math.random() * innerWidth;
    const startY = burst ? y : -40;
    s.style.left = `${startX}px`;
    s.style.top = `${startY}px`;
    document.body.append(s);
    live++;

    const dx = (Math.random() - 0.5) * (burst ? 500 : 200);
    const up = burst ? 120 + Math.random() * 260 : 0;
    const fall = innerHeight - startY + 80;
    const rot = (Math.random() - 0.5) * 1440;
    const anim = s.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${-up}px) rotate(${rot * 0.3}deg)`, opacity: 1, offset: burst ? 0.25 : 0.5 },
      { transform: `translate(${dx}px, ${fall}px) rotate(${rot}deg)`, opacity: 0.8 },
    ], {
      duration: 1800 + Math.random() * 2200,
      delay: burst ? 0 : Math.random() * 1200,
      easing: 'cubic-bezier(.2,.6,.4,1)',
      fill: 'backwards',
    });
    anim.onfinish = () => { s.remove(); live--; };
  }
}

// Konfetti überall: beim Laden, bei jedem Knopfdruck und als Dauer-Niesel
addEventListener('load', () => confetti(120));
setInterval(() => document.visibilityState === 'visible' && confetti(10), 3000);
document.addEventListener('click', (e) => {
  const b = e.target.closest('button, .radio, a');
  if (!b) return;
  const r = b.getBoundingClientRect();
  const fromKeyboard = e.clientX === 0 && e.clientY === 0;
  confetti(25, fromKeyboard ? { x: r.left + r.width / 2, y: r.top } : { x: e.clientX, y: e.clientY });
});

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

// ---------- Handy bewegen = UI bewegt sich mit ----------
// Neigen: Seite kippt leicht, Karten & Hintergrund verschieben sich (Parallax).
// Schütteln: Konfetti-Explosion. Auf dem Desktop macht die Maus dasselbe (etwas sanfter).
const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
const clamp = (v) => Math.max(-1, Math.min(1, v));

if (!reduced) {
  addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    tilt.tx = clamp(e.gamma / 35);
    tilt.ty = clamp((e.beta - 45) / 35); // normale Haltung ≈ 45°
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tilt.tx = clamp((e.clientX / innerWidth - 0.5) * 1.2);
    tilt.ty = clamp((e.clientY / innerHeight - 0.5) * 1.2);
  });

  const root = document.documentElement;
  (function loop() {
    tilt.x += (tilt.tx - tilt.x) * 0.12;
    tilt.y += (tilt.ty - tilt.y) * 0.12;
    root.style.setProperty('--tx', tilt.x.toFixed(3));
    root.style.setProperty('--ty', tilt.y.toFixed(3));
    requestAnimationFrame(loop);
  })();

  let lastShake = 0;
  let last = null;
  addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    if (last) {
      const delta = Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z);
      if (delta > 30 && e.timeStamp - lastShake > 1200) {
        lastShake = e.timeStamp;
        confetti(150);
        confetti(60, { x: innerWidth / 2, y: innerHeight / 2 });
        document.body.classList.remove('shaken');
        void document.body.offsetWidth;
        document.body.classList.add('shaken');
        navigator.vibrate?.(80);
      }
    }
    last = { x: a.x, y: a.y, z: a.z };
  });

  // iOS will eine Erlaubnis, und zwar nach einem Tap
  const askMotion = () => {
    for (const E of [globalThis.DeviceOrientationEvent, globalThis.DeviceMotionEvent]) {
      if (typeof E?.requestPermission === 'function') E.requestPermission().catch(() => {});
    }
  };
  addEventListener('touchend', askMotion, { once: true });
}
