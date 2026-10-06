// Mağaza görselleri — "panorama" düzeni (Training Agents'takinin Muuvlink karşılığı, 6 Ekim 2026).
//
// Beş kare tek bir geniş tuvalde çizilir, sonra kare kare kesilir: eğik telefonlar kare
// sınırlarının üstüne taşır, mağazada yan yana kayarken tek parça afiş gibi okunur.
// Kurumsal palet (CLAUDE.md): Deep Teal zemin, tek vurgu sarı, metin Carbon; degrade yok, emoji yok.
// Fotoğraflar public/story/ (Canva, telifsiz — hikâye kartındakilerle aynı).
//
// Önce ekranlar: node store-assets/marketing/capture.mjs tr en
// Sonra:         node store-assets/marketing/build-pano.mjs [tr en] → out/pano-{ios,play}-{dil}/NN.png
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// iOS 6.9" (zorunlu boyut) ve Google Play telefon (9:16).
const STORES = { ios: { w: 1320, h: 2868 }, play: { w: 1242, h: 2208 } };
const N = 5;

const uri = (p, type) => `data:${type};base64,${readFileSync(p).toString("base64")}`;
const COPY = {
  tr: {
    p1: ["Sporla", "buluş"], p1s: "Yakınındaki takımları ve etkinlikleri keşfet",
    p2: ["Yakınında", "ne var?"], p2s: "Etkinlikleri haritada gör, sana en yakınına katıl",
    p3: ["Takımını", "bul"], p3s: "İlgilendiğin branşta bir takıma katıl ya da kendi takımını kur",
    p4: ["Tek dokunuşla", "katıl"], p4s: "Tarih, saat, konum ve yol tarifi tek sayfada",
    p5: ["Birlikte", "daha güzel"], chips: ["Koşu", "Yüzme", "Bisiklet", "Triatlon", "Padel", "Yoga", "Trekking"],
  },
  en: {
    p1: ["Connect", "through sport"], p1s: "Discover teams and events near you",
    p2: ["What's", "near you?"], p2s: "See events on the map and join the closest one",
    p3: ["Find your", "team"], p3s: "Join a team in your sport or start your own",
    p4: ["Join in", "one tap"], p4s: "Date, time, place and directions on one page",
    p5: ["Better", "together"], chips: ["Running", "Swimming", "Cycling", "Triathlon", "Padel", "Yoga", "Trekking"],
  },
};
let LANG = "tr";
const shot = (f) => uri(join(HERE, "shots", LANG, `${f}.png`), "image/png");
const photo = (f) => uri(join(ROOT, "public", "story", f), "image/jpeg");
const ICON = uri(join(ROOT, "public", "icons", "favicon.png"), "image/png");
const LOGO_SVG = readFileSync(join(ROOT, "public", "icons", "logo-yatay.svg"), "utf8");
const wordmark = (color) => `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG.replace(/#231f20/g, color)).toString("base64")}`;

const TEAL = "#114956", YEL = "#F4F818", INK = "#1F2121", SMOKE = "#F4F4F4";

// iOS durum çubuğu: saat + sinyal/wifi/pil, ortada Dynamic Island.
const STATUS = `<svg viewBox="0 0 430 59" xmlns="http://www.w3.org/2000/svg" class="sb">
  <text x="58" y="38" font-family="-apple-system,'SF Pro Text',Inter,sans-serif" font-size="17" font-weight="600" fill="${INK}" text-anchor="middle">9:41</text>
  <rect x="152" y="11" width="126" height="37" rx="18.5" fill="#000"/>
  <g fill="${INK}" transform="translate(314 26)">
    <rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
    <path d="M30 2.6a10.8 10.8 0 0 1 14.6 0l-1.4 1.5a8.7 8.7 0 0 0-11.8 0zM32.6 5.4a7 7 0 0 1 9.4 0l-1.4 1.5a5 5 0 0 0-6.6 0zM35.2 8.2a3.2 3.2 0 0 1 4.2 0l-2.1 2.4z"/>
    <rect x="52" y="0" width="25" height="12" rx="3.6" fill="none" stroke="${INK}" stroke-opacity=".4" stroke-width="1"/>
    <rect x="54" y="2" width="21" height="8" rx="2.2"/><rect x="78.5" y="4" width="1.6" height="4" rx=".8" fill-opacity=".45"/>
  </g></svg>`;

