// Minigames in ASCII-Art: Downhill, Zelt bauen, Pong.
// Alles wird als Text in ein <pre> gezeichnet. Steuerung per Tastatur oder mit den Knöpfen
// unter dem Bildschirm (Handy). Highscores merkt sich der Browser (localStorage).
const $ = (sel) => document.querySelector(sel);
const screen = $('#game-screen');
const status = $('#game-status');
const W = 36;
const H = 18;

const best = {
  get: (k) => { try { return Number(localStorage.getItem(`kapf-best-${k}`)) || 0; } catch { return 0; } },
  set: (k, v) => { try { localStorage.setItem(`kapf-best-${k}`, String(v)); } catch {} },
};
const sfx = (type) => dispatchEvent(new CustomEvent('kapf:sfx', { detail: type }));
const rnd = (n) => Math.floor(Math.random() * n);

// ---------- Bildschirm ----------
const blank = () => Array.from({ length: H }, () => Array(W).fill(' '));
function put(buf, x, y, text) {
  [...text].forEach((c, i) => {
    const cx = Math.round(x) + i;
    const cy = Math.round(y);
    if (cx >= 0 && cx < W && cy >= 0 && cy < H) buf[cy][cx] = c;
  });
}
const center = (buf, y, text) => put(buf, Math.floor((W - text.length) / 2), y, text);
const frame = (buf) => {
  screen.textContent = buf.map((row) => row.join('')).join('\n');
};

// ---------- Eingabe ----------
const held = new Set();
let pressed = new Set(); // nur für einen Tick
const KEYMAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ' ': 'action', Enter: 'action',
};
const typing = (el) => el?.closest?.('input, textarea, select');

addEventListener('keydown', (e) => {
  const k = KEYMAP[e.key];
  if (!k || !game || typing(e.target) || !inView()) return;
  // Nur wenn das Spiel läuft oder der Bildschirm fokussiert ist – sonst scrollen Pfeile normal
  if (game.state !== 'run' && document.activeElement !== screen) return;
  e.preventDefault();
  if (!held.has(k)) pressed.add(k);
  held.add(k);
});
addEventListener('keyup', (e) => {
  const k = KEYMAP[e.key];
  if (k) held.delete(k);
});
for (const b of document.querySelectorAll('.game-ctl [data-key]')) {
  const k = b.dataset.key;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture?.(e.pointerId);
    pressed.add(k);
    held.add(k);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => held.delete(k));
}
// Tippen auf den Bildschirm = Aktion (Start, Zelt-Teil fallen lassen)
screen.addEventListener('pointerdown', () => {
  screen.focus({ preventScroll: true });
  pressed.add('action');
});

function inView() {
  const r = screen.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight;
}

