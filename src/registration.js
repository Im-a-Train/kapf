// Validierung einer Anmeldung. Neues Feld? Hier ergänzen + im Formular einbauen.
export const SPONTAN = 'spontan';

export function validateRegistration(input, { maxCompanions, plan = [] }, { requireParts = false } = {}) {
  const errors = [];
  const str = (v, max) => String(v ?? '').trim().slice(0, max);

  const data = {
    name: str(input.name, 100),
    email: str(input.email, 200),
    attending: input.attending === 'yes' ? 'yes' : input.attending === 'no' ? 'no' : null,
    companions: Number.parseInt(input.companions ?? 0, 10),
    companionNames: str(input.companionNames, 300),
    diet: str(input.diet, 300),
    sleepover: ['yes', 'on', 'true', true].includes(input.sleepover) ? 'yes' : 'no',
    car: ['yes', 'on', 'true', true].includes(input.car) ? 'yes' : 'no',
    parts: parseParts(input.parts, plan),
    message: str(input.message, 1000),
  };

  if (!data.name) errors.push('Name fehlt. Wer bisch du?');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('E-Mail sieht komisch aus.');
  if (!data.attending) errors.push('Kommst du jetzt oder nicht?');
  if (!Number.isInteger(data.companions) || data.companions < 0 || data.companions > maxCompanions) {
    errors.push(`Begleitung: 0 bis ${maxCompanions} Personen.`);
  }
  if (data.attending === 'no') {
    data.companions = 0;
    data.sleepover = 'no';
    data.car = 'no';
    data.parts = [];
  } else if (requireParts && !data.parts.length) {
    errors.push('Wenn chunnsch? Wenigstens es Chäschtli abhäkle.');
  }

  return { data, errors };
}

// Zeitfenster: Checkboxen aus event.plan (ohne `signup: false`) oder «spontan». Spontan schliesst die anderen aus.
function parseParts(value, plan) {
  const list = (Array.isArray(value) ? value : String(value ?? '').split(/[,;]/)).map((v) => String(v).trim());
  if (list.includes(SPONTAN)) return [SPONTAN];
  return plan.filter((p) => p.signup !== false).map((p) => p.id).filter((id) => list.includes(id));
}

export const CSV_COLUMNS = ['createdAt', 'name', 'email', 'attending', 'companions', 'companionNames', 'parts', 'sleepover', 'car', 'diet', 'message', 'note'];

export function toCsv(rows) {
  const esc = (v) => {
    const s = Array.isArray(v) ? v.join(', ') : String(v ?? '');
    // Formel-Injection in Excel verhindern
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [CSV_COLUMNS.join(';'), ...rows.map((r) => CSV_COLUMNS.map((c) => esc(r[c])).join(';'))].join('\r\n');
}
