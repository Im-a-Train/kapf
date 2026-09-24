// Einfacher JSON-Datei-Speicher. Für eine echte DB einfach ein Objekt mit
// derselben Schnittstelle (list/get/create/update/remove) bauen.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function createJsonStore(file) {
  let items = null;
  let queue = Promise.resolve();

  async function load() {
    if (items) return items;
    try {
      items = JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      items = [];
    }
    return items;
  }

  // Schreibvorgänge serialisieren und atomar ersetzen.
  function persist() {
    queue = queue.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(items, null, 2));
      await rename(tmp, file);
    });
    return queue;
  }

  return {
    async list() {
      return [...(await load())];
    },
    async get(id) {
      return (await load()).find((r) => r.id === id) ?? null;
    },
    async create(data) {
      await load();
      const now = new Date().toISOString();
      const item = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
      items.push(item);
      await persist();
      return item;
    },
    async update(id, patch) {
      await load();
      const item = items.find((r) => r.id === id);
      if (!item) return null;
      Object.assign(item, patch, { id, updatedAt: new Date().toISOString() });
      await persist();
      return item;
    },
    async remove(id) {
      await load();
      const before = items.length;
      items = items.filter((r) => r.id !== id);
      if (items.length === before) return false;
      await persist();
      return true;
    },
  };
}
