// Saat ve spor servisi bağlantıları (9 Kasım 2026). Polar ve Wahoo; yeni marka PROVIDERS'a eklenir.
//
// Görünürlük: markanın anahtarı (POLAR_CLIENT_ID/SECRET, WAHOO_CLIENT_ID/SECRET) yoksa o marka hiç görünmez.
// Anahtar varsa önce yalnız platform adminine görünür; herkese açmak için WEARABLE_PUBLIC=1.
//
// Gizlilik metninde verilen sözler (public/en/privacy, sporla-bulusma.jsx legalWearableHtml) burada tutulur:
//  - okumadan önce ayrı açık rıza, zaman damgasıyla (wearable_consents);
//  - bağlantıyı kesince / rızayı geri alınca / hesabı silince veri, katılım teyidi ve jeton silinir;
//  - veri yalnız sahibine döner; başka hiçbir uç bu tabloları okumaz;
//  - Meta, Umami, Threshold ve bildirim sistemine saat verisi GİTMEZ (bu dosya onları çağırmaz);
//  - nabız kimseye gösterilmez. Takımla paylaşım bilerek YOK (Garmin ve Wahoo'nun cevabı bekleniyor).
const crypto = require('crypto');

const CONSENT_VERSION = '2026-11-09';
const STATE_MINUTES = 10;
const SYNC_MIN_GAP_SEC = 60;

// Polar'ın ham spor adından sitedeki branş adı (SPORT_TYPES). Eşleşmezse null: arayüz "Antrenman" yazar.
const SPORT_RULES = [
  [/triathlon/, 'Triatlon'], [/run|jog/, 'Koşu'], [/cycl|bik|spinning/, 'Bisiklet'], [/swim/, 'Yüzme'],
  [/walk/, 'Yürüyüş'], [/trek|hik/, 'Trekking'], [/row/, 'Kürek'], [/canoe|kayak|paddl/, 'Kano'],
  [/padel/, 'Padel'], [/tennis/, 'Tenis'], [/football|soccer/, 'Futbol'], [/basket/, 'Basketbol'],
  [/volley/, 'Voleybol'], [/yoga/, 'Yoga'], [/pilates/, 'Pilates'], [/crossfit/, 'Crossfit'],
];
function sportFromRaw(raw) {
  const s = String(raw || '').toLowerCase();
  for (const [re, name] of SPORT_RULES) if (re.test(s)) return name;
  return null;
}

// "PT1H14M23S" → 4463
function parseIsoDuration(v) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(v || '');
  if (!m) return null;
  const sec = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return sec > 0 ? Math.round(sec) : null;
}

// Polar başlangıcı sporcunun yerel saatiyle, ayrı bir UTC farkıyla verir.
function polarToActivity(e) {
  if (!e || !e.id || !e['start-time']) return null;
  const offset = typeof e['start-time-utc-offset'] === 'number' ? e['start-time-utc-offset'] : 0;
  const localMs = Date.parse(`${e['start-time']}Z`);
  if (Number.isNaN(localMs)) return null;
  const raw = e['detailed-sport-info'] || e.sport || '';
  return {
    external_id: String(e.id),
    started_at: new Date(localMs - offset * 60000).toISOString(),
    duration_sec: parseIsoDuration(e.duration),
    distance_m: typeof e.distance === 'number' ? Math.round(e.distance) : null,
    avg_hr: Number.isFinite(e['heart-rate']?.average) ? Math.round(e['heart-rate'].average) : null,
    sport: sportFromRaw(raw),
  };
}

