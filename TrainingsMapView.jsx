// Lazy-loaded map component — react-leaflet ve leaflet sadece bu chunk'ta yüklenir
import React, { useState, useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import VectorBasemap from "./VectorBasemap.jsx";
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
  Koşu:"#114956", Bisiklet:"#0e3c47", Yüzme:"#0e3c47", Futbol:"#16a34a",
  Basketbol:"#d97706", Voleybol:"#7c3aed", Tenis:"#b45309", Padel:"#b45309",
  Yoga:"#9333ea", Pilates:"#db2777", Crossfit:"#dc2626", Triatlon:"#0e3c47",
  Kano:"#0369a1", Kürek:"#1d4ed8", Trekking:"#15803d", Diğer:"#114956",
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

// Ücretli etkinlik pini — verilen damla-pin SVG'si (mor→teal gradient).
// Yarışın adı pinin SOLUNA, kalın siyah büyük harf olarak yazılır (harita üzerinde
// okunurluk için beyaz hâle/halo verilir). Konum noktası = pinin alt ucu (iconAnchor).
const PAID_COLOR = "#7b2fb0"; // popup aksanı — pin gradient moruna yakın
const PAID_PIN_URL = "/pin-ucretli.svg";
const PAID_PIN_RATIO = 320.4 / 215.3; // SVG yükseklik/genişlik oranı (dikey pin)
const PAID_TIP_X = 107.9 / 215.3;     // pin ucunun yatay konumu (≈ merkez)
const escapeXml = (s) => String(s || "").replace(/[<>&'"]/g, c => (
  { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
const makePaidIcon = (title, highlight = false) => {
  const pw = highlight ? 56 : 46;                 // pin genişliği
  const ph = Math.round(pw * PAID_PIN_RATIO);     // pin yüksekliği
  const labelW = highlight ? 128 : 116;           // ad etiketi kutusu
  const gap = 5;
  const fs = highlight ? 14 : 12.5;
  const label = escapeXml((title || "").toLocaleUpperCase("tr-TR"));
  const halo = "0 0 3px #fff,0 0 3px #fff,0 1px 2px #fff,0 -1px 2px #fff,1px 0 2px #fff,-1px 0 2px #fff";
  const html = `<div style="display:flex;align-items:center;gap:${gap}px;width:${labelW + gap + pw}px;height:${ph}px;">
    <span style="flex:0 0 ${labelW}px;text-align:right;font-family:'Montserrat',system-ui,sans-serif;font-weight:800;font-size:${fs}px;line-height:1.07;color:#171717;text-transform:uppercase;letter-spacing:-0.3px;text-shadow:${halo};word-break:break-word;">${label}</span>
    <img src="${PAID_PIN_URL}" style="flex:0 0 ${pw}px;width:${pw}px;height:${ph}px;display:block;filter:drop-shadow(0 3px 5px rgba(0,0,0,.3));" alt=""/>
  </div>`;
  const anchorX = labelW + gap + Math.round(pw * PAID_TIP_X);
  return L.divIcon({
    className: "",
    html,
    iconSize: [labelW + gap + pw, ph],
    iconAnchor: [anchorX, ph],
    popupAnchor: [Math.round(pw * PAID_TIP_X) - Math.round(pw / 2), -ph + 6],
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
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/90 backdrop-blur border border-slate-200 shadow-sm" style={{ color:"#0e3c47" }}>
        <Activity className="w-3.5 h-3.5"/>
        {mapped.length} {t ? t("map.trainingsCount") : "trainings"}
      </div>

      {mapped.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center bg-slate-50 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background:"rgba(17,73,86,0.1)" }}>
            <MapPin className="w-8 h-8 text-brand-400"/>
          </div>
          <p className="text-slate-500 font-medium text-sm">{t ? t("map.noLocationData") : "No location data"}</p>
          <p className="text-slate-400 text-xs">{t ? t("map.noLocationHint") : "Add a location when creating a training"}</p>
        </div>
      ) : (
        <MapContainer center={[39.0, 35.0]} zoom={6} style={{ height:"100%", width:"100%" }} zoomControl={true} className="muuv-map">
          <VectorBasemap/>
          <MapSizeFixer/>
          <FitBoundsToTrainings trainings={mapped}/>
          {mapped.map(tr => {
            const teamLetter = (tr.team_name || tr.team_sport || "T").charAt(0).toLocaleUpperCase("en-US");
            const teamColor  = tr.is_paid ? PAID_COLOR : (teamColors[tr.team_id] || SPORT_COLORS[tr.sport || tr.team_sport] || "#114956");
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
                    <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                      <div style={{ flex:"1 1 auto", minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"8px", flexWrap:"wrap" }}>
                          {tr.is_paid && <span style={{ display:"inline-block", padding:"2px 8px", background:"#114956", color:"#fff", borderRadius:"6px", fontSize:"11px", fontWeight:800 }}>Ücretli</span>}
                          <span style={{ display:"inline-block", padding:"2px 8px", background:`${teamColor}18`, color:teamColor, borderRadius:"6px", fontSize:"11px", fontWeight:700 }}>{tr.sport || tr.team_sport || "Spor"}</span>
                          {!tr.is_paid && tr.difficulty && <span style={{ fontSize:"11px", color:"#94a3b8" }}>{tr.difficulty}</span>}
                        </div>
                        <div style={{ fontWeight:700, fontSize:"14px", color:"#0f172a", marginBottom:"4px", lineHeight:1.3 }}>{tr.title}</div>
                        <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"8px" }}>{tr.is_paid ? (tr.organizer || "") : tr.team_name}</div>
                      </div>
                      {tr.is_paid && tr.image_url && (
                        <img src={tr.image_url} alt="" style={{ flex:"0 0 auto", width:"52px", height:"52px", borderRadius:"8px", objectFit:"cover", border:"1px solid #e2e8f0" }}/>
                      )}
                    </div>
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
