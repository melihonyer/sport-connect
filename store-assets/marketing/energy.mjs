// Enerjik tanıtım videosu (dikey 886×1920, 30 fps, 30 sn, müzikli) — Melih: "biraz sakin
// olmuş, Muuvlink'in ruhunu yansıtmıyor" (6 Ekim 2026). video.mjs'in hızlı kurgulu hali.
//
// Görüntü ve müzik Envato Elements'ten (SALT hesabı, 6 Ekim 2026 lisanslandı); ham dosyalar
// envato/ altında, depoya girmez (GB'larca). Müzik: "Sport Upbeat" · MrClaps, 135 BPM.
// Not: parça YouTube Content ID'de "claim clear" değil — Play tanıtımı YouTube'a yüklenirse
// telif uyarısı gelebilir; Envato lisansıyla itiraz edilir.
//
// Kurgu vuruş ızgarasında: müzik 38,6. sn'den başlar → video 1,60 sn'de vuruş, 2,49'da drop,
// 29,4'te kapanış vuruşu. Bütün kesimler bu ızgaraya oturur.
//
// Önce: node record.mjs tr en (uygulama kaydı) + envato/proxy/*.mp4 (886×1920 30 fps kopyalar)
// Sonra: node store-assets/marketing/energy.mjs [tr en] → out/video/energy-<dil>.mp4
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const TMP = join(HERE, ".tmp", "energy");
const OUT = join(HERE, "out", "video");
const PROXY = join(HERE, "envato", "proxy");
const MUSIC = join(HERE, "envato", "music", "Sport Upbeat.wav");
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 886, H = 1920, FPS = 30, TOTAL = 30;
const TEAL = "#114956", YEL = "#F4F818", INK = "#1F2121";
const MUSIC_START = 38.6;
const BEAT = 60 / 135;
const b = (k) => 1.6 + BEAT * k;          // k. vuruşun video zamanı
const F = (t) => Math.round(t * FPS);     // kare sınırı (yuvarlama birikmesin diye mutlak zamandan)

const COPY = {
  tr: {
    intro: ["KOŞ", "PEDAL\nÇEVİR", "YÜZ", "OYNA", "BİRLİKTE."],
    m1: ["Yakınında spor", "yapanları bul"], m2: ["Takımını bul,", "etkinliğe katıl"],
    app: { events: ["ETKİNLİKLER", "Yakınında\nne var?"], map: ["HARİTA", "Haritada\ngör"], event: ["ETKİNLİK", "Tek dokunuşla\nkatıl"], teams: ["TAKIMLAR", "Takımını\nbul"], team: ["TAKIMLAR", "Takımına\nkatıl"] },
    close: ["Sporla", "buluş"],
    end: ["Koşu · Yüzme · Bisiklet · Triatlon", "ve daha fazlası"], endKicker: "BİRLİKTE DAHA GÜZEL",
  },
  en: {
    intro: ["RUN", "RIDE", "SWIM", "PLAY", "TOGETHER."],
    m1: ["Find people who", "play near you"], m2: ["Find your team,", "join events"],
    app: { events: ["EVENTS", "What's\nnear you?"], map: ["MAP", "See it on\nthe map"], event: ["EVENT", "Join in\none tap"], teams: ["TEAMS", "Find your\nteam"], team: ["TEAMS", "Join the\nteam"] },
    close: ["Connect", "through sport"],
    end: ["Running · Swimming · Cycling · Triathlon", "and more"], endKicker: "BETTER TOGETHER",
  },
};

// Sahneler: [proxy adı, kaynakta başlangıç sn]. Süreyi ızgara verir.
const INTRO = [["group-of-young", 5.0], ["cyclists-urban", 2.0], ["swimmer-doing-freestyle", 4.2], ["enthusiastic-adults-smiling", 5.6], ["paddle-tennis-team", 1.2]];
const MONTAGE = [["group-of-adults", 1.4], ["bird-s-eye", 1.0], ["smiling-young-women", 2.0], ["men-standing-on", 0.9], ["cyclists-country", 4.0], ["friends-swimming-in", 2.0], ["people-running-together", 3.0]];
const CLOSING = [["paddle-tennis-team", 2.3], ["smiling-young-women", 9.0], ["enthusiastic-adults-smiling", 7.4], ["group-of-adults", 5.0]];
const APP_BG = ["group-of-young", 0.5];

