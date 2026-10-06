// Mağaza tanıtım videosu (dikey 886×1920, 30 fps, ~27 sn, sessiz ses kanalı) — App Store
// önizlemesi (6.9") ve Play tanıtımı için. Training Agents'taki videonun Muuvlink karşılığı.
//
// Akış: public/story fotoğrafları (yavaş yakınlaşma, Deep Teal yazı bandı) → telefon
// çerçevesinde uygulamanın gerçek kaydı (record.mjs) → logo kapanışı.
// Yazılar Chrome'da Montserrat ile çizilir (panoramayla aynı görünüm); degrade ve emoji yok.
//
// Önce: node store-assets/marketing/record.mjs tr en
// Sonra: node store-assets/marketing/video.mjs [tr en]  → out/video/ad-<dil>.mp4
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const TMP = join(HERE, ".tmp", "video");
const OUT = join(HERE, "out", "video");
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 886, H = 1920, FPS = 30;
const TEAL = "#114956", YEL = "#F4F818", INK = "#1F2121";
// Kayıt hızı: ~29 sn gezinti → ~18 sn. Kaydırmalar bu hızda hâlâ okunuyor.
const SPEED = 1.6;

const COPY = {
  tr: {
    photos: [
      ["kosu.jpg", "MUUVLINK", "Sporla\nbuluş"],
      ["bisiklet.jpg", "TAKIMLAR · ETKİNLİKLER", "Yakınında spor\nyapanları bul"],
      ["yuzme.jpg", "TAKIMLAR · ETKİNLİKLER", "Yakınında spor\nyapanları bul"],
    ],
    app: { events: ["ETKİNLİKLER", "Yakınında\nne var?"], map: ["HARİTA", "Etkinlikleri\nharitada gör"], event: ["ETKİNLİK", "Tek dokunuşla\nkatıl"], teams: ["TAKIMLAR", "Takımını\nbul"], team: ["TAKIMLAR", "Takımını\nbul"] },
    end: ["Koşu, yüzme, bisiklet, triatlon", "ve daha fazlası"], endKicker: "BİRLİKTE DAHA GÜZEL",
  },
  en: {
    photos: [
      ["kosu.jpg", "MUUVLINK", "Connect\nthrough sport"],
      ["bisiklet.jpg", "TEAMS · EVENTS", "Find people who\nplay near you"],
      ["yuzme.jpg", "TEAMS · EVENTS", "Find people who\nplay near you"],
    ],
    app: { events: ["EVENTS", "What's\nnear you?"], map: ["MAP", "See events\non the map"], event: ["EVENT", "Join in\none tap"], teams: ["TEAMS", "Find your\nteam"], team: ["TEAMS", "Find your\nteam"] },
    end: ["Running, swimming, cycling, triathlon", "and more"], endKicker: "BETTER TOGETHER",
  },
};

const run = (args) => {
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });
  if (r.status) throw new Error("ffmpeg hata: " + args.join(" ").slice(0, 200));
};
const uri = (p, type) => `data:${type};base64,${readFileSync(p).toString("base64")}`;
const ICON = uri(join(ROOT, "public", "icons", "favicon.png"), "image/png");
const LOGO_WHITE = `data:image/svg+xml;base64,${Buffer.from(readFileSync(join(ROOT, "public", "icons", "logo-yatay.svg"), "utf8").replace(/#231f20/g, "#ffffff")).toString("base64")}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");

const BASE_CSS = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;background:transparent;font-family:Montserrat,sans-serif;overflow:hidden}
.k{font-size:28px;font-weight:800;letter-spacing:.08em;color:${YEL}}
.t{font-size:78px;font-weight:900;line-height:1.02;letter-spacing:-.02em;color:#fff;text-transform:uppercase;margin-top:16px}`;
const page = (body, css = "") => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=block" rel="stylesheet">
<style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;

