import { DAY_LIMIT, ipOf, readChat } from './_chat.js';

export async function onRequestGet({ env, request }) {
  if (!env || !env.KV) {
    return Response.json(
      { messages: [], remaining: 0, notice: '聊天未启用：需在 Cloudflare 面板为该项目绑定 KV 存储 KV' },
      { status: 200 });
  }
  try {
    const chat = await readChat(env);
    const ip = ipOf(request);
    const msgs = (chat.messages || []).slice(-100).map(m => ({ nick: m.nick, text: m.text, ts: m.ts }));
    const remaining = Math.max(0, DAY_LIMIT - (chat.ipCount[ip] || 0));
    return Response.json({ messages: msgs, remaining });
  } catch (e) {
    return Response.json({ code: -1, msg: String(e) }, { status: 500 });
  }
}
