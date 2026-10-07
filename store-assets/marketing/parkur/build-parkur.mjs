// Instagram karuseli "Parkurlar" (7 Ekim 2026): uydu haritasında elle çizilmiş kırmızı ok +
// el yazısı, kaydırınca o parkurdan toplu koşu fotoğrafı. Sonda Türkiye haritası + çağrı.
//
// Uydu: Sentinel-2 cloudless 2016 (EOX, CC BY 4.0) — ticari kullanım serbest, atıf her harita
// karesinde. Fotoğraflar foto/ altında, depoya girmez (Melih'in Drive'ı + Envato).
//
// Önce:  python3 sat.py          → sat/*.jpg + sat/marks.json (hedef noktaların piksel yeri)
// Sonra: node build-parkur.mjs   → ../out/parkur-tr/NN.png (1080×1350)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 1080, H = 1350;
const TEAL = "#114956", YEL = "#F4F818", INK = "#1F2121", SMOKE = "#F4F4F4";
const RED = "#FF2B2B";

const uri = (p, type = "image/jpeg") => `data:${type};base64,${readFileSync(p).toString("base64")}`;
const LOGO_SVG = readFileSync(join(ROOT, "public", "icons", "logo-yatay.svg"), "utf8");
const wordmark = (color) => `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG.replace(/#231f20/g, color)).toString("base64")}`;
const MARKS = JSON.parse(readFileSync(join(HERE, "sat", "marks.json"), "utf8"));

// Her parkur: harita karesi (el yazısı + ok) ve fotoğraf karesi.
// text: el yazısının sol üst köşesi; from: okun çıktığı yer; bend: eğrinin yana kaçışı (+ sağa).
const PARKUR = [
  {
    id: "kapadokya", name: "KAPADOKYA", coord: "38.64° K · 34.83° D", mark: "goreme", r: 95,
    hand: ["balonların", "arasında koştuk"], text: [86, 190], from: [420, 470], bend: -0.35, balloons: true,
    photo: { tag: "Kapadokya Ultra Trail", note: "gün doğarken, hep birlikte", pos: "50% 50%" },
  },
  {
    id: "kackar", name: "KAÇKAR", coord: "40.83° K · 41.16° D", mark: "zirve", r: 90,
    hand: ["sisin içinden", "koştuk"], text: [86, 190], from: [500, 470], bend: -0.3,
    photo: { tag: "Kaçkar by UTMB", note: "yağmurda bile kalabalıktık", pos: "40% 50%" },
  },
  {
    id: "tahtali", name: "TAHTALI", coord: "36.54° K · 30.45° D", mark: "zirve", r: 85,
    hand: ["denizden", "zirveye koştuk"], text: [420, 170], from: [560, 450], bend: 0.3,
    photo: { tag: "Tahtalı Run to Sky", note: "ormandan zirveye, omuz omuza", pos: "30% 50%" },
  },
  {
    id: "alanya", name: "ALANYA", coord: "36.54° K · 32.00° D", mark: "kale", r: 80,
    hand: ["surların", "arasından koştuk"], text: [86, 190], from: [380, 470], bend: -0.3,
    photo: { tag: "Alanya Ultra", note: "kalenin içinden başladık", pos: "38% 50%" },
  },
  {
    id: "aladaglar", name: "ALADAĞLAR", coord: "37.81° K · 35.16° D", mark: "demirkazik", r: 95,
    hand: ["sırada", "burası var"], text: [86, 190], from: [360, 470], bend: -0.35,
    photo: { tag: "Aladağlar", note: "kim geliyor?", pos: "50% 50%" },
  },
];

// Basit tohumlu rastgele: her derlemede aynı "el titremesi".
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;

