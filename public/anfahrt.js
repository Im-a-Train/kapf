// Anfahrt: klappt hinter «WO» auf.
// ÖV-Verbindungen von transport.opendata.ch (offizielle SBB-Fahrplandaten),
// GPX-Routen von BRouter, Karte von swisstopo. Beide erlauben Aufrufe direkt aus dem Browser (CORS).
const $ = (sel) => document.querySelector(sel);
const TRANSPORT = 'https://transport.opendata.ch/v1';
const BROUTER = 'https://brouter.de/brouter';

let event = null;
let mode = 'oev';
// Aktueller Startpunkt: { label, query, lat, lon, stationId? }
let origin = null;

const eventReady = fetch('/api/event').then((r) => r.json()).then((data) => {
  event = data;
  $('#coords-label').textContent = event.coordsLabel;
  $('#stop-name').textContent = event.stop.name;
  $('#oev-date').textContent = event.dateLabel.replace(/^\S+,\s*/, '');
  $('#oev-arrive').textContent = event.arriveBy;
  const { e, n } = event.lv95;
  $('#swisstopo-link').href = `https://map.geo.admin.ch/#/map?lang=de&center=${e},${n}&z=8&bgLayer=ch.swisstopo.pixelkarte-farbe&crosshair=marker,${e},${n}`;
  const mapUrl = `https://map.geo.admin.ch/#/embed?lang=de&center=${e},${n}&z=7&bgLayer=ch.swisstopo.pixelkarte-farbe&crosshair=marker,${e},${n}`;
  if ($('#map').src !== mapUrl) $('#map').src = mapUrl;
  renderOrigins();
  updateCarLink();
  return event;
});

// ---------- Aufklappen hinter «WO» ----------
const whereBtn = $('#where-btn');
whereBtn.addEventListener('click', () => {
  const open = $('#anfahrt').hidden;
  $('#anfahrt').hidden = !open;
  whereBtn.setAttribute('aria-expanded', String(open));
  whereBtn.querySelector('.where-more').textContent = open ? '🚆 🚗 🚲 Aafahrt ▲' : '🚆 🚗 🚲 Aafahrt ▼';
  if (open) $('#anfahrt').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------- «Vo wo chunnsch?» ----------
function renderOrigins() {
  $('#origin-list').replaceChildren(...event.origins.map((o, i) => {
    const label = document.createElement('label');
    label.className = 'radio';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'origin';
    input.value = String(i);
    label.append(input, ` ${o.label}`);
    return label;
  }));
}

$('#anfahrt').addEventListener('change', (e) => {
  if (e.target.name !== 'origin') return;
  const other = e.target.value === '__other';
  $('#origin-other').hidden = !other;
  if (other) {
    $('#origin-other').focus();
    if ($('#origin-other').value.trim()) setOtherOrigin();
    return;
  }
  setOrigin({ ...event.origins[Number(e.target.value)] });
});

let typing;
$('#origin-other').addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(setOtherOrigin, 700);
});
$('#origin-other').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); clearTimeout(typing); setOtherOrigin(); }
});

// Freier Ort → nächste Haltestelle mit Koordinaten suchen
async function setOtherOrigin() {
  const q = $('#origin-other').value.trim();
  if (q.length < 2) return;
  try {
    const station = await findStation({ query: q });
    if (!station) return showOevMessage(`«${q}» kenne ich nicht. Ist das noch in der Schweiz?`);
    setOrigin({ label: station.name, query: station.name, stationId: station.id, lat: station.coordinate.x, lon: station.coordinate.y });
  } catch {
    showOevMessage('Fahrplan gerade nicht erreichbar. Versuch es später nochmals.');
  }
}

// «📍 Mys Handy weiss es»: Standort → nächste Haltestelle
$('#origin-geo').addEventListener('click', () => {
  if (!navigator.geolocation) return showOevMessage('Dein Browser weiss leider nicht, wo du bist.');
  showOevMessage('Suche dich … 🛰️');
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    for (const r of document.querySelectorAll('input[name="origin"]')) r.checked = false;
    $('#origin-other').hidden = true;
    const station = await findStation({ x: coords.latitude, y: coords.longitude }).catch(() => null);
    setOrigin({
      label: station ? `Mein Standort (bei ${station.name})` : 'Mein Standort',
      query: station?.name,
      stationId: station?.id,
      lat: coords.latitude,
      lon: coords.longitude,
    });
  }, () => showOevMessage('Kein Standort. Dann halt von Hand auswählen.'), { timeout: 15000 });
});