// Wahoo'nun antrenman türü numarasından sitedeki branş adı. Ada göre eşlenmez: WALKING_TREADMILL "treadmill"
// üzerinden koşu, BIKING_MOTOCYCLING "bik" üzerinden bisiklet olurdu.
const WAHOO_SPORTS = [
  ['Bisiklet', [0, 11, 12, 13, 14, 15, 16, 21, 49, 61, 64, 68, 70]],
  ['Koşu', [1, 3, 4, 5, 19, 67, 71]],
  ['Yüzme', [25, 26]],
  ['Yürüyüş', [6, 7, 8, 56]],
  ['Trekking', [9]],
  ['Kürek', [22, 39]],
  ['Kano', [37, 38, 41]],
  ['Yoga', [66]],
];
const WAHOO_SPORT_BY_ID = new Map(WAHOO_SPORTS.flatMap(([name, ids]) => ids.map((id) => [id, name])));
const WAHOO_TRANSITION = 63;

// Ondalıklar metin gelir ("133.0"); ölçülmemiş değer 0 ya da boş gelebilir, ikisi de "yok" demektir.
function wahooMeasured(v) {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// Yalnız bu alanlar okunur. Wahoo sözleşmesi konum saklamayı yasaklıyor: FIT dosyası (`file`, GPS izini taşır),
// rota (`route_id`) ve kullanıcının yazdığı ad bilerek alınmaz.
function wahooToActivity(w, summary) {
  if (!w || w.id == null || !w.starts || !summary || w.workout_type_id === WAHOO_TRANSITION) return null;
  const ms = Date.parse(w.starts);
  if (Number.isNaN(ms)) return null;
  return {
    external_id: String(w.id),
    started_at: new Date(ms).toISOString(),
    duration_sec: wahooMeasured(summary.duration_active_accum) ?? wahooMeasured(summary.duration_total_accum),
    distance_m: wahooMeasured(summary.distance_accum),
    avg_hr: wahooMeasured(summary.heart_rate_avg),
    sport: WAHOO_SPORT_BY_ID.get(w.workout_type_id) || null,
  };
}

function wahooProvider(env, fetchFn) {
  const API = 'https://api.wahooligan.com';
  const clientId = env.WAHOO_CLIENT_ID;
  const clientSecret = env.WAHOO_CLIENT_SECRET;
  const redirectUri = 'https://muuvlink.app/api/wearable/wahoo/callback';
  const WINDOW_DAYS = 30;
  const MAX_SUMMARY_LOOKUPS = 10;
  const bearer = (t) => ({ Authorization: `Bearer ${t}`, Accept: 'application/json' });
  const tokenRequest = (body) => fetchFn(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ ...body, client_id: clientId, client_secret: clientSecret }).toString(),
  });
  const readTokens = async (res, label) => {
    if (!res.ok) {
      console.error(`[WEARABLE] Wahoo ${label} hatası:`, res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const j = await res.json().catch(() => null);
    if (!j?.access_token) return null;
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token || null,
      // Bir dakika pay: bitişe saniyeler kala çıkan istek bitişten sonra varır.
      expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000) : null,
    };
  };
  return {
    configured: Boolean(clientId && clientSecret),
    // Wahoo erişimi kaldırılınca kişinin verisinin de silinmesini istiyor (Polar'da bağlantı "yeniden bağlan"da kalır).
    deleteOnRevoke: true,
    authorizeUrl(state) {
      const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'user_read workouts_read offline_data', state });
      return `${API}/oauth/authorize?${q}`;
    },
    async exchange(code) {
      const t = await readTokens(await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }), 'token');
      if (!t) return null;
      // Profilden yalnız kimlik alınır; ad, kilo, doğum tarihi okunmaz.
      const res = await fetchFn(`${API}/v1/user`, { headers: bearer(t.accessToken) });
      const u = res.ok ? await res.json().catch(() => null) : null;
      if (u?.id == null) {
        console.error('[WEARABLE] Wahoo kullanıcı kimliği alınamadı:', res.status);
        return null;
      }
      return { ...t, providerUserId: String(u.id) };
    },
    async register() { return true; },
    // Erişim jetonu yaklaşık 2 saat geçerli. 'revoked' = Wahoo yenilemeyi reddetti; null = geçici hata.
    async refresh(refreshToken) {
      const res = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
      if (res.status === 400 || res.status === 401) {
        console.error('[WEARABLE] Wahoo yenileme reddedildi:', res.status);
        return 'revoked';
      }
      return readTokens(res, 'yenileme');
    },
    // Son 30 gün. Belge, listede özetin dolu gelip gelmediğini söylemiyor: boş gelen geçmiş kayıt için özet ayrıca
    // istenir (zaten kayıtlı olanlar için istenmez; sınır, uygulama geneli istek kotasını korur).
    async fetchActivities(accessToken, known = new Set()) {
      const res = await fetchFn(`${API}/v1/workouts?page=1&per_page=30`, { headers: bearer(accessToken) });
      if (res.status === 401) return 'revoked';
      if (!res.ok) return null;
      const j = await res.json().catch(() => null);
      const since = Date.now() - WINDOW_DAYS * 86400000;
      const out = [];
      let lookups = 0;
      for (const w of j?.workouts || []) {
        const ms = Date.parse(w?.starts);
        if (w?.id == null || Number.isNaN(ms) || ms < since || ms > Date.now() || known.has(String(w.id))) continue;
        let summary = w.workout_summary;
        if (!summary && lookups < MAX_SUMMARY_LOOKUPS) {
          lookups += 1;
          const r = await fetchFn(`${API}/v1/workouts/${encodeURIComponent(w.id)}/workout_summary`, { headers: bearer(accessToken) });
          summary = r.ok ? await r.json().catch(() => null) : null;
        }
        const a = wahooToActivity(w, summary);
        if (a) out.push(a);
      }
      return out;
    },
    async deregister(accessToken) {
      const res = await fetchFn(`${API}/v1/permissions`, { method: 'DELETE', headers: bearer(accessToken) });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    },
  };
}

