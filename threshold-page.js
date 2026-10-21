/**
 * Threshold İzleme — sayfa geçişi bildirimi.
 *
 * Melih'in izleme ekranı (Threshold) sitede hangi sayfanın açık olduğunu
 * görsün. Muuvlink tek sayfalık uygulama: rota değişince tarayıcı sunucuya
 * istek atmaz, bu yüzden geçiş kendiliğinden görünmez. Burada aynı alan adına
 * küçük bir sinyal gider (`/_thr/page/etkinlikler`); nginx onu arka uca
 * iletmeden 204 ile yanıtlar ve yalnız Threshold loguna yazar
 * (sites-enabled/muuvlink, `location ^~ /_thr/`).
 *
 * Yalnız yol gider: kullanıcı adı, e-posta ya da sorgu yok. Uygulama
 * (Capacitor `server.url`) da muuvlink.app'i yüklediği için aynı yol orada da
 * çalışır. Hata asla kullanıcıya yansımaz.
 */

let lastPath = null;

export function reportPage() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
  const path = window.location.pathname || '/';
  if (path === lastPath) return; // aynı rotada çift sayma
  lastPath = path;
  try {
    navigator.sendBeacon(`/_thr/page${path.startsWith('/') ? path : `/${path}`}`);
  } catch {
    /* izleme isteğe bağlı */
  }
}
