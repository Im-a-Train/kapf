// Signierte Tokens (HMAC) für Rätsel-Lösungen und Admin-Sessions.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function createAuth({ secret, adminPassword }) {
  const key = secret || randomBytes(32).toString('hex');

  function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', key).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  function verify(token) {
    if (typeof token !== 'string') return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = createHmac('sha256', key).update(body).digest('base64url');
    if (!safeEqual(sig, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
      if (payload.exp && Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  return {
    issueRiddleToken: (riddleId) => sign({ t: 'riddle', riddleId, exp: Date.now() + 2 * 3600e3 }),
    verifyRiddleToken: (token) => verify(token)?.t === 'riddle',
    checkPassword: (pw) => Boolean(adminPassword) && safeEqual(String(pw ?? ''), adminPassword),
    issueAdminToken: () => sign({ t: 'admin', exp: Date.now() + 7 * 24 * 3600e3 }),
    verifyAdminToken: (token) => verify(token)?.t === 'admin',
  };
}

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