function polarProvider(env, fetchFn) {
  const API = 'https://www.polaraccesslink.com/v3';
  const clientId = env.POLAR_CLIENT_ID;
  const clientSecret = env.POLAR_CLIENT_SECRET;
  const redirectUri = 'https://muuvlink.app/api/wearable/polar/callback';
  return {
    configured: Boolean(clientId && clientSecret),
    authorizeUrl(state) {
      const q = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: 'accesslink.read_all', state });
      return `https://flow.polar.com/oauth2/authorization?${q}`;
    },
    async exchange(code) {
      const res = await fetchFn('https://polarremote.com/v2/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json;charset=UTF-8',
        },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
      });
      if (!res.ok) {
        console.error('[WEARABLE] Polar token hatası:', res.status, (await res.text().catch(() => '')).slice(0, 200));
        return null;
      }
      const j = await res.json().catch(() => null);
      if (!j?.access_token || j.x_user_id == null) return null;
      return {
        accessToken: j.access_token,
        providerUserId: String(j.x_user_id),
        expiresAt: j.expires_in ? new Date(Date.now() + j.expires_in * 1000) : null,
      };
    },
    // OAuth tek başına yetmiyor; kaydedilmeyen kullanıcının veri uçları 403 döner. 409 = zaten kayıtlı.
    async register(accessToken, userId) {
      const res = await fetchFn(`${API}/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ 'member-id': `muuv-${userId}` }),
      });
      if (res.ok || res.status === 409) return true;
      console.error('[WEARABLE] Polar kullanıcı kaydı hatası:', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return false;
    },
    // Son 30 gün. 204 = yeni veri yok (başarı). null = geçici hata. 'revoked' = izin kalkmış.
    async fetchActivities(accessToken) {
      const res = await fetchFn(`${API}/exercises`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
      if (res.status === 204) return [];
      if (res.status === 401 || res.status === 403) return 'revoked';
      if (!res.ok) return null;
      const j = await res.json().catch(() => null);
      return Array.isArray(j) ? j.map(polarToActivity).filter(Boolean) : [];
    },
    async deregister(accessToken, providerUserId) {
      await fetchFn(`${API}/users/${encodeURIComponent(providerUserId)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
      });
    },
  };
}

