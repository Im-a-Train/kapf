// Planung der vier Gastgeber (Aufgaben, Budget, Abrechnung).
// Liegt als eine JSON-Datei neben den Anmeldungen. Gespeichert wird immer der
// ganze Stand; eine Versionsnummer verhindert, dass sich zwei Leute
// gegenseitig überschreiben.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const OWNERS = ['chrigu', 'tim', 'roebu', 'melu'];

const task = (id, owner, text, due) => ({ id, owner, text, due, done: false });
const item = (id, owner, label, plan) => ({ id, owner, label, plan, actual: null, paidBy: '' });

export const DEFAULT_PLANNING = {
  budget: 4000,
  guests: 80,
  tasks: [
    task('t01', 'roebu', 'Location Kapf bestätigen: Miete, Endzeit, Lärmvorschriften', '2026-11-30'),
    task('t02', 'roebu', 'Gemeinsames Konto oder Twint-Topf einrichten', '2026-11-30'),
    task('t03', 'roebu', 'Schlechtwetter-Variante klären (Zelt/Unterstand)', '2027-03-31'),
    task('t04', 'roebu', 'Anmeldungen von der Website mit Gästezahl abgleichen', '2027-04-30'),
    task('t05', 'roebu', 'Aufräum-Crew für Sonntag organisieren', '2027-05-08'),
    task('t06', 'tim', 'Bands anfragen und Offerten einholen', '2026-12-20'),
    task('t07', 'tim', 'Band fix buchen (Band + Technik 1’500–2’000)', '2027-01-31'),
    task('t08', 'tim', 'Stromanschluss vor Ort prüfen', '2027-02-28'),
    task('t09', 'tim', 'PA und Licht mieten oder ausleihen', '2027-03-15'),
    task('t10', 'tim', 'Playlist für nach der Band', '2027-05-15'),
    task('t11', 'chrigu', 'Getränkemengen pro Gast schätzen', '2027-03-31'),
    task('t12', 'chrigu', 'Bierfass und Zapfanlage reservieren', '2027-04-15'),
    task('t13', 'chrigu', 'Kühlung organisieren (Kühlwagen/Kühlschränke)', '2027-04-15'),
    task('t14', 'chrigu', 'Bar-Schichtplan unter Freunden', '2027-05-08'),
    task('t15', 'melu', 'Menü festlegen, inkl. Vegi-Variante', '2027-02-28'),
    task('t16', 'melu', 'Grill(s) organisieren', '2027-04-15'),
    task('t17', 'melu', 'Geburtstagskuchen bestellen', '2027-05-01'),
    task('t18', 'melu', 'Mengen nach Anmeldungen finalisieren und einkaufen', '2027-05-20'),
  ],
  items: [
    item('i01', 'tim', 'Band (Gage)', 1200),
    item('i02', 'tim', 'PA & Licht', 500),
    item('i03', 'tim', 'Kabel, Strom, Kleinmaterial', 50),
    item('i04', 'chrigu', 'Bier (Fass)', 550),
    item('i05', 'chrigu', 'Wein & Prosecco', 300),
    item('i06', 'chrigu', 'Softdrinks & Wasser', 150),
    item('i07', 'chrigu', 'Eis, Becher, Barmaterial', 100),
    item('i08', 'melu', 'Grillgut Fleisch & Vegi', 500),
    item('i09', 'melu', 'Salate & Brot', 150),
    item('i10', 'melu', 'Geburtstagskuchen', 100),
    item('i11', 'melu', 'Geschirr & Servietten', 50),
    item('i12', 'roebu', 'Location Kapf (Miete klären)', 0),
    item('i13', 'roebu', 'Deko', 150),
    item('i14', 'roebu', 'Reserve', 200),
  ],
};

const str = (v, max) => String(v ?? '').slice(0, max);
const num = (v) => (v === null || v === '' || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const owner = (v) => (OWNERS.includes(v) ? v : null);
const id = (v) => str(v, 40) || null;

/** Bereinigt einen Planungsstand. Wirft bei grob falscher Struktur. */
export function sanitizePlanning(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.tasks) || !Array.isArray(input.items)) {
    throw Object.assign(new Error('Ungültige Planung'), { status: 400 });
  }
  if (input.tasks.length > 500 || input.items.length > 500) {
    throw Object.assign(new Error('Zu viele Einträge'), { status: 413 });
  }
  return {
    budget: num(input.budget) ?? 0,
    guests: num(input.guests) ?? 0,
    tasks: input.tasks
      .filter((t) => t && id(t.id) && owner(t.owner))
      .map((t) => ({ id: id(t.id), owner: t.owner, text: str(t.text, 300), due: date(t.due), done: Boolean(t.done) })),
    items: input.items
      .filter((i) => i && id(i.id) && owner(i.owner))
      .map((i) => ({
        id: id(i.id), owner: i.owner, label: str(i.label, 200),
        plan: num(i.plan), actual: num(i.actual), paidBy: owner(i.paidBy) ?? '',
      })),
  };
}

export function createPlanningStore(file) {
  let doc = null; // { version, updatedAt, state }
  let queue = Promise.resolve();

  async function load() {
    if (doc) return doc;
    try {
      doc = JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      doc = { version: 0, updatedAt: null, state: structuredClone(DEFAULT_PLANNING) };
    }
    return doc;
  }

  return {
    async get() {
      return structuredClone(await load());
    },
    /** Speichert nur, wenn `version` dem aktuellen Stand entspricht. */
    async save(state, version) {
      await load();
      if (version !== doc.version) return { conflict: true, doc: structuredClone(doc) };
      doc = { version: doc.version + 1, updatedAt: new Date().toISOString(), state: sanitizePlanning(state) };
      const snapshot = JSON.stringify(doc, null, 2);
      queue = queue.then(async () => {
        await mkdir(dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        await writeFile(tmp, snapshot);
        await rename(tmp, file);
      });
      await queue;
      return { conflict: false, doc: structuredClone(doc) };
    },
  };
}