// Elle çizilmiş eğri ok: ikinci derece eğri, hafif titreşim, sonda iki çizgilik ok başı.
function arrow([x1, y1], [x2, y2], bend) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
  const cx = mx - dy * bend, cy = my + dx * bend;
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, u = 1 - t;
    const j = i === 0 || i === 28 ? 0 : 2.2;
    pts.push([u * u * x1 + 2 * u * t * cx + t * t * x2 + rnd() * j, u * u * y1 + 2 * u * t * cy + t * t * y2 + rnd() * j]);
  }
  const d = "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L");
  const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 4];
  const ang = Math.atan2(ay - by, ax - bx), L = 52;
  const h1 = [ax - L * Math.cos(ang - 0.48), ay - L * Math.sin(ang - 0.48)];
  const h2 = [ax - L * 0.9 * Math.cos(ang + 0.42), ay - L * 0.9 * Math.sin(ang + 0.42)];
  return `<path d="${d}"/><path d="M${h1.join(" ")} Q${(ax + h1[0]) / 2 + 3} ${(ay + h1[1]) / 2 - 2} ${ax} ${ay} L${h2.join(" ")}"/>`;
}

// Elle çizilmiş daire: kapanmadan biraz üstüne binen, yarıçapı oynayan halka.
function circle([x, y], r) {
  const pts = [];
  for (let i = 0; i <= 44; i++) {
    const a = -2.2 + (i / 44) * Math.PI * 2.18;
    const rr = r * (1 + 0.06 * Math.sin(i * 0.5) + rnd() * 0.02) * (1 + i / 400);
    pts.push([x + rr * 1.12 * Math.cos(a), y + rr * 0.9 * Math.sin(a)]);
  }
  return `<path d="M${pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L")}"/>`;
}

// Okun ucu dairenin kenarında dursun.
const edge = ([fx, fy], [x, y], r) => {
  const a = Math.atan2(fy - y, fx - x);
  return [x + (r * 1.12 + 14) * Math.cos(a), y + (r * 0.9 + 14) * Math.sin(a)];
};

// Balon çizimi (çizgi): Kapadokya karesinde el yazısının yanında.
const balloon = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M0 -40 C 26 -40 34 -14 22 6 C 14 18 8 24 6 30 L -6 30 C -8 24 -14 18 -22 6 C -34 -14 -26 -40 0 -40 Z"/>
  <path d="M0 -40 C -9 -24 -9 10 -4 30 M0 -40 C 9 -24 9 10 4 30"/>
  <path d="M-6 30 L-5 40 M6 30 L5 40"/><rect x="-7" y="40" width="14" height="10" rx="2"/></g>`;

// Yazı tipleri yerelden (ağdan beklerken Chrome takılıyordu). Caveat: SIL OFL.
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const face = (fam, w, file, range) => `@font-face{font-family:${fam};font-weight:${w};font-display:block;src:url(${uri(file, "font/woff2")}) format("woff2");unicode-range:${range}}`;
const LATIN_EXT = "U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const FONTS = "<style>" + [700, 800].flatMap((w) => [
  face("Montserrat", w, join(ROOT, "public", "fonts", `montserrat-latin-${w}.woff2`), LATIN),
  face("Montserrat", w, join(ROOT, "public", "fonts", `montserrat-latin-ext-${w}.woff2`), LATIN_EXT),
]).concat(face("Caveat", 700, join(HERE, "fonts", "caveat-latin-700.woff2"), LATIN), face("Caveat", 700, join(HERE, "fonts", "caveat-latin-ext-700.woff2"), LATIN_EXT)).join("") + "</style>";
const BASE = `*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;font-family:Montserrat,sans-serif;background:${INK}}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hand{position:absolute;font-family:Caveat,cursive;font-weight:700;color:#fff;line-height:.92;letter-spacing:.005em;
  text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 18px rgba(0,0,0,.55),0 0 40px rgba(0,0,0,.35)}
.place{position:absolute;left:72px;bottom:118px;color:#fff;font-weight:800;font-size:96px;letter-spacing:-.02em;line-height:1;
  text-shadow:0 0 30px rgba(0,0,0,.55),0 2px 2px rgba(0,0,0,.4)}