// Bağlantı kurulunca tarayıcıda görünen sayfa (uygulamadan açıldıysa kullanıcı sistem tarayıcısındadır).
const DONE_TEXT = {
  tr: ['Bağlantı kuruldu', 'Muuvlink\'e dönebilirsin.', 'Bağlantı kurulamadı', 'Muuvlink\'e dönüp yeniden dene.'],
  en: ['Connected', 'You can go back to Muuvlink.', 'Could not connect', 'Go back to Muuvlink and try again.'],
  de: ['Verbunden', 'Du kannst zu Muuvlink zurückkehren.', 'Verbindung fehlgeschlagen', 'Kehre zu Muuvlink zurück und versuche es erneut.'],
  el: ['Συνδέθηκε', 'Μπορείς να επιστρέψεις στο Muuvlink.', 'Η σύνδεση απέτυχε', 'Επίστρεψε στο Muuvlink και δοκίμασε ξανά.'],
  es: ['Conectado', 'Ya puedes volver a Muuvlink.', 'No se pudo conectar', 'Vuelve a Muuvlink e inténtalo de nuevo.'],
  fr: ['Connecté', 'Tu peux revenir sur Muuvlink.', 'Connexion impossible', 'Reviens sur Muuvlink et réessaie.'],
  it: ['Collegato', 'Puoi tornare su Muuvlink.', 'Collegamento non riuscito', 'Torna su Muuvlink e riprova.'],
};
function doneHtml(lang, ok) {
  const L = DONE_TEXT[lang] || DONE_TEXT.en;
  const [title, body] = ok ? [L[0], L[1]] : [L[2], L[3]];
  return `<!doctype html><html lang="${DONE_TEXT[lang] ? lang : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Muuvlink</title></head>`
    + `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F4F4F4;color:#1F2121;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;padding:24px;text-align:center">`
    + `<main><h1 style="font-size:22px;color:#114956;margin:0 0 8px">${title}</h1><p style="margin:0;font-size:16px">${body}</p></main></body></html>`;
}