// ---------- Spiel 1: Downhill ----------
const downhill = {
  id: 'downhill',
  keys: ['left', 'right'],
  help: '◀ ▶ lenken · Bäume (^ A) und Steine (o) meiden · B = Bier (+50)',
  reset() {
    this.x = W / 2;
    // Start mit freier Piste, damit man nicht gleich im ersten Baum hängt
    this.rows = Array.from({ length: H }, () => this.makeRow(0, true));
    this.dist = 0;
    this.bonus = 0;
    this.speed = 0.35;
    this.acc = 0;
    this.state = 'ready';
    this.crash = 0;
  },
  makeRow(d, empty = false) {
    const row = Array(W).fill(' ');
    row[0] = row[W - 1] = '|';
    if (empty) return row;
    const density = Math.min(0.12, 0.03 + d / 6000);
    for (let x = 1; x < W - 1; x++) {
      const r = Math.random();
      if (r < density) row[x] = Math.random() < 0.5 ? '^' : 'A';
      else if (r < density * 1.35) row[x] = 'o';
      else if (r < density * 1.35 + 0.004) row[x] = 'B';
      else if (Math.random() < 0.02) row[x] = '.';
    }
    return row;
  },
  tick() {
    if (this.state === 'ready' || this.state === 'over') {
      if (pressed.has('action')) { this.reset(); this.state = 'run'; }
      return;
    }
    if (held.has('left')) this.x -= 1;
    if (held.has('right')) this.x += 1;
    this.x = Math.max(1, Math.min(W - 2, this.x));
    // Scrollen: Welt fährt nach oben, schneller mit der Zeit
    this.acc += this.speed;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.rows.shift();
      this.rows.push(this.makeRow(this.dist));
      this.dist++;
    }
    this.speed = Math.min(1, 0.35 + this.dist / 900);
    const cell = this.rows[4][Math.round(this.x)];
    if (cell === 'B') {
      this.bonus += 50;
      this.rows[4][Math.round(this.x)] = ' ';
      sfx('coin');
    } else if ('^Ao'.includes(cell)) {
      this.state = 'over';
      const score = this.score();
      if (score > best.get(this.id)) best.set(this.id, score);
      sfx('crash');
    }
  },
  score() { return this.dist + this.bonus; },
  draw() {
    const buf = this.rows.map((r) => [...r]);
    const x = Math.round(this.x);
    if (this.state === 'over') {
      put(buf, x - 1, 3, '\\o/');
      put(buf, x - 2, 4, '*AUA*');
    } else {
      put(buf, x, 3, 'o');
      put(buf, x - 1, 4, held.has('left') ? '//' : held.has('right') ? ' \\\\' : '||');
      // Spur im Schnee
      for (let y = 0; y < 3; y++) if (buf[y][x] === ' ') buf[y][x] = ':';
    }
    put(buf, 1, 0, ` ${this.score()} m `);
    put(buf, W - 12, 0, ` Best ${best.get(this.id)} `);
    if (this.state === 'ready') {
      center(buf, 8, '  D O W N H I L L  ');
      center(buf, 10, ' Leertaste / Tippen ');
    }
    if (this.state === 'over') {
      center(buf, 8, `  Gestürzt nach ${this.score()} m  `);
      center(buf, 10, ' Nochmal: Leertaste ');
    }
    return buf;
  },
};

