// ─────────────────────────────────────────────────────────────────────────
//  Harita altlığı — OpenFreeMap "Positron"
//
//  NEDEN: CARTO 2026'da altlık için API anahtarı şartı getirdi ve anahtarsız
//  isteklerde "API KEY REQUIRED" damgasını doğrudan görselin İÇİNE basıyor.
//  Kısa bir süre OpenStreetMap standart döşemeleri kullanıldı ama görünüm
//  kurumsal palete göre fazla yoğun kaldı.
//
//  OpenFreeMap: ücretsiz, istek sınırı yok, kayıt/anahtar/çerez yok, ticari
//  kullanım serbest. Positron stili CARTO'da kullandığımız temiz görünümün
//  karşılığıdır. Veri OpenStreetMap'ten gelir.
//
//  Vektör döşeme olduğu için MapLibre gerekir; Leaflet köprüsü sayesinde
//  işaretçiler, baloncuklar ve mevcut harita mantığı Leaflet'te KALIR —
//  yalnız altlık katmanı değişir.
//
//  maplibre-gl ~200 KB (gzip). Harita bileşenleri zaten ayrı parça olarak
//  yükleniyor, ana sayfayı etkilemez.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { useMap } from "react-leaflet";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const ATTRIBUTION =
  '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> · ' +
  '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default function VectorBasemap() {
  const map = useMap();

  useEffect(() => {
    let layer = null;
    let nudge = null;
    let cancelled = false;
    const timers = [];

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css");
      // Köprü, maplibregl'i global üzerinden bulur; import sırası önemli.
      window.maplibregl = maplibregl;
      const L = (await import("leaflet")).default;
      await import("@maplibre/maplibre-gl-leaflet");
      if (cancelled) return;

      layer = L.maplibreGL({ style: STYLE_URL }).addTo(map);

      // Atıf ZORUNLU (OpenStreetMap verisi + OpenFreeMap barındırma).
      // Köprü katmanın attribution seçeneğini Leaflet'e geçirmiyor,
      // bu yüzden doğrudan atıf denetimine ekliyoruz.
      map.attributionControl?.addAttribution(ATTRIBUTION);

      const gl = layer.getMaplibreMap?.();

      // MapLibre hataları sessizce yutulmasın: stil ya da döşeme sorununda
      // harita bembeyaz kalır ve nedeni ancak burada görünür.
      gl?.on("error", (ev) => console.error("[map] maplibre:", ev?.error?.message || ev));

      // Katman, dinamik import'lar bittikten SONRA ekleniyor. O sırada
      // Leaflet'in ilk yerleşimi çoktan bitmiş oluyor ve MapLibre'nin çizim
      // döngüsü hiç başlamıyor: stil ve kaynak yükleniyor ama tek bir döşeme
      // bile istenmiyor, harita boş kalıyor. Tek bir resize bunu çözüyor.
      // Birkaç kez deniyoruz çünkü kap görünür hale gelirken boyut değişebilir.
      // Katman, dinamik import'lar bittikten SONRA ekleniyor; o sırada
      // Leaflet'in ilk yerleşimi çoktan bitmiş oluyor. Harita/liste geçişinde
      // de kap gizliyken boyutlanabiliyor. Bu yüzden MapLibre'ye kendi
      // boyutunu birkaç kez yeniden okutuyoruz.
      //
      // DİKKAT: nudge içinde map.invalidateSize() ÇAĞIRMA — Leaflet'in resize
      // olayını tetikler, o da bu işlevi yeniden çağırır; özyineleme aşağıdaki
      // catch tarafından sessizce yutulur ve hata hiç görünmez.
      nudge = () => { try { gl?.resize(); gl?.triggerRepaint(); } catch { /* yok say */ } };
      map.invalidateSize();
      gl?.on("styledata", nudge);
      for (const ms of [0, 300, 900, 1800]) timers.push(setTimeout(nudge, ms));
      map.on("resize", nudge);
    })().catch((e) => {
      // Altlık yüklenemezse harita boş kalmasın: işaretçiler yine çizilir.
      console.error("[map] altlık yüklenemedi:", e?.message);
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (nudge) map.off("resize", nudge);
      if (layer) {
        map.removeLayer(layer);
        map.attributionControl?.removeAttribution(ATTRIBUTION);
      }
    };
  }, [map]);

  return null;
}
