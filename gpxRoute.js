// ─────────────────────────────────────────────────────────────────────────
//  GPX → etkinlik rotası
//
//  Dosya TARAYICIDA okunur; sunucuya yalnız [lat, lng] dizisi gider. Strava/
//  Garmin dosyaları kalp atışı, kadans, sıcaklık ve saat taşır — bunların
//  hiçbiri buradan dışarı çıkmaz.
//
//  Bir sabah sürüşü ~12 000 nokta (3–4 MB); çizgi için birkaç yüz nokta yeter.
//  Douglas–Peucker ile sadeleştirilir: önce 4 m sapma, nokta sayısı sınırı
//  aşarsa sapma büyütülür. Sunucu sınırı 5000 (backend ROUTE_MAX_POINTS).
// ─────────────────────────────────────────────────────────────────────────

export const ROUTE_MAX_FILE_BYTES = 25 * 1024 * 1024;
const TARGET_POINTS = 1500;

// <trkpt> (kayıt) ve <rtept> (rota planlayıcı) ikisi de kabul edilir; <wpt>
// tek tek işaret noktalarıdır, çizgi değil. Öznitelik sırası dosyaya göre değişir.
const parsePoints = (text) => {
  const pts = [];
  for (const tag of ["trkpt", "rtept"]) {
    const re = new RegExp(`<${tag}\\b([^>]*)>`, "g");
    let m;
    while ((m = re.exec(text))) {
      const lat = Number(/\blat\s*=\s*["']([^"']+)["']/.exec(m[1])?.[1]);
      const lng = Number(/\blon\s*=\s*["']([^"']+)["']/.exec(m[1])?.[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        pts.push([lat, lng]);
      }
    }
    if (pts.length) break;
  }
  return pts;
};

export const routeDistanceM = (pts) => {
  const r = Math.PI / 180;
  let m = 0;
  for (let i = 1; i < pts.length; i++) {
    const [la1, lo1] = pts[i - 1], [la2, lo2] = pts[i];
    const a = Math.sin((la2 - la1) * r / 2) ** 2
      + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
    m += 2 * 6371000 * Math.asin(Math.sqrt(a));
  }
  return m;
};

// Douglas–Peucker, metre cinsinden (rota küçük alanda: düz izdüşüm yeterli).
const simplify = (pts, tolM) => {
  if (pts.length < 3) return pts;
  const lat0 = pts[0][0] * Math.PI / 180;
  const xy = pts.map(([la, lo]) => [lo * 111320 * Math.cos(lat0), la * 110540]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const tol2 = tolM * tolM;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol2) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};

// Geçersiz dosyada null döner.
export const gpxToRoute = (text) => {
  const raw = parsePoints(String(text || ""));
  if (raw.length < 2) return null;
  let tol = 4;
  let pts = simplify(raw, tol);
  while (pts.length > TARGET_POINTS && tol < 200) {
    tol *= 1.6;
    pts = simplify(raw, tol);
  }
  const points = pts.map(([la, lo]) => [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5]);
  // Mesafe sadeleşmiş noktalardan: sunucu da aynı noktalardan hesaplıyor,
  // önizlemedeki sayı kaydedilenle aynı çıksın.
  return { points, distance_m: Math.round(routeDistanceM(points)) };
};

// "42,3 km" / "850 m" — sayı biçimi etkin dile göre.
export const formatRouteDistance = (m, lang) => {
  const loc = lang || (typeof document !== "undefined" && document.documentElement.lang) || "tr";
  if (m >= 1000) return `${(m / 1000).toLocaleString(loc, { maximumFractionDigits: 1 })} km`;
  return `${Math.round(m).toLocaleString(loc)} m`;
};

// Katılacaklar rotayı kendi cihazına (Garmin, Wahoo, Komoot) yükleyebilsin:
// kaydedilen sadeleşmiş noktalardan düz bir GPX. Saat/kalp atışı yok, zaten saklanmıyor.
export const routeToGpx = (points, name) => {
  const esc = (s) => String(s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
  const pts = points.map(([la, lo]) => `<trkpt lat="${la}" lon="${lo}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Muuvlink" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${esc(name)}</name><trkseg>${pts}</trkseg></trk></gpx>\n`;
};
