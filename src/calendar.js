// Kalenderdatei (iCalendar, RFC 5545) aus config/event.js
const TZ = `BEGIN:VTIMEZONE
TZID:Europe/Zurich
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const local = (iso) => iso.replace(/[-:]/g, '').slice(0, 13) + '00'; // 2027-05-22T16:00 → 20270522T160000

// Zeilen länger als 75 Oktette werden gefaltet (Fortsetzung beginnt mit einem Leerzeichen)
function fold(line) {
  const bytes = Buffer.from(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let chunk = '';
  for (const ch of line) {
    if (Buffer.byteLength(chunk + ch) > (parts.length ? 74 : 75)) {
      parts.push(chunk);
      chunk = '';
    }
    chunk += ch;
  }
  parts.push(chunk);
  return parts.join('\r\n ');
}

export function toIcs(event, now = new Date()) {
  const { calendar: cal, coords, stop } = event;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const description = [
    event.subtitle,
    '',
    `Anfahrt: ÖV bis ${stop.name} (Postauto 271), dann ca. 700 m zu Fuss.`,
    `Koordinaten: ${event.coordsLabel}`,
    cal.url,
  ].join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kapf//4x30//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...TZ.split('\n'),
    'BEGIN:VEVENT',
    `UID:kapf-4x30-${event.date}@kapf.24eranker.dedyn.io`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Zurich:${local(cal.start)}`,
    `DTEND;TZID=Europe/Zurich:${local(cal.end)}`,
    `SUMMARY:${esc(`${event.title} – ${event.hosts.slice(0, -1).join(', ')} & ${event.hosts.at(-1)} werden 30`)}`,
    `LOCATION:${esc(`${event.location}, Röthenbach im Emmental`)}`,
    `GEO:${coords.lat};${coords.lon}`,
    `DESCRIPTION:${esc(description)}`,
    `URL:${cal.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Morgen ist Kapf!',
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
