// Party-Modus: Standardmässig steht die Seite still. Erst der Knopf «PARTY-MODUS»
// schaltet alle Animationen ein (CSS über html.party, JS über isParty()/kapf:party).
// Die Wahl wird nicht gespeichert: Jeder Besuch beginnt ruhig.
const root = document.documentElement;
const btn = document.querySelector('#party-btn');

export const isParty = () => root.classList.contains('party');

export function setParty(on) {
  if (on === isParty()) return;
  root.classList.toggle('party', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? '😴 RUHE BITTE' : '🎉 PARTY-MODUS';
  dispatchEvent(new CustomEvent('kapf:party', { detail: on }));
}

btn.addEventListener('click', (e) => {
  e.stopPropagation();
  // iOS will für die Bewegungssensoren eine Erlaubnis, und zwar direkt nach einem Tap
  if (!isParty()) {
    for (const E of [globalThis.DeviceOrientationEvent, globalThis.DeviceMotionEvent]) {
      if (typeof E?.requestPermission === 'function') E.requestPermission().catch(() => {});
    }
  }
  setParty(!isParty());
});