// Fotoğraf üstü: altta düz Deep Teal bant.
const photoCaption = (k, t) => page(`<div style="position:absolute;left:0;right:0;bottom:0;background:${TEAL};padding:56px 60px 120px"><div class="k">${esc(k)}</div><div class="t">${esc(t)}</div></div>`);
// Uygulama bölümü: üstte yazı (zemin çerçeve görselinde).
const appCaption = (k, t) => page(`<div style="position:absolute;left:60px;top:96px"><div class="k">${esc(k)}</div><div class="t">${esc(t)}</div></div>`);
// Telefon çerçevesi: ekran deliği saydam, çevresi Deep Teal; üstte durum çubuğu.
const PHONE = { w: 640, x: (W - 640) / 2, y: 440, bez: 16 };
PHONE.h = Math.round(PHONE.w * 932 / 430);
const frame = () => page(`
<div style="position:absolute;left:${PHONE.x - PHONE.bez}px;top:${PHONE.y - PHONE.bez}px;width:${PHONE.w + 2 * PHONE.bez}px;height:${PHONE.h + 2 * PHONE.bez}px;border:${PHONE.bez}px solid ${INK};border-radius:${96}px;box-shadow:0 0 0 3000px ${TEAL}"></div>
<svg viewBox="0 0 430 59" style="position:absolute;left:${PHONE.x}px;top:${PHONE.y}px;width:${PHONE.w}px">
  <text x="58" y="38" font-family="-apple-system,'SF Pro Text',Montserrat,sans-serif" font-size="17" font-weight="700" fill="${INK}" text-anchor="middle">9:41</text>
  <rect x="152" y="11" width="126" height="37" rx="18.5" fill="#000"/>
  <g fill="${INK}" transform="translate(314 26)">
    <rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
    <path d="M30 2.6a10.8 10.8 0 0 1 14.6 0l-1.4 1.5a8.7 8.7 0 0 0-11.8 0zM32.6 5.4a7 7 0 0 1 9.4 0l-1.4 1.5a5 5 0 0 0-6.6 0zM35.2 8.2a3.2 3.2 0 0 1 4.2 0l-2.1 2.4z"/>
    <rect x="52" y="0" width="25" height="12" rx="3.6" fill="none" stroke="${INK}" stroke-opacity=".4" stroke-width="1"/>
    <rect x="54" y="2" width="21" height="8" rx="2.2"/>
  </g></svg>`);
// Kapanış: Deep Teal zemin, amblem + yazı logosu, iki satır, sarı vurgu.
const endCard = (lines, kicker) => page(`<div style="position:absolute;inset:0;background:${TEAL};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 60px">
  <img src="${ICON}" style="width:190px"><img src="${LOGO_WHITE}" style="width:520px;margin-top:40px">
  <div style="margin-top:64px;color:#fff;font-size:36px;font-weight:700;line-height:1.4">${lines.map(esc).join("<br>")}</div>
  <div class="k" style="margin-top:44px">${esc(kicker)}</div>
  <div style="margin-top:22px;color:rgba(255,255,255,.75);font-size:30px;font-weight:700">muuvlink.app</div></div>`);

// ── HTML → saydam PNG (headless Chrome, CDP) ─────────────────────────────
const PORT = 9382;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(HERE, ".tmp", "profile-video")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params }));
});
async function png(name, html) {
  const f = join(TMP, `${name}.html`);
  writeFileSync(f, html);
  await send("Page.navigate", { url: `file://${f}` });
  await sleep(1200);
  const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const p = join(TMP, `${name}.png`);
  writeFileSync(p, Buffer.from(s.data, "base64"));
  return p;
}

// ── Bölümler ─────────────────────────────────────────────────────────────
function photoClip(name, file, dur, cap) {
  const out = join(TMP, `${name}.mp4`);
  const frames = Math.round(dur * FPS);
  // 1080×1920 → 886×1920 ortadan kırp, 2× büyüt (yumuşak yakınlaşma için), zoompan.
  run(["-loop", "1", "-i", join(ROOT, "public", "story", file), "-i", cap, "-filter_complex",
    `[0]scale=1080:1920,crop=${W}:${H},scale=${W * 2}:${H * 2},zoompan=z='1+0.07*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}[bg];[bg][1]overlay,format=yuv420p`,
    "-frames:v", String(frames), "-r", String(FPS), out]);
  return out;
}