.coord{position:absolute;left:76px;bottom:82px;color:#fff;font-weight:700;font-size:24px;letter-spacing:.08em;opacity:.92;
  text-shadow:0 0 10px rgba(0,0,0,.8)}
.logo{position:absolute;right:64px;top:64px;height:40px;filter:drop-shadow(0 0 8px rgba(0,0,0,.55))}
.credit{position:absolute;right:28px;bottom:22px;color:#fff;opacity:.75;font-size:15px;font-weight:600;text-shadow:0 0 6px rgba(0,0,0,.9)}
.tag{position:absolute;left:64px;top:64px;background:${YEL};color:${TEAL};font-weight:800;font-size:30px;padding:14px 26px;border-radius:999px}
.note{position:absolute;left:66px;bottom:70px;font-size:84px}
.ink{fill:none;stroke:${RED};stroke-width:10;stroke-linecap:round;stroke-linejoin:round}`;
const SVG_FILTER = `<defs><filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="3"/>
  <feDisplacementMap in="SourceGraphic" scale="4"/></filter>
  <filter id="lift"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000" flood-opacity=".45"/></filter></defs>`;

const doc = (body) => `<!doctype html><html lang="tr"><head><meta charset="utf-8">${FONTS}<style>${BASE}</style></head><body>${body}</body></html>`;

function mapSlide(p, first) {
  const target = MARKS[p.id][p.mark];
  const tip = edge(p.from, target, p.r);
  const swipeText = first ? `<div class="hand" style="right:66px;top:${H / 2 - 60}px;font-size:56px">kaydır</div>` : "";
  const swipeArrow = first ? `<g class="ink" style="stroke:#fff;stroke-width:7">${arrow([W - 170, H / 2 + 30], [W - 58, H / 2 + 36], 0.1)}</g>` : "";
  const balloons = p.balloons
    ? `<g class="ink" style="stroke-width:6">${balloon(880, 250, 1.25)}${balloon(985, 380, 0.85)}${balloon(780, 420, 0.65)}</g>`
    : "";
  return doc(`<img class="bg" src="${uri(join(HERE, "sat", `${p.id}.jpg`))}">
  <img class="logo" src="${wordmark("#ffffff")}">
  <div class="hand" style="left:${p.text[0]}px;top:${p.text[1]}px;font-size:118px">${p.hand.join("<br>")}</div>
  ${swipeText}
  <svg width="${W}" height="${H}" style="position:absolute;inset:0">${SVG_FILTER}
    <g filter="url(#lift)"><g class="ink">${circle(target, p.r)}${arrow(p.from, tip, p.bend)}</g>${balloons}${swipeArrow}</g>
  </svg>
  <div class="place">${p.name}</div><div class="coord">${p.coord}</div>
  <div class="credit">Uydu: Copernicus Sentinel-2 · s2maps.eu EOX (CC BY 4.0)</div>`);
}

function photoSlide(p) {
  return doc(`<img class="bg" src="${uri(join(HERE, "foto", `${p.id}.jpg`))}" style="object-position:${p.photo.pos}">
  <div class="tag">${p.photo.tag}</div>
  <img class="logo" style="top:74px" src="${wordmark("#ffffff")}">
  <div class="hand note">${p.photo.note}</div>`);
}

// Kapanış: Türkiye silueti, beş parkur noktası, çağrı.
function endSlide() {
  const geo = JSON.parse(readFileSync(join(HERE, "turkiye.geojson"), "utf8"));
  const k = Math.cos((39 * Math.PI) / 180);
  const [lon0, lon1, lat0, lat1] = [25.6, 44.9, 35.8, 42.2];
  const sx = 940 / ((lon1 - lon0) * k), ox = 70, oy = 640;
  const P = (lon, lat) => [ox + (lon - lon0) * k * sx, oy + (lat1 - lat) * sx];
  const rings = geo.coordinates.flatMap((poly) => poly.slice(0, 1));
  const d = rings.map((r) => "M" + r.map(([lo, la]) => P(lo, la).map((v) => v.toFixed(1)).join(" ")).join(" L") + "Z").join(" ");
  const pins = [
    ["Kapadokya", 34.83, 38.64, [-215, -18]], ["Kaçkar", 41.16, 40.83, [-120, -34]], ["Tahtalı", 30.45, 36.54, [-150, 58]],
    ["Alanya", 32.0, 36.54, [14, 62]], ["Aladağlar", 35.16, 37.81, [24, 50]],
  ].map(([n, lo, la, [tx, ty]]) => { const [x, y] = P(lo, la); return `<circle cx="${x}" cy="${y}" r="13" fill="${RED}" stroke="#fff" stroke-width="4"/>
    <text x="${x + tx}" y="${y + ty}" font-family="Caveat" font-weight="700" font-size="50" fill="#fff">${n}</text>`; }).join("");
  return doc(`<div style="position:absolute;inset:0;background:${TEAL}"></div>
  <img class="logo" style="left:72px;right:auto;top:72px;height:46px;filter:none" src="${wordmark("#ffffff")}">
  <div style="position:absolute;left:72px;top:190px;color:#fff;font-weight:800;font-size:92px;line-height:1;letter-spacing:-.025em">SIRADAKİ<br>PARKURA<br><span style="color:${YEL}">BİRLİKTE.</span></div>
  <svg width="${W}" height="${H}" style="position:absolute;inset:0">
    <path d="${d}" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.55)" stroke-width="2.5" stroke-linejoin="round"/>${pins}
  </svg>
  <div style="position:absolute;left:72px;bottom:178px;color:#fff;font-weight:700;font-size:34px;line-height:1.3;max-width:820px">Yakınındaki koşu takımlarını ve etkinlikleri bul, bir sonrakine birlikte hazırlan.</div>
  <div data-btn="pop" style="position:absolute;left:72px;bottom:82px;background:${YEL};color:${TEAL};font-weight:800;font-size:34px;padding:18px 34px;border-radius:999px">muuvlink.app</div>`);
}

const slides = PARKUR.flatMap((p, i) => [mapSlide(p, i === 0), photoSlide(p)]).concat(endSlide());

const out = join(HERE, "..", "out", "parkur-tr"), tmp = join(HERE, ".tmp");
mkdirSync(out, { recursive: true }); mkdirSync(tmp, { recursive: true });
// Her kare ayrı bir headless Chrome ile --screenshot. Chrome 154'te DevTools'un
// Page.captureScreenshot'ı büyük görselli sayfada donuyor; --screenshot dosyayı yazıyor
// ama süreç her zaman kapanmıyor — dosya yazılıp boyutu sabitlenince süreci biz kapatıyoruz.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv.slice(2).map(Number);
for (const [i, html] of slides.entries()) {
  if (only.length && !only.includes(i + 1)) continue;
  const n = String(i + 1).padStart(2, "0"), f = join(tmp, `${n}.html`), png = join(out, `${n}.png`);
  writeFileSync(f, html);
  rmSync(png, { force: true });
  const c = spawn(CHROME, ["--headless=new", "--hide-scrollbars", `--window-size=${W},${H}`, "--virtual-time-budget=3000",
    `--user-data-dir=${join(tmp, `profile-${n}`)}`, `--screenshot=${png}`, `file://${f}`], { stdio: "ignore" });
  let last = -1;
  for (let t = 0; t < 120; t++) {
    await sleep(500);
    if (c.exitCode !== null) break;
    const size = existsSync(png) ? statSync(png).size : -1;
    if (size > 0 && size === last) break;
    last = size;
  }
  c.kill("SIGKILL");
  rmSync(join(tmp, `profile-${n}`), { recursive: true, force: true });
  console.log(existsSync(png) ? `out/parkur-tr/${n}.png` : `HATA ${n}`);
}