function strip({ w, h }) {
  const C = COPY[LANG];
  const u = w / 100;
  const H = (p) => (h * p) / 100;
  // Telefon: x ve genişlik kare genişliği cinsinden (0 = 1. karenin sol kenarı), y yüksekliğin %'si.
  const phone = (f, x, y, wid, rot, z = 3) => {
    const pw = wid * w;
    const bez = pw * 0.028;
    const r = pw * 0.15;
    return `<div class="phone" style="left:${x * w}px;top:${H(y)}px;width:${pw}px;padding:${bez}px;border-radius:${r}px;transform:rotate(${rot}deg);z-index:${z}">
      <div class="screen" style="border-radius:${r - bez}px"><img src="${shot(f)}">${STATUS}</div></div>`;
  };
  const panel = (i, cls, bg = "") => `<div class="panel ${cls}" style="left:${i * w}px;${bg}"></div>`;
  // Başlık: ilk satır düz, ikinci satır vurgu. dark = koyu zemin.
  const head = (i, top, [a, b], sub, { dark = false, size = 12, logo = false, mark = false, chips = null } = {}) => {
    const c1 = dark ? "#fff" : INK;
    const c2 = dark ? YEL : TEAL;
    const second = mark ? `<span class="mark">${b}</span>` : `<span style="color:${c2}">${b}</span>`;
    const lg = logo ? `<div class="logo"><img src="${ICON}"><img src="${wordmark(dark ? "#ffffff" : INK)}"></div>` : "";
    return `<div class="head" style="left:${i * w + 7 * u}px;top:${H(top)}px;width:${86 * u}px;font-size:${size * u}px">${lg}
      <div style="color:${c1}">${a}</div><div>${second}</div>
      ${sub ? `<div class="sub" style="color:${dark ? "rgba(255,255,255,.86)" : INK}">${sub}</div>` : ""}
      ${chips ? `<div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>` : ""}</div>`;
  };

  return `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${N * w}px;height:${h}px;overflow:hidden;font-family:Montserrat,sans-serif;background:${SMOKE}}
  .panel{position:absolute;top:0;width:${w}px;height:${h}px;background-size:cover;background-position:center}
  .smoke{background-color:${SMOKE}}
  .teal{background-color:${TEAL}}
  .phone{position:absolute;background:${INK};box-shadow:0 ${3 * u}px ${8 * u}px rgba(0,0,0,.32);transform-origin:center}
  .screen{position:relative;overflow:hidden;background:#f8fafc}
  .screen img{display:block;width:100%}
  .screen .sb{position:absolute;left:0;top:0;width:100%}
  .head{position:absolute;z-index:6;font-weight:900;line-height:1;letter-spacing:-.025em;text-transform:uppercase}
  .mark{background:${YEL};color:${TEAL};padding:0 .12em;box-decoration-break:clone;-webkit-box-decoration-break:clone}
  .sub{margin-top:${3 * u}px;font-size:${4 * u}px;font-weight:700;line-height:1.32;letter-spacing:0;text-transform:none;max-width:${78 * u}px}
  .logo{display:flex;align-items:center;gap:${1.8 * u}px;margin-bottom:${5 * u}px}
  .logo img:first-child{height:${6.4 * u}px}
  .logo img:last-child{height:${3.6 * u}px}
  .chips{display:flex;flex-wrap:wrap;gap:${1.8 * u}px;margin-top:${5 * u}px;letter-spacing:0;text-transform:none}
  .chip{background:#fff;color:${TEAL};font-weight:800;font-size:${3.6 * u}px;padding:${1.5 * u}px ${3.4 * u}px;border-radius:999px;box-shadow:0 ${0.6 * u}px ${2 * u}px rgba(0,0,0,.12)}
</style></head><body>
  ${panel(0, "smoke", `background-image:url(${photo("kosu.jpg")});background-position:90% center`)}
  ${panel(1, "teal")}
  ${panel(2, "smoke")}
  ${panel(3, "teal")}
  ${panel(4, "smoke", `background-image:url(${photo("yuzme.jpg")})`)}

  ${head(0, 5, C.p1, C.p1s, { logo: true, mark: true, size: 12.5 })}
  ${phone("events", 0.5, 55, 0.6, 8)}

  ${head(1, 6, C.p2, C.p2s, { dark: true, size: 12 })}
  ${phone("map", 1.2, 36, 0.64, -6)}

  ${head(2, 6, C.p3, C.p3s, { size: 12.5 })}
  ${phone("teams", 2.06, 38, 0.58, -8, 3)}
  ${phone("team", 2.52, 44, 0.58, 7, 4)}

  ${head(3, 6, C.p4, C.p4s, { dark: true, size: 11 })}
  ${phone("event", 3.36, 33, 0.66, -5)}

  ${head(4, 6, C.p5, "", { mark: true, size: 12.5, chips: C.chips })}
</body></html>`;
}

const PORT = 9362;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(HERE, ".tmp", "profile-pano")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params }));
});
try {
  let target;
  for (let t = 0; t < 40 && !target; t++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === "page"); } catch {}
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await send("Page.enable");
  mkdirSync(join(HERE, ".tmp"), { recursive: true });
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["tr", "en"];
  const stores = process.env.STORE ? { [process.env.STORE]: STORES[process.env.STORE] } : STORES;
  for (const lang of langs) for (const [store, size] of Object.entries(stores)) {
    LANG = lang;
    await send("Emulation.setDeviceMetricsOverride", { width: N * size.w, height: size.h, deviceScaleFactor: 1, mobile: false });
    const html = join(HERE, ".tmp", `pano-${store}-${lang}.html`);
    writeFileSync(html, strip(size));
    await send("Page.navigate", { url: `file://${html}` });
    await sleep(3500);
    const out = join(HERE, "out", `pano-${store}-${lang}`);
    mkdirSync(out, { recursive: true });
    for (let i = 0; i < N; i++) {
      const s = await send("Page.captureScreenshot", { format: "png", clip: { x: i * size.w, y: 0, width: size.w, height: size.h, scale: 1 } });
      writeFileSync(join(out, `${String(i + 1).padStart(2, "0")}.png`), Buffer.from(s.data, "base64"));
    }
    console.log(out.replace(HERE + "/", ""));
  }
} finally {
  ws?.close();
  chrome.kill();
}
