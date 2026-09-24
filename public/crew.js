// Die Crew: Tim, Röbu, Chrigu & Melu als Strichmännchen.
// Jede*r sucht sich ein Element aus, klettert daran hoch und macht oben etwas:
// Velo fahren, am kleinen PC sitzen oder Ski fahren. Dann Sprung und nächstes Element.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const layer = document.querySelector('#crew');

const CREW = [
  { name: 'Tim', color: '#ff22ff', fav: 'bike' },
  { name: 'Röbu', color: '#0000ff', fav: 'pc' },
  { name: 'Chrigu', color: '#00a651', fav: 'ski' },
  { name: 'Melu', color: '#ff3300', fav: 'bike' },
];
const ACTIVITIES = ['bike', 'pc', 'ski'];
const TARGETS = 'header h1, .fact, .box:not([hidden]) > h2, .question, #signup-form > label:not([hidden]), #signup-form > fieldset, .btn-go, #done, footer p';

const W = 40;
const H = 50;

// Alle Posen in einem SVG; CSS zeigt je nach Klasse die passende (style.css, «Crew»).
const svg = (color, name) => `
<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"
  fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <g class="p-climb">
    <circle cx="20" cy="9" r="5" fill="#fff"/>
    <path d="M20 14 V31"/>
    <path class="arm-a" d="M20 18 L12 8"/><path class="arm-b" d="M20 18 L28 12"/>
    <path class="leg-a" d="M20 31 L13 40 L14 48"/><path class="leg-b" d="M20 31 L27 38 L26 46"/>
    <path d="M15 5 Q20 0 25 5" stroke="${color}" stroke-width="3"/>
  </g>
  <g class="p-bike">
    <g class="wheel"><circle cx="9" cy="41" r="7"/><path d="M9 34 V48 M2 41 H16" stroke-width="1"/></g>
    <g class="wheel"><circle cx="31" cy="41" r="7"/><path d="M31 34 V48 M24 41 H38" stroke-width="1"/></g>
    <path d="M9 41 L17 30 L27 30 L31 41 M17 30 L20 41 L27 30 M26 30 L28 25" stroke="${color}"/>
    <circle cx="21" cy="9" r="5" fill="#fff"/>
    <path d="M20 14 L17 28"/><path d="M19 18 L28 25"/>
    <g class="crank"><path d="M17 28 L22 36 L20 41"/><path d="M17 28 L16 36 L20 41" opacity=".6"/></g>
    <path d="M16 5 Q21 0 26 5" stroke="${color}" stroke-width="3"/>
  </g>
  <g class="p-pc">
    <circle cx="13" cy="15" r="5" fill="#fff"/>
    <path d="M13 20 L13 36 L24 36 L24 48"/>
    <path class="type" d="M13 25 L22 31 L27 31"/>
    <path d="M24 36 H40" stroke-width="1.5"/>
    <rect x="27" y="24" width="12" height="9" fill="#111"/>
    <rect class="screen" x="28.5" y="25.5" width="9" height="6" fill="${color}" stroke="none"/>
    <path d="M26 34 H40" stroke-width="3"/>
    <path d="M8 11 Q13 6 18 11" stroke="${color}" stroke-width="3"/>
  </g>
  <g class="p-ski">
    <circle cx="20" cy="13" r="5" fill="#fff"/>
    <path d="M20 18 L18 30"/>
    <path d="M18 30 L25 36 L20 45 M18 30 L13 38 L16 45"/>
    <path d="M19 22 L28 28 L33 48 M19 22 L10 28 L7 48" stroke-width="1.4"/>
    <path d="M4 46 L36 46 Q40 46 40 42" stroke="${color}" stroke-width="3"/>
    <path d="M15 9 Q20 4 25 9" stroke="${color}" stroke-width="3"/>
  </g>
</svg><b class="tag">${name}</b>`;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const busy = new Set();
let paused = false;

// Seite schüttelt sich zusammen (app.js) → Crew hält still
addEventListener('kapf:collapse', () => { paused = true; });
addEventListener('kapf:tidy', () => { paused = false; });

function docRect(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height, bottom: r.bottom + scrollY, right: r.right + scrollX };
}

