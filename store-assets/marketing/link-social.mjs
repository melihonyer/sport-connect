// Instagram görselleri: link-in-bio sayfası (muuvlink.app/link) tanıtımı (8 Ekim 2026).
//
// Hikâye 1080×1920 ve gönderi 1080×1350, tr/en. Kurumsal palet (CLAUDE.md): düz Deep Teal zemin,
// tek vurgu sarı, degrade yok, emoji yok. İki eğik telefon: link sayfasının üstü (indir + keşfet)
// ve altı (Training Agents kartı + takip). Ekranlar CANLI sayfadan, 390×844 @3x çekilir.
//
// Çalıştır: node store-assets/marketing/link-social.mjs → out/link-social/*.png
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(HERE, "out", "link-social");
const TMP = join(HERE, ".tmp", "link-social");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TEAL = "#114956", YEL = "#F4F818", INK = "#1F2121";

const COPY = {
  tr: { a: "Tüm bağlantılar", b: "tek yerde", sub: "İndir, keşfet, takımını kur.", pill: "Bağlantı profilde" },
  en: { a: "All your links", b: "in one place", sub: "Download, explore, start your team.", pill: "Link in bio" },
};
const SIZES = { hikaye: { w: 1080, h: 1920 }, gonderi: { w: 1080, h: 1350 } };

const uri = (p, type) => `data:${type};base64,${readFileSync(p).toString("base64")}`;
const ICON = uri(join(ROOT, "public", "icons", "favicon.png"), "image/png");
const WORDMARK = `data:image/svg+xml;base64,${Buffer.from(readFileSync(join(ROOT, "public", "icons", "logo-yatay.svg"), "utf8").replace(/#231f20/g, "#ffffff")).toString("base64")}`;

// iOS durum çubuğu (build-pano.mjs ile aynı), koyu zemin için beyaz.
const STATUS = `<svg viewBox="0 0 430 59" xmlns="http://www.w3.org/2000/svg" class="sb">
  <text x="58" y="38" font-family="-apple-system,'SF Pro Text',Inter,sans-serif" font-size="17" font-weight="600" fill="#fff" text-anchor="middle">9:41</text>
  <rect x="152" y="11" width="126" height="37" rx="18.5" fill="#000"/>
  <g fill="#fff" transform="translate(314 26)">
    <rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
    <path d="M30 2.6a10.8 10.8 0 0 1 14.6 0l-1.4 1.5a8.7 8.7 0 0 0-11.8 0zM32.6 5.4a7 7 0 0 1 9.4 0l-1.4 1.5a5 5 0 0 0-6.6 0zM35.2 8.2a3.2 3.2 0 0 1 4.2 0l-2.1 2.4z"/>
    <rect x="52" y="0" width="25" height="12" rx="3.6" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>
    <rect x="54" y="2" width="21" height="8" rx="2.2"/>
  </g></svg>`;