function appClip(lang, framePng, caps) {
  const dir = join(HERE, ".tmp", `rec-${lang}`);
  const { frames, marks, end } = JSON.parse(readFileSync(join(dir, "frames.json"), "utf8"));
  // Süreler zaman damgasından: ekran değişmeyince kare gelmez, son kare o süre ekranda kalır.
  let list = "";
  for (let i = 0; i < frames.length; i++) {
    const d = (i + 1 < frames.length ? frames[i + 1].t : end) - frames[i].t;
    list += `file '${join(dir, frames[i].f)}'\nduration ${Math.max(d, 0.001).toFixed(4)}\n`;
  }
  list += `file '${join(dir, frames[frames.length - 1].f)}'\n`;
  const lst = join(TMP, `rec-${lang}.txt`);
  writeFileSync(lst, list);
  // İlk dokunuş Etkinlikler'e geçiyor; ondan önceki giriş ekranı atlanır.
  const start = marks[0].t + 0.9;
  const dur = (end - start) / SPEED;
  const inputs = ["-f", "concat", "-safe", "0", "-i", lst, "-i", framePng];
  const names = Object.keys(caps);
  for (const n of names) inputs.push("-i", caps[n]);
  let fc = `color=c=${TEAL}:s=${W}x${H}:r=${FPS}:d=${dur.toFixed(3)}[bg];` +
    `[0]fps=${FPS},trim=${start.toFixed(3)},setpts=(PTS-STARTPTS)/${SPEED},fps=${FPS},scale=${PHONE.w}:${PHONE.h}[app];` +
    `[bg][app]overlay=${PHONE.x}:${PHONE.y}:shortest=1[a0];[a0][1]overlay[c0]`;
  // Her yazı kendi bölümünün başından bir sonrakinin başına kadar.
  const ts = marks.map((m) => Math.max(0, (m.t - start) / SPEED));
  let last = "c0";
  marks.forEach((m, i) => {
    const a = i === 0 ? 0 : ts[i], b = i + 1 < marks.length ? ts[i + 1] : dur + 1;
    const k = names.indexOf(m.name) + 2;
    fc += `;[${last}][${k}]overlay=enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'[c${i + 1}]`;
    last = `c${i + 1}`;
  });
  const out = join(TMP, `app-${lang}.mp4`);
  run([...inputs, "-filter_complex", `${fc};[${last}]format=yuv420p[v]`, "-map", "[v]", "-t", dur.toFixed(3), "-r", String(FPS), out]);
  return out;
}

function stillClip(name, img, dur) {
  const out = join(TMP, `${name}.mp4`);
  run(["-loop", "1", "-framerate", String(FPS), "-t", String(dur), "-i", img, "-vf", `scale=${W}:${H},format=yuv420p`, out]);
  return out;
}

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

  const framePng = await png("frame", frame());
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["tr", "en"];
  for (const lang of langs) {
    const C = COPY[lang];
    const parts = [];
    const durs = [2.4, 1.8, 1.8];
    for (const [i, [file, k, t]] of C.photos.entries()) {
      parts.push(photoClip(`photo${i}-${lang}`, file, durs[i], await png(`pcap${i}-${lang}`, photoCaption(k, t))));
    }
    const caps = {};
    for (const [n, [k, t]] of Object.entries(C.app)) caps[n] = await png(`acap-${n}-${lang}`, appCaption(k, t));
    parts.push(appClip(lang, framePng, caps));
    parts.push(stillClip(`end-${lang}`, await png(`end-${lang}`, endCard(C.end, C.endKicker)), 3.2));

    // Bölümler arası kısa geçiş (xfade), sonra sessiz ses kanalı.
    const lens = parts.map((p) => Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).stdout.toString()));
    const X = 0.35;
    let fc = "", lastL = "0:v", acc = lens[0];
    for (let i = 1; i < parts.length; i++) {
      fc += `${fc ? ";" : ""}[${lastL}][${i}:v]xfade=transition=fade:duration=${X}:offset=${(acc - X).toFixed(3)}[x${i}]`;
      lastL = `x${i}`;
      acc += lens[i] - X;
    }
    const out = join(OUT, `ad-${lang}.mp4`);
    run([...parts.flatMap((p) => ["-i", p]), "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-filter_complex", `${fc};[${lastL}]format=yuv420p[v]`, "-map", "[v]", "-map", `${parts.length}:a`,
      "-r", String(FPS), "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-b:v", "10M",
      "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out]);
    console.log(out.replace(HERE + "/", ""), acc.toFixed(1), "sn");
  }
} finally {
  ws?.close();
  chrome.kill();
}