async function findStation(params) {
  const url = new URL(`${TRANSPORT}/locations`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('type', 'station');
  const { stations = [] } = await (await fetch(url)).json();
  return stations.find((s) => s.id && s.coordinate?.x);
}

function setOrigin(o) {
  origin = o;
  $('#gpx-start').textContent = o.label;
  $('#gpx-info').textContent = '';
  updateCarLink();
  loadConnections();
}

// ---------- Tabs ----------
for (const tab of document.querySelectorAll('#anfahrt .tab')) {
  tab.addEventListener('click', () => {
    mode = tab.dataset.mode;
    for (const t of document.querySelectorAll('#anfahrt .tab')) t.setAttribute('aria-selected', String(t === tab));
    for (const p of document.querySelectorAll('#anfahrt .tabpanel')) p.hidden = p.dataset.panel !== mode;
  });
}

// ---------- SBB ----------
function showOevMessage(text) {
  const li = document.createElement('li');
  li.className = 'muted';
  li.textContent = text;
  $('#oev-list').replaceChildren(li);
}

const hhmm = (iso) => iso?.slice(11, 16) ?? '';
const minutes = (dur) => {
  const [, d, h, m] = dur.match(/(\d+)d(\d+):(\d+)/) ?? [];
  return Number(d) * 1440 + Number(h) * 60 + Number(m);
};

let loadSeq = 0;
async function loadConnections() {
  await eventReady;
  updateSbbLink();
  if (!origin?.query) return showOevMessage('Für diesen Ort finde ich keine Haltestelle.');
  const seq = ++loadSeq;
  showOevMessage('Frage die SBB … 🚂');
  const url = new URL(`${TRANSPORT}/connections`);
  url.searchParams.set('from', origin.stationId ?? origin.query);
  url.searchParams.set('to', event.stop.id);
  url.searchParams.set('date', event.date);
  url.searchParams.set('time', event.arriveBy);
  url.searchParams.set('isArrivalTime', '1');
  url.searchParams.set('limit', '3');
  try {
    const { connections = [] } = await (await fetch(url)).json();
    if (seq !== loadSeq) return;
    if (!connections.length) return showOevMessage('Keine Verbindung gefunden. Velo? 🚲');
    // Späteste Verbindung zuerst – die, bei der man am längsten schlafen kann
    $('#oev-list').replaceChildren(...connections.reverse().map(renderConnection));
  } catch {
    if (seq === loadSeq) showOevMessage('Fahrplan gerade nicht erreichbar. Unten auf sbb.ch geht es sicher.');
  }
}

function renderConnection(c) {
  const li = document.createElement('li');
  const legs = c.sections.map((s) => {
    const span = document.createElement('span');
    if (s.journey) {
      span.className = 'leg';
      span.textContent = `${s.journey.category}${s.journey.number ?? ''}`.replace(/^([A-Z]+)\1/, '$1');
      span.title = `${hhmm(s.departure.departure)} ${s.departure.station.name} → ${hhmm(s.arrival.arrival)} ${s.arrival.station.name}`;
    } else {
      span.className = 'leg walk';
      span.textContent = '🚶';
      span.title = 'z Fuess';
    }
    return span;
  });
  const times = document.createElement('strong');
  times.textContent = `${hhmm(c.from.departure)} → ${hhmm(c.to.arrival)}`;
  const meta = document.createElement('small');
  const umst = c.transfers === 0 ? 'direkt' : `${c.transfers}× umsteigen`;
  meta.textContent = ` ${minutes(c.duration)} min · ${umst}${c.from.platform ? ` · Gl. ${c.from.platform}` : ''}`;
  const legWrap = document.createElement('div');
  legWrap.className = 'legs';
  legWrap.append(...legs, Object.assign(document.createElement('span'), { className: 'leg walk', textContent: '🚶 700 m', title: 'Haltestelle → Kapf' }));
  li.append(times, meta, legWrap);
  return li;
}

function updateSbbLink() {
  const to = { value: event.stop.id, type: 'ID', label: event.stop.name };
  const from = origin?.stationId
    ? { value: origin.stationId, type: 'ID', label: origin.query }
    : { value: origin?.query ?? '', type: 'NAME', label: origin?.query ?? '' };
  const [h, m] = event.arriveBy.split(':').map(Number);
  // 30 Minuten Reserve für den Fussweg ab Haltestelle
  const time = `${String(h - (m < 30 ? 1 : 0)).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`;
  const q = new URLSearchParams({
    stops: JSON.stringify(origin ? [from, to] : [to]),
    date: JSON.stringify(event.date),
    time: JSON.stringify(time),
    moment: JSON.stringify('ARRIVAL'),
  });
  $('#sbb-link').href = `https://www.sbb.ch/de?${q}`;
}

// ---------- Auto ----------
function updateCarLink() {
  if (!event) return;
  const dest = `${event.coords.lat},${event.coords.lon}`;
  const q = new URLSearchParams({ api: '1', destination: dest, travelmode: 'driving' });
  if (origin) q.set('origin', `${origin.lat},${origin.lon}`);
  $('#car-link').href = `https://www.google.com/maps/dir/?${q}`;
}

// ---------- GPX ----------
$('#gpx-btn').addEventListener('click', async () => {
  const info = $('#gpx-info');
  if (!origin) {
    info.className = 'feedback nope';
    info.textContent = 'Zersch obe säge, vo wo du chunnsch! ☝️';
    return;
  }
  const profile = $('#gpx-profile').value;
  info.className = 'feedback';
  info.textContent = 'Rechne Route … 🧮';
  const url = new URL(BROUTER);
  url.searchParams.set('lonlats', `${origin.lon},${origin.lat}|${event.coords.lon},${event.coords.lat}`);
  url.searchParams.set('profile', profile);
  url.searchParams.set('alternativeidx', '0');
  url.searchParams.set('format', 'gpx');
  url.searchParams.set('trackname', `Kapf ${event.dateLabel}`);
  try {
    const res = await fetch(url);
    const gpx = await res.text();
    if (!res.ok || !gpx.includes('<trkpt')) throw new Error(gpx.slice(0, 200));
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `kapf-${slug(origin.label)}-${profile.split('-')[0]}.gpx`,
    });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    // BRouter schreibt Länge, Höhenmeter und Zeit in einen Kommentar
    const len = gpx.match(/track-length = (\d+)/)?.[1];
    const up = gpx.match(/filtered ascend = (\d+)/)?.[1];
    const time = gpx.match(/time=([^-]+?)\s*-->/)?.[1];
    info.className = 'feedback yes';
    info.textContent = `GPX isch da! ${len ? `${(len / 1000).toFixed(1)} km` : ''}${up ? ` · ${up} Höhenmeter` : ''}${time ? ` · ca. ${time.replace(/\s*\d+s$/, '')}` : ''}`;
  } catch {
    info.className = 'feedback nope';
    info.textContent = 'Route konnte nicht berechnet werden. Anderes Profil oder anderer Start?';
  }
});

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'start';