function mountWearable(app, { pool, authenticateToken, jwtSecret, env = process.env, fetchFn = fetch }) {
  const PROVIDERS = { polar: polarProvider(env, fetchFn), wahoo: wahooProvider(env, fetchFn) };
  const tokenKey = crypto.createHash('sha256').update(`wearable-token:${jwtSecret}`).digest();

  const encrypt = (plain) => {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', tokenKey, iv);
    const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
  };
  const decrypt = (stored) => {
    const [iv, tag, data] = String(stored).split('.').map((s) => Buffer.from(s, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', tokenKey, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  };

  const ready = pool.query(`
    CREATE TABLE IF NOT EXISTS wearable_consents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK (action IN ('grant','withdraw')),
      version TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS wearable_consents_user ON wearable_consents (user_id, id DESC);
    CREATE TABLE IF NOT EXISTS wearable_connections (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'connected',
      provider_user_id TEXT,
      access_token_enc TEXT,
      expires_at TIMESTAMPTZ,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_sync_at TIMESTAMPTZ,
      PRIMARY KEY (user_id, provider)
    );
    ALTER TABLE wearable_connections ADD COLUMN IF NOT EXISTS refresh_token_enc TEXT;
    CREATE TABLE IF NOT EXISTS wearable_oauth_states (
      state TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      native BOOLEAN NOT NULL DEFAULT FALSE,
      lang TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      used_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS wearable_activities (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      duration_sec INTEGER,
      distance_m INTEGER,
      avg_hr INTEGER,
      sport TEXT,
      training_id INTEGER REFERENCES trainings(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, provider, external_id)
    );
    CREATE INDEX IF NOT EXISTS wearable_activities_user ON wearable_activities (user_id, started_at DESC);
  `).catch((e) => console.error('[WEARABLE] Tablo hatası:', e.message));

  const isVisibleTo = async (userId) => {
    if (env.WEARABLE_PUBLIC === '1') return true;
    const r = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    return Boolean(r.rows[0]?.is_admin);
  };
  const availableFor = async (userId) => {
    const names = Object.keys(PROVIDERS).filter((p) => PROVIDERS[p].configured);
    if (!names.length || !(await isVisibleTo(userId))) return [];
    return names;
  };
  const hasConsent = async (userId) => {
    const r = await pool.query('SELECT action FROM wearable_consents WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [userId]);
    return r.rows[0]?.action === 'grant';
  };

  // Antrenmanı, kişinin KATILDIĞI etkinlikle başlangıç saatine göre eşler: başlangıçtan 60 dk önce ile 120 dk sonra arası.
  const matchEvents = (userId) => pool.query(`
    UPDATE wearable_activities a SET training_id = m.training_id
    FROM (
      SELECT DISTINCT ON (a2.id) a2.id, t.id AS training_id
      FROM wearable_activities a2
      JOIN training_attendees ta ON ta.user_id = a2.user_id
      JOIN trainings t ON t.id = ta.training_id
      WHERE a2.user_id = $1 AND a2.training_id IS NULL AND t.training_datetime_utc IS NOT NULL
        AND a2.started_at BETWEEN t.training_datetime_utc - INTERVAL '60 minutes' AND t.training_datetime_utc + INTERVAL '120 minutes'
      ORDER BY a2.id, ABS(EXTRACT(EPOCH FROM (a2.started_at - t.training_datetime_utc)))
    ) m
    WHERE a.id = m.id`, [userId]);

  // Yeni jeton API çağrısından ÖNCE yazılır: Wahoo eskisini, yenisiyle yapılan ilk başarılı çağrıda iptal eder.
  const rotateToken = async (userId, provider, refreshEnc) => {
    const t = await PROVIDERS[provider].refresh(decrypt(refreshEnc));
    if (!t || t === 'revoked') return t;
    await pool.query(
      `UPDATE wearable_connections SET access_token_enc = $3, refresh_token_enc = COALESCE($4, refresh_token_enc), expires_at = $5
       WHERE user_id = $1 AND provider = $2`,
      [userId, provider, encrypt(t.accessToken), t.refreshToken ? encrypt(t.refreshToken) : null, t.expiresAt]
    );
    return t.accessToken;
  };

  const markRevoked = async (userId, provider) => {
    if (PROVIDERS[provider].deleteOnRevoke) {
      await pool.query('DELETE FROM wearable_activities WHERE user_id = $1 AND provider = $2', [userId, provider]);
      await pool.query(
        `UPDATE wearable_connections SET status = 'revoked', access_token_enc = NULL, refresh_token_enc = NULL, expires_at = NULL
         WHERE user_id = $1 AND provider = $2`, [userId, provider]
      );
    } else {
      await pool.query(`UPDATE wearable_connections SET status = 'revoked' WHERE user_id = $1 AND provider = $2`, [userId, provider]);
    }
    return { ok: false, reason: 'revoked' };
  };

  const runSync = async (userId, provider) => {
    const p = PROVIDERS[provider];
    if (!p?.configured || !(await hasConsent(userId))) return { ok: false, reason: 'not_allowed' };
    const c = await pool.query(
      `SELECT access_token_enc, refresh_token_enc, expires_at FROM wearable_connections WHERE user_id = $1 AND provider = $2 AND status = 'connected'`,
      [userId, provider]
    );
    const conn = c.rows[0];
    if (!conn?.access_token_enc) return { ok: false, reason: 'not_connected' };
    const canRefresh = Boolean(p.refresh && conn.refresh_token_enc);
    let token = decrypt(conn.access_token_enc);
    let rotated = false;
    if (canRefresh && !(conn.expires_at && new Date(conn.expires_at) > new Date())) {
      token = await rotateToken(userId, provider, conn.refresh_token_enc);
      rotated = true;
      if (token === 'revoked') return markRevoked(userId, provider);
      if (!token) return { ok: false, reason: 'provider_error' };
    }
    const knownRows = await pool.query('SELECT external_id FROM wearable_activities WHERE user_id = $1 AND provider = $2', [userId, provider]);
    const known = new Set(knownRows.rows.map((r) => r.external_id));
    let list = await p.fetchActivities(token, known);
    // Saatimize göre geçerli jeton reddedildiyse önce yenilemeyi dene: tek bir 401 yüzünden veri silinmesin.
    if (list === 'revoked' && canRefresh && !rotated) {
      token = await rotateToken(userId, provider, conn.refresh_token_enc);
      if (token === 'revoked') return markRevoked(userId, provider);
      if (!token) return { ok: false, reason: 'provider_error' };
      list = await p.fetchActivities(token, known);
    }
    if (list === 'revoked') return markRevoked(userId, provider);
    if (!list) return { ok: false, reason: 'provider_error' };
    let saved = 0;
    for (const a of list) {
      // Senkron sürerken bağlantı kesildiyse satır yazılmaz: kesince silme sözü bozulmasın.
      const r = await pool.query(
        `INSERT INTO wearable_activities (user_id, provider, external_id, started_at, duration_sec, distance_m, avg_hr, sport)
         SELECT $1::int, $2::text, $3::text, $4::timestamptz, $5::int, $6::int, $7::int, $8::text
         WHERE EXISTS (SELECT 1 FROM wearable_connections c WHERE c.user_id = $1 AND c.provider = $2 AND c.status = 'connected')
         ON CONFLICT (user_id, provider, external_id) DO NOTHING`,
        [userId, provider, a.external_id, a.started_at, a.duration_sec, a.distance_m, a.avg_hr, a.sport]
      );
      saved += r.rowCount;
    }
    await matchEvents(userId);
    await pool.query('UPDATE wearable_connections SET last_sync_at = NOW() WHERE user_id = $1 AND provider = $2', [userId, provider]);
    return { ok: true, read: list.length, saved };
  };

  // Aynı kişi ve marka için aynı anda tek senkron: iki yenileme aynı anda koşarsa biri iptal edilmiş jetonla kalır.
  const inflight = new Map();
  const syncConnection = (userId, provider) => {
    const key = `${userId}:${provider}`;
    if (!inflight.has(key)) inflight.set(key, runSync(userId, provider).finally(() => inflight.delete(key)));
    return inflight.get(key);
  };

  // Kişinin o markadaki bütün izlerini siler. Markanın tarafındaki kayıt en iyi çabayla kaldırılır;
  // o istek düşse de bizdeki veri ve jeton mutlaka silinir.
  const wipeProvider = async (userId, provider) => {
    const c = await pool.query(
      'SELECT access_token_enc, refresh_token_enc, expires_at, provider_user_id FROM wearable_connections WHERE user_id = $1 AND provider = $2',
      [userId, provider]
    );
    const row = c.rows[0];
    await pool.query('DELETE FROM wearable_activities WHERE user_id = $1 AND provider = $2', [userId, provider]);
    await pool.query('DELETE FROM wearable_connections WHERE user_id = $1 AND provider = $2', [userId, provider]);
    if (row?.access_token_enc && row.provider_user_id && PROVIDERS[provider]?.configured) {
      try {
        const p = PROVIDERS[provider];
        let token = decrypt(row.access_token_enc);
        if (p.refresh && row.refresh_token_enc && !(row.expires_at && new Date(row.expires_at) > new Date())) {
          const t = await p.refresh(decrypt(row.refresh_token_enc));
          token = t && t !== 'revoked' ? t.accessToken : null;
        }
        if (token) await p.deregister(token, row.provider_user_id);
      }
      catch (e) { console.error('[WEARABLE] Marka kaydı silinemedi:', provider, e.message); }
    }
  };
  const addWithdrawal = (userId) => pool.query(
    `INSERT INTO wearable_consents (user_id, action, version) VALUES ($1, 'withdraw', $2)`, [userId, CONSENT_VERSION]
  );
  const wipeUser = async (userId) => {
    const c = await pool.query('SELECT provider FROM wearable_connections WHERE user_id = $1', [userId]);
    for (const { provider } of c.rows) await wipeProvider(userId, provider);
    await pool.query('DELETE FROM wearable_activities WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM wearable_oauth_states WHERE user_id = $1', [userId]);
    if (await hasConsent(userId)) await addWithdrawal(userId);
  };

  app.get('/api/wearable/status', authenticateToken, async (req, res) => {
    try {
      const uid = req.user.id;
      const available = await availableFor(uid);
      if (!available.length) return res.json({ available: [] });
      const [consented, conns, acts] = await Promise.all([
        hasConsent(uid),
        pool.query('SELECT provider, status, connected_at, last_sync_at FROM wearable_connections WHERE user_id = $1', [uid]),
        pool.query(
          `SELECT a.id, a.provider, a.started_at, a.duration_sec, a.distance_m, a.avg_hr, a.sport, a.training_id, t.title AS training_title
           FROM wearable_activities a LEFT JOIN trainings t ON t.id = a.training_id
           WHERE a.user_id = $1 ORDER BY a.started_at DESC LIMIT 30`, [uid]
        ),
      ]);
      res.json({ available, consented, connections: conns.rows, activities: acts.rows });
    } catch (e) { console.error('[WEARABLE] status:', e.message); res.status(500).json({ error: 'server_error' }); }
  });

  app.post('/api/wearable/consent', authenticateToken, async (req, res) => {
    try {
      const uid = req.user.id;
      if (!(await availableFor(uid)).length) return res.status(404).json({ error: 'not_available' });
      if (req.body?.granted === true) {
        if (!(await hasConsent(uid))) {
          await pool.query(`INSERT INTO wearable_consents (user_id, action, version) VALUES ($1, 'grant', $2)`, [uid, CONSENT_VERSION]);
        }
        return res.json({ consented: true });
      }
      if (req.body?.granted === false) {
        await wipeUser(uid);
        return res.json({ consented: false });
      }
      res.status(400).json({ error: 'bad_request' });
    } catch (e) { console.error('[WEARABLE] consent:', e.message); res.status(500).json({ error: 'server_error' }); }
  });

  app.post('/api/wearable/:provider/connect', authenticateToken, async (req, res) => {
    try {
      const uid = req.user.id;
      const { provider } = req.params;
      if (!(await availableFor(uid)).includes(provider)) return res.status(404).json({ error: 'not_available' });
      if (!(await hasConsent(uid))) return res.status(409).json({ error: 'consent_required' });
      pool.query(`DELETE FROM wearable_oauth_states WHERE created_at < NOW() - INTERVAL '1 day'`).catch(() => {});
      const state = crypto.randomBytes(24).toString('hex');
      const lang = String(req.get('X-Muuv-Lang') || '').slice(0, 5) || null;
      await pool.query(
        'INSERT INTO wearable_oauth_states (state, user_id, provider, native, lang) VALUES ($1,$2,$3,$4,$5)',
        [state, uid, provider, req.body?.native === true, lang]
      );
      res.json({ url: PROVIDERS[provider].authorizeUrl(state) });
    } catch (e) { console.error('[WEARABLE] connect:', e.message); res.status(500).json({ error: 'server_error' }); }
  });

  // Oturumsuz gelir (markanın yönlendirmesi); kimliği tek kullanımlık, 10 dakikalık `state` kaydı verir.
  app.get('/api/wearable/:provider/callback', async (req, res) => {
    const { provider } = req.params;
    let native = false;
    let lang = null;
    const done = (result) => {
      if (native) return res.status(result === 'ok' ? 200 : 400).type('html').send(doneHtml(lang, result === 'ok'));
      return res.redirect(302, `/?wearable=${encodeURIComponent(result)}`);
    };
    try {
      const p = PROVIDERS[provider];
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const claimed = state ? await pool.query(
        `UPDATE wearable_oauth_states SET used_at = NOW()
         WHERE state = $1 AND provider = $2 AND used_at IS NULL AND created_at > NOW() - INTERVAL '${STATE_MINUTES} minutes'
         RETURNING user_id, native, lang`, [state, provider]
      ) : { rows: [] };
      const row = claimed.rows[0];
      if (!p?.configured || !row) return done('error');
      native = row.native;
      lang = row.lang;
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      if (!code) return done('cancelled');
      if (!(await hasConsent(row.user_id))) return done('error');
      const t = await p.exchange(code);
      if (!t || !(await p.register(t.accessToken, row.user_id))) return done('error');
      await pool.query(
        `INSERT INTO wearable_connections (user_id, provider, status, provider_user_id, access_token_enc, refresh_token_enc, expires_at, connected_at, last_sync_at)
         VALUES ($1,$2,'connected',$3,$4,$5,$6,NOW(),NULL)
         ON CONFLICT (user_id, provider) DO UPDATE SET status='connected', provider_user_id=EXCLUDED.provider_user_id,
           access_token_enc=EXCLUDED.access_token_enc, refresh_token_enc=EXCLUDED.refresh_token_enc, expires_at=EXCLUDED.expires_at, connected_at=NOW()`,
        [row.user_id, provider, t.providerUserId, encrypt(t.accessToken), t.refreshToken ? encrypt(t.refreshToken) : null, t.expiresAt]
      );
      syncConnection(row.user_id, provider).catch((e) => console.error('[WEARABLE] ilk senkron:', e.message));
      done('ok');
    } catch (e) { console.error('[WEARABLE] callback:', e.message); done('error'); }
  });

  app.post('/api/wearable/:provider/sync', authenticateToken, async (req, res) => {
    try {
      const uid = req.user.id;
      const { provider } = req.params;
      if (!(await availableFor(uid)).includes(provider)) return res.status(404).json({ error: 'not_available' });
      const recent = await pool.query(
        `SELECT 1 FROM wearable_connections WHERE user_id = $1 AND provider = $2 AND last_sync_at > NOW() - make_interval(secs => $3)`,
        [uid, provider, SYNC_MIN_GAP_SEC]
      );
      if (recent.rows.length) return res.json({ ok: true, throttled: true });
      const out = await syncConnection(uid, provider);
      if (out.ok) return res.json(out);
      res.status(out.reason === 'provider_error' ? 502 : 409).json({ error: out.reason });
    } catch (e) { console.error('[WEARABLE] sync:', e.message); res.status(500).json({ error: 'server_error' }); }
  });

  // Bağlantıyı kes. Başka bağlantı kalmadıysa rıza da geri alınmış sayılır (arayüz böyle söylüyor).
  app.delete('/api/wearable/:provider', authenticateToken, async (req, res) => {
    try {
      const uid = req.user.id;
      const { provider } = req.params;
      if (!PROVIDERS[provider]) return res.status(404).json({ error: 'not_available' });
      await wipeProvider(uid, provider);
      const left = await pool.query('SELECT 1 FROM wearable_connections WHERE user_id = $1 LIMIT 1', [uid]);
      if (!left.rows.length && (await hasConsent(uid))) await addWithdrawal(uid);
      res.json({ ok: true });
    } catch (e) { console.error('[WEARABLE] disconnect:', e.message); res.status(500).json({ error: 'server_error' }); }
  });

  // Arka plan senkronu: bağlı kişileri sırayla çeker.
  const runSyncJob = async () => {
    try {
      if (!Object.values(PROVIDERS).some((p) => p.configured)) return;
      const r = await pool.query(`SELECT user_id, provider FROM wearable_connections WHERE status = 'connected'`);
      for (const { user_id: uid, provider } of r.rows) {
        await syncConnection(uid, provider).catch((e) => console.error('[WEARABLE] job:', e.message));
      }
    } catch (e) { console.error('[WEARABLE] job:', e.message); }
  };

  return { ready, wipeUser, runSyncJob, syncConnection };
}

module.exports = { mountWearable, polarToActivity, wahooToActivity, parseIsoDuration, sportFromRaw };
