// Die Party als Bild: Bauernhaus auf dem Chapf, Wald, Maisfeld, Kühe, Berge im Hintergrund.
// Jede angemeldete Person (inkl. Begleitung) ist ein Mönschli, dazu wir vier Gastgeber.
// Namen gibt es nur für uns vier; von den Gästen kennt die Seite nur die Anzahl.
//
// Ohne Party-Modus steht alles still: alle sind schon da, die Sonne steht am Nachmittag.
// Im Party-Modus kommen die Gäste der Reihe nach (wie sie sich angemeldet haben) über die
// Strasse, und der Tag läuft durch den groben Plan: Brunch → Spiel → Z'Nacht → Schwoofe.
import { isParty } from './party.js';

const svg = document.querySelector('#scene-svg');
const phaseEl = document.querySelector('#scene-phase');
const NS = 'http://www.w3.org/2000/svg';
const MAX_FIGURES = 160;
const PHASE_MS = 11000;
const ENTRANCE = { x: 812, y: 338 };
const HOST_COLORS = ['#ff22ff', '#0000ff', '#00a651', '#ff3300'];
const SHIRTS = ['#ff22ff', '#ffdd00', '#00c853', '#2962ff', '#ff3d00', '#00e5ff', '#aa00ff', '#ff9100', '#f50057', '#76ff03'];

// ---------- Helfer ----------
const el = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.append(node);
  return node;
};
// Deterministischer Zufall: Gleiche Person steht bei jedem Laden am gleichen Ort
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const rand = Math.random;
const meadowEdge = (x) => 300 + 7 * Math.sin(x / 95) + 4 * Math.sin(x / 37);

// ---------- Landschaft ----------
const PHASES = [
  { id: 'vormittag', sky: ['#7cc8ff', '#e9f8ff'], sun: [140, 95], dark: 0, zones: { table: 0.6, meadow: 0.4 } },
  { id: 'nachmittag', sky: ['#3fa9ff', '#cfeeff'], sun: [400, 55], dark: 0, zones: { meadow: 0.75, fire: 0.25 } },
  { id: 'abend', sky: ['#ff6a4d', '#ffc178'], sun: [690, 168], dark: 0.18, zones: { table: 0.55, fire: 0.25, meadow: 0.2 } },
  { id: 'nacht', sky: ['#060d26', '#26346b'], sun: [640, 70], dark: 0.5, zones: { dance: 0.6, fire: 0.4 } },
];
const ZONES = {
  table: { x: 575, y: 392, rx: 95, ry: 22 },
  fire: { x: 205, y: 382, rx: 70, ry: 30 },
  dance: { x: 395, y: 345, rx: 80, ry: 18 },
  meadow: { x: 400, y: 385, rx: 360, ry: 50 },
};

let sky;
let sun;
let stars;
let night;
let glow;
let people;

