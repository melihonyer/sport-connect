// "Parkurlar" karuselinin video hali (8 Ekim 2026). Her kare bir MP4 (1080×1350, 30 fps, sessiz):
//   harita karesi  → uydu görüntüsüne yavaş yaklaşma, el yazısı / ok / halka çiziliyor
//   video karesi   → parkurun drone çekimi (Envato) → yumuşak geçiş → toplu koşu fotoğrafına yaklaşma
//   kapanış        → Türkiye haritası çiziliyor, noktalar beliriyor
//
// Bu betik yalnız yazı/çizim katmanını (saydam PNG kareleri) çizer; birleştirme video-parkur.py'de.
// Chrome 154'te büyük görselli sayfada Page.captureScreenshot donuyordu — katmanda büyük görsel
// yok, o yüzden burada DevTools ile kare kare çekmek sorunsuz.
//
// Önce: python3 sat.py x2  (sat/<id>@2x.jpg) · video/<id>.mov (Envato, depoya girmez)
// Sonra: node video-parkur.mjs [kare no…] && python3 video-parkur.py [kare no…] → ../out/parkur-video-tr/NN.mp4
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PARKUR, mapSlide, photoSlide, endSlide } from "./build-parkur.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 1080, H = 1350, FPS = 30;

// Drone çekiminden kullanılan kesit (sn). Aladağlar'ın videosu yok: yalnız fotoğraf.
const CLIP = { kapadokya: 4, kackar: 5, tahtali: 0.3, alanya: 2 };
const DRONE = 3.6, XFADE = 0.6; // drone 0–3.6 sn, 3.0–3.6 arası fotoğrafa geçiş

const slides = [];
PARKUR.forEach((p, i) => {
  slides.push({ kind: "map", id: p.id, T: 6, anim: 4.8, html: mapSlide(p, i === 0, true) });
  const hasClip = p.id in CLIP;
  const noteAt = hasClip ? DRONE + 0.2 : 1.0;
  slides.push({
    kind: hasClip ? "video" : "photo", id: p.id, T: hasClip ? 7 : 6, anim: noteAt + 1.2, noteAt,
    pos: p.photo.pos, clip: hasClip ? { ss: CLIP[p.id], dur: DRONE, xfade: XFADE } : null,
    html: photoSlide(p, true, noteAt),
  });
});
slides.push({ kind: "end", T: 5, anim: 3.4, html: endSlide(true) });

const tmp = join(HERE, ".tmp", "ov");
mkdirSync(tmp, { recursive: true });
writeFileSync(join(tmp, "slides.json"), JSON.stringify(slides.map(({ html, ...s }, i) => ({ n: i + 1, ...s, frames: Math.round(s.anim * FPS) + 1 })), null, 1));

const PORT = 9364;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmp, "profile")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
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
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  const only = process.argv.slice(2).map(Number);
  for (const [i, s] of slides.entries()) {
    if (only.length && !only.includes(i + 1)) continue;
    const n = String(i + 1).padStart(2, "0"), dir = join(tmp, n), f = join(tmp, `${n}.html`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(f, s.html);
    await send("Page.navigate", { url: `file://${f}` });
    await sleep(800);
    await Promise.race([send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => true)", awaitPromise: true }), sleep(4000)]);
    const frames = Math.round(s.anim * FPS) + 1;
    for (let k = 0; k < frames; k++) {
      await send("Runtime.evaluate", { expression: `setT(${(k / FPS).toFixed(4)})` });
      const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
      writeFileSync(join(dir, `${String(k).padStart(4, "0")}.png`), Buffer.from(shot.data, "base64"));
    }
    console.log(`katman ${n}: ${frames} kare`);
  }
} finally {
  ws?.close();
  chrome.kill();
}
