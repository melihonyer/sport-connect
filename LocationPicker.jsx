// Ortak konum seçici — adres arama + "benim konumum" + haritadan seçme.
// Hem ana uygulamada (etkinlik oluştur/düzenle) hem admin panelinde (ücretli etkinlik)
// birebir aynı bileşen kullanılır. t / lang / isNative dışarıdan prop olarak verilir.
import React, { useState, useRef } from "react";
import {
  Loader2, Search, MapPin, Navigation2, ArrowLeft, X, CheckCircle, AlertTriangle,
} from "lucide-react";

const LocationPickerMapLazy = React.lazy(() => import("./LocationPickerMap"));

const _hav = (a, b) => { const R=6371,dL=(b.lat-a.lat)*Math.PI/180,dN=(b.lng-a.lng)*Math.PI/180,x=Math.sin(dL/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dN/2)**2; return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); };
const _fmtDist = (km) => km < 1 ? `${Math.round(km*1000)} m` : `${km.toFixed(1)} km`;

const _PLACE_LABELS = {
  village:       { tr:"Köy/Mahalle", en:"Village",     de:"Dorf"        },
  hamlet:        { tr:"Köy/Mahalle", en:"Village",     de:"Dorf"        },
  suburb:        { tr:"Mahalle",     en:"Suburb",      de:"Vorort"      },
  neighbourhood: { tr:"Mahalle",     en:"Neighborhood",de:"Viertel"     },
  quarter:       { tr:"Mahalle",     en:"Quarter",     de:"Viertel"     },
  city:          { tr:"Şehir",       en:"City",        de:"Stadt"       },
  town:          { tr:"Şehir",       en:"Town",        de:"Ort"         },
  cafe:          { tr:"Kafe",        en:"Café",        de:"Café"        },
  restaurant:    { tr:"Restoran",    en:"Restaurant",  de:"Restaurant"  },
  fast_food:     { tr:"Restoran",    en:"Restaurant",  de:"Restaurant"  },
  gym:           { tr:"Spor",        en:"Gym",         de:"Fitnessstudio"},
  sports_centre: { tr:"Spor",        en:"Sports",      de:"Sport"       },
  swimming_pool: { tr:"Havuz",       en:"Pool",        de:"Schwimmbad"  },
  park:          { tr:"Park",        en:"Park",        de:"Park"        },
  garden:        { tr:"Park",        en:"Garden",      de:"Garten"      },
  school:        { tr:"Okul",        en:"School",      de:"Schule"      },
  university:    { tr:"Okul",        en:"University",  de:"Universität" },
  hospital:      { tr:"Sağlık",      en:"Hospital",    de:"Krankenhaus" },
  clinic:        { tr:"Sağlık",      en:"Clinic",      de:"Klinik"      },
  stadium:       { tr:"Spor",        en:"Stadium",     de:"Stadion"     },
  beach:         { tr:"Sahil",       en:"Beach",       de:"Strand"      },
};
const _placeType = (cls, typ, lang="tr") => {
  const l = lang === "en" ? "en" : lang === "de" ? "de" : "tr";
  const entry = _PLACE_LABELS[typ];
  if (entry) {
    const color = {
      village:"#15803d",hamlet:"#15803d",suburb:"#7c3aed",neighbourhood:"#7c3aed",quarter:"#7c3aed",
      city:"#0891b2",town:"#0891b2",cafe:"#d97706",restaurant:"#ea580c",fast_food:"#ea580c",
      gym:"#0891b2",sports_centre:"#0891b2",swimming_pool:"#0284c7",park:"#16a34a",garden:"#16a34a",
      school:"#64748b",university:"#64748b",hospital:"#dc2626",clinic:"#dc2626",
      stadium:"#0891b2",beach:"#f59e0b",
    }[typ] || "#114956";
    return { label: entry[l] || entry.en, color };
  }
  if (cls==="natural")  return { label: {tr:"Doğa", en:"Nature",  de:"Natur" }[l],   color:"#15803d" };
  if (cls==="highway")  return { label: {tr:"Sokak", en:"Street",  de:"Straße"}[l],   color:"#94a3b8" };
  if (cls==="shop")     return { label: {tr:"Mağaza", en:"Shop",   de:"Geschäft"}[l], color:"#9333ea" };
  return { label: {tr:"Yer", en:"Place", de:"Ort"}[l], color:"#114956" };
};

