// Welche Einladung zeigt diese Seite? Der Server findet sie über den Pfad
// (config/event.js → invites[…].path), z. B. /brunch → Familien-Version, / → Fest.
const path = location.pathname.replace(/\/+$/, '') || '/';
export const eventUrl = `/api/event?path=${encodeURIComponent(path)}`;
