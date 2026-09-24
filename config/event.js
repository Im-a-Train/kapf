// Alles, was sich am Fest ändern kann, steht hier.
// Neue Felder werden via /api/event automatisch ans Frontend geliefert.

export const event = {
  title: '4 × 30 = 120',
  subtitle: 'Tim, Röbu, Chrigu & Melu werden 30. Zusammen. Im Kapf.',
  hosts: ['Tim', 'Röbu', 'Chrigu', 'Melu'],
  location: 'Kapf',
  date: '2027-05-22',
  dateLabel: 'Samstag, 22.05.27',
  time: 'ab 16:00', // TODO: definitiv festlegen
  // Anmeldeschluss (ISO-Datum) – danach nimmt die API keine Anmeldungen mehr an. null = offen.
  registrationDeadline: null,
  maxCompanions: 3,

  // Anfahrt. Koordinaten vom Kapf: 46°51.88922'N, 7°46.04185'E
  coords: { lat: 46.864820, lon: 7.767364 },
  coordsLabel: "46°51.88922'N, 7°46.04185'E",
  // Dasselbe in Schweizer Landeskoordinaten (LV95), für die swisstopo-Karte
  lv95: { e: 2625065, n: 1190462 },
  // Nächste Haltestelle (ID aus dem SBB-Fahrplan, transport.opendata.ch)
  stop: { id: '8576713', name: 'Röthenbach i.E., Fischbach', lat: 46.860244, lon: 7.760571 },
  // Ankunft spätestens um … (für die ÖV-Verbindungen)
  arriveBy: '16:00',
  // «Vo wo chunnsch?» – feste Startpunkte. `query`/`stationId`: Haltestelle im SBB-Fahrplan.
  origins: [
    { label: 'Bärn', query: 'Bern', stationId: '8507000', lat: 46.948823, lon: 7.439123 },
    { label: 'Oberdiessbach', query: 'Oberdiessbach', stationId: '8508255', lat: 46.839255, lon: 7.617808 },
    { label: 'Herblige', query: 'Herbligen, Dorf', stationId: '8583108', lat: 46.826839, lon: 7.607662 },
    { label: 'Schüpbach', query: 'Schüpbach, Dorf', stationId: '8508988', lat: 46.92688, lon: 7.734342 },
  ],
};

// Rätsel: Die Antwort wird serverseitig geprüft.
// `answers` sind alle akzeptierten Varianten (Gross-/Kleinschreibung, Umlaute & Leerzeichen egal).
export const riddles = [
  {
    id: 'alter',
    question: 'Vier Freunde werden je 30 Jahre alt. Wie alt sind sie zusammen?',
    hint: 'Steht eigentlich schon oben.',
    answers: ['120', 'hundertzwanzig'],
  },
  {
    id: 'handtuch',
    question: 'Was wird immer nasser, je mehr es trocknet?',
    hint: 'Liegt im Badezimmer.',
    answers: ['handtuch', 'tuech', 'badetuch', 'frottiertuch', 'tuch', 'ein handtuch'],
  },
  {
    id: 'karte',
    question: 'Ich habe Städte, aber keine Häuser. Berge, aber keine Bäume. Wasser, aber keine Fische. Was bin ich?',
    hint: 'Damit findest du auch den Kapf.',
    answers: ['karte', 'landkarte', 'eine karte', 'eine landkarte', 'map'],
  },
  {
    id: 'kerzen',
    question: 'Wie viele Kerzen braucht es für alle vier Geburtstagskuchen zusammen?',
    hint: 'Eine pro Jahr, pro Person.',
    answers: ['120', 'hundertzwanzig'],
  },
];
