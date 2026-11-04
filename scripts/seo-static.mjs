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
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translations, LANGUAGES, COMPANY, companyLine } from '../i18n.js';

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

// ── Backend'in okuyacağı içerik dosyası ────────────────────────────────────
// backend-api.js bunu dist/seo-content.json olarak okur (index.html ile aynı
// klasör), böylece frontend deploy'u içeriği de taşır — ayrı adım yok.
const LANGS = LANGUAGES.map((l) => l.code); // tek kaynak: i18n.js LANGUAGES
const pick = (key, lang) => {
  const node = key.split('.').reduce((o, k) => (o ? o[k] : undefined), translations);
  if (!node || !node[lang]) throw new Error(`i18n anahtarı yok: ${key}.${lang}`);
  return node[lang];
};
const content = { faq: {}, seo: {}, sports: {}, guide: {}, about: {}, company: { ...COMPANY, line: companyLine() } };
// Hakkımızda (i18n.js `about`): sayfa AboutPage.jsx, bot metni backend seoAboutText.
const aboutOf = (l) => ({
  nav: pick('about.nav', l), title: pick('about.title', l), lead: pick('about.lead', l), metaDesc: pick('about.metaDesc', l),
  who: { title: pick('about.who.title', l), body: pick('about.who.body', l) },
  why: { title: pick('about.why.title', l), body: pick('about.why.body', l) },
  what: { title: pick('about.what.title', l), items: [1, 2, 3, 4, 5].map((n) => pick(`about.what.i${n}`, l)), after: pick('about.what.after', l) },
  care: { title: pick('about.care.title', l), items: [1, 2, 3, 4].map((n) => ({ label: pick(`about.care.p${n}.label`, l), text: pick(`about.care.p${n}.text`, l) })) },
  contact: { title: pick('about.contact.title', l), body: pick('about.contact.body', l) },
});
// Rehber (i18n.js `guide`): g1…g6, adımlar s1…sN, isteğe bağlı note. Sayfa (GuidePage.jsx) ve
// backend seoGuideText aynı metni okur.
const guideOf = (l) => ({
  nav: pick('guide.nav', l), title: pick('guide.title', l), metaTitle: pick('guide.metaTitle', l), metaDesc: pick('guide.metaDesc', l), lead: pick('guide.lead', l),
  guides: [1, 2, 3, 4, 5, 6].map((n) => {
    const g = translations.guide[`g${n}`];
    const steps = [];
    for (let i = 1; g[`s${i}`]; i++) steps.push(pick(`guide.g${n}.s${i}`, l));
    return { title: pick(`guide.g${n}.title`, l), sum: pick(`guide.g${n}.sum`, l), steps, note: g.note ? pick(`guide.g${n}.note`, l) : null };
  }),
});
for (const l of LANGS) {
  // Spor dalı adları DB'de Türkçe duruyor; bot sayfalarında dilin karşılığı yazılsın.
  content.sports[l] = Object.fromEntries(Object.entries(translations.sports).map(([k, v]) => [k, v[l] || v.en || k]));
  content.faq[l] = [1, 2, 3, 4, 5, 6].map((n) => ({ q: pick(`faq.q${n}`, l), a: pick(`faq.a${n}`, l) }));
  content.faq[l].title = pick('faq.title', l);
  content.seo[l] = Object.fromEntries(Object.keys(translations.seo).map((k) => [k, pick(`seo.${k}`, l)]));
  content.seo[l].faqTitle = pick('faq.title', l);
  content.guide[l] = guideOf(l);
  content.seo[l].navGuide = content.guide[l].nav;
  content.about[l] = aboutOf(l);
  content.seo[l].navAbout = content.about[l].nav;
  content.seo[l].contactFaqTitle = pick('contact.faqTitle', l); // iletişim sayfasındaki SSS başlığı
  // Ana sayfa meta açıklaması: uygulamanın kendi ana sayfasıyla aynı metin (PAGE_META home).
  content.seo[l].homeDesc = pick('home.heroSubtitleFallback', l);
}

// ── Güncelleme tarihleri (şemada dateModified) ─────────────────────────────
// Derleme günü DEĞİL: metin gerçekten değiştiği gün. Her sayfa+dil için metnin
// özeti scripts/seo-dates.json'da tutulur; özet değişirse tarih bugüne (İstanbul)
// çekilir. Dosya repoya girer — build sonrası değiştiyse commit'lenir.
// Liste sayfalarının (etkinlikler, takımlar) tarihi backend'de, kayıtlardan gelir.
{
  const DATES_FILE = path.join(ROOT, 'scripts', 'seo-dates.json');
  const prev = fs.existsSync(DATES_FILE) ? JSON.parse(fs.readFileSync(DATES_FILE, 'utf8')) : {};
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const hash = (x) => crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 16);
  const S0 = (l) => content.seo[l];
  const parts = {
    home: (l) => [content.faq[l], content.faq[l].title, S0(l).homeH1],
    contact: (l) => [S0(l).contactH1, S0(l).contactLead, S0(l).contactSub, S0(l).contactTopics,
      S0(l).contactTitle, S0(l).contactDesc, S0(l).contactFaqTitle, content.faq[l]],
    guide: (l) => [content.guide[l]],
    about: (l) => [content.about[l], content.company],
  };
  const next = {};
  content.dates = {};
  for (const [page, fn] of Object.entries(parts)) {
    content.dates[page] = {};
    for (const l of LANGS) {
      const key = `${page}.${l}`;
      const h = hash(fn(l));
      next[key] = prev[key]?.hash === h ? prev[key] : { hash: h, date: today };
      content.dates[page][l] = next[key].date;
    }
  }
  if (JSON.stringify(next) !== JSON.stringify(prev)) fs.writeFileSync(DATES_FILE, JSON.stringify(next, null, 2) + '\n');
}
fs.writeFileSync(path.join(ROOT, 'public', 'seo-content.json'), JSON.stringify(content, null, 2));


