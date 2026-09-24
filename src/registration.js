// Validierung einer Anmeldung. Neues Feld? Hier ergänzen + im Formular einbauen.
export function validateRegistration(input, { maxCompanions }) {
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
  }

  return { data, errors };
}

export const CSV_COLUMNS = ['createdAt', 'name', 'email', 'attending', 'companions', 'companionNames', 'sleepover', 'diet', 'message', 'note'];

export function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    // Formel-Injection in Excel verhindern
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [CSV_COLUMNS.join(';'), ...rows.map((r) => CSV_COLUMNS.map((c) => esc(r[c])).join(';'))].join('\r\n');
}
