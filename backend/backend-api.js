// Muuvlink Backend API - FULL VERSION
require('dotenv').config();
// Render'da IPv6 üzerinden SMTP bağlantısı çalışmıyor — IPv4 öncelikli yap
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Bu sunucunun ağ katmanında DNS sorguları (UDP) ara ara kayboluyor. Çözümleme
// başarısız olduğunda veritabanı ve mail bağlantıları komple düşüyor, kullanıcıya
// 500 olarak yansıyordu (27.07.2026'da gün içinde defalarca yaşandı).
//
// Çözülen adresleri önbelleğe alır ve sorgu başarısız olursa SON BİLİNEN adresi
// kullanır. Geçici DNS kesintileri böylece kullanıcıya yansımaz. Kalıcı çözüm
// değil — altyapı kaynaklı kararsızlığı maskeler.
const DNS_CACHE_TTL_MS = 5 * 60 * 1000;
const dnsCache = new Map();
const nativeLookup = dns.lookup.bind(dns);

dns.lookup = function cachedLookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (typeof options === 'number') { options = { family: options }; }
  options = options || {};

  // all:true farklı bir dönüş şekli kullanıyor — önbelleğe karışmadan geç
  if (options.all) return nativeLookup(hostname, options, callback);

  const key = `${hostname}|${options.family || 0}`;
  const cached = dnsCache.get(key);

  if (cached && Date.now() - cached.at < DNS_CACHE_TTL_MS) {
    return process.nextTick(() => callback(null, cached.address, cached.family));
  }

  nativeLookup(hostname, options, (err, address, family) => {
    if (err) {
      if (cached) {
        console.warn(`[DNS] ${hostname} çözümlenemedi (${err.code || err.message}), önbellekteki adres kullanılıyor`);
        return callback(null, cached.address, cached.family);
      }
      return callback(err);
    }
    dnsCache.set(key, { address, family, at: Date.now() });
    callback(null, address, family);
  });
};
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const apn = require('apn');
const tzLookup = require('tz-lookup');

// Kritik env var kontrolü — eksikse başlatma
if (!process.env.JWT_SECRET) {
  console.error('HATA: JWT_SECRET env var tanımlı değil.');
  process.exit(1);
}
// DB: PGHOST, DATABASE_URL veya DB_PASSWORD'dan biri olmalı
if (!process.env.PGHOST && !process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
  console.error('HATA: PGHOST, DATABASE_URL veya DB_PASSWORD env var tanımlı değil.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // nginx arkasında çalışıyoruz, X-Forwarded-For'a güven
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// CORS — sadece muuvlink.app'e izin ver
app.use(cors({
  origin: [
    'https://muuvlink.app',
    'https://www.muuvlink.app',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3000'] : []),
  ],
  credentials: true,
}));

// Kullanıcıya dönen hata/bilgi mesajlarını isteğin diline çevir (X-Muuv-Lang).
// Sözlük ve fonksiyon aşağıda (SERVER_MSG); kapanış istek anında çözülür.
app.use((req, res, next) => translateServerMessages(req, res, next));

// Helmet — güvenlik HTTP header'ları
app.use(helmet({
  contentSecurityPolicy: false, // SPA için devre dışı, nginx seviyesinde yönetilecek
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 20,                   // 15 dk'da max 20 deneme
  message: { error: 'Çok fazla istek. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 dakika
  max: 120,             // dakikada 120 istek
  message: { error: 'Çok fazla istek. Lütfen bir süre bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/uploads'), // statik dosyaları atla
});

app.use(generalLimiter);

// Dinamik API yanıtlarının browser tarafından cache'lenmesini engelle
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ── CANLI TRAFİK ─────────────────────────────────────────────────────────
// Admin panelindeki "Canlı" sekmesini besler. Tamamen BELLEKTE tutulur:
// veritabanına tek satır yazılmaz, istek başına maliyet bir dizi push'u kadardır.
// Sunucu yeniden başlarsa geçmiş sıfırlanır — bu bilinçli, kalıcı istatistik
// zaten activity_logs + /admin/analytics tarafında duruyor.
//
// GİZLİLİK: IP adresi hiçbir yerde saklanmıyor. Anonim ziyaretçiler, süreç
// ömrü boyunca geçerli rastgele bir tuzla hash'lenip 8 haneli takma ada
// dönüşüyor; süreç yeniden başladığında aynı ziyaretçi yeni bir ada düşer.
const LIVE_FEED_MAX = 400;
const LIVE_MINUTES = 60;
const LIVE_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const LIVE_DEDUPE_MS = 90 * 1000;   // aynı kişi + aynı eylem: 90 sn içinde tek satır

const live = {
  feed: [],            // en yeni en başta
  minutes: new Map(),  // dakika (epoch ms) -> { requests, visitors:Set, users:Set }
  presence: new Map(), // userId -> { ts, label }
  visitors: new Map(), // visitorHash -> { ts, label }
};
// Aynı tarayıcı hem üye hem misafir görünmesin: sayfa açılışındaki bazı genel
// içerik çağrıları (banner, haber, galeri, rozetler) token taşımıyor ve anonim
// düşüyordu — giriş yapmış kullanıcı her seferinde yanında bir "misafir" üretiyordu.
// Parmak izi bir kez token'lı bir istekle görüldüyse, o parmak izinden gelen
// token'sız istekler de aynı üyeye yazılır.
// Sınır: aynı IP + aynı User-Agent arkasındaki iki kişi tek parmak izine düşer
// (misafirlerde zaten öyleydi); bu durumda token'sız istekler son giriş yapan
// üyeye yazılır. İzleme paneli için kabul edilebilir bir yaklaşıklık.
const LIVE_HASH_OWNER_MS = 15 * 60 * 1000;
const liveHashOwner = new Map();    // visitorHash -> { userId, ts }
const liveUserNames = new Map();     // userId -> name (tembel doldurulur)
const liveEntityNames = new Map();   // "team:12" | "training:107" | "user:3" -> ad
const LIVE_VISITOR_SALT = crypto.randomBytes(16).toString('hex');
const liveVisitorId = (req) => crypto.createHash('sha256')
  .update(LIVE_VISITOR_SALT + (req.ip || '') + (req.headers['user-agent'] || ''))
  .digest('hex').slice(0, 8);

// Yol → insan diliyle eylem. null dönenler akışta gösterilmez (gürültü),
// ama trafik sayacına yine de girer.
const LIVE_RULES = [
  ['POST',   /^\/auth\/login$/,                     'giriş yaptı'],
  ['POST',   /^\/auth\/register$/,                  'kayıt oldu'],
  ['GET',    /^\/notifications\/stream$/,           'uygulamayı açtı'],
  // NOT: GET /trainings ve GET /teams akışta YOK. Bunlar sayfa ziyareti değil:
  // SPA açılışta ikisini birden çekiyor, ayrıca 60 saniyede bir ve sekme öne
  // gelince tazeliyor. Tek bir sayfa yenilemesi panelde "etkinlikleri gezdi +
  // takımları gezdi" diye görünüyordu — kullanıcı hiçbirine girmemiş olsa bile.
  // Sayfa ziyaretini artık SPA'nın kendisi /live/view ile bildiriyor.
  ['GET',    /^\/trainings\/\d+$/,                  'etkinlik detayına baktı'],
  ['POST',   /^\/trainings$/,                       'etkinlik oluşturdu'],
  ['POST',   /^\/trainings\/\d+\/join$/,            'etkinliğe katıldı'],
  ['DELETE', /^\/trainings\/\d+\/leave$/,           'etkinlikten ayrıldı'],
  ['POST',   /^\/trainings\/\d+\/comments$/,        'etkinliğe yorum yaptı'],
  ['POST',   /^\/trainings\/\d+\/register-click$/,  'yarış kayıt linkine tıkladı'],
  ['GET',    /^\/teams\/\d+$/,                      'takım sayfasına baktı'],
  ['POST',   /^\/teams$/,                           'takım kurdu'],
  ['POST',   /^\/teams\/\d+\/join$/,                'takıma katıldı'],
  ['POST',   /^\/teams\/\d+\/posts$/,               'takıma gönderi paylaştı'],
  ['GET',    /^\/users\/\d+$/,                      'profil görüntüledi'],
  ['POST',   /^\/integrations\/training-agents\/verify$/, 'Training Agents antrenmanı getirdi'],
  ['POST',   /^\/contact$/,                         'iletişim formu gönderdi'],
  ['POST',   /^\/report$/,                          'içerik şikayet etti'],
];

// SPA'nın bildirdiği sayfa → insan diliyle eylem. Detay sayfaları burada YOK;
// onlar /trainings/:id ve /teams/:id ile etkinliğin/takımın adıyla kaydediliyor.
const LIVE_PAGE_LABELS = {
  home:            'ana sayfayı açtı',
  trainings:       'etkinlikleri gezdi',
  teams:           'takımları gezdi',
  profile:         'profiline baktı',
  badges:          'rozetlerine baktı',
  contact:         'iletişim sayfasını açtı',
  'create-training': 'etkinlik oluşturuyor',
  'create-team':   'takım kuruyor',
  'not-found':     'olmayan bir adrese gitti',
};

function liveDescribe(method, p) {
  for (const [m, re, label] of LIVE_RULES) if (m === method && re.test(p)) return label;
  return null;
}

// ── İstemci sınıflandırma ──────────────────────────────────────────────
// Tek tablo: hem /api ara katmanı hem nginx günlüğü okuyucusu bunu kullanır.
// Sıra önemli: özel olan üstte (Applebot-Extended, Applebot'tan önce).
// Kategoriler: search (arama motoru) · ai (yapay zeka) · social (link önizleme)
// · monitor (izleme servisi) · seo (SEO tarayıcı) · scanner (zafiyet tarayıcı)
// · tool (betik / komut satırı) · other (adı bilinmeyen bot).
const LIVE_AGENTS = [
  // arama motorları
  [/googlebot|google-inspectiontool|googleother|storebot-google|adsbot-google|mediapartners-google/i, 'Googlebot', 'search'],
  [/google-extended/i,                       'Google-Extended (Gemini eğitim)', 'ai'],
  [/bingbot|adidxbot|bingpreview|microsoftpreview/i, 'Bingbot', 'search'],
  [/yandex(bot|images|mobilebot|accessibilitybot)/i, 'YandexBot', 'search'],
  [/applebot-extended/i,                     'Applebot-Extended (Apple AI eğitim)', 'ai'],
  [/applebot/i,                              'Applebot (Siri/Spotlight)', 'search'],
  [/duckduckbot|duckassistbot/i,             'DuckDuckBot', 'search'],
  [/baiduspider/i,                           'Baiduspider', 'search'],
  [/seznambot/i,                             'SeznamBot', 'search'],
  [/petalbot/i,                              'PetalBot (Huawei)', 'search'],
  [/qwantify|qwantbot/i,                     'Qwant', 'search'],
  [/sogou/i,                                 'Sogou', 'search'],
  [/amazonbot|amzn-searchbot/i,              'Amazonbot (Alexa)', 'search'],
  // yapay zeka — eğitim tarayıcısı / arama tarayıcısı / canlı sohbet getiricisi ayrı
  [/gptbot/i,                                'GPTBot (OpenAI eğitim)', 'ai'],
  [/oai-searchbot/i,                         'OAI-SearchBot (ChatGPT arama)', 'ai'],
  [/chatgpt-user/i,                          'ChatGPT-User (sohbette açıldı)', 'ai'],
  [/claude-searchbot/i,                      'Claude-SearchBot (Claude arama)', 'ai'],
  [/claude-user/i,                           'Claude-User (sohbette açıldı)', 'ai'],
  [/claudebot|claude-web|anthropic-ai/i,     'ClaudeBot (Anthropic eğitim)', 'ai'],
  [/perplexity-user/i,                       'Perplexity-User (sohbette açıldı)', 'ai'],
  [/perplexitybot/i,                         'PerplexityBot', 'ai'],
  [/meta-externalagent|meta-externalfetcher|facebookbot/i, 'Meta AI', 'ai'],
  [/bytespider|tiktokspider/i,               'Bytespider (ByteDance)', 'ai'],
  [/ccbot/i,                                 'CCBot (Common Crawl)', 'ai'],
  [/cohere-ai|ai2bot|omgili|diffbot|youbot|mistralai|timpibot|imagesiftbot/i, 'Diğer yapay zeka botu', 'ai'],
  // sosyal / mesajlaşma link önizlemeleri
  [/facebookexternalhit|facebot/i,           'Facebook önizleme', 'social'],
  [/whatsapp/i,                              'WhatsApp önizleme', 'social'],
  [/telegrambot/i,                           'Telegram önizleme', 'social'],
  [/twitterbot/i,                            'X (Twitter) önizleme', 'social'],
  [/linkedinbot/i,                           'LinkedIn önizleme', 'social'],
  [/slackbot|slack-imgproxy/i,               'Slack önizleme', 'social'],
  [/discordbot/i,                            'Discord önizleme', 'social'],
  [/pinterest/i,                             'Pinterest', 'social'],
  [/redditbot/i,                             'Reddit önizleme', 'social'],
  [/skypeuripreview|vkshare|embedly|iframely/i, 'Link önizleme', 'social'],
  // izleme / doğrulama servisleri
  [/uptimerobot/i,                           'UptimeRobot', 'monitor'],
  [/pingdom|statuscake|site24x7|betteruptime|better uptime|hetrixtools|freshping|checkly/i, 'İzleme servisi', 'monitor'],
  [/googleassociationservice/i,              'Google doğrulama', 'monitor'],
  [/playstore-google|google-play/i,          'Google Play (mağaza kontrolü)', 'monitor'],
  [/let's encrypt|letsencrypt|certbot/i,     "Let's Encrypt", 'monitor'],
  // SEO araçları
  [/semrushbot/i,                            'SemrushBot', 'seo'],
  [/ahrefsbot/i,                             'AhrefsBot', 'seo'],
  [/mj12bot|dotbot|dataforseobot|blexbot|barkrowler|serpstatbot|screaming frog|siteauditbot|seokicks|seznam/i, 'SEO tarayıcı', 'seo'],
  // zafiyet / internet tarayıcıları (UA alanına adres yazanlar da buraya düşer)
  [/wp-admin|wp-login|xmlrpc|zgrab|masscan|nmap|nikto|sqlmap|censys|shodan|internetmeasurement|expanse|paloalto|stretchoid|netcraft|nuclei|gobuster|dirbuster|l9explore|leakix/i, 'Zafiyet tarayıcı', 'scanner'],
  // betik / komut satırı / kütüphane
  [/curl\//i,                                'curl', 'tool'],
  [/wget/i,                                  'wget', 'tool'],
  [/python-requests|python-urllib|httpx|aiohttp|scrapy/i, 'Python', 'tool'],
  [/postman/i,                               'Postman', 'tool'],
  [/insomnia/i,                              'Insomnia', 'tool'],
  [/httpie/i,                                'HTTPie', 'tool'],
  [/okhttp|java\/|apache-httpclient/i,       'Java/OkHttp', 'tool'],
  [/go-http-client/i,                        'Go', 'tool'],
  [/node-fetch|axios\/|undici/i,             'Node', 'tool'],
  [/headlesschrome|puppeteer|playwright|phantomjs|selenium/i, 'Headless tarayıcı', 'tool'],
  [/libwww|lwp-trivial|php\/|guzzle/i,       'Betik', 'tool'],
];
// Yol tabanlı tespit: UA ne derse desin bu adresleri yoklayan bir insan değildir.
// Sitede .php/.asp/.jsp yok — bu uzantılara gelen her istek yoklamadır.
const LIVE_PROBE_PATH_RE = /^\/(wp-|wordpress|xmlrpc\.php|\.env|\.git|phpmyadmin|pma\b|admin\.php|cgi-bin|vendor\/phpunit|\.well-known\/(?!acme)|config\.(json|php|yml)|backup|\.aws|actuator|solr|console)|\.(php|asp|aspx|jsp|cgi)(\?|$)/i;
// Adı tabloda olmayan ama bot olduğu belli olanlar.
const LIVE_GENERIC_BOT_RE = /bot\b|crawler|spider|crawl|fetcher|scan|monitor|http-client|httpclient|libcurl|feed|validator|archive\.org|archiver/i;

// UA → { kind: 'bot'|'tool'|'browser'|'unknown', name, cat }
function liveClassifyAgent(ua) {
  const s = String(ua || '').trim();
  if (!s || s === '-') return { kind: 'unknown', name: 'UA boş', cat: 'other' };
  for (const [re, name, cat] of LIVE_AGENTS) {
    if (re.test(s)) return { kind: cat === 'tool' ? 'tool' : 'bot', name, cat };
  }
  if (LIVE_GENERIC_BOT_RE.test(s)) {
    // Adı yoksa UA'nın ilk parçasını göster ("SomeBot/1.2 (+http…)" → "SomeBot/1.2")
    const first = s.replace(/^Mozilla\/5\.0\s*\(?(compatible;)?\s*/i, '').split(/[;)(\s]+/)[0] || s;
    return { kind: 'bot', name: first.slice(0, 40), cat: 'other' };
  }
  if (/Mozilla\/|Opera|Safari\/|Chrome\/|Firefox\//i.test(s)) return { kind: 'browser', name: null, cat: null };
  // Tarayıcıya da bota da benzemeyen UA (özel istemci, kısaltılmış UA…)
  return { kind: 'unknown', name: s.split(/[;)(\s/]+/)[0].slice(0, 40) || 'Bilinmeyen', cat: 'other' };
}

// İstemci türü — User-Agent'tan. Sunucu günlüklerindeki gerçek trafiğe bakılarak yazıldı:
// Capacitor iOS (WKWebView) "Mobile/15E148" ile biter ve Safari/CriOS token'ı taşımaz;
// Capacitor Android (WebView) UA'sında "wv" işareti bulunur. Tarayıcılarda ikisi de vardır.
function livePlatform(ua) {
  const s = String(ua || '');
  if (!s) return 'unknown';
  const a = liveClassifyAgent(s);
  // Bot ve betik: normal/beklenen (Googlebot) ile dikkat çekici (curl ile kayıt
  // denemesi) ayrı sınıf. Claude-User, Perplexity-User gibi "Mozilla/5.0" ile
  // başlayan yapay zeka getiricileri de burada yakalanır; eski kural onları
  // masaüstü insan sayıyordu.
  if (a.kind === 'bot') return 'bot';
  if (a.kind === 'tool') return 'script';
  if (/;\s*wv\)/i.test(s)) return 'android-app';
  if (/iPhone|iPad|iPod/i.test(s)) {
    return (!/Safari\//.test(s) && !/CriOS\//.test(s) && !/FxiOS\//.test(s)) ? 'ios-app' : 'ios-web';
  }
  if (/Android/i.test(s)) return 'android-web';
  if (/Macintosh|Windows|X11|Linux/i.test(s)) return 'desktop';
  return 'unknown';
}

// Bot/betik ise adını çıkar — panelde "Bot" yerine "Googlebot" yazsın.
function liveClientName(ua) {
  const a = liveClassifyAgent(ua);
  return a.kind === 'browser' ? null : a.name;
}

// Bakılan kayıt: /teams/12 → { t:'team', id:12 }. İsimler okuma anında çözülür.
// Tarayıcı olmayan bir istemciden gelen kayıt/giriş denemesi — gerçek bir spam
// kaydı da tam bu imzayı taşır, akışta işaretlenip göze çarpsın.
const LIVE_AUTH_RE = /^\/auth\/(register|login|forgot-password|reset-password)$/;
const liveSuspicious = (p, plat) => LIVE_AUTH_RE.test(p) && ['bot', 'script', 'unknown'].includes(plat);

// ── Botlar: nginx erişim günlüğünden ─────────────────────────────────────
// NEDEN: Node yalnız /api isteklerini ve nginx'in ona yönlendirdiği birkaç bot
// sayfasını görür. İnsanlar statik index.html'i nginx'ten alır; botların asıl
// işi olan sayfa taraması (Googlebot /etkinlik/…, GPTBot /takimlar) çoğunlukla
// nginx'te biter ve Node'a hiç uğramaz. Yani "hangi botlar geliyor" sorusunun
// tek doğru kaynağı nginx günlüğüdür. Buradan yalnız bot/betik satırları
// alınır; insanlar uygulamanın kendi bildiriminden (/live/view + token) gelir —
// iki kaynak birbirine karışmaz.
//
// Maliyet: dosyanın son ~1,5 MB'ı okunur, 5 sn önbelleklenir. Panel açık
// değilken hiç okunmaz. IP saklanmaz; yalnız kaç farklı adres olduğu sayılır.
const NGINX_ACCESS_LOG = process.env.NGINX_ACCESS_LOG || '/var/log/nginx/access.log';
const LIVE_LOG_RE = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) \d+ "[^"]*" "([^"]*)"/;
const LIVE_LOG_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const liveLogTime = (t) => {
  const m = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(t);
  if (!m) return NaN;
  const utc = Date.UTC(+m[3], LIVE_LOG_MONTHS[m[2]] ?? 0, +m[1], +m[4], +m[5], +m[6]);
  const off = (+m[8] * 60 + +m[9]) * 60000;
  return m[7] === '+' ? utc - off : utc + off;
};
async function liveReadTail(file, bytes) {
  const fh = await fs.promises.open(file, 'r');
  try {
    const { size } = await fh.stat();
    const len = Math.min(size, bytes);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, size - len);
    const text = buf.toString('utf8');
    const lines = text.split('\n');
    if (len < size) lines.shift();   // ilk satır yarım kalmış olabilir
    return lines;
  } finally { await fh.close(); }
}
let liveBotCache = { ts: 0, data: null };
async function liveBotTraffic() {
  const now = Date.now();
  if (now - liveBotCache.ts < 5000 && liveBotCache.data) return liveBotCache.data;
  const cutoff = now - 60 * 60000;
  const agents = new Map();   // name -> özet
  const feed = [];
  let ok = true, error = null;
  try {
    let lines = await liveReadTail(NGINX_ACCESS_LOG, 1.5 * 1024 * 1024);
    // Günlük az önce döndüyse son saat bir önceki dosyada da olabilir.
    const firstTs = lines.map((l) => LIVE_LOG_RE.exec(l)).find(Boolean);
    if (firstTs && liveLogTime(firstTs[2]) > cutoff) {
      try { lines = (await liveReadTail(NGINX_ACCESS_LOG + '.1', 512 * 1024)).concat(lines); } catch { /* yoksa geç */ }
    }
    for (const line of lines) {
      const m = LIVE_LOG_RE.exec(line);
      if (!m) continue;
      const ts = liveLogTime(m[2]);
      if (!(ts >= cutoff)) continue;
      const [, ip, , method, path, status, ua] = m;
      let a = liveClassifyAgent(ua);
      if (LIVE_PROBE_PATH_RE.test(path)) a = { kind: 'bot', name: 'Zafiyet tarayıcı', cat: 'scanner' };
      if (a.kind === 'browser') continue;            // insanlar uygulamadan sayılır
      let rec = agents.get(a.name);
      if (!rec) { rec = { name: a.name, cat: a.cat, hits60: 0, hits5: 0, lastTs: 0, lastPath: null, paths: [], ips: new Set() }; agents.set(a.name, rec); }
      rec.hits60++;
      if (ts >= now - 5 * 60000) rec.hits5++;
      rec.ips.add(ip);
      if (ts >= rec.lastTs) { rec.lastTs = ts; rec.lastPath = path; }
      if (!rec.paths.includes(path) && rec.paths.length < 6) rec.paths.push(path);
      feed.push({ ts, name: a.name, cat: a.cat, method, path, status: +status });
    }
  } catch (e) {
    ok = false; error = e.code === 'ENOENT' ? 'Günlük dosyası bulunamadı' : e.code === 'EACCES' ? 'Günlük okunamadı (izin)' : e.message;
  }
  feed.sort((x, y) => y.ts - x.ts);
  const list = [...agents.values()]
    .map((r) => ({ ...r, ips: r.ips.size }))
    .sort((x, y) => y.hits60 - x.hits60);
  const data = {
    ok, error, list, feed: feed.slice(0, 40),
    totals: {
      agents5: list.filter((r) => r.hits5 > 0).length,
      hits5: list.reduce((n, r) => n + r.hits5, 0),
      hits60: list.reduce((n, r) => n + r.hits60, 0),
    },
  };
  liveBotCache = { ts: now, data };
  return data;
}

// Giriş/kayıt başarılı olunca çağrılır. İstek geldiğinde kullanıcı henüz
// belli değildi: akışa "Misafir 727a9936 giriş yaptı" diye düşüyor ve öyle
// kalıyordu. Burada o satır(lar) üyeye çevrilir, misafir kaydı üye kaydına
// taşınır; aynı parmak izinden gelen sonraki token'sız istekler de üyeye yazılır.
function liveClaim(req, userId) {
  try {
    const now = Date.now();
    const vid = liveVisitorId(req);
    liveHashOwner.set(vid, { userId, ts: now });
    for (const f of live.feed) {
      if (now - f.ts > 60000) break;              // akış en yeniden eskiye sıralı
      if (f.vid === vid && LIVE_AUTH_RE.test(f.path)) { f.userId = userId; f.vid = null; }
    }
    const v = live.visitors.get(vid);
    if (v) {
      live.visitors.delete(vid);
      live.presence.set(userId, { ts: now, plat: v.plat, label: v.label || null, entity: null });
    }
  } catch { /* izleme asla akışı bozmasın */ }
}

const LIVE_ENTITY_RE = /^\/(teams|trainings|users)\/(\d+)/;
function liveEntity(p) {
  const m = LIVE_ENTITY_RE.exec(p);
  if (!m) return null;
  return { t: { teams: 'team', trainings: 'training', users: 'user' }[m[1]], id: Number(m[2]) };
}

app.use('/api', (req, res, next) => {
  try {
    const p = req.path;
    // Admin panelinin kendi trafiği ve sağlık kontrolü sayılmaz — yoksa panel
    // açık dururken grafik kendi isteklerini çizer.
    if (p.startsWith('/admin') || p === '/health') return next();

    const now = Date.now();
    const minute = Math.floor(now / 60000) * 60000;
    let bucket = live.minutes.get(minute);
    if (!bucket) { bucket = { requests: 0, visitors: new Set(), users: new Set() }; live.minutes.set(minute, bucket); }
    bucket.requests++;

    // Kullanıcıyı token'dan çöz (DB'ye gitmeden). Token yoksa anonim.
    let userId = null;
    const auth = req.headers['authorization'];
    const token = (auth && auth.split(' ')[1]) || req.query?.token;
    if (token) {
      try { userId = jwt.verify(token, JWT_SECRET)?.id ?? null; } catch { userId = null; }
    }
    // Parmak izi her istekte hesaplanır: token'lı isteklerde sahibini öğrenmek,
    // token'sızlarda sahibini aramak için.
    const vid = liveVisitorId(req);
    if (userId) {
      liveHashOwner.set(vid, { userId, ts: now });
    } else {
      const owner = liveHashOwner.get(vid);
      if (owner && now - owner.ts <= LIVE_HASH_OWNER_MS) userId = owner.userId;
    }
    const plat = livePlatform(req.headers['user-agent']);
    // Botlar istek sayısına girer (gerçek yük) ama misafir sayılmaz — sayıyı şişirirler.
    if (userId) bucket.users.add(userId);
    else if (plat !== 'bot' && plat !== 'script') bucket.visitors.add(vid);
    // NOT: userId doluysa vid hiçbir misafir yapısına yazılmaz (aşağıda da).

    const label = p === '/live/view'
      ? (LIVE_PAGE_LABELS[String(req.query?.p || '')] || null)
      : liveDescribe(req.method, p);
    const entity = liveEntity(p);
    const client = (plat === 'bot' || plat === 'script') ? liveClientName(req.headers['user-agent']) : null;
    if (userId) {
      const prev = live.presence.get(userId);
      live.presence.set(userId, { ts: now, plat, label: label || prev?.label || null, entity: entity || (label ? null : prev?.entity) || null });
    } else {
      const prev = live.visitors.get(vid);
      live.visitors.set(vid, { ts: now, plat, client, label: label || prev?.label || null });
    }

    if (label) {
      // Aynı kişinin aynı eylemi kısa aralıkla tekrar etmesi tek satır sayılır.
      // Sayfa açıkken 60 saniyede bir tazeleme ve sekmeye geri dönüş, aynı
      // etkinliğin detayını arka arkaya kaydediyordu.
      const actor = userId ? `u${userId}` : `v${vid}`;
      const dup = live.feed.find((f) =>
        (f.userId ? `u${f.userId}` : `v${f.vid}`) === actor &&
        f.label === label && f.entity === entity && now - f.ts < LIVE_DEDUPE_MS);
      let entry = dup;
      if (!dup) {
        entry = { ts: now, userId, vid: userId ? null : vid, label, path: p, plat, entity, client, suspicious: liveSuspicious(p, plat) };
        live.feed.unshift(entry);
        if (live.feed.length > LIVE_FEED_MAX) live.feed.length = LIVE_FEED_MAX;
      } else {
        dup.ts = now;
      }
      // Etiket isteğin ADRESİNDEN gelir; sonucu ancak cevap bitince belli olur.
      // Reddedilen istek "takıma katıldı" diye görünmesin (5 Ekim 2026: süresi
      // dolmuş oturumla iki kez 403 alan misafir "katıldı" görünüyordu).
      res.on('finish', () => { entry.status = res.statusCode; });
    }
  } catch { /* izleme asla isteği bozmasın */ }
  next();
});

// Eski kayıtları temizle (dakikada bir)
setInterval(() => {
  const cutoffMinute = Math.floor((Date.now() - LIVE_MINUTES * 60000) / 60000) * 60000;
  for (const k of live.minutes.keys()) if (k < cutoffMinute) live.minutes.delete(k);
  const cutoff = Date.now() - 30 * 60000;
  for (const [k, v] of live.presence) if (v.ts < cutoff) live.presence.delete(k);
  for (const [k, v] of live.visitors) if (v.ts < cutoff) live.visitors.delete(k);
  for (const [k, v] of liveHashOwner) if (v.ts < cutoff) liveHashOwner.delete(k);
  const feedCutoff = Date.now() - 60 * 60000;
  live.feed = live.feed.filter((f) => f.ts >= feedCutoff);
}, 60000).unref?.();

app.use(express.json({ limit: '2mb' }));

// Statik dosyalar (upload edilen görseller)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer: banner görselleri için
// Multer: memory storage — dosyalar Supabase Storage'a yüklenir, diske yazılmaz
const uploadBanner = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|gif|webp|svg)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Sadece görsel dosyaları yüklenebilir.'));
  },
});
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Sadece PNG/JPEG/GIF/WEBP yüklenebilir.'));
  },
});

// Supabase Storage client (avatar & banner upload için)
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const ws = require('ws');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      realtime: { transport: ws },
    });
  }
} catch (e) {
  console.warn('Supabase client başlatılamadı:', e.message);
}

// Görsel buffer'ını WebP'ye dönüştür ve boyutlandır
async function toWebP(buffer, maxWidth = 1920) {
  try {
    return await sharp(buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return buffer; // dönüşüm başarısız olursa orijinali kullan
  }
}

// Supabase Storage REST API — native fetch ile (Node 18+)
async function uploadToSupabase(bucket, fileName, buffer, mimetype) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase yapılandırılmadı.');
  }
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeType = (mimetype || 'application/octet-stream').split(';')[0].trim();
  const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${safeName}`;
  process.stdout.write(`[Supabase] POST ${uploadUrl} type=${safeType} size=${buffer.length} keyLen=${process.env.SUPABASE_SERVICE_KEY.length}\n`);
  const resp = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': safeType,
      'x-upsert': 'true',
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  });
  const text = await resp.text();
  process.stdout.write(`[Supabase] status=${resp.status} body=${text}\n`);
  if (!resp.ok) {
    let msg = text;
    try { msg = JSON.parse(text)?.message || JSON.parse(text)?.error || text; } catch {}
    throw new Error(msg);
  }
  const publicUrl = `${baseUrl}/storage/v1/object/public/${bucket}/${safeName}`;
  process.stdout.write(`[Supabase] publicUrl=${publicUrl}\n`);
  return publicUrl;
}

// DB bağlantısı: ayrı env var'lar öncelikli (şifredeki özel karakterler sorun çıkarmaz)
// Render/Supabase için: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD set edin
// connectionTimeoutMillis: yeni bağlantı kurulamazsa sonsuza kadar beklemek yerine hata dön.
// idleTimeoutMillis: boşta bekleyen bağlantıları pool'da tutmayıp serbest bırak (leak önleme).
// connectionTimeoutMillis kısa tutulur: bağlantı kurulamıyorsa hızlıca pes edip
// tekrar denemek, kullanıcıyı 20+ saniye bekletmekten iyidir (retry ile birlikte
// en kötü durum ~11sn). Uzun bekleme, kullanıcının butona tekrar basmasına yol açıyordu.
//
// idleTimeoutMillis 10 dk (eskiden 30 sn) + TCP keepalive — 7 Eylül 2026:
// Sunucudan Supabase eu-west-1 havuzuna YENİ bağlantı kurmak 3 Eylül'den beri
// günde birkaç kez 15 sn–6 dk boyunca takılıyor (yol sorunu; havuz ve Postgres
// günlükleri temiz). 30 sn'de kapanan bağlantılar seyrek trafikte her isteği yeni
// el sıkışmaya zorluyordu, yani her istek bu riske giriyordu. Açık bağlantı
// takılan dakikada da çalışmaya devam eder; sıcak tutmak maruziyeti düşürür.
// 10 boş bağlantı Supabase sınırının (60) çok altında.
const POOL_TIMEOUTS = {
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10 * 60 * 1000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

const pool = process.env.PGHOST
  ? new Pool({
      host:     process.env.PGHOST,
      port:     parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE || 'postgres',
      user:     process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl:      { rejectUnauthorized: false },
      ...POOL_TIMEOUTS,
    })
  : process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, ...POOL_TIMEOUTS })
    : new Pool({
        user:     process.env.DB_USER     || 'postgres',
        host:     process.env.DB_HOST     || 'localhost',
        database: process.env.DB_NAME     || 'sporlaconnect',
        password: process.env.DB_PASSWORD,
        port:     parseInt(process.env.DB_PORT || '5432'),
        ...POOL_TIMEOUTS,
      });

// Her yeni bağlantıda timezone'u Europe/Istanbul olarak sabitle.
// Uygulama Türkiye saatinde çalışıyor: training_time girişleri yerel saat,
// CURRENT_TIME/CURRENT_DATE karşılaştırmaları da İstanbul saatiyle tutarlı olmalı.
// statement_timeout: tek bir sorgu takılırsa (kilit, network vb.) 15sn sonra Postgres
// sorguyu otomatik iptal etsin — bağlantı sonsuza kadar askıda kalmasın.
pool.on('connect', async client => {
  await client.query("SET search_path TO public").catch(() => {});
  await client.query("SET timezone = 'Europe/Istanbul'").catch(() => {});
  await client.query("SET statement_timeout = 15000").catch(() => {});
});

// Bu sunucunun ağ katmanında yeni TCP/TLS bağlantısı kurmak ARALIKLI olarak
// başarısız oluyor (PMTU kaynaklı; MSS clamp ile azaltıldı ama tamamen bitmedi).
// Tek bir başarısız bağlantı, işlemin ortasında kullanıcıya 500 olarak yansıyordu.
//
// Sadece BAĞLANTI KURULAMADAN başarısız olan sorgular tekrarlanır: sorgu sunucuya
// hiç ulaşmadığı için tekrar etmek yan etki üretmez. Sorgu gönderildikten sonra
// kopan bağlantılar ("Connection terminated unexpectedly" vb.) bilerek KAPSAM DIŞI —
// onları tekrarlamak çift kayıt oluşturabilir.
// İki yeniden deneme (300 ms, 1 sn): takılmalar çoğunlukla 15–40 sn sürüyor ama
// tek bir el sıkışma 3 sn'de pes ediyor; üç deneme (~11 sn) kısa dalgaların
// çoğunu kullanıcıya göstermeden geçirir. Uzun dalgalar yine hata döner.
const DB_CONNECT_FAILED = /timeout exceeded when trying to connect|Connection terminated due to connection timeout/i;
const DB_RETRY_DELAYS_MS = [300, 1000];
const rawPoolQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rawPoolQuery(...args);
    } catch (err) {
      if (!DB_CONNECT_FAILED.test(err?.message || '') || attempt >= DB_RETRY_DELAYS_MS.length) throw err;
      console.warn(`[DB] Bağlantı kurulamadı, tekrar deneniyor (${attempt + 1}/${DB_RETRY_DELAYS_MS.length}):`, err.message);
      await new Promise(r => setTimeout(r, DB_RETRY_DELAYS_MS[attempt]));
    }
  }
};

// Etkinliği oluşturma/düzenleme/silme yetkisi olan takım rolleri.
// Tek yerden yönetilir ki üç işlem arasında yeniden ayrışmasın.
// ('admin' sistemde kullanılmıyor ama elle atanmış olma ihtimaline karşı korunuyor.)
const TRAINING_MANAGER_ROLES = ['owner', 'coach', 'captain', 'editor', 'admin'];

// Davet gönderme / bekleyen davetleri görme yetkisi olan roller.
const INVITE_MANAGER_ROLES = ['owner', 'coach', 'editor'];

// Bireysel (takımsız) etkinliklerde, takım adı yerine oluşturanın adı gösterilir.
// Gizlilik için tam ad değil; ad ve soyadın yalnızca ilk ikişer harfi (ör. "Melih Önyer" → "Me Ön").
function maskCreatorName(full) {
  if (!full || !full.trim()) return null;
  const parts = full.trim().split(/\s+/);
  const two = s => [...s].slice(0, 2).join('');
  return parts.length === 1 ? two(parts[0]) : `${two(parts[0])} ${two(parts[parts.length - 1])}`;
}

// Etkinlik satırlarına bireysel-oluşturan görünen adını ekle, ham ad alanını gizle.
function attachCreatorDisplay(rows) {
  for (const r of rows) {
    if (!r.team_id) r.creator_display = maskCreatorName(r.creator_name);
    delete r.creator_name;
  }
  return rows;
}

// Editör, takım sahibiyle (owner) aynı yönetim yetkilerine sahiptir; yalnızca
// takımı SİLMEK ve takım sahibinin rolüne dokunmak sahibe özeldir.
// Sahiplik, teams.owner_id ile takip edilir; editörlük ise team_members.role='editor'.
// Platform admini mi? (users.is_admin — panelden yönetilir)
async function isPlatformAdmin(userId) {
  if (!userId) return false;
  const r = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  return r.rows[0]?.is_admin === true;
}

async function canManageTeam(teamId, userId) {
  // Yetki: asıl sahip, editör/co-owner, VEYA takıma üye olan platform admini.
  const r = await pool.query(
    `SELECT 1 FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $2
       LEFT JOIN users u ON u.id = $2
      WHERE t.id = $1 AND (
        t.owner_id = $2
        OR tm.role IN ('editor','owner')
        OR (u.is_admin = true AND tm.user_id IS NOT NULL)
      )
      LIMIT 1`,
    [teamId, userId]
  );
  return r.rows.length > 0;
}

// Etkinliğin koordinatından IANA saat dilimini bulur (ör. "Europe/Berlin").
// Uygulama yurtdışında da kullanıldığı için "geçti mi / yaklaşıyor mu" hesabı
// etkinliğin YEREL saatine göre yapılmalı — training_datetime_utc bunun için var.
// Koordinat yoksa veya çözülemezse Türkiye varsayılır (mevcut davranışla uyumlu).
const resolveTrainingTimezone = (lat, lng) => {
  const la = parseFloat(lat);
  const ln = parseFloat(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return 'Europe/Istanbul';
  try {
    return tzLookup(la, ln) || 'Europe/Istanbul';
  } catch {
    return 'Europe/Istanbul';
  }
};

// Etkinliğin başlangıç anını UTC olarak veren SQL ifadesi.
// Normalde training_datetime_utc doludur (trigger hesaplar); henüz doldurulmamış
// eski kayıtlar için tarih+saat'i saat dilimiyle anında çevirerek güvenli fallback sağlar.
const trainingUtcExpr = (alias = 't') => {
  const p = alias ? `${alias}.` : '';
  return `COALESCE(${p}training_datetime_utc, (${p}training_date + ${p}training_time) AT TIME ZONE COALESCE(NULLIF(${p}training_timezone, ''), 'Europe/Istanbul'))`;
};

// Etkinliğin başlangıç anı geçti mi?
//
// NEDEN: liste uçları geçmiş etkinlikleri eler, ama DETAY sayfası eler değil —
// eski bir bildirim ("Yeni Etkinlik!"), paylaşılmış bir link, e-posta ya da
// tarayıcı geçmişi üzerinden geçmiş bir etkinliğin sayfası açılabiliyor.
// Sayfa açılabilmeli (arşiv), ama üzerine yazı yazılmamalı: katılım geçmiş
// etkinlik sayacına ve rozetlere işliyor.
// Yanıtta code:'training_past' da döner — arayüz uyarıyı kullanıcının dilinde gösterir.
const PAST_TRAINING_MSG = 'Bu etkinliğin tarihi geçti.';
const isTrainingPast = async (trainingId) => {
  const r = await pool.query(
    `SELECT (${trainingUtcExpr('t')} < NOW()) AS past FROM trainings t WHERE t.id = $1`,
    [trainingId]
  );
  return r.rows[0]?.past === true;
};

// =====================================================
// REAL-TIME: SSE (Server-Sent Events)
// =====================================================

// userId → Set<Response> — aktif SSE bağlantıları
const sseClients = new Map();

function pushToUser(userId, payload) {
  const conns = sseClients.get(userId);
  if (!conns || conns.size === 0) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  conns.forEach(res => { try { res.write(line); } catch {} });
}

// ── Bildirim tercihleri ─────────────────────────────────────────────────────
// Her bildirim türünü kullanıcının açıp kapatabileceği bir "anahtar"a eşle.
// Varsayılan: uygulama (app) AÇIK, e-posta KAPALI.
const NOTIF_TYPE_TO_KEY = {
  invitation:        'invite',
  team:              'team_member',
  role_change:       'role',
  training:          'event_new',
  training_update:   'event_update',
  training_reminder: 'event_reminder',
  training_join:     'event_join',
  training_comment:  'comment',
  team_post:         'wall_post',
  comment_like:      'like',
  wall_post_like:    'like',
  badge:             'badge',
  engagement_nudge:  'nudge',
};
// Yeni kullanıcılar için varsayılan bildirim tercihleri: bu türlerde e-posta AÇIK gelir
// (diğerleri: uygulama açık / e-posta kapalı varsayılanı geçerli).
const DEFAULT_NOTIF_PREFS = {
  invite:       { email: true },
  event_new:    { email: true },
  event_update: { email: true },
  role:         { email: true },
};
async function getNotifPrefs(userId) {
  return (await getUserNotifInfo(userId)).prefs;
}
// Bildirim tercihleri + dil tek sorguda.
async function getUserNotifInfo(userId) {
  try {
    const r = await pool.query('SELECT notif_prefs, lang FROM users WHERE id = $1', [userId]);
    return { prefs: r.rows[0]?.notif_prefs || {}, lang: mailLang(r.rows[0]?.lang) };
  } catch { return { prefs: {}, lang: 'tr' }; }
}
// channel: 'app' (varsayılan açık) | 'email' (varsayılan kapalı)
// E-postası varsayılan AÇIK olan türler (kullanıcı kapatana kadar). Sitedeki
// NOTIF_PREF_ROWS'ta emailDefault:true ile işaretli olmalı.
// team_member + event_join: liderlere giden yeni üye / yeni katılımcı maili (Melih, 6 Ekim 2026).
const EMAIL_DEFAULT_ON = new Set(['tips', 'team_member', 'event_join']);
function prefAllows(prefs, key, channel) {
  const p = (prefs && prefs[key]) || {};
  if (channel === 'email') return EMAIL_DEFAULT_ON.has(key) ? p.email !== false : p.email === true;
  return p.app !== false;
}

// Bildirim oluştur ve anlık ilet — kullanıcı bu türü kapatmışsa hiç oluşturulmaz.
// build(lang) verilirse başlık/mesaj ALICININ dilinde üretilir (users.lang; boşsa tr).
// Bildirim satırı alıcıya özel olduğu için metin o dilde saklanır, push da öyle gider.
// Uygulama bildirimi kaydı (admin › Bildirimler): oluşturuldu/atlandı + push sonucu.
// Bildirimin kendisi zaten notifications'ta; bu tablo atlananları ve push'u tutar.
pool.query(`CREATE TABLE IF NOT EXISTS notif_log (
    id SERIAL PRIMARY KEY,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind VARCHAR(32) NOT NULL,
    user_id INTEGER,
    status VARCHAR(10) NOT NULL,     -- created | skipped
    push_ok SMALLINT NOT NULL DEFAULT 0,
    push_fail SMALLINT NOT NULL DEFAULT 0
  )`).then(() => pool.query('CREATE INDEX IF NOT EXISTS notif_log_sent_at ON notif_log (sent_at)'))
  .catch((e) => console.error('notif_log:', e.message));
const logNotif = (kind, userId, status, push = {}) =>
  pool.query('INSERT INTO notif_log (kind, user_id, status, push_ok, push_fail) VALUES ($1, $2, $3, $4, $5)',
    [kind || 'other', userId || null, status, Math.min(push.ok || 0, 32000), Math.min(push.fail || 0, 32000)])
    .catch((e) => console.error('notif_log yazma:', e.message));

async function createNotif(userId, { title, message, build = null, type, refId = null, url = null }) {
  try {
    const key = NOTIF_TYPE_TO_KEY[type];
    const u = await getUserNotifInfo(userId);
    if (key && !prefAllows(u.prefs, key, 'app')) { logNotif(type, userId, 'skipped'); return null; } // uygulama bildirimi kapalı
    if (build) ({ title, message } = build(u.lang));
    const r = await pool.query(
      `INSERT INTO notifications (user_id, title, message, notification_type, reference_id, action_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, title, message, type, refId, url]
    );
    pushToUser(userId, { event: 'notification', data: r.rows[0] });
    const unread = await getUnreadCount(userId);
    sendPushToUser(userId, { title, body: message, data: { type, refId, url }, badge: unread })
      .then((push) => logNotif(type, userId, 'created', push)).catch(() => {});
    return r.rows[0];
  } catch (e) {
    console.error('createNotif error:', e.message);
  }
}

// =====================================================
// EMAIL / NODEMAILER SETUP
// =====================================================

const mailTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587'),
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  family: 4, // IPv4 zorla — Render IPv6 üzerinden SMTP'ye ulaşamıyor
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// Mail gönder — Resend HTTP API (Render SMTP portlarını engelliyor)
// prefKey verilirse bu bir "bildirim" mailidir → alıcının e-posta tercihi kapalıysa
// (varsayılan kapalı) gönderilmez. prefKey yoksa transactional maildir, her zaman gider.
// build(lang) verilirse konu + gövde ALICININ dilinde üretilir. Alıcı kayıtlı değilse
// (davet, iletişim) fallbackLang kullanılır — isteği yapanın dili.
// Gönderilen her e-postanın kaydı (admin › E-postalar). Adres SAKLANMAZ: tür,
// alıcının kullanıcı id'si (varsa), sonuç ve Resend id'si. Teslim durumu
// Resend'den okunur (resend_id ile eşleşir). 5 Ekim 2026.
pool.query(`CREATE TABLE IF NOT EXISTS email_log (
    id SERIAL PRIMARY KEY,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind VARCHAR(32) NOT NULL,
    user_id INTEGER,
    status VARCHAR(12) NOT NULL,     -- sent | skipped | failed | mocked
    resend_id VARCHAR(64)
  )`).then(() => pool.query('CREATE INDEX IF NOT EXISTS email_log_sent_at ON email_log (sent_at)'))
  .catch((e) => console.error('email_log:', e.message));
const logEmail = (kind, userId, status, resendId = null) =>
  pool.query('INSERT INTO email_log (kind, user_id, status, resend_id) VALUES ($1, $2, $3, $4)',
    [kind || 'other', userId || null, status, resendId]).catch((e) => console.error('email_log yazma:', e.message));

async function sendEmail(opts) {
  const r = await sendEmailRaw(opts);
  // Tür: açıkça verilen `kind`, yoksa tercih anahtarı (event_new, comment…).
  logEmail(opts.kind || opts.prefKey, opts.userId,
    r?.skipped ? 'skipped' : r?.mocked ? 'mocked' : r ? 'sent' : 'failed', r?.id || null);
  return r;
}
async function sendEmailRaw({ to, subject, html, build = null, fallbackLang = 'tr', prefKey = null, userId = null }) {
  let recipient = null;
  if (prefKey || build) {
    try {
      const r = userId
        ? await pool.query('SELECT notif_prefs, lang FROM users WHERE id = $1', [userId])
        : await pool.query('SELECT notif_prefs, lang FROM users WHERE lower(email) = lower($1)', [to]);
      recipient = r.rows[0] || null;
    } catch (e) {
      console.error('sendEmail pref check error:', e.message);
      if (prefKey) return { skipped: true };
    }
  }
  if (prefKey) {
    const prefs = recipient?.notif_prefs || {};
    if (!prefAllows(prefs, prefKey, 'email')) return { skipped: true };
  }
  if (build) ({ subject, html } = build(recipient ? mailLang(recipient.lang) : mailLang(fallbackLang)));
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL - MOCK] To: ${to} | Subject: ${subject}`);
    return { mocked: true };
  }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Muuvlink <noreply@muuvlink.app>',
        to,
        subject,
        html,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error(`[EMAIL ERROR] Resend:`, JSON.stringify(data));
      return null;
    }
    console.log(`[EMAIL] Resend ile gönderildi: ${data.id}`);
    return data;
  } catch (err) {
    console.error(`[EMAIL ERROR] Resend istek hatası:`, err.message);
    return null;
  }
}

// ─── HTML Şablonları ──────────────────────────────────

// ─── E-posta ve bildirim metinleri (dile göre) ─────────────────────────
// Alıcının dili users.lang'ten gelir; boşsa 'tr' (hesabında dil seçmemiş herkes
// bugüne kadar olduğu gibi Türkçe alır). Arayüz metinleri i18n.js'te; burada
// yalnız sunucunun ürettiği e-posta / bildirim / push metinleri durur.
// Türkçe metinler eski sabit metinlerin BİREBİR aynısıdır.
const MAIL_LANGS = ['tr', 'en', 'de', 'el', 'es', 'fr', 'it'];
const mailLang = (l) => (MAIL_LANGS.includes(l) ? l : 'tr');
const MAIL_LOCALE = { tr: 'tr-TR', en: 'en-GB', de: 'de-DE', el: 'el-GR', es: 'es-ES', fr: 'fr-FR', it: 'it-IT' };
const mB = (s) => `<strong>${s}</strong>`;

const MAIL = {
  tr: {
    wrapTagline: 'Spor topluluğun seni bekliyor',
    wrapFollow: 'Bizi takip et',
    wrapFooter1: 'Bu maili Muuvlink üzerinden aldınız.',
    wrapFooter2: '© 2026 Muuvlink. Tüm hakları saklıdır.',
    lblDate: 'Tarih', lblTime: 'Saat', lblLocation: 'Konum',
    btnViewEvent: 'Etkinliği Gör →', btnViewEventLong: 'Etkinliği Görüntüle →',
    btnViewTeam: 'Takımı Görüntüle →', btnJoinTeam: 'Takıma Katıl →',
    btnCreateAccount: 'Hesap Oluştur →', btnGoWall: 'Duvara Git →', btnResetPw: 'Şifremi Sıfırla',
    roles: { owner: 'Takım Lideri', editor: 'Editör', coach: 'Antrenör', captain: 'Kaptan', member: 'Üye', admin: 'Yönetici' },
    someone: 'Biri', teamFallback: 'Takımınız', changerFallback: 'Takım yöneticisi', updaterFallback: 'Antrenör',

    inviteNotifTitle: 'Takım Daveti!',
    inviteNotifMsg: (inv, team) => `${inv} sizi "${team}" takımına davet etti.`,
    inviteSubject: (inv, team) => `${inv} sizi "${team}" takımına davet etti!`,
    inviteExTitle: 'Takıma Davet Edildiniz!',
    inviteExBody: (inv, team) => `${mB(inv)} sizi ${mB(team)} takımına davet etti.`,
    inviteExNote: 'Uygulamaya giriş yaparak daveti kabul edebilirsiniz.',
    inviteNewTitle: "Muuvlink'e Davet Edildiniz!",
    inviteNewBody: (inv, team) => `${mB(inv)} sizi ${mB(team)} takımına davet etti.\n      Katılmak için ücretsiz hesap oluşturun.`,
    inviteNewNote: 'Kayıt olduktan sonra takıma katılma daveti sizi bekliyor olacak.',

    roleNotifTitle: 'Takım rolün güncellendi',
    roleNotifMsg: (ch, team, role) => `${ch}, "${team}" takımındaki rolünü "${role}" olarak güncelledi.`,
    roleSubject: (team) => `${team} takımındaki rolün güncellendi`,
    roleTitle: 'Takım Rolün Güncellendi',
    roleBody: (ch, team, role) => `${mB(ch)}, ${mB(team)} takımındaki rolünü\n      ${mB(role)} olarak güncelledi.`,
    roleNew: (role) => `Yeni rolün: ${role}`,

    wallNotifTitle: (team) => `${team} Duvarı`,
    wallSubject: (team) => `${team} takımında yeni gönderi var`,
    wallTitle: (team) => `${team} Duvarında Yeni Gönderi`,
    wallBody: (p) => `${mB(p)} takım duvarına bir şey yazdı.`,

    commentNotifTitle: (tr) => `${tr} — Yeni Yorum`,
    commentSubject: (tr) => `${tr} etkinliğine yorum yapıldı`,
    commentTitle: 'Etkinliğe Yorum Yapıldı',
    commentBody: (c, tr) => `${mB(c)}, ${mB(tr)} etkinliğine yorum yaptı.`,

    updateNotifTitle: (tr) => `${tr} güncellendi`,
    updateNotifMsg: (u) => `${u} etkinlik bilgilerini güncelledi.`,
    updateSubject: (tr) => `${tr} etkinliğinde değişiklik var`,
    updateTitle: 'Etkinlik Güncellendi',
    updateBody: (team, tr) => `${mB(team)} takımının ${mB(tr)} etkinliğinde değişiklik yapıldı.`,
    updateCurrent: 'Güncel Bilgiler',
    updateBy: 'Güncelleyen:',

    newNotifTitle: 'Yeni Etkinlik!',
    newNotifMsg: (team, tr) => `${team}: ${tr} etkinliği eklendi.`,
    newSubject: (team, tr) => `${team} — Yeni Etkinlik: ${tr}`,
    newTitle: 'Yeni Etkinlik Eklendi!',
    newBody: (team) => `${mB(team)} takımına yeni bir etkinlik eklendi.`,
    newUpcoming: 'Yaklaşan Diğer Etkinlikler',

    remNotifTitle: (d) => (d === 1 ? 'Yarın Etkinlik Var!' : '3 Gün Sonra Etkinlik!'),
    remSubject: (team, d, tr) => `${team} — ${d === 1 ? 'Yarın' : '3 Gün Sonra'}: ${tr}`,
    remTitle: 'Etkinliğiniz Yaklaşıyor',
    remBody: (team) => `${mB(team)} takımınızın etkinliğine az kaldı.`,
    remUrgency: (d) => (d === 1 ? 'Yarın!' : `${d} gün kaldı`),

    joinTeamNotifTitle: 'Yeni Üye Katıldı!',
    joinTeamNotifMsg: (j, team) => `${j}, ${team} takımına katıldı.`,
    joinTeamSubject: (team, j) => `${team} — Yeni Üye: ${j}`,
    joinTeamTitle: 'Takımınıza Yeni Üye Katıldı!',
    joinTeamBody: (j, team) => `${mB(j)}, ${mB(team)} takımına yeni üye olarak katıldı.`,

    joinEvNotifTitle: 'Etkinliğe Yeni Katılımcı!',
    joinEvNotifMsg: (j, tr) => `${j}, ${tr} etkinliğine katıldı.`,
    joinEvSubject: (tr, j) => `${tr} — Yeni Katılımcı: ${j}`,
    joinEvTitle: 'Etkinliğinize Yeni Katılımcı Var!',
    joinEvBody: (j, team, tr) => `${mB(j)}, ${mB(team)} takımının ${mB(tr)} etkinliğine katıldı.`,

    likeCommentTitle: 'Mesajın beğenildi',
    likeCommentMsg: (n, txt) => `${n} mesajını beğendi: "${txt}"`,
    likePostTitle: 'Gönderin beğenildi',
    likePostMsg: (n, txt) => `${n} takım duvarındaki gönderini beğendi: "${txt}"`,

    badgeTitle: 'Yeni Rozet!',
    badgeMsg: (b) => `"${b}" rozetini kazandın!`,

    nudgeTitle: 'Seni Özledik! 👋',
    nudgeMsg: 'Hadi kalk, bir etkinlik planla ya da var olan birine katıl, arkadaşlarınla buluş 💪',

    resetSubject: 'Muuvlink — Şifre Sıfırlama',
    resetTitle: 'Şifre Sıfırlama',
    resetHello: (n) => `Merhaba ${mB(n)},`,
    resetBody: `Şifrenizi sıfırlamak için aşağıdaki butona tıklayın. Link ${mB('1 saat')} geçerlidir.`,
    resetIgnore: 'Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.',

    contactSubject: 'Mesajınız alındı — Muuvlink',
    contactThanks: (n) => `Mesajınız için teşekkürler, ${n}!`,
    contactBody: 'Mesajınız başarıyla alındı. En kısa sürede size dönüş yapacağız.',
    contactTopic: 'Konu:',
  },

  en: {
    wrapTagline: 'Your sports community is waiting',
    wrapFollow: 'Follow us',
    wrapFooter1: 'You received this email through Muuvlink.',
    wrapFooter2: '© 2026 Muuvlink. All rights reserved.',
    lblDate: 'Date', lblTime: 'Time', lblLocation: 'Location',
    btnViewEvent: 'View event →', btnViewEventLong: 'View event →',
    btnViewTeam: 'View team →', btnJoinTeam: 'Join the team →',
    btnCreateAccount: 'Create account →', btnGoWall: 'Go to the wall →', btnResetPw: 'Reset my password',
    roles: { owner: 'Team Leader', editor: 'Editor', coach: 'Coach', captain: 'Captain', member: 'Member', admin: 'Admin' },
    someone: 'Someone', teamFallback: 'Your team', changerFallback: 'A team manager', updaterFallback: 'The coach',

    inviteNotifTitle: 'Team invitation!',
    inviteNotifMsg: (inv, team) => `${inv} invited you to the team "${team}".`,
    inviteSubject: (inv, team) => `${inv} invited you to the team "${team}"!`,
    inviteExTitle: "You've been invited to a team!",
    inviteExBody: (inv, team) => `${mB(inv)} invited you to the team ${mB(team)}.`,
    inviteExNote: 'Log in to the app to accept the invitation.',
    inviteNewTitle: "You've been invited to Muuvlink!",
    inviteNewBody: (inv, team) => `${mB(inv)} invited you to the team ${mB(team)}.\n      Create a free account to join.`,
    inviteNewNote: 'Once you sign up, the team invitation will be waiting for you.',

    roleNotifTitle: 'Your team role was updated',
    roleNotifMsg: (ch, team, role) => `${ch} changed your role in "${team}" to "${role}".`,
    roleSubject: (team) => `Your role in ${team} was updated`,
    roleTitle: 'Your team role was updated',
    roleBody: (ch, team, role) => `${mB(ch)} changed your role in ${mB(team)}\n      to ${mB(role)}.`,
    roleNew: (role) => `Your new role: ${role}`,

    wallNotifTitle: (team) => `${team} wall`,
    wallSubject: (team) => `New post in ${team}`,
    wallTitle: (team) => `New post on the ${team} wall`,
    wallBody: (p) => `${mB(p)} wrote something on the team wall.`,

    commentNotifTitle: (tr) => `${tr} — New comment`,
    commentSubject: (tr) => `New comment on ${tr}`,
    commentTitle: 'New comment on an event',
    commentBody: (c, tr) => `${mB(c)} commented on ${mB(tr)}.`,

    updateNotifTitle: (tr) => `${tr} was updated`,
    updateNotifMsg: (u) => `${u} updated the event details.`,
    updateSubject: (tr) => `${tr} has changed`,
    updateTitle: 'Event updated',
    updateBody: (team, tr) => `The event ${mB(tr)} of ${mB(team)} has been changed.`,
    updateCurrent: 'Current details',
    updateBy: 'Updated by:',

    newNotifTitle: 'New event!',
    newNotifMsg: (team, tr) => `${team}: the event ${tr} was added.`,
    newSubject: (team, tr) => `${team} — New event: ${tr}`,
    newTitle: 'A new event was added!',
    newBody: (team) => `A new event was added to ${mB(team)}.`,
    newUpcoming: 'Other upcoming events',

    remNotifTitle: (d) => (d === 1 ? 'Event tomorrow!' : 'Event in 3 days!'),
    remSubject: (team, d, tr) => `${team} — ${d === 1 ? 'Tomorrow' : 'In 3 days'}: ${tr}`,
    remTitle: 'Your event is coming up',
    remBody: (team) => `The ${mB(team)} event is almost here.`,
    remUrgency: (d) => (d === 1 ? 'Tomorrow!' : `${d} days to go`),

    joinTeamNotifTitle: 'New member joined!',
    joinTeamNotifMsg: (j, team) => `${j} joined ${team}.`,
    joinTeamSubject: (team, j) => `${team} — New member: ${j}`,
    joinTeamTitle: 'A new member joined your team!',
    joinTeamBody: (j, team) => `${mB(j)} joined ${mB(team)} as a new member.`,

    joinEvNotifTitle: 'New participant!',
    joinEvNotifMsg: (j, tr) => `${j} joined ${tr}.`,
    joinEvSubject: (tr, j) => `${tr} — New participant: ${j}`,
    joinEvTitle: 'Your event has a new participant!',
    joinEvBody: (j, team, tr) => `${mB(j)} joined the ${mB(team)} event ${mB(tr)}.`,

    likeCommentTitle: 'Your message was liked',
    likeCommentMsg: (n, txt) => `${n} liked your message: "${txt}"`,
    likePostTitle: 'Your post was liked',
    likePostMsg: (n, txt) => `${n} liked your post on the team wall: "${txt}"`,

    badgeTitle: 'New badge!',
    badgeMsg: (b) => `You earned the "${b}" badge!`,

    nudgeTitle: 'We miss you! 👋',
    nudgeMsg: 'Come on — plan an event or join one, and meet up with your friends 💪',

    resetSubject: 'Muuvlink — Password reset',
    resetTitle: 'Password reset',
    resetHello: (n) => `Hi ${mB(n)},`,
    resetBody: `Click the button below to reset your password. The link is valid for ${mB('1 hour')}.`,
    resetIgnore: "If you didn't request this, you can ignore this email.",

    contactSubject: 'We received your message — Muuvlink',
    contactThanks: (n) => `Thanks for your message, ${n}!`,
    contactBody: "We've received your message and will get back to you soon.",
    contactTopic: 'Subject:',
  },

  de: {
    wrapTagline: 'Deine Sport-Community wartet auf dich',
    wrapFollow: 'Folge uns',
    wrapFooter1: 'Du hast diese E-Mail über Muuvlink erhalten.',
    wrapFooter2: '© 2026 Muuvlink. Alle Rechte vorbehalten.',
    lblDate: 'Datum', lblTime: 'Uhrzeit', lblLocation: 'Ort',
    btnViewEvent: 'Event ansehen →', btnViewEventLong: 'Event ansehen →',
    btnViewTeam: 'Team ansehen →', btnJoinTeam: 'Team beitreten →',
    btnCreateAccount: 'Konto erstellen →', btnGoWall: 'Zur Pinnwand →', btnResetPw: 'Passwort zurücksetzen',
    roles: { owner: 'Teamleitung', editor: 'Redakteur', coach: 'Trainer', captain: 'Kapitän', member: 'Mitglied', admin: 'Admin' },
    someone: 'Jemand', teamFallback: 'Dein Team', changerFallback: 'Eine Teamleitung', updaterFallback: 'Der Trainer',

    inviteNotifTitle: 'Team-Einladung!',
    inviteNotifMsg: (inv, team) => `${inv} hat dich in das Team „${team}“ eingeladen.`,
    inviteSubject: (inv, team) => `${inv} hat dich in das Team „${team}“ eingeladen!`,
    inviteExTitle: 'Du wurdest in ein Team eingeladen!',
    inviteExBody: (inv, team) => `${mB(inv)} hat dich in das Team ${mB(team)} eingeladen.`,
    inviteExNote: 'Melde dich in der App an, um die Einladung anzunehmen.',
    inviteNewTitle: 'Du wurdest zu Muuvlink eingeladen!',
    inviteNewBody: (inv, team) => `${mB(inv)} hat dich in das Team ${mB(team)} eingeladen.\n      Erstelle ein kostenloses Konto, um beizutreten.`,
    inviteNewNote: 'Nach der Registrierung wartet die Team-Einladung auf dich.',

    roleNotifTitle: 'Deine Teamrolle wurde geändert',
    roleNotifMsg: (ch, team, role) => `${ch} hat deine Rolle im Team „${team}“ auf „${role}“ geändert.`,
    roleSubject: (team) => `Deine Rolle im Team ${team} wurde geändert`,
    roleTitle: 'Deine Teamrolle wurde geändert',
    roleBody: (ch, team, role) => `${mB(ch)} hat deine Rolle im Team ${mB(team)}\n      auf ${mB(role)} geändert.`,
    roleNew: (role) => `Deine neue Rolle: ${role}`,

    wallNotifTitle: (team) => `Pinnwand ${team}`,
    wallSubject: (team) => `Neuer Beitrag im Team ${team}`,
    wallTitle: (team) => `Neuer Beitrag auf der Pinnwand von ${team}`,
    wallBody: (p) => `${mB(p)} hat etwas auf die Team-Pinnwand geschrieben.`,

    commentNotifTitle: (tr) => `${tr} — Neuer Kommentar`,
    commentSubject: (tr) => `Neuer Kommentar zu ${tr}`,
    commentTitle: 'Neuer Kommentar zu einem Event',
    commentBody: (c, tr) => `${mB(c)} hat ${mB(tr)} kommentiert.`,

    updateNotifTitle: (tr) => `${tr} wurde aktualisiert`,
    updateNotifMsg: (u) => `${u} hat die Eventdetails aktualisiert.`,
    updateSubject: (tr) => `Änderung bei ${tr}`,
    updateTitle: 'Event aktualisiert',
    updateBody: (team, tr) => `Beim Event ${mB(tr)} des Teams ${mB(team)} gab es Änderungen.`,
    updateCurrent: 'Aktuelle Angaben',
    updateBy: 'Geändert von:',

    newNotifTitle: 'Neues Event!',
    newNotifMsg: (team, tr) => `${team}: Das Event ${tr} wurde hinzugefügt.`,
    newSubject: (team, tr) => `${team} — Neues Event: ${tr}`,
    newTitle: 'Ein neues Event wurde hinzugefügt!',
    newBody: (team) => `Im Team ${mB(team)} wurde ein neues Event hinzugefügt.`,
    newUpcoming: 'Weitere kommende Events',

    remNotifTitle: (d) => (d === 1 ? 'Morgen ist ein Event!' : 'Event in 3 Tagen!'),
    remSubject: (team, d, tr) => `${team} — ${d === 1 ? 'Morgen' : 'In 3 Tagen'}: ${tr}`,
    remTitle: 'Dein Event steht bevor',
    remBody: (team) => `Das Event deines Teams ${mB(team)} ist bald.`,
    remUrgency: (d) => (d === 1 ? 'Morgen!' : `Noch ${d} Tage`),

    joinTeamNotifTitle: 'Neues Mitglied!',
    joinTeamNotifMsg: (j, team) => `${j} ist dem Team ${team} beigetreten.`,
    joinTeamSubject: (team, j) => `${team} — Neues Mitglied: ${j}`,
    joinTeamTitle: 'Ein neues Mitglied ist deinem Team beigetreten!',
    joinTeamBody: (j, team) => `${mB(j)} ist dem Team ${mB(team)} als neues Mitglied beigetreten.`,

    joinEvNotifTitle: 'Neue Teilnahme!',
    joinEvNotifMsg: (j, tr) => `${j} nimmt an ${tr} teil.`,
    joinEvSubject: (tr, j) => `${tr} — Neue Teilnahme: ${j}`,
    joinEvTitle: 'Dein Event hat eine neue Teilnahme!',
    joinEvBody: (j, team, tr) => `${mB(j)} nimmt am Event ${mB(tr)} des Teams ${mB(team)} teil.`,

    likeCommentTitle: 'Deine Nachricht gefällt jemandem',
    likeCommentMsg: (n, txt) => `${n} gefällt deine Nachricht: „${txt}“`,
    likePostTitle: 'Dein Beitrag gefällt jemandem',
    likePostMsg: (n, txt) => `${n} gefällt dein Beitrag auf der Team-Pinnwand: „${txt}“`,

    badgeTitle: 'Neues Abzeichen!',
    badgeMsg: (b) => `Du hast das Abzeichen „${b}“ erhalten!`,

    nudgeTitle: 'Wir vermissen dich! 👋',
    nudgeMsg: 'Los geht’s — plane ein Event oder mach bei einem mit und triff deine Freunde 💪',

    resetSubject: 'Muuvlink — Passwort zurücksetzen',
    resetTitle: 'Passwort zurücksetzen',
    resetHello: (n) => `Hallo ${mB(n)},`,
    resetBody: `Klicke auf die Schaltfläche unten, um dein Passwort zurückzusetzen. Der Link ist ${mB('1 Stunde')} gültig.`,
    resetIgnore: 'Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.',

    contactSubject: 'Deine Nachricht ist angekommen — Muuvlink',
    contactThanks: (n) => `Danke für deine Nachricht, ${n}!`,
    contactBody: 'Deine Nachricht ist bei uns angekommen. Wir melden uns so bald wie möglich.',
    contactTopic: 'Betreff:',
  },

  el: {
    wrapTagline: 'Η αθλητική σου κοινότητα σε περιμένει',
    wrapFollow: 'Ακολούθησέ μας',
    wrapFooter1: 'Έλαβες αυτό το email μέσω του Muuvlink.',
    wrapFooter2: '© 2026 Muuvlink. Με την επιφύλαξη παντός δικαιώματος.',
    lblDate: 'Ημερομηνία', lblTime: 'Ώρα', lblLocation: 'Τοποθεσία',
    btnViewEvent: 'Δες την εκδήλωση →', btnViewEventLong: 'Δες την εκδήλωση →',
    btnViewTeam: 'Δες την ομάδα →', btnJoinTeam: 'Γίνε μέλος →',
    btnCreateAccount: 'Δημιουργία λογαριασμού →', btnGoWall: 'Μετάβαση στον τοίχο →', btnResetPw: 'Επαναφορά κωδικού',
    roles: { owner: 'Αρχηγός ομάδας', editor: 'Συντάκτης', coach: 'Προπονητής', captain: 'Αρχηγός', member: 'Μέλος', admin: 'Διαχειριστής' },
    someone: 'Κάποιος', teamFallback: 'Η ομάδα σου', changerFallback: 'Ένας διαχειριστής της ομάδας', updaterFallback: 'Ο προπονητής',

    inviteNotifTitle: 'Πρόσκληση σε ομάδα!',
    inviteNotifMsg: (inv, team) => `Ο/Η ${inv} σε προσκάλεσε στην ομάδα «${team}».`,
    inviteSubject: (inv, team) => `Ο/Η ${inv} σε προσκάλεσε στην ομάδα «${team}»!`,
    inviteExTitle: 'Έχεις πρόσκληση σε ομάδα!',
    inviteExBody: (inv, team) => `Ο/Η ${mB(inv)} σε προσκάλεσε στην ομάδα ${mB(team)}.`,
    inviteExNote: 'Συνδέσου στην εφαρμογή για να αποδεχτείς την πρόσκληση.',
    inviteNewTitle: 'Έχεις πρόσκληση στο Muuvlink!',
    inviteNewBody: (inv, team) => `Ο/Η ${mB(inv)} σε προσκάλεσε στην ομάδα ${mB(team)}.\n      Φτιάξε δωρεάν λογαριασμό για να γίνεις μέλος.`,
    inviteNewNote: 'Μόλις εγγραφείς, η πρόσκληση της ομάδας θα σε περιμένει.',

    roleNotifTitle: 'Ο ρόλος σου στην ομάδα άλλαξε',
    roleNotifMsg: (ch, team, role) => `Ο/Η ${ch} άλλαξε τον ρόλο σου στην ομάδα «${team}» σε «${role}».`,
    roleSubject: (team) => `Ο ρόλος σου στην ομάδα ${team} άλλαξε`,
    roleTitle: 'Ο ρόλος σου στην ομάδα άλλαξε',
    roleBody: (ch, team, role) => `Ο/Η ${mB(ch)} άλλαξε τον ρόλο σου στην ομάδα ${mB(team)}\n      σε ${mB(role)}.`,
    roleNew: (role) => `Νέος ρόλος: ${role}`,

    wallNotifTitle: (team) => `Τοίχος: ${team}`,
    wallSubject: (team) => `Νέα ανάρτηση στην ομάδα ${team}`,
    wallTitle: (team) => `Νέα ανάρτηση στον τοίχο της ομάδας ${team}`,
    wallBody: (p) => `Ο/Η ${mB(p)} έγραψε κάτι στον τοίχο της ομάδας.`,

    commentNotifTitle: (tr) => `${tr} — Νέο σχόλιο`,
    commentSubject: (tr) => `Νέο σχόλιο στην εκδήλωση ${tr}`,
    commentTitle: 'Νέο σχόλιο σε εκδήλωση',
    commentBody: (c, tr) => `Ο/Η ${mB(c)} σχολίασε την εκδήλωση ${mB(tr)}.`,

    updateNotifTitle: (tr) => `Η εκδήλωση ${tr} ενημερώθηκε`,
    updateNotifMsg: (u) => `Ο/Η ${u} ενημέρωσε τα στοιχεία της εκδήλωσης.`,
    updateSubject: (tr) => `Αλλαγές στην εκδήλωση ${tr}`,
    updateTitle: 'Η εκδήλωση ενημερώθηκε',
    updateBody: (team, tr) => `Έγιναν αλλαγές στην εκδήλωση ${mB(tr)} της ομάδας ${mB(team)}.`,
    updateCurrent: 'Τρέχοντα στοιχεία',
    updateBy: 'Ενημέρωση από:',

    newNotifTitle: 'Νέα εκδήλωση!',
    newNotifMsg: (team, tr) => `${team}: προστέθηκε η εκδήλωση ${tr}.`,
    newSubject: (team, tr) => `${team} — Νέα εκδήλωση: ${tr}`,
    newTitle: 'Προστέθηκε νέα εκδήλωση!',
    newBody: (team) => `Προστέθηκε νέα εκδήλωση στην ομάδα ${mB(team)}.`,
    newUpcoming: 'Άλλες προσεχείς εκδηλώσεις',

    remNotifTitle: (d) => (d === 1 ? 'Αύριο έχεις εκδήλωση!' : 'Εκδήλωση σε 3 ημέρες!'),
    remSubject: (team, d, tr) => `${team} — ${d === 1 ? 'Αύριο' : 'Σε 3 ημέρες'}: ${tr}`,
    remTitle: 'Η εκδήλωσή σου πλησιάζει',
    remBody: (team) => `Λίγο ακόμα για την εκδήλωση της ομάδας ${mB(team)}.`,
    remUrgency: (d) => (d === 1 ? 'Αύριο!' : `Απομένουν ${d} ημέρες`),

    joinTeamNotifTitle: 'Νέο μέλος!',
    joinTeamNotifMsg: (j, team) => `Ο/Η ${j} έγινε μέλος της ομάδας ${team}.`,
    joinTeamSubject: (team, j) => `${team} — Νέο μέλος: ${j}`,
    joinTeamTitle: 'Νέο μέλος στην ομάδα σου!',
    joinTeamBody: (j, team) => `Ο/Η ${mB(j)} έγινε νέο μέλος της ομάδας ${mB(team)}.`,

    joinEvNotifTitle: 'Νέος συμμετέχων!',
    joinEvNotifMsg: (j, tr) => `Ο/Η ${j} δήλωσε συμμετοχή στην εκδήλωση ${tr}.`,
    joinEvSubject: (tr, j) => `${tr} — Νέος συμμετέχων: ${j}`,
    joinEvTitle: 'Νέος συμμετέχων στην εκδήλωσή σου!',
    joinEvBody: (j, team, tr) => `Ο/Η ${mB(j)} δήλωσε συμμετοχή στην εκδήλωση ${mB(tr)} της ομάδας ${mB(team)}.`,

    likeCommentTitle: 'Το μήνυμά σου άρεσε',
    likeCommentMsg: (n, txt) => `Ο/Η ${n} έκανε «μου αρέσει» στο μήνυμά σου: «${txt}»`,
    likePostTitle: 'Η ανάρτησή σου άρεσε',
    likePostMsg: (n, txt) => `Ο/Η ${n} έκανε «μου αρέσει» στην ανάρτησή σου στον τοίχο της ομάδας: «${txt}»`,

    badgeTitle: 'Νέο σήμα!',
    badgeMsg: (b) => `Κέρδισες το σήμα «${b}»!`,

    nudgeTitle: 'Μας έλειψες! 👋',
    nudgeMsg: 'Έλα — οργάνωσε μια εκδήλωση ή δήλωσε συμμετοχή σε μία και βρες τους φίλους σου 💪',

    resetSubject: 'Muuvlink — Επαναφορά κωδικού',
    resetTitle: 'Επαναφορά κωδικού',
    resetHello: (n) => `Γεια σου ${mB(n)},`,
    resetBody: `Πάτησε το παρακάτω κουμπί για να επαναφέρεις τον κωδικό σου. Ο σύνδεσμος ισχύει για ${mB('1 ώρα')}.`,
    resetIgnore: 'Αν δεν το ζήτησες εσύ, αγνόησε αυτό το email.',

    contactSubject: 'Λάβαμε το μήνυμά σου — Muuvlink',
    contactThanks: (n) => `Ευχαριστούμε για το μήνυμά σου, ${n}!`,
    contactBody: 'Λάβαμε το μήνυμά σου και θα σου απαντήσουμε σύντομα.',
    contactTopic: 'Θέμα:',
  },

  es: {
    wrapTagline: 'Tu comunidad deportiva te espera',
    wrapFollow: 'Síguenos',
    wrapFooter1: 'Has recibido este correo a través de Muuvlink.',
    wrapFooter2: '© 2026 Muuvlink. Todos los derechos reservados.',
    lblDate: 'Fecha', lblTime: 'Hora', lblLocation: 'Lugar',
    btnViewEvent: 'Ver evento →', btnViewEventLong: 'Ver evento →',
    btnViewTeam: 'Ver equipo →', btnJoinTeam: 'Unirme al equipo →',
    btnCreateAccount: 'Crear cuenta →', btnGoWall: 'Ir al muro →', btnResetPw: 'Restablecer contraseña',
    roles: { owner: 'Líder del equipo', editor: 'Editor', coach: 'Entrenador', captain: 'Capitán', member: 'Miembro', admin: 'Administrador' },
    someone: 'Alguien', teamFallback: 'Tu equipo', changerFallback: 'Un responsable del equipo', updaterFallback: 'El entrenador',

    inviteNotifTitle: '¡Invitación a un equipo!',
    inviteNotifMsg: (inv, team) => `${inv} te ha invitado al equipo «${team}».`,
    inviteSubject: (inv, team) => `¡${inv} te ha invitado al equipo «${team}»!`,
    inviteExTitle: '¡Te han invitado a un equipo!',
    inviteExBody: (inv, team) => `${mB(inv)} te ha invitado al equipo ${mB(team)}.`,
    inviteExNote: 'Inicia sesión en la app para aceptar la invitación.',
    inviteNewTitle: '¡Te han invitado a Muuvlink!',
    inviteNewBody: (inv, team) => `${mB(inv)} te ha invitado al equipo ${mB(team)}.\n      Crea una cuenta gratis para unirte.`,
    inviteNewNote: 'Cuando te registres, la invitación al equipo te estará esperando.',

    roleNotifTitle: 'Tu rol en el equipo ha cambiado',
    roleNotifMsg: (ch, team, role) => `${ch} ha cambiado tu rol en «${team}» a «${role}».`,
    roleSubject: (team) => `Tu rol en ${team} ha cambiado`,
    roleTitle: 'Tu rol en el equipo ha cambiado',
    roleBody: (ch, team, role) => `${mB(ch)} ha cambiado tu rol en ${mB(team)}\n      a ${mB(role)}.`,
    roleNew: (role) => `Tu nuevo rol: ${role}`,

    wallNotifTitle: (team) => `Muro de ${team}`,
    wallSubject: (team) => `Nueva publicación en ${team}`,
    wallTitle: (team) => `Nueva publicación en el muro de ${team}`,
    wallBody: (p) => `${mB(p)} ha escrito algo en el muro del equipo.`,

    commentNotifTitle: (tr) => `${tr} — Nuevo comentario`,
    commentSubject: (tr) => `Nuevo comentario en ${tr}`,
    commentTitle: 'Nuevo comentario en un evento',
    commentBody: (c, tr) => `${mB(c)} ha comentado en ${mB(tr)}.`,

    updateNotifTitle: (tr) => `${tr} se ha actualizado`,
    updateNotifMsg: (u) => `${u} ha actualizado los datos del evento.`,
    updateSubject: (tr) => `Cambios en ${tr}`,
    updateTitle: 'Evento actualizado',
    updateBody: (team, tr) => `Ha habido cambios en el evento ${mB(tr)} de ${mB(team)}.`,
    updateCurrent: 'Datos actuales',
    updateBy: 'Actualizado por:',

    newNotifTitle: '¡Nuevo evento!',
    newNotifMsg: (team, tr) => `${team}: se ha añadido el evento ${tr}.`,
    newSubject: (team, tr) => `${team} — Nuevo evento: ${tr}`,
    newTitle: '¡Se ha añadido un nuevo evento!',
    newBody: (team) => `Se ha añadido un nuevo evento a ${mB(team)}.`,
    newUpcoming: 'Otros próximos eventos',

    remNotifTitle: (d) => (d === 1 ? '¡Mañana tienes evento!' : '¡Evento dentro de 3 días!'),
    remSubject: (team, d, tr) => `${team} — ${d === 1 ? 'Mañana' : 'En 3 días'}: ${tr}`,
    remTitle: 'Tu evento se acerca',
    remBody: (team) => `Queda poco para el evento de ${mB(team)}.`,
    remUrgency: (d) => (d === 1 ? '¡Mañana!' : `Faltan ${d} días`),

    joinTeamNotifTitle: '¡Nuevo miembro!',
    joinTeamNotifMsg: (j, team) => `${j} se ha unido a ${team}.`,
    joinTeamSubject: (team, j) => `${team} — Nuevo miembro: ${j}`,
    joinTeamTitle: '¡Un nuevo miembro se ha unido a tu equipo!',
    joinTeamBody: (j, team) => `${mB(j)} se ha unido a ${mB(team)} como nuevo miembro.`,

    joinEvNotifTitle: '¡Nuevo participante!',
    joinEvNotifMsg: (j, tr) => `${j} se ha apuntado a ${tr}.`,
    joinEvSubject: (tr, j) => `${tr} — Nuevo participante: ${j}`,
    joinEvTitle: '¡Tu evento tiene un nuevo participante!',
    joinEvBody: (j, team, tr) => `${mB(j)} se ha apuntado al evento ${mB(tr)} de ${mB(team)}.`,

    likeCommentTitle: 'A alguien le gusta tu mensaje',
    likeCommentMsg: (n, txt) => `A ${n} le gusta tu mensaje: «${txt}»`,
    likePostTitle: 'A alguien le gusta tu publicación',
    likePostMsg: (n, txt) => `A ${n} le gusta tu publicación en el muro del equipo: «${txt}»`,

    badgeTitle: '¡Nueva insignia!',
    badgeMsg: (b) => `¡Has conseguido la insignia «${b}»!`,

    nudgeTitle: '¡Te echamos de menos! 👋',
    nudgeMsg: 'Venga: organiza un evento o apúntate a uno y queda con tus amigos 💪',

    resetSubject: 'Muuvlink — Restablecer contraseña',
    resetTitle: 'Restablecer contraseña',
    resetHello: (n) => `Hola, ${mB(n)}:`,
    resetBody: `Pulsa el botón de abajo para restablecer tu contraseña. El enlace es válido durante ${mB('1 hora')}.`,
    resetIgnore: 'Si no lo has pedido tú, puedes ignorar este correo.',

    contactSubject: 'Hemos recibido tu mensaje — Muuvlink',
    contactThanks: (n) => `¡Gracias por tu mensaje, ${n}!`,
    contactBody: 'Hemos recibido tu mensaje y te responderemos lo antes posible.',
    contactTopic: 'Asunto:',
  },

  fr: {
    wrapTagline: "Ta communauté sportive t'attend",
    wrapFollow: 'Suis-nous',
    wrapFooter1: 'Tu as reçu cet e-mail via Muuvlink.',
    wrapFooter2: '© 2026 Muuvlink. Tous droits réservés.',
    lblDate: 'Date', lblTime: 'Heure', lblLocation: 'Lieu',
    btnViewEvent: "Voir l'événement →", btnViewEventLong: "Voir l'événement →",
    btnViewTeam: "Voir l'équipe →", btnJoinTeam: "Rejoindre l'équipe →",
    btnCreateAccount: 'Créer un compte →', btnGoWall: 'Aller au mur →', btnResetPw: 'Réinitialiser mon mot de passe',
    roles: { owner: "Chef d'équipe", editor: 'Éditeur', coach: 'Coach', captain: 'Capitaine', member: 'Membre', admin: 'Administrateur' },
    someone: "Quelqu'un", teamFallback: 'Ton équipe', changerFallback: "Un responsable de l'équipe", updaterFallback: 'Le coach',

    inviteNotifTitle: "Invitation dans une équipe !",
    inviteNotifMsg: (inv, team) => `${inv} t'invite à rejoindre l'équipe « ${team} ».`,
    inviteSubject: (inv, team) => `${inv} t'invite à rejoindre l'équipe « ${team} » !`,
    inviteExTitle: 'Tu es invité dans une équipe !',
    inviteExBody: (inv, team) => `${mB(inv)} t'invite à rejoindre l'équipe ${mB(team)}.`,
    inviteExNote: "Connecte-toi à l'application pour accepter l'invitation.",
    inviteNewTitle: 'Tu es invité sur Muuvlink !',
    inviteNewBody: (inv, team) => `${mB(inv)} t'invite à rejoindre l'équipe ${mB(team)}.\n      Crée un compte gratuit pour la rejoindre.`,
    inviteNewNote: "Une fois inscrit, l'invitation de l'équipe t'attendra.",

    roleNotifTitle: "Ton rôle dans l'équipe a changé",
    roleNotifMsg: (ch, team, role) => `${ch} a changé ton rôle dans « ${team} » en « ${role} ».`,
    roleSubject: (team) => `Ton rôle dans ${team} a changé`,
    roleTitle: "Ton rôle dans l'équipe a changé",
    roleBody: (ch, team, role) => `${mB(ch)} a changé ton rôle dans ${mB(team)}\n      en ${mB(role)}.`,
    roleNew: (role) => `Ton nouveau rôle : ${role}`,

    wallNotifTitle: (team) => `Mur de ${team}`,
    wallSubject: (team) => `Nouvelle publication dans ${team}`,
    wallTitle: (team) => `Nouvelle publication sur le mur de ${team}`,
    wallBody: (p) => `${mB(p)} a écrit sur le mur de l'équipe.`,

    commentNotifTitle: (tr) => `${tr} — Nouveau commentaire`,
    commentSubject: (tr) => `Nouveau commentaire sur ${tr}`,
    commentTitle: 'Nouveau commentaire sur un événement',
    commentBody: (c, tr) => `${mB(c)} a commenté ${mB(tr)}.`,

    updateNotifTitle: (tr) => `${tr} a été modifié`,
    updateNotifMsg: (u) => `${u} a modifié les informations de l'événement.`,
    updateSubject: (tr) => `Changements pour ${tr}`,
    updateTitle: 'Événement modifié',
    updateBody: (team, tr) => `L'événement ${mB(tr)} de ${mB(team)} a été modifié.`,
    updateCurrent: 'Informations à jour',
    updateBy: 'Modifié par :',

    newNotifTitle: 'Nouvel événement !',
    newNotifMsg: (team, tr) => `${team} : l'événement ${tr} a été ajouté.`,
    newSubject: (team, tr) => `${team} — Nouvel événement : ${tr}`,
    newTitle: 'Un nouvel événement a été ajouté !',
    newBody: (team) => `Un nouvel événement a été ajouté à ${mB(team)}.`,
    newUpcoming: 'Autres événements à venir',

    remNotifTitle: (d) => (d === 1 ? 'Événement demain !' : 'Événement dans 3 jours !'),
    remSubject: (team, d, tr) => `${team} — ${d === 1 ? 'Demain' : 'Dans 3 jours'} : ${tr}`,
    remTitle: 'Ton événement approche',
    remBody: (team) => `L'événement de ${mB(team)} approche.`,
    remUrgency: (d) => (d === 1 ? 'Demain !' : `Plus que ${d} jours`),

    joinTeamNotifTitle: 'Nouveau membre !',
    joinTeamNotifMsg: (j, team) => `${j} a rejoint ${team}.`,
    joinTeamSubject: (team, j) => `${team} — Nouveau membre : ${j}`,
    joinTeamTitle: 'Un nouveau membre a rejoint ton équipe !',
    joinTeamBody: (j, team) => `${mB(j)} a rejoint ${mB(team)} en tant que nouveau membre.`,

    joinEvNotifTitle: 'Nouveau participant !',
    joinEvNotifMsg: (j, tr) => `${j} participe à ${tr}.`,
    joinEvSubject: (tr, j) => `${tr} — Nouveau participant : ${j}`,
    joinEvTitle: 'Ton événement a un nouveau participant !',
    joinEvBody: (j, team, tr) => `${mB(j)} participe à l'événement ${mB(tr)} de ${mB(team)}.`,

    likeCommentTitle: 'Ton message a plu',
    likeCommentMsg: (n, txt) => `${n} aime ton message : « ${txt} »`,
    likePostTitle: 'Ta publication a plu',
    likePostMsg: (n, txt) => `${n} aime ta publication sur le mur de l'équipe : « ${txt} »`,

    badgeTitle: 'Nouveau badge !',
    badgeMsg: (b) => `Tu as obtenu le badge « ${b} » !`,

    nudgeTitle: 'Tu nous manques ! 👋',
    nudgeMsg: 'Allez : organise un événement ou participe à un autre, et retrouve tes amis 💪',

    resetSubject: 'Muuvlink — Réinitialisation du mot de passe',
    resetTitle: 'Réinitialisation du mot de passe',
    resetHello: (n) => `Bonjour ${mB(n)},`,
    resetBody: `Clique sur le bouton ci-dessous pour réinitialiser ton mot de passe. Le lien est valable ${mB('1 heure')}.`,
    resetIgnore: "Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet e-mail.",

    contactSubject: 'Nous avons bien reçu ton message — Muuvlink',
    contactThanks: (n) => `Merci pour ton message, ${n} !`,
    contactBody: 'Nous avons bien reçu ton message et te répondrons au plus vite.',
    contactTopic: 'Sujet :',
  },

  it: {
    wrapTagline: 'La tua community sportiva ti aspetta',
    wrapFollow: 'Seguici',
    wrapFooter1: 'Hai ricevuto questa email tramite Muuvlink.',
    wrapFooter2: '© 2026 Muuvlink. Tutti i diritti riservati.',
    lblDate: 'Data', lblTime: 'Ora', lblLocation: 'Luogo',
    btnViewEvent: "Vedi l'evento →", btnViewEventLong: "Vedi l'evento →",
    btnViewTeam: 'Vedi la squadra →', btnJoinTeam: 'Entra nella squadra →',
    btnCreateAccount: 'Crea un account →', btnGoWall: 'Vai alla bacheca →', btnResetPw: 'Reimposta la password',
    roles: { owner: 'Capo squadra', editor: 'Editor', coach: 'Allenatore', captain: 'Capitano', member: 'Membro', admin: 'Amministratore' },
    someone: 'Qualcuno', teamFallback: 'La tua squadra', changerFallback: 'Un responsabile della squadra', updaterFallback: "L'allenatore",

    inviteNotifTitle: 'Invito in una squadra!',
    inviteNotifMsg: (inv, team) => `${inv} ti ha invitato nella squadra «${team}».`,
    inviteSubject: (inv, team) => `${inv} ti ha invitato nella squadra «${team}»!`,
    inviteExTitle: 'Sei stato invitato in una squadra!',
    inviteExBody: (inv, team) => `${mB(inv)} ti ha invitato nella squadra ${mB(team)}.`,
    inviteExNote: "Accedi all'app per accettare l'invito.",
    inviteNewTitle: 'Sei stato invitato su Muuvlink!',
    inviteNewBody: (inv, team) => `${mB(inv)} ti ha invitato nella squadra ${mB(team)}.\n      Crea un account gratuito per entrare.`,
    inviteNewNote: "Dopo la registrazione, l'invito della squadra ti aspetterà.",

    roleNotifTitle: 'Il tuo ruolo nella squadra è cambiato',
    roleNotifMsg: (ch, team, role) => `${ch} ha cambiato il tuo ruolo in «${team}» in «${role}».`,
    roleSubject: (team) => `Il tuo ruolo in ${team} è cambiato`,
    roleTitle: 'Il tuo ruolo nella squadra è cambiato',
    roleBody: (ch, team, role) => `${mB(ch)} ha cambiato il tuo ruolo in ${mB(team)}\n      in ${mB(role)}.`,
    roleNew: (role) => `Il tuo nuovo ruolo: ${role}`,

    wallNotifTitle: (team) => `Bacheca di ${team}`,
    wallSubject: (team) => `Nuovo post in ${team}`,
    wallTitle: (team) => `Nuovo post nella bacheca di ${team}`,
    wallBody: (p) => `${mB(p)} ha scritto qualcosa nella bacheca della squadra.`,

    commentNotifTitle: (tr) => `${tr} — Nuovo commento`,
    commentSubject: (tr) => `Nuovo commento su ${tr}`,
    commentTitle: 'Nuovo commento a un evento',
    commentBody: (c, tr) => `${mB(c)} ha commentato ${mB(tr)}.`,

    updateNotifTitle: (tr) => `${tr} è stato aggiornato`,
    updateNotifMsg: (u) => `${u} ha aggiornato i dettagli dell'evento.`,
    updateSubject: (tr) => `Modifiche a ${tr}`,
    updateTitle: 'Evento aggiornato',
    updateBody: (team, tr) => `L'evento ${mB(tr)} di ${mB(team)} è stato modificato.`,
    updateCurrent: 'Dettagli aggiornati',
    updateBy: 'Aggiornato da:',

    newNotifTitle: 'Nuovo evento!',
    newNotifMsg: (team, tr) => `${team}: è stato aggiunto l'evento ${tr}.`,
    newSubject: (team, tr) => `${team} — Nuovo evento: ${tr}`,
    newTitle: 'È stato aggiunto un nuovo evento!',
    newBody: (team) => `È stato aggiunto un nuovo evento in ${mB(team)}.`,
    newUpcoming: 'Altri prossimi eventi',

    remNotifTitle: (d) => (d === 1 ? 'Domani hai un evento!' : 'Evento tra 3 giorni!'),
    remSubject: (team, d, tr) => `${team} — ${d === 1 ? 'Domani' : 'Tra 3 giorni'}: ${tr}`,
    remTitle: 'Il tuo evento si avvicina',
    remBody: (team) => `Manca poco all'evento di ${mB(team)}.`,
    remUrgency: (d) => (d === 1 ? 'Domani!' : `Mancano ${d} giorni`),

    joinTeamNotifTitle: 'Nuovo membro!',
    joinTeamNotifMsg: (j, team) => `${j} è entrato in ${team}.`,
    joinTeamSubject: (team, j) => `${team} — Nuovo membro: ${j}`,
    joinTeamTitle: 'Un nuovo membro è entrato nella tua squadra!',
    joinTeamBody: (j, team) => `${mB(j)} è entrato in ${mB(team)} come nuovo membro.`,

    joinEvNotifTitle: 'Nuovo partecipante!',
    joinEvNotifMsg: (j, tr) => `${j} partecipa a ${tr}.`,
    joinEvSubject: (tr, j) => `${tr} — Nuovo partecipante: ${j}`,
    joinEvTitle: 'Il tuo evento ha un nuovo partecipante!',
    joinEvBody: (j, team, tr) => `${mB(j)} partecipa all'evento ${mB(tr)} di ${mB(team)}.`,

    likeCommentTitle: 'Il tuo messaggio è piaciuto',
    likeCommentMsg: (n, txt) => `A ${n} piace il tuo messaggio: «${txt}»`,
    likePostTitle: 'Il tuo post è piaciuto',
    likePostMsg: (n, txt) => `A ${n} piace il tuo post nella bacheca della squadra: «${txt}»`,

    badgeTitle: 'Nuovo badge!',
    badgeMsg: (b) => `Hai ottenuto il badge «${b}»!`,

    nudgeTitle: 'Ci manchi! 👋',
    nudgeMsg: 'Dai: organizza un evento o partecipa a uno e ritrova i tuoi amici 💪',

    resetSubject: 'Muuvlink — Reimpostazione password',
    resetTitle: 'Reimpostazione password',
    resetHello: (n) => `Ciao ${mB(n)},`,
    resetBody: `Clicca il pulsante qui sotto per reimpostare la password. Il link è valido per ${mB('1 ora')}.`,
    resetIgnore: 'Se non hai fatto tu questa richiesta, puoi ignorare questa email.',

    contactSubject: 'Abbiamo ricevuto il tuo messaggio — Muuvlink',
    contactThanks: (n) => `Grazie per il tuo messaggio, ${n}!`,
    contactBody: 'Abbiamo ricevuto il tuo messaggio e ti risponderemo al più presto.',
    contactTopic: 'Oggetto:',
  },
};

// Metin getir: tm('el', 'newSubject', team, title). Anahtar o dilde yoksa Türkçeye düşer.
const tm = (lang, key, ...args) => {
  const L = MAIL[mailLang(lang)];
  const v = L[key] ?? MAIL.tr[key];
  return typeof v === 'function' ? v(...args) : v;
};
const roleLabel = (lang, role) => MAIL[mailLang(lang)].roles[role] || MAIL.tr.roles[role] || role;

// Tarihi uzun formata çevirir: "1 Haziran 2026 Pazartesi" (alıcının dilinde)
function formatTrDate(d, lang = 'tr') {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString(MAIL_LOCALE[mailLang(lang)], {
    timeZone: 'UTC',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// Dar ekran (<620px): çerçeve ekrana oturur, iç boşluk küçülür — <style> içindeki
// media query'yi Gmail ve Apple Mail uygular; desteklemeyen istemci 600px'i görür.
function emailWrapper(content, lang = 'tr') {
  const L = mailLang(lang);
  return `<!DOCTYPE html>
<html lang="${L}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Muuvlink</title>
  <style>
    @media only screen and (max-width: 620px) {
      .mv-card { width: 100% !important; border-radius: 0 !important; }
      .mv-pad { padding: 26px 18px !important; }
      .mv-head { padding: 26px 18px !important; }
      .mv-outer { padding: 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" class="mv-outer" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" class="mv-card" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td class="mv-head" style="background:linear-gradient(135deg,#114956,#0e3c47);padding:32px 40px;text-align:center;">
            <img src="https://muuvlink.app/icons/favicon.png" width="56" height="56" alt="Muuvlink" style="border-radius:14px;margin-bottom:14px;display:inline-block;box-shadow:0 4px 16px rgba(0,0,0,0.15);" />
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Muuvlink</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${tm(L, 'wrapTagline')}</p>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td class="mv-pad" style="padding:40px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <!-- Sosyal medya. PNG kullanılıyor: e-posta istemcileri SVG çizmez.
                 Görseller engellenirse alt metni ("Instagram"/"YouTube") okunur
                 kalsın diye img'ye renk ve kalınlık verildi. -->
            <p style="margin:0 0 14px;color:#64748b;font-size:13px;font-weight:600;">${tm(L, 'wrapFollow')}</p>
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
              <tr>
                <td style="padding:0 7px;">
                  <a href="https://www.instagram.com/muuvlinkapp/" style="text-decoration:none;">
                    <img src="https://muuvlink.app/icons/social-instagram.png" width="34" height="34" alt="Instagram"
                         style="display:block;border:0;outline:none;border-radius:9px;color:#114956;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:600;text-decoration:none;" />
                  </a>
                </td>
                <td style="padding:0 7px;">
                  <a href="https://www.youtube.com/@Muuvlink" style="text-decoration:none;">
                    <img src="https://muuvlink.app/icons/social-youtube.png" width="34" height="34" alt="YouTube"
                         style="display:block;border:0;outline:none;border-radius:9px;color:#114956;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:600;text-decoration:none;" />
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#94a3b8;font-size:13px;">${tm(L, 'wrapFooter1')}</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${tm(L, 'wrapFooter2')}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Şablon 1: Takım daveti (kayıtlı kullanıcı)
function inviteEmailExisting({ teamName, teamSport, inviterName, teamId, avatar }, lang = 'tr') {
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(lang, 'inviteExTitle')}</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      ${tm(lang, 'inviteExBody', inviterName, teamName)}
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#114956,#0e3c47);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;text-align:center;line-height:56px;">${avatar || teamName.charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#1e293b;">${teamName}</div>
          <div style="font-size:14px;color:#114956;margin-top:2px;">${teamSport}</div>
        </div>
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}?accept_invite=${teamId}"
         style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;letter-spacing:0.2px;">
        ${tm(lang, 'btnJoinTeam')}
      </a>
    </div>
    <p style="text-align:center;margin:16px 0 0;color:#94a3b8;font-size:13px;">
      ${tm(lang, 'inviteExNote')}
    </p>
  `, lang);
}

// Şablon 2: Takım daveti (yeni kullanıcı)
function inviteEmailNew({ teamName, teamSport, inviterName, avatar }, lang = 'tr') {
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(lang, 'inviteNewTitle')}</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      ${tm(lang, 'inviteNewBody', inviterName, teamName)}
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="width:56px;height:56px;background:linear-gradient(135deg,#114956,#0e3c47);border-radius:12px;font-size:22px;font-weight:800;color:#fff;text-align:center;line-height:56px;margin:0 auto 12px;">${avatar || teamName.charAt(0).toUpperCase()}</div>
      <div style="text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#1e293b;">${teamName}</div>
        <div style="font-size:14px;color:#114956;margin-top:4px;">${teamSport}</div>
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}?auth=register"
         style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        ${tm(lang, 'btnCreateAccount')}
      </a>
    </div>
    <p style="text-align:center;margin:16px 0 0;color:#94a3b8;font-size:13px;">
      ${tm(lang, 'inviteNewNote')}
    </p>
  `, lang);
}

// Rol etiketleri (TR)
const ROLE_LABELS_TR = {
  owner: 'Takım Lideri',
  editor: 'Editör',
  coach: 'Antrenör',
  captain: 'Kaptan',
  member: 'Üye',
  admin: 'Yönetici',
};

// Şablon: Takımdaki rol değişikliği
function roleChangeEmail({ teamName, teamId, newRoleLabel, changerName, avatar }, lang = 'tr') {
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(lang, 'roleTitle')}</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      ${tm(lang, 'roleBody', changerName, teamName, newRoleLabel)}
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;padding-right:16px;">${avatarHtml(avatar, teamName, 56)}</td>
          <td style="vertical-align:middle;">
            <div style="font-size:18px;font-weight:700;color:#1e293b;">${teamName}</div>
            <div style="font-size:14px;color:#114956;margin-top:2px;">${tm(lang, 'roleNew', newRoleLabel)}</div>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}?takim=${teamId}"
         style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;letter-spacing:0.2px;">
        ${tm(lang, 'btnViewTeam')}
      </a>
    </div>
  `, lang);
}

// Şablon 3: Duvar gönderisi bildirimi
// Avatar URL'sini <img> tag'ine, değilse baş harfe çevirir
function avatarHtml(avatarValue, name, size = 40, gradient = 'linear-gradient(135deg,#114956,#0e3c47)') {
  const isUrl = avatarValue && (avatarValue.startsWith('http') || avatarValue.startsWith('/uploads/'));
  const src = isUrl ? (avatarValue.startsWith('/uploads/') ? `${APP_URL}${avatarValue}` : avatarValue) : null;
  if (src) {
    return `<img src="${src}" width="${size}" height="${size}"
              style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;" />`;
  }
  return `<div style="width:${size}px;height:${size}px;background:${gradient};border-radius:50%;
                display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.45)}px;
                text-align:center;line-height:${size}px;color:white;font-weight:700;">
            ${name.charAt(0).toUpperCase()}
          </div>`;
}

function wallPostEmail({ teamName, teamId, posterName, posterAvatar, message, postDate }, lang = 'tr') {
  const truncated = message.length > 300 ? message.slice(0, 300) + '...' : message;
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(lang, 'wallTitle', teamName)}</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;">
      ${tm(lang, 'wallBody', posterName)}
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        ${avatarHtml(posterAvatar, posterName, 40, 'linear-gradient(135deg,#114956,#0e3c47)')}
        <div>
          <div style="font-weight:600;color:#1e293b;font-size:15px;">${posterName}</div>
          <div style="color:#94a3b8;font-size:13px;">${postDate}</div>
        </div>
      </div>
      <div style="color:#334155;font-size:15px;line-height:1.7;white-space:pre-wrap;border-left:3px solid #114956;padding-left:16px;">
        ${truncated}
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/takimlar?takim=${teamId}&tab=duvar"
         style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        ${tm(lang, 'btnGoWall')}
      </a>
    </div>
  `, lang);
}

// Şablon: Etkinlik yorumu bildirimi
function trainingCommentEmail({ commenterName, commenterAvatar, trainingTitle, trainingDate, comment, trainingId }, lang = 'tr') {
  const trainingLink = trainingId ? `${APP_URL}/etkinlikler?etkinlik=${trainingId}` : `${APP_URL}/etkinlikler`;
  const truncated = comment.length > 300 ? comment.slice(0, 300) + '...' : comment;
  const postDate = new Date().toLocaleString(MAIL_LOCALE[mailLang(lang)], {
    timeZone: 'Europe/Istanbul',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(lang, 'commentTitle')}</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;">
      ${tm(lang, 'commentBody', commenterName, trainingTitle)}
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:13px;color:#0e3c47;font-weight:600;">${trainingTitle}</div>
      <div style="font-size:13px;color:#64748b;margin-top:2px;">${trainingDate}</div>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        ${avatarHtml(commenterAvatar, commenterName, 36, 'linear-gradient(135deg,#114956,#0e3c47)')}
        <div>
          <div style="font-weight:600;color:#1e293b;font-size:15px;">${commenterName}</div>
          <div style="color:#94a3b8;font-size:13px;">${postDate}</div>
        </div>
      </div>
      <div style="color:#334155;font-size:15px;line-height:1.7;white-space:pre-wrap;border-left:3px solid #114956;padding-left:16px;">
        ${truncated}
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${trainingLink}"
         style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        ${tm(lang, 'btnViewEvent')}
      </a>
    </div>
  `, lang);
}

// Şablon: Etkinlik güncelleme bildirimi
function trainingUpdateEmail({ teamName, trainingTitle, trainingDate, trainingTime, location, description, updaterName, trainingId }, lang = 'tr') {
  const trainingLink = trainingId ? `${APP_URL}/etkinlikler?etkinlik=${trainingId}` : `${APP_URL}/etkinlikler`;
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(lang, 'updateTitle')}</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      ${tm(lang, 'updateBody', teamName, trainingTitle)}
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="font-size:18px;font-weight:700;color:#0e3c47;margin-bottom:16px;">${tm(lang, 'updateCurrent')}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:80px;">${tm(lang, 'lblDate')}</td><td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingDate}</td></tr>
        ${trainingTime ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">${tm(lang, 'lblTime')}</td><td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingTime.slice(0,5)}</td></tr>` : ''}
        ${location ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">${tm(lang, 'lblLocation')}</td><td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${location}</td></tr>` : ''}
        ${description ? `<tr><td colspan="2" style="padding:12px 0 4px;color:#334155;font-size:14px;line-height:1.6;border-top:1px solid #e6f7f5;margin-top:8px;">${description}</td></tr>` : ''}
      </table>
    </div>

    ${updaterName ? `<p style="color:#94a3b8;font-size:13px;margin:0 0 24px;">${tm(lang, 'updateBy')} <strong style="color:#64748b;">${updaterName}</strong></p>` : ''}

    <div style="text-align:center;">
      <a href="${trainingLink}"
         style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        ${tm(lang, 'btnViewEvent')}
      </a>
    </div>
  `, lang);
}

// Şablon 4: Yeni etkinlik bildirimi
function newTrainingEmail({ teamName, trainingTitle, trainingDate, trainingTime, location, description, upcomingTrainings, trainingId }, lang = 'tr') {
  const trainingLink = trainingId ? `${APP_URL}/etkinlikler?etkinlik=${trainingId}` : `${APP_URL}/etkinlikler`;
  const upcoming = (upcomingTrainings || []).slice(0, 3).map(t => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-weight:600;color:#1e293b;font-size:14px;">${t.title}</div>
        <div style="color:#64748b;font-size:13px;margin-top:2px;">${formatTrDate(t.training_date, lang)} ${t.training_time ? '• ' + t.training_time.slice(0,5) : ''} ${t.location_name ? '• ' + t.location_name : ''}</div>
      </td>
    </tr>
  `).join('');

  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(lang, 'newTitle')}</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      ${tm(lang, 'newBody', teamName)}
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="font-size:20px;font-weight:700;color:#0e3c47;margin-bottom:12px;">${trainingTitle}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">${tm(lang, 'lblDate')}</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingDate}</td></tr>
        ${trainingTime ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">${tm(lang, 'lblTime')}</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingTime.slice(0,5)}</td></tr>` : ''}
        ${location ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">${tm(lang, 'lblLocation')}</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${location}</td></tr>` : ''}
        ${description ? `<tr><td colspan="2" style="padding:12px 0 4px;color:#334155;font-size:14px;line-height:1.6;">${description}</td></tr>` : ''}
      </table>
    </div>

    ${upcoming ? `
    <div style="margin-bottom:28px;">
      <div style="font-weight:700;color:#1e293b;font-size:15px;margin-bottom:12px;">${tm(lang, 'newUpcoming')}</div>
      <table style="width:100%;border-collapse:collapse;">${upcoming}</table>
    </div>` : ''}

    <div style="text-align:center;">
      <a href="${trainingLink}"
         style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        ${tm(lang, 'btnViewEvent')}
      </a>
    </div>
  `, lang);
}

// Şablon 5: Etkinlik hatırlatma
function trainingReminderEmail({ teamName, trainingTitle, trainingDate, trainingTime, location, daysLeft, trainingId }, lang = 'tr') {
  const trainingLink = trainingId ? `${APP_URL}/etkinlikler?etkinlik=${trainingId}` : `${APP_URL}/etkinlikler`;
  const urgency = tm(lang, 'remUrgency', daysLeft);
  const accent  = '#0e3c47'; // kurumsal teal (sarı/amber yerine)
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(lang, 'remTitle')}</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      ${tm(lang, 'remBody', teamName)}
    </p>

    <div style="background:#f0fdf4;border:2px solid ${accent};border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${urgency}</div>
      <div style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:12px;">${trainingTitle}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">${tm(lang, 'lblDate')}</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingDate}</td></tr>
        ${trainingTime ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">${tm(lang, 'lblTime')}</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingTime.slice(0,5)}</td></tr>` : ''}
        ${location ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">${tm(lang, 'lblLocation')}</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${location}</td></tr>` : ''}
      </table>
    </div>

    <div style="text-align:center;">
      <a href="${trainingLink}"
         style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        ${tm(lang, 'btnViewEventLong')}
      </a>
    </div>
  `, lang);
}


// ─── Harekete geçiren e-postalar (takım kuruldu, etkinlik yayında, son çağrı,
// ilk etkinlik) — 7 dil. Metin + paylaşım mesajı burada; HTML activationEmail'de.
// {link} içeren davet mesajları olduğu gibi WhatsApp/Telegram'a gider.
const ACT = {
  tr: {
    yourLink: 'Paylaşım linkin',
    copyHint: 'Linke uzun bas ya da seçip kopyala.',
    readyMsg: 'Arkadaşlarına gönderebileceğin hazır mesaj',
    shareWa: "WhatsApp'ta paylaş", shareTg: "Telegram'da paylaş", shareMail: 'E-postayla gönder', copyBtn: 'Linki kopyala', shareIg: 'Instagram hikâyesi hazırla',
    shareTitle: 'Tek dokunuşla paylaş',
    optOut: 'Bu tür e-postaları Profil › Bildirim tercihleri › Muuvlink\'ten ipuçları\'ndan kapatabilirsin.',
    tc: {
      subject: (n) => `Takımın hazır: ${n} — şimdi arkadaşlarını çağır`,
      title: 'Takımın kuruldu!',
      lead: (n) => `${mB(n)} artık Muuvlink'te. Takımı büyütmenin en hızlı yolu linki bugün paylaşmak.`,
      steps: ['Linki WhatsApp grubuna gönder', 'İlk etkinliğini oluştur — üyelerine anında bildirim gider', 'Katılanlar takımına üye olsun, her etkinlikten haberdar olsun'],
      msg: (n, link) => `${n} takımını Muuvlink'te kurdum. Buluşmaları artık buradan ayarlıyoruz, sen de gel: ${link}`,
      mailSubject: (n) => `${n} takımına katıl`,
      cta: 'Takımını aç →',
      privateNote: "Takımın gizli: link yalnız üyelere açılır. Arkadaşlarını takım sayfasındaki \"Davet Et\" ile e-postayla çağır.",
      privateCta: 'Üye davet et →',
    },
    ec: {
      subject: (n) => `Etkinliğin yayında: ${n} — kontenjanı doldur`,
      title: 'Etkinliğin yayında!',
      lead: (n) => `${mB(n)} artık görünüyor. Şimdi paylaş, kontenjan dolmadan arkadaşların yerini alsın.`,
      steps: ['Linki grubuna ya da arkadaşlarına gönder', 'Soruları etkinlik sayfasındaki mesajlardan yanıtla', 'Etkinlikten önce katılımcılara hatırlatma kendiliğinden gider'],
      msg: (n, when, link) => `Muuvlink'te bir etkinlik açtım: ${n}${when ? `, ${when}` : ''}. Detaylar burada, sen de gel: ${link}`,
      mailSubject: (n) => `${n} — sen de gel`,
      cta: 'Etkinliğini görüntüle →',
      privateNote: 'Bu etkinlik gizli bir takıma ait: link yalnız takım üyelerine açılır. Üyelerine zaten bildirim gitti.',
      privateCta: 'Etkinliğini görüntüle →',
    },
    lc: {
      subject: (n) => `${n} yarın — hâlâ boş yer var`,
      title: 'Yarınki etkinliğinde hâlâ boş yer var',
      lead: (n) => `${mB(n)} yarın ve kontenjan henüz dolmadı. Linki bir kez daha paylaşırsan son yerler de dolabilir.`,
      steps: ['Linki bir kez daha grubuna at', 'Gelmek isteyip unutanları etiketle', 'Buluşma noktasını mesajlarda netleştir'],
      msg: (n, when, link) => `Yarınki ${n} için hâlâ boş yer var. Detaylar burada, sen de gel: ${link}`,
      mailSubject: (n) => `${n} yarın — sen de gel`,
      cta: 'Etkinliğini görüntüle →',
    },
    te: {
      subject: (n) => `${n} ilk buluşmasını bekliyor`,
      title: 'İlk buluşmayı planlama zamanı',
      lead: (n) => `${mB(n)} hazır, sıra ilk buluşmada. Etkinliği oluşturduğun an takımındaki herkese bildirim gider; iki dakikanı alır.`,
      ideasTitle: 'İlk buluşma için birkaç fikir',
      ideas: ['Haftalık sabah antrenmanı', 'Hafta sonu grup buluşması', 'Yeni üyelerle tanışma antrenmanı'],
      cta: 'Etkinlik oluştur →',
    },
    gt: {
      subject: (n) => `${n} daha da kalabalık olabilir`,
      title: 'Takımını daha da kalabalıklaştırmak ister misin?',
      lead: (n) => `${mB(n)} büyüdükçe etkinliklerin de kalabalıklaşır. Linki birkaç spor grubuna daha göndermen, yeni sporcuların takımını bulması için yeterli.`,
      steps: ['Linki spor gruplarına ve arkadaşlarına gönder', 'Instagram hikâyende paylaş', 'Düzenli bir etkinlik aç, gelenler takıma katılsın'],
      msg: (n, link) => `${n} takımı Muuvlink'te. Buluşmaları buradan ayarlıyoruz, sen de gel: ${link}`,
      mailSubject: (n) => `${n} takımına katıl`,
      cta: 'Takımını aç →',
      privateNote: "Takımın gizli: link yalnız üyelere açılır. Yeni üyeleri takım sayfasındaki \"Davet Et\" ile e-postayla çağırabilirsin.",
      privateCta: 'Üye davet et →',
    },
    ge: {
      subject: (n) => `${n} daha çok kişiye ulaşabilir`,
      title: 'Etkinliğini daha çok kişiye ulaştırmak ister misin?',
      lead: (n) => `${mB(n)} ne kadar çok kişiye ulaşırsa buluşma o kadar keyifli olur. Linki birkaç spor grubuna daha göndermen, yeni sporcuların da gelmesi için yeterli.`,
      steps: ['Linki spor gruplarına ve arkadaşlarına gönder', 'Instagram hikâyende paylaş', 'Soruları etkinlik sayfasındaki mesajlardan yanıtla'],
      msg: (n, when, link) => `Muuvlink'te bir etkinlik açtım: ${n}${when ? `, ${when}` : ''}. Detaylar burada, sen de gel: ${link}`,
      mailSubject: (n) => `${n} — sen de gel`,
      cta: 'Etkinliğini görüntüle →',
      privateNote: 'Bu etkinlik gizli bir takıma ait: link yalnız takım üyelerine açılır.',
      privateCta: 'Etkinliğini görüntüle →',
    },
  },

  en: {
    yourLink: 'Your share link',
    copyHint: 'Press and hold the link, or select it to copy.',
    readyMsg: 'A ready-made message for your friends',
    shareWa: 'Share on WhatsApp', shareTg: 'Share on Telegram', shareMail: 'Send by email', copyBtn: 'Copy link', shareIg: 'Make an Instagram story',
    shareTitle: 'Share in one tap',
    optOut: 'You can turn these emails off in Profile › Notification preferences › Tips from Muuvlink.',
    tc: {
      subject: (n) => `Your team is ready: ${n} — now bring your friends`,
      title: 'Your team is live!',
      lead: (n) => `${mB(n)} is now on Muuvlink. The fastest way to grow it is to share the link today.`,
      steps: ['Send the link to your WhatsApp group', 'Create your first event — members are notified instantly', 'Let people join the team so they hear about every event'],
      msg: (n, link) => `I started the team ${n} on Muuvlink. We plan our meetups here now — come join: ${link}`,
      mailSubject: (n) => `Join the team ${n}`,
      cta: 'Open your team →',
      privateNote: 'Your team is private: the link only opens for members. Invite friends by email with "Invite" on the team page.',
      privateCta: 'Invite members →',
    },
    ec: {
      subject: (n) => `Your event is live: ${n} — fill the spots`,
      title: 'Your event is live!',
      lead: (n) => `${mB(n)} is now visible. Share it now so your friends grab a spot before it fills up.`,
      steps: ['Send the link to your group or friends', 'Answer questions in the event messages', 'Participants get a reminder automatically before the start'],
      msg: (n, when, link) => `I set up an event on Muuvlink: ${n}${when ? `, ${when}` : ''}. Details here — come along: ${link}`,
      mailSubject: (n) => `${n} — come along`,
      cta: 'View your event →',
      privateNote: 'This event belongs to a private team: the link only opens for team members. Your members have already been notified.',
      privateCta: 'View your event →',
    },
    lc: {
      subject: (n) => `${n} is tomorrow — spots still open`,
      title: "There are still open spots at your event tomorrow",
      lead: (n) => `${mB(n)} is tomorrow and it isn't full yet. Share the link once more and the last spots could fill up.`,
      steps: ['Post the link to your group once more', 'Tag the friends who wanted to come', 'Confirm the meeting point in the messages'],
      msg: (n, when, link) => `There are still open spots for ${n} tomorrow. Details here — come along: ${link}`,
      mailSubject: (n) => `${n} tomorrow — come along`,
      cta: 'View your event →',
    },
    te: {
      subject: (n) => `${n} is waiting for its first meetup`,
      title: "Time to plan your first meetup",
      lead: (n) => `${mB(n)} is ready — next up is the first meetup. The moment you create an event, everyone on your team is notified. It takes two minutes.`,
      ideasTitle: "A few ideas for the first meetup",
      ideas: ["A weekly morning session", "A weekend group meetup", "A get-to-know-you session for new members"],
      cta: 'Create an event →',
    },
    gt: {
      subject: (n) => `${n} could be even bigger`,
      title: 'Want to grow your team even more?',
      lead: (n) => `The bigger ${mB(n)} gets, the busier your events will be. Sharing the link in a few more sports groups is all it takes for new athletes to find your team.`,
      steps: ["Send the link to sports groups and friends", "Share it in your Instagram story", "Run a regular event so newcomers join the team"],
      msg: (n, link) => `The team ${n} is on Muuvlink. We plan our meetups here — come join: ${link}`,
      mailSubject: (n) => `Join the team ${n}`,
      cta: 'Open your team →',
      privateNote: 'Your team is private: the link only opens for members. Invite new members by email with "Invite" on the team page.',
      privateCta: 'Invite members →',
    },
    ge: {
      subject: (n) => `${n} could reach more people`,
      title: 'Want your event to reach more people?',
      lead: (n) => `The more people ${mB(n)} reaches, the better the meetup. Sharing the link in a few more sports groups is all it takes to bring in new athletes.`,
      steps: ["Send the link to sports groups and friends", "Share it in your Instagram story", "Answer questions in the event messages"],
      msg: (n, when, link) => `I set up an event on Muuvlink: ${n}${when ? `, ${when}` : ''}. Details here — come along: ${link}`,
      mailSubject: (n) => `${n} — come along`,
      cta: 'View your event →',
      privateNote: 'This event belongs to a private team: the link only opens for team members.',
      privateCta: 'View your event →',
    },
  },

  de: {
    yourLink: 'Dein Link zum Teilen',
    copyHint: 'Link gedrückt halten oder markieren und kopieren.',
    readyMsg: 'Eine fertige Nachricht für deine Freunde',
    shareWa: 'Auf WhatsApp teilen', shareTg: 'Auf Telegram teilen', shareMail: 'Per E-Mail senden', copyBtn: 'Link kopieren', shareIg: 'Instagram-Story erstellen',
    shareTitle: 'Mit einem Tipp teilen',
    optOut: 'Du kannst diese E-Mails unter Profil › Benachrichtigungen › Tipps von Muuvlink abschalten.',
    tc: {
      subject: (n) => `Dein Team ist bereit: ${n} — jetzt Freunde einladen`,
      title: 'Dein Team ist online!',
      lead: (n) => `${mB(n)} ist jetzt auf Muuvlink. Am schnellsten wächst es, wenn du den Link noch heute teilst.`,
      steps: ['Schick den Link in deine WhatsApp-Gruppe', 'Erstelle dein erstes Event — alle Mitglieder werden sofort benachrichtigt', 'Lass die Leute dem Team beitreten, damit sie jedes Event mitbekommen'],
      msg: (n, link) => `Ich habe das Team ${n} auf Muuvlink gegründet. Unsere Treffen planen wir jetzt hier – komm dazu: ${link}`,
      mailSubject: (n) => `Tritt dem Team ${n} bei`,
      cta: 'Team öffnen →',
      privateNote: 'Dein Team ist privat: Der Link öffnet sich nur für Mitglieder. Lade Freunde über „Einladen“ auf der Teamseite per E-Mail ein.',
      privateCta: 'Mitglieder einladen →',
    },
    ec: {
      subject: (n) => `Dein Event ist online: ${n} — fülle die Plätze`,
      title: 'Dein Event ist online!',
      lead: (n) => `${mB(n)} ist jetzt sichtbar. Teile es jetzt, damit sich deine Freunde einen Platz sichern.`,
      steps: ['Schick den Link an deine Gruppe oder Freunde', 'Beantworte Fragen in den Event-Nachrichten', 'Vor dem Start bekommen alle automatisch eine Erinnerung'],
      msg: (n, when, link) => `Ich habe auf Muuvlink ein Event erstellt: ${n}${when ? `, ${when}` : ''}. Alle Details hier – komm mit: ${link}`,
      mailSubject: (n) => `${n} – komm mit`,
      cta: 'Event ansehen →',
      privateNote: 'Dieses Event gehört zu einem privaten Team: Der Link öffnet sich nur für Teammitglieder. Deine Mitglieder wurden bereits benachrichtigt.',
      privateCta: 'Event ansehen →',
    },
    lc: {
      subject: (n) => `${n} ist morgen – es gibt noch freie Plätze`,
      title: "Für dein Event morgen gibt es noch freie Plätze",
      lead: (n) => `${mB(n)} ist morgen und noch nicht ausgebucht. Teile den Link noch einmal, dann sind vielleicht auch die letzten Plätze weg.`,
      steps: ['Poste den Link noch einmal in deine Gruppe', 'Markiere die Freunde, die mitkommen wollten', 'Kläre den Treffpunkt in den Nachrichten'],
      msg: (n, when, link) => `Für ${n} morgen gibt es noch freie Plätze. Alle Details hier – komm mit: ${link}`,
      mailSubject: (n) => `${n} morgen – komm mit`,
      cta: 'Event ansehen →',
    },
    te: {
      subject: (n) => `${n} wartet auf das erste Treffen`,
      title: "Zeit, das erste Treffen zu planen",
      lead: (n) => `${mB(n)} ist bereit – jetzt fehlt nur noch das erste Treffen. Sobald du ein Event erstellst, wird dein ganzes Team benachrichtigt. Das dauert zwei Minuten.`,
      ideasTitle: "Ein paar Ideen für das erste Treffen",
      ideas: ["Ein wöchentliches Training am Morgen", "Ein Gruppentreffen am Wochenende", "Ein Kennenlern-Training für neue Mitglieder"],
      cta: 'Event erstellen →',
    },
    gt: {
      subject: (n) => `${n} kann noch größer werden`,
      title: 'Möchtest du dein Team noch größer machen?',
      lead: (n) => `Je größer ${mB(n)} wird, desto voller werden deine Events. Teile den Link in ein paar weiteren Sportgruppen – mehr braucht es nicht, damit neue Sportler dein Team finden.`,
      steps: ["Schick den Link an Sportgruppen und Freunde", "Teile ihn in deiner Instagram-Story", "Starte ein regelmäßiges Event, damit Neue ins Team kommen"],
      msg: (n, link) => `Das Team ${n} ist auf Muuvlink. Unsere Treffen planen wir hier – komm dazu: ${link}`,
      mailSubject: (n) => `Tritt dem Team ${n} bei`,
      cta: 'Team öffnen →',
      privateNote: 'Dein Team ist privat: Der Link öffnet sich nur für Mitglieder. Lade neue Mitglieder über „Einladen“ auf der Teamseite per E-Mail ein.',
      privateCta: 'Mitglieder einladen →',
    },
    ge: {
      subject: (n) => `${n} kann noch mehr Leute erreichen`,
      title: 'Soll dein Event mehr Leute erreichen?',
      lead: (n) => `Je mehr Leute ${mB(n)} erreicht, desto schöner wird das Treffen. Teile den Link in ein paar weiteren Sportgruppen, damit auch neue Sportler dazukommen.`,
      steps: ["Schick den Link an Sportgruppen und Freunde", "Teile ihn in deiner Instagram-Story", "Beantworte Fragen in den Event-Nachrichten"],
      msg: (n, when, link) => `Ich habe auf Muuvlink ein Event erstellt: ${n}${when ? `, ${when}` : ''}. Alle Details hier – komm mit: ${link}`,
      mailSubject: (n) => `${n} – komm mit`,
      cta: 'Event ansehen →',
      privateNote: 'Dieses Event gehört zu einem privaten Team: Der Link öffnet sich nur für Teammitglieder.',
      privateCta: 'Event ansehen →',
    },
  },

  el: {
    yourLink: 'Ο σύνδεσμός σου για κοινοποίηση',
    copyHint: 'Κράτησε πατημένο τον σύνδεσμο ή επίλεξέ τον για αντιγραφή.',
    readyMsg: 'Ένα έτοιμο μήνυμα για τους φίλους σου',
    shareWa: 'Κοινοποίηση στο WhatsApp', shareTg: 'Κοινοποίηση στο Telegram', shareMail: 'Αποστολή με email', copyBtn: 'Αντιγραφή συνδέσμου', shareIg: 'Φτιάξε Instagram story',
    shareTitle: 'Κοινοποίηση με ένα πάτημα',
    optOut: 'Μπορείς να απενεργοποιήσεις αυτά τα email από Προφίλ › Προτιμήσεις ειδοποιήσεων › Συμβουλές από το Muuvlink.',
    tc: {
      subject: (n) => `Η ομάδα σου είναι έτοιμη: ${n} — κάλεσε τώρα τους φίλους σου`,
      title: 'Η ομάδα σου δημιουργήθηκε!',
      lead: (n) => `Η ομάδα ${mB(n)} είναι πλέον στο Muuvlink. Ο πιο γρήγορος τρόπος να μεγαλώσει είναι να μοιραστείς τον σύνδεσμο σήμερα.`,
      steps: ['Στείλε τον σύνδεσμο στην ομάδα σου στο WhatsApp', 'Δημιούργησε την πρώτη σου εκδήλωση — τα μέλη ειδοποιούνται αμέσως', 'Όσοι έρχονται, ας γίνουν μέλη για να μαθαίνουν κάθε εκδήλωση'],
      msg: (n, link) => `Έφτιαξα την ομάδα ${n} στο Muuvlink. Τις συναντήσεις μας τις κανονίζουμε πλέον εδώ — έλα κι εσύ: ${link}`,
      mailSubject: (n) => `Γίνε μέλος της ομάδας ${n}`,
      cta: 'Άνοιξε την ομάδα σου →',
      privateNote: 'Η ομάδα σου είναι ιδιωτική: ο σύνδεσμος ανοίγει μόνο για μέλη. Κάλεσε φίλους με email από το «Πρόσκληση» στη σελίδα της ομάδας.',
      privateCta: 'Κάλεσε μέλη →',
    },
    ec: {
      subject: (n) => `Η εκδήλωσή σου δημοσιεύτηκε: ${n} — γέμισε τις θέσεις`,
      title: 'Η εκδήλωσή σου δημοσιεύτηκε!',
      lead: (n) => `Η εκδήλωση ${mB(n)} είναι πλέον ορατή. Μοιράσου την τώρα, για να κλείσουν θέση οι φίλοι σου πριν γεμίσει.`,
      steps: ['Στείλε τον σύνδεσμο στην παρέα ή στους φίλους σου', 'Απάντησε στις ερωτήσεις στα μηνύματα της εκδήλωσης', 'Πριν την έναρξη οι συμμετέχοντες παίρνουν αυτόματα υπενθύμιση'],
      msg: (n, when, link) => `Άνοιξα μια εκδήλωση στο Muuvlink: ${n}${when ? `, ${when}` : ''}. Όλες οι λεπτομέρειες εδώ — έλα κι εσύ: ${link}`,
      mailSubject: (n) => `${n} — έλα κι εσύ`,
      cta: 'Δες την εκδήλωσή σου →',
      privateNote: 'Αυτή η εκδήλωση ανήκει σε ιδιωτική ομάδα: ο σύνδεσμος ανοίγει μόνο για τα μέλη της. Τα μέλη σου έχουν ήδη ειδοποιηθεί.',
      privateCta: 'Δες την εκδήλωσή σου →',
    },
    lc: {
      subject: (n) => `${n} αύριο — υπάρχουν ακόμη ελεύθερες θέσεις`,
      title: "Η αυριανή εκδήλωσή σου έχει ακόμη ελεύθερες θέσεις",
      lead: (n) => `Η εκδήλωση ${mB(n)} είναι αύριο και δεν έχει γεμίσει ακόμη. Μοιράσου τον σύνδεσμο άλλη μία φορά και μπορεί να γεμίσουν και οι τελευταίες θέσεις.`,
      steps: ['Ξαναστείλε τον σύνδεσμο στην ομάδα σου', 'Κάνε tag τους φίλους που ήθελαν να έρθουν', 'Επιβεβαίωσε το σημείο συνάντησης στα μηνύματα'],
      msg: (n, when, link) => `Υπάρχουν ακόμη ελεύθερες θέσεις για αύριο: ${n}. Όλες οι λεπτομέρειες εδώ — έλα κι εσύ: ${link}`,
      mailSubject: (n) => `${n} αύριο — έλα κι εσύ`,
      cta: 'Δες την εκδήλωσή σου →',
    },
    te: {
      subject: (n) => `${n}: ώρα για την πρώτη συνάντηση`,
      title: "Ώρα να οργανώσεις την πρώτη συνάντηση",
      lead: (n) => `Η ομάδα ${mB(n)} είναι έτοιμη — σειρά έχει η πρώτη συνάντηση. Μόλις δημιουργήσεις μια εκδήλωση, όλη η ομάδα σου ειδοποιείται. Σου παίρνει δύο λεπτά.`,
      ideasTitle: "Μερικές ιδέες για την πρώτη συνάντηση",
      ideas: ["Μια εβδομαδιαία πρωινή προπόνηση", "Μια ομαδική συνάντηση το Σαββατοκύριακο", "Μια προπόνηση γνωριμίας για τα νέα μέλη"],
      cta: 'Δημιούργησε εκδήλωση →',
    },
    gt: {
      subject: (n) => `Η ομάδα ${n} μπορεί να μεγαλώσει κι άλλο`,
      title: 'Θέλεις να μεγαλώσεις κι άλλο την ομάδα σου;',
      lead: (n) => `Όσο μεγαλώνει η ομάδα ${mB(n)}, τόσο πιο γεμάτες γίνονται οι εκδηλώσεις σου. Αρκεί να στείλεις τον σύνδεσμο σε μερικές ακόμη αθλητικές ομάδες για να βρουν την ομάδα σου νέοι αθλητές.`,
      steps: ["Στείλε τον σύνδεσμο σε αθλητικές ομάδες και φίλους", "Μοιράσου τον στο Instagram story σου", "Οργάνωσε μια τακτική εκδήλωση, ώστε οι νέοι να μπαίνουν στην ομάδα"],
      msg: (n, link) => `Η ομάδα ${n} είναι στο Muuvlink. Τις συναντήσεις μας τις κανονίζουμε εδώ — έλα κι εσύ: ${link}`,
      mailSubject: (n) => `Γίνε μέλος της ομάδας ${n}`,
      cta: 'Άνοιξε την ομάδα σου →',
      privateNote: 'Η ομάδα σου είναι ιδιωτική: ο σύνδεσμος ανοίγει μόνο για μέλη. Κάλεσε νέα μέλη με email από το «Πρόσκληση» στη σελίδα της ομάδας.',
      privateCta: 'Κάλεσε μέλη →',
    },
    ge: {
      subject: (n) => `${n}: μπορεί να φτάσει σε περισσότερους`,
      title: 'Θέλεις η εκδήλωσή σου να φτάσει σε περισσότερους;',
      lead: (n) => `Όσο περισσότερους φτάνει η εκδήλωση ${mB(n)}, τόσο καλύτερη η συνάντηση. Στείλε τον σύνδεσμο σε μερικές ακόμη αθλητικές ομάδες για να έρθουν και νέοι αθλητές.`,
      steps: ["Στείλε τον σύνδεσμο σε αθλητικές ομάδες και φίλους", "Μοιράσου τον στο Instagram story σου", "Απάντησε σε ερωτήσεις στα μηνύματα της εκδήλωσης"],
      msg: (n, when, link) => `Άνοιξα μια εκδήλωση στο Muuvlink: ${n}${when ? `, ${when}` : ''}. Όλες οι λεπτομέρειες εδώ — έλα κι εσύ: ${link}`,
      mailSubject: (n) => `${n} — έλα κι εσύ`,
      cta: 'Δες την εκδήλωσή σου →',
      privateNote: 'Αυτή η εκδήλωση ανήκει σε ιδιωτική ομάδα: ο σύνδεσμος ανοίγει μόνο για τα μέλη της.',
      privateCta: 'Δες την εκδήλωσή σου →',
    },
  },

  es: {
    yourLink: 'Tu enlace para compartir',
    copyHint: 'Mantén pulsado el enlace o selecciónalo para copiarlo.',
    readyMsg: 'Un mensaje listo para tus amigos',
    shareWa: 'Compartir en WhatsApp', shareTg: 'Compartir en Telegram', shareMail: 'Enviar por correo', copyBtn: 'Copiar enlace', shareIg: 'Crear historia de Instagram',
    shareTitle: 'Comparte con un toque',
    optOut: 'Puedes desactivar estos correos en Perfil › Preferencias de notificaciones › Consejos de Muuvlink.',
    tc: {
      subject: (n) => `Tu equipo está listo: ${n} — ahora invita a tus amigos`,
      title: '¡Tu equipo ya está en marcha!',
      lead: (n) => `${mB(n)} ya está en Muuvlink. La forma más rápida de hacerlo crecer es compartir el enlace hoy.`,
      steps: ['Envía el enlace a tu grupo de WhatsApp', 'Crea tu primer evento: los miembros reciben un aviso al instante', 'Que quien se apunte se una al equipo y se entere de cada evento'],
      msg: (n, link) => `He creado el equipo ${n} en Muuvlink. Ahora organizamos los encuentros aquí, vente: ${link}`,
      mailSubject: (n) => `Únete al equipo ${n}`,
      cta: 'Abrir tu equipo →',
      privateNote: 'Tu equipo es privado: el enlace solo se abre para miembros. Invita a tus amigos por correo con «Invitar» en la página del equipo.',
      privateCta: 'Invitar miembros →',
    },
    ec: {
      subject: (n) => `Tu evento ya está publicado: ${n} — llena las plazas`,
      title: '¡Tu evento ya está publicado!',
      lead: (n) => `${mB(n)} ya se puede ver. Compártelo ahora para que tus amigos se apunten antes de que se llene.`,
      steps: ['Envía el enlace a tu grupo o a tus amigos', 'Responde a las dudas en los mensajes del evento', 'Antes del inicio, los participantes reciben un recordatorio automático'],
      msg: (n, when, link) => `He creado un evento en Muuvlink: ${n}${when ? `, ${when}` : ''}. Todos los detalles aquí, vente: ${link}`,
      mailSubject: (n) => `${n}: vente`,
      cta: 'Ver tu evento →',
      privateNote: 'Este evento es de un equipo privado: el enlace solo se abre para sus miembros. Ya hemos avisado a tus miembros.',
      privateCta: 'Ver tu evento →',
    },
    lc: {
      subject: (n) => `${n} es mañana: aún quedan plazas libres`,
      title: "Tu evento de mañana aún tiene plazas libres",
      lead: (n) => `${mB(n)} es mañana y aún no está completo. Comparte el enlace una vez más y las últimas plazas podrían llenarse.`,
      steps: ['Vuelve a poner el enlace en tu grupo', 'Menciona a los amigos que querían venir', 'Confirma el punto de encuentro en los mensajes'],
      msg: (n, when, link) => `Aún quedan plazas libres para ${n} mañana. Todos los detalles aquí, vente: ${link}`,
      mailSubject: (n) => `${n} mañana: vente`,
      cta: 'Ver tu evento →',
    },
    te: {
      subject: (n) => `${n} espera su primer encuentro`,
      title: "Es hora de planear el primer encuentro",
      lead: (n) => `${mB(n)} ya está listo; ahora toca el primer encuentro. En cuanto crees un evento, todo tu equipo recibe una notificación. Te lleva dos minutos.`,
      ideasTitle: "Algunas ideas para el primer encuentro",
      ideas: ["Un entrenamiento semanal por la mañana", "Un encuentro de grupo el fin de semana", "Un entrenamiento para conocer a los nuevos miembros"],
      cta: 'Crear un evento →',
    },
    gt: {
      subject: (n) => `${n} puede crecer todavía más`,
      title: '¿Quieres que tu equipo sea aún más grande?',
      lead: (n) => `Cuanto más crezca ${mB(n)}, más llenos estarán tus eventos. Basta con enviar el enlace a unos cuantos grupos deportivos más para que nuevos deportistas encuentren tu equipo.`,
      steps: ["Envía el enlace a grupos deportivos y amigos", "Compártelo en tu historia de Instagram", "Organiza un evento regular para que los nuevos se unan al equipo"],
      msg: (n, link) => `El equipo ${n} está en Muuvlink. Organizamos los encuentros aquí, vente: ${link}`,
      mailSubject: (n) => `Únete al equipo ${n}`,
      cta: 'Abrir tu equipo →',
      privateNote: 'Tu equipo es privado: el enlace solo se abre para miembros. Invita a nuevos miembros por correo con «Invitar» en la página del equipo.',
      privateCta: 'Invitar miembros →',
    },
    ge: {
      subject: (n) => `${n} puede llegar a más gente`,
      title: '¿Quieres que tu evento llegue a más gente?',
      lead: (n) => `Cuanta más gente llegue a ${mB(n)}, mejor será el encuentro. Basta con enviar el enlace a unos cuantos grupos deportivos más para que se sumen nuevos deportistas.`,
      steps: ["Envía el enlace a grupos deportivos y amigos", "Compártelo en tu historia de Instagram", "Responde las preguntas en los mensajes del evento"],
      msg: (n, when, link) => `He creado un evento en Muuvlink: ${n}${when ? `, ${when}` : ''}. Todos los detalles aquí, vente: ${link}`,
      mailSubject: (n) => `${n}: vente`,
      cta: 'Ver tu evento →',
      privateNote: 'Este evento es de un equipo privado: el enlace solo se abre para sus miembros.',
      privateCta: 'Ver tu evento →',
    },
  },

  fr: {
    yourLink: 'Ton lien à partager',
    copyHint: 'Appuie longuement sur le lien ou sélectionne-le pour le copier.',
    readyMsg: 'Un message tout prêt pour tes amis',
    shareWa: 'Partager sur WhatsApp', shareTg: 'Partager sur Telegram', shareMail: 'Envoyer par e-mail', copyBtn: 'Copier le lien', shareIg: 'Créer une story Instagram',
    shareTitle: 'Partage en un clic',
    optOut: 'Tu peux désactiver ces e-mails dans Profil › Préférences de notification › Conseils de Muuvlink.',
    tc: {
      subject: (n) => `Ton équipe est prête : ${n} — invite tes amis`,
      title: 'Ton équipe est en ligne !',
      lead: (n) => `${mB(n)} est maintenant sur Muuvlink. Le meilleur moyen de la faire grandir : partager le lien dès aujourd'hui.`,
      steps: ['Envoie le lien dans ton groupe WhatsApp', 'Crée ton premier événement : les membres sont prévenus tout de suite', 'Invite ceux qui viennent à rejoindre l\'équipe pour ne rien rater'],
      msg: (n, link) => `J'ai créé l'équipe ${n} sur Muuvlink. On organise nos sorties ici maintenant, viens nous rejoindre : ${link}`,
      mailSubject: (n) => `Rejoins l'équipe ${n}`,
      cta: 'Ouvrir ton équipe →',
      privateNote: 'Ton équipe est privée : le lien ne s\'ouvre que pour les membres. Invite tes amis par e-mail avec « Inviter » sur la page de l\'équipe.',
      privateCta: 'Inviter des membres →',
    },
    ec: {
      subject: (n) => `Ton événement est en ligne : ${n} — remplis les places`,
      title: 'Ton événement est en ligne !',
      lead: (n) => `${mB(n)} est maintenant visible. Partage-le maintenant pour que tes amis réservent leur place avant que ce soit complet.`,
      steps: ['Envoie le lien à ton groupe ou à tes amis', 'Réponds aux questions dans les messages de l\'événement', 'Avant le début, les participants reçoivent un rappel automatique'],
      msg: (n, when, link) => `J'ai créé un événement sur Muuvlink : ${n}${when ? `, ${when}` : ''}. Tous les détails ici, viens avec nous : ${link}`,
      mailSubject: (n) => `${n} : viens avec nous`,
      cta: 'Voir ton événement →',
      privateNote: 'Cet événement appartient à une équipe privée : le lien ne s\'ouvre que pour ses membres. Tes membres ont déjà été prévenus.',
      privateCta: 'Voir ton événement →',
    },
    lc: {
      subject: (n) => `${n} a lieu demain : il reste des places`,
      title: "Il reste des places pour ton événement de demain",
      lead: (n) => `${mB(n)} a lieu demain et ce n'est pas encore complet. Partage le lien une fois de plus et les dernières places pourraient partir.`,
      steps: ['Repartage le lien dans ton groupe', 'Identifie les amis qui voulaient venir', 'Confirme le point de rendez-vous dans les messages'],
      msg: (n, when, link) => `Il reste des places pour ${n} demain. Tous les détails ici, viens avec nous : ${link}`,
      mailSubject: (n) => `${n} demain : viens avec nous`,
      cta: 'Voir ton événement →',
    },
    te: {
      subject: (n) => `${n} attend sa première sortie`,
      title: "Il est temps de planifier la première sortie",
      lead: (n) => `L'équipe ${mB(n)} est prête, place à la première sortie. Dès que tu crées un événement, toute ton équipe est prévenue. Ça te prend deux minutes.`,
      ideasTitle: "Quelques idées pour la première sortie",
      ideas: ["Un entraînement hebdomadaire le matin", "Une sortie de groupe le week-end", "Un entraînement découverte pour les nouveaux membres"],
      cta: 'Créer un événement →',
    },
    gt: {
      subject: (n) => `${n} peut encore grandir`,
      title: 'Envie de faire grandir encore ton équipe ?',
      lead: (n) => `Plus ${mB(n)} grandit, plus tes événements seront animés. Il suffit d'envoyer le lien à quelques groupes sportifs de plus pour que de nouveaux sportifs trouvent ton équipe.`,
      steps: ["Envoie le lien à des groupes sportifs et à tes amis", "Partage-le dans ta story Instagram", "Lance un événement régulier pour que les nouveaux rejoignent l'équipe"],
      msg: (n, link) => `L'équipe ${n} est sur Muuvlink. On organise nos sorties ici, viens nous rejoindre : ${link}`,
      mailSubject: (n) => `Rejoins l'équipe ${n}`,
      cta: 'Ouvrir ton équipe →',
      privateNote: 'Ton équipe est privée : le lien ne s\'ouvre que pour les membres. Invite de nouveaux membres par e-mail avec « Inviter » sur la page de l\'équipe.',
      privateCta: 'Inviter des membres →',
    },
    ge: {
      subject: (n) => `${n} peut toucher plus de monde`,
      title: 'Envie que ton événement touche plus de monde ?',
      lead: (n) => `Plus ${mB(n)} touche de monde, meilleure sera la sortie. Il suffit d'envoyer le lien à quelques groupes sportifs de plus pour attirer de nouveaux sportifs.`,
      steps: ["Envoie le lien à des groupes sportifs et à tes amis", "Partage-le dans ta story Instagram", "Réponds aux questions dans les messages de l'événement"],
      msg: (n, when, link) => `J'ai créé un événement sur Muuvlink : ${n}${when ? `, ${when}` : ''}. Tous les détails ici, viens avec nous : ${link}`,
      mailSubject: (n) => `${n} : viens avec nous`,
      cta: 'Voir ton événement →',
      privateNote: 'Cet événement appartient à une équipe privée : le lien ne s\'ouvre que pour ses membres.',
      privateCta: 'Voir ton événement →',
    },
  },

  it: {
    yourLink: 'Il tuo link da condividere',
    copyHint: 'Tieni premuto sul link o selezionalo per copiarlo.',
    readyMsg: 'Un messaggio pronto per i tuoi amici',
    shareWa: 'Condividi su WhatsApp', shareTg: 'Condividi su Telegram', shareMail: 'Invia per email', copyBtn: 'Copia link', shareIg: 'Crea una storia Instagram',
    shareTitle: 'Condividi con un tocco',
    optOut: 'Puoi disattivare queste email da Profilo › Preferenze notifiche › Consigli da Muuvlink.',
    tc: {
      subject: (n) => `La tua squadra è pronta: ${n} — ora invita i tuoi amici`,
      title: 'La tua squadra è online!',
      lead: (n) => `${mB(n)} ora è su Muuvlink. Il modo più veloce per farla crescere è condividere il link oggi stesso.`,
      steps: ['Manda il link al tuo gruppo WhatsApp', 'Crea il tuo primo evento: i membri ricevono subito una notifica', 'Chi partecipa entri nella squadra, così saprà di ogni evento'],
      msg: (n, link) => `Ho creato la squadra ${n} su Muuvlink. Ora organizziamo gli incontri qui, vieni anche tu: ${link}`,
      mailSubject: (n) => `Entra nella squadra ${n}`,
      cta: 'Apri la tua squadra →',
      privateNote: 'La tua squadra è privata: il link si apre solo per i membri. Invita gli amici via email con «Invita» nella pagina della squadra.',
      privateCta: 'Invita membri →',
    },
    ec: {
      subject: (n) => `Il tuo evento è online: ${n} — riempi i posti`,
      title: 'Il tuo evento è online!',
      lead: (n) => `${mB(n)} ora è visibile. Condividilo subito, così i tuoi amici prendono il posto prima che si riempia.`,
      steps: ['Manda il link al tuo gruppo o ai tuoi amici', 'Rispondi alle domande nei messaggi dell\'evento', 'Prima dell\'inizio i partecipanti ricevono un promemoria automatico'],
      msg: (n, when, link) => `Ho creato un evento su Muuvlink: ${n}${when ? `, ${when}` : ''}. Tutti i dettagli qui, vieni anche tu: ${link}`,
      mailSubject: (n) => `${n}: vieni anche tu`,
      cta: 'Vedi il tuo evento →',
      privateNote: 'Questo evento appartiene a una squadra privata: il link si apre solo per i suoi membri. I tuoi membri sono già stati avvisati.',
      privateCta: 'Vedi il tuo evento →',
    },
    lc: {
      subject: (n) => `${n} è domani: ci sono ancora posti liberi`,
      title: "Il tuo evento di domani ha ancora posti liberi",
      lead: (n) => `${mB(n)} è domani e non è ancora al completo. Condividi il link ancora una volta e anche gli ultimi posti potrebbero riempirsi.`,
      steps: ['Rimetti il link nel tuo gruppo', 'Tagga gli amici che volevano venire', 'Conferma il punto di ritrovo nei messaggi'],
      msg: (n, when, link) => `Ci sono ancora posti liberi per ${n} domani. Tutti i dettagli qui, vieni anche tu: ${link}`,
      mailSubject: (n) => `${n} domani: vieni anche tu`,
      cta: 'Vedi il tuo evento →',
    },
    te: {
      subject: (n) => `${n} aspetta il primo incontro`,
      title: "È ora di organizzare il primo incontro",
      lead: (n) => `La squadra ${mB(n)} è pronta, ora tocca al primo incontro. Appena crei un evento, tutta la squadra riceve una notifica. Ci vogliono due minuti.`,
      ideasTitle: "Qualche idea per il primo incontro",
      ideas: ["Un allenamento settimanale al mattino", "Un incontro di gruppo nel weekend", "Un allenamento di benvenuto per i nuovi membri"],
      cta: 'Crea un evento →',
    },
    gt: {
      subject: (n) => `${n} può crescere ancora`,
      title: 'Vuoi far crescere ancora la tua squadra?',
      lead: (n) => `Più cresce ${mB(n)}, più i tuoi eventi saranno affollati. Basta inviare il link a qualche altro gruppo sportivo perché nuovi sportivi trovino la tua squadra.`,
      steps: ["Invia il link a gruppi sportivi e amici", "Condividilo nella tua storia Instagram", "Organizza un evento regolare, così i nuovi entrano in squadra"],
      msg: (n, link) => `La squadra ${n} è su Muuvlink. Organizziamo gli incontri qui, vieni anche tu: ${link}`,
      mailSubject: (n) => `Entra nella squadra ${n}`,
      cta: 'Apri la tua squadra →',
      privateNote: 'La tua squadra è privata: il link si apre solo per i membri. Invita nuovi membri via email con «Invita» nella pagina della squadra.',
      privateCta: 'Invita membri →',
    },
    ge: {
      subject: (n) => `${n} può raggiungere più persone`,
      title: 'Vuoi che il tuo evento arrivi a più persone?',
      lead: (n) => `Più persone raggiunge ${mB(n)}, più bello sarà l'incontro. Basta inviare il link a qualche altro gruppo sportivo per far arrivare nuovi sportivi.`,
      steps: ["Invia il link a gruppi sportivi e amici", "Condividilo nella tua storia Instagram", "Rispondi alle domande nei messaggi dell'evento"],
      msg: (n, when, link) => `Ho creato un evento su Muuvlink: ${n}${when ? `, ${when}` : ''}. Tutti i dettagli qui, vieni anche tu: ${link}`,
      mailSubject: (n) => `${n}: vieni anche tu`,
      cta: 'Vedi il tuo evento →',
      privateNote: 'Questo evento appartiene a una squadra privata: il link si apre solo per i suoi membri.',
      privateCta: 'Vedi il tuo evento →',
    },
  },
};

// kind: 'tc' takım kuruldu · 'ec' etkinlik yayında · 'lc' son çağrı · 'te' ilk etkinlik
//       'gt' mevcut takımı büyüt · 'ge' mevcut etkinliği duyur (admin butonu)
// d: { name, url, when, time, location, spotsLeft, members, attendees, isPrivate, ctaUrl }
// Paylaşım butonları utm_source=share + utm_medium ile gider: kayıt olan
// arkadaşın paylaşımdan geldiği users.utm_* alanlarında görünür.
const actEsc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function activationEmail(kind, d, lang = 'tr') {
  const L = mailLang(lang);
  const A = ACT[L] || ACT.tr;
  const K = A[kind];
  const name = actEsc(d.name);
  const isTeamKind = kind === 'tc' || kind === 'te' || kind === 'gt';
  const campaign = isTeamKind ? 'team_invite' : 'event_invite';
  const withUtm = (medium) => `${d.url}${d.url.includes('?') ? '&' : '?'}utm_source=share&utm_medium=${medium}&utm_campaign=${campaign}`;
  const when = [d.when, d.time].filter(Boolean).join(' ');

  const ICON = 'https://muuvlink.app/icons/mail';
  // Alt alta, tam genişlik. Görsel ikon PNG: Gmail SVG göstermiyor.
  const btn = (href, icon, label, primary) => `
      <tr><td style="padding:0 0 10px;">
        <a href="${href}" style="display:block;background:${primary ? '#F4F818' : '#ffffff'};border:1.5px solid ${primary ? '#F4F818' : '#114956'};border-radius:12px;padding:13px 16px;color:#114956;text-decoration:none;font-size:15px;font-weight:700;text-align:center;">
          <img src="${ICON}/${icon}.png" width="20" height="20" alt="" style="vertical-align:middle;border:0;margin:0 8px 2px 0;">${actEsc(label)}
        </a>
      </td></tr>`;

  let shareBlock = '';
  if (kind !== 'te' && !d.isPrivate) {
    const msgWith = (link) => (isTeamKind ? K.msg(d.name, link) : K.msg(d.name, when, link));
    const bare = msgWith('').replace(/[\s:：]+$/, '');
    const wa = `https://wa.me/?text=${encodeURIComponent(msgWith(withUtm('whatsapp')))}`;
    const tg = `https://t.me/share/url?url=${encodeURIComponent(withUtm('telegram'))}&text=${encodeURIComponent(bare)}`;
    const ml = `mailto:?subject=${encodeURIComponent(K.mailSubject(d.name))}&body=${encodeURIComponent(msgWith(withUtm('email')))}`;
    // Instagram'a dışarıdan içerik verilemiyor: buton hikâye kartını hazırlayan
    // sayfayı açar (?hikaye=1 → sporla-bulusma.jsx StoryShareModal).
    const ig = `${d.url}${d.url.includes('?') ? '&' : '?'}hikaye=1`;
    // E-posta programları panoya yazdırmıyor: buton public/kopyala/ sayfasını açar.
    const cp = `https://muuvlink.app/kopyala/?l=${L}&u=${encodeURIComponent(d.url)}`;
    const label = (t) => `<div style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${actEsc(t)}</div>`;
    shareBlock = `
    ${label(A.yourLink)}
    <div style="border:2px dashed #00a499;background:#e6f7f5;border-radius:12px;padding:14px 16px;margin:0 0 10px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:15px;line-height:1.5;color:#114956;word-break:break-all;-webkit-user-select:all;user-select:all;">${actEsc(d.url)}</div>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 16px;">${btn(cp, 'copy', A.copyBtn, true)}
    </table>

    ${label(A.shareTitle)}
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 16px;">${btn(wa, 'whatsapp', A.shareWa)}${btn(ig, 'instagram', A.shareIg)}${btn(tg, 'telegram', A.shareTg)}${btn(ml, 'mail', A.shareMail)}
    </table>

    ${label(A.readyMsg)}
    <div style="background:#F4F4F4;border-left:4px solid #114956;border-radius:10px;padding:14px 16px;margin:0 0 26px;color:#1F2121;font-size:15px;line-height:1.6;-webkit-user-select:all;user-select:all;">${actEsc(msgWith(d.url))}</div>`;
  } else if (kind !== 'te' && d.isPrivate && K.privateNote) {
    shareBlock = `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin:0 0 26px;color:#92400e;font-size:14px;line-height:1.6;">${actEsc(K.privateNote)}</div>`;
  }

  const eventCard = (kind === 'ec' || kind === 'lc' || kind === 'ge') ? `
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin:0 0 24px;">
      <tr><td style="padding:16px 20px 4px;font-size:17px;font-weight:700;color:#0e3c47;">${name}</td></tr>
      ${d.when ? `<tr><td style="padding:2px 20px;color:#334155;font-size:14px;">${actEsc(tm(L, 'lblDate'))}: <strong>${actEsc(when)}</strong></td></tr>` : ''}
      ${d.location ? `<tr><td style="padding:2px 20px;color:#334155;font-size:14px;">${actEsc(tm(L, 'lblLocation'))}: <strong>${actEsc(d.location)}</strong></td></tr>` : ''}
      <tr><td style="padding:0 0 14px;"></td></tr>
    </table>` : '';

  const list = kind === 'te'
    ? `<div style="font-weight:700;color:#1e293b;font-size:15px;margin:0 0 10px;">${actEsc(K.ideasTitle)}</div>
       <ul style="margin:0 0 26px;padding-left:20px;color:#334155;font-size:15px;line-height:1.8;">${K.ideas.map((x) => `<li>${actEsc(x)}</li>`).join('')}</ul>`
    : `<table cellpadding="0" cellspacing="0" style="margin:0 0 26px;">${K.steps.map((x, i) => `
        <tr><td style="vertical-align:top;padding:0 12px 10px 0;"><div style="width:26px;height:26px;border-radius:50%;background:#114956;color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:26px;">${i + 1}</div></td>
            <td style="vertical-align:top;padding:3px 0 10px;color:#334155;font-size:15px;line-height:1.5;">${actEsc(x)}</td></tr>`).join('')}
       </table>`;

  const ctaLabel = d.isPrivate && K.privateCta ? K.privateCta : K.cta;
  const title = typeof K.title === 'function' ? K.title(d.spotsLeft) : K.title;
  const subject = kind === 'lc' ? K.subject(d.name, d.spotsLeft) : K.subject(d.name);

  const html = emailWrapper(`
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td style="width:52px;height:52px;background:#e6f7f5;border-radius:14px;text-align:center;vertical-align:middle;">
      <img src="${ICON}/k-${kind}.png" width="28" height="28" alt="" style="display:block;margin:0 auto;border:0;">
    </td></tr></table>
    <h2 style="margin:0 0 10px;color:#1e293b;font-size:24px;line-height:1.3;">${actEsc(title)}</h2>
    <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">${K.lead(name, d)}</p>
    ${eventCard}
    ${shareBlock}
    ${list}
    <div style="text-align:center;">
      <a href="${d.ctaUrl || d.url}"
         style="display:inline-block;background:#114956;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;">
        ${actEsc(ctaLabel)}
      </a>
    </div>
    <p style="margin:26px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;text-align:center;">${actEsc(A.optOut)}</p>
  `, L);
  return { subject, html };
}

// ── Hoş geldin e-postası (yeni kayıt) ─────────────────────────────────────
// runActivationEmails 'wu' türüyle gönderir (kayıttan 2 dk–6 saat sonra, kişi
// başına 1). Kayıt ucuna konmadı: kayıt Meta'ya dönüşüm gönderiyor.
// İki yol: takım kur / takıma katıl. Metinler Türkçe onaylanıp çevrildi.
const WELCOME = {
  tr: {
    subject: (n) => `Muuvlink'e hoş geldin${n ? `, ${n}` : ''}`,
    title: "Hoş geldin!",
    lead: (n) => `Muuvlink'e katıldığın için teşekkürler${n ? `, ${n}` : ''}. Spor arkadaşlarınla buluşmanın iki kolay yolu var:`,
    createTitle: "Kendi takımını kur",
    createText: "Arkadaş grubunu ya da kulübünü Muuvlink'e taşı. Etkinlik açtığında takımındaki herkese bildirim gider.",
    createCta: "Takımını kur →",
    joinTitle: "Sana uygun bir takıma katıl",
    joinText: "Yakınındaki takımları keşfet; katıldığın takımın etkinliklerinden anında haberdar ol.",
    joinCta: "Takımları keşfet →",
  },
  en: {
    subject: (n) => `Welcome to Muuvlink${n ? `, ${n}` : ''}`,
    title: "Welcome!",
    lead: (n) => `Thanks for joining Muuvlink${n ? `, ${n}` : ''}. There are two easy ways to meet up with people to train with:`,
    createTitle: "Start your own team",
    createText: "Bring your group of friends or your club to Muuvlink. When you create an event, everyone on your team is notified.",
    createCta: "Start your team →",
    joinTitle: "Join a team that suits you",
    joinText: "Discover teams near you and hear about their events as soon as they are posted.",
    joinCta: "Explore teams →",
  },
  de: {
    subject: (n) => `Willkommen bei Muuvlink${n ? `, ${n}` : ''}`,
    title: "Willkommen!",
    lead: (n) => `Schön, dass du bei Muuvlink bist${n ? `, ${n}` : ''}. Es gibt zwei einfache Wege, Leute zum Sport zu treffen:`,
    createTitle: "Gründe dein eigenes Team",
    createText: "Bring deine Freundesgruppe oder deinen Verein zu Muuvlink. Sobald du ein Event erstellst, wird dein ganzes Team benachrichtigt.",
    createCta: "Team gründen →",
    joinTitle: "Tritt einem passenden Team bei",
    joinText: "Entdecke Teams in deiner Nähe und erfahre sofort von ihren Events.",
    joinCta: "Teams entdecken →",
  },
  el: {
    subject: (n) => `Καλώς ήρθες στο Muuvlink${n ? `, ${n}` : ''}`,
    title: "Καλώς ήρθες!",
    lead: (n) => `Ευχαριστούμε που μπήκες στο Muuvlink${n ? `, ${n}` : ''}. Υπάρχουν δύο εύκολοι τρόποι να βρεθείς με άλλους για άθληση:`,
    createTitle: "Φτιάξε τη δική σου ομάδα",
    createText: "Φέρε την παρέα ή τον σύλλογό σου στο Muuvlink. Μόλις δημιουργήσεις μια εκδήλωση, όλη η ομάδα σου ειδοποιείται.",
    createCta: "Φτιάξε ομάδα →",
    joinTitle: "Μπες σε μια ομάδα που σου ταιριάζει",
    joinText: "Ανακάλυψε ομάδες κοντά σου και μάθε αμέσως για τις εκδηλώσεις τους.",
    joinCta: "Δες τις ομάδες →",
  },
  es: {
    subject: (n) => `Te damos la bienvenida a Muuvlink${n ? `, ${n}` : ''}`,
    title: "¡Te damos la bienvenida!",
    lead: (n) => `Gracias por unirte a Muuvlink${n ? `, ${n}` : ''}. Hay dos formas sencillas de quedar con gente para entrenar:`,
    createTitle: "Crea tu propio equipo",
    createText: "Trae a tu grupo de amigos o a tu club a Muuvlink. Cuando crees un evento, todo tu equipo recibe una notificación.",
    createCta: "Crear equipo →",
    joinTitle: "Únete a un equipo a tu medida",
    joinText: "Descubre equipos cerca de ti y entérate al momento de sus eventos.",
    joinCta: "Ver equipos →",
  },
  fr: {
    subject: (n) => `Bienvenue sur Muuvlink${n ? `, ${n}` : ''}`,
    title: "Bienvenue !",
    lead: (n) => `Merci d’avoir rejoint Muuvlink${n ? `, ${n}` : ''}. Il y a deux façons simples de retrouver des gens pour faire du sport :`,
    createTitle: "Crée ta propre équipe",
    createText: "Amène ton groupe d’amis ou ton club sur Muuvlink. Dès que tu crées un événement, toute ton équipe est prévenue.",
    createCta: "Créer mon équipe →",
    joinTitle: "Rejoins une équipe qui te correspond",
    joinText: "Découvre les équipes près de chez toi et reçois une alerte dès qu’elles publient un événement.",
    joinCta: "Voir les équipes →",
  },
  it: {
    subject: (n) => `Ti diamo il benvenuto su Muuvlink${n ? `, ${n}` : ''}`,
    title: "Ti diamo il benvenuto!",
    lead: (n) => `Grazie di far parte di Muuvlink${n ? `, ${n}` : ''}. Ci sono due modi semplici per trovarti con altri a fare sport:`,
    createTitle: "Crea la tua squadra",
    createText: "Porta su Muuvlink il tuo gruppo di amici o il tuo club. Quando crei un evento, tutta la squadra riceve una notifica.",
    createCta: "Crea la squadra →",
    joinTitle: "Entra in una squadra adatta a te",
    joinText: "Scopri le squadre vicino a te e ricevi subito i loro eventi.",
    joinCta: "Scopri le squadre →",
  },
};
function welcomeEmail(d, lang = 'tr') {
  const L = mailLang(lang);
  const K = WELCOME[L] || WELCOME.tr;
  const A = ACT[L] || ACT.tr;
  const ICON = 'https://muuvlink.app/icons/mail';
  const first = String(d.name || '').trim().split(/\s+/)[0] || '';
  const teamsUrl = `https://muuvlink.app${(SEO_LOCALIZED_PATHS[L] || SEO_LOCALIZED_PATHS.tr).teams}`;
  const createUrl = 'https://muuvlink.app/takim-kur';
  const option = (icon, title, text, url, cta, primary) => `
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e2e8f0;border-radius:14px;margin:0 0 14px;">
      <tr><td style="padding:18px 18px 16px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:44px;height:44px;background:#e6f7f5;border-radius:12px;text-align:center;vertical-align:middle;">
            <img src="${ICON}/${icon}.png" width="24" height="24" alt="" style="display:block;margin:0 auto;border:0;">
          </td>
          <td style="padding-left:14px;font-size:17px;font-weight:700;color:#1e293b;">${actEsc(title)}</td>
        </tr></table>
        <p style="margin:12px 0 16px;color:#475569;font-size:15px;line-height:1.6;">${actEsc(text)}</p>
        <a href="${url}" style="display:block;text-align:center;background:${primary ? '#114956' : '#ffffff'};border:1.5px solid #114956;border-radius:12px;padding:12px 16px;color:${primary ? '#ffffff' : '#114956'};text-decoration:none;font-size:15px;font-weight:700;">${actEsc(cta)}</a>
      </td></tr>
    </table>`;
  const html = emailWrapper(`
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td style="width:52px;height:52px;background:#e6f7f5;border-radius:14px;text-align:center;vertical-align:middle;">
      <img src="${ICON}/k-wu.png" width="28" height="28" alt="" style="display:block;margin:0 auto;border:0;">
    </td></tr></table>
    <h2 style="margin:0 0 10px;color:#1e293b;font-size:24px;line-height:1.3;">${actEsc(K.title)}</h2>
    <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">${actEsc(K.lead(first))}</p>
    ${option('w-create', K.createTitle, K.createText, createUrl, K.createCta, true)}
    ${option('w-join', K.joinTitle, K.joinText, teamsUrl, K.joinCta, false)}
    <p style="margin:26px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;text-align:center;">${actEsc(A.optOut)}</p>
  `, L);
  return { subject: K.subject(first), html };
}

// =====================================================
// MIDDLEWARE
// =====================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Token varsa decode eder, yoksa anonim olarak devam eder
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) req.user = user;
    next();
  });
};

const isAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Admin authentication required' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    try {
      const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [decoded.id]);
      if (!result.rows[0]?.is_admin) return res.status(403).json({ error: 'Admin access required' });
      req.user = decoded;
      next();
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// İsteği yapanın arayüz dili (X-Muuv-Lang başlığı). Yalnız alıcının kendi dili
// bilinmediğinde (kayıtlı olmayan davetli, iletişim formu) kullanılır.
const reqLang = (req) => mailLang(String(req.headers['x-muuv-lang'] || '').slice(0, 5).toLowerCase());

// ─── Kullanıcıya dönen sunucu mesajları (dile göre) ─────────────────────
// Uçlar Türkçe mesaj üretmeye devam eder; yanıt çıkmadan önce isteği yapanın
// diline (X-Muuv-Lang) çevrilir. Anahtar = Türkçe metnin kendisi. Burada olmayan
// mesaj olduğu gibi gider. Yeni kullanıcıya dönük mesaj eklerken buraya da yaz.
const SERVER_MSG = {
  'Çok fazla istek. Lütfen 15 dakika sonra tekrar deneyin.': { en: 'Too many requests. Please try again in 15 minutes.', de: 'Zu viele Anfragen. Bitte versuche es in 15 Minuten erneut.', el: 'Πάρα πολλά αιτήματα. Δοκίμασε ξανά σε 15 λεπτά.', es: 'Demasiadas solicitudes. Inténtalo de nuevo en 15 minutos.', fr: 'Trop de requêtes. Réessaie dans 15 minutes.', it: 'Troppe richieste. Riprova tra 15 minuti.' },
  'Çok fazla istek. Lütfen bir süre bekleyin.': { en: 'Too many requests. Please wait a moment.', de: 'Zu viele Anfragen. Bitte warte einen Moment.', el: 'Πάρα πολλά αιτήματα. Περίμενε λίγο.', es: 'Demasiadas solicitudes. Espera un momento.', fr: 'Trop de requêtes. Patiente un instant.', it: 'Troppe richieste. Attendi un momento.' },
  'Geçerli bir e-posta adresi girin.': { en: 'Please enter a valid email address.', de: 'Bitte gib eine gültige E-Mail-Adresse ein.', el: 'Συμπλήρωσε μια έγκυρη διεύθυνση email.', es: 'Introduce un correo electrónico válido.', fr: 'Saisis une adresse e-mail valide.', it: 'Inserisci un indirizzo email valido.' },
  'Şifre en az 6 karakter olmalıdır.': { en: 'The password must be at least 6 characters.', de: 'Das Passwort muss mindestens 6 Zeichen haben.', el: 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.', es: 'La contraseña debe tener al menos 6 caracteres.', fr: 'Le mot de passe doit contenir au moins 6 caractères.', it: 'La password deve avere almeno 6 caratteri.' },
  'Şifre en az 6 karakter olmalı.': { en: 'The password must be at least 6 characters.', de: 'Das Passwort muss mindestens 6 Zeichen haben.', el: 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.', es: 'La contraseña debe tener al menos 6 caracteres.', fr: 'Le mot de passe doit contenir au moins 6 caractères.', it: 'La password deve avere almeno 6 caratteri.' },
  'İsim en az 2 karakter olmalıdır.': { en: 'The name must be at least 2 characters.', de: 'Der Name muss mindestens 2 Zeichen haben.', el: 'Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες.', es: 'El nombre debe tener al menos 2 caracteres.', fr: 'Le nom doit contenir au moins 2 caractères.', it: 'Il nome deve avere almeno 2 caratteri.' },
  'Dosya yüklenmedi.': { en: 'No file was uploaded.', de: 'Es wurde keine Datei hochgeladen.', el: 'Δεν ανέβηκε αρχείο.', es: 'No se ha subido ningún archivo.', fr: 'Aucun fichier n\'a été envoyé.', it: 'Nessun file caricato.' },
  'Avatar güncellendi': { en: 'Photo updated', de: 'Foto aktualisiert', el: 'Η φωτογραφία ενημερώθηκε', es: 'Foto actualizada', fr: 'Photo mise à jour', it: 'Foto aggiornata' },
  'Takım bulunamadı.': { en: 'Team not found.', de: 'Team nicht gefunden.', el: 'Η ομάδα δεν βρέθηκε.', es: 'Equipo no encontrado.', fr: 'Équipe introuvable.', it: 'Squadra non trovata.' },
  'Bu işlem için yetkiniz yok.': { en: "You don't have permission to do this.", de: 'Dazu hast du keine Berechtigung.', el: 'Δεν έχεις δικαίωμα για αυτή την ενέργεια.', es: 'No tienes permiso para hacer esto.', fr: 'Tu n\'as pas l\'autorisation de faire ça.', it: 'Non hai il permesso di farlo.' },
  'Takım fotoğrafı güncellendi': { en: 'Team photo updated', de: 'Teamfoto aktualisiert', el: 'Η φωτογραφία της ομάδας ενημερώθηκε', es: 'Foto del equipo actualizada', fr: 'Photo de l\'équipe mise à jour', it: 'Foto della squadra aggiornata' },
  'Bu kullanıcı zaten takım üyesi.': { en: 'This user is already a team member.', de: 'Diese Person ist bereits Teammitglied.', el: 'Αυτός ο χρήστης είναι ήδη μέλος της ομάδας.', es: 'Esta persona ya es miembro del equipo.', fr: 'Cette personne est déjà membre de l\'équipe.', it: 'Questa persona fa già parte della squadra.' },
  'Bekleyen davet bulunamadı.': { en: 'No pending invitation found.', de: 'Keine offene Einladung gefunden.', el: 'Δεν βρέθηκε εκκρεμής πρόσκληση.', es: 'No hay ninguna invitación pendiente.', fr: 'Aucune invitation en attente.', it: 'Nessun invito in attesa.' },
  'Takıma başarıyla katıldınız!': { en: 'You joined the team!', de: 'Du bist dem Team beigetreten!', el: 'Έγινες μέλος της ομάδας!', es: '¡Te has unido al equipo!', fr: 'Tu as rejoint l\'équipe !', it: 'Sei entrato nella squadra!' },
  'Geçersiz rol. İzin verilenler: member, coach, captain, editor, owner': { en: 'Invalid role. Allowed: member, coach, captain, editor, owner', de: 'Ungültige Rolle. Erlaubt: member, coach, captain, editor, owner', el: 'Μη έγκυρος ρόλος. Επιτρέπονται: member, coach, captain, editor, owner', es: 'Rol no válido. Permitidos: member, coach, captain, editor, owner', fr: 'Rôle non valide. Autorisés : member, coach, captain, editor, owner', it: 'Ruolo non valido. Consentiti: member, coach, captain, editor, owner' },
  'Takım sahibinin rolü değiştirilemez.': { en: "The team owner's role can't be changed.", de: 'Die Rolle der Teamleitung kann nicht geändert werden.', el: 'Ο ρόλος του ιδιοκτήτη της ομάδας δεν μπορεί να αλλάξει.', es: 'No se puede cambiar el rol del propietario del equipo.', fr: 'Le rôle du propriétaire de l\'équipe ne peut pas être modifié.', it: 'Il ruolo del proprietario della squadra non può essere cambiato.' },
  'Üye bulunamadı.': { en: 'Member not found.', de: 'Mitglied nicht gefunden.', el: 'Το μέλος δεν βρέθηκε.', es: 'Miembro no encontrado.', fr: 'Membre introuvable.', it: 'Membro non trovato.' },
  'Sahip rolünü yalnızca takımın asıl sahibi yönetebilir.': { en: 'Only the original team owner can manage the owner role.', de: 'Nur die ursprüngliche Teamleitung kann die Leitungsrolle vergeben.', el: 'Μόνο ο αρχικός ιδιοκτήτης της ομάδας μπορεί να διαχειριστεί τον ρόλο ιδιοκτήτη.', es: 'Solo el propietario original del equipo puede gestionar el rol de propietario.', fr: 'Seul le propriétaire d\'origine de l\'équipe peut gérer le rôle de propriétaire.', it: 'Solo il proprietario originale della squadra può gestire il ruolo di proprietario.' },
  'Takım sahibi çıkarılamaz.': { en: "The team owner can't be removed.", de: 'Die Teamleitung kann nicht entfernt werden.', el: 'Ο ιδιοκτήτης της ομάδας δεν μπορεί να αφαιρεθεί.', es: 'No se puede quitar al propietario del equipo.', fr: 'Le propriétaire de l\'équipe ne peut pas être retiré.', it: 'Il proprietario della squadra non può essere rimosso.' },
  'Mesaj boş olamaz.': { en: "The message can't be empty.", de: 'Die Nachricht darf nicht leer sein.', el: 'Το μήνυμα δεν μπορεί να είναι κενό.', es: 'El mensaje no puede estar vacío.', fr: 'Le message ne peut pas être vide.', it: 'Il messaggio non può essere vuoto.' },
  'Kayıt adresi geçersiz. http:// veya https:// ile başlamalı.': { en: 'Invalid registration link. It must start with http:// or https://.', de: 'Ungültiger Anmeldelink. Er muss mit http:// oder https:// beginnen.', el: 'Μη έγκυρος σύνδεσμος εγγραφής. Πρέπει να ξεκινά με http:// ή https://.', es: 'El enlace de inscripción no es válido. Debe empezar por http:// o https://.', fr: 'Le lien d\'inscription n\'est pas valide. Il doit commencer par http:// ou https://.', it: 'Link di iscrizione non valido. Deve iniziare con http:// o https://.' },
  'Etkinlik oluşturmak için takımın sahibi, antrenörü veya kaptanı olmanız gerekiyor.': { en: 'You need to be the team owner, coach or captain to create an event.', de: 'Um ein Event zu erstellen, musst du Teamleitung, Trainer oder Kapitän sein.', el: 'Για να δημιουργήσεις εκδήλωση πρέπει να είσαι ιδιοκτήτης, προπονητής ή αρχηγός της ομάδας.', es: 'Para crear un evento tienes que ser propietario, entrenador o capitán del equipo.', fr: 'Pour créer un événement, tu dois être propriétaire, coach ou capitaine de l\'équipe.', it: 'Per creare un evento devi essere proprietario, allenatore o capitano della squadra.' },
  'Bu takımın konumlarına erişim yok.': { en: "You don't have access to this team's locations.", de: 'Kein Zugriff auf die Orte dieses Teams.', el: 'Δεν έχεις πρόσβαση στις τοποθεσίες αυτής της ομάδας.', es: 'No tienes acceso a las ubicaciones de este equipo.', fr: 'Tu n\'as pas accès aux lieux de cette équipe.', it: 'Non hai accesso ai luoghi di questa squadra.' },
  'Önceki konumlar alınamadı.': { en: 'Could not load previous locations.', de: 'Frühere Orte konnten nicht geladen werden.', el: 'Δεν ήταν δυνατή η φόρτωση των προηγούμενων τοποθεσιών.', es: 'No se pudieron cargar las ubicaciones anteriores.', fr: 'Impossible de charger les lieux précédents.', it: 'Impossibile caricare i luoghi precedenti.' },
  'Bu etkinliği görmek için giriş yapmanız gerekiyor.': { en: 'You need to log in to see this event.', de: 'Melde dich an, um dieses Event zu sehen.', el: 'Πρέπει να συνδεθείς για να δεις αυτή την εκδήλωση.', es: 'Tienes que iniciar sesión para ver este evento.', fr: 'Tu dois te connecter pour voir cet événement.', it: 'Devi accedere per vedere questo evento.' },
  'Bu etkinlik gizli bir takıma ait. Erişim yetkiniz yok.': { en: "This event belongs to a private team. You don't have access.", de: 'Dieses Event gehört zu einem privaten Team. Du hast keinen Zugriff.', el: 'Αυτή η εκδήλωση ανήκει σε ιδιωτική ομάδα. Δεν έχεις πρόσβαση.', es: 'Este evento pertenece a un equipo privado. No tienes acceso.', fr: 'Cet événement appartient à une équipe privée. Tu n\'y as pas accès.', it: 'Questo evento appartiene a una squadra privata. Non hai accesso.' },
  'Kayıt linki olan etkinlik bulunamadı.': { en: 'No event with a registration link was found.', de: 'Kein Event mit Anmeldelink gefunden.', el: 'Δεν βρέθηκε εκδήλωση με σύνδεσμο εγγραφής.', es: 'No se encontró ningún evento con enlace de inscripción.', fr: 'Aucun événement avec lien d\'inscription trouvé.', it: 'Nessun evento con link di iscrizione trovato.' },
  'Bu etkinlik gizli bir takıma ait. Sadece takım üyeleri katılabilir.': { en: 'This event belongs to a private team. Only team members can join.', de: 'Dieses Event gehört zu einem privaten Team. Nur Teammitglieder können teilnehmen.', el: 'Αυτή η εκδήλωση ανήκει σε ιδιωτική ομάδα. Μόνο τα μέλη της μπορούν να συμμετάσχουν.', es: 'Este evento pertenece a un equipo privado. Solo pueden apuntarse sus miembros.', fr: 'Cet événement appartient à une équipe privée. Seuls ses membres peuvent participer.', it: 'Questo evento appartiene a una squadra privata. Possono partecipare solo i suoi membri.' },
  'Bu etkinliğe zaten kayıtlı değilsiniz.': { en: "You're not signed up for this event.", de: 'Du bist für dieses Event nicht angemeldet.', el: 'Δεν έχεις δηλώσει συμμετοχή σε αυτή την εκδήλωση.', es: 'No estás apuntado a este evento.', fr: 'Tu n\'es pas inscrit à cet événement.', it: 'Non sei iscritto a questo evento.' },
  'Etkinlik kaydınız silindi.': { en: 'You left the event.', de: 'Deine Teilnahme wurde entfernt.', el: 'Αποχώρησες από την εκδήλωση.', es: 'Has salido del evento.', fr: 'Tu t\'es retiré de l\'événement.', it: 'Sei uscito dall\'evento.' },
  'Yorum boş olamaz.': { en: "The comment can't be empty.", de: 'Der Kommentar darf nicht leer sein.', el: 'Το σχόλιο δεν μπορεί να είναι κενό.', es: 'El comentario no puede estar vacío.', fr: 'Le commentaire ne peut pas être vide.', it: 'Il commento non può essere vuoto.' },
  'Yorumlar yalnız takım üyelerine ve katılımcılara açık.': { en: 'Comments are open to team members and participants only.', de: 'Kommentare sind nur für Teammitglieder und Teilnehmende sichtbar.', el: 'Τα σχόλια είναι ανοιχτά μόνο σε μέλη της ομάδας και συμμετέχοντες.', es: 'Los comentarios solo están abiertos a miembros del equipo y participantes.', fr: 'Les commentaires sont réservés aux membres de l\'équipe et aux participants.', it: 'I commenti sono riservati ai membri della squadra e ai partecipanti.' },
  'Mesaj bulunamadı.': { en: 'Message not found.', de: 'Nachricht nicht gefunden.', el: 'Το μήνυμα δεν βρέθηκε.', es: 'Mensaje no encontrado.', fr: 'Message introuvable.', it: 'Messaggio non trovato.' },
  'Bu mesajı silme yetkiniz yok.': { en: "You can't delete this message.", de: 'Du darfst diese Nachricht nicht löschen.', el: 'Δεν μπορείς να διαγράψεις αυτό το μήνυμα.', es: 'No puedes eliminar este mensaje.', fr: 'Tu ne peux pas supprimer ce message.', it: 'Non puoi eliminare questo messaggio.' },
  'Gönderi bulunamadı.': { en: 'Post not found.', de: 'Beitrag nicht gefunden.', el: 'Η ανάρτηση δεν βρέθηκε.', es: 'Publicación no encontrada.', fr: 'Publication introuvable.', it: 'Post non trovato.' },
  'Bu gönderiyi silme yetkiniz yok.': { en: "You can't delete this post.", de: 'Du darfst diesen Beitrag nicht löschen.', el: 'Δεν μπορείς να διαγράψεις αυτή την ανάρτηση.', es: 'No puedes eliminar esta publicación.', fr: 'Tu ne peux pas supprimer cette publication.', it: 'Non puoi eliminare questo post.' },
  'Gönderi silindi.': { en: 'Post deleted.', de: 'Beitrag gelöscht.', el: 'Η ανάρτηση διαγράφηκε.', es: 'Publicación eliminada.', fr: 'Publication supprimée.', it: 'Post eliminato.' },
  'Bu etkinliği yalnızca oluşturan kişi düzenleyebilir.': { en: 'Only the person who created this event can edit it.', de: 'Nur die Person, die das Event erstellt hat, kann es bearbeiten.', el: 'Μόνο όποιος δημιούργησε την εκδήλωση μπορεί να την επεξεργαστεί.', es: 'Solo quien creó este evento puede editarlo.', fr: 'Seule la personne qui a créé cet événement peut le modifier.', it: 'Solo chi ha creato questo evento può modificarlo.' },
  'Etkinliği düzenlemek için takımın sahibi, antrenörü veya kaptanı olmanız gerekiyor.': { en: 'You need to be the team owner, coach or captain to edit the event.', de: 'Um das Event zu bearbeiten, musst du Teamleitung, Trainer oder Kapitän sein.', el: 'Για να επεξεργαστείς την εκδήλωση πρέπει να είσαι ιδιοκτήτης, προπονητής ή αρχηγός της ομάδας.', es: 'Para editar el evento tienes que ser propietario, entrenador o capitán del equipo.', fr: 'Pour modifier l\'événement, tu dois être propriétaire, coach ou capitaine de l\'équipe.', it: 'Per modificare l\'evento devi essere proprietario, allenatore o capitano della squadra.' },
  'Bu etkinliği yalnızca oluşturan kişi silebilir.': { en: 'Only the person who created this event can delete it.', de: 'Nur die Person, die das Event erstellt hat, kann es löschen.', el: 'Μόνο όποιος δημιούργησε την εκδήλωση μπορεί να τη διαγράψει.', es: 'Solo quien creó este evento puede eliminarlo.', fr: 'Seule la personne qui a créé cet événement peut le supprimer.', it: 'Solo chi ha creato questo evento può eliminarlo.' },
  'Etkinliği silmek için takımın sahibi, antrenörü veya kaptanı olmanız gerekiyor.': { en: 'You need to be the team owner, coach or captain to delete the event.', de: 'Um das Event zu löschen, musst du Teamleitung, Trainer oder Kapitän sein.', el: 'Για να διαγράψεις την εκδήλωση πρέπει να είσαι ιδιοκτήτης, προπονητής ή αρχηγός της ομάδας.', es: 'Para eliminar el evento tienes que ser propietario, entrenador o capitán del equipo.', fr: 'Pour supprimer l\'événement, tu dois être propriétaire, coach ou capitaine de l\'équipe.', it: 'Per eliminare l\'evento devi essere proprietario, allenatore o capitano della squadra.' },
  'Hesabınız silinmek üzere kapatıldı.': { en: 'Your account has been closed for deletion.', de: 'Dein Konto wurde zur Löschung geschlossen.', el: 'Ο λογαριασμός σου έκλεισε και θα διαγραφεί.', es: 'Tu cuenta se ha cerrado y se eliminará.', fr: 'Ton compte a été fermé et sera supprimé.', it: 'Il tuo account è stato chiuso e verrà eliminato.' },
  'Geçersiz tercih verisi.': { en: 'Invalid preference data.', de: 'Ungültige Einstellungen.', el: 'Μη έγκυρα δεδομένα προτιμήσεων.', es: 'Datos de preferencias no válidos.', fr: 'Préférences non valides.', it: 'Preferenze non valide.' },
  'Tüm alanlar zorunludur.': { en: 'All fields are required.', de: 'Alle Felder sind Pflichtfelder.', el: 'Όλα τα πεδία είναι υποχρεωτικά.', es: 'Todos los campos son obligatorios.', fr: 'Tous les champs sont obligatoires.', it: 'Tutti i campi sono obbligatori.' },
  'Mesajınız başarıyla gönderildi.': { en: 'Your message has been sent.', de: 'Deine Nachricht wurde gesendet.', el: 'Το μήνυμά σου στάλθηκε.', es: 'Tu mensaje se ha enviado.', fr: 'Ton message a été envoyé.', it: 'Il tuo messaggio è stato inviato.' },
  'Mesaj gönderilemedi.': { en: 'The message could not be sent.', de: 'Die Nachricht konnte nicht gesendet werden.', el: 'Δεν ήταν δυνατή η αποστολή του μηνύματος.', es: 'No se pudo enviar el mensaje.', fr: 'Impossible d\'envoyer le message.', it: 'Impossibile inviare il messaggio.' },
  'İstatistikler alınamadı.': { en: 'Could not load statistics.', de: 'Statistiken konnten nicht geladen werden.', el: 'Δεν ήταν δυνατή η φόρτωση των στατιστικών.', es: 'No se pudieron cargar las estadísticas.', fr: 'Impossible de charger les statistiques.', it: 'Impossibile caricare le statistiche.' },
  'Bannerlar alınamadı.': { en: 'Could not load banners.', de: 'Banner konnten nicht geladen werden.', el: 'Δεν ήταν δυνατή η φόρτωση των banner.', es: 'No se pudieron cargar los banners.', fr: 'Impossible de charger les bannières.', it: 'Impossibile caricare i banner.' },
  'Bu entegrasyon şu anda kapalı.': { en: 'This integration is currently disabled.', de: 'Diese Integration ist derzeit deaktiviert.', el: 'Αυτή η σύνδεση είναι προσωρινά απενεργοποιημένη.', es: 'Esta integración está desactivada por ahora.', fr: 'Cette intégration est désactivée pour le moment.', it: 'Questa integrazione è al momento disattivata.' },
  'Bağlantı eksik.': { en: 'The link is incomplete.', de: 'Der Link ist unvollständig.', el: 'Ο σύνδεσμος είναι ελλιπής.', es: 'El enlace está incompleto.', fr: 'Le lien est incomplet.', it: 'Il link è incompleto.' },
  'Bu bağlantı geçersiz.': { en: 'This link is invalid.', de: 'Dieser Link ist ungültig.', el: 'Αυτός ο σύνδεσμος δεν είναι έγκυρος.', es: 'Este enlace no es válido.', fr: 'Ce lien n\'est pas valide.', it: 'Questo link non è valido.' },
  'Bağlantıda geçerli bir antrenman yok.': { en: 'The link contains no valid training.', de: 'Der Link enthält kein gültiges Training.', el: 'Ο σύνδεσμος δεν περιέχει έγκυρη προπόνηση.', es: 'El enlace no contiene un entrenamiento válido.', fr: 'Le lien ne contient aucun entraînement valide.', it: 'Il link non contiene un allenamento valido.' },
  'Geçersiz URL': { en: 'Invalid URL', de: 'Ungültige URL', el: 'Μη έγκυρη διεύθυνση URL', es: 'URL no válida', fr: 'URL non valide', it: 'URL non valido' },
  'E-posta gönderildi.': { en: 'Email sent.', de: 'E-Mail gesendet.', el: 'Το email στάλθηκε.', es: 'Correo enviado.', fr: 'E-mail envoyé.', it: 'Email inviata.' },
  'Sunucu hatası.': { en: 'Server error.', de: 'Serverfehler.', el: 'Σφάλμα διακομιστή.', es: 'Error del servidor.', fr: 'Erreur du serveur.', it: 'Errore del server.' },
  'Token ve şifre gerekli.': { en: 'Token and password are required.', de: 'Token und Passwort sind erforderlich.', el: 'Απαιτούνται token και κωδικός.', es: 'Se necesitan el token y la contraseña.', fr: 'Le jeton et le mot de passe sont requis.', it: 'Servono token e password.' },
  'Geçersiz link.': { en: 'Invalid link.', de: 'Ungültiger Link.', el: 'Μη έγκυρος σύνδεσμος.', es: 'Enlace no válido.', fr: 'Lien non valide.', it: 'Link non valido.' },
  'Bu link daha önce kullanıldı.': { en: 'This link has already been used.', de: 'Dieser Link wurde bereits verwendet.', el: 'Αυτός ο σύνδεσμος έχει ήδη χρησιμοποιηθεί.', es: 'Este enlace ya se ha usado.', fr: 'Ce lien a déjà été utilisé.', it: 'Questo link è già stato usato.' },
  'Linkin süresi doldu.': { en: 'This link has expired.', de: 'Dieser Link ist abgelaufen.', el: 'Ο σύνδεσμος έχει λήξει.', es: 'El enlace ha caducado.', fr: 'Ce lien a expiré.', it: 'Il link è scaduto.' },
  'Şifre başarıyla güncellendi.': { en: 'Password updated.', de: 'Passwort aktualisiert.', el: 'Ο κωδικός ενημερώθηκε.', es: 'Contraseña actualizada.', fr: 'Mot de passe mis à jour.', it: 'Password aggiornata.' },
  'Şikayet kaydedilemedi.': { en: 'The report could not be saved.', de: 'Die Meldung konnte nicht gespeichert werden.', el: 'Δεν ήταν δυνατή η καταχώριση της αναφοράς.', es: 'No se pudo registrar la denuncia.', fr: 'Impossible d\'enregistrer le signalement.', it: 'Impossibile registrare la segnalazione.' },
  'Engelleme başarısız.': { en: 'Blocking failed.', de: 'Blockieren fehlgeschlagen.', el: 'Ο αποκλεισμός απέτυχε.', es: 'No se pudo bloquear.', fr: 'Le blocage a échoué.', it: 'Blocco non riuscito.' },
  'Engel kaldırılamadı.': { en: 'Could not unblock.', de: 'Blockierung konnte nicht aufgehoben werden.', el: 'Δεν ήταν δυνατή η άρση του αποκλεισμού.', es: 'No se pudo desbloquear.', fr: 'Impossible de débloquer.', it: 'Impossibile sbloccare.' },
  'Bu etkinliğin tarihi geçti.': { en: 'This event has already taken place.', de: 'Dieses Event hat bereits stattgefunden.', el: 'Αυτή η εκδήλωση έχει ήδη πραγματοποιηθεί.', es: 'Este evento ya se celebró.', fr: 'Cet événement a déjà eu lieu.', it: 'Questo evento si è già svolto.' },
  'E-posta gerekli.': { en: 'Email is required.', de: 'E-Mail ist erforderlich.', el: 'Απαιτείται email.', es: 'El correo es obligatorio.', fr: 'L\'e-mail est obligatoire.', it: 'L\'email è obbligatoria.' },
};

// Yanıt çıkmadan önce error/message alanını isteğin diline çevir.
// Türkçe istekte hiçbir şey yapılmaz (eski davranış birebir).
const translateServerMessages = (req, res, next) => {
  const L = reqLang(req);
  if (L === 'tr') return next();
  const origJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      for (const k of ['error', 'message']) {
        const tr = body[k];
        if (typeof tr === 'string' && SERVER_MSG[tr]) body[k] = SERVER_MSG[tr][L] || SERVER_MSG[tr].en || tr;
      }
    }
    return origJson(body);
  };
  next();
};

// Etkinlik yorumlarını kim görür/yazar/beğenir: takımın üyeleri (etkinliğe
// katılmasalar da), etkinliğe katılanlar (takım dışından olsalar da), takımsız
// etkinlikte oluşturan; her durumda platform admini. Takım dışındaki kişi ancak
// etkinliğe katılınca görür, ayrılınca yine göremez.
const canSeeTrainingComments = async (trainingId, userId) => {
  if (!userId) return false;
  const r = await pool.query(
    `SELECT COALESCE((SELECT is_admin FROM users WHERE id = $2), false) AS admin,
            t.team_id, t.created_by,
            EXISTS (SELECT 1 FROM team_members WHERE team_id = t.team_id AND user_id = $2) AS member,
            EXISTS (SELECT 1 FROM training_attendees WHERE training_id = t.id AND user_id = $2) AS attendee
       FROM trainings t WHERE t.id = $1`,
    [trainingId, userId]
  );
  const v = r.rows[0];
  if (!v) return false;
  if (v.admin || v.attendee) return true;
  if (v.team_id) return v.member;
  return v.created_by === userId;
};

// Takım dışındakilere üye isimleri baş harf + nokta olarak gider:
// "Melih Önyer" → "M........ Ö........". Nokta sayısı SABİT; gerçek uzunluk sızmasın.
const maskPersonName = (name) =>
  String(name || '').trim().split(/\s+/).filter(Boolean)
    .map((w) => w[0].toLocaleUpperCase('tr-TR') + '........')
    .join(' ');


const checkAndAwardBadges = async (userId) => {
  try {
    // Get user stats
    const statsResult = await pool.query(
      'SELECT * FROM user_stats WHERE user_id = $1',
      [userId]
    );

    if (statsResult.rows.length === 0) return;

    const stats = statsResult.rows[0];

    // Get all badges
    const badgesResult = await pool.query('SELECT * FROM badges');
    const badges = badgesResult.rows;

    // Check each badge requirement
    for (const badge of badges) {
      let qualified = false;

      if (badge.requirement_type === 'training_count') {
        qualified = stats.total_trainings >= badge.requirement_value;
      } else if (badge.requirement_type === 'distance') {
        qualified = stats.total_distance >= badge.requirement_value;
      } else if (badge.requirement_type === 'team_count') {
        const teamCount = await pool.query(
          'SELECT COUNT(*) FROM team_members WHERE user_id = $1',
          [userId]
        );
        qualified = parseInt(teamCount.rows[0].count) >= badge.requirement_value;
      } else if (badge.requirement_type === 'created_count') {
        const createdCount = await pool.query(
          'SELECT COUNT(*) FROM trainings WHERE created_by = $1',
          [userId]
        );
        qualified = parseInt(createdCount.rows[0].count) >= badge.requirement_value;
      } else if (badge.requirement_type === 'comment_count') {
        const commentCount = await pool.query(
          'SELECT COUNT(*) FROM training_comments WHERE user_id = $1 AND is_deleted = false',
          [userId]
        );
        qualified = parseInt(commentCount.rows[0].count) >= badge.requirement_value;
      } else if (badge.requirement_type === 'sport_count' && badge.sport) {
        // Kullanıcının katılıp tamamladığı, belirli spor dalındaki etkinlik sayısı
        // (bireysel etkinlikte t.sport, takım etkinliğinde teams.sport)
        const sportCount = await pool.query(
          `SELECT COUNT(*) FROM training_attendees ta
             JOIN trainings t ON ta.training_id = t.id
             LEFT JOIN teams tm ON t.team_id = tm.id
           WHERE ta.user_id = $1 AND ${trainingUtcExpr('t')} < NOW()
             AND COALESCE(t.sport, tm.sport) = $2`,
          [userId, badge.sport]
        );
        qualified = parseInt(sportCount.rows[0].count) >= badge.requirement_value;
      }

      if (qualified) {
        // Award badge if not already awarded
        await pool.query(
          `INSERT INTO user_badges (user_id, badge_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, badge_id) DO NOTHING
           RETURNING *`,
          [userId, badge.id]
        ).then(async (result) => {
          if (result.rows.length > 0) {
            await createNotif(userId, {
              build: (L) => ({ title: tm(L, 'badgeTitle'), message: tm(L, 'badgeMsg', badge.name) }),
              type: 'badge',
              refId: badge.id,
              url: '/rozetlerim',
            });
          }
        });
      }
    }
  } catch (error) {
    console.error('Badge check error:', error);
  }
};

const updateUserStats = async (userId) => {
  try {
    const trainingsResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM training_attendees ta
       JOIN trainings t ON ta.training_id = t.id
       WHERE ta.user_id = $1 AND ${trainingUtcExpr('t')} < NOW()`,
      [userId]
    );

    const trainingCount = parseInt(trainingsResult.rows[0].count);

    await pool.query(
      `INSERT INTO user_stats (user_id, total_trainings, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET total_trainings = $2, updated_at = CURRENT_TIMESTAMP`,
      [userId, trainingCount]
    );

    await checkAndAwardBadges(userId);
  } catch (error) {
    console.error('Update stats error:', error);
  }
};

// ── Dış kayıt linki ────────────────────────────────────────────────────────
// Takım etkinliklerine isteğe bağlı bir dış kayıt adresi eklenebilir (form,
// bilet, lisans başvurusu). Kullanıcı girdisi butona dönüştüğü için şema
// KISITLI: yalnız http/https. `javascript:` ve `data:` gibi şemalar buradan
// geçemez — tarayıcı tarafındaki kontrole güvenilmez.
// Bireysel etkinliklerde bu alan yok sayılır (çağıran team_id'yi geçirir).
// Buton yazısı düzenleyen tarafından girilir ("Formu Doldur", "Listeye
// Eklen", "Bilet Al"...). Boşsa arayüz varsayılan metni kullanır.
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS registration_label TEXT`).catch(() => {});

const REG_LABEL_MAX = 24;

// Yazı serbest metin ama butona basılıyor: satır sonu ve görünmez karakterler
// düzeni bozar, aşırı uzunluk butonu taşırır. Kırpılır, tek satıra indirilir.
const sanitizeRegistrationLabel = (raw, teamId, url) => {
  if (!teamId || !url) return null;          // link yoksa yazının anlamı yok
  const v = (raw ?? '')
    .toString()
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, REG_LABEL_MAX);
  return v || null;
};

const sanitizeRegistrationUrl = (raw, teamId) => {
  if (!teamId) return null;                       // bireysel → alan yok
  const v = (raw ?? '').toString().trim();
  if (!v) return null;
  if (v.length > 500) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch { return null; }
};

// ============================================
// DYNAMIC SITEMAP (SEO — AUTH GEREKMİYOR)
// Statik sayfalar + herkese açık takımlar + yaklaşan herkese açık etkinlikler.
// robots.txt bunu işaret eder. Hata olursa en azından statik URL'leri döndürür.
// ============================================
const SITE_ORIGIN = 'https://muuvlink.app';
const xmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
// SEO dostu slug — frontend sporla-bulusma.jsx'teki slugify ile AYNI kurallar
// (canonical == sitemap URL olsun diye birebir eşleşmeli).
const slugify = (s) =>
  (s || '')
    .toString()
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'x';

app.get('/api/sitemap.xml', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_ORIGIN}/`, changefreq: 'daily', priority: '1.0', lastmod: today },
  ];

  // Dört sabit sayfa üç dilde ayrı adreste (tr kökte, en/de önekli).
  // NOT: /antrenmanlar sitemap'te YOK. SPA bu yolu /etkinlikler'e çeviriyor,
  // yani aynı sayfa iki adreste olurdu. Tek kanonik adres: /etkinlikler.
  for (const [lang, pages] of Object.entries(SEO_LOCALIZED_PATHS)) {
    for (const [page, p] of Object.entries(pages)) {
      if (page === 'home' && lang === 'tr') continue; // zaten yukarıda
      urls.push({
        loc: `${SITE_ORIGIN}${p}`,
        changefreq: page === 'contact' ? 'monthly' : 'hourly',
        priority: page === 'home' ? '0.9' : page === 'contact' ? '0.5' : '0.8',
        lastmod: today,
      });
    }
  }

  try {
    // Herkese açık takımlar (özel olanlar hariç)
    const teams = await pool.query(
      `SELECT id, name, updated_at FROM teams WHERE is_private = false ORDER BY updated_at DESC LIMIT 20000`
    );
    for (const t of teams.rows) {
      urls.push({
        loc: `${SITE_ORIGIN}/takim/${slugify(t.name)}-${t.id}`,
        changefreq: 'weekly',
        priority: '0.7',
        lastmod: (t.updated_at ? new Date(t.updated_at) : new Date()).toISOString().slice(0, 10),
      });
    }

    // Yaklaşan herkese açık etkinlikler (geçmiş etkinlikler dahil edilmez)
    const trainings = await pool.query(
      `SELECT id, title, updated_at FROM trainings
        WHERE is_public = true AND ${trainingUtcExpr('')} >= NOW()
        ORDER BY training_date ASC LIMIT 20000`
    );
    for (const tr of trainings.rows) {
      urls.push({
        loc: `${SITE_ORIGIN}/etkinlik/${slugify(tr.title)}-${tr.id}`,
        changefreq: 'daily',
        priority: '0.8',
        lastmod: (tr.updated_at ? new Date(tr.updated_at) : new Date()).toISOString().slice(0, 10),
      });
    }
  } catch (err) {
    // DB erişilemezse sitemap yine de statik URL'lerle döner (asla 500 verme)
    console.error('[SITEMAP] dynamic query failed, serving static URLs only:', err.message);
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) =>
      `  <url>\n` +
      `    <loc>${xmlEscape(u.loc)}</loc>\n` +
      `    <lastmod>${u.lastmod}</lastmod>\n` +
      `    <changefreq>${u.changefreq}</changefreq>\n` +
      `    <priority>${u.priority}</priority>\n` +
      `  </url>`
    ).join('\n') +
    `\n</urlset>\n`;

  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(body);
});


// ============================================
// INDEXNOW — yeni/değişen adresleri arama motorlarına anında bildir
// Sitemap taranmasını beklemek yerine Bing (ve IndexNow'ı paylaşan diğer
// motorlar) değişikliği dakikalar içinde öğrenir.
//
// Anahtar dosyası: https://muuvlink.app/<key>.txt — içinde yalnız anahtar
// yazar (public/ klasöründe, deploy ile gider). Dosya erişilemezse IndexNow
// bildirimi sessizce reddeder; o yüzden dosya SİLİNMEMELİ.
//
// Sadece HERKESE AÇIK adresler bildirilir: gizli takım / özel etkinlik asla.
// Gönderim ateşle-unut; hata uygulamayı etkilemez, istek akışını yavaşlatmaz.
// ============================================
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'a77788f8d2620c340afb762b7d932942';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

// Aynı saniyede onlarca kayıt değişirse tek istek atılsın diye küçük bir kuyruk.
const indexNowQueue = new Set();
let indexNowTimer = null;

const indexNowFlush = async () => {
  indexNowTimer = null;
  const urlList = [...indexNowQueue].slice(0, 10000);
  indexNowQueue.clear();
  if (!urlList.length) return;
  try {
    const r = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'muuvlink.app',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(8000),
    });
    // 200/202 = kabul edildi. 4xx genelde anahtar dosyası okunamadı demektir.
    console.log(`[INDEXNOW] ${urlList.length} adres bildirildi — HTTP ${r.status}`);
  } catch (e) {
    console.error('[INDEXNOW] bildirim başarısız:', e.message);
  }
};

// Bildirilecek adresleri kuyruğa al. Liste sayfaları da değiştiği için
// onlar da eklenir — yeni etkinlik /etkinlikler sayfasını da değiştirir.
const indexNowPing = (urls, { withLists = true } = {}) => {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (!list.length) return;
  for (const u of list) indexNowQueue.add(u);
  if (withLists) {
    indexNowQueue.add(`${SITE_ORIGIN}/etkinlikler`);
    indexNowQueue.add(`${SITE_ORIGIN}/takimlar`);
  }
  if (!indexNowTimer) indexNowTimer = setTimeout(indexNowFlush, 10000);
};

// Etkinlik/takım satırından herkese açık adresi üret; açık değilse null.
const indexNowTrainingUrl = (t) =>
  t && t.is_public !== false ? `${SITE_ORIGIN}/etkinlik/${slugify(t.title)}-${t.id}` : null;
const indexNowTeamUrl = (t) =>
  t && t.is_private !== true ? `${SITE_ORIGIN}/takim/${slugify(t.name)}-${t.id}` : null;

// index.html içindeki işaretli bölgeyi değiştirir. İşaretler
// scripts/seo-static.mjs tarafından konur; yoksa HTML olduğu gibi döner.
const replaceSeoRegion = (html, name, body) => {
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*?(<!-- ${name}:END -->)`);
  return re.test(html) ? html.replace(re, (_, a, b) => `${a}\n${body}\n  ${b}`) : html;
};

const SEO_WRAP_STYLE = 'max-width:820px;margin:0 auto;padding:56px 24px 80px;' +
  'font-family:Montserrat,system-ui,sans-serif;color:#333E40;line-height:1.6';

// Etkinlik tarihini okunur yaz. Etkinliğin kendi saat dilimi varsa onu belirtir;
// uydurma yerel saat üretmeyiz, kaydedilen değeri olduğu gibi gösteririz.
const seoFormatDate = (d, lang = 'tr') => {
  try {
    return new Intl.DateTimeFormat({ tr: 'tr-TR', en: 'en-GB', de: 'de-DE', el: 'el-GR', es: 'es-ES', fr: 'fr-FR', it: 'it-IT' }[lang] || 'tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(d));
  } catch { return ''; }
};


// ── Çok dilli SEO içeriği ──────────────────────────────────────────────────
// Metinler i18n.js'te; scripts/seo-static.mjs bunları dist/seo-content.json'a
// üretir (index.html ile aynı klasör → frontend deploy'u içeriği de taşır).
// Burada ELLE metin yazılmaz; yeni cümle i18n.js'e eklenir.
let seoContentCache = null;
let seoContentAt = 0;
const getSeoContent = () => {
  if (seoContentCache && Date.now() - seoContentAt < 60000) return seoContentCache;
  try {
    seoContentCache = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'dist', 'seo-content.json'), 'utf8'));
    seoContentAt = Date.now();
  } catch (e) {
    console.error('[SEO] seo-content.json okunamadı:', e.message);
    if (!seoContentCache) seoContentCache = null;
  }
  return seoContentCache;
};

// Türkçe kökte; diğer diller yalnız bu dört sayfada önek alır.
// sporla-bulusma.jsx içindeki LOCALIZED_PAGE_PATHS ile BİREBİR aynı olmalı
// (ve nginx'teki liste sayfaları konumu da bu yolları içermeli).
const SEO_LOCALIZED_PATHS = {
  tr: { home: '/',   trainings: '/etkinlikler', teams: '/takimlar', contact: '/iletisim' },
  en: { home: '/en', trainings: '/en/events',   teams: '/en/teams', contact: '/en/contact' },
  de: { home: '/de', trainings: '/de/events',   teams: '/de/teams', contact: '/de/kontakt' },
  el: { home: '/el', trainings: '/el/events',   teams: '/el/teams', contact: '/el/contact' },
  es: { home: '/es', trainings: '/es/eventos',  teams: '/es/equipos', contact: '/es/contacto' },
  fr: { home: '/fr', trainings: '/fr/evenements', teams: '/fr/equipes', contact: '/fr/contact' },
  it: { home: '/it', trainings: '/it/eventi',   teams: '/it/squadre', contact: '/it/contatti' },
};
const SEO_PATH_LOOKUP = Object.fromEntries(
  Object.entries(SEO_LOCALIZED_PATHS).flatMap(([lang, pages]) =>
    Object.entries(pages).map(([page, p]) => [p, { lang, page }])));

// hreflang etiketleri — sayfanın üç dildeki karşılığı + x-default (Türkçe).
const seoHreflang = (page) => {
  const rows = Object.entries(SEO_LOCALIZED_PATHS)
    .map(([l, pages]) => [l, pages[page]]).filter(([, p]) => p);
  if (!rows.length) return '';
  return rows.map(([l, p]) => `  <link rel="alternate" hreflang="${l}" href="${SITE_ORIGIN}${p}">`)
    .concat(`  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${SEO_LOCALIZED_PATHS.tr[page]}">`)
    .join('\n');
};

// Detay sayfası gövde metni — bot bu adreste etkinliğin/takımın kendi
// bilgisini görsün diye. İnsan aynı bilgiyi SPA'da görür; cloaking yok.
const seoDetailBody = ({ h1, lead, bits, tail }) => `
    <div style="${SEO_WRAP_STYLE}">
      <h1 style="font-size:clamp(1.7rem,4vw,2.3rem);color:#114956;margin:0 0 14px;letter-spacing:-.02em">${htmlAttrEscape(h1)}</h1>
      <p style="margin:0 0 20px">${htmlAttrEscape(String(lead).slice(0, 600))}</p>
${bits.length ? `      <ul style="margin:0 0 20px;padding-left:20px">\n${bits.map((b) => `        <li>${b}</li>`).join('\n')}\n      </ul>` : ''}
      <p style="margin:0 0 26px;color:#66757A;font-size:.95rem">${tail}</p>
      <p style="margin:0"><a href="${SITE_ORIGIN}/etkinlikler" style="color:#114956;font-weight:600;text-decoration:none">Yaklaşan etkinlikler</a> · <a href="${SITE_ORIGIN}/takimlar" style="color:#114956;font-weight:600;text-decoration:none">Spor takımları</a> · <a href="${SITE_ORIGIN}/" style="color:#114956;font-weight:600;text-decoration:none">Muuvlink nedir?</a></p>
    </div>`;

// ============================================
// OG PRERENDER (SEO — sosyal paylaşım kartları)
// nginx YALNIZCA sosyal/preview botlarını (facebookexternalhit, WhatsApp, Twitterbot...)
// bu route'a yönlendirir; insanlar SPA'yı statik index.html'den alır. Bu bot'lar JS
// çalıştırmadığı için detay sayfasının OG etiketlerini sunucudan gömüyoruz.
// İçerik herkese açık olduğundan (public takım/etkinlik) cloaking yok — bot ile insan aynı sayfayı görür.
// ============================================
const parseDetailPathBackend = (pathname) => {
  let m = pathname.match(/^\/takim\/.*-(\d+)$/);
  if (m) return { kind: 'team', id: m[1] };
  m = pathname.match(/^\/etkinlik\/.*-(\d+)$/);
  if (m) return { kind: 'training', id: m[1] };
  return null;
};

const getIndexHtml = () => {
  try { return fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8'); }
  catch (e) { console.error('[OG] index.html okunamadı:', e.message); return ''; }
};

const htmlAttrEscape = (s) => String(s || '').replace(/[<>&"]/g, (c) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

const injectOgTags = (html, meta) => {
  const T = htmlAttrEscape(meta.title);
  const D = htmlAttrEscape(meta.description);
  const U = htmlAttrEscape(meta.url);
  const I = htmlAttrEscape(meta.image);
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${T}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(">)/, `$1${D}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${U}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${U}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${T}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${D}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${I}$2`)
    .replace(/(<meta name="twitter:url" content=")[^"]*(">)/, `$1${U}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${T}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(">)/, `$1${D}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(">)/, `$1${I}$2`);
};

app.get(['/takim/*', '/etkinlik/*'], async (req, res, next) => {
  const parsed = parseDetailPathBackend(req.path);
  const html = getIndexHtml();
  if (!parsed || !html) return next();
  const DEFAULT_IMG = `${SITE_ORIGIN}/og-image.jpg`;
  res.set('Content-Type', 'text/html; charset=utf-8');
  // Silinmiş kayıt: 404 + noindex. 200 dönünce Google adresi "yönlendirmeli" /
  // soft 404 sayıp listede tutuyordu. Gizli (var olan) kayıt bu yola girmez.
  const notFound = () => res.status(404).set('Cache-Control', 'public, max-age=300')
    .send(html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex">'));
  try {
    let meta, body = null;
    if (parsed.kind === 'team') {
      const r = await pool.query(
        `SELECT t.id, t.name, t.description, t.avatar, t.is_private, t.sport, t.location,
                COUNT(tm.user_id)::int AS member_count
           FROM teams t LEFT JOIN team_members tm ON tm.team_id = t.id
          WHERE t.id = $1 GROUP BY t.id`, [parsed.id]);
      const t0 = r.rows[0];
      if (!t0) return notFound();
      if (t0.is_private) return res.send(html); // gizli → varsayılan kart
      meta = {
        title: `${t0.name} — Muuvlink`,
        description: (t0.description || 'Çevrende spor yapan insanları bul, kendi takımını kur, etkinlikler planla.').slice(0, 200),
        url: `${SITE_ORIGIN}/takim/${slugify(t0.name)}-${t0.id}`,
        image: t0.avatar || DEFAULT_IMG,
      };
      const bits = [];
      if (t0.sport) bits.push(`Spor dalı: ${htmlAttrEscape(t0.sport)}`);
      if (t0.location) bits.push(`Konum: ${htmlAttrEscape(t0.location)}`);
      bits.push(`Üye sayısı: ${t0.member_count}`);
      body = seoDetailBody({
        h1: t0.name,
        lead: t0.description || `${t0.name}, Muuvlink üzerinde herkese açık bir spor takımı.`,
        bits,
        tail: 'Herkese açık takımlara katılım isteği gönderilebilir. Takıma katılmak ve etkinliklerini görmek ücretsizdir.',
      });
    } else {
      const r = await pool.query(
        `SELECT t.id, t.title, t.description, t.image_url, t.is_public, t.sport,
                t.training_date, t.training_time, t.location_name, t.location_address,
                t.capacity, t.is_paid, t.organizer, teams.name AS team_name,
                (${trainingUtcExpr('t')} < NOW()) AS is_past
           FROM trainings t LEFT JOIN teams ON t.team_id = teams.id
          WHERE t.id = $1`, [parsed.id]);
      const e0 = r.rows[0];
      if (!e0) return notFound();
      if (e0.is_public === false) return res.send(html);
      // Tarihi geçmiş etkinlik indekste kalmaya devam ediyor. Arama sonucunda
      // "olan bir etkinlik" gibi görünmesin diye özet ve alt metin bunu söyler,
      // okuyucu yaklaşan etkinliklere yönlendirilir.
      meta = {
        title: e0.is_past ? `${e0.title} (tamamlandı) — Muuvlink` : `${e0.title} — Muuvlink`,
        description: ((e0.is_past ? 'Bu etkinlik tamamlandı. ' : '') +
          (e0.description || 'Muuvlink etkinliği — katıl, birlikte spor yap.')).slice(0, 200),
        url: `${SITE_ORIGIN}/etkinlik/${slugify(e0.title)}-${e0.id}`,
        image: e0.image_url || DEFAULT_IMG,
      };
      const bits = [];
      if (e0.sport) bits.push(`Spor dalı: ${htmlAttrEscape(e0.sport)}`);
      const d = seoFormatDate(e0.training_date);
      if (d) bits.push(`Tarih: ${d}${e0.training_time ? ` ${String(e0.training_time).slice(0, 5)}` : ''}`);
      const yer = e0.location_name || e0.location_address;
      if (yer) bits.push(`Yer: ${htmlAttrEscape(yer)}`);
      if (e0.team_name) bits.push(`Takım: ${htmlAttrEscape(e0.team_name)}`);
      if (e0.capacity) bits.push(`Kontenjan: ${e0.capacity} kişi`);
      if (e0.organizer) bits.push(`Düzenleyen: ${htmlAttrEscape(e0.organizer)}`);
      body = seoDetailBody({
        h1: e0.title,
        lead: e0.description || `${e0.title}, Muuvlink üzerinde herkese açık bir spor etkinliği.`,
        bits,
        tail: e0.is_past
          ? 'Bu etkinliğin tarihi geçti; katılım, ayrılma ve yorumlar kapandı. Sayfa yalnızca kayıt olarak duruyor. Yaklaşan etkinlikler için etkinlikler sayfasına göz atabilirsiniz.'
          : e0.is_paid
          ? 'Bu etkinlik dış bir kuruluş tarafından düzenleniyor; kayıt düzenleyenin kendi sitesinden yapılır. Muuvlink bu ücretten pay almaz.'
          : 'Katılmak için etkinlik sayfasındaki Katıl düğmesine basmak yeterlidir, onay beklenmez. Kontenjan dolduğunda katılım kapanır.',
      });
    }
    let out = injectOgTags(html, meta);
    if (body) {
      // Sayfaya ait olmayan SSS metnini ve FAQPage şemasını kaldır: bot bu
      // adreste etkinliğin/takımın kendi bilgisini görsün, genel SSS'i değil.
      out = replaceSeoRegion(out, 'SEO-TEXT', body);
      out = replaceSeoRegion(out, 'SEO-SCHEMA', '');
      // Detay adreslerinin dil karşılığı yok; ana sayfanın hreflang'ini
      // burada bırakmak Google'da "alternatif sayfa dönmüyor" hatası verir.
      out = replaceSeoRegion(out, 'SEO-HREFLANG', '');
    }
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(out);
  } catch (e) {
    console.error('[OG] render hatası:', e.message);
    return res.send(html); // hata → varsayılan kart (asla 500 verme)
  }
});


// ============================================
// LİSTE SAYFALARI İÇİN PRERENDER (SEO + yapay zeka motorları)
// nginx yalnızca botları ($muuv_og_bot) buraya yönlendirir; insanlar statik
// index.html'i nginx'ten alır ve SPA'yı görür. Node insan trafiğinin yolunda değil.
//
// NEDEN: ChatGPT, Perplexity ve Claude'un tarayıcıları JavaScript ÇALIŞTIRMAZ.
// index.html'de statik bir SSS metni var (scripts/seo-static.mjs) ama o metin
// HER yolda aynı — bot için /antrenmanlar ile ana sayfa ayırt edilemiyordu.
// Burada bu sayfalara kendi metinlerini basıyoruz: gerçek etkinlik ve takım
// listeleri, gerçek başlıklarıyla ve detay linkleriyle.
//
// İnsan da aynı listeyi görür (SPA aynı veriyi API'den çizer) → cloaking yok.
// ============================================

const seoFill = (str, n) => String(str).replace(/\{n\}/g, n);
// Spor dalı DB'de Türkçe; sayfa dilindeki adı seo-content.json'dan (i18n.js sports).
const seoSport = (name, lang) => getSeoContent()?.sports?.[lang]?.[name] || name;

// Sayfa gövdesi + şema + başlık. Dil, adresten gelir (SEO_PATH_LOOKUP).
const seoTrainingsText = async (lang) => {
  const L = getSeoContent()?.seo?.[lang];
  if (!L) throw new Error('seo-content.json yok');
  const r = await pool.query(
    `SELECT t.id, t.title, t.sport, t.training_date, t.training_time,
            t.location_name, t.location_address, t.is_paid, teams.name AS team_name
       FROM trainings t
       LEFT JOIN teams ON t.team_id = teams.id
      WHERE t.is_public = true AND ${trainingUtcExpr('t')} >= NOW()
      ORDER BY t.training_date ASC, t.training_time ASC
      LIMIT 60`);
  const rows = r.rows;
  const items = rows.map((e) => {
    const url = `${SITE_ORIGIN}/etkinlik/${slugify(e.title)}-${e.id}`;
    const bits = [];
    if (e.sport) bits.push(htmlAttrEscape(seoSport(e.sport, lang)));
    const d = seoFormatDate(e.training_date, lang);
    if (d) bits.push(d + (e.training_time ? ` ${String(e.training_time).slice(0, 5)}` : ''));
    const yer = e.location_name || e.location_address;
    if (yer) bits.push(htmlAttrEscape(yer));
    if (e.team_name) bits.push(htmlAttrEscape(e.team_name));
    return seoListItem(url, e.title, bits);
  }).join('\n');

  return {
    page: 'trainings',
    lang,
    title: L.eventsTitle,
    description: seoFill(L.eventsDesc, rows.length),
    text: seoListPage({
      lang, h1: L.eventsH1,
      lead: seoFill(L.eventsLead, rows.length), sub: L.eventsSub,
      items, empty: L.eventsEmpty, count: rows.length, L,
    }),
    schema: seoCollectionSchema(L.eventsH1, `${SITE_ORIGIN}${SEO_LOCALIZED_PATHS[lang].trainings}`, lang,
      rows.map((e) => ({ name: e.title, url: `${SITE_ORIGIN}/etkinlik/${slugify(e.title)}-${e.id}` }))),
  };
};

const seoTeamsText = async (lang) => {
  const L = getSeoContent()?.seo?.[lang];
  if (!L) throw new Error('seo-content.json yok');
  const r = await pool.query(
    `SELECT t.id, t.name, t.sport, t.location, COUNT(tm.user_id)::int AS member_count
       FROM teams t LEFT JOIN team_members tm ON tm.team_id = t.id
      WHERE t.is_private = false
      GROUP BY t.id
      ORDER BY member_count DESC, t.updated_at DESC
      LIMIT 60`);
  const rows = r.rows;
  const items = rows.map((t) => {
    const url = `${SITE_ORIGIN}/takim/${slugify(t.name)}-${t.id}`;
    const bits = [];
    if (t.sport) bits.push(htmlAttrEscape(seoSport(t.sport, lang)));
    if (t.location) bits.push(htmlAttrEscape(t.location));
    bits.push(`${t.member_count} ${L.memberSuffix}`);
    return seoListItem(url, t.name, bits);
  }).join('\n');

  return {
    page: 'teams',
    lang,
    title: L.teamsTitle,
    description: seoFill(L.teamsDesc, rows.length),
    text: seoListPage({
      lang, h1: L.teamsH1,
      lead: seoFill(L.teamsLead, rows.length), sub: L.teamsSub,
      items, empty: L.teamsEmpty, count: rows.length, L,
    }),
    schema: seoCollectionSchema(L.teamsH1, `${SITE_ORIGIN}${SEO_LOCALIZED_PATHS[lang].teams}`, lang,
      rows.map((t) => ({ name: t.name, url: `${SITE_ORIGIN}/takim/${slugify(t.name)}-${t.id}` }))),
  };
};

const seoContactText = async (lang) => {
  const L = getSeoContent()?.seo?.[lang];
  if (!L) throw new Error('seo-content.json yok');
  const topics = {
    tr: ['Üyelik ve hesap', 'Takım kurma', 'Etkinlik soruları', 'Teknik sorun', 'İş birliği ve sponsorluk', 'Öneri ve geri bildirim'],
    en: ['Account and membership', 'Starting a team', 'Event questions', 'Technical issues', 'Collaboration and sponsorship', 'Suggestions and feedback'],
    de: ['Konto und Mitgliedschaft', 'Team gründen', 'Eventfragen', 'Technische Probleme', 'Zusammenarbeit und Sponsoring', 'Vorschläge und Feedback'],
    el: ['Λογαριασμός και συνδρομή', 'Δημιουργία ομάδας', 'Ερωτήσεις για εκδηλώσεις', 'Τεχνικά προβλήματα', 'Συνεργασία και χορηγία', 'Προτάσεις και σχόλια'],
    es: ['Cuenta y registro', 'Crear un equipo', 'Preguntas sobre eventos', 'Problemas técnicos', 'Colaboración y patrocinio', 'Sugerencias y opiniones'],
    fr: ['Compte et inscription', 'Créer une équipe', 'Questions sur les événements', 'Problèmes techniques', 'Partenariat et sponsoring', 'Suggestions et avis'],
    it: ['Account e iscrizione', 'Creare una squadra', 'Domande sugli eventi', 'Problemi tecnici', 'Collaborazioni e sponsorizzazioni', 'Suggerimenti e opinioni'],
  }[lang] || [];
  const text = `
    <div style="${SEO_WRAP_STYLE}">
      <h1 style="${SEO_H1_STYLE}">${htmlAttrEscape(L.contactH1)}</h1>
      <p style="margin:0 0 8px">${htmlAttrEscape(L.contactLead)}</p>
      <p style="margin:0 0 20px;color:#66757A;font-size:.95rem">${htmlAttrEscape(L.contactSub)}</p>
      <h2 style="font-size:1.2rem;color:#114956;margin:0 0 10px">${htmlAttrEscape(L.contactTopics)}</h2>
      <ul style="margin:0 0 24px;padding-left:20px">
${topics.map((x) => `        <li>${htmlAttrEscape(x)}</li>`).join('\n')}
      </ul>
      <p style="margin:0"><a href="https://instagram.com/muuvlinkapp" style="${SEO_LINK_STYLE}">Instagram: @muuvlinkapp</a></p>
${seoFooterLinks(lang, L)}
    </div>`;
  return {
    page: 'contact', lang, text,
    title: L.contactTitle,
    description: L.contactDesc,
    schema: {
      '@context': 'https://schema.org', '@type': 'ContactPage',
      name: L.contactTitle, url: `${SITE_ORIGIN}${SEO_LOCALIZED_PATHS[lang].contact}`, inLanguage: lang,
    },
  };
};

// Ana sayfanın İngilizce/Almanca karşılığı. Türkçe ana sayfa statik
// index.html'den gelir (nginx), Node yolun dışında kalsın diye.
const seoHomeText = async (lang) => {
  const c = getSeoContent();
  const L = c?.seo?.[lang];
  const faq = c?.faq?.[lang];
  if (!L || !faq) throw new Error('seo-content.json yok');
  const text = `
    <div style="${SEO_WRAP_STYLE}">
      <h1 style="${SEO_H1_STYLE}">${htmlAttrEscape(L.homeH1)}</h1>
      <p style="font-size:1.05rem;margin:0 0 8px">${htmlAttrEscape(faq[0].a)}</p>
${seoFooterLinks(lang, L, true)}
      <h2 style="font-size:1.5rem;color:#114956;margin:40px 0 18px">${htmlAttrEscape(L.faqTitle)}</h2>
${faq.map((f) => `      <h3 style="font-size:1rem;font-weight:600;color:#1F2121;margin:22px 0 6px">${htmlAttrEscape(f.q)}</h3>\n      <p style="margin:0;font-size:.95rem">${htmlAttrEscape(f.a)}</p>`).join('\n')}
    </div>`;
  return {
    page: 'home', lang, text,
    title: `Muuvlink — ${L.homeH1.replace(/^Muuvlink — /, '')}`,
    description: faq[0].a.slice(0, 200),
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', '@id': `${SITE_ORIGIN}/#organization`, name: 'Muuvlink',
          url: SITE_ORIGIN, logo: `${SITE_ORIGIN}/icons/favicon.png`, description: faq[0].a },
        { '@type': 'FAQPage', '@id': `${SITE_ORIGIN}${SEO_LOCALIZED_PATHS[lang].home}#faq`, inLanguage: lang,
          mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      ],
    },
  };
};

// ── Ortak parçalar ────────────────────────────────────────────────────────
const SEO_H1_STYLE = 'font-size:clamp(1.7rem,4vw,2.3rem);color:#114956;margin:0 0 14px;letter-spacing:-.02em';
const SEO_LINK_STYLE = 'color:#114956;font-weight:600;text-decoration:none';

const seoListItem = (url, name, bits) =>
  `        <li style="margin:0 0 12px"><a href="${url}" style="${SEO_LINK_STYLE}">${htmlAttrEscape(name)}</a><br><span style="color:#66757A;font-size:.9rem">${bits.join(' · ')}</span></li>`;

const seoFooterLinks = (lang, L, skipHome = false) => {
  const P = SEO_LOCALIZED_PATHS[lang];
  const parts = [
    `<a href="${SITE_ORIGIN}${P.trainings}" style="${SEO_LINK_STYLE}">${htmlAttrEscape(L.navEvents)}</a>`,
    `<a href="${SITE_ORIGIN}${P.teams}" style="${SEO_LINK_STYLE}">${htmlAttrEscape(L.navTeams)}</a>`,
    skipHome
      ? `<a href="${SITE_ORIGIN}${P.contact}" style="${SEO_LINK_STYLE}">${htmlAttrEscape(L.navContact)}</a>`
      : `<a href="${SITE_ORIGIN}${P.home}" style="${SEO_LINK_STYLE}">${htmlAttrEscape(L.navHome)}</a>`,
  ];
  return `      <p style="margin:30px 0 0">${parts.join(' · ')}</p>`;
};

const seoListPage = ({ lang, h1, lead, sub, items, empty, count, L }) => `
    <div style="${SEO_WRAP_STYLE}">
      <h1 style="${SEO_H1_STYLE}">${htmlAttrEscape(h1)}</h1>
      <p style="margin:0 0 8px">${htmlAttrEscape(lead)}</p>
      <p style="margin:0 0 26px;color:#66757A;font-size:.95rem">${htmlAttrEscape(sub)}</p>
${count ? `      <ul style="list-style:none;padding:0;margin:0">\n${items}\n      </ul>`
        : `      <p>${htmlAttrEscape(empty)}</p>`}
${seoFooterLinks(lang, L)}
    </div>`;

const seoCollectionSchema = (name, url, lang, list) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name, url, inLanguage: lang,
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: list.length,
    itemListElement: list.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: x.url })),
  },
});

const SEO_PAGE_BUILDERS = { home: seoHomeText, trainings: seoTrainingsText, teams: seoTeamsText, contact: seoContactText };

// Bot'a açılan yollar: Türkçe ana sayfa HARİÇ (o statik index.html'den gelir,
// Node insan trafiğinin yolunda kalmasın diye) + eski /antrenmanlar.
const SEO_BOT_PATHS = Object.keys(SEO_PATH_LOOKUP).filter((p) => p !== '/').concat('/antrenmanlar');

// Eski sorgu adresleri (/takimlar?takim=5, /etkinlikler?etkinlik=105) slug detay
// adresine KALICI taşındı. Query string route eşleşmesine girmediği için bu istekler
// liste sayfasını render ediyor ve canonical'ı listeye yazıyordu; Google da eski adresi
// "doğru canonical'lı alternatif sayfa" diye dizinden düşürüp değerini detay sayfası
// yerine listeye akıtıyordu. 301 doğru sayfaya taşır.
// Gizli kayıtta yönlendirme YOK: Location başlığı takım/etkinlik adını sızdırmasın —
// görünürlük kuralı detay prerender'ıyla birebir aynı.
const legacyDetailRedirect = async (req) => {
  const teamId = String(req.query.takim ?? '').trim();
  const trainingId = String(req.query.etkinlik ?? '').trim();
  try {
    if (/^\d+$/.test(teamId)) {
      const r = await pool.query('SELECT id, name, is_private FROM teams WHERE id = $1', [teamId]);
      const t0 = r.rows[0];
      if (t0 && !t0.is_private) return `${SITE_ORIGIN}/takim/${slugify(t0.name)}-${t0.id}`;
    }
    if (/^\d+$/.test(trainingId)) {
      const r = await pool.query('SELECT id, title, is_public FROM trainings WHERE id = $1', [trainingId]);
      const e0 = r.rows[0];
      if (e0 && e0.is_public !== false) return `${SITE_ORIGIN}/etkinlik/${slugify(e0.title)}-${e0.id}`;
    }
  } catch (e) {
    console.error('[SEO-301] eski adres çözümlenemedi:', e.message);
  }
  return null;
};

app.get(SEO_BOT_PATHS, async (req, res, next) => {
  const moved = await legacyDetailRedirect(req);
  if (moved) return res.redirect(301, moved);
  const hit = SEO_PATH_LOOKUP[req.path] ||
    (req.path === '/antrenmanlar' ? { lang: 'tr', page: 'trainings' } : null);
  const html = getIndexHtml();
  if (!hit || !html) return next();
  try {
    const page = await SEO_PAGE_BUILDERS[hit.page](hit.lang);
    const canonical = `${SITE_ORIGIN}${SEO_LOCALIZED_PATHS[hit.lang][hit.page]}`;
    let out = injectOgTags(html, {
      title: page.title,
      description: page.description,
      url: canonical,
      image: `${SITE_ORIGIN}/og-image.jpg`,
    });
    out = out.replace('<html lang="tr">', `<html lang="${hit.lang}">`);
    out = replaceSeoRegion(out, 'SEO-HREFLANG', seoHreflang(hit.page));
    out = replaceSeoRegion(out, 'SEO-TEXT', page.text);
    out = replaceSeoRegion(out, 'SEO-SCHEMA',
      `  <script type="application/ld+json">\n${JSON.stringify(page.schema, null, 2)}\n  </script>`);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(out);
  } catch (e) {
    console.error('[SEO-LIST] render hatası:', e.message);
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html); // hata → normal SPA kabuğu, asla 500 verme
  }
});

// ============================================
// PUBLIC TRAININGS (AUTH GEREKMİYOR)
// ============================================
app.get('/api/trainings/public', async (req, res) => {
  try {
    const { team_id, date_from, date_to, sport } = req.query;

    let query = `
      SELECT t.*, 
             teams.name as team_name,
             teams.sport as team_sport,
             teams.avatar as team_avatar,
             creator.name as creator_name,
             COUNT(DISTINCT ta.user_id) as attendee_count
      FROM trainings t
      LEFT JOIN teams ON t.team_id = teams.id
      LEFT JOIN users creator ON creator.id = t.created_by
      LEFT JOIN training_attendees ta ON t.id = ta.training_id
      WHERE t.is_public = true
  AND ${trainingUtcExpr('t')} >= NOW()
    `;

    const params = [];
    let paramCount = 0;

    if (team_id) {
      paramCount++;
      query += ` AND t.team_id = $${paramCount}`;
      params.push(team_id);
    }

    if (date_from) {
      paramCount++;
      query += ` AND t.training_date >= $${paramCount}`;
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND t.training_date <= $${paramCount}`;
      params.push(date_to);
    }

    if (sport) {
      paramCount++;
      query += ` AND COALESCE(t.sport, teams.sport) = $${paramCount}`;
      params.push(sport);
    }

    query += `
      GROUP BY t.id, teams.name, teams.sport, teams.avatar, creator.name
      ORDER BY t.training_date ASC, t.training_time ASC
    `;

    const result = await pool.query(query, params);
    attachCreatorDisplay(result.rows);

    res.json({
      trainings: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get public trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// AUTH ROUTES
// =====================================================

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const regLang = MAIL_LANGS.includes(req.body.lang) ? req.body.lang : null;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
    }
    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'İsim en az 2 karakter olmalıdır.' });
    }

    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);

    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Kazanım kaynağı — tarayıcıdaki ilk dokunuşta yakalanıp kayıtla taşınır.
    const attr = req.body._attr || {};
    const platform = req.body._src || null;
    const trim255 = (v) => (v == null ? null : String(v).slice(0, 255));

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone, notif_prefs,
                          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                          fbclid, acquisition_platform, landing_page, referrer, lang)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, name, email, avatar, created_at, notif_prefs, lang`,
      [name, email, passwordHash, phone, JSON.stringify(DEFAULT_NOTIF_PREFS),
       trim255(attr.utm_source), trim255(attr.utm_medium), trim255(attr.utm_campaign),
       trim255(attr.utm_content), trim255(attr.utm_term), trim255(attr.fbclid),
       trim255(platform), trim255(attr.landing_page), trim255(attr.referrer), regLang]
    );

    const user = result.rows[0];

    // Initialize user stats
    await pool.query(
      'INSERT INTO user_stats (user_id) VALUES ($1)',
      [user.id]
    );

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '30d',
    });

    // Bekleyen takım davetlerini otomatik kabul et
    const invites = await pool.query(
      'SELECT * FROM team_invitations WHERE invitee_email = $1',
      [email]
    );
    for (const inv of invites.rows) {
      await pool.query(
        'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [inv.team_id, user.id, 'member']
      );
      await pool.query('DELETE FROM team_invitations WHERE id = $1', [inv.id]);
    }

    logActivity('user_register', user.id, user.name, { email }, `user_register_${user.id}`);

    // Ana dönüşüm olayı. Tarayıcı aynı _eid ile pixel'i de ateşler; Meta
    // ikisini tekilleştirir. Kampanyalar başlangıçta buna optimize edilecek.
    const signals = metaSignalsFrom(req);
    trackMeta('CompleteRegistration', {
      ...signals,
      userId: user.id,
      email,
      phone,
      firstName: String(name || '').trim().split(/\s+/)[0],
      customData: {
        registration_source: attr.utm_source || 'direct',
        platform: platform || 'web',
      },
    });

    liveClaim(req, user.id);
    res.status(201).json({ message: 'User registered successfully', user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, name, email, password_hash, avatar, deleted_at, lang FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Silinmeye zamanlanmış hesap → doğru şifreyle giriş onu GERİ GETİRİR.
    let restored = false;
    if (user.deleted_at) {
      await pool.query('UPDATE users SET deleted_at = NULL, leave_reason = NULL, leave_note = NULL WHERE id = $1', [user.id]);
      restored = true;
      pool.query(
        `UPDATE account_departures SET restored_at = NOW(), user_id = NULL
         WHERE user_id = $1 AND restored_at IS NULL AND purged_at IS NULL`, [user.id]
      ).catch(() => {});
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '30d',
    });

    delete user.password_hash;
    delete user.deleted_at;

    liveClaim(req, user.id);
    res.json({ message: 'Login successful', user, token, restored });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, avatar, is_admin, created_at, notif_prefs, onboarding_done, lang FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Tanıtım turu durumu. done=false ile gönderilirse tur tekrar izlenebilir
// (profil → "Tanıtım turunu tekrar izle").
app.post('/api/auth/onboarding', authenticateToken, async (req, res) => {
  try {
    const done = req.body?.done !== false;
    await pool.query('UPDATE users SET onboarding_done = $1 WHERE id = $2', [done, req.user.id]);
    res.json({ onboarding_done: done });
  } catch (error) {
    console.error('Onboarding update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    const result = await pool.query(
      `UPDATE users SET name = $1, phone = $2, avatar = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, name, email, phone, avatar`,
      [name, phone, avatar, req.user.id]
    );

    res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Avatar fotoğrafı yükleme
app.post('/api/auth/avatar', authenticateToken, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi.' });
    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `avatar-${req.user.id}-${Date.now()}.webp`;
    const webpBuffer = await toWebP(req.file.buffer, 400);
    const avatarUrl = await uploadToSupabase('avatars', fileName, webpBuffer, 'image/webp');
    const result = await pool.query(
      `UPDATE users SET avatar = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
       RETURNING id, name, email, phone, avatar`,
      [avatarUrl, req.user.id]
    );
    res.json({ message: 'Avatar güncellendi', user: result.rows[0] });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/teams/:id/avatar', authenticateToken, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const teamId = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi.' });

    const ownerCheck = await pool.query(
      'SELECT owner_id FROM teams WHERE id = $1',
      [teamId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Takım bulunamadı.' });
    if (!(await canManageTeam(teamId, req.user.id))) return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });

    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `team-${teamId}-${Date.now()}.webp`;
    const webpBuffer = await toWebP(req.file.buffer, 400);
    const avatarUrl = await uploadToSupabase('avatars', fileName, webpBuffer, 'image/webp');

    const result = await pool.query(
      'UPDATE teams SET avatar = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [avatarUrl, teamId]
    );
    res.json({ message: 'Takım fotoğrafı güncellendi', avatar: avatarUrl, team: result.rows[0] });
  } catch (error) {
    console.error('Team avatar upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const validPassword = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// TEAMS ROUTES
// =====================================================

app.post('/api/teams', authenticateToken, async (req, res) => {
  try {
    const { name, sport, sports, description, location, is_private, avatar } = req.body;

    // Çoklu spor dalı; geriye dönük olarak tekil `sport` da kabul edilir.
    const sportsArr = (Array.isArray(sports) ? sports : []).filter(Boolean);
    if (!sportsArr.length && sport) sportsArr.push(sport);
    if (!name || !sportsArr.length) {
      return res.status(400).json({ error: 'Name and at least one sport are required' });
    }
    const primarySport = sportsArr[0]; // tekil `sport` = birincil dal (mevcut gösterimlerle uyum)

    const teamResult = await pool.query(
      `INSERT INTO teams (name, sport, sports, description, location, is_private, owner_id, avatar, subscription_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name,
        primarySport,
        sportsArr,
        description,
        location,
        is_private || false,
        req.user.id,
        avatar || '⚽',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ]
    );

    const team = teamResult.rows[0];

    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [team.id, req.user.id, 'owner']
    );

    await updateUserStats(req.user.id);

    logActivity('team_create', req.user.id, null, { team_name: name, sport: primarySport }, `team_create_${team.id}`);
    trackMeta('CreateTeam', {
      ...metaSignalsFrom(req), userId: req.user.id, email: req.user.email,
      customData: { content_ids: [String(team.id)], sport: primarySport || undefined },
    });
    res.status(201).json({ message: 'Team created successfully', team });
    indexNowPing(indexNowTeamUrl(team));
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/teams', optionalAuth, async (req, res) => {
  try {
    const { sport, search, member_only, can_create_training } = req.query;

    let whereClause;
    if (can_create_training === 'true') {
      // Sadece etkinlik oluşturabildiği takımlar (sahip/antrenör/kaptan)
      whereClause = `t.id IN (SELECT team_id FROM team_members WHERE user_id = $1 AND role IN ('owner','coach','captain','editor'))`;
    } else if (member_only === 'true') {
      // Sadece kullanıcının üye olduğu takımlar (profil sayfası için)
      whereClause = `t.id IN (SELECT team_id FROM team_members WHERE user_id = $1)`;
    } else if (!req.user) {
      // Giriş yapmamış kullanıcılar sadece herkese açık takımları görebilir
      whereClause = `t.is_private = false`;
    } else {
      // Giriş yapmış kullanıcılar: herkese açık + üye oldukları gizli takımlar
      whereClause = `(t.is_private = false OR t.id IN (SELECT team_id FROM team_members WHERE user_id = $1))`;
    }

    let query = `
      SELECT t.*,
             u.name as owner_name,
             COUNT(DISTINCT tm.user_id) as member_count,
             my_role.role as my_role
      FROM teams t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN team_members my_role ON my_role.team_id = t.id AND my_role.user_id = $1
      WHERE ${whereClause}
    `;

    const params = [req.user?.id || null];
    let paramCount = 1;

    if (sport) {
      paramCount++;
      // Çoklu dal: seçilen dal takımın dalları arasındaysa eşleş (tekil sport'a da düş).
      query += ` AND ($${paramCount} = ANY(t.sports) OR t.sport = $${paramCount})`;
      params.push(sport);
    }

    if (search) {
      paramCount++;
      query += ` AND (t.name ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' GROUP BY t.id, u.name, my_role.role ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);

    // Üyesi olmadığı takımda sahibin adı da maskeli (bkz. GET /api/teams/:id).
    const teams = result.rows.map((t) => (t.my_role ? t : { ...t, owner_name: maskPersonName(t.owner_name) }));

    res.json({ teams });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/teams/:id', optionalAuth, async (req, res) => {
  try {
    const teamId = req.params.id;

    const teamResult = await pool.query(
      `SELECT t.*, 
              u.name as owner_name,
              COUNT(DISTINCT tm.user_id) as member_count
       FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       LEFT JOIN team_members tm ON t.id = tm.team_id
       WHERE t.id = $1
       GROUP BY t.id, u.name`,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];

    // Görüntüleyen bu takımın üyesi mi / platform admini mi? İsimlerin açık
    // gidip gitmeyeceğine bu karar verir; her istekte yeniden bakılır, yani
    // takımdan çıkan kişi bir sonraki yüklemede yine baş harfleri görür.
    let viewerIsMember = false;
    let viewerIsAdmin = false;
    if (req.user) {
      const v = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2) AS member,
                COALESCE((SELECT is_admin FROM users WHERE id = $2), false) AS admin`,
        [teamId, req.user.id]
      );
      viewerIsMember = v.rows[0].member;
      viewerIsAdmin = v.rows[0].admin;
    }

    if (team.is_private && !viewerIsMember) {
      return res.status(403).json({ error: 'Access denied to private team' });
    }
    const showNames = viewerIsMember || viewerIsAdmin;

    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.avatar, u.is_admin, tm.role, tm.joined_at
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [teamId]
    );

    team.members = membersResult.rows;

    // Get team posts (+ beğeni bilgileri; giriş yoksa $2 null → liked_by_me false)
    const postsResult = await pool.query(
      `SELECT tp.*, u.name as user_name, u.avatar as user_avatar,
              (SELECT COUNT(*) FROM team_post_likes pl WHERE pl.post_id = tp.id)::int as like_count,
              (($2::int IS NOT NULL) AND EXISTS (
                 SELECT 1 FROM team_post_likes pl WHERE pl.post_id = tp.id AND pl.user_id = $2
              )) as liked_by_me,
              COALESCE((
                 SELECT json_agg(json_build_object('id', lu.id, 'name', lu.name) ORDER BY pl.created_at)
                 FROM team_post_likes pl JOIN users lu ON lu.id = pl.user_id
                 WHERE pl.post_id = tp.id
              ), '[]'::json) as likers
       FROM team_posts tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.team_id = $1 AND tp.is_deleted IS NOT TRUE
       ORDER BY tp.created_at DESC
       LIMIT 10`,
      [teamId, req.user?.id || null]
    );

    team.posts = postsResult.rows;

    // Takım dışındakiler: üye listesinde isimler maskeli, profil fotoğrafları
    // gönderilmez (arayüz baş harfli daireye düşer); takım duvarı hiç gönderilmez.
    // id'ler kalıyor — arayüz "üye miyim / sahibi kim" kararını id ile veriyor.
    if (!showNames) {
      team.owner_name = maskPersonName(team.owner_name);
      team.members = team.members.map((m) => ({ ...m, name: maskPersonName(m.name), avatar: null }));
      team.posts = [];
    }
    team.names_masked = !showNames;

    res.json({ team });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/teams/:id/join', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;

    const teamResult = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];

    const memberCheck = await pool.query(
      'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Already a member of this team' });
    }

    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [teamId, req.user.id, 'member']
    );

    // Katılan kullanıcının adını al
    const joinerRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
    const joinerName = joinerRes.rows[0]?.name || req.user.email;

    // Yeni üye bildirimi takımın YÖNETİMİNE gider (sahip, antrenör, kaptan, editör) —
    // sıradan üyelere gitmez.
    const leadersRes = await pool.query(
      `SELECT tm.user_id, u.email, u.name FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.role IN ('owner', 'coach', 'captain', 'editor')`,
      [teamId]
    );

    for (const leader of leadersRes.rows) {
      await createNotif(leader.user_id, {
        build: (L) => ({ title: tm(L, 'joinTeamNotifTitle'), message: tm(L, 'joinTeamNotifMsg', joinerName, team.name) }),
        type: 'team',
        refId: teamId,
        url: `/takimlar?takim=${teamId}`,
      });

      sendEmail({
        to: leader.email,
        userId: leader.user_id,
        prefKey: 'team_member',
        build: (L) => ({ subject: tm(L, 'joinTeamSubject', team.name, joinerName), html: emailWrapper(`
          <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(L, 'joinTeamTitle')}</h2>
          <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
            ${tm(L, 'joinTeamBody', joinerName, team.name)}
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:28px;text-align:center;">
            <div style="width:56px;height:56px;background:linear-gradient(135deg,#114956,#0e3c47);border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;line-height:56px;text-align:center;">U</div>
            <div style="font-size:18px;font-weight:700;color:#0e3c47;">${joinerName}</div>
          </div>
          <div style="text-align:center;">
            <a href="${process.env.APP_URL || 'https://muuvlink.app'}/takimlar?takim=${teamId}"
               style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                      padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
              ${tm(L, 'btnViewTeam')}
            </a>
          </div>
        `, L) }),
      }).catch(e => console.error('Join email error:', e.message));
    }

    await updateUserStats(req.user.id);

    logActivity('team_join', req.user.id, joinerName, { team_name: team.name });
    trackMeta('JoinTeam', {
      ...metaSignalsFrom(req), userId: req.user.id, email: req.user.email,
      customData: { content_ids: [String(team.id ?? req.params.id)] },
    });
    res.json({ message: 'Successfully joined the team' });
  } catch (error) {
    console.error('Join team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/teams/:id/invite', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Rol kontrolü: owner veya coach davet edebilir
    const memberCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, req.user.id]
    );

    if (memberCheck.rows.length === 0 || (!INVITE_MANAGER_ROLES.includes(memberCheck.rows[0].role) && !(await isPlatformAdmin(req.user.id)))) {
      return res.status(403).json({ error: 'Only team owners/editors/coaches can invite members' });
    }

    // Takım bilgilerini çek
    const teamResult = await pool.query(
      `SELECT t.name, t.sport, t.avatar, u.name as inviter_name
       FROM teams t
       JOIN users u ON u.id = $2
       WHERE t.id = $1`,
      [teamId, req.user.id]
    );
    const team = teamResult.rows[0];

    // Daha önce davet var mı?
    const existingInvite = await pool.query(
      `SELECT id FROM team_invitations WHERE team_id = $1 AND invitee_email = $2`,
      [teamId, email]
    );
    if (existingInvite.rows.length > 0) {
      return res.status(409).json({ error: 'Bu e-posta adresi zaten davet edildi.' });
    }

    // Zaten üye mi?
    const alreadyMember = await pool.query(
      `SELECT tm.id FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND u.email = $2`,
      [teamId, email]
    );
    if (alreadyMember.rows.length > 0) {
      return res.status(409).json({ error: 'Bu kullanıcı zaten takım üyesi.' });
    }

    // Daveti kaydet
    const result = await pool.query(
      `INSERT INTO team_invitations (team_id, inviter_id, invitee_email)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [teamId, req.user.id, email]
    );

    // Kullanıcı kayıtlı mı kontrol et
    const userResult = await pool.query(
      'SELECT id, name FROM users WHERE email = $1',
      [email]
    );

    const isRegistered = userResult.rows.length > 0;

    // Kayıtlı kullanıcıya in-app bildirim
    if (isRegistered) {
      await createNotif(userResult.rows[0].id, {
        build: (L) => ({ title: tm(L, 'inviteNotifTitle'), message: tm(L, 'inviteNotifMsg', team.inviter_name, team.name) }),
        type: 'invitation',
        refId: teamId,
        url: `/takimlar?takim=${teamId}`,
      });
    }

    // Her iki durumda da mail gönder. Kayıtlı alıcı kendi dilinde; kayıtlı değilse
    // daveti gönderenin arayüz dilinde (alıcının dilini bilemiyoruz).
    const inviteData = { teamName: team.name, teamSport: team.sport, inviterName: team.inviter_name, teamId, avatar: team.avatar };
    await sendEmail({
      to: email,
      prefKey: 'invite',
      fallbackLang: reqLang(req),
      build: (L) => ({
        subject: tm(L, 'inviteSubject', team.inviter_name, team.name),
        html: isRegistered ? inviteEmailExisting(inviteData, L) : inviteEmailNew(inviteData, L),
      }),
    });

    res.json({
      message: isRegistered
        ? 'Davet gönderildi. Kullanıcıya bildirim ve e-posta iletildi.'
        : 'Davet gönderildi. Kullanıcı kayıtlı değil — kayıt daveti e-postası iletildi.',
      invitation: result.rows[0],
      is_registered: isRegistered,
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Takımın bekleyen davetlerini getir (owner/coach görebilir)
app.get('/api/teams/:id/invitations', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const memberCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length || (!INVITE_MANAGER_ROLES.includes(memberCheck.rows[0].role) && !(await isPlatformAdmin(req.user.id)))) {
      return res.status(403).json({ error: 'Yetki yok.' });
    }
    const result = await pool.query(
      `SELECT ti.id, ti.invitee_email, ti.created_at,
              u.name as inviter_name
       FROM team_invitations ti
       JOIN users u ON u.id = ti.inviter_id
       WHERE ti.team_id = $1
       ORDER BY ti.created_at DESC`,
      [teamId]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Daveti iptal et (owner/coach yapabilir)
app.delete('/api/teams/:id/invitations/:inviteId', authenticateToken, async (req, res) => {
  try {
    const { id: teamId, inviteId } = req.params;
    const memberCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length || (!INVITE_MANAGER_ROLES.includes(memberCheck.rows[0].role) && !(await isPlatformAdmin(req.user.id)))) {
      return res.status(403).json({ error: 'Yetki yok.' });
    }
    await pool.query(
      `DELETE FROM team_invitations WHERE id = $1 AND team_id = $2`,
      [inviteId, teamId]
    );
    res.json({ message: 'Davet iptal edildi.' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Daveti kabul et (kayıtlı kullanıcı mail linkinden gelir)
app.post('/api/teams/:id/accept-invite', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const userEmail = req.user.email;

    const invite = await pool.query(
      'SELECT id FROM team_invitations WHERE team_id = $1 AND invitee_email = $2',
      [teamId, userEmail]
    );
    if (!invite.rows.length) {
      return res.status(404).json({ error: 'Bekleyen davet bulunamadı.' });
    }

    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [teamId, req.user.id, 'member']
    );
    await pool.query('DELETE FROM team_invitations WHERE id = $1', [invite.rows[0].id]);

    res.json({ message: 'Takıma başarıyla katıldınız!' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    // Not: avatar burada GÜNCELLENMEZ — fotoğraf yalnızca POST /teams/:id/avatar
    // ile yönetilir. Aksi halde formdaki bayat avatar değeri yeni fotoğrafı geri alabilir.
    const { name, sport, sports, description, location, is_private } = req.body;

    const ownerCheck = await pool.query('SELECT owner_id FROM teams WHERE id = $1', [teamId]);
    if (!ownerCheck.rows.length) return res.status(404).json({ error: 'Team not found' });
    if (!(await canManageTeam(teamId, req.user.id))) {
      return res.status(403).json({ error: 'Only team owner/editor can edit the team' });
    }

    // Takım gizli yapılırsa tüm etkinlikleri da gizle
    if (is_private === true) {
      await pool.query('UPDATE trainings SET is_public = false WHERE team_id = $1', [teamId]);
    }

    // Çoklu dal; en az bir dal olmalı. Tekil `sport` = birincil dal.
    const sportsArr = (Array.isArray(sports) ? sports : []).filter(Boolean);
    if (!sportsArr.length && sport) sportsArr.push(sport);
    const primarySport = sportsArr[0] || null;

    // Gizlilik yalnızca AÇIKÇA boolean geldiyse değişir. Eksik/bozuk bir alan
    // gizli bir takımı sessizce herkese açık yapmasın.
    const privacyArg = typeof is_private === 'boolean' ? is_private : null;

    const result = await pool.query(
      `UPDATE teams SET name=$1, sport=$2, sports=$3, description=$4, location=$5,
              is_private=COALESCE($6, is_private), updated_at=CURRENT_TIMESTAMP
       WHERE id=$7 RETURNING *`,
      [name, primarySport, (sportsArr.length ? sportsArr : null), description, location, privacyArg, teamId]
    );

    res.json({ message: 'Team updated', team: result.rows[0] });
    // Gizliye çevrildiyse de bildiriyoruz: motor adresi yeniden tarayıp düşürsün.
    indexNowPing(`${SITE_ORIGIN}/takim/${slugify(result.rows[0].name)}-${result.rows[0].id}`);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;

    const ownerCheck = await pool.query('SELECT owner_id, name, is_private FROM teams WHERE id = $1', [teamId]);
    if (!ownerCheck.rows.length) return res.status(404).json({ error: 'Team not found' });
    if (ownerCheck.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only team owner can delete the team' });
    }

    const teamMeta = await pool.query(
      'SELECT (SELECT COUNT(*)::int FROM team_members WHERE team_id = $1) AS members, (SELECT COUNT(*)::int FROM trainings WHERE team_id = $1) AS trainings', [teamId]);
    await pool.query('DELETE FROM teams WHERE id = $1', [teamId]);
    logDeletion('team', { id: teamId, name: ownerCheck.rows[0].name, meta: teamMeta.rows[0] }, req.user.id, 'self');
    res.json({ message: 'Team deleted' });
    indexNowPing(indexNowTeamUrl({ ...ownerCheck.rows[0], id: teamId }));
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/teams/:teamId/members/:userId/role', authenticateToken, async (req, res) => {
  try {
    const { teamId, userId } = req.params;
    const { role } = req.body;

    const ALLOWED_ROLES = ['member', 'coach', 'captain', 'editor', 'owner'];
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Geçersiz rol. İzin verilenler: member, coach, captain, editor, owner' });
    }

    const ownerCheck = await pool.query(
      'SELECT owner_id, name, avatar FROM teams WHERE id = $1',
      [teamId]
    );
    if (!ownerCheck.rows.length) return res.status(404).json({ error: 'Team not found' });

    if (!(await canManageTeam(teamId, req.user.id))) {
      return res.status(403).json({ error: 'Only team owner/editor can change roles' });
    }

    // Takım sahibinin rolü bu uçtan değiştirilemez (sahiplik teams.owner_id ile yönetilir).
    if (parseInt(userId) === ownerCheck.rows[0].owner_id) {
      return res.status(403).json({ error: 'Takım sahibinin rolü değiştirilemez.' });
    }

    // Mevcut rolü al — gerçekten değiştiyse bildirim/mail gönder
    const prev = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    if (!prev.rows.length) return res.status(404).json({ error: 'Üye bulunamadı.' });
    const oldRole = prev.rows[0].role;

    // "Sahip" rolünü yalnızca takımın ASIL sahibi (owner_id) verebilir veya geri alabilir.
    // Editör/co-owner başka birini sahip yapamaz; başka bir sahibin rolüne dokunamaz.
    const isPrimaryOwner = req.user.id === ownerCheck.rows[0].owner_id;
    if ((role === 'owner' || oldRole === 'owner') && !isPrimaryOwner && !(await isPlatformAdmin(req.user.id))) {
      return res.status(403).json({ error: 'Sahip rolünü yalnızca takımın asıl sahibi yönetebilir.' });
    }

    await pool.query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
      [role, teamId, userId]
    );

    res.json({ message: 'Role updated' });

    // Rol gerçekten değiştiyse ve kişi kendi rolünü değiştirmediyse: bildirim + mail
    if (oldRole !== role && parseInt(userId) !== req.user.id) {
      (async () => {
        try {
          const team = ownerCheck.rows[0];
          const newRoleLabel = ROLE_LABELS_TR[role] || role; // (Türkçe; alıcı dili için roleLabel)
          const [target, changer] = await Promise.all([
            pool.query('SELECT id, name, email FROM users WHERE id = $1', [userId]),
            pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]),
          ]);
          if (!target.rows.length) return;
          const changerOf = (L) => changer.rows[0]?.name || tm(L, 'changerFallback');

          await createNotif(target.rows[0].id, {
            build: (L) => ({ title: tm(L, 'roleNotifTitle'), message: tm(L, 'roleNotifMsg', changerOf(L), team.name, roleLabel(L, role)) }),
            type: 'role_change',
            refId: parseInt(teamId),
            url: `/takimlar?takim=${teamId}`,
          });

          if (target.rows[0].email) {
            await sendEmail({
              to: target.rows[0].email,
              userId: target.rows[0].id,
              prefKey: 'role',
              build: (L) => ({
                subject: tm(L, 'roleSubject', team.name),
                html: roleChangeEmail({
                  teamName: team.name,
                  teamId,
                  newRoleLabel: roleLabel(L, role),
                  changerName: changerOf(L),
                  avatar: team.avatar,
                }, L),
              }),
            });
          }
        } catch (e) {
          console.error('Role change notify error:', e.message);
        }
      })();
    }
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/teams/:teamId/members/:userId', authenticateToken, async (req, res) => {
  try {
    const { teamId, userId } = req.params;

    const ownerCheck = await pool.query(
      'SELECT owner_id FROM teams WHERE id = $1',
      [teamId]
    );

    // Sahip, antrenör veya kendisi çıkabilir
    const myRole = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );
    const isOwner = ownerCheck.rows[0].owner_id === req.user.id;
    const isCoach = myRole.rows[0]?.role === 'coach';
    const isEditor = myRole.rows[0]?.role === 'editor';
    const isSelf = req.user.id === parseInt(userId);
    // Takıma üye olan platform admini de üye çıkarabilir.
    const isAdminMember = myRole.rows.length > 0 && (await isPlatformAdmin(req.user.id));

    // Sahip çıkarılamaz
    if (parseInt(userId) === ownerCheck.rows[0].owner_id) {
      return res.status(403).json({ error: 'Takım sahibi çıkarılamaz.' });
    }

    if (!isOwner && !isCoach && !isEditor && !isSelf && !isAdminMember) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }

    await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/teams/:id/posts', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mesaj boş olamaz.' });
    }

    // Üyelik kontrolü + göndericinin bilgilerini çek
    const memberCheck = await pool.query(
      `SELECT tm.id, u.name as user_name, u.avatar as user_avatar
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.user_id = $2`,
      [teamId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only team members can post' });
    }

    const poster = memberCheck.rows[0];

    // Takım bilgisini çek
    const teamResult = await pool.query(
      'SELECT id, name, sport FROM teams WHERE id = $1',
      [teamId]
    );
    const team = teamResult.rows[0];

    // Gönderiyi kaydet
    const result = await pool.query(
      `INSERT INTO team_posts (team_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [teamId, req.user.id, message.trim()]
    );

    const post = result.rows[0];

    // Diğer tüm üyeleri çek (göndericinin kendisi hariç)
    const otherMembers = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.user_id != $2`,
      [teamId, req.user.id]
    );

    const postNow = new Date();
    const postDateIn = (L) => postNow.toLocaleString(MAIL_LOCALE[mailLang(L)], {
      timeZone: 'Europe/Istanbul',
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // Her üye için bildirim + mail (paralel, hata durumunda durmaz)
    const notifAndMailPromises = otherMembers.rows.map(async (member) => {
      // In-app bildirim
      await createNotif(member.id, {
        build: (L) => ({ title: tm(L, 'wallNotifTitle', team.name), message: `${poster.user_name}: ${message.trim().slice(0, 80)}${message.length > 80 ? '...' : ''}` }),
        type: 'team_post',
        refId: teamId,
        url: `/takimlar?takim=${teamId}&tab=duvar`,
      });

      // Mail
      sendEmail({
        to: member.email,
        userId: member.id,
        prefKey: 'wall_post',
        build: (L) => ({
          subject: tm(L, 'wallSubject', team.name),
          html: wallPostEmail({
            teamName: team.name,
            teamId,
            posterName: poster.user_name,
            posterAvatar: poster.user_avatar,
            message: message.trim(),
            postDate: postDateIn(L),
          }, L),
        }),
      });
    });

    // Bildirimleri bekle ama mail'i background'da çalıştır
    await Promise.allSettled(notifAndMailPromises);

    res.json({ post: { ...post, user_name: poster.user_name, user_avatar: poster.user_avatar } });
  } catch (error) {
    console.error('Post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// TRAININGS ROUTES
// =====================================================

app.post('/api/trainings', authenticateToken, async (req, res) => {
  try {
    const {
      team_id,
      sport,
      title,
      description,
      training_date,
      training_time,
      duration_minutes,
      location_name,
      location_lat,
      location_lng,
      location_address,
      capacity,
      is_public,
      difficulty,
      registration_url,
      registration_label,
    } = req.body;

    if (!title || !training_date || !training_time || !location_name) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Dış kayıt linki YALNIZ takım etkinliklerinde. Bireyselde gelirse
    // sessizce yok sayılır (sanitize fonksiyonu teamId yoksa null döner).
    const regUrl = sanitizeRegistrationUrl(registration_url, team_id);
    if (team_id && registration_url && !regUrl) {
      return res.status(400).json({ error: 'Kayıt adresi geçersiz. http:// veya https:// ile başlamalı.' });
    }
    const regLabel = sanitizeRegistrationLabel(registration_label, team_id, regUrl);

    // team_id varsa takım etkinliği: yetki + gizlilik takımdan.
    // team_id yoksa BİREYSEL etkinlik: her giriş yapmış kullanıcı oluşturabilir, spor formdan gelir.
    let finalIsPublic;
    if (team_id) {
      const memberCheck = await pool.query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
        [team_id, req.user.id]
      );
      if (memberCheck.rows.length === 0 || !TRAINING_MANAGER_ROLES.includes(memberCheck.rows[0].role)) {
        return res.status(403).json({ error: 'Etkinlik oluşturmak için takımın sahibi, antrenörü veya kaptanı olmanız gerekiyor.' });
      }
      // Gizli takımın etkinliği asla public olamaz
      const teamCheck = await pool.query('SELECT is_private FROM teams WHERE id = $1', [team_id]);
      const teamIsPrivate = teamCheck.rows[0]?.is_private || false;
      finalIsPublic = teamIsPrivate ? false : (is_public !== undefined ? is_public : true);
    } else {
      finalIsPublic = is_public !== undefined ? is_public : true;
    }

    // Çift gönderim koruması: yavaş bağlantıda istek asılı kalınca kullanıcı butona
    // tekrar basıp aynı etkinliği iki kez oluşturabiliyor. Aynı takımda aynı
    // başlık/tarih/saat ile son 2 dakikada bir kayıt varsa yenisini yaratmak yerine
    // mevcut olanı döndür — istek başarılı görünür ama tekrar kayıt oluşmaz.
    const duplicate = await pool.query(
      `SELECT * FROM trainings
        WHERE created_by = $1 AND title = $2 AND training_date = $3 AND training_time = $4
          AND created_at > NOW() - INTERVAL '2 minutes'
        ORDER BY id DESC LIMIT 1`,
      [req.user.id, title, training_date, training_time]
    );
    if (duplicate.rows.length > 0) {
      console.warn('[TRAINING] Çift gönderim engellendi, mevcut kayıt döndürüldü:', duplicate.rows[0].id);
      return res.status(201).json({ message: 'Training created successfully', training: duplicate.rows[0] });
    }

    // Etkinliğin yapılacağı yerin saat dilimi — training_datetime_utc'yi DB trigger'ı bundan hesaplar
    const trainingTimezone = resolveTrainingTimezone(location_lat, location_lng);

    const result = await pool.query(
      `INSERT INTO trainings (
        team_id, sport, created_by, title, description, training_date, training_time, duration_minutes,
        location_name, location_lat, location_lng, location_address, capacity, is_public, difficulty,
        training_timezone, registration_url, registration_label
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        team_id || null,
        sport || null, // etkinliğin kendi dalı — takım etkinliğinde de takımın dalları arasından seçilir
        req.user.id,
        title,
        description,
        training_date,
        training_time,
        duration_minutes || 60,
        location_name,
        location_lat,
        location_lng,
        location_address,
        capacity || 20,
        finalIsPublic,
        difficulty || 'Orta',
        trainingTimezone,
        regUrl,
        regLabel,
      ]
    );

    const training = result.rows[0];

    // Takım etkinliğiyse takım üyelerine haber ver. Bireysel etkinlikte bildirilecek takım yok.
    if (team_id) {
      const teamRow = await pool.query('SELECT name FROM teams WHERE id = $1', [team_id]);
      const teamName = teamRow.rows[0]?.name || 'Takımınız';

      // Yaklaşan diğer etkinlikleri al (yeni oluşturulan hariç)
      const upcomingRes = await pool.query(
        `SELECT title, training_date, training_time, location_name FROM trainings
         WHERE team_id = $1 AND id != $2 AND ${trainingUtcExpr('')} >= NOW()
         ORDER BY training_date, training_time LIMIT 3`,
        [team_id, training.id]
      );

      const members = await pool.query(
        'SELECT tm.user_id, u.email, u.name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = $1 AND tm.user_id != $2',
        [team_id, req.user.id]
      );

      for (const member of members.rows) {
        // In-app bildirim
        await createNotif(member.user_id, {
          build: (L) => ({ title: tm(L, 'newNotifTitle'), message: tm(L, 'newNotifMsg', teamName, title) }),
          type: 'training',
          refId: training.id,
          url: `/etkinlikler?etkinlik=${training.id}`,
        });
        // E-posta
        sendEmail({
          to: member.email,
          userId: member.user_id,
          prefKey: 'event_new',
          build: (L) => ({
            subject: tm(L, 'newSubject', teamName, title),
            html: newTrainingEmail({
              teamName,
              trainingTitle: title,
              trainingDate: formatTrDate(training.training_date, L),
              trainingTime: training.training_time,
              location: location_name,
              description,
              upcomingTrainings: upcomingRes.rows,
              trainingId: training.id,
            }, L),
          }),
        }).catch(e => console.error('Training email error:', e.message));
      }
    }

    // Oluşturan kişiyi otomatik katılımcı yap
    await pool.query(
      'INSERT INTO training_attendees (training_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [training.id, req.user.id, 'confirmed']
    );

    logActivity('training_create', req.user.id, null, { training_title: title, team_name: team_id ? undefined : 'Bireysel' }, `training_create_${training.id}`);
    // Arz tarafı: etkinlik oluşturanlar ayrı bir Lookalike kaynağı olacak —
    // organizatör bulmak, katılımcı bulmaktan farklı bir iş.
    trackMeta('CreateTraining', {
      ...metaSignalsFrom(req), userId: req.user.id, email: req.user.email,
      customData: { content_ids: [String(training.id)], sport: sport || undefined },
    });

    // Rozet kontrolü — "Organizatör" gibi oluşturma bazlı rozetler
    checkAndAwardBadges(req.user.id).catch(e => console.error('Badge check (create) error:', e.message));

    res.status(201).json({ message: 'Training created successfully', training });
    indexNowPing(indexNowTrainingUrl(training));
  } catch (error) {
    console.error('Create training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Konum seçicinin "önceki konumlar" önerileri. Aynı takım aynı yerleri tekrar yazıyor
// (Kuscular Racing Team 3 kez "Kuscular"); bir kez haritadan seçilen yer sonra tek
// dokunuşla gelsin. OTOMATİK DOLDURMA DEĞİL — kullanıcı seçer (takım/konum her
// antrenmanda değişebilir kararı). Yakın koordinatlar (~100 m) tek öneride birleşir.
// team_id verilirse: takımda etkinlik açma yetkisi olanlar; verilmezse kişinin kendi etkinlikleri.
app.get('/api/trainings/recent-locations', authenticateToken, async (req, res) => {
  try {
    const teamId = req.query.team_id ? parseInt(req.query.team_id, 10) : null;
    let scope, params;
    if (teamId) {
      const m = await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, req.user.id]);
      if (!m.rows.length || !TRAINING_MANAGER_ROLES.includes(m.rows[0].role)) {
        return res.status(403).json({ error: 'Bu takımın konumlarına erişim yok.' });
      }
      scope = 'team_id = $1'; params = [teamId];
    } else {
      scope = 'created_by = $1 AND team_id IS NULL'; params = [req.user.id];
    }
    const r = await pool.query(`
      SELECT (array_agg(location_name ORDER BY created_at DESC))[1] AS name,
             (array_agg(location_lat  ORDER BY created_at DESC))[1] AS lat,
             (array_agg(location_lng  ORDER BY created_at DESC))[1] AS lng,
             COUNT(*)::int AS uses,
             MAX(created_at) AS last_used
        FROM trainings
       WHERE ${scope}
         AND location_lat IS NOT NULL AND location_lng IS NOT NULL
         AND COALESCE(trim(location_name), '') <> ''
       GROUP BY round(location_lat::numeric, 3), round(location_lng::numeric, 3)
       ORDER BY MAX(created_at) DESC
       LIMIT 8`, params);
    res.json({ locations: r.rows.map((x) => ({ ...x, lat: Number(x.lat), lng: Number(x.lng) })) });
  } catch (error) {
    console.error('Recent locations error:', error.message);
    res.status(500).json({ error: 'Önceki konumlar alınamadı.' });
  }
});

app.get('/api/trainings', optionalAuth, async (req, res) => {
  try {
    const { team_id, date_from, date_to, is_public, sport } = req.query;

    let query = `
      SELECT t.*,
             teams.name as team_name,
             teams.sport as team_sport,
             teams.avatar as team_avatar,
             creator.name as creator_name,
             COUNT(DISTINCT ta.user_id) as attendee_count
      FROM trainings t
      LEFT JOIN teams ON t.team_id = teams.id
      LEFT JOIN users creator ON creator.id = t.created_by
      LEFT JOIN training_attendees ta ON ta.training_id = t.id
      LEFT JOIN team_members tm_auth ON tm_auth.team_id = teams.id AND tm_auth.user_id = $1
      WHERE (
        teams.is_private = false
        OR t.is_public = true
        OR ($1::int IS NOT NULL AND tm_auth.team_id IS NOT NULL)
        OR ($1::int IS NOT NULL AND t.created_by = $1)
      )
      AND ${trainingUtcExpr('t')} >= NOW()
    `;

    const params = [req.user?.id || null];
    let paramCount = 1;

    if (team_id) {
      paramCount++;
      query += ` AND t.team_id = $${paramCount}`;
      params.push(team_id);
    }

    if (date_from) {
      paramCount++;
      query += ` AND t.training_date >= $${paramCount}`;
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND t.training_date <= $${paramCount}`;
      params.push(date_to);
    }

    if (is_public !== undefined) {
      paramCount++;
      query += ` AND t.is_public = $${paramCount}`;
      params.push(is_public === 'true');
    }

    if (sport) {
      paramCount++;
      query += ` AND COALESCE(t.sport, teams.sport) = $${paramCount}`;
      params.push(sport);
    }

    query += ' GROUP BY t.id, teams.name, teams.sport, teams.avatar, creator.name ORDER BY t.training_date ASC, t.training_time ASC';

    const result = await pool.query(query, params);
    attachCreatorDisplay(result.rows);

    res.json({ trainings: result.rows });
  } catch (error) {
    console.error('Get trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Kullanıcının kayıt olduğu yaklaşan etkinlikler
app.get('/api/trainings/my-joined', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
             teams.name as team_name,
             teams.sport as team_sport,
             teams.avatar as team_avatar,
             creator.name as creator_name,
             COUNT(DISTINCT ta2.user_id) as attendee_count
      FROM trainings t
      LEFT JOIN teams ON t.team_id = teams.id
      LEFT JOIN users creator ON creator.id = t.created_by
      JOIN training_attendees ta ON t.id = ta.training_id AND ta.user_id = $1
      LEFT JOIN training_attendees ta2 ON t.id = ta2.training_id
      WHERE ${trainingUtcExpr('t')} >= NOW()
      GROUP BY t.id, teams.name, teams.sport, teams.avatar, creator.name
      ORDER BY t.training_date ASC, t.training_time ASC
    `, [req.user.id]);
    attachCreatorDisplay(result.rows);
    res.json({ trainings: result.rows });
  } catch (error) {
    console.error('my-joined trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Kullanıcının üye olduğu takımların yaklaşan etkinlikleri (katılmadıkları)
app.get('/api/trainings/my-team-trainings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
             teams.name as team_name,
             teams.sport as team_sport,
             teams.avatar as team_avatar,
             COUNT(DISTINCT ta.user_id) as attendee_count
      FROM trainings t
      JOIN teams ON t.team_id = teams.id
      LEFT JOIN training_attendees ta ON t.id = ta.training_id
      WHERE teams.id IN (
        SELECT team_id FROM team_members WHERE user_id = $1
      )
      AND NOT EXISTS (
        SELECT 1 FROM training_attendees WHERE training_id = t.id AND user_id = $1
      )
      AND ${trainingUtcExpr('t')} >= NOW()
      GROUP BY t.id, teams.name, teams.sport, teams.avatar
      ORDER BY t.training_date ASC, t.training_time ASC
    `, [req.user.id]);
    res.json({ trainings: result.rows });
  } catch (error) {
    console.error('my-team-trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/trainings/nearby', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat ve lng gerekli' });

    const userId = req.user?.id || null;

    // Parametre bazlı privacy filtresi — string interpolation yok
    const params = [parseFloat(lat), parseFloat(lng), parseFloat(radius)];
    let privacyFilter;
    if (userId) {
      params.push(userId);
      privacyFilter = `(teams.is_private = false OR t.is_public = true OR teams.id IN (SELECT team_id FROM team_members WHERE user_id = $${params.length}))`;
    } else {
      privacyFilter = `(teams.is_private = false OR t.is_public = true)`;
    }

    const result = await pool.query(
      `SELECT * FROM (
         SELECT t.*,
           teams.name  AS team_name,
           teams.sport AS team_sport,
           teams.avatar AS team_avatar,
           creator.name AS creator_name,
           COALESCE(
             (SELECT COUNT(*) FROM training_attendees ta WHERE ta.training_id = t.id),
             0
           ) AS attendee_count,
           (6371 * acos(LEAST(1.0,
             cos(radians($1)) * cos(radians(t.location_lat)) * cos(radians(t.location_lng) - radians($2))
             + sin(radians($1)) * sin(radians(t.location_lat))
           ))) AS distance
         FROM trainings t
         LEFT JOIN teams ON t.team_id = teams.id
         LEFT JOIN users creator ON creator.id = t.created_by
         WHERE t.location_lat IS NOT NULL
           AND t.location_lng IS NOT NULL
           AND ${trainingUtcExpr('t')} >= NOW()
           AND ${privacyFilter}
       ) sub
       WHERE distance <= $3
       ORDER BY distance ASC`,
      params
    );

    attachCreatorDisplay(result.rows);
    res.json({ trainings: result.rows });
  } catch (error) {
    console.error('Nearby trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Etkinlik görüntülenme sayısı ────────────────────────────────────────────
// "Kaç kişi baktı" — etkinliği yönetenlere (can_manage) ve platform adminine
// döner; organizasyon etkinliklerinde herkese (Melih, 1 Ekim 2026). Kişi başına bir kez sayılır (PRIMARY KEY), sayfanın 60 sn'lik
// tazelemesi sayıyı şişirmez. Yönetenler, oluşturan, admin ve botlar sayılmaz.
// Kişisel veri tutulmaz: girişliyse kullanıcı id, değilse tarayıcının rastgele
// kimliği (X-Muuv-Visitor), o da yoksa IP+tarayıcı özeti (ham IP saklanmaz).
pool.query(`CREATE TABLE IF NOT EXISTS training_views (
  training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  viewer      TEXT NOT NULL,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (training_id, viewer)
)`).catch((e) => console.error('[training_views] tablo:', e.message));

const VIEW_BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python|node-fetch/i;
// IP+tarayıcı özeti. Eylül 2026 öncesi görüntülenmeler nginx kayıtlarından bu
// anahtarla geriye doldurulduğu için biçimi DEĞİŞTİRİLMEZ (aynı cihaz iki kez sayılır).
const viewerHash = (ip, ua) => 'h:' + crypto.createHash('sha256').update(`${ip}|${ua || ''}`).digest('hex').slice(0, 24);
const trainingViewerKey = (req) => {
  if (req.user?.id) return `u:${req.user.id}`;
  const v = String(req.get('X-Muuv-Visitor') || '');
  if (/^[a-z0-9-]{16,64}$/i.test(v)) return `v:${v}`;
  return viewerHash(req.ip, req.get('user-agent'));
};

app.get('/api/trainings/:id', optionalAuth, async (req, res) => {
  try {
    const trainingId = req.params.id;

    const trainingResult = await pool.query(
      `SELECT t.*,
              (${trainingUtcExpr('t')} < NOW()) AS is_past,
              teams.name as team_name,
              teams.sport as team_sport,
              teams.avatar as team_avatar,
              teams.owner_id as team_owner_id,
              teams.is_private as team_is_private,
              creator.name as creator_name,
              COUNT(DISTINCT ta.user_id) as attendee_count
       FROM trainings t
       LEFT JOIN teams ON t.team_id = teams.id
       LEFT JOIN users creator ON creator.id = t.created_by
       LEFT JOIN training_attendees ta ON t.id = ta.training_id
       WHERE t.id = $1
       GROUP BY t.id, teams.name, teams.sport, teams.avatar, teams.owner_id, teams.is_private, creator.name`,
      [trainingId]
    );

    if (trainingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const training = trainingResult.rows[0];

    // Bireysel etkinlikte takım adı yerine maskeli oluşturan adı gösterilir.
    if (!training.team_id) training.creator_display = maskCreatorName(training.creator_name);
    delete training.creator_name;

    // Gizlilik kontrolü: bireysel etkinlik (takımsız) public'se herkes görebilir;
    // takım etkinliğinde takım herkese açıksa veya etkinlik public ise herkes görebilir.
    const isPubliclyVisible = !training.team_is_private || training.is_public;
    if (!isPubliclyVisible) {
      if (!req.user) {
        return res.status(401).json({ error: 'Bu etkinliği görmek için giriş yapmanız gerekiyor.', requiresAuth: true });
      }
      const memberCheck = await pool.query(
        'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
        [training.team_id, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Bu etkinlik gizli bir takıma ait. Erişim yetkiniz yok.' });
      }
    }

    // Etkinliği yönetip yönetemeyeceği: bireyselde OLUŞTURAN yönetir,
    // takım etkinliğinde ise takımdaki rolü belirler. Yetki kuralı tek yerde (backend).
    training.my_role = null;
    training.can_manage = false;
    if (req.user) {
      if (!training.team_id) {
        training.can_manage = training.created_by === req.user.id;
      } else {
        const roleResult = await pool.query(
          'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
          [training.team_id, req.user.id]
        );
        training.my_role = roleResult.rows[0]?.role || null;
        training.can_manage = TRAINING_MANAGER_ROLES.includes(training.my_role);
      }
    }

    // Kayıt sayfası tıklama sayısı yalnız etkinliği yönetenlere görünür.
    if (!training.can_manage) delete training.registration_clicks;

    const attendeesResult = await pool.query(
      `SELECT u.id, u.name, u.avatar, ta.status, ta.joined_at
       FROM training_attendees ta
       JOIN users u ON ta.user_id = u.id
       WHERE ta.training_id = $1
       ORDER BY ta.joined_at ASC`,
      [trainingId]
    );

    training.attendees = attendeesResult.rows;

    // Katılımcı isimleri/fotoğrafları takım sayfasıyla aynı kuralla: tam hali
    // yalnız etkinliğin takımının üyesine, bu etkinliğe katılana, oluşturana ve
    // platform adminine gider. Diğerleri "M........ Ö........" ve fotoğrafsız görür.
    let showAttendees = false;
    if (req.user) {
      const v = await pool.query(
        `SELECT (($2::int IS NOT NULL) AND EXISTS (SELECT 1 FROM team_members WHERE team_id = $2 AND user_id = $1)) AS member,
                EXISTS (SELECT 1 FROM training_attendees WHERE training_id = $3 AND user_id = $1) AS attendee,
                COALESCE((SELECT is_admin FROM users WHERE id = $1), false) AS admin`,
        [req.user.id, training.team_id, trainingId]
      );
      const r = v.rows[0];
      showAttendees = r.member || r.attendee || r.admin || training.created_by === req.user.id;
    }
    if (!showAttendees) {
      training.attendees = training.attendees.map((a) => ({ ...a, name: maskPersonName(a.name), avatar: null }));
    }
    training.names_masked = !showAttendees;

    // Görüntülenme: yönetmeyen gerçek ziyaretçiyi kaydet; sayıyı yalnız yönetene ver.
    const viewerIsAdmin = !!(req.user && (await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id])).rows[0]?.is_admin);
    const isManagerView = training.can_manage || viewerIsAdmin;
    // Organizasyon (admin'den girilen yarış/organizatör etkinliği) sayısı herkese açık.
    const seesViews = isManagerView || !!training.is_organizer_event || !!training.is_paid;
    if (!isManagerView && training.created_by !== req.user?.id && !VIEW_BOT_RE.test(req.get('user-agent') || '')) {
      // Aynı cihaz geçmiş kayıtlardan (h:) zaten sayıldıysa yeni anahtarla tekrar sayılmaz.
      pool.query(`INSERT INTO training_views (training_id, viewer) SELECT $1, $2
                   WHERE NOT EXISTS (SELECT 1 FROM training_views WHERE training_id = $1 AND viewer = $3)
                   ON CONFLICT DO NOTHING`,
        [training.id, trainingViewerKey(req), viewerHash(req.ip, req.get('user-agent'))])
        .catch((e) => console.error('[training_views] yazma:', e.message));
    }
    if (seesViews) {
      const vc = await pool.query('SELECT COUNT(*)::int AS n FROM training_views WHERE training_id = $1', [training.id]);
      training.view_count = vc.rows[0].n;
    }

    // Get comments (+ beğeni sayısı, kullanıcı beğenmiş mi, beğenenler)
    const commentsResult = await pool.query(
      `SELECT tc.*, u.name as user_name, u.avatar as user_avatar,
              (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = tc.id)::int as like_count,
              ($2::int IS NOT NULL AND EXISTS(
                 SELECT 1 FROM comment_likes cl WHERE cl.comment_id = tc.id AND cl.user_id = $2
              )) as liked_by_me,
              COALESCE((
                 SELECT json_agg(json_build_object('id', lu.id, 'name', lu.name) ORDER BY cl.created_at)
                 FROM comment_likes cl JOIN users lu ON lu.id = cl.user_id
                 WHERE cl.comment_id = tc.id
              ), '[]'::json) as likers
       FROM training_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.training_id = $1 AND tc.is_deleted IS NOT TRUE
       ORDER BY tc.created_at DESC`,
      [trainingId, req.user?.id ?? null]
    );

    const commentsVisible = await canSeeTrainingComments(trainingId, req.user?.id);
    training.comments = commentsVisible ? commentsResult.rows : [];
    training.comments_hidden = !commentsVisible;

    res.json({ training });
  } catch (error) {
    console.error('Get training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// "Kayıt Sayfası" tıklanınca: sayacı artır ve kayıt linkini döndür.
// Ücretli etkinliklerin yanı sıra, dış kayıt linki olan TAKIM etkinlikleri de
// buradan geçer. Auth gerekmez (giriş yapmamış kullanıcı da kaydolabilir).
app.post('/api/trainings/:id/register-click', async (req, res) => {
  try {
    if (await isTrainingPast(req.params.id)) {
      return res.status(409).json({ error: PAST_TRAINING_MSG, code: 'training_past' });
    }
    const r = await pool.query(
      `UPDATE trainings SET registration_clicks = COALESCE(registration_clicks,0) + 1
       WHERE id = $1 AND registration_url IS NOT NULL
       RETURNING registration_url`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Kayıt linki olan etkinlik bulunamadı.' });
    res.json({ registration_url: r.rows[0].registration_url || null });
  } catch (error) {
    console.error('Register-click error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/trainings/:id/join', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;

    const trainingResult = await pool.query('SELECT * FROM trainings WHERE id = $1', [trainingId]);

    if (trainingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const training = trainingResult.rows[0];

    if (await isTrainingPast(trainingId)) {
      return res.status(409).json({ error: PAST_TRAINING_MSG, code: 'training_past' });
    }

    // Gizlilik kontrolü: public değilse sadece takım üyesi katılabilir
    if (!training.is_public) {
      const memberCheck = await pool.query(
        'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
        [training.team_id, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Bu etkinlik gizli bir takıma ait. Sadece takım üyeleri katılabilir.' });
      }
    }

    const attendeeCount = await pool.query(
      'SELECT COUNT(*) FROM training_attendees WHERE training_id = $1',
      [trainingId]
    );

    if (parseInt(attendeeCount.rows[0].count) >= training.capacity) {
      return res.status(409).json({ error: 'Training is at full capacity' });
    }

    const attendeeCheck = await pool.query(
      'SELECT id FROM training_attendees WHERE training_id = $1 AND user_id = $2',
      [trainingId, req.user.id]
    );

    if (attendeeCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Already joined this training' });
    }

    await pool.query(
      'INSERT INTO training_attendees (training_id, user_id, status) VALUES ($1, $2, $3)',
      [trainingId, req.user.id, 'confirmed']
    );

    await updateUserStats(req.user.id);

    // Katılan kullanıcının adını al
    const joinerRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
    const joinerName = joinerRes.rows[0]?.name || req.user.email;

    // Takım etkinliğinde yöneticilere, bireysel etkinlikte oluşturana katılım bildirimi gider.
    if (training.team_id) {
    const teamRow = await pool.query('SELECT name FROM teams WHERE id = $1', [training.team_id]);
    const teamName = teamRow.rows[0]?.name || 'Takımınız';

    const leadersRes = await pool.query(
      `SELECT tm.user_id, u.email, u.name FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.role IN ('owner', 'coach', 'captain') AND tm.user_id != $2`,
      [training.team_id, req.user.id]
    );

    for (const leader of leadersRes.rows) {
      await createNotif(leader.user_id, {
        build: (L) => ({ title: tm(L, 'joinEvNotifTitle'), message: tm(L, 'joinEvNotifMsg', joinerName, training.title) }),
        type: 'training_join',
        refId: trainingId,
        url: `/etkinlikler?etkinlik=${trainingId}`,
      });

      sendEmail({
        to: leader.email,
        userId: leader.user_id,
        prefKey: 'event_join',
        build: (L) => ({ subject: tm(L, 'joinEvSubject', training.title, joinerName), html: emailWrapper(`
          <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${tm(L, 'joinEvTitle')}</h2>
          <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
            ${tm(L, 'joinEvBody', joinerName, teamName, training.title)}
          </p>
          <div style="text-align:center;">
            <a href="${APP_URL}/etkinlikler?etkinlik=${trainingId}"
               style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#ffffff;text-decoration:none;
                      padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
              ${tm(L, 'btnViewEventLong')}
            </a>
          </div>
        `, L) }),
      }).catch(e => console.error('Training join email error:', e.message));
    }
    } else if (training.created_by && training.created_by !== req.user.id) {
      // Bireysel etkinlik: oluşturana katılım bildirimi
      await createNotif(training.created_by, {
        build: (L) => ({ title: tm(L, 'joinEvNotifTitle'), message: tm(L, 'joinEvNotifMsg', joinerName, training.title) }),
        type: 'training_join',
        refId: trainingId,
        url: `/etkinlikler?etkinlik=${trainingId}`,
      });
    }

    logActivity('training_join', req.user.id, null, { training_title: training.title });
    // Asıl değer olayı. Haftada 50 katılım eşiği aşıldığında kampanyalar
    // CompleteRegistration yerine buna optimize edilecek.
    trackMeta('JoinTraining', {
      ...metaSignalsFrom(req), userId: req.user.id, email: req.user.email,
      customData: { content_ids: [String(trainingId)], sport: training.sport || undefined },
    });
    res.json({ message: 'Successfully joined the training' });
  } catch (error) {
    console.error('Join training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Etkinlik ayrıl
app.delete('/api/trainings/:id/leave', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;
    const trainingRow = await pool.query('SELECT title FROM trainings WHERE id = $1', [trainingId]);
    const trainingTitle = trainingRow.rows[0]?.title || '';
    // Geçmiş etkinlikten ayrılmak da yazma: katılım geçmişi ve rozet sayacı bozulur.
    if (await isTrainingPast(trainingId)) {
      return res.status(409).json({ error: PAST_TRAINING_MSG, code: 'training_past' });
    }
    const result = await pool.query(
      'DELETE FROM training_attendees WHERE training_id = $1 AND user_id = $2 RETURNING id',
      [trainingId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bu etkinliğe zaten kayıtlı değilsiniz.' });
    }
    await updateUserStats(req.user.id);
    logActivity('training_leave', req.user.id, null, { training_title: trainingTitle });
    res.json({ message: 'Etkinlik kaydınız silindi.' });
  } catch (error) {
    console.error('Leave training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/trainings/:id/comments', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Yorum boş olamaz.' });
    }

    if (!(await canSeeTrainingComments(trainingId, req.user.id))) {
      return res.status(403).json({ error: 'Yorumlar yalnız takım üyelerine ve katılımcılara açık.' });
    }

    if (await isTrainingPast(trainingId)) {
      return res.status(409).json({ error: PAST_TRAINING_MSG, code: 'training_past' });
    }

    // Yorumu kaydet
    const result = await pool.query(
      `INSERT INTO training_comments (training_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [trainingId, req.user.id, comment.trim()]
    );

    // Yorumu yapanın bilgilerini çek
    const commenterResult = await pool.query(
      'SELECT name, avatar FROM users WHERE id = $1',
      [req.user.id]
    );
    const commenter = commenterResult.rows[0];

    // Etkinlik + takım bilgilerini çek
    const trainingResult = await pool.query(
      `SELECT t.title, t.training_date, t.team_id, teams.name as team_name
       FROM trainings t
       LEFT JOIN teams ON t.team_id = teams.id
       WHERE t.id = $1`,
      [trainingId]
    );
    const training = trainingResult.rows[0];

    if (training && commenter) {
      const trainingDate = formatTrDate(training.training_date);

      // Katılımcılar + takım sahibi + sohbete daha önce katılmış yorumcular
      // (yorumu yazan hariç, tekrarsız)
      const recipientsResult = await pool.query(
        `SELECT DISTINCT u.id, u.name, u.email
         FROM users u
         WHERE u.id IN (
           -- Etkinliğe kayıtlı kişiler
           SELECT user_id FROM training_attendees WHERE training_id = $1
           UNION
           -- Takım sahibi / adminler
           SELECT user_id FROM team_members WHERE team_id = $2 AND role IN ('owner','admin')
           UNION
           -- Bu etkinliğe daha önce yorum yapmış kişiler (katılmasalar bile
           -- kendi başlattıkları sohbetin devamını görebilsinler)
           SELECT user_id FROM training_comments WHERE training_id = $1
         )
         AND u.id != $3`,
        [trainingId, training.team_id, req.user.id]
      );

      // Yalnız yorumları GÖREBİLEN alıcılar (canSeeTrainingComments — görme kuralıyla
      // aynı kaynak). Eskiden yorum yazıp etkinlikten ayrılan kişi, göremediği
      // yorumların metnini bildirim/e-postayla almaya devam ediyordu.
      const visible = await Promise.all(recipientsResult.rows.map((r) => canSeeTrainingComments(trainingId, r.id)));
      const recipients = recipientsResult.rows.filter((_, i) => visible[i]);

      // Bildirim + mail (paralel, hata durumunda ana akışı kesmez)
      recipients.forEach(async (recipient) => {
        try {
          await createNotif(recipient.id, {
            build: (L) => ({ title: tm(L, 'commentNotifTitle', training.title), message: `${commenter.name}: ${comment.trim().slice(0, 80)}${comment.length > 80 ? '...' : ''}` }),
            type: 'training_comment',
            refId: trainingId,
            url: `/etkinlikler?etkinlik=${trainingId}`,
          });

          sendEmail({
            to: recipient.email,
            userId: recipient.id,
            prefKey: 'comment',
            build: (L) => ({
              subject: tm(L, 'commentSubject', training.title),
              html: trainingCommentEmail({
                commenterName: commenter.name,
                commenterAvatar: commenter.avatar,
                trainingTitle: training.title,
                trainingDate: formatTrDate(training.training_date, L),
                comment: comment.trim(),
                trainingId,
              }, L),
            }),
          });
        } catch (notifErr) {
          console.error('Training comment notif error for', recipient.email, notifErr);
        }
      });
    }

    // Rozet kontrolü — "Sohbetçi" gibi mesaj bazlı rozetler
    checkAndAwardBadges(req.user.id).catch(e => console.error('Badge check (comment) error:', e.message));

    res.json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mesaj (yorum) beğenisini aç/kapat
app.post('/api/comments/:id/like', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user.id;

    const cRes = await pool.query(
      'SELECT id, user_id, training_id, comment FROM training_comments WHERE id = $1 AND is_deleted IS NOT TRUE',
      [commentId]
    );
    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    const commentRow = cRes.rows[0];

    if (!(await canSeeTrainingComments(commentRow.training_id, userId))) {
      return res.status(403).json({ error: 'Yorumlar yalnız takım üyelerine ve katılımcılara açık.' });
    }

    // Zaten beğenmiş mi?
    const existing = await pool.query(
      'SELECT id FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );

    let liked;
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
      liked = false;
    } else {
      await pool.query(
        'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [commentId, userId]
      );
      liked = true;
      // Beğeni bildirimi (kendi mesajını beğenmek hariç)
      if (commentRow.user_id !== userId) {
        const liker = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        createNotif(commentRow.user_id, {
          build: (L) => ({ title: tm(L, 'likeCommentTitle'), message: tm(L, 'likeCommentMsg', liker.rows[0]?.name || tm(L, 'someone'), commentRow.comment.slice(0, 60)) }),
          type: 'comment_like',
          refId: commentRow.training_id,
          url: `/etkinlikler?etkinlik=${commentRow.training_id}`,
        }).catch(e => console.error('Like notif error:', e.message));
      }
    }

    // Güncel sayı + beğenenler
    const agg = await pool.query(
      `SELECT COUNT(*)::int as count,
              COALESCE(json_agg(json_build_object('id', lu.id, 'name', lu.name) ORDER BY cl.created_at), '[]'::json) as likers
       FROM comment_likes cl JOIN users lu ON lu.id = cl.user_id
       WHERE cl.comment_id = $1`,
      [commentId]
    );

    res.json({ liked, count: agg.rows[0].count, likers: agg.rows[0].likers });
  } catch (error) {
    console.error('Comment like error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Etkinlik yorumunu sil (soft-delete). Yetki: yorumun sahibi VEYA (takım etkinliğinde)
// takım yönetimi; bireysel etkinlikte etkinliği oluşturan. Şikayet/geri alma sistemiyle
// uyumlu olsun diye is_deleted=true yapılır (kayıt silinmez).
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    const cRes = await pool.query(
      'SELECT id, user_id, training_id FROM training_comments WHERE id = $1 AND is_deleted IS NOT TRUE',
      [req.params.id]
    );
    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    const c = cRes.rows[0];

    let allowed = c.user_id === req.user.id;
    if (!allowed) {
      const tr = await pool.query('SELECT team_id, created_by FROM trainings WHERE id = $1', [c.training_id]);
      const training = tr.rows[0];
      if (training?.team_id) {
        const role = await pool.query(
          'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
          [training.team_id, req.user.id]
        );
        allowed = TRAINING_MANAGER_ROLES.includes(role.rows[0]?.role);
      } else if (training) {
        allowed = training.created_by === req.user.id;
      }
    }
    if (!allowed) return res.status(403).json({ error: 'Bu mesajı silme yetkiniz yok.' });

    await pool.query('UPDATE training_comments SET is_deleted = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Mesaj silindi.' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Takım duvarı gönderisini beğen / beğenmekten vazgeç (yorum beğenisinin aynısı)
app.post('/api/team-posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const pRes = await pool.query(
      'SELECT id, user_id, team_id, message FROM team_posts WHERE id = $1 AND is_deleted IS NOT TRUE',
      [postId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
    const postRow = pRes.rows[0];

    // Duvar yalnız üyelere açık; cevaptaki beğenen listesi tam isim taşıyor.
    const mem = await pool.query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2', [postRow.team_id, userId]);
    if (mem.rows.length === 0) return res.status(403).json({ error: 'Only team members can like posts' });

    const existing = await pool.query(
      'SELECT id FROM team_post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    let liked;
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM team_post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      liked = false;
    } else {
      await pool.query(
        'INSERT INTO team_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [postId, userId]
      );
      liked = true;
      // Beğeni bildirimi (kendi gönderisini beğenmek hariç) — mail yok
      if (postRow.user_id !== userId) {
        const liker = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        createNotif(postRow.user_id, {
          build: (L) => ({ title: tm(L, 'likePostTitle'), message: tm(L, 'likePostMsg', liker.rows[0]?.name || tm(L, 'someone'), (postRow.message || '').slice(0, 60)) }),
          type: 'wall_post_like',
          refId: postRow.team_id,
          url: `/takimlar?takim=${postRow.team_id}&tab=duvar`,
        }).catch(e => console.error('Wall like notif error:', e.message));
      }
    }

    const agg = await pool.query(
      `SELECT COUNT(*)::int as count,
              COALESCE(json_agg(json_build_object('id', lu.id, 'name', lu.name) ORDER BY pl.created_at), '[]'::json) as likers
       FROM team_post_likes pl JOIN users lu ON lu.id = pl.user_id
       WHERE pl.post_id = $1`,
      [postId]
    );

    res.json({ liked, count: agg.rows[0].count, likers: agg.rows[0].likers });
  } catch (error) {
    console.error('Team post like error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Takım duvarı gönderisini sil (soft-delete). Yetki: gönderinin sahibi VEYA takım yönetimi
// (sahip / antrenör / kaptan / editör).
app.delete('/api/team-posts/:id', authenticateToken, async (req, res) => {
  try {
    const pRes = await pool.query(
      'SELECT id, user_id, team_id FROM team_posts WHERE id = $1 AND is_deleted IS NOT TRUE',
      [req.params.id]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
    const post = pRes.rows[0];

    let allowed = post.user_id === req.user.id;
    if (!allowed && post.team_id) {
      const role = await pool.query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
        [post.team_id, req.user.id]
      );
      allowed = TRAINING_MANAGER_ROLES.includes(role.rows[0]?.role);
    }
    if (!allowed) return res.status(403).json({ error: 'Bu gönderiyi silme yetkiniz yok.' });

    await pool.query('UPDATE team_posts SET is_deleted = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Gönderi silindi.' });
  } catch (error) {
    console.error('Delete team post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/trainings/:id', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;
    const { title, description, training_date, training_time, location_name, location_lat, location_lng, capacity, difficulty, sport, registration_url, registration_label } = req.body;

    const trainingResult = await pool.query(
      'SELECT team_id, created_by FROM trainings WHERE id = $1',
      [trainingId]
    );

    if (trainingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    // Bireysel etkinlikte yalnızca oluşturan düzenler; takım etkinliğinde yetkili roller.
    const trg = trainingResult.rows[0];
    if (!trg.team_id) {
      if (trg.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Bu etkinliği yalnızca oluşturan kişi düzenleyebilir.' });
      }
    } else {
      const memberCheck = await pool.query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
        [trg.team_id, req.user.id]
      );
      if (memberCheck.rows.length === 0 || !TRAINING_MANAGER_ROLES.includes(memberCheck.rows[0].role)) {
        return res.status(403).json({ error: 'Etkinliği düzenlemek için takımın sahibi, antrenörü veya kaptanı olmanız gerekiyor.' });
      }
    }

    // Konum değişmiş olabilir → saat dilimini yeniden hesapla (trigger UTC'yi günceller)
    const trainingTimezone = resolveTrainingTimezone(location_lat, location_lng);

    // Kayıt linki yalnız takım etkinliğinde tutulur. Alan formdan HİÇ
    // gelmediyse (eski istemci) mevcut değere dokunulmaz; boş geldiyse silinir.
    const regTouched = Object.prototype.hasOwnProperty.call(req.body, 'registration_url');
    const regUrl = sanitizeRegistrationUrl(registration_url, trg.team_id);
    if (regTouched && trg.team_id && registration_url && !regUrl) {
      return res.status(400).json({ error: 'Kayıt adresi geçersiz. http:// veya https:// ile başlamalı.' });
    }
    // Yazı linke bağlı: link silinirse yazı da silinir (aynı CASE ile yazılır).
    const regLabel = sanitizeRegistrationLabel(registration_label, trg.team_id, regUrl);

    const result = await pool.query(
      `UPDATE trainings
       SET title = $1, description = $2, training_date = $3, training_time = $4,
           location_name = $5, location_lat = $6, location_lng = $7,
           capacity = $8, difficulty = $9, training_timezone = $10,
           sport = COALESCE($12, sport),
           registration_url = CASE WHEN $13 THEN $14 ELSE registration_url END,
           registration_label = CASE WHEN $13 THEN $15 ELSE registration_label END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [title, description, training_date, training_time, location_name, location_lat || null, location_lng || null, capacity, difficulty, trainingTimezone, trainingId, sport || null, regTouched, regUrl, regLabel]
    );

    const updated = result.rows[0];
    indexNowPing(indexNowTrainingUrl(updated));

    // Güncelleyenin adını çek
    const updaterResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const updaterName = updaterResult.rows[0]?.name;

    // Takım adını çek
    const teamNameResult = await pool.query('SELECT name FROM teams WHERE id = $1', [trainingResult.rows[0].team_id]);
    const teamName = teamNameResult.rows[0]?.name;

    // Katılımcılar (güncelleyen hariç)
    const attendeesResult = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM training_attendees ta
       JOIN users u ON u.id = ta.user_id
       WHERE ta.training_id = $1 AND ta.user_id != $2`,
      [trainingId, req.user.id]
    );

    const trainingDate = formatTrDate(training_date);

    attendeesResult.rows.forEach(async (attendee) => {
      try {
        await createNotif(attendee.id, {
          build: (L) => ({ title: tm(L, 'updateNotifTitle', updated.title), message: tm(L, 'updateNotifMsg', updaterName || tm(L, 'updaterFallback')) }),
          type: 'training_update',
          refId: trainingId,
          url: `/etkinlikler?etkinlik=${trainingId}`,
        });
        sendEmail({
          to: attendee.email,
          userId: attendee.id,
          prefKey: 'event_update',
          build: (L) => ({
            subject: tm(L, 'updateSubject', updated.title),
            html: trainingUpdateEmail({
              teamName: teamName || '',
              trainingTitle: updated.title,
              trainingDate: formatTrDate(training_date, L),
              trainingTime: training_time,
              location: location_name,
              description,
              updaterName,
              trainingId,
            }, L),
          }),
        });
      } catch (notifErr) {
        console.error('Training update notif error for', attendee.email, notifErr);
      }
    });

    res.json({ training: updated });
  } catch (error) {
    console.error('Update training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/trainings/:id', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;

    const trainingResult = await pool.query(
      `SELECT t.team_id, t.created_by, t.title, t.is_public, t.training_date,
              teams.name AS team_name
         FROM trainings t LEFT JOIN teams ON teams.id = t.team_id
        WHERE t.id = $1`,
      [trainingId]
    );

    if (trainingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    // Bireysel etkinlikte yalnızca oluşturan siler; takım etkinliğinde yetkili roller.
    const trg = trainingResult.rows[0];
    if (!trg.team_id) {
      if (trg.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Bu etkinliği yalnızca oluşturan kişi silebilir.' });
      }
    } else {
      const memberCheck = await pool.query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
        [trg.team_id, req.user.id]
      );
      if (memberCheck.rows.length === 0 || !TRAINING_MANAGER_ROLES.includes(memberCheck.rows[0].role)) {
        return res.status(403).json({ error: 'Etkinliği silmek için takımın sahibi, antrenörü veya kaptanı olmanız gerekiyor.' });
      }
    }

    await pool.query('DELETE FROM trainings WHERE id = $1', [trainingId]);
    logDeletion('training', { id: trainingId, name: trg.title, meta: { team_name: trg.team_name, training_date: trg.training_date } }, req.user.id, 'self');

    res.json({ message: 'Training deleted' });
    indexNowPing(indexNowTrainingUrl({ ...trg, id: trainingId }));
  } catch (error) {
    console.error('Delete training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// USER STATS & BADGES
// =====================================================

app.get('/api/users/:id/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    const statsResult = await pool.query(
      'SELECT * FROM user_stats WHERE user_id = $1',
      [userId]
    );

    const badgesResult = await pool.query(
      `SELECT b.*, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [userId]
    );

    const stats = statsResult.rows[0] || {
      total_trainings: 0,
      total_distance: 0,
      total_duration: 0,
    };

    stats.badges = badgesResult.rows;

    res.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/badges', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM badges ORDER BY requirement_value ASC');
    res.json({ badges: result.rows });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/:id/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // İstanbul timezone'unda bugünün tarih string'ini üret (YYYY-MM-DD)
    // Node.js UTC'de çalışıyor, DB session 'Europe/Istanbul' — ikisini senkronize etmek için
    // her iki tarafta da İstanbul tarihini explicit olarak kullanıyoruz.
    const istFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' });
    const todayIST = istFmt.format(new Date()); // 'YYYY-MM-DD'

    // İstanbul tarihine gün ekle/çıkar (UTC öğlen saatinden yapılır — DST güvenli)
    const addDays = (dateStr, days) => {
      const d = new Date(dateStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().split('T')[0];
    };

    const sixDaysAgo = addDays(todayIST, -6);

    // Son 7 günün tamamlanmış etkinlikleri
    // Tarih parametreleri Node'dan geliyor → DB ve JS tarihleri her zaman uyumlu
    const result = await pool.query(
      `SELECT
         t.training_date::date as date,
         COUNT(DISTINCT ta.training_id) as count,
         json_agg(json_build_object('title', t.title) ORDER BY t.training_time) as trainings
       FROM training_attendees ta
       JOIN trainings t ON ta.training_id = t.id
       WHERE ta.user_id = $1
         AND t.training_date::date >= $2::date
         AND t.training_date::date <= $3::date
         AND (
           t.training_date::date < $3::date
           OR (t.training_date::date = $3::date AND ${trainingUtcExpr('t')} <= NOW())
         )
       GROUP BY t.training_date::date
       ORDER BY date ASC`,
      [userId, sixDaysAgo, todayIST]
    );

    // DB'den dönen date: PostgreSQL DATE → JS Date objesi (UTC gece yarısı)
    // Güvenli karşılaştırma için .toISOString() yerine direkt format
    const rowDateStr = (row) => {
      const d = row.date;
      if (typeof d === 'string') return d.slice(0, 10);
      // Date object → YYYY-MM-DD UTC (DATE kolonu UTC gece yarısında gelir)
      return d.toISOString().split('T')[0];
    };

    // Streak hesabı — 30 gün geriye git (İstanbul tarihleri ile)
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const ds = addDays(todayIST, -i);
      const found = result.rows.find(r => rowDateStr(r) === ds);
      if (found && parseInt(found.count) > 0) { streak++; } else if (i > 0) { break; }
    }

    // Son 7 günü doldur (boş günler için 0)
    const DAY_NAMES = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = addDays(todayIST, -i);
      const dayData = result.rows.find(r => rowDateStr(r) === dateStr);
      // Hücre gün adı: UTC öğlen saatinden hesaplanır → DST güvenli
      const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay();
      last7Days.push({
        date: dateStr,
        day: DAY_NAMES[dayOfWeek],
        count: dayData ? parseInt(dayData.count) : 0,
        trainings: dayData ? dayData.trainings : [],
        isToday: i === 0,
      });
    }

    const weekTotal = last7Days.reduce((s, d) => s + d.count, 0);
    res.json({ activity: last7Days, streak, weekTotal });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// =====================================================
// NOTIFICATIONS
// =====================================================

// SSE stream — token query param üzerinden auth (EventSource header desteklemez)
app.get('/api/notifications/stream', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  let userId;
  try {
    userId = require('jsonwebtoken').verify(token, JWT_SECRET).id;
  } catch {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
  res.write(`data: ${JSON.stringify({ event: 'connected' })}\n\n`);

  const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 25000);
  req.on('close', () => {
    clearInterval(hb);
    sseClients.get(userId)?.delete(res);
  });
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    sendBadgeUpdate(req.user.id).catch(() => {});   // uygulama ikonu rozetini güncelle

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Hepsini okundu işaretle
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    sendBadgeUpdate(req.user.id).catch(() => {});   // uygulama ikonu rozetini güncelle

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Hepsini sil
app.delete('/api/notifications', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [req.user.id]
    );

    sendBadgeUpdate(req.user.id).catch(() => {});   // rozet sıfırlansın

    res.json({ message: 'All notifications deleted' });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    sendBadgeUpdate(req.user.id).catch(() => {});   // silinen bildirim okunmamışsa rozet azalsın

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// SEARCH
// =====================================================

app.get('/api/search', authenticateToken, async (req, res) => {
  try {
    const { q, type } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results = {};

    if (!type || type === 'trainings') {
      const trainingsResult = await pool.query(
        `SELECT t.*, teams.name as team_name, teams.sport as team_sport, creator.name as creator_name
         FROM trainings t
         LEFT JOIN teams ON t.team_id = teams.id
         LEFT JOIN users creator ON creator.id = t.created_by
         WHERE (t.title ILIKE $1 OR t.description ILIKE $1 OR COALESCE(t.sport, teams.sport) ILIKE $1)
           AND (t.is_public = true OR teams.id IN (
             SELECT team_id FROM team_members WHERE user_id = $2
           ) OR t.created_by = $2)
         LIMIT 10`,
        [`%${q}%`, req.user.id]
      );
      results.trainings = attachCreatorDisplay(trainingsResult.rows);
    }

    if (!type || type === 'teams') {
      const teamsResult = await pool.query(
        `SELECT t.*
         FROM teams t
         WHERE (t.name ILIKE $1 OR t.description ILIKE $1 OR t.sport ILIKE $1)
           AND (t.is_private = false OR t.id IN (
             SELECT team_id FROM team_members WHERE user_id = $2
           ))
         LIMIT 10`,
        [`%${q}%`, req.user.id]
      );
      results.teams = teamsResult.rows;
    }

    if (!type || type === 'users') {
      const usersResult = await pool.query(
        `SELECT id, name, email, avatar
         FROM users
         WHERE name ILIKE $1 OR email ILIKE $1
         LIMIT 10`,
        [`%${q}%`]
      );
      results.users = usersResult.rows;
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// ADMIN ROUTES
// =====================================================

// ─── ADMIN STATS ─────────────────────────────────────
app.get('/api/admin/stats', isAdmin, async (req, res) => {
  try {
    const [userCount, trainingCount, teamCount, completedTrainings, contactCount, recentUsers] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM trainings'),
      pool.query('SELECT COUNT(*) FROM teams'),
      pool.query(`SELECT COUNT(*) FROM trainings WHERE ${trainingUtcExpr('')} < NOW()`),
      pool.query("SELECT COUNT(*) FROM contact_messages WHERE is_read = false"),
      pool.query("SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5"),
    ]);

    res.json({
      users: parseInt(userCount.rows[0].count),
      trainings: parseInt(trainingCount.rows[0].count),
      teams: parseInt(teamCount.rows[0].count),
      completedTrainings: parseInt(completedTrainings.rows[0].count),
      unreadContact: parseInt(contactCount.rows[0].count),
      recentUsers: recentUsers.rows,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── ADMIN USERS ─────────────────────────────────────
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.avatar, u.is_admin, u.created_at,
        -- deleted_at doluysa kullanıcı hesabını silmiş (30 gün geri gelebilir, sonra purge siler)
        u.deleted_at, u.leave_reason, u.leave_note,
        COUNT(DISTINCT tm.team_id) as team_count,
        COUNT(DISTINCT ta.training_id) as training_count,
        -- Sayının üzerine gelince gösterilen takım adları (alt sorgu: JOIN'ler satırı çoğaltmasın)
        (SELECT COALESCE(json_agg(t2.name ORDER BY t2.name), '[]'::json)
           FROM team_members tm2 JOIN teams t2 ON t2.id = tm2.team_id
          WHERE tm2.user_id = u.id) as team_names
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id
      LEFT JOIN training_attendees ta ON u.id = ta.user_id
      GROUP BY u.id, u.name, u.email, u.avatar, u.is_admin, u.created_at, u.deleted_at, u.leave_reason, u.leave_note
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: silinen takım/etkinlik kayıtları. Geri getirme yok; yalnız "silindi" kaydı.
// Kayıt tutulmadan önce silinenlerin adı/tarihi hiçbir yerde olmadığı için yalnızca
// numara boşluklarından SAYI olarak bildirilir — uydurma satır üretilmez.
app.get('/api/admin/deletions', isAdmin, async (req, res) => {
  try {
    const items = await pool.query(`
      SELECT id, event_type, user_id, user_name, meta, created_at
        FROM activity_logs
       WHERE event_type IN ('team_delete', 'training_delete')
       ORDER BY created_at DESC
       LIMIT 300`);
    const bilinen = new Set(items.rows.map((r) => `${r.event_type}:${r.meta?.id}`));
    const gap = async (table, prefix) => {
      const r = await pool.query(`SELECT COALESCE(MAX(id), 0) AS mx FROM ${table}`);
      const varOlan = new Set((await pool.query(`SELECT id FROM ${table}`)).rows.map((x) => x.id));
      let n = 0;
      for (let i = 1; i <= r.rows[0].mx; i++) if (!varOlan.has(i) && !bilinen.has(`${prefix}:${i}`)) n++;
      return n;
    };
    res.json({
      items: items.rows,
      kayitsiz: { teams: await gap('teams', 'team_delete'), trainings: await gap('trainings', 'training_delete') },
    });
  } catch (error) {
    console.error('Deletions error:', error.message);
    res.status(500).json({ error: 'Silinenler alınamadı.' });
  }
});

// Admin › E-postalar: seçilen günün (İstanbul) gönderimleri. Tür/sonuç email_log'dan,
// teslim durumu Resend'den (last_event). Resend listesi sayfa sayfa geriye okunur;
// 60 sn önbellek (panel 30 sn'de bir tazeliyor, Resend'i yormasın).
const resendDayCache = new Map();
async function resendEmailsForDay(fromIso, toIso) {
  const key = `${fromIso}|${toIso}`;
  const hit = resendDayCache.get(key);
  if (hit && Date.now() - hit.at < 60000) return hit.items;
  const items = [];
  let after = null;
  for (let page = 0; page < 20 && process.env.RESEND_API_KEY; page++) {
    const url = `https://api.resend.com/emails?limit=100${after ? `&after=${after}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
    if (!r.ok) break;
    const j = await r.json();
    const data = j.data || [];
    if (!data.length) break;
    let older = false;
    for (const e of data) {
      // "2026-10-05 15:11:12.736000+00" → ISO ("+00" JS'te geçersiz)
      const d = new Date(String(e.created_at).replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
      if (isNaN(d)) continue;
      const t = d.toISOString();
      if (t < fromIso) { older = true; continue; }
      // Resend hesabı Training Agents ile ORTAK: yalnız Muuvlink'ten gidenler.
      if (!/@muuvlink\.app>?$/i.test(String(e.from || '').trim())) continue;
      if (t < toIso) items.push({ id: e.id, subject: e.subject || '', last_event: e.last_event || 'sent', created_at: t });
    }
    const last = data[data.length - 1].id;
    if (older || !j.has_more || last === after) break;
    after = last;
  }
  resendDayCache.set(key, { at: Date.now(), items });
  if (resendDayCache.size > 20) resendDayCache.delete(resendDayCache.keys().next().value);
  return items;
}
// Konudan tür: email_log'u olmayan (5 Ekim 2026 öncesi) gönderimler için. Türkçe
// kalıplar MAIL.tr / ACT.tr / WELCOME.tr konularından; başka dilde konu "other".
const SUBJECT_KIND = [
  [/^\[Örnek|resend\.dev/i, 'sample'],
  [/^Muuvlink'e hoş geldin/i, 'act_wu'],
  [/^Takımın hazır: /, 'act_tc'],
  [/^Etkinliğin yayında: /, 'act_ec'],
  [/ yarın — hâlâ boş yer var$/, 'act_lc'],
  [/ ilk buluşmasını bekliyor$/, 'act_te'],
  [/ daha da kalabalık olabilir$| daha çok kişiye ulaşabilir$/, 'grow'],
  [/ — Yeni Etkinlik: /, 'event_new'],
  [/ — (Yarın|3 Gün Sonra): /, 'event_reminder'],
  [/ — Yeni Üye: /, 'team_member'],
  [/ — Yeni Katılımcı: /, 'event_join'],
  [/ etkinliğine yorum yapıldı$/, 'comment'],
  [/ etkinliğinde değişiklik var$/, 'event_update'],
  [/ takımında yeni gönderi var$/, 'wall_post'],
  [/ takımındaki rolün güncellendi$/, 'role'],
  [/ takımına davet etti!$/, 'invite'],
  [/^Muuvlink — Şifre Sıfırlama$/, 'password_reset'],
  [/^Mesajınız alındı — Muuvlink$/, 'contact_reply'],
  [/^(📬 )?Yeni İletişim Mesajı: /, 'contact_admin'],
];
const kindOfSubject = (subj) => (SUBJECT_KIND.find(([re]) => re.test(subj)) || [null, 'other'])[1];
const RESEND_DELIVERED = new Set(['delivered', 'opened', 'clicked']);
const RESEND_PROBLEM = new Set(['bounced', 'complained', 'failed', 'suppressed']);

app.get('/api/admin/emails', isAdmin, async (req, res) => {
  try {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date
      : (await pool.query(`SELECT to_char(NOW() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS d`)).rows[0].d;
    const range = (await pool.query(
      `SELECT ($1::date::timestamp AT TIME ZONE 'Europe/Istanbul') AS f,
              (($1::date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul') AS t`, [day])).rows[0];
    const fromIso = new Date(range.f).toISOString(), toIso = new Date(range.t).toISOString();

    const [log, items, daily, since] = await Promise.all([
      pool.query(`SELECT kind, status, resend_id FROM email_log WHERE sent_at >= $1 AND sent_at < $2`, [fromIso, toIso]),
      resendEmailsForDay(fromIso, toIso).catch((e) => { console.error('[EMAILS] Resend:', e.message); return null; }),
      pool.query(`SELECT to_char(sent_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS d,
                         COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
                         COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped
                    FROM email_log WHERE sent_at > NOW() - INTERVAL '14 days' GROUP BY 1 ORDER BY 1`),
      pool.query(`SELECT MIN(sent_at) AS m FROM email_log`),
    ]);
    // Tür: önce email_log (resend_id eşleşmesi), yoksa konudan. Gönderilen/teslim
    // Resend'den; atlanan (tercih kapalı) ve hata yalnız email_log'da.
    const logKind = new Map(log.rows.filter((r) => r.resend_id).map((r) => [r.resend_id, r.kind]));
    const byKind = new Map();
    const bucket = (k) => {
      if (!byKind.has(k)) byKind.set(k, { kind: k, sent: 0, delivered: 0, problem: 0, skipped: 0, failed: 0, subjects: new Map() });
      return byKind.get(k);
    };
    const totals = { sent: 0, delivered: 0, bounced: 0, complained: 0, pending: 0, skipped: 0, failed: 0 };
    for (const e of items || []) {
      const b = bucket(logKind.get(e.id) || kindOfSubject(e.subject));
      b.sent++; totals.sent++;
      if (RESEND_DELIVERED.has(e.last_event)) { b.delivered++; totals.delivered++; }
      else if (RESEND_PROBLEM.has(e.last_event)) {
        b.problem++;
        if (e.last_event === 'complained') totals.complained++; else totals.bounced++;
      } else totals.pending++;
      b.subjects.set(e.subject, (b.subjects.get(e.subject) || 0) + 1);
    }
    for (const r of log.rows) {
      if (r.status === 'skipped') { bucket(r.kind).skipped++; totals.skipped++; }
      else if (r.status === 'failed') { bucket(r.kind).failed++; totals.failed++; }
    }
    res.json({
      date: day,
      resendOk: items !== null,
      totals,
      byKind: [...byKind.values()]
        .map((k) => ({ ...k, subjects: [...k.subjects].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([subject, n]) => ({ subject, n })) }))
        .sort((a, b) => b.sent + b.skipped - (a.sent + a.skipped)),
      daily: daily.rows,
      logSince: since.rows[0].m,
    });
  } catch (error) {
    console.error('Admin emails error:', error.message);
    res.status(500).json({ error: 'E-posta istatistiği alınamadı' });
  }
});

// Admin › Bildirimler › Uygulama: seçilen günün (İstanbul) bildirimleri. Oluşturulan
// ve okunan notifications'tan (Mayıs 2026'dan beri), atlanan ve push notif_log'dan
// (6 Ekim 2026'dan beri). Kullanıcının sildiği bildirim sayıya girmez.
app.get('/api/admin/notifications', isAdmin, async (req, res) => {
  try {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date
      : (await pool.query(`SELECT to_char(NOW() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS d`)).rows[0].d;
    const R = `$1::date::timestamp AT TIME ZONE 'Europe/Istanbul'`, R2 = `($1::date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul'`;
    const [made, log, since] = await Promise.all([
      pool.query(`SELECT notification_type AS kind, COUNT(*)::int AS created, COUNT(*) FILTER (WHERE is_read)::int AS read,
                         COUNT(DISTINCT user_id)::int AS users
                    FROM notifications WHERE created_at >= ${R} AND created_at < ${R2} GROUP BY 1`, [day]),
      pool.query(`SELECT kind, COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
                         COALESCE(SUM(push_ok), 0)::int AS push_ok, COALESCE(SUM(push_fail), 0)::int AS push_fail,
                         COUNT(*) FILTER (WHERE status = 'created' AND push_ok > 0)::int AS pushed
                    FROM notif_log WHERE sent_at >= ${R} AND sent_at < ${R2} GROUP BY 1`, [day]),
      pool.query(`SELECT MIN(sent_at) AS m FROM notif_log`),
    ]);
    const by = new Map();
    const row = (k) => { if (!by.has(k)) by.set(k, { kind: k, created: 0, read: 0, users: 0, skipped: 0, push_ok: 0, push_fail: 0, pushed: 0 }); return by.get(k); };
    for (const r of made.rows) Object.assign(row(r.kind || 'other'), { created: r.created, read: r.read, users: r.users });
    for (const r of log.rows) Object.assign(row(r.kind || 'other'), { skipped: r.skipped, push_ok: r.push_ok, push_fail: r.push_fail, pushed: r.pushed });
    const list = [...by.values()].sort((a, b) => b.created + b.skipped - (a.created + a.skipped));
    const sum = (f) => list.reduce((n, x) => n + x[f], 0);
    res.json({
      date: day,
      totals: { created: sum('created'), read: sum('read'), skipped: sum('skipped'), push_ok: sum('push_ok'), push_fail: sum('push_fail'), pushed: sum('pushed') },
      byKind: list,
      logSince: since.rows[0].m,
    });
  } catch (error) {
    console.error('Admin notifications error:', error.message);
    res.status(500).json({ error: 'Bildirim istatistiği alınamadı' });
  }
});

// Admin: ayrılış istatistiği (kişisel veri yok). Geri gelenler ayrılış sayılmaz.
app.get('/api/admin/departures', isAdmin, async (req, res) => {
  try {
    const ozet = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE restored_at IS NULL)::int AS toplam,
        COUNT(*) FILTER (WHERE restored_at IS NULL AND left_at > NOW() - INTERVAL '30 days')::int AS son30,
        COUNT(*) FILTER (WHERE restored_at IS NULL AND source = 'self')::int AS kendisi,
        COUNT(*) FILTER (WHERE restored_at IS NULL AND source = 'admin')::int AS admin,
        COUNT(*) FILTER (WHERE restored_at IS NOT NULL)::int AS geri_donen,
        COUNT(*) FILTER (WHERE restored_at IS NULL AND left_at - signed_up_at < INTERVAL '1 day')::int AS ayni_gun,
        ROUND(AVG(EXTRACT(EPOCH FROM (left_at - signed_up_at)) / 86400)
          FILTER (WHERE restored_at IS NULL AND signed_up_at IS NOT NULL))::int AS ort_gun,
        MIN(left_at) AS ilk_kayit
      FROM account_departures`);
    const aylik = await pool.query(`
      SELECT to_char(date_trunc('month', left_at AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM') AS ay, COUNT(*)::int AS n
      FROM account_departures WHERE restored_at IS NULL
      GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
    const nedenler = await pool.query(`
      SELECT reason, COUNT(*)::int AS n FROM account_departures
       WHERE restored_at IS NULL AND reason IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`);
    res.json({ ...ozet.rows[0], aylik: aylik.rows, nedenler: nedenler.rows });
  } catch (error) {
    res.status(500).json({ error: 'Ayrılış istatistiği alınamadı' });
  }
});

// Kullanıcının kendi hesabını silmesi — App Store Guideline 5.1.1(v) için zorunlu
app.delete('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const soleAdminCheck = await pool.query(
      `SELECT t.id, t.name FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1 AND tm.role IN ('owner','coach')
         AND NOT EXISTS (
           SELECT 1 FROM team_members tm2
           WHERE tm2.team_id = t.id AND tm2.user_id != $1 AND tm2.role IN ('owner','coach')
         )`,
      [req.user.id]
    );
    if (soleAdminCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'SOLE_ADMIN_TEAMS',
        teams: soleAdminCheck.rows,
      });
    }
    // Soft-delete: kalıcı silmek yerine "silinmeye zamanlanmış" işaretle.
    // 30 gün içinde giriş yapılırsa geri gelir; sonra purge kalıcı siler.
    const reason = LEAVE_REASONS.includes(req.body?.reason) ? req.body.reason : null;
    const note = reason === 'other' ? (String(req.body?.note || '').trim().slice(0, 200) || null) : null;
    await pool.query('UPDATE users SET deleted_at = NOW(), leave_reason = $2, leave_note = $3 WHERE id = $1',
      [req.user.id, reason, note]);
    pool.query(
      `INSERT INTO account_departures (user_id, source, signed_up_at, left_at, reason)
       SELECT id, 'self', created_at, NOW(), $2 FROM users WHERE id = $1`, [req.user.id, reason]
    ).catch((e) => console.error('[DEPARTURES] Kayıt hatası:', e.message));
    res.json({ message: 'Hesabınız silinmek üzere kapatıldı.' });
  } catch (error) {
    console.error('Self-delete error:', error.message);
    res.status(500).json({ error: 'Hesap silinemedi.' });
  }
});

// Bildirim tercihlerini oku
app.get('/api/users/me/notif-prefs', authenticateToken, async (req, res) => {
  try {
    const prefs = await getNotifPrefs(req.user.id);
    res.json({ prefs });
  } catch (error) {
    console.error('Get notif-prefs error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bildirim tercihlerini kaydet — { prefs: { key: { app, email } } }
// Arayüz dili: kullanıcı dili elle değiştirince yazılır. E-posta ve bildirimler
// bu dilde üretilir; başka cihazdan girişte de bu dil açılır.
app.put('/api/users/me/lang', authenticateToken, async (req, res) => {
  const lang = req.body?.lang;
  if (!MAIL_LANGS.includes(lang)) return res.status(400).json({ error: 'Unsupported language' });
  try {
    await pool.query('UPDATE users SET lang = $1 WHERE id = $2', [lang, req.user.id]);
    res.json({ lang });
  } catch (e) {
    console.error('Save lang error:', e.message);
    res.status(500).json({ error: 'Could not save language' });
  }
});

app.put('/api/users/me/notif-prefs', authenticateToken, async (req, res) => {
  try {
    const incoming = req.body?.prefs;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ error: 'Geçersiz tercih verisi.' });
    }
    // Sadece bilinen anahtarları ve boolean değerleri kabul et (sanitize).
    const allowedKeys = new Set([...Object.values(NOTIF_TYPE_TO_KEY), 'tips']); // tips: yalnız e-posta
    const clean = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (!allowedKeys.has(k) || !v || typeof v !== 'object') continue;
      const entry = {};
      if (typeof v.app === 'boolean') entry.app = v.app;
      if (typeof v.email === 'boolean') entry.email = v.email;
      if (Object.keys(entry).length) clean[k] = entry;
    }
    await pool.query('UPDATE users SET notif_prefs = $1 WHERE id = $2', [JSON.stringify(clean), req.user.id]);
    res.json({ prefs: clean });
  } catch (error) {
    console.error('Save notif-prefs error:', error.message);
    res.status(500).json({ error: 'Tercihler kaydedilemedi.' });
  }
});

app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
    const soleAdminCheck = await pool.query(
      `SELECT t.id, t.name FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1 AND tm.role IN ('owner','coach')
         AND NOT EXISTS (
           SELECT 1 FROM team_members tm2
           WHERE tm2.team_id = t.id AND tm2.user_id != $1 AND tm2.role IN ('owner','coach')
         )`,
      [id]
    );
    if (soleAdminCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'SOLE_ADMIN_TEAMS',
        teams: soleAdminCheck.rows,
      });
    }
    const removed = await pool.query('DELETE FROM users WHERE id = $1 RETURNING created_at, deleted_at', [id]);
    const row = removed.rows[0];
    if (row) {
      // Zaten ayrılmış biriyse onun kaydını kapat; değilse admin silmesi olarak yeni kayıt aç.
      const kapandi = await pool.query(
        `UPDATE account_departures SET purged_at = NOW(), user_id = NULL
         WHERE user_id = $1 AND purged_at IS NULL AND restored_at IS NULL`, [id]
      ).catch(() => ({ rowCount: 0 }));
      if (!kapandi.rowCount) {
        pool.query(
          `INSERT INTO account_departures (source, signed_up_at, left_at, purged_at)
           VALUES ('admin', $1, NOW(), NOW())`, [row.created_at]
        ).catch((err) => console.error('[DEPARTURES] Admin silme kaydı hatası:', err.message));
      }
    }
    res.json({ message: 'Kullanıcı silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.put('/api/admin/users/:id/toggle-admin', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const cur = await pool.query('SELECT is_admin FROM users WHERE id = $1', [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    // Son admini yetkisiz bırakma — kilitlenmeyi önle.
    if (cur.rows[0].is_admin) {
      const c = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE is_admin = true');
      if (c.rows[0].n <= 1) {
        return res.status(400).json({ error: 'Son admin yetkisi kaldırılamaz. Önce başka bir admin atayın.' });
      }
    }

    const result = await pool.query(
      'UPDATE users SET is_admin = NOT is_admin WHERE id = $1 RETURNING id, name, is_admin',
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle admin' });
  }
});

// ─── ADMIN TRAININGS ────────────────────────────────
app.get('/api/admin/trainings', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, teams.name as team_name,
        -- Oluşturan: konumu eksik (haritada görünmeyen) etkinlik için kime yazılacağı
        creator.name as creator_name, creator.email as creator_email,
        COUNT(ta.user_id) as participant_count,
        (SELECT COUNT(*)::int FROM training_views v WHERE v.training_id = t.id) AS view_count,
        (SELECT json_build_object('sent_at', g.sent_at, 'recipients', g.recipients, 'skipped', g.skipped)
           FROM grow_email_log g WHERE g.kind = 'training' AND g.ref_id = t.id
          ORDER BY g.sent_at DESC LIMIT 1) AS last_grow_email,
        (SELECT json_build_object('kind', a.kind, 'status', a.status, 'sent_at', a.sent_at)
           FROM activation_email_log a WHERE a.kind IN ('ec', 'lc') AND a.ref_id = t.id AND a.status <> 'pending'
          ORDER BY (a.status = 'sent') DESC, a.sent_at DESC LIMIT 1) AS last_auto_email  -- gönderilen, atlanandan önce
      FROM trainings t
      LEFT JOIN teams ON t.team_id = teams.id
      LEFT JOIN users creator ON creator.id = t.created_by
      LEFT JOIN training_attendees ta ON t.id = ta.training_id
      GROUP BY t.id, teams.name, creator.name, creator.email
      ORDER BY t.training_date DESC, t.training_time DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trainings' });
  }
});

// ── Büyüme maili (admin butonu) ─────────────────────────────────────────
// Mevcut takım/etkinlik için "daha kalabalık olsun" e-postası. Yalnız takımın
// lideri, kaptanı ve antrenörü alır (takımsız etkinlikte oluşturan). Alıcının
// dilinde gider; "Muuvlink'ten ipuçları" tercihini kapatan atlanır.
// 24 saat içinde aynı yere ikinci gönderim force olmadan reddedilir.
const GROW_ROLES = ['owner', 'captain', 'coach'];
async function growEmailGuard(kind, id, force) {
  if (force) return null;
  const r = await pool.query(
    `SELECT sent_at, recipients, skipped FROM grow_email_log
      WHERE kind = $1 AND ref_id = $2 AND sent_at > NOW() - INTERVAL '24 hours'
      ORDER BY sent_at DESC LIMIT 1`, [kind, id]);
  return r.rows[0] || null;
}
async function sendGrowEmails(recipients, build) {
  let sent = 0, skipped = 0, failed = 0;
  for (const u of recipients) {
    const r = await sendEmail({ to: u.email, userId: u.id, prefKey: 'tips', kind: 'grow', build });
    if (r?.skipped) skipped++; else if (r) sent++; else failed++;
  }
  return { sent, skipped, failed };
}

app.post('/api/admin/teams/:id/grow-email', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const t = (await pool.query(
      `SELECT t.id, t.name, t.is_private, (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) AS members
         FROM teams t WHERE t.id = $1`, [id])).rows[0];
    if (!t) return res.status(404).json({ error: 'Takım bulunamadı.' });
    const recent = await growEmailGuard('team', id, req.body?.force === true);
    if (recent) return res.status(409).json({ error: 'Bu takıma son 24 saatte zaten gönderildi.', code: 'recent', last: recent });
    const recipients = (await pool.query(
      `SELECT DISTINCT u.id, u.email FROM team_members tm JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = $1 AND tm.role = ANY($2) AND u.deleted_at IS NULL AND u.email IS NOT NULL`,
      [id, GROW_ROLES])).rows;
    if (!recipients.length) return res.status(400).json({ error: 'Bu takımda lider, kaptan ya da antrenör yok.' });
    const url = `${APP_URL}/takim/${slugify(t.name)}-${t.id}`;
    const d = { name: t.name, url, ctaUrl: url, members: t.members, isPrivate: t.is_private };
    const r = await sendGrowEmails(recipients, (L) => activationEmail('gt', d, L));
    const log = (await pool.query(
      `INSERT INTO grow_email_log (kind, ref_id, sent_by, recipients, skipped) VALUES ('team', $1, $2, $3, $4)
       RETURNING sent_at, recipients, skipped`, [id, req.user.id, r.sent, r.skipped])).rows[0];
    res.json({ ...r, total: recipients.length, last: log });
  } catch (e) {
    console.error('Grow email (team) error:', e);
    res.status(500).json({ error: 'Gönderilemedi.' });
  }
});

app.post('/api/admin/trainings/:id/grow-email', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const t = (await pool.query(
      `SELECT t.id, t.title, t.team_id, t.created_by, t.training_date, t.training_time, t.location_name,
              t.is_public, t.is_organizer_event, teams.is_private AS team_private,
              (${trainingUtcExpr('t')} < NOW()) AS is_past,
              (SELECT COUNT(*)::int FROM training_attendees WHERE training_id = t.id) AS attendees
         FROM trainings t LEFT JOIN teams ON teams.id = t.team_id WHERE t.id = $1`, [id])).rows[0];
    if (!t) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    if (t.is_organizer_event) return res.status(400).json({ error: 'Organizatör etkinliğine gönderilmez.' });
    if (t.is_past) return res.status(400).json({ error: 'Geçmiş etkinliğe gönderilmez.' });
    const recent = await growEmailGuard('training', id, req.body?.force === true);
    if (recent) return res.status(409).json({ error: 'Bu etkinliğe son 24 saatte zaten gönderildi.', code: 'recent', last: recent });
    const recipients = (t.team_id
      ? await pool.query(
          `SELECT DISTINCT u.id, u.email FROM team_members tm JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = $1 AND tm.role = ANY($2) AND u.deleted_at IS NULL AND u.email IS NOT NULL`,
          [t.team_id, GROW_ROLES])
      : await pool.query(
          'SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL AND email IS NOT NULL', [t.created_by])).rows;
    if (!recipients.length) return res.status(400).json({ error: 'Gönderilecek yönetici yok.' });
    const url = `${APP_URL}/etkinlik/${slugify(t.title)}-${t.id}`;
    const r = await sendGrowEmails(recipients, (L) => activationEmail('ge', {
      name: t.title, url, ctaUrl: url, attendees: t.attendees,
      when: new Date(t.training_date).toLocaleDateString(MAIL_LOCALE[mailLang(L)], { timeZone: 'UTC', day: 'numeric', month: 'long' }),
      time: t.training_time ? String(t.training_time).slice(0, 5) : '',
      location: t.location_name || '',
      isPrivate: !!(t.team_id && t.team_private && !t.is_public),
    }, L));
    const log = (await pool.query(
      `INSERT INTO grow_email_log (kind, ref_id, sent_by, recipients, skipped) VALUES ('training', $1, $2, $3, $4)
       RETURNING sent_at, recipients, skipped`, [id, req.user.id, r.sent, r.skipped])).rows[0];
    res.json({ ...r, total: recipients.length, last: log });
  } catch (e) {
    console.error('Grow email (training) error:', e);
    res.status(500).json({ error: 'Gönderilemedi.' });
  }
});

app.put('/api/admin/trainings/:id/feature', isAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE trainings
          SET is_featured = NOT is_featured,
              featured_at = CASE WHEN is_featured THEN NULL ELSE NOW() END
        WHERE id = $1
        RETURNING id, is_featured, featured_at`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    res.json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Öne çıkarma değiştirilemedi.' });
  }
});

app.delete('/api/admin/trainings/:id', isAdmin, async (req, res) => {
  try {
    const gone = await pool.query(
      `DELETE FROM trainings WHERE id = $1
       RETURNING title, training_date, team_id,
                 (SELECT name FROM teams WHERE teams.id = trainings.team_id) AS team_name`,
      [req.params.id]);
    if (gone.rows[0]) {
      const g = gone.rows[0];
      logDeletion('training', { id: req.params.id, name: g.title, meta: { team_name: g.team_name, training_date: g.training_date } }, req.user.id, 'admin');
    }
    res.json({ message: 'Etkinlik silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete training' });
  }
});

// ─── ADMIN TEAMS ────────────────────────────────────
app.get('/api/admin/teams', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.name as owner_name,
        COUNT(tm.user_id) as member_count,
        (SELECT json_build_object('sent_at', g.sent_at, 'recipients', g.recipients, 'skipped', g.skipped)
           FROM grow_email_log g WHERE g.kind = 'team' AND g.ref_id = t.id
          ORDER BY g.sent_at DESC LIMIT 1) AS last_grow_email,
        (SELECT json_build_object('kind', a.kind, 'status', a.status, 'sent_at', a.sent_at)
           FROM activation_email_log a WHERE a.kind IN ('tc', 'te') AND a.ref_id = t.id AND a.status <> 'pending'
          ORDER BY (a.status = 'sent') DESC, a.sent_at DESC LIMIT 1) AS last_auto_email  -- gönderilen, atlanandan önce
      FROM teams t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      GROUP BY t.id, u.name
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.delete('/api/admin/teams/:id', isAdmin, async (req, res) => {
  try {
    const meta = await pool.query(
      'SELECT (SELECT COUNT(*)::int FROM team_members WHERE team_id = $1) AS members, (SELECT COUNT(*)::int FROM trainings WHERE team_id = $1) AS trainings', [req.params.id]);
    const gone = await pool.query('DELETE FROM teams WHERE id = $1 RETURNING name', [req.params.id]);
    if (gone.rows[0]) logDeletion('team', { id: req.params.id, name: gone.rows[0].name, meta: meta.rows[0] }, req.user.id, 'admin');
    res.json({ message: 'Takım silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ─── ADMIN CONTACT MESSAGES ─────────────────────────
app.get('/api/admin/contact', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contact_messages ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.put('/api/admin/contact/:id/read', isAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE contact_messages SET is_read = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Okundu.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

app.delete('/api/admin/contact/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM contact_messages WHERE id = $1', [req.params.id]);
    res.json({ message: 'Mesaj silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ─── PUBLIC: İLETİŞİM FORMU ────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
    }

    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, subject, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), email.trim(), subject.trim(), message.trim()]
    );

    // Admin'e mail gönder
    const adminResult = await pool.query('SELECT email FROM users WHERE is_admin = true LIMIT 1');
    if (adminResult.rows[0]) {
      sendEmail({
        kind: 'contact_admin',
        to: adminResult.rows[0].email,
        subject: `Yeni İletişim Mesajı: ${subject}`,
        html: emailWrapper(`
          <h2 style="margin:0 0 16px;color:#1e293b;">Yeni İletişim Formu Mesajı</h2>
          <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;">
            <p style="margin:0 0 8px;"><strong>Ad:</strong> ${name}</p>
            <p style="margin:0 0 8px;"><strong>E-posta:</strong> ${email}</p>
            <p style="margin:0 0 8px;"><strong>Konu:</strong> ${subject}</p>
          </div>
          <div style="background:#f8fafc;border-left:3px solid #114956;border-radius:8px;padding:20px;">
            <p style="margin:0;color:#334155;line-height:1.7;white-space:pre-wrap;">${message}</p>
          </div>
          <div style="margin-top:24px;text-align:center;">
            <a href="${APP_URL}/admin.html?tab=messages"
               style="display:inline-block;background:linear-gradient(135deg,#114956,#0e3c47);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">
              Panelde Görüntüle →
            </a>
          </div>
        `),
      });
    }

    // Gönderene teşekkür maili
    sendEmail({
      kind: 'contact_reply',
      to: email,
      fallbackLang: reqLang(req),
      build: (L) => ({
        subject: tm(L, 'contactSubject'),
        html: emailWrapper(`
        <h2 style="margin:0 0 12px;color:#1e293b;">${tm(L, 'contactThanks', name)}</h2>
        <p style="color:#64748b;line-height:1.7;margin:0 0 20px;">
          ${tm(L, 'contactBody')}
        </p>
        <div style="background:#f8fafc;border-left:3px solid #114956;border-radius:8px;padding:20px;">
          <p style="margin:0 0 8px;font-weight:600;color:#1e293b;">${tm(L, 'contactTopic')} ${subject}</p>
          <p style="margin:0;color:#64748b;font-size:14px;white-space:pre-wrap;">${message.slice(0, 200)}${message.length > 200 ? '...' : ''}</p>
        </div>
      `, L),
      }),
    });

    res.json({ message: 'Mesajınız başarıyla gönderildi.', id: result.rows[0].id });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ error: 'Mesaj gönderilemedi.' });
  }
});

// =====================================================
// HEALTH CHECK
// =====================================================

// =====================================================
// BANNER ROUTES
// =====================================================

// Public: aktif bannerları getir
// ─── Platform İstatistikleri (public) ──────────────────────────────────────
app.get('/api/platform-stats', async (req, res) => {
  try {
    const [users, trainings, teams, badges] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users`),
      pool.query(`SELECT COUNT(*) FROM trainings`),
      pool.query(`SELECT COUNT(*) FROM teams`),
      pool.query(`SELECT COUNT(*) FROM user_badges`),
    ]);
    res.json({
      users:     parseInt(users.rows[0].count),
      trainings: parseInt(trainings.rows[0].count),
      teams:     parseInt(teams.rows[0].count),
      badges:    parseInt(badges.rows[0].count),
    });
  } catch (e) {
    res.status(500).json({ error: 'İstatistikler alınamadı.' });
  }
});


app.get('/api/banners', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM banners WHERE is_active = true ORDER BY order_index ASC, created_at ASC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Bannerlar alınamadı.' });
  }
});

// Admin: tüm bannerları getir
app.get('/api/admin/banners', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM banners ORDER BY order_index ASC, created_at ASC`);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Bannerlar alınamadı.' });
  }
});

// Admin: banner oluştur
app.post('/api/admin/banners', isAdmin, async (req, res) => {
  try {
    // mottos ve renk kolonlarını ekle (yoksa)
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS mottos JSONB DEFAULT '[]'`);
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_1 TEXT DEFAULT '#114956'`);
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_2 TEXT DEFAULT '#643e87'`);
    const { title, subtitle, badge_text, cta_primary_text, cta_primary_text_en, cta_primary_text_de,
            cta_secondary_text, cta_primary_url, cta_secondary_url,
            gradient_from, gradient_via, gradient_to, order_index, is_active, mottos,
            motto_color_1, motto_color_2, title_color, subtitle_color } = req.body;
    const result = await pool.query(
      `INSERT INTO banners (title, subtitle, badge_text, cta_primary_text, cta_primary_text_en, cta_primary_text_de,
        cta_secondary_text, cta_primary_url, cta_secondary_url,
        gradient_from, gradient_via, gradient_to, order_index, is_active, mottos,
        motto_color_1, motto_color_2, title_color, subtitle_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [title, subtitle, badge_text, cta_primary_text, cta_primary_text_en || '', cta_primary_text_de || '',
       cta_secondary_text, cta_primary_url || '', cta_secondary_url || '',
       gradient_from || '#0D0B26', gradient_via || '#1a1040', gradient_to || '#0f2044',
       order_index || 0, is_active !== false,
       JSON.stringify(Array.isArray(mottos) && mottos.length ? mottos : []),
       motto_color_1 || '#114956', motto_color_2 || '#643e87',
       title_color || '#ffffff', subtitle_color || 'rgba(186,230,253,0.75)']
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: banner güncelle
app.put('/api/admin/banners/:id', isAdmin, async (req, res) => {
  try {
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS mottos JSONB DEFAULT '[]'`);
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_1 TEXT DEFAULT '#114956'`);
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_2 TEXT DEFAULT '#643e87'`);
    const { title, subtitle, badge_text, cta_primary_text, cta_primary_text_en, cta_primary_text_de,
            cta_secondary_text, cta_primary_url, cta_secondary_url,
            gradient_from, gradient_via, gradient_to, order_index, is_active, mottos,
            motto_color_1, motto_color_2, title_color, subtitle_color } = req.body;
    const result = await pool.query(
      `UPDATE banners SET title=$1, subtitle=$2, badge_text=$3,
        cta_primary_text=$4, cta_primary_text_en=$5, cta_primary_text_de=$6,
        cta_secondary_text=$7, cta_primary_url=$8, cta_secondary_url=$9,
        gradient_from=$10, gradient_via=$11, gradient_to=$12,
        order_index=$13, is_active=$14, mottos=$15,
        motto_color_1=$16, motto_color_2=$17,
        title_color=$18, subtitle_color=$19
       WHERE id=$20 RETURNING *`,
      [title, subtitle, badge_text, cta_primary_text, cta_primary_text_en || '', cta_primary_text_de || '',
       cta_secondary_text, cta_primary_url || '', cta_secondary_url || '',
       gradient_from, gradient_via, gradient_to, order_index, is_active,
       JSON.stringify(Array.isArray(mottos) && mottos.length ? mottos : []),
       motto_color_1 || '#114956', motto_color_2 || '#643e87',
       title_color || '#ffffff', subtitle_color || 'rgba(186,230,253,0.75)',
       req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: banner görseli yükle
app.post('/api/admin/banners/:id/image', isAdmin, uploadBanner.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi.' });
    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `banner-${req.params.id}-${Date.now()}.webp`;
    const webpBuffer = await toWebP(req.file.buffer, 1920);
    const imageUrl = await uploadToSupabase('banners', fileName, webpBuffer, 'image/webp');

    const result = await pool.query(
      'UPDATE banners SET image_url=$1 WHERE id=$2 RETURNING *',
      [imageUrl, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: banner sil
app.delete('/api/admin/banners/:id', isAdmin, async (req, res) => {
  try {
    const old = await pool.query('SELECT image_url FROM banners WHERE id=$1', [req.params.id]);
    if (old.rows[0]?.image_url) {
      const oldPath = path.join(__dirname, old.rows[0].image_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await pool.query('DELETE FROM banners WHERE id=$1', [req.params.id]);
    res.json({ message: 'Banner silindi.' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// ÜCRETLİ ETKİNLİKLER (yarış vb.) — sadece panelden yönetilir.
// trainings tablosunda is_paid=true satırlar; normal etkinlik akışında görünürler.
// =====================================================

// Admin: ücretli etkinlikleri listele (tıklama sayısıyla)
app.get('/api/admin/paid-events', isAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, description, sport, organizer, registration_url, image_url,
              registration_clicks, training_date, training_time,
              location_name, location_lat, location_lng, location_address, is_public, is_paid
       FROM trainings WHERE is_organizer_event = true
       ORDER BY training_date DESC, training_time DESC`
    );
    res.json(r.rows);
  } catch (e) {
    console.error('Admin paid-events list error:', e);
    res.status(500).json({ error: 'Ücretli etkinlikler alınamadı.' });
  }
});

// Admin: ücretli etkinlik oluştur
app.post('/api/admin/paid-events', isAdmin, async (req, res) => {
  try {
    const { title, description, sport, organizer, registration_url,
            training_date, training_time, location_name, location_lat,
            location_lng, location_address, is_paid } = req.body;
    if (!title || !training_date) {
      return res.status(400).json({ error: 'Başlık ve tarih zorunludur.' });
    }
    // trainings.training_time NOT NULL — saatsiz gönderim eskiden 500'e düşüyordu.
    if (!training_time) {
      return res.status(400).json({ error: 'Saat zorunludur.' });
    }
    const r = await pool.query(
      `INSERT INTO trainings
        (team_id, sport, created_by, title, description, training_date, training_time,
         duration_minutes, location_name, location_lat, location_lng, location_address,
         capacity, is_public, difficulty, is_paid, is_organizer_event, organizer, registration_url)
       VALUES (NULL,$1,$2,$3,$4,$5,$6,60,$7,$8,$9,$10,0,true,NULL,$13,true,$11,$12)
       RETURNING *`,
      [sport || null, req.user.id, title, description || '', training_date,
       training_time, location_name || null,
       location_lat || null, location_lng || null, location_address || null,
       organizer || null, registration_url || null, is_paid !== false]
    );
    res.json(r.rows[0]);
    indexNowPing(indexNowTrainingUrl(r.rows[0]));
  } catch (e) {
    console.error('Admin paid-event create error:', e);
    res.status(500).json({ error: 'Ücretli etkinlik oluşturulamadı.' });
  }
});

// Admin: ücretli etkinlik güncelle
app.put('/api/admin/paid-events/:id', isAdmin, async (req, res) => {
  try {
    const { title, description, sport, organizer, registration_url,
            training_date, training_time, location_name, location_lat,
            location_lng, location_address } = req.body;
    const r = await pool.query(
      `UPDATE trainings SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         sport = $3,
         organizer = $4,
         registration_url = $5,
         training_date = COALESCE($6, training_date),
         training_time = COALESCE($7, training_time),   -- NOT NULL: boşaltılamaz
         location_name = $8,
         location_lat = $9,
         location_lng = $10,
         location_address = $11,
         is_paid = COALESCE($13, is_paid)
       WHERE id = $12 AND is_organizer_event = true
       RETURNING *`,
      [title || null, description ?? null, sport || null, organizer || null,
       registration_url || null, training_date || null, training_time || null,
       location_name || null, location_lat || null, location_lng || null,
       location_address || null, req.params.id,
       typeof req.body.is_paid === 'boolean' ? req.body.is_paid : null]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    res.json(r.rows[0]);
    indexNowPing(indexNowTrainingUrl(r.rows[0]));
  } catch (e) {
    console.error('Admin paid-event update error:', e);
    res.status(500).json({ error: 'Ücretli etkinlik güncellenemedi.' });
  }
});

// Admin: ücretli etkinlik görseli yükle (yarış görseli)
app.post('/api/admin/paid-events/:id/image', isAdmin, uploadBanner.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi.' });
    const fileName = `paid-event-${req.params.id}-${Date.now()}.webp`;
    const webpBuffer = await toWebP(req.file.buffer, 1600);
    const imageUrl = await uploadToSupabase('banners', fileName, webpBuffer, 'image/webp');
    const r = await pool.query(
      'UPDATE trainings SET image_url=$1 WHERE id=$2 AND is_organizer_event = true RETURNING *',
      [imageUrl, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Ücretli etkinlik bulunamadı.' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('Admin paid-event image error:', e);
    res.status(500).json({ error: 'Görsel yüklenemedi.' });
  }
});

// Admin: ücretli etkinlik sil
app.delete('/api/admin/paid-events/:id', isAdmin, async (req, res) => {
  try {
    const gone = await pool.query(
      'DELETE FROM trainings WHERE id=$1 AND is_organizer_event = true RETURNING id, title, is_public, training_date', [req.params.id]);
    if (gone.rows[0]) {
      logDeletion('training', { id: gone.rows[0].id, name: gone.rows[0].title, meta: { training_date: gone.rows[0].training_date, ucretli: true } }, req.user.id, 'admin');
    }
    res.json({ message: 'Ücretli etkinlik silindi.' });
    indexNowPing(indexNowTrainingUrl(gone.rows[0]));
  } catch (e) {
    console.error('Admin paid-event delete error:', e);
    res.status(500).json({ error: 'Ücretli etkinlik silinemedi.' });
  }
});

// =====================================================
// YARIŞ KEŞFİ (event discovery) — internetteki yarış takvimlerini tarayıp
// admin onayına düşen "aday etkinlik" havuzu üretir. Onaylanan aday, mevcut
// ücretli etkinlik (is_paid=true) satırına dönüşür ve haritada görünür.
//
// İki tarama modu var:
//   • sources : discovery_sources tablosundaki sayfaları biz indirip metnini
//               modele ayrıştırtırız (robots.txt'e uyulur).
//   • web     : Claude'un sunucu taraflı web arama aracıyla takvim aranır.
// Hiçbir aday otomatik yayına girmez; hepsi 'pending' olarak beklemeye alınır.
// =====================================================

pool.query(`
  CREATE TABLE IF NOT EXISTS discovery_sources (
    id              SERIAL PRIMARY KEY,
    name            TEXT,
    url             TEXT NOT NULL UNIQUE,
    is_active       BOOLEAN DEFAULT true,
    last_scanned_at TIMESTAMPTZ,
    last_status     TEXT,
    last_found      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

pool.query(`
  CREATE TABLE IF NOT EXISTS event_candidates (
    id               SERIAL PRIMARY KEY,
    source_url       TEXT,
    source_name      TEXT,
    title            TEXT NOT NULL,
    description      TEXT,
    sport            TEXT,
    organizer        TEXT,
    registration_url TEXT,
    training_date    DATE,
    training_time    TIME,
    location_name    TEXT,
    location_lat     NUMERIC(10,7),
    location_lng     NUMERIC(10,7),
    location_address TEXT,
    city             TEXT,
    confidence       NUMERIC(4,3),
    dedupe_key       TEXT UNIQUE,
    status           TEXT DEFAULT 'pending',
    training_id      INTEGER REFERENCES trainings(id) ON DELETE SET NULL,
    reviewed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

// Panelde kullanılan spor listesiyle birebir aynı olmalı (admin-panel.jsx → SPORT_TYPES)
const DISCOVERY_SPORTS = ['Basketbol','Bikejoring','Bisiklet','Canicross','Crossfit','Dog Triatlon','Futbol','Kano','Koşu','Kürek','Padel','Pilates','Tenis','Trekking','Triatlon','Voleybol','Yoga','Yürüyüş','Yüzme','Diğer'];

// İlk kurulumda kaynak listesi boşsa doldur (panelden düzenlenebilir)
// Hepsi düz HTML veriyor ve robots.txt izin veriyor (19.08.2026'da tek tek denendi).
// Federasyon siteleri denendi ve elendi: takvimleri ya 404 ya erişilemez ya da JS ile yükleniyor.
const DEFAULT_DISCOVERY_SOURCES = [
  { name: 'TAF Yol Yarışları Platformu', url: 'https://kosu.taf.org.tr/' },
  { name: 'PassTiming — Yarış Takvimi', url: 'https://www.passtiming.org/yarisma-takvimi' },
  { name: 'TEAM RunBo — Yarış Takvimi', url: 'https://teamrunbo.com/yaristakvimimiz/' },
  { name: 'kosu.co — Yarış Takvimi', url: 'https://kosu.co/yaris-takvimi/' },
];

setTimeout(async () => {
  try {
    const c = await pool.query('SELECT COUNT(*)::int AS n FROM discovery_sources');
    if (c.rows[0]?.n === 0) {
      for (const s of DEFAULT_DISCOVERY_SOURCES) {
        await pool.query(
          'INSERT INTO discovery_sources (name, url) VALUES ($1,$2) ON CONFLICT (url) DO NOTHING',
          [s.name, s.url]
        ).catch(() => {});
      }
      console.log('[DISCOVERY] varsayılan kaynaklar eklendi');
    }
  } catch { /* tablo henüz hazır değilse sessiz geç */ }
}, 6000);

// ── Anthropic istemcisi (paket veya anahtar yoksa özellik kapalı kalır) ────
let _anthropic;
function getAnthropic() {
  if (_anthropic !== undefined) return _anthropic;
  _anthropic = null;
  if (!process.env.ANTHROPIC_API_KEY) return _anthropic;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    _anthropic = new Anthropic();
  } catch (e) {
    console.error('[DISCOVERY] @anthropic-ai/sdk yüklenemedi:', e.message);
    _anthropic = null;
  }
  return _anthropic;
}

// HTTP başlıkları yalnızca ASCII kabul eder — buraya Türkçe karakter koyma (fetch ByteString hatası verir)
const DISCOVERY_UA = 'MuuvlinkBot/1.0 (+https://muuvlink.app; event calendar crawler)';

// Ayrıştırma modeli. Sayfa metninden tarih/yer/isim çıkarmak kalıp bir iş olduğu için
// varsayılan ucuz model; .env'den DISCOVERY_MODEL ile değiştirilebilir (ör. claude-sonnet-5).
const DISCOVERY_MODEL = process.env.DISCOVERY_MODEL || 'claude-haiku-4-5';
// 4.6 ve sonrası modeller `effort` ve yeni web arama aracını destekliyor; Haiku 4.5 gibi
// eski modeller `effort` gönderilince 400 döner ve aracın eski sürümünü kullanır.
const isModernModel = (m) => /(fable-5|opus-5|opus-4-[678]|sonnet-5|sonnet-4-6)/.test(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Tarama durumu (panel 2 sn'de bir sorar) ───────────────────────────────
const discoveryState = {
  running: false, mode: null, startedAt: null, finishedAt: null,
  total: 0, done: 0, found: 0, added: 0, current: '', log: [], error: null,
};
const dlog = (msg) => {
  discoveryState.log.push(`${new Date().toISOString().slice(11,19)} · ${msg}`);
  if (discoveryState.log.length > 200) discoveryState.log.shift();
  console.log('[DISCOVERY]', msg);
};

// ── robots.txt kontrolü (kaynak modunda) ──────────────────────────────────
const robotsCache = new Map(); // origin -> { rules:[], at }
async function robotsAllows(targetUrl) {
  try {
    const u = new URL(targetUrl);
    const cached = robotsCache.get(u.origin);
    let rules;
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) {
      rules = cached.rules;
    } else {
      rules = [];
      try {
        const res = await fetch(`${u.origin}/robots.txt`, {
          headers: { 'User-Agent': DISCOVERY_UA },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const txt = (await res.text()).slice(0, 100000);
          let inStar = false;
          for (const raw of txt.split('\n')) {
            const line = raw.split('#')[0].trim();
            if (!line) continue;
            const [kRaw, ...rest] = line.split(':');
            const k = kRaw.trim().toLowerCase();
            const v = rest.join(':').trim();
            if (k === 'user-agent') inStar = (v === '*');
            else if (inStar && k === 'disallow' && v) rules.push(v);
            else if (inStar && k === 'allow' && v) rules.push('!' + v);
          }
        }
      } catch { /* robots.txt yoksa/erişilemezse serbest kabul */ }
      robotsCache.set(u.origin, { rules, at: Date.now() });
    }
    const path = u.pathname + u.search;
    // Allow kuralı Disallow'u ezer (en uzun eşleşme kazanır)
    let best = null;
    for (const r of rules) {
      const allow = r.startsWith('!');
      const p = allow ? r.slice(1) : r;
      if (path.startsWith(p) && (!best || p.length > best.len)) best = { allow, len: p.length };
    }
    return best ? best.allow : true;
  } catch {
    return true;
  }
}

// ── HTML → düz metin ──────────────────────────────────────────────────────
function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0?39;/gi, "'")
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// ── Nominatim ile koordinat çözme (saniyede 1 istek sınırına uyulur) ──────
async function geocodeTR(query) {
  if (!query || !query.trim()) return null;
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&addressdetails=1&q='
      + encodeURIComponent(query.trim());
    const res = await fetch(url, {
      headers: { 'User-Agent': DISCOVERY_UA, 'Accept-Language': 'tr' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr[0]) return null;
    return {
      lat: Number(arr[0].lat),
      lng: Number(arr[0].lon),
      address: arr[0].display_name || null,
    };
  } catch {
    return null;
  } finally {
    await sleep(1200); // Nominatim kullanım politikası: en fazla 1 istek/sn
  }
}

// ── Model çıktısı için JSON şeması ────────────────────────────────────────
const DISCOVERY_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:            { type: 'string' },
          sport:            { type: 'string', enum: DISCOVERY_SPORTS },
          description:      { type: 'string' },
          organizer:        { type: 'string' },
          registration_url: { type: 'string' },
          date:             { type: 'string' },
          time:             { type: 'string' },
          city:             { type: 'string' },
          location_name:    { type: 'string' },
          source_url:       { type: 'string' },
          confidence:       { type: 'number' },
        },
        required: ['title','sport','description','organizer','registration_url','date','time','city','location_name','source_url','confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['events'],
  additionalProperties: false,
};

const DISCOVERY_SYSTEM = [
  'Türkiye\'de düzenlenecek spor yarışlarını (koşu, maraton, yarı maraton, trail/patika, ultra,',
  'triatlon, bisiklet, açık su yüzme, kürek, kano vb.) yapılandırılmış veriye çeviren bir ayrıştırıcısın.',
  '',
  'KURALLAR:',
  '- Sadece TÜRKİYE\'de yapılacak yarışları çıkar. Yurt dışı etkinlikleri atla.',
  '- Sadece TARİHİ GEÇMEMİŞ yarışları çıkar.',
  '- Tarihi net olmayan ("yakında", "Mayıs ayında") kayıtları ATLA. Uydurma tarih yazma.',
  '- date alanı kesinlikle YYYY-MM-DD olmalı. Saat bilinmiyorsa time alanını boş bırak ("").',
  '- sport alanı verilen listeden TAM olarak bir değer olmalı; uymuyorsa "Diğer" yaz.',
  '  (koşu/maraton/yarı maraton/ultra → "Koşu", patika/trail/dağ yürüyüşü → "Trekking",',
  '   HYROX/fonksiyonel fitness yarışları → "Crossfit", duatlon/akuatlon → "Triatlon",',
  '   yol/dağ bisikleti/gran fondo → "Bisiklet", açık su/havuz → "Yüzme",',
  '   köpekle koşu → "Canicross", köpekle bisiklet → "Bikejoring",',
  '   köpekle üç disiplinli yarış → "Dog Triatlon",',
  '   yürüyüş/yarış yürüyüşü/Nordic walking → "Yürüyüş")',
  '- description: kaynaktan KOPYALAMA; kendi cümlelerinle en fazla 200 karakter özet yaz (Türkçe).',
  '- Bilinmeyen alanları boş string ("") bırak; asla tahmin uydurma.',
  '- registration_url: kayıt/detay sayfasının tam adresi; yoksa kaynak sayfanın adresini yaz.',
  '- city: yarışın yapılacağı il (örn. "İstanbul"). location_name: daha spesifik yer varsa yaz.',
  '- confidence: bilginin ne kadar güvenilir olduğuna dair 0 ile 1 arası bir sayı.',
  '- Aynı yarışı birden fazla kez listeleme.',
  '- Yarış bulunmuyorsa boş liste döndür.',
].join('\n');

// Metin içindeki ilk dengeli JSON nesnesini döndürür (string'lerdeki süslü parantezleri atlar)
function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

// Yapılandırılmış JSON döndüren tek istek (pause_turn döngüsü dahil)
async function discoveryModelCall({ prompt, webSearch, effort }) {
  const client = getAnthropic();
  if (!client) throw new Error('ANTHROPIC_API_KEY tanımlı değil — tarama yapılamıyor.');
  const model = DISCOVERY_MODEL;
  const modern = isModernModel(model);
  const messages = [{ role: 'user', content: prompt }];
  const base = {
    model,
    max_tokens: 16000,
    system: DISCOVERY_SYSTEM,
    output_config: modern
      ? { effort: effort || 'low', format: { type: 'json_schema', schema: DISCOVERY_SCHEMA } }
      : { format: { type: 'json_schema', schema: DISCOVERY_SCHEMA } },
    ...(webSearch ? { tools: [{
      type: modern ? 'web_search_20260209' : 'web_search_20250305',
      name: 'web_search',
      max_uses: 6,
    }] } : {}),
  };
  let resp = await client.messages.create({ ...base, messages });
  let guard = 0;
  while (resp.stop_reason === 'pause_turn' && guard++ < 5) {
    messages.push({ role: 'assistant', content: resp.content });
    resp = await client.messages.create({ ...base, messages });
  }
  if (resp.stop_reason === 'refusal') throw new Error('Model isteği reddetti.');
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!text) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Model bazen JSON'dan sonra düz metin de yazıyor. İlk dengeli { … } bloğunu ayıkla;
    // "ilk { → son }" yaklaşımı bu durumda kırılıyor (araya ikinci bir nesne girebiliyor).
    const raw = extractFirstJsonObject(text);
    if (!raw) { dlog('⚠️ model yanıtı JSON olarak okunamadı'); return []; }
    try { data = JSON.parse(raw); }
    catch { dlog('⚠️ model yanıtı JSON olarak okunamadı'); return []; }
  }
  return Array.isArray(data?.events) ? data.events : [];
}

// ── Adayı normalize et + kaydet ───────────────────────────────────────────
const slugKey = (s) => String(s || '').toLocaleLowerCase('tr')
  .replace(/[çğıöşü]/g, (c) => ({ 'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u' }[c]))
  .replace(/[^a-z0-9]/g, '');

// Aynı yarış kaynaktan kaynağa farklı yazılıyor: "90. Ankara Büyük Atatürk Koşusu" ve
// "Büyük Atatürk Koşusu" gibi. Başlıktan sıra numarası ve genel sıfatlar atılıp kelime
// kümesi karşılaştırılıyor; aynı tarihte yeterince örtüşen iki kayıt tek yarış sayılıyor.
// "Edirne Maratonu" ile "Edirne Yarı Maratonu" ayrı kalsın diye eşik yüksek tutuldu.
const TITLE_STOPWORDS = new Set(['uluslararasi', 'geleneksel', 'turkiye']);
function titleTokens(title) {
  return new Set(
    String(title || '').toLocaleLowerCase('tr')
      .replace(/[çğıöşü]/g, (c) => ({ 'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u' }[c]))
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !TITLE_STOPWORDS.has(w))
  );
}
function tokenOverlap(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter); // Jaccard
}
const NEAR_DUPLICATE_THRESHOLD = 0.7;

async function saveCandidate(ev, sourceName, index) {
  const title = String(ev.title || '').trim();
  const date = String(ev.date || '').trim();
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const d = new Date(date + 'T00:00:00Z');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(); limit.setMonth(limit.getMonth() + 18);
  if (isNaN(d.getTime()) || d < today || d > limit) return null;

  const key = `${slugKey(title).slice(0, 60)}|${date}`;
  if (index.keys.has(key)) return null;
  const tokens = titleTokens(title);
  const sameDay = index.byDate.get(date) || [];
  if (sameDay.some((prev) => tokenOverlap(tokens, prev) >= NEAR_DUPLICATE_THRESHOLD)) return null;
  index.keys.add(key);
  sameDay.push(tokens);
  index.byDate.set(date, sameDay);

  const city = String(ev.city || '').trim();
  const locName = String(ev.location_name || '').trim() || city;
  let geo = null;
  if (locName || city) geo = await geocodeTR([locName, city, 'Türkiye'].filter(Boolean).join(', '));

  const time = /^\d{2}:\d{2}$/.test(String(ev.time || '').trim()) ? ev.time.trim() : null;
  const sport = DISCOVERY_SPORTS.includes(ev.sport) ? ev.sport : 'Diğer';
  const conf = Math.max(0, Math.min(1, Number(ev.confidence) || 0.5));

  const r = await pool.query(
    `INSERT INTO event_candidates
       (source_url, source_name, title, description, sport, organizer, registration_url,
        training_date, training_time, location_name, location_lat, location_lng,
        location_address, city, confidence, dedupe_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING *`,
    [String(ev.source_url || '').trim() || null, sourceName || null, title,
     String(ev.description || '').trim().slice(0, 500) || null, sport,
     String(ev.organizer || '').trim() || null, String(ev.registration_url || '').trim() || null,
     date, time, locName || null, geo?.lat ?? null, geo?.lng ?? null,
     geo?.address ?? null, city || null, conf, key]
  );
  return r.rows[0] || null;
}

// Zaten kayıtlı olanlar: kesin anahtarlar + tarih bazlı başlık kelime kümeleri
async function loadExistingIndex() {
  const keys = new Set();
  const byDate = new Map();
  const asDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));
  const add = (title, date) => {
    const dt = asDate(date);
    keys.add(`${slugKey(title).slice(0, 60)}|${dt}`);
    const arr = byDate.get(dt) || [];
    arr.push(titleTokens(title));
    byDate.set(dt, arr);
  };
  const a = await pool.query('SELECT title, training_date FROM trainings WHERE is_organizer_event = true');
  for (const row of a.rows) add(row.title, row.training_date);
  const b = await pool.query('SELECT title, training_date, dedupe_key FROM event_candidates');
  for (const row of b.rows) {
    add(row.title, row.training_date);
    if (row.dedupe_key) keys.add(row.dedupe_key);
  }
  return { keys, byDate };
}

// ── Tarama işleri ─────────────────────────────────────────────────────────
async function runSourceScan() {
  const srcRes = await pool.query('SELECT * FROM discovery_sources WHERE is_active = true ORDER BY id');
  const sources = srcRes.rows;
  discoveryState.total = sources.length;
  const index = await loadExistingIndex();

  for (const src of sources) {
    discoveryState.current = src.name || src.url;
    let status = 'ok', foundHere = 0;
    try {
      if (!(await robotsAllows(src.url))) {
        status = 'robots.txt engelledi';
        dlog(`⛔ ${src.url} — robots.txt izin vermiyor, atlandı`);
      } else {
        const res = await fetch(src.url, {
          headers: { 'User-Agent': DISCOVERY_UA, 'Accept-Language': 'tr,en;q=0.8' },
          signal: AbortSignal.timeout(25000),
          redirect: 'follow',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let text = htmlToText(await res.text());
        if (text.length > 60000) { text = text.slice(0, 60000); dlog(`✂️ ${src.url} — sayfa uzun, ilk 60.000 karakter kullanıldı`); }
        if (text.length < 200) throw new Error('Sayfa metni okunamadı (muhtemelen JS ile yükleniyor)');

        const events = await discoveryModelCall({
          effort: 'low',
          prompt: `Aşağıda bir yarış takvimi sayfasının metni var.\nKaynak adresi: ${src.url}\nBugünün tarihi: ${new Date().toISOString().slice(0,10)}\n\nBu metindeki Türkiye yarışlarını çıkar. source_url alanına ${src.url} yaz (yarışın kendi sayfası metinde geçiyorsa onu yaz).\n\n--- SAYFA METNİ ---\n${text}`,
        });
        discoveryState.found += events.length;
        for (const ev of events) {
          const saved = await saveCandidate(ev, src.name || src.url, index);
          if (saved) { discoveryState.added++; foundHere++; }
        }
        dlog(`✅ ${src.name || src.url} — ${events.length} yarış okundu, ${foundHere} yeni aday`);
      }
    } catch (e) {
      status = e.message?.slice(0, 200) || 'hata';
      dlog(`❌ ${src.name || src.url} — ${status}`);
    }
    await pool.query(
      'UPDATE discovery_sources SET last_scanned_at = NOW(), last_status = $1, last_found = $2 WHERE id = $3',
      [status, foundHere, src.id]
    ).catch(() => {});
    discoveryState.done++;
    await sleep(1500); // kaynak siteleri yormamak için
  }
}

// Web arama sorguları. Maliyet doğrudan çalıştırılan sorgu sayısıyla orantılı olduğu için
// panelden seçilerek çalıştırılır; hiçbiri seçilmezse tamamı çalışır.
const DISCOVERY_QUERIES = [
  { id: 'kosu',     label: 'Koşu (maraton, yarı maraton, 10K)', q: 'Türkiye koşu yarışları takvimi — maraton, yarı maraton, 10K' },
  { id: 'trail',    label: 'Trail / patika / ultra',            q: 'Türkiye trail / patika / ultra maraton yarışları takvimi' },
  { id: 'triatlon', label: 'Triatlon',                          q: 'Türkiye triatlon yarışları takvimi' },
  { id: 'bisiklet', label: 'Bisiklet',                          q: 'Türkiye bisiklet yarışları, gran fondo ve mtb kupa takvimi' },
  { id: 'yuzme',    label: 'Açık su yüzme',                     q: 'Türkiye açık su yüzme yarışları takvimi' },
  { id: 'hyrox',    label: 'HYROX / fitness yarışları',         q: 'HYROX Türkiye yaklaşan yarışları — turkiye.hyrox.com resmi takvimi, İstanbul/Ankara/İzmir tarihleri' },
  { id: 'ttf',      label: 'Triatlon Federasyonu takvimi',      q: 'Türkiye Triatlon Federasyonu faaliyet takvimi — yaklaşan triatlon, duatlon ve akuatlon yarışları' },
  { id: 'his',      label: 'Herkes İçin Spor Federasyonu',      q: 'Herkes İçin Spor Federasyonu faaliyet takvimi — halk koşuları, yürüyüş ve kitlesel spor etkinlikleri' },
];

async function runWebScan(selectedIds) {
  const chosen = Array.isArray(selectedIds) && selectedIds.length
    ? DISCOVERY_QUERIES.filter((x) => selectedIds.includes(x.id))
    : DISCOVERY_QUERIES;
  discoveryState.total = chosen.length;
  const index = await loadExistingIndex();
  const today = new Date().toISOString().slice(0, 10);

  for (const { label, q } of chosen) {
    discoveryState.current = label;
    try {
      const events = await discoveryModelCall({
        effort: 'medium',
        webSearch: true,
        prompt: `Bugünün tarihi: ${today}\n\nWeb'de ara: "${q}".\nÖnümüzdeki 12 ay içinde Türkiye'de yapılacak yarışları bul ve çıkar.\nBirden fazla kaynağa bak (organizatör siteleri, kayıt platformları, federasyon takvimleri).\nHer yarış için source_url alanına bilgiyi aldığın sayfanın adresini yaz.\n\nÖNEMLİ: Sadece bu sorgunun konusuyla ilgili yarışları çıkar. Açtığın sayfalarda başka\nbranşlardan yarışlar da göreceksin; onları listeleme. Konuya uyan yarış bulamazsan boş liste döndür.`,
      });
      discoveryState.found += events.length;
      let added = 0;
      for (const ev of events) {
        const saved = await saveCandidate(ev, 'Web araması', index);
        if (saved) { discoveryState.added++; added++; }
      }
      dlog(`✅ ${label} — ${events.length} yarış bulundu, ${added} yeni aday`);
    } catch (e) {
      dlog(`❌ ${label} — ${e.message?.slice(0, 200)}`);
    }
    discoveryState.done++;
  }
}

async function startDiscoveryScan(mode, queries) {
  Object.assign(discoveryState, {
    running: true, mode, startedAt: new Date().toISOString(), finishedAt: null,
    total: 0, done: 0, found: 0, added: 0, current: '', log: [], error: null,
  });
  dlog(mode === 'web' ? 'Web araması başladı' : 'Kaynak taraması başladı');
  try {
    if (mode === 'web') await runWebScan(queries);
    else await runSourceScan();
    dlog(`Tarama bitti — ${discoveryState.added} yeni aday onay bekliyor`);
  } catch (e) {
    discoveryState.error = e.message || 'Tarama başarısız';
    dlog(`Tarama durdu: ${discoveryState.error}`);
  } finally {
    discoveryState.running = false;
    discoveryState.current = '';
    discoveryState.finishedAt = new Date().toISOString();
  }
}

// ── Endpoint'ler ──────────────────────────────────────────────────────────

// Taramayı başlat (arka planda çalışır, durum /status'tan izlenir)
app.post('/api/admin/discovery/scan', isAdmin, async (req, res) => {
  const mode = req.body?.mode === 'web' ? 'web' : 'sources';
  if (discoveryState.running) return res.status(409).json({ error: 'Zaten devam eden bir tarama var.' });
  if (!getAnthropic()) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY sunucuda tanımlı değil. backend/.env dosyasına ekleyip servisi yeniden başlatın.' });
  }
  const queries = Array.isArray(req.body?.queries) ? req.body.queries : null;
  startDiscoveryScan(mode, queries); // bilerek await edilmiyor
  res.json({ started: true, mode, model: DISCOVERY_MODEL });
});

app.get('/api/admin/discovery/status', isAdmin, (req, res) => {
  res.json({ ...discoveryState, configured: !!getAnthropic(), model: DISCOVERY_MODEL });
});

// Web aramasında çalıştırılabilecek sorgular (panel seçim listesi)
app.get('/api/admin/discovery/queries', isAdmin, (req, res) => {
  res.json(DISCOVERY_QUERIES.map(({ id, label }) => ({ id, label })));
});

// Adayları listele
app.get('/api/admin/discovery/candidates', isAdmin, async (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const r = await pool.query(
      `SELECT * FROM event_candidates WHERE status = $1
       ORDER BY (location_lat IS NULL), training_date ASC, id DESC LIMIT 500`,
      [status]
    );
    const counts = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM event_candidates GROUP BY status`
    );
    res.json({
      items: r.rows,
      counts: counts.rows.reduce((a, x) => (a[x.status] = x.n, a), {}),
    });
  } catch (e) {
    console.error('Discovery candidates list error:', e);
    res.status(500).json({ error: 'Adaylar alınamadı.' });
  }
});

// Adayı düzenle (onaylamadan önce eksikleri tamamlamak için)
app.put('/api/admin/discovery/candidates/:id', isAdmin, async (req, res) => {
  try {
    const { title, description, sport, organizer, registration_url, training_date,
            training_time, location_name, location_lat, location_lng, location_address } = req.body;
    const r = await pool.query(
      `UPDATE event_candidates SET
         title = COALESCE($1, title), description = $2, sport = $3, organizer = $4,
         registration_url = $5, training_date = COALESCE($6, training_date), training_time = $7,
         location_name = $8, location_lat = $9, location_lng = $10, location_address = $11
       WHERE id = $12 AND status = 'pending' RETURNING *`,
      [title || null, description ?? null, sport || null, organizer || null,
       registration_url || null, training_date || null, training_time || null,
       location_name || null, location_lat ?? null, location_lng ?? null,
       location_address || null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Aday bulunamadı.' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('Discovery candidate update error:', e);
    res.status(500).json({ error: 'Aday güncellenemedi.' });
  }
});

// Onayla → ücretli etkinlik olarak yayına al
app.post('/api/admin/discovery/candidates/:id/approve', isAdmin, async (req, res) => {
  try {
    const c = (await pool.query('SELECT * FROM event_candidates WHERE id = $1', [req.params.id])).rows[0];
    if (!c) return res.status(404).json({ error: 'Aday bulunamadı.' });
    if (c.status === 'approved') return res.status(400).json({ error: 'Bu aday zaten onaylanmış.' });
    if (!c.training_date) return res.status(400).json({ error: 'Tarihi olmayan aday yayınlanamaz.' });

    const t = await pool.query(
      `INSERT INTO trainings
        (team_id, sport, created_by, title, description, training_date, training_time,
         duration_minutes, location_name, location_lat, location_lng, location_address,
         capacity, is_public, difficulty, is_paid, is_organizer_event, organizer, registration_url)
       VALUES (NULL,$1,$2,$3,$4,$5,$6,60,$7,$8,$9,$10,0,true,NULL,true,true,$11,$12)
       RETURNING *`,
      [c.sport || null, req.user.id, c.title, c.description || '', c.training_date,
       c.training_time || null, c.location_name || null, c.location_lat, c.location_lng,
       c.location_address || null, c.organizer || null, c.registration_url || null]
    );
    await pool.query(
      `UPDATE event_candidates SET status='approved', training_id=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3`,
      [t.rows[0].id, req.user.id, c.id]
    );
    res.json({ candidate_id: c.id, training: t.rows[0] });
  } catch (e) {
    console.error('Discovery approve error:', e);
    res.status(500).json({ error: 'Aday yayınlanamadı.' });
  }
});

// Reddet (bir daha aynı yarış aday olarak eklenmez — dedupe_key kalır)
app.post('/api/admin/discovery/candidates/:id/reject', isAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE event_candidates SET status='rejected', reviewed_by=$1, reviewed_at=NOW()
       WHERE id=$2 RETURNING id`, [req.user.id, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Aday bulunamadı.' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Discovery reject error:', e);
    res.status(500).json({ error: 'Aday reddedilemedi.' });
  }
});

// Toplu işlem: bir durumdaki adayların tamamını geri al veya sil.
// Silme, adayın dedupe anahtarını da götürür — o yarışlar sonraki taramada
// yeniden önerilebilir. Reddedilmiş halde bırakmak "bir daha gösterme" demektir.
app.post('/api/admin/discovery/candidates/bulk', isAdmin, async (req, res) => {
  try {
    const { action, status } = req.body || {};
    if (!['restore', 'delete'].includes(action)) return res.status(400).json({ error: 'Geçersiz işlem.' });
    if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Geçersiz durum.' });

    let r;
    if (action === 'restore') {
      if (status !== 'rejected') return res.status(400).json({ error: 'Sadece reddedilenler geri alınabilir.' });
      r = await pool.query(
        `UPDATE event_candidates SET status='pending', reviewed_by=NULL, reviewed_at=NULL WHERE status='rejected'`
      );
    } else {
      // Yayınlanmış adayı silmek etkinliği silmez; yanlışlıkla yayından kaldırma olmasın diye engelli.
      if (status === 'approved') return res.status(400).json({ error: 'Yayınlananlar toplu silinemez.' });
      r = await pool.query('DELETE FROM event_candidates WHERE status = $1', [status]);
    }
    res.json({ affected: r.rowCount });
  } catch (e) {
    console.error('Discovery bulk error:', e);
    res.status(500).json({ error: 'Toplu işlem başarısız.' });
  }
});

// Reddedilen adayı onay kuyruğuna geri al
app.post('/api/admin/discovery/candidates/:id/restore', isAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE event_candidates SET status='pending', reviewed_by=NULL, reviewed_at=NULL
       WHERE id=$1 AND status='rejected' RETURNING *`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Reddedilmiş aday bulunamadı.' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('Discovery restore error:', e);
    res.status(500).json({ error: 'Aday geri alınamadı.' });
  }
});

app.delete('/api/admin/discovery/candidates/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM event_candidates WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Aday silinemedi.' });
  }
});

// Kaynak yönetimi
app.get('/api/admin/discovery/sources', isAdmin, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM discovery_sources ORDER BY id');
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: 'Kaynaklar alınamadı.' });
  }
});

app.post('/api/admin/discovery/sources', isAdmin, async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Geçerli bir adres girin.' });
    const r = await pool.query(
      'INSERT INTO discovery_sources (name, url) VALUES ($1,$2) ON CONFLICT (url) DO NOTHING RETURNING *',
      [name || null, url.trim()]
    );
    if (!r.rows[0]) return res.status(409).json({ error: 'Bu adres zaten ekli.' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Kaynak eklenemedi.' });
  }
});

app.put('/api/admin/discovery/sources/:id', isAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE discovery_sources SET is_active = COALESCE($1, is_active), name = COALESCE($2, name) WHERE id=$3 RETURNING *',
      [typeof req.body?.is_active === 'boolean' ? req.body.is_active : null, req.body?.name ?? null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Kaynak bulunamadı.' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Kaynak güncellenemedi.' });
  }
});

app.delete('/api/admin/discovery/sources/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM discovery_sources WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Kaynak silinemedi.' });
  }
});

// =====================================================
// HOME NEWS
// =====================================================

app.get('/api/home-news', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM home_news WHERE is_active=true ORDER BY order_index ASC, created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/admin/home-news', isAdmin, async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM home_news ORDER BY order_index ASC, created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/admin/home-news', isAdmin, async (req, res) => {
  const { title, description, date_label, icon, bg, views, comments, is_active, order_index } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO home_news (title, description, date_label, icon, bg, views, comments, is_active, order_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, description||'', date_label||'', icon||'', bg||'linear-gradient(160deg,#0f2a1a,#1a4a2d)',
       views||0, comments||0, is_active!==false, order_index||0]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/admin/home-news/:id', isAdmin, async (req, res) => {
  const { title, description, date_label, icon, bg, views, comments, is_active, order_index } = req.body;
  try {
    const r = await pool.query(
      `UPDATE home_news SET title=$1, description=$2, date_label=$3, icon=$4, bg=$5, views=$6, comments=$7,
       is_active=$8, order_index=$9 WHERE id=$10 RETURNING *`,
      [title, description||'', date_label||'', icon||'', bg, views||0, comments||0, is_active!==false, order_index||0, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/admin/home-news/:id/image', isAdmin, uploadBanner.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yok.' });
    const fileName = `home-news-${req.params.id}-${Date.now()}.webp`;
    const webpBuffer_news = await toWebP(req.file.buffer, 1200);
    const imageUrl = await uploadToSupabase('banners', fileName, webpBuffer_news, 'image/webp');
    const r = await pool.query('UPDATE home_news SET image_url=$1 WHERE id=$2 RETURNING *', [imageUrl, req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.delete('/api/admin/home-news/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM home_news WHERE id=$1', [req.params.id]);
    res.json({ message: 'Silindi.' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// =====================================================
// HOME GALLERY
// =====================================================

app.get('/api/home-gallery', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM home_gallery WHERE is_active=true ORDER BY order_index ASC, created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/admin/home-gallery', isAdmin, async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM home_gallery ORDER BY order_index ASC, created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/admin/home-gallery', isAdmin, async (req, res) => {
  const { icon, bg, is_active, order_index } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO home_gallery (icon, bg, is_active, order_index)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [icon||'', bg||'linear-gradient(160deg,#0f2a1a,#1a4a2d)', is_active!==false, order_index||0]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/admin/home-gallery/:id', isAdmin, async (req, res) => {
  const { icon, bg, is_active, order_index } = req.body;
  try {
    const r = await pool.query(
      `UPDATE home_gallery SET icon=$1, bg=$2, is_active=$3, order_index=$4 WHERE id=$5 RETURNING *`,
      [icon||'', bg, is_active!==false, order_index||0, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/admin/home-gallery/:id/image', isAdmin, uploadBanner.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yok.' });
    const fileName = `home-gallery-${req.params.id}-${Date.now()}.webp`;
    const webpBuffer_gallery = await toWebP(req.file.buffer, 1920);
    const imageUrl = await uploadToSupabase('banners', fileName, webpBuffer_gallery, 'image/webp');
    const r = await pool.query('UPDATE home_gallery SET image_url=$1 WHERE id=$2 RETURNING *', [imageUrl, req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.delete('/api/admin/home-gallery/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM home_gallery WHERE id=$1', [req.params.id]);
    res.json({ message: 'Silindi.' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// =====================================================
// ADMIN: LOGS & ANALYTICS
// =====================================================

app.get('/api/admin/logs', isAdmin, async (req, res) => {
  try {
    const { event_type, limit: limitParam } = req.query;
    const limit = Math.min(parseInt(limitParam) || 200, 500);
    let query = `
      SELECT al.*, u.email as user_email
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
    `;
    const params = [];
    if (event_type && event_type !== 'all') {
      params.push(event_type);
      query += ` WHERE al.event_type = $${params.length}`;
    }
    params.push(limit);
    query += ` ORDER BY al.created_at DESC LIMIT $${params.length}`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error('admin logs error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: canlı trafik anlık görüntüsü. Tamamı bellekten okunur; tek DB sorgusu
// isim çözmek için, o da yalnızca önbellekte olmayan kullanıcılar varsa.
// "Şu an içeride" sayımı tek yerde: Canlı sekmesi ve menü rozeti aynı sayıyı göstersin.
function liveOnlineIds(now) {
  const ids = new Set([...sseClients.keys()].filter((id) => (sseClients.get(id)?.size || 0) > 0));
  for (const [id, v] of live.presence) if (now - v.ts <= LIVE_ONLINE_WINDOW_MS) ids.add(id);
  return ids;
}
function liveActiveGuestCount(now) {
  let n = 0;
  for (const v of live.visitors.values()) {
    if (now - v.ts <= LIVE_ONLINE_WINDOW_MS && v.plat !== 'bot' && v.plat !== 'script') n++;
  }
  return n;
}

// ─── ADMIN MENÜ ROZETLERİ ─────────────────────────────
// Sol menüdeki sayılar. Panel 20 sn'de bir sorar; hepsi tek turda, ucuz COUNT'lar.
// Önceden Şikayetler rozeti yalnız o sekme bir kez açılınca, Mesajlar rozeti de
// yalnız Genel Bakış yüklenince hesaplanıyordu — açmadığın sekmenin sayısı yoktu.
//
// since_users / since_trainings / since_teams: tarayıcının o sekmeye en son
// baktığı an (ms, sunucu saatiyle — yanıttaki `now`). Yalnız ondan sonra
// eklenenler "yeni" sayılır. Bakanın kendi oluşturdukları sayılmaz: yarış
// onaylayınca "Etkinlikler +5" çıkmasın.
app.get('/api/admin/badges', isAdmin, async (req, res) => {
  try {
    const now = Date.now();
    const since = (k) => {
      const v = Number(req.query[`since_${k}`]);
      return Number.isFinite(v) && v > 0 && v <= now ? new Date(v) : null;
    };
    const count = (sql, params = []) => pool.query(sql, params).then((r) => r.rows[0]?.n || 0);
    const sUsers = since('users'), sTrainings = since('trainings'), sTeams = since('teams');
    const [messages, reports, discovery, users, trainings, teams] = await Promise.all([
      count('SELECT COUNT(*)::int AS n FROM contact_messages WHERE is_read = false'),
      count('SELECT COUNT(*)::int AS n FROM content_reports WHERE resolved = false'),
      count("SELECT COUNT(*)::int AS n FROM event_candidates WHERE status = 'pending'").catch(() => 0),
      sUsers
        ? count('SELECT COUNT(*)::int AS n FROM users WHERE created_at > $1 AND deleted_at IS NULL', [sUsers])
        : 0,
      sTrainings
        ? count('SELECT COUNT(*)::int AS n FROM trainings WHERE created_at > $1 AND created_by IS DISTINCT FROM $2', [sTrainings, req.user.id])
        : 0,
      sTeams
        ? count('SELECT COUNT(*)::int AS n FROM teams WHERE created_at > $1 AND owner_id IS DISTINCT FROM $2', [sTeams, req.user.id])
        : 0,
    ]);
    res.json({
      now,
      messages, reports, discovery, users, trainings, teams,
      live: { members: liveOnlineIds(now).size, guests: liveActiveGuestCount(now) },
    });
  } catch (e) {
    console.error('Admin badges error:', e);
    res.status(500).json({ error: 'Rozetler alınamadı.' });
  }
});

app.get('/api/admin/live', isAdmin, async (req, res) => {
  try {
    const now = Date.now();

    // İsimleri tamamla
    const needed = [...live.presence.keys()].filter((id) => !liveUserNames.has(id));
    for (const f of live.feed.slice(0, 60)) if (f.userId && !liveUserNames.has(f.userId) && !needed.includes(f.userId)) needed.push(f.userId);
    if (needed.length) {
      const r = await pool.query('SELECT id, name FROM users WHERE id = ANY($1)', [needed]);
      for (const row of r.rows) liveUserNames.set(row.id, row.name);
      for (const id of needed) if (!liveUserNames.has(id)) liveUserNames.set(id, `#${id}`);
    }
    const nameOf = (id) => liveUserNames.get(id) || `#${id}`;

    // Bakılan takım/etkinlik/profil adlarını çöz (yalnızca önbellekte olmayanlar sorgulanır)
    const wanted = { team: new Set(), training: new Set(), user: new Set() };
    const wantEntity = (e) => { if (e && wanted[e.t] && !liveEntityNames.has(`${e.t}:${e.id}`)) wanted[e.t].add(e.id); };
    for (const f of live.feed.slice(0, 60)) wantEntity(f.entity);
    for (const v of live.presence.values()) wantEntity(v.entity);
    const entityQueries = [
      ['team', 'SELECT id, name FROM teams WHERE id = ANY($1)'],
      ['training', 'SELECT id, title AS name FROM trainings WHERE id = ANY($1)'],
      ['user', 'SELECT id, name FROM users WHERE id = ANY($1)'],
    ];
    await Promise.all(entityQueries.map(async ([t, sql]) => {
      const ids = [...wanted[t]];
      if (!ids.length) return;
      const r = await pool.query(sql, [ids]);
      for (const row of r.rows) liveEntityNames.set(`${t}:${row.id}`, row.name);
      for (const id of ids) if (!liveEntityNames.has(`${t}:${id}`)) liveEntityNames.set(`${t}:${id}`, null);
    }));
    const entityNameOf = (e) => (e ? liveEntityNames.get(`${e.t}:${e.id}`) || null : null);

    // Şu an içeride: açık SSE bağlantısı olanlar + son 5 dk içinde istek atanlar
    const onlineIds = liveOnlineIds(now);
    const online = [...onlineIds].map((id) => ({
      id,
      name: nameOf(id),
      connected: (sseClients.get(id)?.size || 0) > 0, // uygulama açık ve ön planda
      lastLabel: live.presence.get(id)?.label || null,
      lastTarget: entityNameOf(live.presence.get(id)?.entity),
      platform: live.presence.get(id)?.plat || null,
      secondsAgo: live.presence.has(id) ? Math.round((now - live.presence.get(id).ts) / 1000) : null,
    })).sort((a, b) => (a.secondsAgo ?? 1e9) - (b.secondsAgo ?? 1e9));

    // Son 5 dakikada kim hangi cihazdan: üyeler + anonim ziyaretçiler birlikte
    // Bot ve betikler burada YOK — onlar nginx günlüğünden ayrı listelenir.
    const platforms = {};
    for (const v of [...live.presence.values(), ...live.visitors.values()]) {
      if (now - v.ts > LIVE_ONLINE_WINDOW_MS) continue;
      if (v.plat === 'bot' || v.plat === 'script') continue;
      const k = v.plat || 'unknown';
      platforms[k] = (platforms[k] || 0) + 1;
    }
    const bots = await liveBotTraffic();

    // Misafirler de üyeler gibi tek tek listelenir (son hareketi ve cihazıyla)
    const guests = [...live.visitors.entries()]
      .filter(([, v]) => now - v.ts <= LIVE_ONLINE_WINDOW_MS && v.plat !== 'bot' && v.plat !== 'script')
      .map(([vid, v]) => ({
        vid,
        platform: v.plat || null,
        lastLabel: v.label || null,
        secondsAgo: Math.round((now - v.ts) / 1000),
      }))
      .sort((a, b) => a.secondsAgo - b.secondsAgo);

    // Botlar ziyaretçi sayılmaz — sayıyı şişirirler; nginx günlüğünden ayrı gösterilir.
    const activeVisitors = liveActiveGuestCount(now);
    const activeBots = bots.totals.agents5;
    const activeScripts = bots.list.filter((r) => r.cat === 'tool' && r.hits5 > 0).length;

    // Son 60 dakika, boş dakikalar sıfırla doldurulur (grafik kesintisiz olsun)
    const thisMinute = Math.floor(now / 60000) * 60000;
    const minutes = [];
    for (let i = LIVE_MINUTES - 1; i >= 0; i--) {
      const t = thisMinute - i * 60000;
      const b = live.minutes.get(t);
      minutes.push({
        t,
        requests: b?.requests || 0,
        members: b?.users.size || 0,
        guests: b?.visitors.size || 0,
      });
    }

    const since5 = now - 5 * 60000;
    const last5 = minutes.filter((m) => m.t >= since5).reduce((a, m) => a + m.requests, 0);
    const last60 = minutes.reduce((a, m) => a + m.requests, 0);

    const feed = live.feed.slice(0, 40).map((f) => ({
      ts: f.ts,
      who: f.userId ? nameOf(f.userId) : `Misafir ${f.vid}`,
      isUser: !!f.userId,
      label: f.label,
      target: entityNameOf(f.entity),
      platform: f.plat || null,
      client: f.client || null,
      suspicious: !!f.suspicious,
      path: f.path,
      failed: f.status >= 400 ? f.status : null,
    }));

    res.json({
      now,
      online,
      guests,
      activeVisitors,
      minutes,
      feed,
      platforms,
      bots,
      totals: {
        onlineUsers: online.length, activeVisitors, activeBots, activeScripts, last5, last60,
        // Son bir saatte tarayıcı olmayan istemciden gelen kayıt/giriş denemesi
        suspiciousAuth: live.feed.filter((f) => f.suspicious).length,
      },
    });
  } catch (e) {
    console.error('Admin live error:', e);
    res.status(500).json({ error: 'Canlı veriler alınamadı.' });
  }
});

app.get('/api/admin/analytics', isAdmin, async (req, res) => {
  try {
    const [usersDaily, teamsDaily, teamJoinsDaily, trainingsDaily, joinsDaily,
           usersWeekly, teamsWeekly, teamJoinsWeekly, trainingsWeekly, joinsWeekly,
           usersMonthly, teamsMonthly, teamJoinsMonthly, trainingsMonthly, joinsMonthly,
           totals] = await Promise.all([
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM teams WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM activity_logs WHERE event_type = 'team_join' AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM trainings WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE(COALESCE(created_at, NOW()) AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM training_attendees WHERE COALESCE(created_at, NOW()) >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM users WHERE created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM teams WHERE created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM activity_logs WHERE event_type = 'team_join' AND created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM trainings WHERE created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', COALESCE(created_at, NOW()) AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM training_attendees WHERE COALESCE(created_at, NOW()) >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM users WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM teams WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM activity_logs WHERE event_type = 'team_join' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM trainings WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', COALESCE(created_at, NOW()) AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM training_attendees WHERE COALESCE(created_at, NOW()) >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users     WHERE created_at >= CURRENT_DATE) as today_users,
          (SELECT COUNT(*) FROM teams     WHERE created_at >= CURRENT_DATE) as today_teams,
          (SELECT COUNT(*) FROM activity_logs WHERE event_type='team_join' AND created_at >= CURRENT_DATE) as today_team_joins,
          (SELECT COUNT(*) FROM trainings WHERE created_at >= CURRENT_DATE) as today_trainings,
          (SELECT COUNT(*) FROM users     WHERE created_at >= DATE_TRUNC('week',  NOW())) as week_users,
          (SELECT COUNT(*) FROM teams     WHERE created_at >= DATE_TRUNC('week',  NOW())) as week_teams,
          (SELECT COUNT(*) FROM activity_logs WHERE event_type='team_join' AND created_at >= DATE_TRUNC('week',NOW())) as week_team_joins,
          (SELECT COUNT(*) FROM trainings WHERE created_at >= DATE_TRUNC('week',  NOW())) as week_trainings,
          (SELECT COUNT(*) FROM users     WHERE created_at >= DATE_TRUNC('month', NOW())) as month_users,
          (SELECT COUNT(*) FROM teams     WHERE created_at >= DATE_TRUNC('month', NOW())) as month_teams,
          (SELECT COUNT(*) FROM activity_logs WHERE event_type='team_join' AND created_at >= DATE_TRUNC('month',NOW())) as month_team_joins,
          (SELECT COUNT(*) FROM trainings WHERE created_at >= DATE_TRUNC('month', NOW())) as month_trainings,
          (SELECT COUNT(*) FROM training_attendees WHERE COALESCE(created_at,NOW()) >= CURRENT_DATE) as today_joins,
          (SELECT COUNT(*) FROM training_attendees WHERE COALESCE(created_at,NOW()) >= DATE_TRUNC('week',NOW())) as week_joins,
          (SELECT COUNT(*) FROM training_attendees WHERE COALESCE(created_at,NOW()) >= DATE_TRUNC('month',NOW())) as month_joins
      `),
    ]);

    // Build daily array (last 30 days)
    const dailyMap = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, users: 0, teams: 0, teamJoins: 0, trainings: 0, joins: 0 };
    }
    const toKey = (val) => val?.toISOString?.()?.slice(0,10) || String(val).slice(0,10);
    usersDaily.rows.forEach(r      => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].users     = parseInt(r.count); });
    teamsDaily.rows.forEach(r      => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].teams     = parseInt(r.count); });
    teamJoinsDaily.rows.forEach(r  => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].teamJoins = parseInt(r.count); });
    trainingsDaily.rows.forEach(r  => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].trainings = parseInt(r.count); });
    joinsDaily.rows.forEach(r      => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].joins     = parseInt(r.count); });

    // Weekly map
    const weeklyMap = {};
    const toWeekKey = (val) => val?.toISOString?.()?.slice(0,10) || String(val).slice(0,10);
    const ensureWeek  = (k) => { weeklyMap[k]  = weeklyMap[k]  || { date: k, users: 0, teams: 0, teamJoins: 0, trainings: 0, joins: 0 }; };
    usersWeekly.rows.forEach(r      => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].users     = parseInt(r.count); });
    teamsWeekly.rows.forEach(r      => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].teams     = parseInt(r.count); });
    teamJoinsWeekly.rows.forEach(r  => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].teamJoins = parseInt(r.count); });
    trainingsWeekly.rows.forEach(r  => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].trainings = parseInt(r.count); });
    joinsWeekly.rows.forEach(r      => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].joins     = parseInt(r.count); });

    // Monthly map
    const monthlyMap = {};
    const toMonthKey = (val) => val?.toISOString?.()?.slice(0,7) || String(val).slice(0,7);
    const ensureMonth = (k) => { monthlyMap[k] = monthlyMap[k] || { date: k, users: 0, teams: 0, teamJoins: 0, trainings: 0, joins: 0 }; };
    usersMonthly.rows.forEach(r      => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].users     = parseInt(r.count); });
    teamsMonthly.rows.forEach(r      => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].teams     = parseInt(r.count); });
    teamJoinsMonthly.rows.forEach(r  => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].teamJoins = parseInt(r.count); });
    trainingsMonthly.rows.forEach(r  => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].trainings = parseInt(r.count); });
    joinsMonthly.rows.forEach(r      => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].joins     = parseInt(r.count); });

    const t = totals.rows[0];
    res.json({
      daily:   Object.values(dailyMap),
      weekly:  Object.values(weeklyMap).sort((a,b)  => a.date.localeCompare(b.date)),
      monthly: Object.values(monthlyMap).sort((a,b) => a.date.localeCompare(b.date)),
      totals: {
        today: { users: parseInt(t.today_users), teams: parseInt(t.today_teams), teamJoins: parseInt(t.today_team_joins), trainings: parseInt(t.today_trainings), joins: parseInt(t.today_joins) },
        week:  { users: parseInt(t.week_users),  teams: parseInt(t.week_teams),  teamJoins: parseInt(t.week_team_joins),  trainings: parseInt(t.week_trainings),  joins: parseInt(t.week_joins)  },
        month: { users: parseInt(t.month_users), teams: parseInt(t.month_teams), teamJoins: parseInt(t.month_team_joins), trainings: parseInt(t.month_trainings), joins: parseInt(t.month_joins) },
      },
    });
  } catch (e) {
    console.error('admin analytics error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Gerçek sağlık kontrolü: veritabanına da dokunur.
// Ana sayfa statik HTML döndürdüğü için DB çökse bile 200 verir; bu uçtan uca
// kontrol olmadan izleme aracı arızayı göremez. DB'ye ulaşılamazsa 503 döner.
// ── TRAINING AGENTS ENTEGRASYONU ─────────────────────────────────────────
// Training Agents (trainingagentsapp.com) yapay zekayla bir antrenman yazar:
// adı ve tarihi vardır. Antrenör "Muuvlink'te yayınla" deyince imzalı bir
// bağlantıyla buraya gelir, saat/konum/takım seçip yayınlar.
//
// NEDEN sunucular arası API değil: yayınlayan, Muuvlink'te oturumu zaten açık
// olan antrenörün kendisi. Hesap eşleştirmeye, taslak kutusuna, iki sunucunun
// birbirini tanımasına gerek yok — ve ağ yolundaki aksaklıklar düşünülürse
// yeni bir sunucular arası bağımlılık eklememek ayrıca iyi.
//
// NEDEN imzalı: formda "Training Agents'tan geldi" rozeti gösteriyoruz, bu bir
// doğruluk iddiası. İçerik ASLA ham URL'den okunmaz; burada doğrulanır.
// algorithms açıkça HS256'ya sabitlenir (alg=none saldırısına karşı).
const TA_SHARED_SECRET = process.env.TA_SHARED_SECRET || '';
const TA_ISSUER = 'training-agents';
const TA_MAX_SESSIONS = 20;

// Kontrol karakterleri ve yön değiştirme işaretleri gider; satır sonu KALIR
// (antrenman metni çok satırlı). Sonraki adım satır sonu dışındaki ardışık
// boşlukları teke indirir.
const TA_STRIP_RE = new RegExp('[\\u0000-\\u0009\\u000B-\\u001F\\u007F\\u200B-\\u200F\\u2028\\u2029]', 'g');
const taClean = (v, max) => String(v ?? '')
  .replace(/\r\n/g, '\n')
  .replace(TA_STRIP_RE, '')
  .replace(/[^\S\n]+/g, ' ')
  .trim()
  .slice(0, max);

// Tek antrenman → temizlenmiş kayıt, geçersizse null.
// Takım, saat, konum, kontenjan ve ücret alanları BİLEREK yok: onları
// Muuvlink'te antrenör seçer. Dışarıdan gelen veri form doldurur, karar vermez.
const taSession = (s) => {
  const title = taClean(s?.title, 120);
  const date = String(s?.date ?? '').slice(0, 10);
  if (!title) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  const dur = parseInt(s?.duration_minutes, 10);
  return {
    title,
    date,
    description: taClean(s?.description, 2000),
    duration_minutes: Number.isFinite(dur) && dur >= 15 && dur <= 480 ? dur : 60,
    sport: taClean(s?.sport, 40) || null,
  };
};

// Bağlantıyı doğrula ve temiz içeriği dön. Kimlik doğrulaması İSTEMEZ:
// hesabı olmayan ya da çıkış yapmış antrenör de ne getirdiğini görebilmeli;
// giriş/kayıt ondan sonra geliyor.
app.post('/api/integrations/training-agents/verify', async (req, res) => {
  if (!TA_SHARED_SECRET) {
    console.error('[TA] TA_SHARED_SECRET tanımli degil - entegrasyon kapali.');
    return res.status(503).json({ error: 'Bu entegrasyon şu anda kapalı.', code: 'ta_disabled' });
  }
  const token = String(req.body?.token || '');
  if (!token) return res.status(400).json({ error: 'Bağlantı eksik.', code: 'ta_invalid' });

  let payload;
  try {
    payload = jwt.verify(token, TA_SHARED_SECRET, { algorithms: ['HS256'], issuer: TA_ISSUER });
  } catch (e) {
    const expired = e?.name === 'TokenExpiredError';
    return res.status(400).json({
      error: expired ? 'Bu bağlantının süresi dolmuş.' : 'Bu bağlantı geçersiz.',
      code: expired ? 'ta_expired' : 'ta_invalid',
    });
  }
  // Süresiz jeton kabul edilmez: bağlantı adres çubuğunda ve sunucu günlüğünde
  // iz bırakıyor, sonsuza kadar geçerli olmamalı.
  if (!payload?.exp) return res.status(400).json({ error: 'Bu bağlantı geçersiz.', code: 'ta_invalid' });

  const raw = Array.isArray(payload?.sessions) ? payload.sessions : [];
  const sessions = raw.slice(0, TA_MAX_SESSIONS).map(taSession).filter(Boolean);
  if (!sessions.length) {
    return res.status(400).json({ error: 'Bağlantıda geçerli bir antrenman yok.', code: 'ta_empty' });
  }
  res.json({ sessions, source: 'training-agents' });
});

// Canlı akış için sayfa bildirimi. Tüm iş yukarıdaki izleme ara katmanında
// bitiyor; burada yalnız 404 olmasın diye boş bir yanıt dönüyoruz. Veritabanına
// dokunmaz, gövde yazmaz, kimlik doğrulaması istemez (misafirler de sayılır).
app.get('/api/live/view', (req, res) => res.status(204).end());

app.get('/api/health', async (req, res) => {
  const started = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', dbLatencyMs: Date.now() - started });
  } catch (err) {
    console.error('[HEALTH] DB erişilemiyor:', err.message);
    res.status(503).json({ status: 'degraded', db: 'error', dbLatencyMs: Date.now() - started });
  }
});

// Resim URL'sinden baskın rengi çıkar (frontend CORS sorununu bypass eder)
app.get('/api/color-extract', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'Geçersiz URL' });
  try {
    const sharp = require('sharp');
    const https = require('https');
    const http  = require('http');
    const fetch = (u) => new Promise((resolve, reject) => {
      const mod = u.startsWith('https') ? https : http;
      mod.get(u, r => {
        const chunks = [];
        r.on('data', d => chunks.push(d));
        r.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    const buf = await fetch(url);
    // 16x16'ya küçült, ham piksel olarak al
    const { data, info } = await sharp(buf)
      .resize(16, 16, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 3) {
      const pr = data[i], pg = data[i+1], pb = data[i+2];
      if (Math.max(pr,pg,pb) > 245 && Math.min(pr,pg,pb) > 220) continue; // beyaz
      if (Math.max(pr,pg,pb) < 15) continue;                               // siyah
      r += pr; g += pg; b += pb; n++;
    }

    if (n < 4) return res.json({ color: null });

    // Ham ortalama — boost yok (parlak renkleri karartma)
    const ar = Math.round(r/n), ag = Math.round(g/n), ab = Math.round(b/n);
    const hex = `#${[ar,ag,ab].map(c => c.toString(16).padStart(2,'0')).join('')}`;
    res.set('Cache-Control', 'public, max-age=86400');
    res.json({ color: hex });
  } catch (err) {
    console.error('color-extract error:', err.message);
    res.json({ color: null });
  }
});

// =====================================================
// START SERVER
// =====================================================

// DB migrations
pool.query(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id         SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name  TEXT,
    meta       JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    source_ref TEXT UNIQUE  -- backfill kayıtları için benzersiz ref (örn: 'user_1'), canlı kayıtlar NULL
  )
`).catch(() => {});

// source_ref sütunu yoksa ekle (eski kurulumlar için)
pool.query(`ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS source_ref TEXT`).catch(() => {});
pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS activity_logs_source_ref_idx ON activity_logs(source_ref) WHERE source_ref IS NOT NULL`).catch(() => {});
// training_attendees ve team_members tablolarına created_at ekle (yoksa)
pool.query(`ALTER TABLE training_attendees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`).catch(() => {});
// Etkinliğin spor dalı — hem bireysel hem takım etkinlikleri için (takım etkinliğinde
// takımın dalları arasından seçilir; yoksa geriye dönük olarak team_sport'a düşülür).
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS sport TEXT`).catch(() => {});
// Ücretli etkinlik (panelden eklenen yarış vb.). Normal etkinlik akışında ve haritada
// görünür ama uygulama içi katılım yerine dış "Kayıt Ol" linkine yönlendirir.
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false`).catch(() => {});
// Kullanıcının arayüz dili. BOŞ = hiç seçmedi → e-posta/bildirim Türkçe (eski davranış).
// Yalnız kayıt olurken ya da dili elle değiştirince yazılır; mevcut hesaplar boş kalır.
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lang VARCHAR(5)`).catch(() => {});
// Admin'in "büyüme maili" gönderimleri: hangi takım/etkinlik, ne zaman, kaç kişiye.
pool.query(`CREATE TABLE IF NOT EXISTS grow_email_log (
    id SERIAL PRIMARY KEY,
    kind VARCHAR(10) NOT NULL,          -- 'team' | 'training'
    ref_id INTEGER NOT NULL,
    sent_by INTEGER,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recipients INTEGER NOT NULL DEFAULT 0,  -- gönderilen
    skipped INTEGER NOT NULL DEFAULT 0      -- tercihinden kapatmış
  )`)
  .then(() => pool.query('CREATE INDEX IF NOT EXISTS grow_email_log_ref ON grow_email_log (kind, ref_id, sent_at DESC)'))
  .catch((e) => console.error('grow_email_log:', e.message));
// Organizatör etkinliği (admin panelinden ya da yarış keşfinden eklenen, dış
// kayıt linkiyle çalışan etkinlik). ÜCRET AYRI BİR ŞEY: is_paid yalnız ücretli
// olup olmadığını söyler, bu bayrak da etkinliğin türünü. Eski satırların hepsi
// ücretliydi, onlar işaretlenir.
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS is_organizer_event BOOLEAN DEFAULT false`)
  .then(() => pool.query(`UPDATE trainings SET is_organizer_event = true WHERE is_paid = true AND is_organizer_event IS NOT TRUE`))
  .catch(() => {});
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS registration_url TEXT`).catch(() => {});
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS image_url TEXT`).catch(() => {});
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS organizer TEXT`).catch(() => {});
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS registration_clicks INT DEFAULT 0`).catch(() => {});
// Öne çıkarma: yalnız admin panelinden açılıp kapanır. Etkinlikler sayfasında
// süzgeçlerden bağımsız olarak en üstte "Öne çıkan etkinlikler" başlığıyla gösterilir.
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
pool.query(`ALTER TABLE trainings ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ`).catch(() => {});
// Takımın spor dalları (çoklu). Eski takımlar için tekil sport'tan doldur.
pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS sports TEXT[]`).catch(() => {});
pool.query(`UPDATE teams SET sports = ARRAY[sport] WHERE (sports IS NULL OR array_length(sports,1) IS NULL) AND sport IS NOT NULL`).catch(() => {});

// Hesap silme = soft-delete. deleted_at doluysa hesap "silinmeye zamanlanmış"tır;
// 30 gün içinde giriş yapılırsa geri gelir, sonra purge ile kalıcı silinir.
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`).catch(() => {});

// Ayrılış kaydı — kullanıcı satırı purge ile silindikten sonra da istatistik kalsın.
// KİŞİSEL VERİ YOK: isim/e-posta tutulmaz. user_id yalnızca 30 günlük bekleme
// sırasında durur (geri gelirse eşleştirmek için); geri gelince ya da purge'de NULL olur.
pool.query(`
  CREATE TABLE IF NOT EXISTS account_departures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    source VARCHAR(10) NOT NULL DEFAULT 'self',
    signed_up_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    restored_at TIMESTAMPTZ,
    purged_at TIMESTAMPTZ
  )
`).then(() => pool.query(`
  INSERT INTO account_departures (user_id, source, signed_up_at, left_at)
  SELECT u.id, 'self', u.created_at, u.deleted_at FROM users u
  WHERE u.deleted_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM account_departures d WHERE d.user_id = u.id AND d.restored_at IS NULL)
`)).catch((e) => console.error('[DEPARTURES] Tablo hazırlanamadı:', e.message));

// Ayrılma nedeni (isteğe bağlı, Hesabımı sil penceresi — 5 Ekim 2026). Kod
// account_departures'a da yazılır (kişisel veri değil, purge'den sonra sayı kalır);
// "Diğer" metni YALNIZ users.leave_note'ta durur, hesapla birlikte purge'de silinir.
const LEAVE_REASONS = ['no_local', 'no_sport', 'too_many_notifs', 'hard_to_use', 'other_app', 'just_looking', 'other'];
pool.query(`ALTER TABLE account_departures ADD COLUMN IF NOT EXISTS reason VARCHAR(20)`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS leave_reason VARCHAR(20), ADD COLUMN IF NOT EXISTS leave_note VARCHAR(200)`).catch(() => {});

// Bildirim tercihleri: { key: { app: bool, email: bool } }. Varsayılan app AÇIK, e-posta KAPALI.
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_prefs JSONB DEFAULT '{}'::jsonb`).catch(() => {});

// Tanıtım turu (onboarding): kişi başına BİR kez gösterilir. localStorage yerine
// hesapta tutulur → cihaz değişse/uygulama silinse de tekrar açılmaz.
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT false`).catch(() => {});
pool.query(`ALTER TABLE team_members      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`).catch(() => {});

// Kazanım kaynağı: kaydın hangi reklamdan/kanaldan geldiği. Meta "50 kayıt
// geldi" der ama o kayıtların kaçının gerçekten etkinliğe katıldığını sadece
// burada görebiliriz — gerçek kullanıcı edinme maliyeti bu kolonlardan çıkar.
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_source TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_medium TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_campaign TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_content TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_term TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fbclid TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_platform TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS landing_page TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer TEXT`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS users_utm_source_idx ON users(utm_source) WHERE utm_source IS NOT NULL`).catch(() => {});

// ── Meta Conversions API ─────────────────────────────────────────────────
// Tarayıcıdaki pixel olayların %30-50'sini kaybeder: iOS izleme engeli,
// reklam engelleyiciler, sekmenin erken kapanması. Sunucudan giden olay
// bunlardan etkilenmez, çünkü kullanıcının tarayıcısından geçmez.
//
// İkisi BİRLİKTE çalışır, biri diğerinin yerine geçmez. Aynı event_id'yi
// taşıdıkları için Meta tekilleştirir. Taşımazlarsa dönüşüm ÇİFT sayılır:
// rapor şişer, algoritma yanlış öğrenir, bütçe yanlış yere akar.
//
// Anahtarlar tanımlı değilse tüm gönderim sessizce atlanır — pixel
// kurulmadan önceki dönemde ve yerel geliştirmede güvenli.
const META_PIXEL_ID = process.env.META_PIXEL_ID || '';
const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || '';
const META_API_VERSION = 'v23.0';
const META_ENABLED = Boolean(META_PIXEL_ID && META_CAPI_TOKEN);

if (!META_ENABLED) {
  console.log('[Meta CAPI] META_PIXEL_ID / META_CAPI_TOKEN tanımlı değil — sunucu taraflı olay gönderimi kapalı.');
}

/** Meta kişisel veriyi yalnızca SHA-256 hash'lenmiş kabul eder. */
function metaHash(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Telefon E.164 rakamlarına indirgenir. Ülke kodu belirsizse GÖNDERİLMEZ:
 * yanlış normalize edilmiş numara eşleşmez, üstelik eşleşme kalitesini düşürür.
 */
function metaHashPhone(phone) {
  if (!phone) return null;
  const raw = String(phone).trim();
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    // Zaten uluslararası biçimde
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = `90${digits.slice(1)}`;      // 0 5xx xxx xx xx → TR
  } else if (digits.length === 10) {
    digits = `90${digits}`;               // 5xx xxx xx xx → TR
  } else if (!digits.startsWith('90')) {
    return null;                          // ülke kodu belirsiz — gönderme
  }
  return digits.length >= 11 ? crypto.createHash('sha256').update(digits).digest('hex') : null;
}

/**
 * Tarayıcıdan gelen eşleşme sinyallerini istekten toplar.
 * `_fbp`/`_fbc` Meta'nın kişiyi tanımasındaki en güçlü sinyallerdir;
 * bunlar olmadan eşleşme kalitesi (EMQ) belirgin şekilde düşer.
 */
function metaSignalsFrom(req) {
  const body = req.body || {};
  return {
    eventId: body._eid || null,
    fbp: body._fbp || null,
    fbc: body._fbc || null,
    sourceUrl: body._url || null,
    platform: body._src || null,
    clientIp: req.ip || null,
    userAgent: req.get('user-agent') || null,
  };
}

/**
 * Olayı Meta'ya gönderir. Bilerek `await` edilmeden çağrılır — ölçüm
 * kullanıcının isteğini yavaşlatmamalı ve Meta'daki bir arıza uygulamayı
 * etkilememeli.
 */
async function sendMetaEvent(eventName, opts = {}) {
  if (!META_ENABLED) return;

  const {
    eventId, userId, email, phone, firstName,
    fbp, fbc, clientIp, userAgent, sourceUrl,
    platform, customData,
  } = opts;

  const userData = {};
  const em = metaHash(email);
  if (em) userData.em = [em];
  const ph = metaHashPhone(phone);
  if (ph) userData.ph = [ph];
  const fn = metaHash(firstName);
  if (fn) userData.fn = [fn];
  // external_id: aynı kişiyi cihazlar arasında birleştirir.
  const ext = metaHash(userId);
  if (ext) userData.external_id = [ext];
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  // Hiçbir tanımlayıcı yoksa olay eşleşemez — göndermek boş yere kota harcar.
  if (!userData.em && !userData.external_id && !userData.fbp && !userData.fbc) return;

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: platform && platform !== 'web' ? 'app' : 'website',
    user_data: userData,
  };
  if (eventId) event.event_id = eventId;
  if (sourceUrl) event.event_source_url = sourceUrl;
  if (customData && Object.keys(customData).length) event.custom_data = customData;

  const payload = { data: [event], access_token: META_CAPI_TOKEN };
  if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;

  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn(`[Meta CAPI] ${eventName} reddedildi (${response.status}): ${detail.slice(0, 300)}`);
    } else if (META_TEST_EVENT_CODE) {
      console.log(`[Meta CAPI] ${eventName} gönderildi (test modu, event_id=${eventId || '-'})`);
    }
  } catch (err) {
    console.warn(`[Meta CAPI] ${eventName} gönderilemedi: ${err.message}`);
  }
}

/** Çağrı yerlerini kısaltmak için: hata yutulur, akış beklemez. */
function trackMeta(eventName, opts) {
  sendMetaEvent(eventName, opts).catch(() => {});
}

// source_ref: olay başına BENZERSİZ anahtar (ör. 'user_register_42').
// Tabloda source_ref üzerinde partial unique index var; aynı olayın ikinci kez
// yazılmasını veritabanı seviyesinde engeller. Yalnızca "varlık başına bir kez"
// olabilen olaylarda verilir (kayıt/takım kurma/etkinlik oluşturma).
// Tekrarlanabilen olaylarda (katıl/ayrıl) boş bırakılır.
async function logActivity(event_type, user_id, user_name, meta = {}, source_ref = null) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (event_type, user_id, user_name, meta, source_ref) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
      [event_type, user_id || null, user_name || null, JSON.stringify(meta), source_ref]
    );
  } catch (e) { /* sessiz */ }
}

// Silinen takım/etkinlik kaydı. Takım ve etkinlik KALICI siliniyor (kullanıcıdaki gibi
// 30 günlük bekleme yok); satır gidince adı da gidiyordu. Panelde "silindi" olarak
// görünebilmesi için olay activity_logs'a yazılır. Geri getirme YOK — yalnızca kayıt.
// source_ref benzersiz: aynı silme iki kez yazılmaz (geriye dönük doldurma da güvenli).
async function logDeletion(kind, { id, name, meta = {} }, userId, source) {
  try {
    let userName = null;
    if (userId) {
      const u = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
      userName = u.rows[0]?.name || null;
    }
    await logActivity(`${kind}_delete`, userId || null, userName,
      { ...meta, id: Number(id), name: name || null, source },
      `${kind}_delete_${id}`);
  } catch { /* silme akışı asla bozulmasın */ }
}

// ── Geçmiş verilerini activity_logs'a yükle (idempotent) ──────────────────
async function backfillActivityLogs() {
  try {
    // Unique index'in hazır olmasını bekle
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS activity_logs_source_ref_idx ON activity_logs(source_ref) WHERE source_ref IS NOT NULL`).catch(() => {});

    // Kullanıcı kayıtları
    await pool.query(`
      INSERT INTO activity_logs (event_type, user_id, user_name, meta, created_at, source_ref)
      SELECT 'user_register', u.id, u.name,
             json_build_object('email', u.email),
             u.created_at,
             'user_register_' || u.id
      FROM users u
      WHERE NOT EXISTS (SELECT 1 FROM activity_logs al WHERE al.source_ref = 'user_register_' || u.id::text)
    `);

    // Takım oluşturma (owner)
    await pool.query(`
      INSERT INTO activity_logs (event_type, user_id, user_name, meta, created_at, source_ref)
      SELECT 'team_create', tm.user_id, u.name,
             json_build_object('team_name', t.name, 'sport', t.sport),
             t.created_at,
             'team_create_' || t.id
      FROM teams t
      JOIN team_members tm ON tm.team_id = t.id AND tm.role = 'owner'
      JOIN users u ON u.id = tm.user_id
      WHERE NOT EXISTS (SELECT 1 FROM activity_logs al WHERE al.source_ref = 'team_create_' || t.id::text)
    `);

    // Takıma katılma: team_members.created_at güvenilir değil (ALTER TABLE sırasında atandı)
    // Bu yüzden backfill yapılmıyor; gerçek zamanlı logActivity() kayıtları kullanılıyor.
    // Yanlış timestamp'li eski backfill kayıtlarını temizle:
    await pool.query(`DELETE FROM activity_logs WHERE source_ref LIKE 'team_join_%'`).catch(() => {});

    // Etkinlik oluşturma
    await pool.query(`
      INSERT INTO activity_logs (event_type, user_id, user_name, meta, created_at, source_ref)
      SELECT 'training_create', tm.user_id, u.name,
             json_build_object('training_title', tr.title, 'team_name', t.name),
             tr.created_at,
             'training_create_' || tr.id
      FROM trainings tr
      JOIN teams t ON t.id = tr.team_id
      JOIN team_members tm ON tm.team_id = t.id AND tm.role = 'owner'
      JOIN users u ON u.id = tm.user_id
      WHERE NOT EXISTS (SELECT 1 FROM activity_logs al WHERE al.source_ref = 'training_create_' || tr.id::text)
    `);

    // Etkinliğe katılma
    await pool.query(`
      INSERT INTO activity_logs (event_type, user_id, user_name, meta, created_at, source_ref)
      SELECT 'training_join', ta.user_id, u.name,
             json_build_object('training_title', tr.title),
             COALESCE(ta.created_at, NOW()),
             'training_join_' || ta.id
      FROM training_attendees ta
      JOIN users u ON u.id = ta.user_id
      JOIN trainings tr ON tr.id = ta.training_id
      WHERE NOT EXISTS (SELECT 1 FROM activity_logs al WHERE al.source_ref = 'training_join_' || ta.id::text)
    `);

    console.log('[backfill] activity_logs güncellendi.');
  } catch (e) {
    console.error('[backfill] Hata:', e.message);
  }
}

// Backfill ARTIK OTOMATİK ÇALIŞMIYOR.
// Görevi tek seferlikti: canlı loglama öncesindeki geçmiş kayıtları içeri almak.
// Her açılışta çalıştığında, canlı logActivity() satırlarını (source_ref boş
// olduğu için) göremeyip aynı olayı ikinci kez yazıyordu → admin panelinde
// kayıtlar "çifter çifter" görünüyordu. Artık her olay canlı loglanıyor ve
// source_ref ile benzersiz; yeniden çalıştırmaya gerek yok.
// Gerekirse elle çağrılabilir: RUN_BACKFILL=1 ile başlat.
if (process.env.RUN_BACKFILL === '1') setTimeout(backfillActivityLogs, 3000);

pool.query(`
  CREATE TABLE IF NOT EXISTS home_news (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    date_label  TEXT DEFAULT '',
    icon        TEXT DEFAULT '',
    bg          TEXT DEFAULT 'linear-gradient(160deg,#1a3a2a 0%,#2d6a4f 100%)',
    views       INTEGER DEFAULT 0,
    comments    INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});
pool.query(`
  CREATE TABLE IF NOT EXISTS home_gallery (
    id          SERIAL PRIMARY KEY,
    icon        TEXT DEFAULT '',
    bg          TEXT DEFAULT 'linear-gradient(160deg,#0f2a1a,#1a4a2d)',
    is_active   BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});
pool.query(`ALTER TABLE home_news     ADD COLUMN IF NOT EXISTS image_url    TEXT DEFAULT NULL`).catch(() => {});
pool.query(`ALTER TABLE home_news     ADD COLUMN IF NOT EXISTS description  TEXT DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE home_gallery  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS mottos JSONB DEFAULT '[]'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_primary_url TEXT DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_secondary_url TEXT DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_1 TEXT DEFAULT '#114956'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_2 TEXT DEFAULT '#643e87'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS title_color TEXT DEFAULT '#ffffff'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle_color TEXT DEFAULT 'rgba(186,230,253,0.75)'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_primary_text_en TEXT DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_primary_text_de TEXT DEFAULT ''`).catch(() => {});
pool.query(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

// =====================================================
// ŞİFRE SIFIRLAMA
// =====================================================

// Şifremi unuttum — token üret, e-posta gönder
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-posta gerekli.' });
  try {
    const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
    // Güvenlik: kullanıcı bulunsun ya da bulunmasın aynı yanıtı dön
    if (result.rows.length === 0) return res.json({ message: 'E-posta gönderildi.' });

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

    // Önceki tokenları geçersiz kıl
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const resetLink = `${APP_URL}?reset_token=${token}`;
    await sendEmail({
      kind: 'password_reset',
      to: email,
      userId: user.id,
      build: (L) => ({
        subject: tm(L, 'resetSubject'),
        html: emailWrapper(`
        <h2 style="color:#114956;margin:0 0 16px">${tm(L, 'resetTitle')}</h2>
        <p style="color:#334155;margin:0 0 12px">${tm(L, 'resetHello', user.name)}</p>
        <p style="color:#334155;margin:0 0 24px">${tm(L, 'resetBody')}</p>
        <a href="${resetLink}"
           style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#114956,#0e3c47);color:#fff;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
          ${tm(L, 'btnResetPw')}
        </a>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">${tm(L, 'resetIgnore')}</p>
      `, L),
      }),
    });
    res.json({ message: 'E-posta gönderildi.' });
  } catch (err) {
    console.error('forgot-password error:', err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Şifre sıfırla — token doğrula, şifreyi güncelle
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token ve şifre gerekli.' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  try {
    const result = await pool.query(
      `SELECT prt.user_id, prt.expires_at, prt.used
       FROM password_reset_tokens prt
       WHERE prt.token = $1`,
      [token]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Geçersiz link.' });

    const { user_id, expires_at, used } = result.rows[0];
    if (used) return res.status(400).json({ error: 'Bu link daha önce kullanıldı.' });
    if (new Date() > new Date(expires_at)) return res.status(400).json({ error: 'Linkin süresi doldu.' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]);

    res.json({ message: 'Şifre başarıyla güncellendi.' });
  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// =====================================================
// ETKİNLİK HATIRLATMA CRON JOB (her gün 09:00'da çalışır)
// =====================================================

async function sendTrainingReminders() {
  try {
    for (const daysLeft of [3, 1]) {
      // "3 gün / 1 gün kaldı" hesabı etkinliğin KENDİ saat dilimindeki bugüne göre
      // yapılır — yurtdışındaki etkinlikler için doğru güne denk gelsin diye.
      const trainings = await pool.query(
        `SELECT t.*, teams.name as team_name
         FROM trainings t
         JOIN teams ON teams.id = t.team_id
         WHERE t.training_date =
           ((NOW() AT TIME ZONE COALESCE(NULLIF(t.training_timezone, ''), 'Europe/Istanbul'))::date + $1::int)`,
        [daysLeft]
      );

      for (const training of trainings.rows) {
        const members = await pool.query(
          'SELECT tm.user_id, u.email, u.name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = $1',
          [training.team_id]
        );

        for (const member of members.rows) {
          // Aynı hatırlatma daha önce gönderildi mi? Eskiden BAŞLIĞA bakılıyordu;
          // başlık artık alıcının dilinde olduğundan türe + zamana bakılır.
          // 3 gün ve 1 gün hatırlatmaları 48 saat arayla gider, 36 saat pencere
          // ikisini ayırır, aynı günkü ikinci çalışmayı engeller.
          const exists = await pool.query(
            `SELECT id FROM notifications
              WHERE user_id = $1 AND reference_id = $2 AND notification_type = 'training_reminder'
                AND created_at > NOW() - INTERVAL '36 hours'`,
            [member.user_id, training.id]
          );
          if (exists.rows.length > 0) continue;

          await createNotif(member.user_id, {
            build: (L) => ({
              title: tm(L, 'remNotifTitle', daysLeft),
              message: `${training.team_name}: ${training.title} — ${formatTrDate(training.training_date, L)}`,
            }),
            type: 'training_reminder',
            refId: training.id,
            url: `/etkinlikler?etkinlik=${training.id}`,
          });

          sendEmail({
            to: member.email,
            userId: member.user_id,
            prefKey: 'event_reminder',
            build: (L) => ({
              subject: tm(L, 'remSubject', training.team_name, daysLeft, training.title),
              html: trainingReminderEmail({
                teamName: training.team_name,
                trainingTitle: training.title,
                trainingDate: formatTrDate(training.training_date, L),
                trainingTime: training.training_time,
                location: training.location_name,
                daysLeft,
                trainingId: training.id,
              }, L),
            }),
          }).catch(e => console.error('Reminder email error:', e.message));
        }
      }
    }
    console.log('[REMINDER] Etkinlik hatırlatmaları gönderildi.');
  } catch (err) {
    console.error('[REMINDER] Hata:', err.message);
  }
}

// Her gün 09:00'da çalıştır
function scheduleDailyReminders() {
  const now = new Date();
  const next9am = new Date(now);
  next9am.setHours(9, 0, 0, 0);
  if (next9am <= now) next9am.setDate(next9am.getDate() + 1);
  const msUntil9am = next9am - now;
  setTimeout(() => {
    sendTrainingReminders();
    setInterval(sendTrainingReminders, 24 * 60 * 60 * 1000);
  }, msUntil9am);
  console.log(`[REMINDER] İlk çalışma: ${next9am.toLocaleString('tr-TR')} (${Math.round(msUntil9am/60000)} dk sonra)`);
}
scheduleDailyReminders();

// ── Harekete geçiren e-postalar (otomatik) ─────────────────────────────────
// tc: takım kurulunca · ec: etkinlik oluşturulunca · lc: etkinliğe ~24 saat
// kala boş yer varsa · te: takım 3 gün etkinliksiz kalırsa. Metinler ACT'te.
// Uçların içine konmadı: takım/etkinlik oluşturma Meta'ya dönüşüm olayı
// gönderiyor, gönderimi ayrı bir işte tutmak test etmeyi de mümkün kılıyor.
// 15 dakikada bir çalışır, pencereler dar: eski kayıtlara toplu gönderim olmaz.
// Her (tür, kayıt) activation_email_log'a ÖNCE yazılır (benzersiz) → iki kez
// gitmez. "Muuvlink'ten ipuçları" (tips) kapalıysa atlanır.
pool.query(`CREATE TABLE IF NOT EXISTS activation_email_log (
    id SERIAL PRIMARY KEY,
    kind VARCHAR(4) NOT NULL,           -- wu | tc | ec | lc | te
    ref_id INTEGER NOT NULL,            -- takım ya da etkinlik id
    user_id INTEGER,
    status VARCHAR(16) NOT NULL,        -- sent | skipped_pref | skipped_rate | skipped_recent | failed
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (kind, ref_id, user_id)
  )`).then(() => pool.query(
    // 2 Ekim 2026: etkinlik mailleri takımın tüm yöneticilerine gidiyor → kayıt
    // alıcı başına. Eski (kind, ref_id) tekilliği kaldırılır.
    `ALTER TABLE activation_email_log DROP CONSTRAINT IF EXISTS activation_email_log_kind_ref_id_key;
     CREATE UNIQUE INDEX IF NOT EXISTS activation_email_log_kind_ref_user ON activation_email_log (kind, ref_id, user_id)`))
  .catch((e) => console.error('activation_email_log:', e.message));

async function claimActivation(kind, refId, userId) {
  const r = await pool.query(
    `INSERT INTO activation_email_log (kind, ref_id, user_id, status) VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (kind, ref_id, user_id) DO NOTHING RETURNING id`, [kind, refId, userId]);
  return r.rows[0]?.id || null;
}

// Etkinlik maillerinin (ec/lc) alıcıları. Takım etkinliğinde etkinliği KİM açarsa
// açsın (MUUVLINK destek hesabı dahil) takımın yöneticileri: sahip, editör,
// antrenör, kaptan. Takımsızda oluşturan. Platform adminleri hiç almaz — destek
// hesabının açtığı etkinliğin maili kendimize gidiyordu (Melih, 2 Ekim 2026).
async function activationEventRecipients(t) {
  const r = t.team_id
    ? await pool.query(
        `SELECT DISTINCT u.id, u.email FROM team_members tm JOIN users u ON u.id = tm.user_id
          WHERE tm.team_id = $1 AND tm.role = ANY($2) AND u.deleted_at IS NULL AND u.email IS NOT NULL
            AND COALESCE(u.is_admin, false) = false`, [t.team_id, TRAINING_MANAGER_ROLES])
    : await pool.query(
        `SELECT u.id, u.email FROM users u WHERE u.id = $1 AND u.deleted_at IS NULL AND u.email IS NOT NULL
            AND COALESCE(u.is_admin, false) = false`, [t.created_by]);
  return r.rows;
}
const setActivationStatus = (id, status) =>
  pool.query('UPDATE activation_email_log SET status = $2 WHERE id = $1', [id, status]).catch(() => {});

function activationEventData(t, L) {
  const url = `${APP_URL}/etkinlik/${slugify(t.title)}-${t.id}`;
  return {
    name: t.title, url, ctaUrl: url,
    when: new Date(t.training_date).toLocaleDateString(MAIL_LOCALE[mailLang(L)], { timeZone: 'UTC', day: 'numeric', month: 'long' }),
    time: t.training_time ? String(t.training_time).slice(0, 5) : '',
    location: t.location_name || '',
    isPrivate: !!(t.team_id && t.team_private && !t.is_public),
  };
}
async function deliverActivation(logId, user, kind, buildData) {
  const r = await sendEmail({ to: user.email, userId: user.id, prefKey: 'tips', kind: `act_${kind}`,
    build: (L) => activationEmail(kind, buildData(L), L) });
  await setActivationStatus(logId, r?.skipped ? 'skipped_pref' : r ? 'sent' : 'failed');
  return r;
}

let activationRunning = false;
async function runActivationEmails() {
  if (activationRunning) return { busy: true };
  activationRunning = true;
  const stats = { wu: 0, tc: 0, ec: 0, lc: 0, te: 0 };
  try {
    const USER_OK = 'u.deleted_at IS NULL AND u.email IS NOT NULL';
    // wu — hoş geldin: son 6 saatte kayıt olanlar (en az 2 dk önce)
    const newUsers = (await pool.query(
      `SELECT u.id, u.name, u.email FROM users u
        WHERE u.created_at BETWEEN NOW() - INTERVAL '6 hours' AND NOW() - INTERVAL '2 minutes' AND ${USER_OK}
          AND NOT EXISTS (SELECT 1 FROM activation_email_log a WHERE a.kind = 'wu' AND a.ref_id = u.id)`)).rows;
    for (const u of newUsers) {
      const id = await claimActivation('wu', u.id, u.id); if (!id) continue;
      const r = await sendEmail({ to: u.email, userId: u.id, prefKey: 'tips', kind: 'act_wu', build: (L) => welcomeEmail({ name: u.name }, L) });
      await setActivationStatus(id, r?.skipped ? 'skipped_pref' : r ? 'sent' : 'failed');
      stats.wu++;
    }

    // tc — son 6 saatte kurulan takımlar (en az 10 dk önce: kurucu ilk ayarları yapsın)
    const teams = (await pool.query(
      `SELECT t.id, t.name, t.is_private, u.id AS uid, u.email FROM teams t JOIN users u ON u.id = t.owner_id
        WHERE t.created_at BETWEEN NOW() - INTERVAL '6 hours' AND NOW() - INTERVAL '10 minutes' AND ${USER_OK}
          AND NOT EXISTS (SELECT 1 FROM activation_email_log a WHERE a.kind = 'tc' AND a.ref_id = t.id)`)).rows;
    for (const t of teams) {
      const id = await claimActivation('tc', t.id, t.uid); if (!id) continue;
      const url = `${APP_URL}/takim/${slugify(t.name)}-${t.id}`;
      await deliverActivation(id, { id: t.uid, email: t.email }, 'tc', () => ({ name: t.name, url, ctaUrl: url, isPrivate: t.is_private }));
      stats.tc++;
    }

    const EV = `SELECT t.id, t.title, t.team_id, t.created_by, t.training_date, t.training_time, t.location_name, t.is_public,
                       t.capacity, teams.is_private AS team_private,
                       (SELECT COUNT(*)::int FROM training_attendees ta WHERE ta.training_id = t.id) AS attendees
                  FROM trainings t LEFT JOIN teams ON teams.id = t.team_id
                 WHERE COALESCE(t.is_organizer_event, false) = false AND COALESCE(t.is_paid, false) = false`;
    // ec — son 6 saatte oluşturulan, henüz başlamamış etkinlikler; alıcılar
    // activationEventRecipients. Aynı kişiye 7 günde en fazla bir kez (her hafta
    // etkinlik açan antrenör her seferinde almasın) — sınır kişi başına.
    const evs = (await pool.query(`${EV}
        AND t.created_at BETWEEN NOW() - INTERVAL '6 hours' AND NOW() - INTERVAL '10 minutes'
        AND ${trainingUtcExpr('t')} > NOW()
        AND NOT EXISTS (SELECT 1 FROM activation_email_log a WHERE a.kind = 'ec' AND a.ref_id = t.id)`)).rows;
    for (const t of evs) {
      for (const u of await activationEventRecipients(t)) {
        const id = await claimActivation('ec', t.id, u.id); if (!id) continue;
        const recent = (await pool.query(
          `SELECT 1 FROM activation_email_log WHERE kind = 'ec' AND user_id = $1 AND id <> $2 AND status = 'sent'
              AND sent_at > NOW() - INTERVAL '7 days' LIMIT 1`, [u.id, id])).rows.length;
        if (recent) { await setActivationStatus(id, 'skipped_rate'); continue; }
        await deliverActivation(id, u, 'ec', (L) => activationEventData(t, L));
        stats.ec++;
      }
    }

    // lc — 20–28 saat sonra başlayan, kontenjanı dolmamış etkinlikler. Aynı
    // kişiye bu etkinlik için son 24 saatte "etkinliğin yayında" gittiyse gönderilmez.
    const lcs = (await pool.query(`${EV}
        AND ${trainingUtcExpr('t')} BETWEEN NOW() + INTERVAL '20 hours' AND NOW() + INTERVAL '28 hours'
        AND NOT EXISTS (SELECT 1 FROM activation_email_log a WHERE a.kind = 'lc' AND a.ref_id = t.id)`)).rows
      .filter((t) => t.capacity && t.attendees < t.capacity);
    for (const t of lcs) {
      for (const u of await activationEventRecipients(t)) {
        const id = await claimActivation('lc', t.id, u.id); if (!id) continue;
        const justSent = (await pool.query(
          `SELECT 1 FROM activation_email_log WHERE kind = 'ec' AND ref_id = $1 AND user_id = $2 AND status = 'sent'
              AND sent_at > NOW() - INTERVAL '24 hours' LIMIT 1`, [t.id, u.id])).rows.length;
        if (justSent) { await setActivationStatus(id, 'skipped_recent'); continue; }
        await deliverActivation(id, u, 'lc', (L) => ({ ...activationEventData(t, L), spotsLeft: t.capacity - t.attendees }));
        stats.lc++;
      }
    }

    // te — 3–7 gün önce kurulmuş, hiç etkinliği olmayan takımlar (7 gün sınırı:
    // açılışta eski, terk edilmiş takımlara toplu gönderim olmasın).
    const tes = (await pool.query(
      `SELECT t.id, t.name, t.is_private, u.id AS uid, u.email FROM teams t JOIN users u ON u.id = t.owner_id
        WHERE t.created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '3 days' AND ${USER_OK}
          AND NOT EXISTS (SELECT 1 FROM trainings tr WHERE tr.team_id = t.id)
          AND NOT EXISTS (SELECT 1 FROM activation_email_log a WHERE a.kind = 'te' AND a.ref_id = t.id)`)).rows;
    for (const t of tes) {
      const id = await claimActivation('te', t.id, t.uid); if (!id) continue;
      const url = `${APP_URL}/takim/${slugify(t.name)}-${t.id}`;
      await deliverActivation(id, { id: t.uid, email: t.email }, 'te', () => ({ name: t.name, url, ctaUrl: url, isPrivate: t.is_private }));
      stats.te++;
    }
    if (stats.wu + stats.tc + stats.ec + stats.lc + stats.te) console.log('[ACTIVATION]', JSON.stringify(stats));
  } catch (e) {
    console.error('[ACTIVATION] Hata:', e.message);
  } finally {
    activationRunning = false;
  }
  return stats;
}
setTimeout(() => { runActivationEmails(); setInterval(runActivationEmails, 15 * 60 * 1000); }, 2 * 60 * 1000);

// ── Soft-delete purge — 30 günü dolan hesapları kalıcı sil ──────────────────
const ACCOUNT_PURGE_DAYS = 30;
async function purgeSoftDeletedAccounts() {
  try {
    const res = await pool.query(
      `DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '${ACCOUNT_PURGE_DAYS} days' RETURNING id`
    );
    if (res.rowCount > 0) {
      await pool.query(
        `UPDATE account_departures SET purged_at = NOW(), user_id = NULL
         WHERE user_id = ANY($1) AND purged_at IS NULL`, [res.rows.map((r) => r.id)]
      ).catch((e) => console.error('[DEPARTURES] Purge işaretleme hatası:', e.message));
    }
    if (res.rowCount > 0) console.log(`[PURGE] ${res.rowCount} hesap kalıcı silindi (${ACCOUNT_PURGE_DAYS} gün doldu).`);
  } catch (e) {
    console.error('[PURGE] Hata:', e.message);
  }
}
// Başlangıçta bir kez + günde bir çalıştır.
purgeSoftDeletedAccounts();
setInterval(purgeSoftDeletedAccounts, 24 * 60 * 60 * 1000);

// ── Engagement Reminder — pasif kullanıcılara nazik hatırlatma ──────────────
// Son 7 gündür hiç etkinlik oluşturmamış/katılmamış VE son 7 gündür bu
// hatırlatmayı almamış kullanıcılara gönderilir. Aktif kullanıcılar hiç almaz.
const ENGAGEMENT_INACTIVE_DAYS = 7;
const ENGAGEMENT_COOLDOWN_DAYS = 7;

async function sendEngagementReminders() {
  try {
    const inactiveUsers = await pool.query(
      `SELECT u.id
       FROM users u
       WHERE EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = u.id)
         AND NOT EXISTS (
           SELECT 1 FROM trainings t
           WHERE t.created_by = u.id AND t.created_at > NOW() - INTERVAL '${ENGAGEMENT_INACTIVE_DAYS} days'
         )
         AND NOT EXISTS (
           SELECT 1 FROM training_attendees ta
           WHERE ta.user_id = u.id AND ta.joined_at > NOW() - INTERVAL '${ENGAGEMENT_INACTIVE_DAYS} days'
         )
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.user_id = u.id AND n.notification_type = 'engagement_nudge'
             AND n.created_at > NOW() - INTERVAL '${ENGAGEMENT_COOLDOWN_DAYS} days'
         )`
    );

    for (const user of inactiveUsers.rows) {
      await createNotif(user.id, {
        build: (L) => ({ title: tm(L, 'nudgeTitle'), message: tm(L, 'nudgeMsg') }),
        type: 'engagement_nudge',
        url: '/etkinlikler',
      });
    }
    if (inactiveUsers.rows.length > 0) {
      console.log(`[ENGAGEMENT] ${inactiveUsers.rows.length} kullanıcıya hatırlatma gönderildi.`);
    }
  } catch (e) {
    console.error('[ENGAGEMENT] Hata:', e.message);
  }
}

// Her gün 18:00'da çalıştır
function scheduleEngagementReminders() {
  const now = new Date();
  const next6pm = new Date(now);
  next6pm.setHours(18, 0, 0, 0);
  if (next6pm <= now) next6pm.setDate(next6pm.getDate() + 1);
  const msUntil6pm = next6pm - now;
  setTimeout(() => {
    sendEngagementReminders();
    setInterval(sendEngagementReminders, 24 * 60 * 60 * 1000);
  }, msUntil6pm);
  console.log(`[ENGAGEMENT] İlk çalışma: ${next6pm.toLocaleString('tr-TR')} (${Math.round(msUntil6pm/60000)} dk sonra)`);
}
scheduleEngagementReminders();

// ── Push Token Kayıt & Bildirim ──────────────────────────────────────────────
// Tablo yoksa oluştur
pool.query(`
  CREATE TABLE IF NOT EXISTS device_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(10) NOT NULL DEFAULT 'ios',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(token)
  )
`).catch(e => console.error('[PUSH] Token tablosu oluşturulamadı:', e.message));

app.post('/api/push/register', async (req, res) => {
  const { token, platform = 'ios' } = req.body;
  if (!token) return res.status(400).json({ error: 'Token gerekli' });

  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      userId = decoded.id;
    } catch (_) {}
  }

  try {
    await pool.query(
      `INSERT INTO device_push_tokens (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (token) DO UPDATE SET user_id = $1, updated_at = NOW()`,
      [userId, token, platform]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[PUSH] Token kayıt hatası:', e.message);
    res.status(500).json({ error: 'Token kaydedilemedi' });
  }
});

// ── APNs (Apple Push Notification service) ──────────────────────────────────
let apnProvider = null;
try {
  const apnKeyPath = path.join(__dirname, 'certs', 'AuthKey_ZJKTSFFGGR.p8');
  if (fs.existsSync(apnKeyPath)) {
    apnProvider = new apn.Provider({
      token: {
        key: apnKeyPath,
        keyId: 'ZJKTSFFGGR',
        teamId: 'MZ46V34M5Y',
      },
      production: true,
    });
    console.log('[PUSH] APNs provider hazır');
  } else {
    console.warn('[PUSH] APNs key bulunamadı, push bildirimleri devre dışı:', apnKeyPath);
  }
} catch (e) {
  console.error('[PUSH] APNs provider başlatılamadı:', e.message);
}

// ── FCM (Firebase Cloud Messaging — Android) ─────────────────────────────────
let fcmReady = false;
try {
  const fcmKeyPath = path.join(__dirname, 'certs', 'firebase-service-account.json');
  if (fs.existsSync(fcmKeyPath)) {
    const admin = require('firebase-admin');
    admin.initializeApp({ credential: admin.credential.cert(require(fcmKeyPath)) });
    fcmReady = true;
    console.log('[PUSH] FCM (Android) provider hazır');
  } else {
    console.warn('[PUSH] Firebase service account bulunamadı, Android push devre dışı:', fcmKeyPath);
  }
} catch (e) {
  console.error('[PUSH] FCM provider başlatılamadı:', e.message);
}

async function sendPushToIOS(userId, { title, body, data, badge = null }) {
  if (!apnProvider) return;
  const tokensRes = await pool.query(
    `SELECT token FROM device_push_tokens WHERE user_id = $1 AND platform = 'ios'`,
    [userId]
  );
  if (tokensRes.rows.length === 0) return { ok: 0, fail: 0 };

  const notification = new apn.Notification();
  notification.alert = { title, body };
  notification.sound = 'default';
  notification.topic = 'app.muuvlink';
  notification.payload = data;
  if (badge != null) notification.badge = badge;   // uygulama ikonu rozeti (okunmamış sayısı)

  const tokens = tokensRes.rows.map(r => r.token);
  const result = await apnProvider.send(notification, tokens);

  for (const failure of result.failed) {
    if (['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(failure.response?.reason)) {
      await pool.query('DELETE FROM device_push_tokens WHERE token = $1', [failure.device]).catch(() => {});
    }
  }
  if (result.failed.length > 0) {
    console.warn('[PUSH] APNs gönderim hataları:', result.failed.map(f => f.response?.reason));
  }
  return { ok: result.sent.length, fail: result.failed.length };
}

async function sendPushToAndroid(userId, { title, body, data, badge = null }) {
  if (!fcmReady) return;
  const tokensRes = await pool.query(
    `SELECT token FROM device_push_tokens WHERE user_id = $1 AND platform = 'android'`,
    [userId]
  );
  if (tokensRes.rows.length === 0) return { ok: 0, fail: 0 };

  const admin = require('firebase-admin');
  const tokens = tokensRes.rows.map(r => r.token);
  const stringData = Object.fromEntries(
    Object.entries(data || {}).map(([k, v]) => [k, v == null ? '' : String(v)])
  );

  const message = {
    tokens,
    notification: { title, body },
    data: stringData,
  };
  // Uygulama ikonu rozet sayısı (launcher destekliyorsa)
  if (badge != null) message.android = { notification: { notificationCount: badge } };

  const result = await admin.messaging().sendEachForMulticast(message);

  result.responses.forEach((res, i) => {
    if (!res.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(res.error?.code)) {
      pool.query('DELETE FROM device_push_tokens WHERE token = $1', [tokens[i]]).catch(() => {});
    }
  });
  if (result.failureCount > 0) {
    console.warn('[PUSH] FCM gönderim hataları:', result.responses.filter(r => !r.success).map(r => r.error?.code));
  }
  return { ok: result.successCount, fail: result.failureCount };
}

// Döner: { ok, fail } — cihaz başına (iOS + Android). admin › Bildirimler için.
async function sendPushToUser(userId, { title, body, data = {}, badge = null }) {
  const out = { ok: 0, fail: 0 };
  if (!userId) return out;
  try {
    const rs = await Promise.allSettled([
      sendPushToIOS(userId, { title, body, data, badge }),
      sendPushToAndroid(userId, { title, body, data, badge }),
    ]);
    for (const r of rs) {
      if (r.status === 'fulfilled' && r.value) { out.ok += r.value.ok || 0; out.fail += r.value.fail || 0; }
      else if (r.status === 'rejected') out.fail++;
    }
  } catch (e) {
    console.error('[PUSH] Gönderim hatası:', e.message);
  }
  return out;
}

// Kullanıcının okunmamış bildirim sayısı (uygulama ikonu rozeti için)
async function getUnreadCount(userId) {
  try {
    const r = await pool.query(
      'SELECT COUNT(*)::int as c FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    return r.rows[0].c;
  } catch (_) { return 0; }
}

// Sessiz badge güncellemesi — banner göstermeden uygulama ikonu rozetini günceller
// (okundu işaretleme / bildirim silme sonrası rozetin doğru azalması için).
async function sendBadgeUpdate(userId) {
  if (!userId) return;
  try {
    const count = await getUnreadCount(userId);
    if (apnProvider) {
      const t = await pool.query(
        `SELECT token FROM device_push_tokens WHERE user_id = $1 AND platform = 'ios'`, [userId]
      );
      if (t.rows.length > 0) {
        const n = new apn.Notification();
        n.topic = 'app.muuvlink';
        n.badge = count;                 // yalnız rozet: alert/sound yok → banner çıkmaz
        n.payload = { badgeUpdate: '1' }; // ön planda toast gösterilmesin diye işaret
        await apnProvider.send(n, t.rows.map(r => r.token)).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[PUSH] Badge güncelleme hatası:', e.message);
  }
}

// Production'da Vite build çıktısını servis et
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath, {
    maxAge: 0,
    etag: true,
    lastModified: true,
    extensions: ['html'],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html') || filePath.endsWith('admin.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  app.get('/admin', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distPath, 'admin.html'));
  });
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
}

// =====================================================
// REPORT & BLOCK
// =====================================================

pool.query(`
  CREATE TABLE IF NOT EXISTS content_reports (
    id           SERIAL PRIMARY KEY,
    reporter_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'training', 'comment', 'wall_post', 'user'
    content_id   INTEGER NOT NULL,
    reason       TEXT NOT NULL,
    resolved     BOOLEAN DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

// Soft delete kolonları — yoksa ekle
pool.query(`ALTER TABLE team_posts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false`).catch(() => {});
pool.query(`ALTER TABLE training_comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false`).catch(() => {});

// Mesaj (yorum) beğenileri
pool.query(`
  CREATE TABLE IF NOT EXISTS comment_likes (
    id         SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES training_comments(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
  )
`).catch(() => {});

// Takım duvarı gönderisi beğenileri (yorum beğenileriyle aynı yapı)
pool.query(`
  CREATE TABLE IF NOT EXISTS team_post_likes (
    id         SERIAL PRIMARY KEY,
    post_id    INTEGER NOT NULL REFERENCES team_posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
  )
`).catch(() => {});

// Destek hesabı (MUUVLINK) her takıma editör olarak katılsın — böylece app olarak
// takımlara yardım edebiliriz. Trigger tüm katılım yollarını (katılma, davet kabul,
// admin ekleme) tek noktada yakalar; e-posta ile eşleşir, hesap id'si değişse de çalışır.
pool.query(`
  CREATE OR REPLACE FUNCTION muuv_support_editor() RETURNS trigger AS $$
  BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND lower(email) = 'muuvlinkapp@gmail.com') THEN
      NEW.role := 'editor';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql
  -- search_path sabitlenir: aksi halde çağıranın search_path'i ile 'users' başka
  -- bir şemaya yönlendirilebilir (Supabase linter: function_search_path_mutable).
  SET search_path = public, pg_temp;
`).then(() =>
  pool.query(`DROP TRIGGER IF EXISTS trg_muuv_support_editor ON team_members`)
).then(() =>
  pool.query(`
    CREATE TRIGGER trg_muuv_support_editor
    BEFORE INSERT ON team_members
    FOR EACH ROW EXECUTE FUNCTION muuv_support_editor()
  `)
).catch(() => {});

// Rozet açıklamalarındaki eski "antrenman" kelimesini "etkinlik" yap (rename devamı)
pool.query(`UPDATE badges SET description = REPLACE(description, 'antrenman', 'etkinlik') WHERE description LIKE '%antrenman%'`).catch(() => {});

// Yeni rozetler — yoksa ekle (isme göre idempotent)
(async () => {
  // Spor dalı kolonu — INSERT'ten ÖNCE tamamlanmalı (yoksa "column sport does not exist")
  await pool.query(`ALTER TABLE badges ADD COLUMN IF NOT EXISTS sport TEXT`).catch(() => {});
  const NEW_BADGES = [
    { name: 'Organizatör', description: '1 etkinlik oluştur',   icon: '📣', requirement_type: 'created_count',  requirement_value: 1,   sport: null },
    { name: 'Sohbetçi',    description: 'İlk mesajını gönder',  icon: '💬', requirement_type: 'comment_count',  requirement_value: 1,   sport: null },
    { name: 'Şampiyon',    description: '100 etkinlik tamamla', icon: '🥇', requirement_type: 'training_count', requirement_value: 100, sport: null },
    // ── Spor dalı rozetleri: ilgili daldaki ilk etkinliğinle açılır ──
    { name: 'Bisikletçi',  description: 'İlk bisiklet etkinliğin',  icon: '🚴', requirement_type: 'sport_count', requirement_value: 1, sport: 'Bisiklet' },
    { name: 'Koşucu',      description: 'İlk koşu etkinliğin',      icon: '🏃', requirement_type: 'sport_count', requirement_value: 1, sport: 'Koşu' },
    { name: 'Yüzücü',      description: 'İlk yüzme etkinliğin',     icon: '🏊', requirement_type: 'sport_count', requirement_value: 1, sport: 'Yüzme' },
    { name: 'Tenisçi',     description: 'İlk tenis etkinliğin',     icon: '🎾', requirement_type: 'sport_count', requirement_value: 1, sport: 'Tenis' },
    { name: 'Kanocu',      description: 'İlk kano etkinliğin',      icon: '🛶', requirement_type: 'sport_count', requirement_value: 1, sport: 'Kano' },
    { name: 'Futbolcu',    description: 'İlk futbol etkinliğin',    icon: '⚽', requirement_type: 'sport_count', requirement_value: 1, sport: 'Futbol' },
    { name: 'Basketbolcu', description: 'İlk basketbol etkinliğin', icon: '🏀', requirement_type: 'sport_count', requirement_value: 1, sport: 'Basketbol' },
    { name: 'Voleybolcu',  description: 'İlk voleybol etkinliğin',  icon: '🏐', requirement_type: 'sport_count', requirement_value: 1, sport: 'Voleybol' },
    { name: 'Yogi',        description: 'İlk yoga etkinliğin',      icon: '🧘', requirement_type: 'sport_count', requirement_value: 1, sport: 'Yoga' },
    { name: 'Kaşif',       description: 'İlk trekking etkinliğin',  icon: '🥾', requirement_type: 'sport_count', requirement_value: 1, sport: 'Trekking' },
  ];
  for (const b of NEW_BADGES) {
    await pool.query(
      `INSERT INTO badges (name, description, icon, requirement_type, requirement_value, sport)
       SELECT $1, $2, $3, $4, $5, $6
       WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = $1)`,
      [b.name, b.description, b.icon, b.requirement_type, b.requirement_value, b.sport]
    ).catch(e => console.error('Seed badge error:', b.name, e.message));
  }
})();

pool.query(`
  CREATE TABLE IF NOT EXISTS blocked_users (
    id         SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
  )
`).catch(() => {});

// ── GÜVENLİK: public şemadaki her tabloda RLS açık olsun ──────────────────
// Supabase'de `anon` rolünün public tablolarda tam yetkisi var; RLS kapalıysa
// proje URL'ini bilen herkes tabloyu Data API üzerinden okuyup değiştirebiliyor
// (Supabase bunu "rls_disabled_in_public" kritik uyarısı olarak bildiriyor).
// Uygulama açılışta tablo oluşturduğu için yeni tablolar RLS'siz doğuyor —
// bu yüzden her açılışta eksik kalanları tamamlıyoruz. Backend `postgres`
// rolüyle ve BYPASSRLS yetkisiyle bağlandığından uygulama bundan etkilenmez.
setTimeout(() => {
  pool.query(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN SELECT c.relname
               FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
        RAISE NOTICE 'RLS enabled on %', r.relname;
      END LOOP;
    END $$;
  `).catch((e) => console.error('RLS guard error:', e.message));
}, 8000);

// İçerik şikayeti
app.post('/api/report', authenticateToken, async (req, res) => {
  const { content_type, content_id, reason } = req.body;
  if (!content_type || !content_id || !reason) return res.status(400).json({ error: 'Eksik alan.' });
  try {
    await pool.query(
      'INSERT INTO content_reports (reporter_id, content_type, content_id, reason) VALUES ($1,$2,$3,$4)',
      [req.user.id, content_type, content_id, reason]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Şikayet kaydedilemedi.' });
  }
});

// Kullanıcı engelleme
app.post('/api/block/:userId', authenticateToken, async (req, res) => {
  const blockedId = parseInt(req.params.userId);
  if (blockedId === req.user.id) return res.status(400).json({ error: 'Kendinizi engelleyemezsiniz.' });
  try {
    await pool.query(
      'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, blockedId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Engelleme başarısız.' });
  }
});

// Engeli kaldır
app.delete('/api/block/:userId', authenticateToken, async (req, res) => {
  const blockedId = parseInt(req.params.userId);
  try {
    await pool.query('DELETE FROM blocked_users WHERE blocker_id=$1 AND blocked_id=$2', [req.user.id, blockedId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Engel kaldırılamadı.' });
  }
});

// Engellenen kullanıcılar listesi
app.get('/api/blocked', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT blocked_id FROM blocked_users WHERE blocker_id=$1',
      [req.user.id]
    );
    res.json({ blocked: result.rows.map(r => r.blocked_id) });
  } catch (e) {
    res.status(500).json({ blocked: [] });
  }
});

// Admin: şikayet listesi
app.get('/api/admin/flags', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, u.name AS reporter_name, u.email AS reporter_email,
        CASE
          WHEN cr.content_type = 'wall_post'  THEN (SELECT message FROM team_posts WHERE id = cr.content_id)
          WHEN cr.content_type = 'comment'    THEN (SELECT comment FROM training_comments WHERE id = cr.content_id)
          WHEN cr.content_type = 'training'   THEN (SELECT title FROM trainings WHERE id = cr.content_id)
          WHEN cr.content_type = 'user'       THEN (SELECT name FROM users WHERE id = cr.content_id)
        END AS content_preview
      FROM content_reports cr
      JOIN users u ON u.id = cr.reporter_id
      ORDER BY cr.created_at DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json([]);
  }
});

// Admin: şikayeti çözüldü işaretle
app.put('/api/admin/flags/:id/resolve', isAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE content_reports SET resolved=true WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Güncelleme başarısız.' });
  }
});

// Admin: silinen içeriği geri getir
app.post('/api/admin/flags/:id/restore', isAdmin, async (req, res) => {
  try {
    const flagRes = await pool.query('SELECT content_type, content_id FROM content_reports WHERE id=$1', [req.params.id]);
    if (!flagRes.rows[0]) return res.status(404).json({ error: 'Şikayet bulunamadı.' });
    const { content_type, content_id } = flagRes.rows[0];

    if (content_type === 'wall_post') {
      await pool.query('UPDATE team_posts SET is_deleted=false WHERE id=$1', [content_id]);
    } else if (content_type === 'comment') {
      await pool.query('UPDATE training_comments SET is_deleted=false WHERE id=$1', [content_id]);
    } else if (content_type === 'training') {
      await pool.query('UPDATE trainings SET is_deleted=false WHERE id=$1', [content_id]);
    } else if (content_type === 'user') {
      await pool.query('UPDATE users SET is_active=true WHERE id=$1', [content_id]);
    }

    await pool.query('UPDATE content_reports SET resolved=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Geri alma başarısız.' });
  }
});

// Admin: şikayet edilen içeriği sil + otomatik çözüldü işaretle
app.delete('/api/admin/flags/:id/content', isAdmin, async (req, res) => {
  try {
    const flagRes = await pool.query('SELECT content_type, content_id FROM content_reports WHERE id=$1', [req.params.id]);
    if (!flagRes.rows[0]) return res.status(404).json({ error: 'Şikayet bulunamadı.' });
    const { content_type, content_id } = flagRes.rows[0];

    if (content_type === 'wall_post') {
      await pool.query('UPDATE team_posts SET is_deleted=true WHERE id=$1', [content_id]);
    } else if (content_type === 'comment') {
      await pool.query('UPDATE training_comments SET is_deleted=true WHERE id=$1', [content_id]);
    } else if (content_type === 'training') {
      await pool.query('UPDATE trainings SET is_deleted=true WHERE id=$1', [content_id]);
    } else if (content_type === 'user') {
      await pool.query('UPDATE users SET is_active=false WHERE id=$1', [content_id]);
    }

    await pool.query('UPDATE content_reports SET resolved=true WHERE id=$1', [req.params.id]);
    res.json({ ok: true, content_type, content_id });
  } catch (e) {
    res.status(500).json({ error: 'Silme başarısız.' });
  }
});

app.listen(PORT, () => {
  console.log(`
  Muuvlink Backend API - FULL VERSION
  Server running on port ${PORT}
  📡 Environment: ${process.env.NODE_ENV || 'development'}
  💾 Database: PostgreSQL
  
  📚 API Endpoints: 60+ routes
  Routes: Auth, Teams, Trainings, Stats, Badges, Notifications, Search, Admin
  `);
});

module.exports = app;