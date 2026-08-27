// ───────────────────────────────────────────────────────────────────────────
// index.html içindeki statik SEO metnini ve FAQPage/Organization şemasını
// i18n.js'ten yeniden üretir. `npm run build` öncesi otomatik çalışır.
//
// NEDEN: ChatGPT, Perplexity ve Claude'un tarayıcıları JavaScript ÇALIŞTIRMAZ,
// yalnız ham HTML'i okur. Site tamamen React ile çizildiği için bu botlar
// bugüne kadar sayfa başlığı dışında hiçbir metin görmüyordu.
//
// NASIL: metin #root'un İÇİNE yazılır. React mount olurken createRoot bu
// içeriği kendiliğinden siler — yani insan uygulamayı, bot metni görür ve
// ikisi de AYNI cümleleri okur (cloaking yok). Şema metni de aynı kaynaktan
// üretildiği için sayfadaki metinle birebir eşleşir; eşleşmezse Google şemayı
// yok sayar.
//
// Metni değiştirmek için i18n.js içindeki `faq` bloğunu düzenle, burayı değil.
// ───────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translations } from '../i18n.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const ORIGIN = 'https://muuvlink.app';
const LANG = 'tr'; // sunucudan basılan HTML Türkçedir (<html lang="tr">)

const tr = (key) => {
  const node = key.split('.').reduce((o, k) => (o ? o[k] : undefined), translations);
  if (!node || !node[LANG]) throw new Error(`i18n anahtarı yok: ${key}`);
  return node[LANG];
};

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const faq = [1, 2, 3, 4, 5, 6].map((n) => ({ q: tr(`faq.q${n}`), a: tr(`faq.a${n}`) }));

// ── 1. Görünür metin (#root içine) ─────────────────────────────────────────
const S = {
  wrap: 'max-width:820px;margin:0 auto;padding:56px 24px 80px;font-family:Montserrat,system-ui,sans-serif;color:#333E40;line-height:1.6',
  h1: 'font-size:clamp(1.7rem,4vw,2.4rem);line-height:1.15;letter-spacing:-.02em;color:#114956;margin:0 0 14px',
  lead: 'font-size:1.05rem;color:#333E40;margin:0 0 8px',
  nav: 'margin:22px 0 34px;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px 20px;font-size:.9rem',
  a: 'color:#114956;font-weight:600;text-decoration:none',
  h2: 'font-size:1.5rem;color:#114956;margin:40px 0 18px;letter-spacing:-.01em',
  q: 'font-size:1rem;font-weight:600;color:#1F2121;margin:22px 0 6px',
  ans: 'margin:0;font-size:.95rem',
};

const textBlock = `
    <div id="seo-intro" style="${S.wrap}">
      <h1 style="${S.h1}">Muuvlink — spor arkadaşı bul, takım kur, etkinliğe katıl</h1>
      <p style="${S.lead}">${esc(faq[0].a)}</p>
      <ul style="${S.nav}">
        <li><a style="${S.a}" href="${ORIGIN}/antrenmanlar">Etkinlikler</a></li>
        <li><a style="${S.a}" href="${ORIGIN}/takimlar">Takımlar</a></li>
        <li><a style="${S.a}" href="${ORIGIN}/iletisim">İletişim</a></li>
      </ul>
      <h2 style="${S.h2}">${esc(tr('faq.title'))}</h2>
${faq.map((f) => `      <h3 style="${S.q}">${esc(f.q)}</h3>\n      <p style="${S.ans}">${esc(f.a)}</p>`).join('\n')}
    </div>
`;

// ── 2. Şema (FAQPage + Organization) ───────────────────────────────────────
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${ORIGIN}/#organization`,
      name: 'Muuvlink',
      url: ORIGIN,
      logo: `${ORIGIN}/icons/favicon.png`,
      description: faq[0].a,
      sameAs: ['https://apps.apple.com/app/id6781591672'],
    },
    {
      '@type': 'FAQPage',
      '@id': `${ORIGIN}/#faq`,
      inLanguage: 'tr',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

const schemaBlock = `
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2).split('\n').map((l) => '  ' + l).join('\n')}
  </script>
`;

// ── 3. index.html'e yaz ────────────────────────────────────────────────────
const replaceRegion = (html, name, body) => {
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*?(<!-- ${name}:END -->)`);
  if (!re.test(html)) throw new Error(`index.html içinde ${name} işaretleri bulunamadı`);
  return html.replace(re, (_, a, b) => `${a}${body}  ${b}`);
};

let html = fs.readFileSync(FILE, 'utf8');
html = replaceRegion(html, 'SEO-SCHEMA', schemaBlock);
html = replaceRegion(html, 'SEO-TEXT', textBlock);
fs.writeFileSync(FILE, html);

const words = faq.map((f) => `${f.q} ${f.a}`).join(' ').split(/\s+/).length;
console.log(`[seo-static] index.html güncellendi — ${faq.length} soru, ~${words} kelime görünür metin.`);
