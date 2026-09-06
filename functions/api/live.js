const ROOM_ID = 1727074031;
// 优先走第三方聚合接口（bilibili 对 Cloudflare 机房 IPv4 风控返回 412，聚合服务不受影响）
const PARTNER = `https://uapis.cn/api/v1/social/bilibili/liveroom?room_id=${ROOM_ID}`;
const LIVE = `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${ROOM_ID}`;
const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://live.bilibili.com/' };

async function fetchLive(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  try {
    const j = await res.json();
    const ok = j && (j.live_status != null || (j.data && j.data.live_status != null));
    return ok ? j : null;
  } catch (e) {
    return null;
  }
}

export async function onRequestGet() {
  const j = (await fetchLive(PARTNER)) || (await fetchLive(LIVE));
  if (j) return Response.json(j, { headers: { 'Cache-Control': 'no-store' } });
  // 均失败：回退为 200 合法 JSON，避免前端控制台报错；前端显示"检测中"
  return Response.json({ code: -1, msg: '直播状态暂不可用' }, { headers: { 'Cache-Control': 'no-store' } });
}
