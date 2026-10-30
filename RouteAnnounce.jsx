// "Etkinlik rotası" duyurusu (Melih, 25 Ekim 2026): yeni özelliği herkese BİR KEZ, sosyal
// medyadaki tanıtım filmiyle gösterir. 1 ay sürer (ROUTE_ANNOUNCE_UNTIL), sonra kendiliğinden
// kapanır; süre bitince bu dosya, çağrı yeri ve public/announce/ silinebilir.
// Yalnız Türkçe (Melih: "şu anda sadece Türk sporcular var") — dil ayrımı yapılmaz, metinler
// bu yüzden i18n.js'te değil, burada. Video images/sosyal-medya/video/muuvlink-rota-gpx.mp4'ün
// 540×960 küçültmesi (1,9 MB).
import React, { useEffect, useRef, useState } from "react";
import { Route, Volume2, VolumeX, X } from "lucide-react";

export const ROUTE_ANNOUNCE_UNTIL = Date.parse("2026-11-25T00:00:00+03:00");
export const ROUTE_ANNOUNCE_KEY = "muuv_announce_route_v1";
// Cadılar Bayramı penceresiyle çakışmasın diye duraklatıldı (Melih, 30 Ekim 2026): o pencere
// 31 Ekim 21:00'de biter, rota duyurusu gece 00:00'da kaldığı yerden devam eder.
export const ROUTE_ANNOUNCE_RESUME = Date.parse("2026-11-01T00:00:00+03:00");

const TXT = {
  pill: "Yeni özellik",
  title: "Etkinliğine rota ekle",
  body: "GPX dosyanı ekle, rota haritada çizilsin. Katılacaklar yolun nereden geçtiğini görür; yol üstündeyse oradan katılır.",
  ctaUser: "Rotalı etkinlik oluştur",
  ctaGuest: "Üye ol ve dene",
  later: "Şimdi değil",
  soundOn: "Sesi aç",
  soundOff: "Sesi kapat",
  close: "Kapat",
};

export default function RouteAnnounce({ isGuest, onCreate, onClose }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);

  // Sessiz otomatik oynatma her tarayıcıda serbest; yine de reddedilirse kapak görseli kalır.
  useEffect(() => { videoRef.current?.play?.().catch(() => {}); }, []);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    if (muted) { v.currentTime = 0; v.play().catch(() => {}); }
    setMuted(!muted);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-end sm:items-center overflow-y-auto overscroll-contain p-3 sm:p-6"
      style={{ zIndex: 1000000 }} role="dialog" aria-modal="true" aria-label={TXT.title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl w-full max-w-sm sm:max-w-3xl overflow-hidden relative my-auto flex flex-col sm:flex-row"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <button onClick={onClose} aria-label={TXT.close}
          className="absolute top-2 right-2 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/90 sm:bg-transparent hover:bg-slate-100 transition-colors">
          <X className="w-5 h-5 text-slate-600" />
        </button>

        {/* Film 9:16; telefonda ekranın yarısını geçmesin, iki yanı Deep Teal kalır */}
        <div className="relative flex justify-center bg-brand-600 flex-shrink-0">
          <video
            ref={videoRef}
            src="/announce/rota-gpx.mp4"
            poster="/announce/rota-gpx-poster.jpg"
            autoPlay muted loop playsInline preload="auto"
            className="block h-[min(52dvh,440px)] sm:h-[min(80vh,600px)] aspect-[9/16] object-cover"
          />
          <button onClick={toggleSound} aria-label={muted ? TXT.soundOn : TXT.soundOff} data-hover="own"
            className="absolute bottom-3 right-3 w-11 h-11 flex items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60 transition-colors">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        <div className="p-6 sm:p-10 flex flex-col justify-center min-w-0">
          <span className="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pop-400 text-brand-600 text-xs font-semibold uppercase tracking-wide">
            <Route className="w-3.5 h-3.5" /> {TXT.pill}
          </span>
          <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-brand-600 tracking-tight">{TXT.title}</h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{TXT.body}</p>
          <button data-btn="solid" onClick={onCreate}
            className="mt-6 w-full py-3.5 rounded-xl font-semibold text-white"
            style={{ background: "#114956" }}>
            {isGuest ? TXT.ctaGuest : TXT.ctaUser}
          </button>
          <button onClick={onClose}
            className="mt-2 w-full py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            {TXT.later}
          </button>
        </div>
      </div>
    </div>
  );
}