function drawLandscape() {
  svg.replaceChildren();
  const defs = el('defs', {}, svg);
  const grad = el('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  sky = [el('stop', { offset: 0 }, grad), el('stop', { offset: 1 }, grad)];
  const meadowGrad = el('linearGradient', { id: 'meadow', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#6cc24a' }, meadowGrad);
  el('stop', { offset: 1, 'stop-color': '#3f9a2c' }, meadowGrad);
  const fireGrad = el('radialGradient', { id: 'fireglow' }, defs);
  el('stop', { offset: 0, 'stop-color': '#ffb300', 'stop-opacity': 0.8 }, fireGrad);
  el('stop', { offset: 1, 'stop-color': '#ff6f00', 'stop-opacity': 0 }, fireGrad);

  el('rect', { width: 800, height: 450, fill: 'url(#sky)' }, svg);

  // Sterne (nur nachts sichtbar)
  stars = el('g', { class: 'stars' }, svg);
  const r = seeded(7);
  for (let i = 0; i < 60; i++) el('circle', { cx: r() * 800, cy: r() * 170, r: 0.6 + r() * 1.2, fill: '#fff' }, stars);

  sun = el('circle', { r: 22, class: 'sun' }, svg);

  // Wolken
  const clouds = el('g', { class: 'clouds', fill: '#fff' }, svg);
  for (const [x, y, s] of [[90, 60, 1], [330, 40, 1.4], [600, 75, 1.1], [760, 35, 0.8]]) {
    const c = el('g', { transform: `translate(${x} ${y}) scale(${s})` }, clouds);
    el('ellipse', { cx: 0, cy: 0, rx: 34, ry: 11 }, c);
    el('ellipse', { cx: -14, cy: -7, rx: 16, ry: 10 }, c);
    el('ellipse', { cx: 12, cy: -9, rx: 18, ry: 12 }, c);
  }

  // Berge hinten: links Hügelzug, Mitte die lange Felswand, rechts ein Schneegipfel
  el('path', {
    fill: '#8a9cb3',
    d: 'M0 205 L40 196 L110 199 L170 190 L196 176 L214 196 L262 210 L300 202 L318 186 L338 150 L352 138 L380 142 L398 134 L418 140 L440 131 L462 137 L486 130 L506 138 L520 149 L548 165 L576 180 L604 176 L618 166 L632 178 L700 190 L800 186 L800 300 L0 300 Z',
  }, svg);
  el('path', { fill: '#a7b6c9', d: 'M338 150 L352 138 L380 142 L398 134 L418 140 L440 131 L462 137 L486 130 L506 138 L520 149 L512 156 L470 150 L430 154 L392 150 L350 160 Z' }, svg);
  el('path', { fill: '#fff', d: 'M604 176 L618 166 L632 178 L622 176 L614 180 Z' }, svg);

  // Mittlere Hügel
  el('path', { fill: '#4d7f55', d: 'M0 238 Q110 212 250 232 T520 226 Q640 214 800 206 V320 H0 Z' }, svg);
  // Grosser Waldhügel rechts mit Weide oben
  el('path', { fill: '#24502d', d: 'M430 280 Q600 215 800 168 V330 H430 Z' }, svg);
  el('path', { fill: '#86c46a', d: 'M620 222 Q710 186 800 172 V206 Q720 218 650 238 Z' }, svg);
  barn(735, 205, 0.55);
  // Weide links
  el('path', { fill: '#77bb5c', d: 'M0 252 Q90 238 190 262 Q250 278 300 300 V330 H0 Z' }, svg);

  // Wald (Tannen) entlang der Wiese, zwei Reihen
  const forest = el('g', {}, svg);
  const tr = seeded(42);
  for (const [row, dy, from] of [[0, -16, 250], [1, -4, 270]]) {
    for (let x = from; x < 805; x += 7 + tr() * 5) {
      if (row === 1 && x > 300 && x < 360) continue;
      const h = 26 + tr() * 26;
      const w = 9 + tr() * 6;
      const base = meadowEdge(x) + dy + (x > 600 ? -10 - (x - 600) * 0.05 : 0);
      el('path', { d: `M${x} ${base - h} L${x + w} ${base} L${x - w} ${base} Z`, fill: tr() < 0.5 ? '#1b4224' : '#22512b' }, forest);
    }
  }
  // Ein paar Laubbäume links
  for (const [x, y, s] of [[40, 286, 1], [70, 280, 0.8], [262, 292, 1.1], [300, 296, 0.9]]) {
    el('rect', { x: x - 2, y: y, width: 4, height: 14 * s, fill: '#5d4037' }, forest);
    el('circle', { cx: x, cy: y - 4, r: 14 * s, fill: '#3e8e41' }, forest);
  }

  // Kühe hinten links auf der Weide (eine feiert mit)
  for (const [x, y, c, hat] of [[105, 266, '#8d4a1d', false], [150, 274, '#1a1a1a', true], [190, 284, '#a0522d', false], [125, 288, '#8d4a1d', false]]) cow(x, y, c, hat, 0.55);

  // Wiese vorne
  el('path', { fill: 'url(#meadow)', d: `M0 ${meadowEdge(0)} ${Array.from({ length: 41 }, (_, i) => `L${i * 20} ${meadowEdge(i * 20)}`).join(' ')} L800 450 L0 450 Z` }, svg);

  // Maisfeld rechts hinter der Strasse
  const corn = el('g', {}, svg);
  el('path', { fill: '#a4c639', d: 'M520 316 L770 300 L800 312 L800 336 L540 334 Z' }, corn);
  for (let x = 530; x < 800; x += 8) el('path', { d: `M${x} ${333 - (x - 520) * 0.01} l4 -${16 + (x % 3) * 2}`, stroke: '#7a9a1f', 'stroke-width': 1.5 }, corn);

  // Strasse: vom Haus nach rechts aus dem Bild (da kommen die Gäste)
  el('path', { d: 'M420 314 Q480 330 560 338 T820 340', stroke: '#d9cfb4', 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' }, svg);

  house();

  // Feuerstelle
  const fire = el('g', { class: 'fire', transform: `translate(${ZONES.fire.x} ${ZONES.fire.y - 6})` }, svg);
  glow = el('circle', { r: 46, fill: 'url(#fireglow)', class: 'fire-glow' }, fire);
  el('path', { d: 'M-14 6 L14 -2 M-14 -2 L14 6', stroke: '#5d4037', 'stroke-width': 4 }, fire);
  el('path', { class: 'flame', d: 'M-9 2 Q-10 -12 -2 -20 Q-3 -10 4 -16 Q10 -6 9 2 Z', fill: '#ff9100' }, fire);
  el('path', { class: 'flame flame2', d: 'M-4 2 Q-5 -8 0 -12 Q3 -6 5 2 Z', fill: '#ffea00' }, fire);

  // Langer Tisch mit Bänken
  const table = el('g', { transform: `translate(${ZONES.table.x} ${ZONES.table.y - 14})` }, svg);
  el('rect', { x: -70, y: -6, width: 140, height: 7, fill: '#8d5a2b', stroke: '#000', 'stroke-width': 1 }, table);
  for (const x of [-62, 58]) el('rect', { x, y: 1, width: 4, height: 10, fill: '#5d4037' }, table);
  for (const [x, t] of [[-50, '🥐'], [-20, '🍺'], [10, '🍝'], [40, '🎂']]) {
    const tx = el('text', { x, y: -7, 'font-size': 11, 'text-anchor': 'middle' }, table);
    tx.textContent = t;
  }


  // Nacht-Abdunklung über der Landschaft, Lichter und Leute bleiben hell
  night = el('rect', { width: 800, height: 450, fill: '#0a1030', opacity: 0, class: 'night' }, svg);
  lights();

  people = el('g', { class: 'people' }, svg);
}

function barn(x, y, s) {
  const g = el('g', { transform: `translate(${x} ${y}) scale(${s})` }, svg);
  el('rect', { x: -30, y: -10, width: 60, height: 18, fill: '#c9b79c' }, g);
  el('path', { d: 'M-38 -8 L-22 -24 L22 -24 L38 -8 Z', fill: '#7b7b7b' }, g);
}

// Emmentaler Bauernhaus: riesiges graues Walmdach, Holzfassade, Fensterreihe
function house() {
  const g = el('g', { class: 'house' }, svg);
  el('rect', { x: 312, y: 290, width: 30, height: 22, fill: '#9c6b3c' }, g); // Anbau
  el('path', { d: 'M306 292 L326 276 L350 290 Z', fill: '#666' }, g);
  el('rect', { x: 340, y: 266, width: 112, height: 48, fill: '#b5834e', stroke: '#5d3a1a', 'stroke-width': 1.5 }, g);
  for (let x = 345; x < 450; x += 9) el('path', { d: `M${x} 268 V313`, stroke: '#9c6b3c', 'stroke-width': 1 }, g);
  // Dach mit Krüppelwalm (vorne abgeschnittene Spitze)
  el('path', { d: 'M318 272 L356 226 L436 226 L474 272 Z', fill: '#707070', stroke: '#3a3a3a', 'stroke-width': 1.5 }, g);
  el('path', { d: 'M356 226 L436 226 L452 246 L340 246 Z', fill: '#848484' }, g);
  el('path', { d: 'M372 246 Q396 236 420 246 L420 266 L372 266 Z', fill: '#9c6b3c', stroke: '#5d3a1a', 'stroke-width': 1 }, g);
  // Fenster (werden nachts hell)
  const win = el('g', { class: 'windows' }, g);
  for (let x = 348; x < 446; x += 14) el('rect', { x, y: 276, width: 8, height: 8, fill: '#fff4c2', stroke: '#5d3a1a', 'stroke-width': 1 }, win);
  for (const x of [382, 400]) el('rect', { x, y: 252, width: 8, height: 8, fill: '#fff4c2', stroke: '#5d3a1a', 'stroke-width': 1 }, win);
  el('rect', { x: 412, y: 292, width: 18, height: 22, fill: '#6d4321' }, g); // Tenntor
  // Schild
  el('path', { d: 'M470 316 V292', stroke: '#5d4037', 'stroke-width': 2 }, g);
  el('rect', { x: 452, y: 280, width: 38, height: 13, fill: '#ffff00', stroke: '#000', 'stroke-width': 1.5 }, g);
  const t = el('text', { x: 471, y: 290, 'font-size': 10, 'text-anchor': 'middle', class: 'sign' }, g);
  t.textContent = 'CHAPF';
}

function cow(x, y, color, hat, scale = 1) {
  const g = el('g', { transform: `translate(${x} ${y}) scale(${scale})`, class: 'cow' }, svg);
  el('ellipse', { cx: 0, cy: 0, rx: 15, ry: 7, fill: color }, g);
  el('ellipse', { cx: -4, cy: -1, rx: 4, ry: 3, fill: '#fff', opacity: 0.85 }, g);
  el('ellipse', { cx: 15, cy: -5, rx: 5, ry: 4, fill: color }, g);
  el('ellipse', { cx: 18, cy: -3, rx: 2.5, ry: 2, fill: '#f3b5a0' }, g);
  if (hat) el('path', { d: 'M12 -8 L15 -20 L18 -8 Z', fill: '#ff22ff', stroke: '#000', 'stroke-width': 0.8 }, g);
}

// Lichterkette vom Dach zur Feuerstelle und zum Tisch, Discokugel über der Tanzfläche
function lights() {
  const g = el('g', { class: 'lights' }, svg);
  const chains = [[[322, 272], [150, 330]], [[470, 272], [660, 350]]];
  const colors = ['#ff22ff', '#ffff00', '#00e5ff', '#00ff66', '#ff3300'];
  for (const [[x1, y1], [x2, y2]] of chains) {
    el('path', { d: `M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + 12} ${x2} ${y2}`, stroke: '#222', 'stroke-width': 1, fill: 'none' }, g);
    el('path', { d: `M${x2} ${y2} V${y2 + 30}`, stroke: '#5d4037', 'stroke-width': 2 }, g);
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      const qx = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * ((x1 + x2) / 2) + t * t * x2;
      const qy = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * (Math.max(y1, y2) + 12) + t * t * y2;
      el('circle', { cx: qx, cy: qy + 2, r: 2.4, fill: colors[i % colors.length], class: `bulb b${i % 3}` }, g);
    }
  }
  discoBall(g);
}

// Discokugel, hängt an der Dachkante. Drehen = Facetten wandern seitwärts durch den Kreis.
function discoBall(parent) {
  const R = 8;
  const ball = el('g', { transform: 'translate(396 290)', class: 'disco' }, parent);
  const defs = svg.querySelector('defs');
  const clip = el('clipPath', { id: 'discoclip' }, defs);
  el('circle', { r: R }, clip);

  // Lichtstrahlen (drehen sich langsam)
  const rays = el('g', { class: 'rays' }, ball);
  const rayColors = ['#ff22ff', '#00e5ff', '#ffff00', '#00ff66', '#ff3300', '#ffffff'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = 70 + (i % 3) * 30;
    const w = 0.06;
    el('path', {
      d: `M0 0 L${Math.cos(a - w) * len} ${Math.sin(a - w) * len} L${Math.cos(a + w) * len} ${Math.sin(a + w) * len} Z`,
      fill: rayColors[i % rayColors.length],
    }, rays);
  }

  el('path', { d: `M0 -18 V-${R}`, stroke: '#222', 'stroke-width': 1 }, ball);
  el('circle', { r: R, fill: '#90a4ae' }, ball);
  const facets = el('g', { 'clip-path': 'url(#discoclip)' }, ball);
  const strip = el('g', { class: 'facets' }, facets);
  const shades = ['#eceff1', '#b0bec5', '#ffffff', '#cfd8dc', '#78909c', '#e1f5fe'];
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 6; row++) {
      el('rect', {
        x: -R + col * 3, y: -R + row * 3, width: 2.6, height: 2.6,
        fill: shades[((col % 2) * 3 + row) % shades.length], // Muster wiederholt sich alle 6px → nahtlos drehen
      }, strip);
    }
  }
  el('circle', { r: R, fill: 'none', stroke: '#455a64', 'stroke-width': 0.8 }, ball);
  el('circle', { cx: -3, cy: -3, r: 1.6, fill: '#fff', class: 'glint' }, ball);
}

// ---------- Leute ----------
// Eine Person: Strich-Mönschli mit farbigem Pulli; Gastgeber grösser, mit Hut und Namen
function figure({ name, color, host, title }) {
  const g = el('g', { class: `p${host ? ' host' : ''}` });
  el('title', {}, g).textContent = title;
  const body = el('g', { class: 'body' }, g);
  el('path', { class: 'leg l1', d: 'M0 -9 L-3 0' }, body);
  el('path', { class: 'leg l2', d: 'M0 -9 L3 0' }, body);
  el('path', { d: 'M0 -9 V-19', stroke: color, 'stroke-width': 4.2 }, body);
  el('path', { class: 'arm a1', d: 'M0 -17 L-5 -11' }, body);
  el('path', { class: 'arm a2', d: 'M0 -17 L5 -11' }, body);
  el('circle', { cy: -23, r: 3.6, fill: '#fff' }, body);
  if (host) el('path', { d: 'M-4 -26 L0 -34 L4 -26 Z', fill: color, stroke: '#000', 'stroke-width': 0.8 }, body);
  if (name) {
    const label = el('text', { class: 'lbl', y: host ? -38 : -30, 'text-anchor': 'middle' }, g);
    label.textContent = name;
  }
  people.append(g);
  return g;
}

let hosts = [];
let guests = [];
let plan = [];
let figures = [];
let phase = 1;
let phaseAt = 0;
let spawnAt = 0;
let running = false;
let visible = true;

function homeSpot(i) {
  const r = seeded(1000 + i * 7919);
  for (;;) {
    const x = 30 + r() * 740;
    const y = 335 + r() * 100;
    // nicht in den Tisch, nicht ins Feuer
    if (Math.abs(x - ZONES.table.x) < 80 && Math.abs(y - (ZONES.table.y - 14)) < 16) continue;
    if (Math.abs(x - ZONES.fire.x) < 22 && Math.abs(y - ZONES.fire.y) < 14) continue;
    return { x, y };
  }
}

function zoneSpot(zone) {
  const z = ZONES[zone];
  const a = rand() * Math.PI * 2;
  const d = Math.sqrt(rand());
  let x = z.x + Math.cos(a) * z.rx * d;
  let y = z.y + Math.sin(a) * z.ry * d;
  if (zone === 'fire' && Math.hypot((x - z.x) / 1.6, y - z.y) < 22) y += 26; // nicht ins Feuer
  if (zone === 'table') y = rand() < 0.5 ? z.y - 26 : z.y + 4; // vor oder hinter dem Tisch
  x = Math.max(12, Math.min(788, x));
  y = Math.max(meadowEdge(x) + 22, Math.min(444, y));
  return { x, y };
}

function pickZone() {
  const zones = Object.entries(PHASES[phase].zones);
  let t = rand();
  for (const [z, w] of zones) { if ((t -= w) <= 0) return z; }
  return zones[0][0];
}

function build() {
  people.replaceChildren();
  figures = [];
  hosts.forEach((name, i) => {
    const color = HOST_COLORS[i % HOST_COLORS.length];
    figures.push({ g: figure({ name, color, host: true, title: `${name} (Gastgeber*in)` }), home: { x: 345 + i * 38, y: 334 + (i % 2) * 14 }, host: true });
  });
  for (const g of guests) addGuest(g);
  if (isParty()) startParty();
  else settle();
}

// Ein Gast und seine Begleitung als Mönschli (ohne Namen, die zeigen wir nur von uns vier) (höchstens MAX_FIGURES insgesamt)
function addGuest(g) {
  const added = [];
  let n = figures.filter((f) => !f.host).length;
  for (let k = 0; k <= g.plus && n < MAX_FIGURES; k++, n++) {
    const companion = k > 0;
    const f = {
      g: figure({
        color: SHIRTS[(n * 7) % SHIRTS.length],
        title: companion ? 'Begleitig' : 'Gast',
      }),
      home: homeSpot(n),
    };
    figures.push(f);
    added.push(f);
  }
  return added;
}

function place(f) {
  const s = 0.85 + (f.y - 300) / 145 * 0.65 + (f.host ? 0.15 : 0);
  const flip = f.flip ? -1 : 1;
  f.g.setAttribute('transform', `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${(s * flip).toFixed(3)} ${s.toFixed(3)})`);
  f.g.classList.toggle('flip', !!f.flip);
}

function zsort() {
  [...figures].sort((a, b) => a.y - b.y).forEach((f) => people.append(f.g));
}

// Ohne Party: alle stehen ruhig an ihrem Platz, Nachmittag
function settle() {
  running = false;
  setPhase(1);
  for (const f of figures) {
    Object.assign(f, { ...f.home, arrived: true, mode: 'idle', flip: false });
    f.g.classList.remove('walk', 'dance', 'away');
    place(f);
  }
  zsort();
}

function startParty() {
  phaseAt = performance.now();
  setPhase(0);
  for (const f of figures) {
    f.g.classList.remove('walk', 'dance');
    if (f.host) {
      Object.assign(f, { ...f.home, arrived: true, mode: 'idle', wait: rand() * 2000 });
    } else {
      Object.assign(f, { ...ENTRANCE, arrived: false, mode: 'queue' });
      f.g.classList.add('away');
    }
    place(f);
  }
  spawnAt = performance.now() + 600;
  running = true;
  loop();
}

function setPhase(i) {
  phase = i;
  const p = PHASES[i];
  sky[0].setAttribute('stop-color', p.sky[0]);
  sky[1].setAttribute('stop-color', p.sky[1]);
  sun.setAttribute('cx', p.sun[0]);
  sun.setAttribute('cy', p.sun[1]);
  svg.dataset.phase = p.id;
  night.setAttribute('opacity', p.dark);
  const item = plan.find((x) => x.id === p.id);
  phaseEl.textContent = item ? `${item.emoji} ${item.when}: ${item.what}` : '';
}

let last = 0;
let lastSort = 0;
function loop(now = performance.now()) {
  if (!running) return;
  if (!visible || document.visibilityState !== 'visible') { last = 0; requestAnimationFrame(loop); return; }
  const dt = last ? Math.min(50, now - last) : 16;
  last = now;

  // Tag läuft durch den Plan
  if (now - phaseAt > PHASE_MS) {
    phaseAt = now;
    setPhase((phase + 1) % PHASES.length);
    for (const f of figures) if (f.arrived && f.mode !== 'walk') f.wait = rand() * 1500;
  }

  // Nächster Gast kommt (am Anfang gemütlich, bei vielen Leuten schneller)
  const queued = figures.filter((f) => f.mode === 'queue');
  if (queued.length && now > spawnAt) {
    const f = queued[0];
    f.g.classList.remove('away');
    f.mode = 'walk';
    f.target = zoneSpot(pickZone());
    spawnAt = now + Math.max(180, 9000 / Math.max(queued.length, 6));
  }

  for (const f of figures) {
    if (f.mode === 'queue') continue;
    if (f.mode === 'walk') {
      const dx = f.target.x - f.x;
      const dy = f.target.y - f.y;
      const d = Math.hypot(dx, dy);
      const step = 0.045 * dt * (f.arrived ? 1 : 1.4);
      if (d <= step) {
        f.x = f.target.x;
        f.y = f.target.y;
        f.arrived = true;
        const dancing = PHASES[phase].id === 'nacht' && Math.hypot((f.x - ZONES.dance.x) / ZONES.dance.rx, (f.y - ZONES.dance.y) / ZONES.dance.ry) < 1.3;
        f.mode = dancing ? 'dance' : 'idle';
        f.wait = (dancing ? 4000 : 1500) + rand() * 5000;
        f.g.classList.remove('walk');
        f.g.classList.toggle('dance', dancing);
      } else {
        f.x += (dx / d) * step;
        f.y += (dy / d) * step;
        f.flip = dx < 0;
        f.g.classList.add('walk');
      }
      place(f);
    } else {
      f.wait -= dt;
      if (f.wait <= 0) {
        f.mode = 'walk';
        f.g.classList.remove('dance');
        f.target = f.host && rand() < 0.4 ? zoneSpot('dance') : zoneSpot(pickZone());
      }
    }
  }
  if (now - lastSort > 400) { lastSort = now; zsort(); }
  requestAnimationFrame(loop);
}

// ---------- Leise wummernde Bässe ----------
// Wie wenn man die Party von weitem hört: dumpfe Kick auf jedem Schlag, Bass dazwischen,
// alles durch einen Tiefpass. Läuft im Party-Modus, wird lauter gegen die Nacht hin
// und ist nur hörbar, solange man das Wimmelbild sieht. Musik aus (🔇) = auch kein Bass.
const bass = (() => {
  const STEP = 0.25; // Sekunden pro Achtel, 120 BPM
  const LINE = [45, 0, 45, 45, 43, 0, 43, 40]; // MIDI-Noten, 0 = Pause
  const LEVEL = { vormittag: 0.25, nachmittag: 0.4, abend: 0.7, nacht: 1 };
  let ctx = null;
  let out = null;
  let timer = null;
  let next = 0;
  let step = 0;
  const musicOff = () => { try { return localStorage.getItem('kapf-music') === 'off'; } catch { return false; } };
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);

  function kick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.4);
  }
  function note(t, m) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.9);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + STEP);
  }
  function tick() {
    const target = running && visible && !musicOff() ? 0.09 * (LEVEL[PHASES[phase].id] ?? 0.5) : 0;
    out.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
    while (next < ctx.currentTime + 0.3) {
      if (step % 2 === 0) kick(next);
      const m = LINE[step % LINE.length];
      if (m && step % 2 === 1) note(next, m);
      else if (m && step % 4 === 2) note(next + STEP / 2, m);
      next += STEP;
      step++;
    }
  }
  return {
    start() {
      // Läuft im Klick auf den Party-Knopf, also darf der Browser Ton machen
      ctx ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      if (!out) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 160;
        out = ctx.createGain();
        out.gain.value = 0;
        out.connect(lp).connect(ctx.destination);
      }
      ctx.resume();
      next = ctx.currentTime + 0.1;
      clearInterval(timer);
      timer = setInterval(tick, 100);
    },
    stop() {
      clearInterval(timer);
      timer = null;
      if (out) out.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    pause(hidden) {
      if (!ctx || !timer) return;
      if (hidden) ctx.suspend(); else ctx.resume();
    },
  };
})();

