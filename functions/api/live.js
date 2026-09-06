const ROOM = 'https://api.live.bilibili.com/room/v1/Room/get_info?room_id=1727074031';

export async function onRequestGet() {
  try {
    const res = await fetch(ROOM, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://live.bilibili.com/' },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return Response.json({ code: -1, msg: String(e) }, { status: 502 });
  }
}
