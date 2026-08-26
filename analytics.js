/**
 * Meta ölçüm katmanı — tarayıcı tarafı.
 *
 * Tek kurulum üç platformu birden kapsar: Capacitor `server.url` sayesinde
 * iOS ve Android uygulaması da muuvlink.app'i yüklüyor, dolayısıyla aynı
 * pixel orada da çalışır. Platform ayrımı `?src=app` ile yapılır.
 *
 * Tekilleştirme: kritik olaylar hem buradan (pixel) hem sunucudan (CAPI)
 * gider. İkisi aynı `eventId`'yi taşımazsa Meta dönüşümü çift sayar. Bu
 * yüzden kimlik burada üretilir, API isteğiyle birlikte sunucuya taşınır.
 *
 * VITE_META_PIXEL_ID tanımlı değilse tüm fonksiyonlar sessizce hiçbir şey
 * yapmaz — geliştirme ortamı ve pixel kurulmadan önceki dönem için güvenli.
 */

const PIXEL_ID = String(import.meta.env?.VITE_META_PIXEL_ID || '').trim();
const IS_ENABLED = PIXEL_ID.length > 0;

/** İlk dokunuş kaynağının saklandığı yer — kayıt anında sunucuya gider. */
const ATTRIBUTION_KEY = 'mv_attribution';

let initialized = false;
let lastPageViewPath = null;
let lastViewedContent = null;
let startRegistrationSent = false;

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

