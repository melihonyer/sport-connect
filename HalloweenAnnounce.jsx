// Cadılar Bayramı penceresi (Melih, 30 Ekim 2026): sosyal medyadaki "kostümlü koşu" filmini
// 31 Ekim 21:00'e kadar herkese BİR KEZ gösterir; video hikâyede paylaşılabilir. Süre bitince
// hiç çalışmaz; sonra bu dosya, çağrı yeri ve public/announce/cadilar-bayrami.* silinebilir.
// Yalnız Türkçe (RouteAnnounce gibi; film Türkçe). Video images/sosyal-medya/video/
// muuvlink-cadilar-bayrami.mp4'ün 720×1280 küçültmesi (2,2 MB) — hem oynatılan hem paylaşılan.
import React, { useEffect, useRef, useState } from "react";
import { Share2, Download, Volume2, VolumeX, X, Loader2 } from "lucide-react";

export const HALLOWEEN_UNTIL = Date.parse("2026-10-31T21:00:00+03:00");
export const HALLOWEEN_KEY = "muuv_announce_halloween_v1";

const VIDEO = "/announce/cadilar-bayrami.mp4";
const FILE_NAME = "muuvlink-cadilar-bayrami.mp4";

const TXT = {
  pill: "Cadılar Bayramı",
  title: "Cumartesi kostümle koş",
  body: "Takımını topla, herkes istediği kostümle gelsin. Videoyu hikâyende paylaş, ekibini çağır.",
  share: "Hikâyende paylaş",
  download: "Videoyu indir",
  preparing: "Video hazırlanıyor",
  downloaded: "Video indirildi. Telefonuna atıp hikâyende paylaşabilirsin.",
  ctaUser: "Kostümlü koşu etkinliği aç",
  ctaGuest: "Üye ol, takımını topla",
  close: "Kapat",
  soundOn: "Sesi aç",
  soundOff: "Sesi kapat",
  shareText: "Cumartesi Cadılar Bayramı. Takımını topla, kostümle koş. muuvlink.app",
};

const isNativeApp = () => { try { return !!window?.Capacitor?.isNativePlatform?.(); } catch { return false; } };
const isMobileLike = () => {
  try {
    if (isNativeApp()) return true;
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") return navigator.userAgentData.mobile;
    return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent || "");
  } catch { return false; }
};

export default function HalloweenAnnounce({ isGuest, onCreate, onClose }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const mobile = isMobileLike();

  useEffect(() => { videoRef.current?.play?.().catch(() => {}); }, []);

  // Paylaşım dosyası açılışta alınır: Safari paylaşım penceresini yalnız dokunuşun hemen
  // ardından açar, tıklamadan sonra indirmeye kalkınca izin düşüyor. Video aynı adresten
  // oynadığı için çoğunlukla önbellekten gelir.
  useEffect(() => {
    let alive = true;
    fetch(VIDEO)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => { if (alive) setFile(new File([b], FILE_NAME, { type: "video/mp4" })); })
      .catch(() => { /* paylaşım bağlantıya düşer */ });
    return () => { alive = false; };
  }, []);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    if (muted) { v.currentTime = 0; v.play().catch(() => {}); }
    setMuted(!muted);
  };

  // Kademeli: 1) dosya paylaşımı (iOS uygulaması, mobil tarayıcılar; Instagram "Hikâye" seçenekte
  // çıkar) 2) dosya paylaşamayan uygulama (Android WebView): Capacitor Share ile metin + link
  // 3) masaüstü: videoyu indir.
  const share = async () => {
    setNote("");
    if (mobile && file) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Muuvlink" });
          return;
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    if (isNativeApp()) {
      try {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title: TXT.title, text: TXT.shareText, url: "https://muuvlink.app/", dialogTitle: TXT.share });
        return;
      } catch { /* aşağıya düş */ }
    }
    try {
      const a = document.createElement("a");
      a.href = file ? URL.createObjectURL(file) : VIDEO;
      a.download = FILE_NAME;
      document.body.appendChild(a); a.click(); a.remove();
      if (file) setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setNote(TXT.downloaded);
    } catch { /* yok say */ }
  };

  const ready = !!file || !mobile;
  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-end sm:items-center overflow-y-auto overscroll-contain p-3 sm:p-6"
      style={{ zIndex: 1000000 }} role="dialog" aria-modal="true" aria-label={TXT.title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl w-full max-w-sm sm:max-w-3xl overflow-hidden relative my-auto flex flex-col sm:flex-row"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <button onClick={onClose} aria-label={TXT.close} data-hover="own"
          className="absolute top-2 right-2 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/90 hover:bg-white transition-colors shadow-sm">
          <X className="w-5 h-5 text-slate-700" />
        </button>

        <div className="relative flex justify-center bg-brand-600 flex-shrink-0">
          <video
            ref={videoRef}
            src={VIDEO}
            poster="/announce/cadilar-bayrami-poster.jpg"
            autoPlay muted loop playsInline preload="auto"
            className="block h-[min(46dvh,420px)] sm:h-[min(80vh,600px)] aspect-[9/16] object-cover"
          />
          <button onClick={toggleSound} aria-label={muted ? TXT.soundOn : TXT.soundOff} data-hover="own"
            className="absolute bottom-3 right-3 w-11 h-11 flex items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60 transition-colors">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        <div className="p-5 sm:p-10 flex flex-col justify-center min-w-0">
          <span className="self-start inline-flex items-center px-3 py-1 rounded-full bg-pop-400 text-brand-600 text-xs font-semibold uppercase tracking-wide">
            {TXT.pill}
          </span>
          <h2 className="mt-3 sm:mt-4 text-2xl sm:text-3xl font-bold text-brand-600 tracking-tight">{TXT.title}</h2>
          <p className="mt-2 sm:mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{TXT.body}</p>
          <button data-btn="pop" onClick={share} disabled={!ready}
            className="mt-5 sm:mt-6 w-full py-3.5 rounded-xl font-semibold bg-pop-400 text-brand-600 flex items-center justify-center gap-2 disabled:opacity-60">
            {!ready ? <><Loader2 className="w-4 h-4 animate-spin" /> {TXT.preparing}</>
              : mobile ? <><Share2 className="w-4 h-4" /> {TXT.share}</>
              : <><Download className="w-4 h-4" /> {TXT.download}</>}
          </button>
          {note ? <p className="mt-2 text-xs text-slate-600 leading-relaxed">{note}</p> : null}
          <button data-btn="solid" onClick={onCreate}
            className="mt-2 w-full py-3.5 rounded-xl font-semibold text-white"
            style={{ background: "#114956" }}>
            {isGuest ? TXT.ctaGuest : TXT.ctaUser}
          </button>
          <button onClick={onClose}
            className="mt-1 w-full py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            {TXT.close}
          </button>
        </div>
      </div>
    </div>
  );
}
