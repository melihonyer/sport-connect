// Strava kulübü için profil ve kapak görseli (9 Ekim 2026).
//   profil 1024×1024 — beyaz zemin, M amblemi kendi renklerinde (uygulama ikonu gibi; Melih); Strava yuvarlak
//                      kırptığı için amblem ortada ve küçük
//   kapak  2360×1158 — Strava'nın önerdiği 1180×579'un 2x'i. Web sürümü yalnız orta bandı gösteriyor (ölçüldü, 9 Ekim 2026:
//                      y ≈ 110–470) ve avatar kutusu sol altı (x 19–136, y ≥ 412) kapatıyor: yazı bloğu y 122–370'te.
// Fotoğraf public/story/kosu.jpg (Canva, telifsiz — hikâye kartındakiyle aynı).
// Kurumsal palet: Deep Teal zemin, tek vurgu sarı, degrade yok, emoji yok.
//
// node store-assets/marketing/strava/build-strava.mjs → out/strava/*.png
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const OUT = join(HERE, "..", "out", "strava"), TMP = join(HERE, ".tmp");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TEAL = "#114956", YEL = "#F4F818";

const uri = (p, type) => `data:${type};base64,${readFileSync(p).toString("base64")}`;
const LOGO_SVG = readFileSync(join(ROOT, "public", "icons", "logo-yatay.svg"), "utf8");
const WORDMARK = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG.replace(/#231f20/g, "#ffffff")).toString("base64")}`;
const EMBLEM = uri(join(HERE, "amblem-renkli.png"), "image/png");
// Sağ panelin fotoğrafı 2x (1360×1158) önceden kırpılıp Lanczos ile büyütülmüş hali: kosu.jpg yalnız
// 1080×1920, daha büyük aslı yok (Canva'da üretildi). Yazı ve logo ise 2x'te vektörden çizilir.
const PHOTO = uri(join(HERE, "kosu-panel@2x.jpg"), "image/jpeg");

const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT = "U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const FONTS = [700, 800].map((w) => [["latin", LATIN], ["latin-ext", LATIN_EXT]].map(([n, r]) =>
  `@font-face{font-family:Montserrat;font-weight:${w};font-display:block;src:url(${uri(join(ROOT, "public", "fonts", `montserrat-${n}-${w}.woff2`), "font/woff2")}) format("woff2");unicode-range:${r}}`).join("")).join("")
  + [["latin", LATIN], ["latin-ext", LATIN_EXT]].map(([n, r]) =>
    `@font-face{font-family:Caveat;font-weight:700;font-display:block;src:url(${uri(join(HERE, "..", "parkur", "fonts", `caveat-${n}-700.woff2`), "font/woff2")}) format("woff2");unicode-range:${r}}`).join("");