/** Pixel ve CAPI'nin aynı olayı tekilleştirmesi için ortak kimlik. */
export function newEventId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* eski WebView — aşağıdaki yedeğe düş */ }
  return `mv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

/** Uygulama içinden mi geliyor — `?src=app` Capacitor tarafından ekleniyor. */
export function getPlatform() {
  if (typeof window === 'undefined') return 'web';
  try {
    const isApp = window.Capacitor?.isNativePlatform?.() === true ||
      new URLSearchParams(window.location.search).get('src') === 'app';
    if (!isApp) return 'web';
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'app';
  } catch {
    return 'web';
  }
}

/**
 * Meta'nın kişiyi tanıması için gereken tarayıcı tanımlayıcıları.
 * Sunucu bunları olayla birlikte gönderemezse eşleşme kalitesi düşer ve
 * kurulum doğru olsa bile dönüşümler reklama bağlanmaz.
 */
export function getMatchSignals() {
  return {
    _fbp: readCookie('_fbp'),
    _fbc: readCookie('_fbc'),
    _src: getPlatform(),
    _url: typeof window !== 'undefined' ? window.location.href : null,
  };
}

/* ------------------------------------------------------------------ */
/* Kaynak (attribution) yakalama                                       */
/* ------------------------------------------------------------------ */

/**
 * İlk dokunuşu saklar. Meta "50 kayıt geldi" der ama o kayıtların kaçının
 * gerçekten aktif kullanıcıya dönüştüğünü sadece kendi veritabanımızda
 * görebiliriz — bunun için kaydın hangi reklamdan geldiğini bilmek gerekir.
 *
 * İlk dokunuş korunur: kullanıcı reklamdan gelip bir hafta sonra doğrudan
 * girip kayıt olursa, kaydı yine reklam kazandırmıştır.
 */
export function captureAttribution() {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const captured = {};

    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = params.get(key);
      if (value) captured[key] = value.slice(0, 255);
    }
    const fbclid = params.get('fbclid');
    if (fbclid) captured.fbclid = fbclid.slice(0, 255);

    // Kaynak sinyali yoksa mevcut kaydı ezme.
    if (Object.keys(captured).length === 0) return;

    if (localStorage.getItem(ATTRIBUTION_KEY)) return; // ilk dokunuş korunur

    captured.landing_page = window.location.pathname.slice(0, 255);
    captured.referrer = (document.referrer || '').slice(0, 255);
    captured.captured_at = new Date().toISOString();

    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(captured));
  } catch { /* localStorage kapalı olabilir — ölçüm uğruna akışı bozma */ }
}

/** Kayıt isteğine eklenecek kaynak bilgisi. */
export function getAttribution() {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Pixel                                                               */
/* ------------------------------------------------------------------ */

export function initAnalytics() {
  if (!IS_ENABLED || initialized || typeof window === 'undefined') return;
  initialized = true;

  captureAttribution();

  /* Meta'nın resmi pixel yükleyicisi — fbq kuyruğu script inmeden de çalışır. */
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = true; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', PIXEL_ID);
  trackPageView();
}

/**
 * Tek sayfa uygulamasında rota değişimi tarayıcı için sayfa yüklemesi
 * değildir; PageView elle tetiklenmezse tüm gezinme tek ziyaret sayılır.
 */
export function trackPageView() {
  if (!IS_ENABLED || typeof window === 'undefined' || !window.fbq) return;
  const path = window.location.pathname;
  if (path === lastPageViewPath) return; // aynı rotada çift sayma
  lastPageViewPath = path;
  window.fbq('track', 'PageView');
}

/**
 * Meta'nın tanıdığı standart olay.
 * @param {string} name  ör. 'CompleteRegistration'
 * @param {object} params olay parametreleri
 * @param {string} eventId CAPI ile ortak kimlik — verilmezse üretilir
 */
export function track(name, params = {}, eventId = null) {
  const id = eventId || newEventId();
  if (!IS_ENABLED || typeof window === 'undefined' || !window.fbq) return id;
  try {
    window.fbq('track', name, params, { eventID: id });
  } catch { /* ölçüm hatası kullanıcı akışını durdurmaz */ }
  return id;
}

/** Muuvlink'e özgü olaylar — JoinTraining, CreateTeam gibi. */
export function trackCustom(name, params = {}, eventId = null) {
  const id = eventId || newEventId();
  if (!IS_ENABLED || typeof window === 'undefined' || !window.fbq) return id;
  try {
    window.fbq('trackCustom', name, params, { eventID: id });
  } catch { /* ölçüm hatası kullanıcı akışını durdurmaz */ }
  return id;
}

/* ------------------------------------------------------------------ */
/* Huni olayları — çağrı yerleri sporla-bulusma.jsx içinde              */
/* ------------------------------------------------------------------ */

export const MetaEvents = {
  /**
   * Etkinlik veya takım detayı görüntülendi.
   * Aynı içerik için tekrar gönderilmez — detay sayfasını çizen effect
   * başka bağımlılıkları değiştiğinde de çalışır, her çalışmada olay
   * göndermek görüntülenme sayısını şişirirdi.
   */
  viewContent(type, id, name) {
    const key = `${type}:${id}`;
    if (key === lastViewedContent) return null;
    lastViewedContent = key;
    return track('ViewContent', {
      content_type: type,
      content_ids: id != null ? [String(id)] : undefined,
      content_name: name || undefined,
    });
  },

  /** Spor/şehir filtresi kullanıldı. */
  search(query) {
    return track('Search', { search_string: query ? String(query).slice(0, 100) : undefined });
  },

  /**
   * Kayıt formu açıldı — tamamlamayanlar retargeting'in en verimli dilimi.
   * Oturum başına bir kez: kullanıcı formu kapatıp açtıkça olay şişmesin.
   */
  startRegistration() {
    if (startRegistrationSent) return null;
    startRegistrationSent = true;
    return trackCustom('StartRegistration');
  },

  /** Kayıt tamamlandı. Sunucu aynı kimlikle CAPI'ye de gönderir. */
  completeRegistration(eventId) {
    return track('CompleteRegistration', { status: true }, eventId);
  },

  /** Asıl değer olayı — hacim yeterince artınca Meta buna optimize edilecek. */
  joinTraining(trainingId, eventId) {
    return trackCustom('JoinTraining', {
      content_ids: trainingId != null ? [String(trainingId)] : undefined,
    }, eventId);
  },

  joinTeam(teamId, eventId) {
    return trackCustom('JoinTeam', {
      content_ids: teamId != null ? [String(teamId)] : undefined,
    }, eventId);
  },

  createTraining(eventId) {
    return trackCustom('CreateTraining', {}, eventId);
  },

  createTeam(eventId) {
    return trackCustom('CreateTeam', {}, eventId);
  },
};

export const isAnalyticsEnabled = IS_ENABLED;
