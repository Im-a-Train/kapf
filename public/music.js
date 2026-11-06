// 8-Bit-Hintergrundmusik, live mit Web Audio erzeugt (keine Audiodateien).
// Browser spielen Ton erst nach einer Interaktion: die Musik startet beim ersten Tipp/Klick
// irgendwo auf der Seite, der Knopf unten links schaltet sie aus und wieder ein.
// Die Wahl merkt sich der Browser (localStorage).
const btn = document.querySelector('#music-btn');
const PREF = 'kapf-music';
const pref = {
  get: () => { try { return localStorage.getItem(PREF); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(PREF, v); } catch {} },
};

const BEAT = 0.3; // Sekunden pro Schlag
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// ---------- Die Komposition ----------
// Ereignisse: [Start in Schlägen, Dauer in Schlägen, MIDI-Note, Stimme]
function compose() {
  const ev = [];
  let t = 0;

  // Teil 1: «Happy Birthday» (3/4), eine Oktave hoch, Rechteck-Lead
  const hb = [
    [74, 0.75], [74, 0.25], [76, 1], [74, 1], [79, 1], [78, 2],
    [74, 0.75], [74, 0.25], [76, 1], [74, 1], [81, 1], [79, 2],
    [74, 0.75], [74, 0.25], [86, 1], [83, 1], [79, 1], [78, 1], [76, 1],
    [84, 0.75], [84, 0.25], [83, 1], [79, 1], [81, 1], [79, 3],
  ];
  const start = t;
  for (const [n, d] of hb) { ev.push([t, d * 0.9, n, 'lead']); t += d; }
  // Bass auf jeder Zählzeit 1 (nach dem Auftakt), Akkorde G D D G G C G D G
  const bass = [43, 50, 50, 43, 43, 48, 43, 50, 43];
  bass.forEach((n, i) => {
    const bar = start + 1 + i * 3;
    ev.push([bar, 1.4, n, 'bass'], [bar + 1.5, 0.5, n + 12, 'bass']);
  });
  t = start + 1 + bass.length * 3;

  // Teil 2: Party-Arpeggio (4/4), G – Em – C – D, zweimal
  const chords = [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]];
  const melody = [79, 81, 83, 86, 83, 81, 79, 76, 79, 81, 83, 81, 79, 78, 74, 78];
  for (let rep = 0; rep < 2; rep++) {
    chords.forEach((ch, ci) => {
      const bar = t;
      for (let s = 0; s < 16; s++) {
        const n = ch[[0, 1, 2, 1][s % 4]] + 12 + (s >= 8 ? 12 : 0);
        ev.push([bar + s * 0.25, 0.2, n, 'arp']);
      }
      ev.push([bar, 0.9, ch[0] - 12, 'bass'], [bar + 1, 0.4, ch[0], 'bass'], [bar + 2, 0.9, ch[0] - 12, 'bass'], [bar + 3, 0.4, ch[0], 'bass']);
      for (let s = 0; s < 4; s++) ev.push([bar + s, 0.1, 0, s % 2 ? 'snare' : 'kick']);
      for (let s = 0; s < 8; s++) ev.push([bar + s * 0.5 + 0.25, 0.05, 0, 'hat']);
      if (rep === 1) for (let s = 0; s < 4; s++) ev.push([bar + s, 0.9, melody[ci * 4 + s], 'lead']);
      t += 4;
    });
  }
  return { ev, length: t };
}
const SONG = compose();

// ---------- Synth ----------
let ctx = null;
let master = null;
let noise = null;
let playing = false;
let songStart = 0;
let nextIdx = 0;
let loops = 0;
let timer = null;

