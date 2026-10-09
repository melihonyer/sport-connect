// Strava kulübü için profil ve kapak görseli (9 Ekim 2026).
//   profil 1024×1024 — beyaz zemin, M amblemi kendi renklerinde (uygulama ikonu gibi; Melih); Strava yuvarlak
//                      kırptığı için amblem ortada ve küçük
//   kapak  1180×579  — Strava'nın önerdiği ölçü. Web sürümü yalnız orta bandı gösteriyor (ölçüldü, 9 Ekim 2026:
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
const PHOTO = uri(join(ROOT, "public", "story", "kosu.jpg"), "image/jpeg");

const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT = "U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const FONTS = [700, 800].map((w) => [["latin", LATIN], ["latin-ext", LATIN_EXT]].map(([n, r]) =>
  `@font-face{font-family:Montserrat;font-weight:${w};font-display:block;src:url(${uri(join(ROOT, "public", "fonts", `montserrat-${n}-${w}.woff2`), "font/woff2")}) format("woff2");unicode-range:${r}}`).join("")).join("");

const page = (w, h, body) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>${FONTS}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${w}px;height:${h}px;overflow:hidden;font-family:Montserrat,sans-serif;background:${TEAL}}
</style></head><body>${body}</body></html>`;

const profil = page(1024, 1024, `<div style="position:absolute;inset:0;background:#fff"></div><img src="${EMBLEM}" style="position:absolute;left:50%;top:50%;width:560px;transform:translate(-50%,-50%)">`);

// Fotoğraf: kaynakta koşucular x 320–780, y 830–1180. Sağ panelde (680×579) 0,895 ölçekle ortada.
const S = 0.895, PX = 170, PY = 690;
const kapak = page(1180, 579, `
  <div style="position:absolute;right:0;top:0;width:680px;height:579px;overflow:hidden">
    <img src="${PHOTO}" style="position:absolute;width:${1080 * S}px;left:${-PX * S}px;top:${-PY * S}px">
  </div>
  <div style="position:absolute;left:64px;top:122px;width:420px;color:#fff">
    <img src="${WORDMARK}" style="height:36px;display:block">
    <div style="margin-top:26px;font-weight:800;font-size:52px;line-height:1;letter-spacing:-.02em">Sporla <span style="color:${YEL}">buluş.</span></div>
    <div style="margin-top:16px;font-weight:700;font-size:20px;line-height:1.35;opacity:.88">Yakınındaki takımları ve etkinlikleri keşfet, birlikte antrenman yap.</div>
    <div style="margin-top:18px;display:inline-block;background:${YEL};color:${TEAL};font-weight:800;font-size:19px;padding:9px 19px;border-radius:999px">muuvlink.app</div>
  </div>`);

// Chrome 154'te DevTools ekran görüntüsü büyük görselde donuyor (bkz. parkur/build-parkur.mjs):
// --screenshot ile, dosya yazılıp boyutu sabitlenince süreç kapatılır.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
for (const [name, w, h, html] of [["muuvlink-strava-profil-1024", 1024, 1024, profil], ["muuvlink-strava-kapak-1180x579", 1180, 579, kapak]]) {
  const f = join(TMP, `${name}.html`), png = join(OUT, `${name}.png`), prof = join(TMP, `profile-${name}`);
  writeFileSync(f, html);
  rmSync(png, { force: true });
  const c = spawn(CHROME, ["--headless=new", "--hide-scrollbars", `--window-size=${w},${h}`, "--virtual-time-budget=3000",
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
