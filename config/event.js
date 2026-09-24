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
