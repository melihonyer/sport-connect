// Lazy-loaded map component — react-leaflet ve leaflet sadece bu chunk'ta yüklenir
import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Activity } from "lucide-react";

// Leaflet default icon fix (Vite)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl:       new URL("leaflet/dist/images/marker-icon.png",    import.meta.url).href,
  shadowUrl:     new URL("leaflet/dist/images/marker-shadow.png",  import.meta.url).href,
});

const SPORT_COLORS = {
  Koşu:"#00b7ba", Bisiklet:"#009295", Yüzme:"#0284c7", Futbol:"#16a34a",
  Basketbol:"#d97706", Voleybol:"#7c3aed", Tenis:"#b45309", Padel:"#b45309",
  Yoga:"#9333ea", Pilates:"#db2777", Crossfit:"#dc2626", Triatlon:"#0891b2",
  Kano:"#0369a1", Kürek:"#1d4ed8", Trekking:"#15803d", Diğer:"#00b7ba",
};

const makeTrainingIcon = (color, letter, highlight = false) => {
  const size = highlight ? 40 : 34;
  const shadow = highlight
    ? `0 0 0 4px ${color}33, 0 4px 16px ${color}66`
    : `0 3px 10px ${color}55`;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:linear-gradient(135deg,${color},${color}cc);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;box-shadow:${shadow};display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:white;font-weight:900;font-size:${highlight?15:13}px;font-family:'Montserrat',system-ui,sans-serif;line-height:1;letter-spacing:-0.5px;">${letter}</span>
    </div>`,
    iconSize: [size, size], iconAnchor: [size/2, size], popupAnchor: [0, -(size+4)],
  });
};

// Ücretli etkinlik pini — verilen SVG grafiği (yatay kuşak/banner + altta damla işaretçi).
// Yarışın adı bannerın ortasına HTML metin olarak bindirilir; sığmazsa CSS ile "…" olur.
// Konum noktası = işaretçinin alt ucu (iconAnchor).
const PAID_COLOR = "#981dd8"; // işaretçi moru — popup aksanı da bunu kullanır
const PAID_TEXT = "#ffffff";  // banner marka yeşili (#00b7ba) → beyaz metin
const PAID_PIN_URL = "/pin-ucretli.svg";
const PAID_PIN_RATIO = 86.2 / 194.1; // SVG yükseklik/genişlik oranı (194.1x86.2)
// Banner metin bandı konumu — SVG'ye göre yüzdelik.
const RIBBON_TOP = 11, RIBBON_HEIGHT = 36, RIBBON_INSET = 8; // %
const escapeXml = (s) => String(s || "").replace(/[<>&'"]/g, c => (
  { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
const makePaidIcon = (title, highlight = false) => {
  const w = highlight ? 150 : 128;
  const h = Math.round(w * PAID_PIN_RATIO);
  const fs = Math.max(11, Math.round(w * 0.105));
  const label = escapeXml((title || "").toLocaleUpperCase("tr-TR"));
  const html = `<div style="position:relative;width:${w}px;height:${h}px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.32))">
    <img src="${PAID_PIN_URL}" style="width:${w}px;height:${h}px;display:block" alt=""/>
    <div style="position:absolute;left:${RIBBON_INSET}%;right:${RIBBON_INSET}%;top:${RIBBON_TOP}%;height:${RIBBON_HEIGHT}%;display:flex;align-items:center;justify-content:center;">
      <span style="font-family:'Montserrat',system-ui,sans-serif;font-weight:800;font-size:${fs}px;line-height:1;color:${PAID_TEXT};text-shadow:0 1px 2px rgba(0,0,0,.28);text-transform:uppercase;letter-spacing:-0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${label}</span>
    </div>
  </div>`;
  return L.divIcon({
    className: "",
    html,
    iconSize: [w, h], iconAnchor: [w / 2, h * 0.98], popupAnchor: [0, -h * 0.95],
  });
};

// Mount sonrası Leaflet'in iç ölçümünü tazele — lazy-load sırasında 0-genişlikle
// başlayan harita yanlış boyutta kalıp sayfa düzenini bozabiliyor.
const MapSizeFixer = () => {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, []); // eslint-disable-line
  return null;
};

const FitBoundsToTrainings = ({ trainings }) => {
  const map = useMap();
  useEffect(() => {
    if (!trainings.length) return;
    const bounds = L.latLngBounds(trainings.map(t => [parseFloat(t.location_lat), parseFloat(t.location_lng)]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
  }, [trainings, map]);
  return null;
};

const extractDominantColor = async (url) => {
  try {
    const res = await fetch(`/api/color-extract?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const { color } = await res.json();
    return color || null;
  } catch { return null; }
};

const fmtDateShort = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("tr-TR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
};

