# 🎂 4 × 30 im Kapf

Anmeldeseite für den 30. Geburtstag von **Tim, Röbu, Chrigu & Melu**
📍 Kapf · 📅 Samstag, 22.05.27

Bad UI mit Absicht (inspiriert von [glunz.ch](https://glunz.ch)). Anmelden kann nur, wer ein Rätsel löst.
Dazu gibt es ein kleines Admin-UI unter `/admin`.

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

### Docker

```bash
docker build -t kapf .
docker run -p 3000:3000 -e ADMIN_PASSWORD=… -e SECRET=… -v kapf-data:/data kapf
```

## Aufbau

```
config/event.js      Event-Infos (Datum, Ort, Zeit, …) und Rätsel – hier anpassen
src/server.js        Einstiegspunkt (liest env, startet Server)
src/app.js           Routen/API (öffentlich + Admin), statische Dateien
src/registration.js  Validierung der Anmeldung + CSV-Export
src/riddles.js       Rätsel-Auswahl und Antwortprüfung
src/auth.js          HMAC-signierte Tokens (Rätsel gelöst / Admin-Session)
src/store.js         JSON-Datei-Speicher (austauschbar)
public/              Anmeldeseite (Bad UI)
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
