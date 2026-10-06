// Tanıtım videosu için uygulamanın gerçek kullanım kaydı (canlı site, misafir, salt okuma).
//
// capture.mjs ile aynı kurulum: headless Chrome, iPhone boyutu, `?src=app`, UA'da
// "HeadlessChrome" (görüntülenme sayısına eklenmez). Page.startScreencast kareleri zaman
// damgasıyla yazar; ekran yalnız değişince kare gelir, video.py süreleri damgadan kurar.
// Dokunuşlar sayfada kısa bir halka olarak görünür (gerçek parmak yok, izleyen ne olduğunu görsün).
// Sayfalar arası geçiş dokunarak yapılır: tam yükleme API'nin dakikada 120 istek sınırını yer.
//
// Çalıştır: node store-assets/marketing/record.mjs [tr en]  → .tmp/rec-<dil>/ (kareler + frames.json)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = process.env.DEVICE === "ipad" ? "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HeadlessChrome" : "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HeadlessChrome";
// DEVICE=ipad → iPad 13" dikey kayıt (.tmp/rec-ipad-<dil>).
const IPAD = process.env.DEVICE === "ipad";
const W = IPAD ? 1032 : 430, H = IPAD ? 1376 : 932, DPR = IPAD ? 1.25 : 2;

// Sayfaya eklenen yardımcılar: metne göre bul, halkayla dokun, yumuşak kaydır.
const HELPERS = `
window.__find = (re, sel = "button, a, [role=button], h3, h2, div") => {
  const rx = new RegExp(re);
  const els = [...document.querySelectorAll(sel)].filter(e => rx.test((e.innerText || "").trim()) && e.offsetParent);
  els.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);
  return els[0] || null;
};
// Bulunan öğe halka beklerken yeniden çizilip sayfadan kopabiliyor (iç bileşenler her
// üst-render'da yeniden kuruluyor); tıklamadan önce aynı ölçütle yeniden bulunur.
window.__tap = async (el, re, sel) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;width:46px;height:46px;border-radius:50%;background:rgba(17,73,86,.28);border:2px solid rgba(17,73,86,.55);left:" + (x - 23) + "px;top:" + (y - 23) + "px;transform:scale(.4);opacity:1;transition:transform .35s ease-out,opacity .45s ease-out .2s";
  document.body.appendChild(d);
  requestAnimationFrame(() => { d.style.transform = "scale(1.25)"; d.style.opacity = "0"; });
  setTimeout(() => d.remove(), 900);
  await new Promise(r => setTimeout(r, 260));
  const again = re ? window.__find(re, sel) : null;
  (again && again.isConnected ? again : el).click();
  return true;
};
window.__scroll = (dy, ms) => new Promise(res => {
  const y0 = window.scrollY, t0 = performance.now();
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const step = now => { const t = Math.min(1, (now - t0) / ms); window.scrollTo(0, y0 + dy * ease(t)); t < 1 ? requestAnimationFrame(step) : res(); };
  requestAnimationFrame(step);
});
"ok"`;

// Adımlar: [betik, sonra bekleme ms]. Etiketler video.py'deki yazı geçişleri için.
const STEPS = (lang) => {
  const L = (tr, en) => (lang === "tr" ? tr : en);
  return [
    ["mark:events", 0],
    [`__tap(__find("^${L("Etkinlikler", "Events")}$", "button"))`, 1800],
    [`__scroll(520, 1600)`, 700],
    [`__scroll(-520, 900)`, 500],
    ["mark:map", 0],
    [`__tap(__find("${L("Haritada", "Show on Map")}", "button"))`, 1200],
    [`(()=>{const r=document.querySelector(".leaflet-container").getBoundingClientRect();return __scroll(r.bottom-(innerHeight-110),900)})()`, 2600],
    [`(async()=>{await __tap(__find("^(Liste|List)$", "button"), "^(Liste|List)$", "button");await new Promise(r=>setTimeout(r,900));window.scrollTo(0,0);})()`, 500],
    ["mark:event", 0],
    [`__tap(__find("^Open Water Turkey Kış", "h3, h4, p, div, span"), "^Open Water Turkey Kış", "h3, h4, p, div, span")`, 2200],
    [`__scroll(560, 1800)`, 900],
    ["mark:teams", 0],
    [`__tap(__find("^${L("Takımlar", "Teams")}$", "button"))`, 1600],
    // Liste en yeni takımla başlıyor (çoğu tek üyeli); branş süzgeci Triatlon.
    [`(()=>{const sel=[...document.querySelectorAll("select")].find(x=>[...x.options].some(o=>/^Triat/.test(o.textContent.trim())));const o=[...sel.options].find(o=>/^Triat/.test(o.textContent.trim()));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(sel,o.value);sel.dispatchEvent(new Event("change",{bubbles:true}));return true})()`, 1200],
    [`__scroll(700, 2000)`, 700],
    ["mark:team", 0],
    [`__tap(__find("^Beyaz Triatlon Akademi$", "h3, h4, p, span, div"), "^Beyaz Triatlon Akademi$", "h3, h4, p, span, div")`, 2200],
    [`__scroll(380, 1500)`, 1200],
  ];
};

const PORT = 9372;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(HERE, ".tmp", "profile-cap")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
let onFrame = null;
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

try {
  let target;
  for (let t = 0; t < 40 && !target; t++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === "page"); } catch {}
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Page.screencastFrame") { onFrame?.(m.params); return; }
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Network.setUserAgentOverride", { userAgent: UA });
  await send("Emulation.setSafeAreaInsetsOverride", { insets: IPAD ? { top: 24, bottom: 20 } : { top: 59, bottom: 34 } });
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["tr", "en"];
  for (const [li, lang] of langs.entries()) {
    if (li) await sleep(30000);
    await send("Page.navigate", { url: "https://muuvlink.app/?src=app" });
    await sleep(1500);
    await evaluate(`localStorage.setItem("cookieConsent","true");localStorage.setItem("muuv_dl_dismissed","1");localStorage.setItem("muuvlang","${lang}")`);
    await send("Page.navigate", { url: "https://muuvlink.app/?src=app" });
    await sleep(5000);
    await evaluate(HELPERS);
    const dir = join(HERE, ".tmp", IPAD ? `rec-ipad-${lang}` : `rec-${lang}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const frames = [], marks = [];
    let n = 0, t0 = null;
    onFrame = ({ data, metadata, sessionId }) => {
      send("Page.screencastFrameAck", { sessionId }).catch(() => {});
      if (t0 === null) t0 = metadata.timestamp;
      const f = `${String(n++).padStart(5, "0")}.jpg`;
      writeFileSync(join(dir, f), Buffer.from(data, "base64"));
      frames.push({ f, t: metadata.timestamp - t0 });
    };
    await send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
    const start = Date.now();
    await sleep(400);
    for (const [js, wait] of STEPS(lang)) {
      if (js.startsWith("mark:")) { marks.push({ name: js.slice(5), t: (Date.now() - start) / 1000 }); continue; }
      const r = await evaluate(js);
      if (r === false) console.log(lang, "BULUNAMADI:", js.slice(0, 80));
      await sleep(wait);
    }
    await send("Page.stopScreencast");
    onFrame = null;
    writeFileSync(join(dir, "frames.json"), JSON.stringify({ frames, marks, end: (Date.now() - start) / 1000 }, null, 1));
    console.log(lang, frames.length, "kare", ((Date.now() - start) / 1000).toFixed(1), "sn", marks.map((m) => `${m.name}@${m.t.toFixed(1)}`).join(" "));
  }
} finally {
  ws?.close();
  chrome.kill();
}