// ── llms.txt (llmstxt.org) ─────────────────────────────────────────────────
// Yapay zeka araçlarının siteyi tek dosyada okuması için düz metin özet. Metin
// yine i18n.js'ten (faq + seo); burada cümle yazılmaz. Türkçe + İngilizce:
// soru-cevap motorları çoğunlukla İngilizce sorguyla da bakıyor.
{
  const lines = [
    '# Muuvlink', '',
    `> ${pick('faq.a1', 'tr')}`, '',
    `> ${pick('faq.a1', 'en')}`, '',
    `- [${pick('seo.navHome', 'tr')}](${ORIGIN}/)`,
    `- [${pick('seo.navEvents', 'tr')}](${ORIGIN}/etkinlikler)`,
    `- [${pick('seo.navTeams', 'tr')}](${ORIGIN}/takimlar)`,
    `- [${pick('seo.navContact', 'tr')}](${ORIGIN}/iletisim)`,
    `- [${pick('guide.title', 'tr')}](${ORIGIN}/rehber)`,
    `- [${pick('guide.title', 'en')}](${ORIGIN}/en/guide)`,
    `- [${pick('about.title', 'tr')}](${ORIGIN}/hakkimizda)`,
    `- [${pick('about.title', 'en')}](${ORIGIN}/en/about)`,
    ...LANGUAGES.filter((l) => l.code !== 'tr').map((l) => `- [Muuvlink · ${l.label || l.name || l.code}](${ORIGIN}/${l.code})`),
    `- [Sitemap](${ORIGIN}/sitemap.xml)`, '',
  ];
  for (const l of ['tr', 'en']) {
    lines.push(`## ${pick('faq.title', l)}`, '');
    for (let n = 1; n <= 6; n++) lines.push(`### ${pick(`faq.q${n}`, l)}`, '', pick(`faq.a${n}`, l), '');
  }
  // Nasıl yapılır rehberleri (aynı metin /rehber ve /en/guide sayfasında)
  for (const l of ['tr', 'en']) {
    const g = guideOf(l);
    lines.push(`## ${g.title}`, '', g.lead, '');
    for (const x of g.guides) {
      lines.push(`### ${x.title}`, '', x.sum, '', ...x.steps.map((st, i) => `${i + 1}. ${st}`), '');
      if (x.note) lines.push(x.note, '');
    }
  }
  fs.writeFileSync(path.join(ROOT, 'public', 'llms.txt'), lines.join('\n'));
}

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
        <li><a style="${S.a}" href="${ORIGIN}/etkinlikler">Etkinlikler</a></li>
        <li><a style="${S.a}" href="${ORIGIN}/takimlar">Takımlar</a></li>
        <li><a style="${S.a}" href="${ORIGIN}/rehber">${esc(tr('guide.nav'))}</a></li>
        <li><a style="${S.a}" href="${ORIGIN}/hakkimizda">${esc(tr('about.nav'))}</a></li>
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
      // Sosyal hesaplar: SocialLinks.jsx ile aynı liste.
      sameAs: [
        'https://apps.apple.com/app/id6781591672',
        'https://play.google.com/store/apps/details?id=app.muuvlink',
        'https://www.instagram.com/muuvlinkapp/',
        'https://www.tiktok.com/@muuvlink',
        'https://www.youtube.com/@Muuvlink',
        'https://www.facebook.com/muuvlink',
        'https://www.threads.com/@muuvlinkapp',
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${ORIGIN}/#faq`,
      inLanguage: 'tr',
      dateModified: content.dates.home.tr,
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

// Ana sayfa için hreflang. Alt sayfalarda backend kendi karşılıklarını basar.
const hreflangBlock = `
${LANGS.map((l) => `  <link rel="alternate" hreflang="${l}" href="${ORIGIN}${l === 'tr' ? '/' : `/${l}`}">`).join('\n')}
  <link rel="alternate" hreflang="x-default" href="${ORIGIN}/">
`;

let html = fs.readFileSync(FILE, 'utf8');
html = replaceRegion(html, 'SEO-HREFLANG', hreflangBlock);
html = replaceRegion(html, 'SEO-SCHEMA', schemaBlock);
html = replaceRegion(html, 'SEO-TEXT', textBlock);
// Türkçe ana sayfanın <title> ve açıklaması da aynı kaynaktan (botlara giden dil sayfalarıyla eş).
html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(tr('seo.homeTitle'))}</title>`)
  .replace(/(<meta name="description" content=")[^"]*(">)/, (_, a, b) => `${a}${esc(tr('home.heroSubtitleFallback'))}${b}`);
fs.writeFileSync(FILE, html);

const words = faq.map((f) => `${f.q} ${f.a}`).join(' ').split(/\s+/).length;
console.log(`[seo-static] index.html güncellendi — ${faq.length} soru, ~${words} kelime görünür metin.`);
console.log(`[seo-static] public/seo-content.json yazıldı — ${LANGS.join(', ')}.`);
console.log('[seo-static] public/llms.txt yazıldı.');