const page = (w, h, body) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>${FONTS}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${w}px;height:${h}px;overflow:hidden;font-family:Montserrat,sans-serif;background:${TEAL}}
</style></head><body>${body}</body></html>`;

const profil = page(1024, 1024, `<div style="position:absolute;inset:0;background:#fff"></div><img src="${EMBLEM}" style="position:absolute;left:50%;top:50%;width:560px;transform:translate(-50%,-50%)">`);

// Kapak 1180×579 CSS pikseli, 2x çizilir → 2360×1158 (Strava sayfada 1288 px gösteriyor, Retina'da flu kalıyordu).
// Sol altta avatar alanı boş (2x'te ~340×300), sarı "muuvlink.app" düğmesi yok; yazı bloğu dikeyde ortada.
const kapak = page(1180, 579, `
  <img src="${PHOTO}" style="position:absolute;right:0;top:0;width:680px;height:579px">
  <div style="position:absolute;left:64px;top:50%;transform:translateY(-50%);width:420px;color:#fff">
    <img src="${WORDMARK}" style="height:36px;display:block">
    <div style="margin-top:26px;font-weight:800;font-size:52px;line-height:1;letter-spacing:-.02em">Sporla <span style="color:${YEL}">buluş.</span></div>
    <div style="margin-top:16px;font-weight:700;font-size:20px;line-height:1.35;opacity:.88">Yakınındaki takımları ve etkinlikleri keşfet, birlikte antrenman yap.</div>
  </div>`);


// Kapak · İstanbul (Melih, 9 Ekim 2026: "aynısı olmak zorunda değil"): Boğaz'ın Sentinel-2 uydu görüntüsü
// (2x, sat/istanbul@2x.jpg — parkur/sat.py ile), Avrupa yakası sahil koşu rotası (Ortaköy → Emirgan)
// elle çizilmiş kırmızı çizgi, el yazısı. 1300×637 (Strava'nın sakladığı en büyük boy) × 2.
// Atıf görselde değil: CC BY 4.0 gereği kulüp açıklamasına yazılır.
const MARKS = JSON.parse(readFileSync(join(HERE, "sat", "istanbul-marks.json"), "utf8"));
const SAT = uri(join(HERE, "sat", "istanbul@2x.jpg"), "image/jpeg");
const RED = "#FF2B2B";
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
// Catmull-Rom ile yumuşatılmış, hafif titrek el çizgisi
function handPath(pts, jit = 1.6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 10; k++) {
      const t = k / 10, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]) + rnd() * jit, f(p0[1], p1[1], p2[1], p3[1]) + rnd() * jit]);
    }
  }
  out.push(pts.at(-1));
  return "M" + out.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L");
}
const route = ["ortakoy", "kurucesme", "arnavutkoy", "bebek", "rumelihisari", "baltalimani", "emirgan"].map((k) => [MARKS[k][0] - 12, MARKS[k][1]]);
const [sx, sy] = route[0], [ex, ey] = route.at(-1);
const kapakIst = page(1300, 637, `
  <img src="${SAT}" style="position:absolute;inset:0;width:1300px;height:637px">
  <div style="position:absolute;inset:0;background:rgba(8,32,38,.34)"></div>
  <svg width="1300" height="637" style="position:absolute;inset:0">
    <defs><filter id="lift"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity=".5"/></filter></defs>
    <g filter="url(#lift)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${handPath(route)}" stroke="${RED}" stroke-width="7"/>
      <circle cx="${sx}" cy="${sy}" r="9" fill="${RED}" stroke="#fff" stroke-width="3.5"/>
      <path d="${handPath([[ex + 16, ey], [ex, ey - 15], [ex - 16, ey], [ex, ey + 15], [ex + 18, ey + 2]], 1)}" stroke="${RED}" stroke-width="6"/>
      <path d="${handPath([[905, 318], [790, 300], [664, 286]], 1.2)}" stroke="#fff" stroke-width="5"/>
      <path d="M682 271 L664 286 L684 299" stroke="#fff" stroke-width="5"/>
    </g>
  </svg>
  <div style="position:absolute;left:912px;top:270px;font-family:Caveat;font-weight:700;font-size:62px;line-height:.95;color:#fff;
    text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 18px rgba(0,0,0,.6)">birlikte<br>koşalım</div>
  <div style="position:absolute;left:70px;top:50%;transform:translateY(-58%);width:470px;color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.45)">
    <img src="${WORDMARK}" style="height:38px;display:block;filter:drop-shadow(0 2px 10px rgba(0,0,0,.45))">
    <div style="margin-top:26px;font-weight:800;font-size:64px;line-height:1;letter-spacing:-.02em">Sporla<br><span style="color:${YEL}">buluş.</span></div>
    <div style="margin-top:18px;font-weight:700;font-size:21px;line-height:1.35">Yakınındaki takımları ve etkinlikleri<br>keşfet, birlikte antrenman yap.</div>
  </div>`);

// Kapak · dekupe grup (Melih, 9 Ekim 2026: harita yerine dekupe sporcu ya da toplu koşu). İlk deneme
// stüdyo çekimi grup "çok abdal bakıyorlar" dendi; yerine gülerek koşan karışık grup: Envato "Smiling
// Friends Running Outdoors On A Bright Day" (mstandret, 5504×3674, SALT hesabıyla lisanslı). Arka plan
// Adobe Photoshop API ile kaldırıldı → grup-kosu2-dekupe@2x.png (depoya girmez). Kişiler belden kesik
// çekildiği için grup alt kenardan taşar; başlar dar görünüm bandının (y ≈ 120–517) içinde.
const GROUP = uri(join(HERE, "grup-kosu2-dekupe@2x.png"), "image/png");
const kapakGrup = page(1300, 637, `
  <div style="position:absolute;left:905px;top:345px;width:560px;height:560px;margin:-280px 0 0 -280px;border-radius:50%;background:${YEL}"></div>
  <img src="${GROUP}" style="position:absolute;right:6px;bottom:0;height:480px">
  <div style="position:absolute;left:70px;top:146px;width:430px;color:#fff">
    <img src="${WORDMARK}" style="height:38px;display:block">
    <div style="margin-top:28px;font-weight:800;font-size:66px;line-height:1;letter-spacing:-.02em">Sporla<br><span style="color:${YEL}">buluş.</span></div>
    <div style="margin-top:20px;font-weight:700;font-size:21px;line-height:1.38;opacity:.9">Yakınındaki takımları ve etkinlikleri<br>keşfet, birlikte antrenman yap.</div>
  </div>`);

// Kapak · altın saat (Melih, 9 Ekim 2026: stüdyo/dekupe gruplar olmadı, enerjik fotoğraf; 4 numara).
// Envato "Men Running During Golden Hour in City" (YuriArcursPeopleimages, 4096×2160, SALT hesabıyla
// lisanslı). Hareket bulanıklığı olduğu için dekupe edilmez: sağda fotoğraf (kosu4-panel@2x.jpg), solda
// Deep Teal panel. Yazı bloğu y 146–419, avatar sol alttaki boş alana biner.
const FOTO4 = uri(join(HERE, "kosu4-panel@2x.jpg"), "image/jpeg");
const kapakAltin = page(1300, 637, `
  <img src="${FOTO4}" style="position:absolute;right:0;top:0;width:720px;height:637px">
  <div style="position:absolute;left:70px;top:146px;width:470px;color:#fff">
    <img src="${WORDMARK}" style="height:38px;display:block">
    <div style="margin-top:28px;font-weight:800;font-size:66px;line-height:1;letter-spacing:-.02em">Sporla<br><span style="color:${YEL}">buluş.</span></div>
    <div style="margin-top:20px;font-weight:700;font-size:21px;line-height:1.38;opacity:.9">Yakınındaki takımları ve etkinlikleri<br>keşfet, birlikte antrenman yap.</div>
  </div>`);

// Chrome 154'te DevTools ekran görüntüsü büyük görselde donuyor (bkz. parkur/build-parkur.mjs):
// --screenshot ile, dosya yazılıp boyutu sabitlenince süreç kapatılır.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
for (const [name, w, h, html, dpr] of [["muuvlink-strava-profil-1024", 1024, 1024, profil, 1], ["muuvlink-strava-kapak-2360x1158", 1180, 579, kapak, 2], ["muuvlink-strava-kapak-istanbul-2600x1274", 1300, 637, kapakIst, 2], ["muuvlink-strava-kapak-grup-2600x1274", 1300, 637, kapakGrup, 2], ["muuvlink-strava-kapak-altin-2600x1274", 1300, 637, kapakAltin, 2]]) {
  const f = join(TMP, `${name}.html`), png = join(OUT, `${name}.png`), prof = join(TMP, `profile-${name}`);
  writeFileSync(f, html);
  rmSync(png, { force: true });
  const c = spawn(CHROME, ["--headless=new", "--hide-scrollbars", `--window-size=${w},${h}`, `--force-device-scale-factor=${dpr}`, "--virtual-time-budget=3000",
    `--user-data-dir=${prof}`, `--screenshot=${png}`, `file://${f}`], { stdio: "ignore" });
  let last = -1;
  for (let t = 0; t < 120; t++) {
    await sleep(500);
    if (c.exitCode !== null) break;
    const size = existsSync(png) ? statSync(png).size : -1;
    if (size > 0 && size === last) break;
    last = size;
  }
  c.kill("SIGKILL");
  rmSync(prof, { recursive: true, force: true });
  console.log(existsSync(png) ? `out/strava/${name}.png` : `HATA ${name}`);
}
