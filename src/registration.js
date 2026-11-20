// Ohne gültige Einladung (z. B. alte Anmeldungen) gilt die Fest-Einladung.
export function resolveInvite(name, { invites = {} }) {
  return Object.hasOwn(invites, name) ? name : 'fest';
}

// Validierung einer Anmeldung. Neues Feld? Hier ergänzen + im Formular einbauen.
export function validateRegistration(input, event) {
  const errors = [];
  const invite = resolveInvite(input.invite, event);
  const allowedParts = event.invites?.[invite]?.parts ?? [];
  const maxCompanions = event.invites?.[invite]?.maxCompanions ?? event.maxCompanions;
  // Teile der Einladung: Fehlt die Auswahl ganz, gelten alle Teile der Einladung.
  const requested = input.parts === undefined ? allowedParts : [input.parts].flat();
  const str = (v, max) => String(v ?? '').trim().slice(0, max);

  const data = {
    name: str(input.name, 100),
    email: str(input.email, 200),
    invite,
    attending: input.attending === 'yes' ? 'yes' : input.attending === 'no' ? 'no' : null,
    companions: Number.parseInt(input.companions ?? 0, 10),
    companionNames: str(input.companionNames, 300),
    diet: str(input.diet, 300),
    message: str(input.message, 1000),
    parts: allowedParts.filter((p) => requested.includes(p)),
  };

  if (!data.name) errors.push('Name fehlt. Wer bisch du?');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('E-Mail sieht komisch aus.');
  if (!data.attending) errors.push('Kommst du jetzt oder nicht?');
  if (!Number.isInteger(data.companions) || data.companions < 0 || data.companions > maxCompanions) {
    errors.push(`Begleitung: 0 bis ${maxCompanions} Personen.`);
  }
  if (data.attending === 'yes' && allowedParts.length && !data.parts.length) {
    errors.push('Wann kommst du? Mindestens einen Teil auswählen.');
  }
  if (data.attending === 'no') {
    data.companions = 0;
    data.parts = [];
  }

  return { data, errors };
}

export const CSV_COLUMNS = ['createdAt', 'invite', 'name', 'email', 'attending', 'parts', 'companions', 'companionNames', 'diet', 'message', 'note'];

export function toCsv(rows) {
  const esc = (v) => {
    const s = Array.isArray(v) ? v.join(', ') : String(v ?? '');
    // Formel-Injection in Excel verhindern
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [CSV_COLUMNS.join(';'), ...rows.map((r) => CSV_COLUMNS.map((c) => esc(r[c])).join(';'))].join('\r\n');
}
