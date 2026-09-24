# 🎂 4 × 30 im Kapf

Anmeldeseite für den 30. Geburtstag von **Tim, Röbu, Chrigu & Melu**
📍 Kapf · 📅 Samstag, 22.05.27

Bad UI mit Absicht (inspiriert von [glunz.ch](https://glunz.ch)). Anmelden kann nur, wer ein Rätsel löst.
Dazu gibt es ein kleines Admin-UI unter `/admin`.

Extras:
- **Aafahrt** (klappt hinter «WO» auf): Startort wählen (Bärn, Oberdiessbach, Herblige, Schüpbach,
  frei eingeben oder Handy-Standort), dann SBB-Verbindungen zur Haltestelle «Röthenbach i.E., Fischbach»,
  Auto-Route in Google Maps, swisstopo-Karte und ein GPX (Velo, z Fuess, Auto) zum Herunterladen.
  Die Daten kommen direkt im Browser von [transport.opendata.ch](https://transport.opendata.ch)
  (SBB-Fahrplan), [BRouter](https://brouter.de) (GPX) und [swisstopo](https://map.geo.admin.ch) (Karte).
  Der Server braucht dafür keinen Internetzugang.
- **Crew:** Tim, Röbu, Chrigu & Melu klettern als Strichmännchen auf der Seite herum und fahren Velo,
  sitzen am PC oder fahren Ski (`public/crew.js`).
- **Fest schütteln** (Handy) oder die Maus wild hin und her bewegen: alles fällt zusammen. «Ufruume» stellt es wieder hin.
- **Übernachten:** Checkbox im Formular, im Admin als 🏕️ und im CSV als `sleepover`.

## Starten

Voraussetzung: Node.js ≥ 20. Es gibt keine Abhängigkeiten, `npm install` ist nicht nötig.

```bash
ADMIN_PASSWORD=supergeheim npm start     # http://localhost:3000
npm run dev                              # mit Auto-Reload
npm test
```

### Umgebungsvariablen

| Variable         | Default                   | Zweck                                                                    |
|------------------|---------------------------|--------------------------------------------------------------------------|
| `ADMIN_PASSWORD` | –                         | Passwort fürs Admin-UI. Ohne Passwort bleibt das Admin gesperrt.         |
| `SECRET`         | zufällig beim Start       | Schlüssel für die Tokens. Setzen, damit Logins einen Neustart überleben. |
| `PORT`           | `3000`                    | HTTP-Port                                                                |
| `DATA_FILE`      | `data/registrations.json` | Hier werden die Anmeldungen gespeichert                                  |

### Deployment (Selfhosting mit Docker Compose)

Bei jedem Push auf `main` baut GitHub Actions das Image `ghcr.io/im-a-train/kapf:latest`.

Auf dem Server:

```bash
mkdir kapf && cd kapf
curl -O https://raw.githubusercontent.com/Im-a-Train/kapf/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/Im-a-Train/kapf/main/.env.example
nano .env                      # ADMIN_PASSWORD und SECRET setzen
docker compose up -d           # läuft auf Port 3000
```

Update: `docker compose pull && docker compose up -d`. Die Anmeldungen liegen im Volume `kapf-data`.

Hinweise:
- Ist das Repo privat, ist auch das Image privat: entweder auf dem Server `docker login ghcr.io`
  (Token mit `read:packages`) oder das Package auf GitHub öffentlich stellen. Alternativ Repo klonen
  und in `docker-compose.yml` `build: .` statt `image:` verwenden.
- Für HTTPS einen Reverse Proxy (Caddy, Traefik, nginx) vor Port 3000 stellen. Er sollte
  `X-Forwarded-Proto` setzen, damit das Admin-Cookie als `Secure` markiert wird.

## Aufbau

```
config/event.js      Event-Infos (Datum, Ort, Koordinaten, Haltestelle, Startorte, …) und Rätsel – hier anpassen
src/server.js        Einstiegspunkt (liest env, startet Server)
src/app.js           Routen/API (öffentlich + Admin), statische Dateien
src/registration.js  Validierung der Anmeldung + CSV-Export
src/riddles.js       Rätsel-Auswahl und Antwortprüfung
src/auth.js          HMAC-signierte Tokens (Rätsel gelöst / Admin-Session)
src/store.js         JSON-Datei-Speicher (austauschbar)
public/              Anmeldeseite (Bad UI): app.js, anfahrt.js (Aafahrt), crew.js (Strichmännchen)
public/admin/        Admin-UI (Good UI)
test/                API-Tests (node:test)
```

### API

| Methode | Pfad                              | Beschreibung                      |
|---------|-----------------------------------|-----------------------------------|
| GET     | `/api/event`                      | Event-Infos aus `config/event.js` |
| GET     | `/api/riddle?not=<id>`            | Zufälliges Rätsel (ohne Antwort)  |
| POST    | `/api/riddle/solve`               | `{id, answer}` → `{ok, token}`    |
| POST    | `/api/registrations`              | Anmeldung (braucht `riddleToken`) |
| POST    | `/api/admin/login`, `/logout`     | Admin-Session (Cookie)            |
| GET     | `/api/admin/registrations`        | Alle Anmeldungen                  |
| GET     | `/api/admin/registrations.csv`    | CSV-Export (Excel-kompatibel)     |
| PATCH   | `/api/admin/registrations/:id`    | Bearbeiten (inkl. interner Notiz) |
| DELETE  | `/api/admin/registrations/:id`    | Löschen                           |

## Erweitern

- **Neues Rätsel:** Eintrag in `riddles` in `config/event.js` (`id`, `question`, `hint`, `answers`).
- **Neues Formularfeld:** Feld in `public/index.html` ergänzen, in `validateRegistration` (`src/registration.js`)
  aufnehmen und bei Bedarf in `CSV_COLUMNS` und der Admin-Tabelle (`public/admin/`) anzeigen.
- **Anmeldeschluss:** `registrationDeadline` in `config/event.js` setzen.
- **Neue Seite** (z. B. Programm, Anfahrt): HTML-Datei in `public/` ablegen, sie wird automatisch ausgeliefert.
- **Neue API-Route:** In `src/app.js` mit `route('GET', '/api/…', handler)` registrieren; Admin-Routen mit `requireAdmin(...)` umhüllen.
- **Echte Datenbank:** Objekt mit `list/get/create/update/remove` bauen und in `src/server.js` statt `createJsonStore` übergeben.
