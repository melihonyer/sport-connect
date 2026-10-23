// Etkinlik rotası haritası — etkinlik sayfasında ve oluştur/düzenle formundaki
// önizlemede. Tembel yüklenir: leaflet + maplibre yalnız rotası olan sayfada iner.
import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import VectorBasemap from "./VectorBasemap.jsx";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Kurumsal palet (tailwind.config.js): çizgi Ana1 teal (logo.teal) — "küçük öğe:
// ince çizgi" rolü; buluşma noktası Deep Teal (brand-600).
export const ROUTE_COLOR = "#00a499";
const MEET_COLOR = "#114956";

// Rotayı Etkinlikler haritasında da aynı görünümle çizmek için.
export const RouteLine = ({ points }) => (
  <>
    <Polyline positions={points} pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9, lineCap: "round", lineJoin: "round" }} interactive={false} />
    <Polyline positions={points} pathOptions={{ color: ROUTE_COLOR, weight: 4.5, opacity: 1, lineCap: "round", lineJoin: "round" }} interactive={false} />
  </>
);

const dotIcon = (fill) => L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${fill};border:3px solid ${ROUTE_COLOR};box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7],
});

const meetIcon = () => L.divIcon({
  className: "",
  html: `<div style="position:relative;width:32px;height:32px;">
    <div style="width:32px;height:32px;background:${MEET_COLOR};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 12px rgba(17,73,86,0.45);"></div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
      <div style="width:8px;height:8px;border-radius:50%;background:white;margin-top:-2px"></div>
    </div>
  </div>`,
  iconSize: [32, 32], iconAnchor: [16, 32],
});

// Kutu boyut alınca sığdır. Tembel yüklemede kap bir an 0 boyutlu oluyor; o anda
// sığdırınca rota ekran dışında kalıyordu (Etkinlikler haritasında yaşandı,
// CLAUDE.md "Harita kümeleme"). Kullanıcı haritayı oynatana kadar yeniden sığdırır.
const FitRoute = ({ bounds }) => {
  const map = useMap();
  const moved = useRef(false);
  useEffect(() => {
    const el = map.getContainer();
    const mark = () => { moved.current = true; };
    el.addEventListener("pointerdown", mark);
    el.addEventListener("wheel", mark, { passive: true });
    const fit = () => {
      if (moved.current || !el.clientWidth || !el.clientHeight) return;
      map.invalidateSize();
      // Sol üst +/− düğmeleri, alt atıf satırı: rota onların altında kalmasın.
      map.fitBounds(bounds, { paddingTopLeft: [56, 24], paddingBottomRight: [24, 40], animate: false });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.removeEventListener("pointerdown", mark);
      el.removeEventListener("wheel", mark);
    };
  }, [map, bounds]);
  return null;
};

const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export default function RouteMap({ points, meeting, className = "h-64" }) {
  const bounds = useMemo(() => {
    const all = meeting?.lat && meeting?.lng ? [...points, [Number(meeting.lat), Number(meeting.lng)]] : points;
    return L.latLngBounds(all);
  }, [points, meeting?.lat, meeting?.lng]);
  const start = points[0];
  const end = points[points.length - 1];
  // Başlangıç ile bitiş 50 m'den yakınsa (tur rotası) tek nokta yeter.
  const loop = L.latLng(start).distanceTo(L.latLng(end)) < 50;

  return (
    <div className={`relative isolate rounded-xl overflow-hidden border border-slate-200 ${className}`}>
      <MapContainer
        bounds={bounds}
        style={{ height: "100%", width: "100%" }}
        className="muuv-map"
        zoomControl={true}
        // Tam sayı yakınlıkta rota küçük kutuda yarı boş kalıyordu.
        zoomSnap={0.25}
        // Sayfa kaydırması haritaya takılmasın: tekerlek ile yakınlaşma kapalı,
        // dokunmatikte tek parmak sayfayı kaydırır (iki parmakla yakınlaşır).
        scrollWheelZoom={false}
        dragging={!isTouch}
      >
        <VectorBasemap />
        <FitRoute bounds={bounds} />
        <RouteLine points={points} />
        {!loop && <Marker position={end} icon={dotIcon(ROUTE_COLOR)} interactive={false} />}
        <Marker position={start} icon={dotIcon("#ffffff")} interactive={false} />
        {meeting?.lat && meeting?.lng && (
          <Marker position={[Number(meeting.lat), Number(meeting.lng)]} icon={meetIcon()} interactive={false} />
        )}
      </MapContainer>
    </div>
  );
}