export default function LocationPicker({ locationName, lat, lng, onLocationName, onLat, onLng, t, lang, isNative }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [gettingGPS, setGettingGPS] = useState(false);
    const [locationError, setLocationError] = useState(null);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [pickedPos, setPickedPos] = useState(null);       // {lat, lng} — onay bekliyor
    const [confirming, setConfirming] = useState(false);   // reverse geocode yükleniyor
    const [mapQuery, setMapQuery] = useState("");
    const [mapResults, setMapResults] = useState([]);
    const [mapSearching, setMapSearching] = useState(false);
    const [flyTarget, setFlyTarget] = useState(null);
    const [mapBounds, setMapBounds] = useState(null);
    const debounceRef = useRef(null);

    const mapCenter = mapBounds ? (() => { const c = mapBounds.getCenter(); return { lat: c.lat, lng: c.lng }; })() : null;

    // Nominatim araması — Türkiye öncelikli, viewbox ile konum bias
    const searchPlaces = async (q) => {
      if (!q.trim()) { setMapResults([]); return; }
      setMapSearching(true);
      try {
        // Görünür alan bias (bounded olmadan — sadece öncelik verir)
        let viewbox = "";
        if (mapBounds) {
          const sw = mapBounds.getSouthWest(), ne = mapBounds.getNorthEast();
          viewbox = `&viewbox=${sw.lng},${ne.lat},${ne.lng},${sw.lat}`;
        }
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1&countrycodes=tr${viewbox}`,
          { headers: { "Accept-Language": lang } }
        );
        const data = await res.json();
        setMapResults(data.map(r => ({
          id: r.place_id,
          lat: parseFloat(r.lat), lng: parseFloat(r.lon),
          name: r.name || r.display_name.split(",")[0],
          subtitle: r.display_name.split(",").slice(1, 4).join(",").trim(),
          type: _placeType(r.class, r.type, lang),
          dist: mapCenter ? _hav(mapCenter, { lat: parseFloat(r.lat), lng: parseFloat(r.lon) }) : null,
        })));
      } catch {} finally { setMapSearching(false); }
    };

    const showError = (msg) => {
      setLocationError(msg);
      setTimeout(() => setLocationError(null), 8000);
    };

    const searchAddress = async () => {
      if (!query.trim()) return;
      setSearching(true);
      setResults([]);
      setLocationError(null);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": lang } }
        );
        const data = await res.json();
        if (data.length === 0) showError(t("location.noResult"));
        setResults(data);
      } catch {
        showError(t("toast.searchFail"));
      } finally {
        setSearching(false);
      }
    };

    const selectResult = (r) => {
      onLocationName(r.display_name.split(",").slice(0, 3).join(", "));
      onLat(parseFloat(r.lat));
      onLng(parseFloat(r.lon));
      setResults([]);
      setQuery("");
      setLocationError(null);
    };

    const applyLocation = async (latitude, longitude) => {
      onLat(latitude);
      onLng(longitude);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          { headers: { "Accept-Language": lang } }
        );
        const data = await res.json();
        const name = data.display_name?.split(",").slice(0, 3).join(", ") || locationName;
        onLocationName(name);
      } catch { /* konum adı doldurulamazsa mevcut kalır */ }
    };

    const useMyLocation = () => {
      if (!navigator.geolocation) {
        showError(t("location.noGeo"));
        return;
      }
      setGettingGPS(true);
      setLocationError(null);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          await applyLocation(latitude, longitude);
          setGettingGPS(false);
        },
        (err) => {
          setGettingGPS(false);
          if (err.code === 1) {
            showError(t("location.denied"));
          } else if (err.code === 2) {
            showError(t("location.gpsUnavailable"));
          } else {
            showError(t("location.gpsTimedOut"));
          }
        },
        { timeout: 15000, maximumAge: 60000, enableHighAccuracy: false }
      );
    };

    return (
      <div className="space-y-3">
        {/* Adres arama */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("location.searchLabel")}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchAddress())}
              placeholder={t("location.searchPlaceholder")}
              className="flex-1 px-4 py-2 border rounded-xl text-sm"
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={searching}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60 flex items-center gap-1"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-1 border rounded-xl overflow-hidden shadow-lg z-10 bg-white">
              {results.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="w-full text-left px-4 py-3 hover:bg-brand-50 text-sm border-b last:border-0 flex items-start gap-2"
                >
                  <MapPin className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Konum butonları */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={gettingGPS}
            className="flex-1 flex items-center justify-center gap-2 text-sm px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 disabled:opacity-60 transition-colors"
          >
            {gettingGPS ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation2 className="w-4 h-4" />}
            <span>{t("location.useMyLocation")}</span>
          </button>
          <button
            type="button"
            onClick={() => { setPickedPos(lat && lng ? { lat: Number(lat), lng: Number(lng) } : null); setShowMapPicker(true); }}
            className="flex-1 flex items-center justify-center gap-2 text-sm px-3 py-2.5 bg-brand-50 hover:bg-brand-100 rounded-xl text-brand-700 transition-colors border border-brand-200"
          >
            <MapPin className="w-4 h-4" />
            <span>{t("trainings.selectFromMap")}</span>
          </button>
        </div>

        {/* ── Harita Seçici Modal ── */}
        {showMapPicker && (
          <div className="fixed inset-0 flex flex-col bg-white"
            style={{
              // BottomNav (zIndex 999999) tam ekran seçicinin üstünde kalıp
              // "Bu Konumu Kullan" butonunu örtüyordu — modalı onun da üstüne al.
              zIndex: 1000000,
              // Native'de başlık status bar'ın, buton da home indicator'ın altında
              // kalmasın diye güvenli alan boşlukları.
              ...(isNative ? { paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" } : {}),
            }}>

            {/* Başlık */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
              <button type="button" onClick={() => { setShowMapPicker(false); setMapResults([]); setMapQuery(""); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors flex-shrink-0">
                <ArrowLeft className="w-5 h-5 text-slate-600"/>
              </button>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{t("location.mapPickerTitle")}</p>
                <p className="text-xs text-slate-400">{t("location.mapPickerHint")}</p>
              </div>
              {pickedPos && (
                <span className="ml-auto flex-shrink-0 text-xs text-brand-600 font-medium bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
                  {Number(pickedPos.lat).toFixed(4)}, {Number(pickedPos.lng).toFixed(4)}
                </span>
              )}
            </div>

            {/* Arama kutusu */}
            <div className="px-3 py-2.5 border-b border-slate-100 bg-white flex-shrink-0 relative">
              <div className="relative">
                {mapSearching
                  ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400 animate-spin pointer-events-none"/>
                  : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                }
                <input
                  type="text"
                  value={mapQuery}
                  onChange={e => {
                    const v = e.target.value;
                    setMapQuery(v);
                    clearTimeout(debounceRef.current);
                    if (v.trim().length > 1) {
                      debounceRef.current = setTimeout(() => searchPlaces(v), 400);
                    } else {
                      setMapResults([]);
                    }
                  }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(debounceRef.current); searchPlaces(mapQuery); } }}
                  placeholder={t("location.mapSearchPlaceholder")}
                  className="w-full pl-9 pr-8 h-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-slate-50 focus:bg-white transition-colors"
                />
                {mapQuery && (
                  <button type="button" onClick={() => { setMapQuery(""); setMapResults([]); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4"/>
                  </button>
                )}
              </div>

              {/* Sonuçlar dropdown */}
              {mapResults.length > 0 && (
                <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[700] overflow-hidden max-h-72 overflow-y-auto">
                  {mapResults.map((r, i) => (
                    <button key={r.id ?? i} type="button"
                      onClick={() => {
                        const pos = { lat: r.lat, lng: r.lng };
                        setPickedPos(pos); setFlyTarget(pos);
                        setMapResults([]); setMapQuery(r.name);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${r.type.color}18` }}>
                        <MapPin className="w-4 h-4" style={{ color: r.type.color }}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                        {r.subtitle && <p className="text-xs text-slate-400 truncate">{r.subtitle}</p>}
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: `${r.type.color}18`, color: r.type.color }}>
                          {r.type.label}
                        </span>
                        {r.dist != null && <span className="text-xs text-slate-400">{_fmtDist(r.dist)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Sonuç yok */}
              {!mapSearching && mapResults.length === 0 && mapQuery.trim().length > 2 && (
                <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[700] px-4 py-3 text-sm text-slate-400 text-center">
                  {t("common.noResults")}
                </div>
              )}
            </div>

            {/* Harita */}
            <div className="flex-1 relative">
              {!pickedPos && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 bg-white/95 backdrop-blur rounded-xl shadow-md border border-slate-200 text-xs text-slate-600 font-medium flex items-center gap-2 pointer-events-none whitespace-nowrap">
                  <MapPin className="w-3.5 h-3.5 text-brand-500"/>
                  {t("location.tapToDrop")}
                </div>
              )}
              {/* Konumuma git butonu */}
              <button
                type="button"
                title={t("location.useMyLocation")}
                onClick={() => {
                  if (!navigator.geolocation) return;
                  setGettingGPS(true);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                      setPickedPos(p);
                      setFlyTarget(p);
                      setGettingGPS(false);
                    },
                    () => setGettingGPS(false),
                    { timeout: 8000, enableHighAccuracy: false }
                  );
                }}
                className="absolute bottom-10 right-3 z-[1000] w-10 h-10 bg-white rounded-xl shadow-md border border-slate-200 flex items-center justify-center hover:bg-brand-50 transition-colors"
              >
                {gettingGPS
                  ? <Loader2 className="w-5 h-5 text-brand-500 animate-spin"/>
                  : <Navigation2 className="w-5 h-5 text-brand-600"/>
                }
              </button>
              <React.Suspense fallback={<div className="h-full flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>}>
                <LocationPickerMapLazy
                  pickedPos={pickedPos}
                  flyTarget={flyTarget}
                  onPick={(pos) => { setPickedPos({ lat: pos.lat, lng: pos.lng }); setMapResults([]); }}
                  onDragEnd={(e) => { const p = e.target.getLatLng(); setPickedPos({ lat: p.lat, lng: p.lng }); }}
                  onBoundsChange={setMapBounds}
                />
              </React.Suspense>

            </div>

            {/* Alt onay butonu */}
            <div className="flex-shrink-0 px-4 py-4 border-t border-slate-200 bg-white">
              <button
                type="button"
                disabled={!pickedPos || confirming}
                onClick={async () => {
                  if (!pickedPos) return;
                  setConfirming(true);
                  await applyLocation(pickedPos.lat, pickedPos.lng);
                  setConfirming(false);
                  setShowMapPicker(false);
                  setMapQuery(""); setMapResults([]);
                }}
                className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity"
                style={{ background: "linear-gradient(135deg,#114956,#0e3c47)" }}
              >
                {confirming
                  ? <><Loader2 className="w-4 h-4 animate-spin"/>{t("location.gettingAddress")}</>
                  : pickedPos
                    ? <><CheckCircle className="w-4 h-4"/>{t("location.useThisLocation")}</>
                    : <><MapPin className="w-4 h-4"/>{t("location.tapToSelect")}</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Hata bildirimi */}
        {locationError && (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{locationError}</span>
            <button type="button" onClick={() => setLocationError(null)} className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Seçili konum */}
        {lat && lng && (
          <div className="flex items-center gap-2 px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-sm">
            <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-brand-800 truncate">{locationName || t("location.useThisLocation")}</div>
              <div className="text-brand-600 text-xs">{Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</div>
            </div>
            <button
              type="button"
              onClick={() => { onLat(null); onLng(null); onLocationName(""); }}
              className="ml-auto text-gray-400 hover:text-red-500 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Konum adı manuel düzenleme */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("location.locationName")} <span className="text-gray-400 font-normal">({t("location.visibleOnCards")})</span></label>
          <input
            type="text"
            value={locationName}
            onChange={(e) => onLocationName(e.target.value)}
            placeholder={t("location.searchPlaceholder")}
            className="w-full px-4 py-2 border rounded-xl text-sm"
            required
          />
        </div>
      </div>
  );
}