function page(lang, kind) {
  const C = COPY[lang];
  const { w, h } = SIZES[kind];
  const story = kind === "hikaye";
  const shot = (f) => uri(join(TMP, `scr-${f}-${lang}.png`), "image/png");
  // Telefon: [sol, üst, genişlik, açı]
  const P = story
    ? { top: [90, 760, 470, -6], bot: [530, 690, 470, 6], head: 230, size: 104 }
    : { top: [110, 560, 420, -6], bot: [560, 500, 420, 6], head: 150, size: 86 };
  const phone = (f, [x, y, pw, rot], z) => {
    const bez = pw * 0.028, r = pw * 0.15;
    return `<div class="phone" style="left:${x}px;top:${y}px;width:${pw}px;padding:${bez}px;border-radius:${r}px;transform:rotate(${rot}deg);z-index:${z}">
      <div class="screen${f === "bot" ? " mid" : ""}" style="border-radius:${r - bez}px"><img src="${shot(f)}">${STATUS}</div></div>`;
  };
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden;background:${TEAL};font-family:Montserrat,sans-serif;color:#fff}
  .logo{position:absolute;left:90px;top:${story ? 110 : 70}px;display:flex;align-items:center;gap:16px}
  .logo img:first-child{height:${story ? 64 : 56}px}.logo img:last-child{height:${story ? 34 : 30}px}
  .head{position:absolute;left:90px;top:${P.head}px;font-weight:900;font-size:${P.size}px;line-height:1.02;letter-spacing:-.025em}
  .mark{background:${YEL};color:${TEAL};padding:0 .12em}
  .sub{margin-top:${story ? 34 : 26}px;font-size:${story ? 38 : 32}px;font-weight:700;letter-spacing:0;color:rgba(255,255,255,.88)}
  .pill{margin-top:${story ? 30 : 22}px;display:inline-flex;align-items:center;gap:12px;padding:${story ? "16px 26px" : "13px 22px"};border-radius:999px;background:#fff;color:${TEAL};font-size:${story ? 30 : 26}px;font-weight:800;letter-spacing:0}
  .pill svg{width:${story ? 30 : 26}px;height:${story ? 30 : 26}px}
  .phone{position:absolute;background:${INK};box-shadow:0 30px 70px rgba(0,0,0,.38);transform-origin:center}
  .screen{position:relative;overflow:hidden}
  .screen img{display:block;width:100%}
  .screen .sb{position:absolute;left:0;top:0;width:100%}
  /* Sayfanın ortasından çekilen ekran: durum çubuğu içerik üstüne binmesin (gerçek telefonda
     kaydırırken de üst şerit sayfa zemininde kalır). 59/844 = iOS güvenli alan oranı. */
  .screen.mid::before{content:"";position:absolute;left:0;right:0;top:0;height:${(59 / 844 * 100).toFixed(2)}%;background:${TEAL}}
  .bar{position:absolute;right:90px;top:${story ? 128 : 86}px;width:110px;height:10px;border-radius:5px;background:${YEL}}
</style></head><body>
  <div class="logo"><img src="${ICON}"><img src="${WORDMARK}"></div>
  <div class="bar"></div>
  <div class="head">
    <div>${C.a}</div><div><span class="mark">${C.b}</span></div>
    <div class="sub">${C.sub}</div>
    <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>${C.pill}</div>
  </div>
  ${phone("bot", P.bot, 2)}
  ${phone("top", P.top, 3)}
</body></html>`;
}

// ── CDP yardımcıları ──────────────────────────────────────────────────────
const PORT = 9393;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(HERE, ".tmp", "profile-link")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const evaluate = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.value;

try {
  let t; for (let k = 0; k < 40 && !t; k++) { await sleep(250); try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === "page"); } catch {} }
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await send("Page.enable"); await send("Runtime.enable");
  mkdirSync(TMP, { recursive: true }); mkdirSync(OUT, { recursive: true });

  // 1) Canlı sayfadan iki ekran (üst + alt), iPhone ölçüsü.
  await send("Network.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 59, bottom: 34 } }).catch(() => {});
  for (const L of Object.keys(COPY)) {
    await send("Page.navigate", { url: `https://muuvlink.app/link/?lang=${L}` });
    await sleep(3500);
    await evaluate("document.querySelectorAll('*').forEach(e=>{e.style.animation='none'})");
    const h = await evaluate("document.documentElement.scrollHeight");
    for (const [name, y] of [["top", 0], ["bot", h - 844]]) {
      const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y, width: 390, height: 844, scale: 1 } });
      writeFileSync(join(TMP, `scr-${name}-${L}.png`), Buffer.from(s.data, "base64"));
    }
  }

  // 2) Kompozisyonlar.
  await send("Emulation.clearDeviceMetricsOverride");
  for (const L of Object.keys(COPY)) for (const [kind, { w, h }] of Object.entries(SIZES)) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    const file = join(TMP, `${kind}-${L}.html`);
    writeFileSync(file, page(L, kind));
    await send("Page.navigate", { url: `file://${file}` });
    await sleep(2500);
    const s = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    const out = join(OUT, `muuvlink-link-${kind}-${L}.png`);
    writeFileSync(out, Buffer.from(s.data, "base64"));
    console.log(out.replace(HERE + "/", ""));
  }
} finally { ws?.close(); chrome.kill(); }