const run = (args) => {
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });
  if (r.status) throw new Error("ffmpeg hata: " + args.join(" ").slice(0, 300));
};
const uri = (p, type) => `data:${type};base64,${readFileSync(p).toString("base64")}`;
const ICON = uri(join(ROOT, "public", "icons", "favicon.png"), "image/png");
const LOGO_WHITE = `data:image/svg+xml;base64,${Buffer.from(readFileSync(join(ROOT, "public", "icons", "logo-yatay.svg"), "utf8").replace(/#231f20/g, "#ffffff")).toString("base64")}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");

const page = (body, css = "") => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=block" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;background:transparent;font-family:Montserrat,sans-serif;overflow:hidden}
.st{display:inline-block;font-weight:900;text-transform:uppercase;letter-spacing:-.02em;line-height:1;padding:.12em .22em .1em}
${css}</style></head><body>${body}</body></html>`;
// Ortada büyük tek kelime, eğik etiket. Son kelime sarı.
const word = (t, last) => page(`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center">
  <div class="st" style="font-size:${t.length > 9 ? 112 : 150}px;background:${last ? YEL : TEAL};color:${last ? TEAL : "#fff"};transform:rotate(-4deg);box-shadow:0 18px 50px rgba(0,0,0,.35)">${esc(t)}</div></div>`);
// Alt üçte iki satırlık etiket: üst satır Deep Teal, alt satır sarı.
const lower = ([a, c]) => page(`<div style="position:absolute;left:56px;bottom:300px;transform:rotate(-3deg);transform-origin:left bottom">
  <div class="st" style="font-size:76px;background:${TEAL};color:#fff">${esc(a)}</div><br>
  <div class="st" style="font-size:76px;background:${YEL};color:${TEAL};margin-top:10px">${esc(c)}</div></div>`);
// Uygulama bölümü üst yazısı.
const appCap = (k, t) => page(`<div style="position:absolute;left:56px;top:90px">
  <div class="st" style="font-size:30px;background:${YEL};color:${TEAL};letter-spacing:.06em">${esc(k)}</div>
  <div style="margin-top:18px;color:#fff;font-size:80px;font-weight:900;line-height:1;text-transform:uppercase;letter-spacing:-.02em;text-shadow:0 6px 30px rgba(0,0,0,.35)">${esc(t)}</div></div>`);
const PHONE = { w: 620, bez: 16 };
PHONE.h = Math.round(PHONE.w * 932 / 430);
PHONE.x = Math.round((W - PHONE.w) / 2);
PHONE.y = H - PHONE.h - 70;
const frame = () => page(`
<div style="position:absolute;left:${PHONE.x - PHONE.bez}px;top:${PHONE.y - PHONE.bez}px;width:${PHONE.w + 2 * PHONE.bez}px;height:${PHONE.h + 2 * PHONE.bez}px;border:${PHONE.bez}px solid ${INK};border-radius:92px;box-shadow:0 30px 80px rgba(0,0,0,.45)"></div>
<svg viewBox="0 0 430 59" style="position:absolute;left:${PHONE.x}px;top:${PHONE.y}px;width:${PHONE.w}px">
  <text x="58" y="38" font-family="-apple-system,Montserrat,sans-serif" font-size="17" font-weight="700" fill="${INK}" text-anchor="middle">9:41</text>
  <rect x="152" y="11" width="126" height="37" rx="18.5" fill="#000"/>
  <g fill="${INK}" transform="translate(314 26)"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
  <rect x="52" y="0" width="25" height="12" rx="3.6" fill="none" stroke="${INK}" stroke-opacity=".4"/><rect x="54" y="2" width="21" height="8" rx="2.2"/></g></svg>`);
const endCard = (lines, kicker) => page(`<div style="position:absolute;inset:0;background:${TEAL};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 50px">
  <img src="${ICON}" style="width:200px"><img src="${LOGO_WHITE}" style="width:540px;margin-top:40px">
  <div style="margin-top:60px;color:#fff;font-size:34px;font-weight:700;line-height:1.45">${lines.map(esc).join("<br>")}</div>
  <div class="st" style="margin-top:46px;font-size:34px;background:${YEL};color:${TEAL};letter-spacing:.05em">${esc(kicker)}</div>
  <div style="margin-top:26px;color:rgba(255,255,255,.8);font-size:30px;font-weight:700">muuvlink.app</div></div>`);

