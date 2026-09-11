export const DAY_LIMIT = 5;
export const KEY = 'chat';

export function dayKey(now = Date.now()) {
  const d = new Date(now + 4 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function ipOf(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')
    || 'unknown';
}

export async function nickOf(ip) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(ip));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

export async function readChat(env) {
  if (!env || !env.KV) return null;
  const now = dayKey();
  let chat = await env.KV.get(KEY, { type: 'json' });
  if (!chat) chat = { day: now, ipCount: {}, messages: [] };
  if (chat.day !== now) { chat.day = now; chat.ipCount = {}; chat.messages = []; }
  return chat;
}

export async function writeChat(env, chat) {
  await env.KV.put(KEY, JSON.stringify(chat));
}