function setup() {
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.07;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

function tone(type, freq, at, dur, vol, slideTo) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(vol, at);
  g.gain.setValueAtTime(vol, at + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, at + dur);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function hit(at, dur, vol, highpass) {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = highpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  s.connect(f).connect(g).connect(master);
  s.start(at);
  s.stop(at + dur);
}

function play([beat, dur, note, voice], at) {
  const d = dur * BEAT;
  switch (voice) {
    case 'lead': return tone('square', midiHz(note), at, d, 0.5);
    case 'arp': return tone('square', midiHz(note), at, d, 0.18);
    case 'bass': return tone('triangle', midiHz(note), at, d, 0.9);
    case 'kick': return tone('square', 150, at, 0.12, 0.6, 40);
    case 'snare': return hit(at, 0.12, 0.5, 1200);
    case 'hat': return hit(at, 0.04, 0.25, 7000);
  }
}

// Plant immer die nächsten ~0.3 s voraus ein
function schedule() {
  const horizon = ctx.currentTime + 0.3;
  for (;;) {
    if (nextIdx >= SONG.ev.length) {
      nextIdx = 0;
      loops++;
      songStart += SONG.length * BEAT;
    }
    const e = SONG.ev[nextIdx];
    const at = songStart + e[0] * BEAT;
    if (at > horizon) break;
    if (at >= ctx.currentTime - 0.05) play(e, at);
    nextIdx++;
  }
}

async function start() {
  if (!ctx) setup();
  await ctx.resume();
  if (!playing) {
    playing = true;
    SONG.ev.sort((a, b) => a[0] - b[0]);
    songStart = ctx.currentTime + 0.1;
    nextIdx = 0;
    timer = setInterval(schedule, 100);
  }
  // Minigames (games.js)
addEventListener('kapf:sfx', ({ detail }) => {
  if (!playing) return;
  const t = ctx.currentTime;
  const notes = {
    hit: [[84, 0.05]],
    coin: [[88, 0.06], [95, 0.12]],
    drop: [[60, 0.08]],
    perfect: [[79, 0.06], [91, 0.1]],
    crash: [],
    win: [[72, 0.1], [76, 0.1], [79, 0.1], [84, 0.3]],
  }[detail];
  if (detail === 'crash') { tone('square', 300, t, 0.4, 0.5, 50); hit(t, 0.3, 0.6, 300); return; }
  let at = t;
  for (const [n, d] of notes ?? []) { tone('square', midiHz(n), at, d, 0.4); at += d; }
});

render();
}

function stop() {
  playing = false;
  clearInterval(timer);
  ctx?.suspend();
  // Minigames (games.js)
addEventListener('kapf:sfx', ({ detail }) => {
  if (!playing) return;
  const t = ctx.currentTime;
  const notes = {
    hit: [[84, 0.05]],
    coin: [[88, 0.06], [95, 0.12]],
    drop: [[60, 0.08]],
    perfect: [[79, 0.06], [91, 0.1]],
    crash: [],
    win: [[72, 0.1], [76, 0.1], [79, 0.1], [84, 0.3]],
  }[detail];
  if (detail === 'crash') { tone('square', 300, t, 0.4, 0.5, 50); hit(t, 0.3, 0.6, 300); return; }
  let at = t;
  for (const [n, d] of notes ?? []) { tone('square', midiHz(n), at, d, 0.4); at += d; }
});

render();
}

function render() {
  btn.textContent = playing ? '🔊 8-BIT' : '🔇 8-BIT';
  btn.setAttribute('aria-pressed', String(playing));
  btn.classList.toggle('on', playing);
}

btn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (playing) { stop(); pref.set('off'); } else { start(); pref.set('on'); }
});

// Erster Tipp/Klick irgendwo startet die Musik, ausser sie wurde ausgeschaltet
const kick = (e) => {
  if (e.target === btn) return;
  removeEventListener('pointerdown', kick);
  removeEventListener('keydown', kick);
  if (pref.get() !== 'off') start();
};
addEventListener('pointerdown', kick);
addEventListener('keydown', kick);

// Tab im Hintergrund: Pause
document.addEventListener('visibilitychange', () => {
  if (!ctx || !playing) return;
  if (document.visibilityState === 'hidden') ctx.suspend();
  else ctx.resume();
});

// Soundeffekte zum Zusammenfallen und Aufräumen
addEventListener('kapf:collapse', () => {
  if (!playing) return;
  const t = ctx.currentTime;
  tone('square', 880, t, 1.2, 0.5, 60);
  hit(t + 0.9, 0.5, 0.8, 200);
});
addEventListener('kapf:tidy', () => {
  if (!playing) return;
  const t = ctx.currentTime;
  [72, 76, 79, 84].forEach((n, i) => tone('square', midiHz(n + 12), t + i * 0.08, 0.1, 0.4));
});

// Minigames (games.js)
addEventListener('kapf:sfx', ({ detail }) => {
  if (!playing) return;
  const t = ctx.currentTime;
  const notes = {
    hit: [[84, 0.05]],
    coin: [[88, 0.06], [95, 0.12]],
    drop: [[60, 0.08]],
    perfect: [[79, 0.06], [91, 0.1]],
    crash: [],
    win: [[72, 0.1], [76, 0.1], [79, 0.1], [84, 0.3]],
  }[detail];
  if (detail === 'crash') { tone('square', 300, t, 0.4, 0.5, 50); hit(t, 0.3, 0.6, 300); return; }
  let at = t;
  for (const [n, d] of notes ?? []) { tone('square', midiHz(n), at, d, 0.4); at += d; }
});

render();