// ---------- Spiel 2: Zelt bauen ----------
// Stapelspiel: ein Zeltteil fährt hin und her, Leertaste lässt es fallen.
// Was über den Teil darunter hinausragt, fällt weg. Oben angekommen = Zelt steht.
const tent = {
  id: 'tent',
  keys: ['action'],
  help: 'Leertaste / Tippen: Zeltteil fallen lassen · Genau stapeln!',
  BASE: 20,
  reset() {
    const x = Math.floor((W - this.BASE) / 2);
    this.layers = [{ x, w: this.BASE }];
    this.state = 'ready';
    this.spawn();
  },
  spawn() {
    const prev = this.layers.at(-1);
    this.piece = { x: 0, w: prev.w - 2, dir: 1 };
    this.speed = 0.6 + this.layers.length * 0.12;
    this.pos = 0;
  },
  tick() {
    if (this.state !== 'run') {
      if (pressed.has('action')) { this.reset(); this.state = 'run'; }
      return;
    }
    // Zuerst fallen lassen – genau dort, wo das Teil gerade zu sehen ist
    if (pressed.has('action')) { this.drop(); return; }
    const p = this.piece;
    this.pos += this.speed * p.dir;
    if (this.pos <= 0 || this.pos + p.w >= W) p.dir *= -1;
    this.pos = Math.max(0, Math.min(W - p.w, this.pos));
    p.x = Math.round(this.pos);
  },
  drop() {
    const prev = this.layers.at(-1);
    const p = this.piece;
    // Ein Teil muss 1 Zeichen eingerückt auf dem darunter liegen
    const lo = Math.max(p.x, prev.x + 1);
    const hi = Math.min(p.x + p.w, prev.x + prev.w - 1);
    const w = hi - lo;
    if (w < 2) {
      this.state = 'over';
      sfx('crash');
      return;
    }
    this.layers.push({ x: lo, w });
    sfx(w === p.w ? 'perfect' : 'drop');
    // Oben angekommen: das nächste Teil wäre schmaler als 2 Zeichen
    if (w <= 3 || this.layers.length >= 10) {
      this.state = 'won';
      const score = this.score();
      if (score > best.get(this.id)) best.set(this.id, score);
      sfx('win');
      return;
    }
    this.spawn();
  },
  score() { return this.layers.slice(1).reduce((n, l) => n + l.w, 0) * 10; },
  draw() {
    const buf = blank();
    // Himmel und Boden
    for (const [sx, sy] of [[3, 1], [11, 3], [29, 2], [33, 5], [20, 1], [6, 6]]) put(buf, sx, sy, '*');
    put(buf, W - 6, 1, '(  )');
    put(buf, 0, H - 2, ',,'.repeat(W / 2));
    put(buf, 0, H - 1, '"'.repeat(W));
    const groundY = H - 3;
    this.layers.forEach((l, i) => {
      const y = groundY - i;
      if (i === 0) put(buf, l.x - 1, y, `#${'='.repeat(l.w)}#`);
      else put(buf, l.x, y, l.w <= 2 ? '/\\' : `/${(i === 1 ? '_' : ' ').repeat(Math.max(0, l.w - 2))}\\`);
    });
    // Eingang in die unterste Zeltreihe
    if (this.layers.length > 2) {
      const l = this.layers[1];
      put(buf, l.x + Math.floor(l.w / 2) - 1, groundY - 1, '||');
    }
    if (this.state === 'run') {
      const y = groundY - this.layers.length;
      put(buf, this.piece.x, y, `[${'#'.repeat(Math.max(0, this.piece.w - 2))}]`);
    }
    put(buf, 1, 0, ` ${this.score()} Pkt `);
    put(buf, W - 12, 0, ` Best ${best.get(this.id)} `);
    if (this.state === 'ready') {
      center(buf, 5, '  Z E L T   B A U E N  ');
      center(buf, 7, ' Leertaste / Tippen ');
    }
    if (this.state === 'won') {
      center(buf, 2, ` Zelt steht! ${this.score()} Pkt `);
      center(buf, 4, ' Schlafplatz gesichert. ');
      const top = this.layers.at(-1);
      put(buf, top.x + Math.floor(top.w / 2), groundY - this.layers.length, '|>');
    }
    if (this.state === 'over') {
      center(buf, 5, ' Zelt eingestürzt. ');
      center(buf, 7, ' Nochmal: Leertaste ');
    }
    return buf;
  },
};

