import { DAY_LIMIT, ipOf, nickOf, readChat, writeChat } from './_chat.js';

export async function onRequestPost({ env, request }) {
  if (!env || !env.KV) {
    return Response.json(
      { ok: false, msg: '聊天未启用：需在 Cloudflare 面板为该项目绑定 KV 存储 KV' },
      { status: 200 });
  }
  try {
    let data = {};
    try { data = await request.json(); } catch (e) {}
    const text = String(data.text || '').trim();
    if (!text || text.length > 500) {
      return Response.json({ code: 400, msg: '消息为空或过长' }, { status: 400 });
    }
    const ip = ipOf(request);
    const chat = await readChat(env);
    if ((chat.ipCount[ip] || 0) >= DAY_LIMIT) {
      return Response.json({ code: 429, msg: '今日已达上限，明天再来吧' }, { status: 429 });
    }
    chat.ipCount[ip] = (chat.ipCount[ip] || 0) + 1;
    chat.messages.push({ nick: await nickOf(ip), text, ts: Date.now() });
    await writeChat(env, chat);
    return Response.json({ ok: true, left: DAY_LIMIT - chat.ipCount[ip] });
  } catch (e) {
    return Response.json({ code: -1, msg: String(e) }, { status: 500 });
  }
}
