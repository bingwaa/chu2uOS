const ROOM = 'https://api.live.bilibili.com/room/v1/Room/get_info?room_id=1727074031';

export async function onRequestGet() {
  try {
    const res = await fetch(ROOM, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://live.bilibili.com/' },
    });
    const body = await res.text();
    // bilibili 会对机房/云 IP 风控返回 412 等非 200；统一回退为 200 合法 JSON，避免前端控制台报错
    if (!res.ok) return Response.json({ code: -1, msg: 'bilibili 暂不可用', upstream_status: res.status }, { status: 200 });
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return Response.json({ code: -1, msg: String(e) }, { status: 200 });
  }
}