// ---------- Spiel 3: Pong gegen Melu-Bot ----------
const pong = {
  id: 'pong',
  keys: ['up', 'down'],
  help: '▲ ▼ Schläger bewegen · Wer zuerst 5 hat, gewinnt',
  PAD: 4,
  reset() {
    this.me = { y: H / 2 - 2, score: 0 };
    this.bot = { y: H / 2 - 2, score: 0 };
    this.state = 'ready';
    this.serve(1);
  },
  serve(dir) {
    this.ball = { x: W / 2, y: 2 + rnd(H - 4), vx: 0.75 * dir, vy: (Math.random() - 0.5) * 0.8 };
    this.wait = 12;
  },
  tick() {
    if (this.state !== 'run') {
      if (pressed.has('action')) { this.reset(); this.state = 'run'; }
      return;
    }
    if (held.has('up')) this.me.y -= 0.8;
    if (held.has('down')) this.me.y += 0.8;
    this.me.y = Math.max(1, Math.min(H - this.PAD, this.me.y));
    // Bot folgt dem Ball, aber etwas träge
    const target = this.ball.y - this.PAD / 2;
    this.bot.y += Math.max(-0.45, Math.min(0.45, (target - this.bot.y) * 0.3));
    this.bot.y = Math.max(1, Math.min(H - this.PAD, this.bot.y));
    if (this.wait > 0) { this.wait--; return; }

    const b = this.ball;
    b.x += b.vx;
    b.y += b.vy;
    if (b.y < 1) { b.y = 1; b.vy *= -1; }
    if (b.y > H - 1) { b.y = H - 1; b.vy *= -1; }
    const paddle = (p, px) => {
      if (Math.round(b.x) !== px) return false;
      const rel = b.y - p.y;
      if (rel < -0.5 || rel > this.PAD - 0.5) return false;
      b.vx = -b.vx * 1.06;
      b.vx = Math.sign(b.vx) * Math.min(1.4, Math.abs(b.vx));
      b.vy = (rel - this.PAD / 2 + 0.5) * 0.35;
      sfx('hit');
      return true;
    };
    if (b.vx < 0) paddle(this.me, 2);
    else paddle(this.bot, W - 3);
    if (b.x < 0) this.point(this.bot, 1);
    if (b.x > W - 1) this.point(this.me, -1);
  },
  point(who, dir) {
    who.score++;
    sfx(who === this.me ? 'coin' : 'crash');
    if (who.score >= 5) {
      this.state = who === this.me ? 'won' : 'over';
      if (who === this.me) {
        // Bester Sieg = grösster Abstand zu Melu
        const margin = 5 - this.bot.score;
        if (margin > best.get(this.id)) best.set(this.id, margin);
        sfx('win');
      }
      return;
    }
    this.serve(dir);
  },
  score() { return this.me.score; },
  draw() {
    const buf = blank();
    for (let y = 0; y < H; y += 2) put(buf, W / 2, y, ':');
    put(buf, 0, 0, '-'.repeat(W));
    const b = best.get(this.id);
    put(buf, 4, H - 1, b ? ` Bester Sieg: 5:${5 - b} ` : ' Noch nie gegen Melu gewonnen ');
    for (let i = 0; i < this.PAD; i++) {
      put(buf, 2, this.me.y + i, '#');
      put(buf, W - 3, this.bot.y + i, '#');
    }
    if (this.state === 'run' && this.wait % 4 < 2) put(buf, this.ball.x, this.ball.y, 'O');
    put(buf, W / 2 - 6, 1, `DU ${this.me.score}`);
    put(buf, W / 2 + 2, 1, `${this.bot.score} MELU`);
    if (this.state === 'ready') {
      center(buf, 7, '  P O N G  ');
      center(buf, 9, ' gegen Melu-Bot ');
      center(buf, 11, ' Leertaste / Tippen ');
    }
    if (this.state === 'won') { center(buf, 8, ' GEWONNEN! Melu weint. '); center(buf, 10, ' Nochmal: Leertaste '); }
    if (this.state === 'over') { center(buf, 8, ' Verloren. Melu jubelt. '); center(buf, 10, ' Nochmal: Leertaste '); }
    return buf;
  },
};

// ---------- Umschalten & Schleife ----------
const GAMES = { downhill, tent, pong };
let game = null;

function select(id) {
  game = GAMES[id];
  game.reset();
  for (const t of document.querySelectorAll('.game-tab')) t.setAttribute('aria-selected', String(t.dataset.game === id));
  for (const b of document.querySelectorAll('.game-ctl [data-key]')) b.hidden = !game.keys.includes(b.dataset.key) && b.dataset.key !== 'action';
  status.textContent = game.help;
  frame(game.draw());
}
for (const t of document.querySelectorAll('.game-tab')) t.addEventListener('click', () => select(t.dataset.game));

setInterval(() => {
  if (!game || document.visibilityState !== 'visible' || !inView()) { pressed = new Set(); return; }
  game.tick();
  pressed = new Set();
  frame(game.draw());
}, 60);

select('downhill');
