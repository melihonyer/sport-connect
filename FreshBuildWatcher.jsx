import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// Açık duran sayfa yeni sürümü kendiliğinden alsın.
//
// NEDEN: deploy sunucudaki dosyaları değiştirir ama açık sekme ve telefonda arka
// planda bekleyen uygulama (Capacitor, server.url canlı site) eski kodla kalır;
// kullanıcı yenilemeyi ya da uygulamayı kapatıp açmayı bilmez. Training Agents'taki
// FreshBuildWatcher'ın karşılığı.
//
// NASIL: sürüm = sayfanın yüklediği ana betiğin adı (/assets/main-<özet>.js; Vite her
// derlemede özeti değiştirir). Öne gelişte sunucudaki HTML'i (no-store) okuyup
// karşılaştırırız; backend'e ayrı uç gerekmez.
//  - Yarım iş varsa (isBusy) yenilemez, alt şeritte "Yenile" düğmesi gösterir.
//  - Yenilemeden önce yeni betiğin gerçekten indiğini kontrol eder: rsync HTML'i
//    betikten önce yazmışsa yarım deploy'a yenilemeyelim.
//  - Aynı sürüm için bir kez kendiliğinden yeniler (sessionStorage); önbellek yüzünden
//    eski sayfa dönerse döngüye girmez.
const ENTRY_RE = /<script[^>]+type="module"[^>]+src="(\/assets\/[^"]+\.js)"/;
const RELOADED_KEY = "muuv_reloaded_for";

const currentEntry = () => {
  const el = document.querySelector('script[type="module"][src*="/assets/"]');
  if (!el) return null;
  try { return new URL(el.getAttribute("src"), window.location.origin).pathname; } catch { return null; }
};

export default function FreshBuildWatcher({ htmlPath = "/index.html", isBusy = () => false, label, cta, place = { top: "calc(env(safe-area-inset-top) + 76px)" } }) {
  const [stale, setStale] = useState(false);
  const busyRef = useRef(isBusy);
  busyRef.current = isBusy;

  useEffect(() => {
    const loaded = currentEntry();
    if (!loaded) return; // geliştirme sunucusu: özetli betik yok
    let running = false;

    const check = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const res = await fetch(htmlPath, { cache: "no-store" });
        if (!res.ok) return;
        const m = (await res.text()).match(ENTRY_RE);
        const latest = m?.[1];
        if (!latest || latest === loaded) return;
        // Yeni betik sunucuda hazır mı? Değilse deploy sürüyor; bir sonraki öne gelişte.
        // Canlıda eksik dosya 404; yine de içerik türüne bakılır (SPA yedeği HTML döner).
        const head = await fetch(latest, { method: "HEAD", cache: "no-store" }).catch(() => null);
        if (!head?.ok || !/javascript/.test(head.headers.get("content-type") || "")) return;
        let already = null;
        try { already = sessionStorage.getItem(RELOADED_KEY); } catch {}
        if (busyRef.current() || already === latest) { setStale(true); return; }
        try { sessionStorage.setItem(RELOADED_KEY, latest); } catch {}
        // reload() yerine aynı adrese gitmek: bazı WebView'lerde reload önbellekten döner.
        window.location.href = window.location.href;
      } catch {
        // Ağ yoksa sürüm bilinmiyor; sessiz geç.
      } finally {
        running = false;
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    // Bazı kabuklarda öne gelişte visibilitychange yerine focus geliyor.
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    let removeResume = null;
    if (window.Capacitor?.isNativePlatform?.()) {
      import("@capacitor/app")
        .then(({ App }) => App.addListener("appStateChange", ({ isActive }) => { if (isActive) check(); }))
        .then((h) => { removeResume = () => h.remove(); })
        .catch(() => {});
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      removeResume?.();
    };
  }, [htmlPath]);

  if (!stale) return null;
  return (
    // Sitede üstte, menünün altında (altta çerez bildirimi ve uygulamanın alt menüsü var).
    <div className="fixed inset-x-0 flex justify-center px-4 pointer-events-none"
      style={{ ...place, zIndex: 1000001 }}>
      <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-full bg-brand-600 pl-4 pr-1.5 py-1.5 text-white shadow-xl">
        <span className="text-xs font-semibold">{label}</span>
        <button data-btn="pop-on-dark"
          onClick={() => { window.location.href = window.location.href; }}
          className="inline-flex items-center gap-1.5 rounded-full bg-pop-400 text-ink-900 px-3 py-1.5 text-xs font-bold">
          <RefreshCw className="w-3.5 h-3.5" /> {cta}
        </button>
      </div>
    </div>
  );
}
