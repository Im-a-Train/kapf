export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createRiddles(list) {
  const byId = new Map(list.map((r) => [r.id, r]));
  return {
    random(excludeId) {
      const pool = list.length > 1 ? list.filter((r) => r.id !== excludeId) : list;
      const r = pool[Math.floor(Math.random() * pool.length)];
      return { id: r.id, question: r.question, hint: r.hint };
    },
    check(id, answer) {
      const r = byId.get(id);
      if (!r) return false;
      const a = normalize(answer);
      return r.answers.some((x) => normalize(x) === a);
    },
  };
}
