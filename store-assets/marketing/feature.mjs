// Google Play öne çıkan görsel (1024×500, 8 Ekim 2026). Eski mor marka görselinin yerine.
//
// Solda Deep Teal zemin + logo + başlık, sağda tanıtım videosundaki Envato görüntülerinden
// üç kare, aradaki dikişin üstünde eğik telefon. Play, listede video varsa görselin ORTASINA
// oynat düğmesi koyar: orta bölgeye okunması gereken bir şey konmaz.
//
// Önce kareler (envato/ depoya girmez):
//   ffmpeg -ss 2.5 -i envato/raw/<klip> -frames:v 1 -vf scale=1080:-2 .tmp/feature/<ad>.jpg
//   (kosu: group-of-young-adults…, padel: paddle-tennis-team…, bisiklet: cyclists…sunny-urban…)
// Sonra: node store-assets/marketing/feature.mjs [tr en] → out/feature-<dil>.png
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 1024, H = 500;

const uri = (p, type) => `data:${type};base64,${readFileSync(p).toString("base64")}`;
const COPY = {
  tr: { a: "Sporla", b: "buluş", sub: "Yakınındaki takımları ve etkinlikleri keşfet" },
  en: { a: "Connect", b: "through sport", sub: "Discover teams and events near you" },
};
const TEAL = "#114956", YEL = "#F4F818", INK = "#1F2121";
const frame = (f) => uri(join(HERE, ".tmp", "feature", `${f}.jpg`), "image/jpeg");
const ICON = uri(join(ROOT, "public", "icons", "favicon.png"), "image/png");
const LOGO_SVG = readFileSync(join(ROOT, "public", "icons", "logo-yatay.svg"), "utf8");
const WORDMARK = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG.replace(/#231f20/g, "#ffffff")).toString("base64")}`;

// build-pano.mjs'teki iOS durum çubuğu.
const STATUS = `<svg viewBox="0 0 430 59" xmlns="http://www.w3.org/2000/svg" class="sb">
  <text x="58" y="38" font-family="-apple-system,'SF Pro Text',Inter,sans-serif" font-size="17" font-weight="600" fill="${INK}" text-anchor="middle">9:41</text>
  <rect x="152" y="11" width="126" height="37" rx="18.5" fill="#000"/>
  <g fill="${INK}" transform="translate(314 26)">
    <rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
    <path d="M30 2.6a10.8 10.8 0 0 1 14.6 0l-1.4 1.5a8.7 8.7 0 0 0-11.8 0zM32.6 5.4a7 7 0 0 1 9.4 0l-1.4 1.5a5 5 0 0 0-6.6 0zM35.2 8.2a3.2 3.2 0 0 1 4.2 0l-2.1 2.4z"/>
    <rect x="52" y="0" width="25" height="12" rx="3.6" fill="none" stroke="${INK}" stroke-opacity=".4" stroke-width="1"/>
    <rect x="54" y="2" width="21" height="8" rx="2.2"/><rect x="78.5" y="4" width="1.6" height="4" rx=".8" fill-opacity=".45"/>
  </g></svg>`;

const page = (lang) => {
  const C = COPY[lang];
  const pw = 200, bez = pw * 0.028, r = pw * 0.15;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;font-family:Montserrat,sans-serif;background:${TEAL}}
  .left{position:absolute;left:0;top:0;width:470px;height:${H}px;background:${TEAL}}
  .ph{position:absolute;top:0;height:${H}px;background-size:cover}
  .logo{position:absolute;left:52px;top:50px;display:flex;align-items:center;gap:12px}
  .logo img:first-child{height:42px}.logo img:last-child{height:24px}
  .head{position:absolute;left:52px;top:150px;width:400px;color:#fff;font-weight:900;line-height:1.02;letter-spacing:-.025em;text-transform:uppercase;font-size:${lang === "tr" ? 70 : 56}px}
  .mark{background:${YEL};color:${TEAL};padding:0 .12em;box-decoration-break:clone;-webkit-box-decoration-break:clone}
  .sub{margin-top:22px;font-size:20px;font-weight:700;line-height:1.35;letter-spacing:0;text-transform:none;color:rgba(255,255,255,.88);max-width:390px}
  .phone{position:absolute;left:796px;top:92px;width:${pw}px;padding:${bez}px;border-radius:${r}px;background:${INK};transform:rotate(-7deg);box-shadow:0 14px 36px rgba(0,0,0,.38)}
  .screen{position:relative;overflow:hidden;border-radius:${r - bez}px;background:#f8fafc}
  .screen img{display:block;width:100%}.screen .sb{position:absolute;left:0;top:0;width:100%}
</style></head><body>
  <div class="ph" style="left:470px;width:185px;background-image:url(${frame("kosu")});background-position:30% 40%"></div>
  <div class="ph" style="left:655px;width:185px;background-image:url(${frame("padel")});background-position:50% 30%"></div>
  <div class="ph" style="left:840px;width:184px;background-image:url(${frame("bisiklet")});background-position:50% 40%"></div>
  <div class="left"></div>
  <div class="logo"><img src="${ICON}"><img src="${WORDMARK}"></div>
  <div class="head"><div>${C.a}</div><div><span class="mark">${C.b}</span></div><div class="sub">${C.sub}</div></div>
  <div class="phone"><div class="screen"><img src="${uri(join(HERE, "shots", lang, "events.png"), "image/png")}">${STATUS}</div></div>
</body></html>`;
};

const PORT = 9382;
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
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  for (const lang of process.argv.slice(2).length ? process.argv.slice(2) : ["tr", "en"]) {
    const html = join(HERE, ".tmp", `feature-${lang}.html`);
    writeFileSync(html, page(lang));
    await send("Page.navigate", { url: `file://${html}` });
    await sleep(3000);
    const s = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    const raw = join(HERE, ".tmp", `feature-${lang}-raw.png`);
    writeFileSync(raw, Buffer.from(s.data, "base64"));
    // Play saydamlık kanalı kabul etmiyor: 24 bit RGB.
    const out = join(HERE, "out", `feature-${lang}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-pix_fmt", "rgb24", out]);
    console.log(out.replace(HERE + "/", ""));
  }
} finally {
  ws?.close();
  chrome.kill();
}