// Möglichst ein Element im sichtbaren Bereich
function chooseTarget() {
  const all = [...document.querySelectorAll(TARGETS)].filter((el) => {
    if (busy.has(el) || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 90 && r.height > 18;
  });
  const visible = all.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top > 40 && r.bottom < innerHeight - 10;
  });
  return pick(visible.length ? visible : all);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (cond) => { while (!cond()) await sleep(300); };

class Guy {
  constructor({ name, color, fav }, i) {
    this.name = name;
    this.fav = fav;
    this.el = document.createElement('div');
    this.el.className = 'guy';
    this.el.innerHTML = svg(color, name);
    this.el.title = name;
    layer.append(this.el);
    this.x = -100;
    this.y = -100;
    this.flip = false;
    this.first = true;
    setTimeout(() => this.run(), 800 + i * 1700);
  }

  pose(p) { this.el.dataset.pose = p; }

  place(x, y, flip = this.flip) {
    this.x = x;
    this.y = y;
    this.flip = flip;
    // Ankerpunkt: Mitte unten (die Füsse)
    this.el.style.transform = `translate(${x - W / 2}px, ${y - H}px) scaleX(${flip ? -1 : 1})`;
  }

  // Sanfte Bewegung von A nach B, optional mit Bogen (Sprung)
  async move(x, y, ms, arc = 0) {
    const x0 = this.x;
    const y0 = this.y;
    const t0 = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        if (paused) { requestAnimationFrame(step); return; }
        const t = Math.min(1, (now - t0) / ms);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        this.place(x0 + (x - x0) * e, y0 + (y - y0) * e - Math.sin(Math.PI * t) * arc);
        if (t < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
  }

  async run() {
    for (;;) {
      await until(() => !paused && document.visibilityState === 'visible');
      const target = chooseTarget();
      if (!target) { await sleep(2000); continue; }
      busy.add(target);
      try {
        await this.visit(target);
      } finally {
        busy.delete(target);
      }
      await sleep(rand(300, 1500));
    }
  }

  async visit(target) {
    let r = docRect(target);
    const fromLeft = Math.random() < 0.5;
    const wallX = fromLeft ? r.left - 4 : r.right + 4;

    // Einblenden am Fuss des Elements, dann hochklettern
    this.el.classList.remove('gone');
    this.pose('climb');
    this.el.classList.add('climbing');
    this.place(wallX, r.bottom + 6, !fromLeft);
    await this.move(wallX, r.top + H * 0.35, Math.max(1200, r.height * 28));
    this.el.classList.remove('climbing');

    // Über die Kante aufs Element
    r = docRect(target);
    const edgeX = fromLeft ? r.left + 22 : r.right - 22;
    await this.move(edgeX, r.top + 2, 450, 18);

    // Oben: Aktivität
    const act = this.first ? this.fav : pick(ACTIVITIES);
    this.first = false;
    this.pose(act);
    const laps = act === 'pc' ? 0 : Math.round(rand(1, 3));
    if (act === 'pc') {
      await sleep(rand(4000, 8000));
    } else {
      // Velo/Ski: über das Element hin und her
      for (let i = 0; i < laps * 2; i++) {
        if (paused) break;
        r = docRect(target);
        const goRight = (i % 2 === 0) === fromLeft;
        const x = goRight ? r.right - 22 : r.left + 22;
        this.flip = !goRight;
        const speed = act === 'ski' ? 0.22 : 0.12; // px pro ms
        await this.move(x, r.top + 2, Math.max(600, Math.abs(x - this.x) / speed), act === 'ski' ? 4 : 0);
      }
    }

    // Absprung (Ski mit Salto) und weg
    r = docRect(target);
    const off = this.flip ? r.left - 30 : r.right + 30;
    this.pose(act === 'ski' ? 'ski' : 'climb');
    if (act === 'ski') this.el.classList.add('flipping');
    await this.move(off, r.bottom + 10, 700, 50);
    this.el.classList.remove('flipping');
    this.el.classList.add('gone');
    await sleep(400);
  }
}

if (!reduced && layer) CREW.forEach((c, i) => new Guy(c, i));
