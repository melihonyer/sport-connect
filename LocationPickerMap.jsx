// Lazy-loaded map for LocationPicker — leaflet sadece konum seçici açıldığında yüklenir
import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl:       new URL("leaflet/dist/images/marker-icon.png",    import.meta.url).href,
  shadowUrl:     new URL("leaflet/dist/images/marker-shadow.png",  import.meta.url).href,
});

const makePickerIcon = () => L.divIcon({
  className: "",
  html: `<div style="position:relative;width:40px;height:40px;">
    <div style="width:40px;height:40px;background:linear-gradient(135deg,#114956,#0e3c47);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 4px 20px rgba(17,73,86,0.55);"></div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
      </svg>
    </div>
  </div>`,
  iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -44],
});

// Mount sonrası (ve container yeniden boyutlandığında) Leaflet'in iç ölçümünü tazele.
// Bunsuz, lazy-load/Suspense içinde geçici 0-genişlikle başlayan harita yanlış
// boyutta kalıp sayfa düzenini (overflow) bozabiliyor.
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

const FlyToLocation = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 0.8 });
  }, [target]); // eslint-disable-line
  return null;
};

const MapBoundsTracker = ({ onBoundsChange }) => {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });
  useEffect(() => { onBoundsChange(map.getBounds()); }, []); // eslint-disable-line
  return null;
};

const MapClickHandler = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick(e.latlng) });
  return null;
};

const LocationPickerMap = ({ pickedPos, flyTarget, onPick, onDragEnd, onBoundsChange }) => (
  <MapContainer
    center={pickedPos ? [pickedPos.lat, pickedPos.lng] : [39.0, 35.0]}
    zoom={pickedPos ? 14 : 6}
    style={{ height: "100%", width: "100%" }}
    zoomControl={true}
    className="muuv-map"
  >
    {/* Bkz. TrainingsMapView.jsx — CARTO anahtar istiyor, OSM'e geçildi. */}
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
    />
    <MapSizeFixer/>
    <FlyToLocation target={flyTarget}/>
    <MapBoundsTracker onBoundsChange={onBoundsChange}/>
    <MapClickHandler onPick={onPick}/>
    {pickedPos && (
      <Marker
        position={[pickedPos.lat, pickedPos.lng]}
        icon={makePickerIcon()}
        draggable={true}
        eventHandlers={{ dragend: onDragEnd }}
      />
    )}
  </MapContainer>
);

export default LocationPickerMap;