const TrainingsMapView = ({ trainings, onSelectTraining, t, containerStyle }) => {
  const [active, setActive] = useState(null);
  const [teamColors, setTeamColors] = useState({});
  const processingRef = useRef(new Set());
  const mapped = trainings.filter(tr => tr.location_lat && tr.location_lng);

  useEffect(() => {
    mapped.forEach(tr => {
      const { team_id, team_avatar } = tr;
      if (teamColors[team_id] !== undefined || processingRef.current.has(team_id)) return;
      const isUrl = typeof team_avatar === "string" && team_avatar.startsWith("http");
      if (!isUrl) { setTeamColors(prev => ({ ...prev, [team_id]: null })); return; }
      processingRef.current.add(team_id);
      extractDominantColor(team_avatar).then(hex => {
        processingRef.current.delete(team_id);
        setTeamColors(prev => ({ ...prev, [team_id]: hex ?? null }));
      });
    });
  }, [mapped.map(tr => tr.team_id).join(",")]); // eslint-disable-line

  return (
    <div className="relative isolate rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: "600px", ...containerStyle }}>
      {trainings.length > mapped.length && (
        <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/90 backdrop-blur border border-slate-200 shadow-sm text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-slate-400"/>
          {mapped.length}/{trainings.length} {t ? t("map.trainingsOnMap") : "trainings on map"}
        </div>
      )}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/90 backdrop-blur border border-slate-200 shadow-sm" style={{ color:"#009295" }}>
        <Activity className="w-3.5 h-3.5"/>
        {mapped.length} {t ? t("map.trainingsCount") : "trainings"}
      </div>

      {mapped.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center bg-slate-50 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background:"rgba(0,183,186,0.1)" }}>
            <MapPin className="w-8 h-8 text-brand-400"/>
          </div>
          <p className="text-slate-500 font-medium text-sm">{t ? t("map.noLocationData") : "No location data"}</p>
          <p className="text-slate-400 text-xs">{t ? t("map.noLocationHint") : "Add a location when creating a training"}</p>
        </div>
      ) : (
        <MapContainer center={[39.0, 35.0]} zoom={6} style={{ height:"100%", width:"100%" }} zoomControl={true}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          <MapSizeFixer/>
          <FitBoundsToTrainings trainings={mapped}/>
          {mapped.map(tr => {
            const teamLetter = (tr.team_name || tr.team_sport || "T").charAt(0).toLocaleUpperCase("en-US");
            const teamColor  = tr.is_paid ? PAID_COLOR : (teamColors[tr.team_id] || SPORT_COLORS[tr.sport || tr.team_sport] || "#00b7ba");
            const icon = tr.is_paid
              ? makePaidIcon(tr.title, active === tr.id)
              : makeTrainingIcon(teamColor, teamLetter, active === tr.id);
            return (
              <Marker
                key={`${tr.id}-${teamColor}`}
                position={[parseFloat(tr.location_lat), parseFloat(tr.location_lng)]}
                icon={icon}
                eventHandlers={{ click: () => setActive(tr.id), popupclose: () => setActive(null) }}
              >
                <Popup className="training-map-popup" minWidth={220} maxWidth={280}>
                  <div style={{ fontFamily:"system-ui,sans-serif", padding:"4px 0" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"8px" }}>
                      {tr.is_paid && <span style={{ display:"inline-block", padding:"2px 8px", background:"#00b7ba", color:"#fff", borderRadius:"6px", fontSize:"11px", fontWeight:800 }}>Ücretli</span>}
                      <span style={{ display:"inline-block", padding:"2px 8px", background:`${teamColor}18`, color:teamColor, borderRadius:"6px", fontSize:"11px", fontWeight:700 }}>{tr.sport || tr.team_sport || "Spor"}</span>
                      {!tr.is_paid && tr.difficulty && <span style={{ fontSize:"11px", color:"#94a3b8" }}>{tr.difficulty}</span>}
                    </div>
                    <div style={{ fontWeight:700, fontSize:"14px", color:"#0f172a", marginBottom:"4px", lineHeight:1.3 }}>{tr.title}</div>
                    <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"8px" }}>{tr.is_paid ? (tr.organizer || "") : tr.team_name}</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"4px", marginBottom:"12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#475569" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {fmtDateShort(tr.training_date)}{tr.training_time ? ` · ${tr.training_time.slice(0,5)}` : ""}
                      </div>
                      {tr.location_name && (
                        <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#475569" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"190px" }}>{tr.location_name}</span>
                        </div>
                      )}
                      {!tr.is_paid && (
                      <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#475569" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        {tr.attendee_count || 0} / {tr.capacity} katılımcı
                      </div>
                      )}
                    </div>
                    <button onClick={() => onSelectTraining(tr.id)} style={{ width:"100%", padding:"8px 0", borderRadius:"8px", border:"none", cursor:"pointer", background:`linear-gradient(135deg,${teamColor},${teamColor}cc)`, color:"white", fontSize:"12px", fontWeight:700 }}>
                      Detayı Gör →
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
};

export default TrainingsMapView;