// ---------- Start ----------
async function load() {
  try {
    const [party, ev] = await Promise.all([
      fetch('/api/party').then((r) => r.json()),
      fetch('/api/event').then((r) => r.json()),
    ]);
    plan = ev.plan ?? [];
    hosts = party.hosts ?? [];
    guests = party.guests ?? [];
  } catch {
    hosts = ['Tim', 'Röbu', 'Chrigu', 'Melu'];
  }
  build();
}

if (svg) {
  drawLandscape();
  load();

  addEventListener('kapf:party', ({ detail: on }) => {
    if (on) { startParty(); bass.start(); } else { settle(); bass.stop(); }
  });

  // Frisch angemeldet: du kommst dazu (im Party-Modus über die Strasse)
  addEventListener('kapf:registered', ({ detail }) => {
    const g = { plus: detail.plus };
    guests.push(g);
    const added = addGuest(g);
    for (const f of added) {
      if (running) {
        Object.assign(f, { ...ENTRANCE, arrived: false, mode: 'queue' });
        f.g.classList.add('away');
      } else {
        Object.assign(f, { ...f.home, arrived: true, mode: 'idle' });
      }
      place(f);
    }
    spawnAt = performance.now() + 1500;
    zsort();
  });

  // Nur rechnen, wenn man die Kachel sieht
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(svg);
  document.addEventListener('visibilitychange', () => bass.pause(document.visibilityState !== 'visible'));
}
