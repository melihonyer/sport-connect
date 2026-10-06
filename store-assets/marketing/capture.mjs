// Mağaza görselleri için canlı siteden uygulama ekranı çeker (salt okuma, misafir).
//
// Headless Chrome, telefon boyutu (430×932 @3x), `?src=app` ile uygulamanın kod yolu.
// UA'da "HeadlessChrome" kalır: backend VIEW_BOT_RE onu bot sayar, etkinlik
// görüntülenme sayısı artmaz. Giriş yapılmaz; yalnız herkese açık sayfalar.
//
// Çalıştır: node store-assets/marketing/capture.mjs [tr en]  → shots/<dil>/<ad>.png
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HeadlessChrome";
const W = 430, H = 932, DPR = 3;

// [ad, yol (dil öneki kodda), bekleme ms, sayfada çalışacak hazırlık]
const tap = (re) => `[...document.querySelectorAll("button")].find(b=>${re}.test(b.textContent.trim()))?.click()`;
// [ad, tam sayfa yükleme yolu ya da null (aynı sayfada dokun), dokunma betiği, hazır sayılma metni (RegExp kaynağı)]
// API dakikada 120 istekle sınırlı: tam yüklemeler arasında beklenir, liste ekranları dokunarak açılır.
const SHOTS = [
  ["events", "/", tap("/^(Etkinlikler|Events)$/"), "Akyaka"],
  ["map", null, `(async()=>{${tap("/Haritada|on map/i")};await new Promise(r=>setTimeout(r,6000));const r=document.querySelector(".leaflet-container").getBoundingClientRect();window.scrollTo(0,scrollY+r.bottom-(innerHeight-110));})()`, "__never__"],
  // Branş süzgeci Triatlon: liste en yeni takımla başlıyor, yeni takımlar çoğu zaman tek üyeli ve açıklamasız.
  ["teams", null, `(async()=>{${tap("/^(Takımlar|Teams)$/")};await new Promise(r=>setTimeout(r,3000));const sel=[...document.querySelectorAll("select")].find(x=>[...x.options].some(o=>/^Triat/.test(o.textContent.trim())));const o=[...sel.options].find(o=>/^Triat/.test(o.textContent.trim()));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(sel,o.value);sel.dispatchEvent(new Event("change",{bubbles:true}));})()`, "HERKOŞULDA"],
  ["team", "/takim/openwaterturkey-9", null, "Açık Su|Open"],
  ["event", "/etkinlik/open-water-turkey-kis-yuzme-etkinligi-110", null, "Gelinkaya"],
];

const PORT = 9352;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(HERE, ".tmp", "profile-cap")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
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
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Network.setUserAgentOverride", { userAgent: UA });
  // iPhone'daki çentik/ana çubuk boşluğu: uygulama env(safe-area-inset-*) ile yerleşiyor.
  try { await send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 59, bottom: 34 } }); console.log("safe-area ok"); } catch (e) { console.log("safe-area yok:", e.message); }
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["tr", "en"];
  for (const lang of langs) {
    // Önce kökü açıp ilk açılış pencerelerini kapalı işaretle.
    await send("Page.navigate", { url: "https://muuvlink.app/?src=app" });
    await sleep(1500);
    await evaluate(`localStorage.setItem("cookieConsent","true");localStorage.setItem("muuv_dl_dismissed","1");localStorage.setItem("muuvlang","${lang}");Object.keys(localStorage).filter(k=>/tour/i.test(k)).length`);
    const out = join(HERE, "shots", lang);
    mkdirSync(out, { recursive: true });
    for (const [name, path, prep, ready] of SHOTS.filter(([n]) => !process.env.ONLY || process.env.ONLY.split(",").includes(n) || (n === "events" && process.env.ONLY.includes("map")))) {
      if (path) {
        await sleep(20000);
        await send("Page.navigate", { url: `https://muuvlink.app${path}?src=app` });
        await sleep(3000);
      }
      if (prep) { await evaluate(prep); await sleep(1500); }
      // Hazır metni (ya da harita işaretçisi) görünene kadar en çok 25 sn bekle.
      let ok = false;
      for (let t = 0; t < 50 && !ok; t++) {
        ok = await evaluate(`new RegExp(${JSON.stringify(ready)}).test(document.body.innerText) || !!document.querySelector(".leaflet-marker-icon")`);
        if (!ok) await sleep(500);
      }
      await sleep(name === "map" ? 5000 : 1500);
      if (name === "map") console.log("işaretçi", await evaluate(`document.querySelectorAll(".leaflet-marker-icon").length`));
      const s = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(out, `${name}.png`), Buffer.from(s.data, "base64"));
      console.log(lang, name, ok ? "hazır" : "ZAMAN AŞIMI");
    }
  }
} finally {
  ws?.close();
  chrome.kill();
}