// ── HTML → saydam PNG ────────────────────────────────────────────────────
const PORT = 9392;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(HERE, ".tmp", "profile-energy")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
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
  await sleep(900);
  const s = await send("Page.captureScreenshot", { format: "png" });
  const p = join(TMP, `${name}.png`);
  writeFileSync(p, Buffer.from(s.data, "base64"));
  return p;
}

// ── Parçalar ─────────────────────────────────────────────────────────────
// Sahne: proxy'den kes, hafif yakınlaşma (durgun kalmasın).
function shot(name, [src, ss], t0, t1) {
  const n = F(t1) - F(t0);
  const out = join(TMP, `${name}.mp4`);
  run(["-ss", String(ss), "-i", join(PROXY, `${src}.mp4`), "-frames:v", String(n), "-an",
    "-vf", `zoompan=z='1+0.07*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "15", out]);
  return out;
}

function appPart(lang, t0, t1, framePng) {
  const dir = join(HERE, ".tmp", `rec-${lang}`);
  const { frames, marks, end } = JSON.parse(readFileSync(join(dir, "frames.json"), "utf8"));
  let list = "";
  for (let i = 0; i < frames.length; i++) {
    const d = (i + 1 < frames.length ? frames[i + 1].t : end) - frames[i].t;
    list += `file '${join(dir, frames[i].f)}'\nduration ${Math.max(d, 0.001).toFixed(4)}\n`;
  }
  list += `file '${join(dir, frames[frames.length - 1].f)}'\n`;
  const lst = join(TMP, `rec-${lang}.txt`);
  writeFileSync(lst, list);
  const n = F(t1) - F(t0);
  const dur = n / FPS;
  const start = marks[0].t + 0.9;
  const speed = (end - 0.3 - start) / dur;
  const out = join(TMP, `app-${lang}.mp4`);
  // Arka plan: koşu görüntüsü, bulanık + Deep Teal örtü (düz renk zemin "sakin" kalıyordu).
  run(["-ss", String(APP_BG[1]), "-i", join(PROXY, `${APP_BG[0]}.mp4`), "-f", "concat", "-safe", "0", "-i", lst, "-i", framePng,
    "-filter_complex",
    `[0]scale=${W / 4}:${H / 4},boxblur=6:2,scale=${W}:${H},drawbox=c=${TEAL}@0.72:t=fill[bg];` +
    `[1]fps=${FPS},trim=${start.toFixed(3)},setpts=(PTS-STARTPTS)/${speed.toFixed(4)},fps=${FPS},scale=${PHONE.w}:${PHONE.h}[app];` +
    `[bg][app]overlay=${PHONE.x}:${PHONE.y}:shortest=1[a];[a][2]overlay,format=yuv420p[v]`,
    "-map", "[v]", "-frames:v", String(n), "-c:v", "libx264", "-preset", "veryfast", "-crf", "15", out]);
  // Yazı geçişleri: kayıttaki bölüm başları, en yakın vuruşa yuvarlanır (yazı vuruşla çıksın).
  return { file: out, marks: marks.map((m) => {
    const t = t0 + Math.max(0, (m.t - start) / speed);
    return { name: m.name, t: m.name === marks[0].name ? t0 : b(Math.round((t - 1.6) / BEAT)) };
  }) };
}

function still(name, img, t0, t1) {
  const out = join(TMP, `${name}.mp4`);
  run(["-loop", "1", "-framerate", String(FPS), "-i", img, "-frames:v", String(F(t1) - F(t0)), "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "15", out]);
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
    const texts = []; // [png, t0, t1, pop]
    // 1) Giriş: her vuruşta kesim + kelime (0 → drop).
    const introCuts = [0, b(-2), b(-1), b(0), b(1), b(2)];
    for (let i = 0; i < INTRO.length; i++) {
      parts.push(shot(`intro${i}`, INTRO[i], introCuts[i], introCuts[i + 1]));
      texts.push([await png(`w${i}-${lang}`, word(C.intro[i], i === INTRO.length - 1)), introCuts[i], introCuts[i + 1], true, null, [W / 2, H / 2]]);
    }
    // 2) Drop'tan sonra montaj: 2 vuruşta bir kesim.
    for (let i = 0; i < MONTAGE.length; i++) parts.push(shot(`m${i}`, MONTAGE[i], b(2 + 2 * i), b(4 + 2 * i)));
    texts.push([await png(`m1-${lang}`, lower(C.m1)), b(2), b(9), true, null, [56, H - 300]]);
    texts.push([await png(`m2-${lang}`, lower(C.m2)), b(10), b(16), true, null, [56, H - 300]]);
    // 3) Uygulama.
    const app = appPart(lang, b(16), b(50), framePng);
    parts.push(app.file);
    app.marks.forEach((m, i) => {
      const t1 = i + 1 < app.marks.length ? app.marks[i + 1].t : b(50);
      texts.push([null, m.t, t1, true, m.name, [56, 90]]);
    });
    for (const tx of texts) if (!tx[0] && tx[4]) tx[0] = await png(`a-${tx[4]}-${lang}`, appCap(...C.app[tx[4]]));
    // 4) Kapanış sahneleri + "Sporla buluş".
    for (let i = 0; i < CLOSING.length; i++) parts.push(shot(`c${i}`, CLOSING[i], b(50 + 2 * i), b(52 + 2 * i)));
    texts.push([await png(`close-${lang}`, lower(C.close)), b(50), b(58), true, null, [56, H - 300]]);
    // 5) Logo.
    parts.push(still(`end-${lang}`, await png(`end-${lang}`, endCard(C.end, C.endKicker)), b(58), TOTAL));

    // Birleştir + yazılar (vuruşta "pop": 0,15 sn'de %125'ten %100'e) + drop ve kapanışta beyaz parlama.
    const inputs = parts.flatMap((p) => ["-i", p]);
    let fc = parts.map((_, i) => `[${i}]setsar=1[p${i}]`).join(";") + ";" + parts.map((_, i) => `[p${i}]`).join("") + `concat=n=${parts.length}:v=1:a=0[base]`;
    let last = "base";
    // Pop, yazının kendi çıpasından büyür (tam kare PNG ortadan ölçeklenince üst yazı taşıyordu).
    texts.forEach(([p, t0, t1, , , [ax, ay]], i) => {
      const k = parts.length + i;
      inputs.push("-loop", "1", "-framerate", String(FPS), "-t", (t1 - t0 + 0.1).toFixed(3), "-i", p);
      fc += `;[${k}]format=rgba,scale=w='iw*max(1,1.25-1.67*t)':h=-1:eval=frame,setpts=PTS+${t0.toFixed(3)}/TB[t${i}]`;
      fc += `;[${last}][t${i}]overlay=x='${ax}-${ax}*w/${W}':y='${ay}-${ay}*h/${H}':eval=frame:enable='between(t,${t0.toFixed(3)},${(t1 - 0.001).toFixed(3)})'[o${i}]`;
      last = `o${i}`;
    });
    const flash = (t) => `drawbox=c=white@0.85:t=fill:enable='between(t,${t.toFixed(3)},${(t + 0.07).toFixed(3)})',drawbox=c=white@0.4:t=fill:enable='between(t,${(t + 0.07).toFixed(3)},${(t + 0.13).toFixed(3)})'`;
    fc += `;[${last}]${flash(b(2))},${flash(b(50))},${flash(29.4)},format=yuv420p[v]`;
    // Müzik: 38,6. sn'den 30 sn, girişte kısa, sonda yumuşak kısma.
    inputs.push("-ss", String(MUSIC_START), "-t", String(TOTAL), "-i", MUSIC);
    const ai = parts.length + texts.length;
    fc += `;[${ai}]afade=t=in:d=0.12,afade=t=out:st=${TOTAL - 0.5}:d=0.5[a]`;
    const out = join(OUT, `energy-${lang}.mp4`);
    run([...inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-t", String(TOTAL), "-r", String(FPS),
      "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-b:v", "12M", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", out]);
    console.log(out.replace(HERE + "/", ""));
  }
} finally {
  ws?.close();
  chrome.kill();
}
