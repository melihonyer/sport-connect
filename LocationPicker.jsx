// Ortak konum seçici — yazdıkça öneri + "benim konumum" + haritadan seçme.
// Hem ana uygulamada (etkinlik oluştur/düzenle) hem admin panelinde (ücretli etkinlik)
// birebir aynı bileşen kullanılır. t / lang / isNative dışarıdan prop olarak verilir.
//
// Neden bu yapı (Eylül 2026): eskiden "Konum Ara" ve zorunlu "Konum Adı" diye aynı
// örnek yazıyı taşıyan iki kutu vardı. İnsanlar alttakini doldurup geçiyor, koordinat
// hiç seçilmiyor, etkinlik haritada görünmüyordu. Artık TEK kutu var: yazdıkça öneri
// gelir, seçilince koordinat da gelir. Seçilmezse "haritada görünmeyecek" uyarısı durur.
//
// Öneriler Photon'dan (photon.komoot.io): Nominatim'in kullanım politikası yazdıkça
// aramayı yasaklıyor. Nominatim yalnız pin onaylanınca TEK bir ters sorgu için kalır.
// Aynı ad Türkiye'de onlarca yerde var (Kuşçular: Urla, Tarsus, Nazilli…), bu yüzden
// her öneride ilçe/il görünür ve bias verilirse yakın olan öne gelir.
import React, { useState, useRef, useEffect } from "react";
import {
  Loader2, Search, MapPin, Navigation2, ArrowLeft, X, CheckCircle, AlertTriangle, History,
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


const PHOTON_URL = "https://photon.komoot.io/api/";
// Photon sonucunu ortak öneri biçimine çevirir. Türkiye sonuçları önce; hiç yoksa diğerleri.
const photonSearch = async (q, { bias, limit = 6, signal, lang = "tr" } = {}) => {
  const params = new URLSearchParams({ q, limit: String(limit + 4) });
  if (bias && bias.lat != null && bias.lng != null) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  const res = await fetch(`${PHOTON_URL}?${params.toString()}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  const feats = (data.features || []).filter((f) => Array.isArray(f?.geometry?.coordinates));
  const tr = feats.filter((f) => f.properties?.countrycode === "TR");
  return (tr.length ? tr : feats).slice(0, limit).map((f) => {
    const p = f.properties || {};
    const [lng, lat] = f.geometry.coordinates;
    const name = p.name || p.street || p.city || q;
    const area = [p.district || p.locality, p.city || p.county, p.state]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i && v !== name);
    return {
      id: `${p.osm_type || ""}${p.osm_id || ""}-${lat}-${lng}`,
      lat, lng, name,
      subtitle: area.slice(0, 2).join(", "),
      area0: area[0] || "",
      type: _placeType(p.osm_key, p.osm_value, lang),
    };
  });
};
// Kartlarda görünecek kısa ad: "Kuşçular, Urla"
const suggestionLabel = (s) => (s.area0 ? `${s.name}, ${s.area0}` : s.name);
const hasNum = (v) => v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v));

export default function LocationPicker({
  locationName, lat, lng, onLocationName, onLat, onLng, t, lang, isNative,
  // Yeni (isteğe bağlı) — admin paneli bunları vermeden eskisi gibi çalışır:
  bias = null,              // {lat,lng}: öneriler bu noktaya yakın olanları öne alır
  needsAttention = false,   // form koordinatsız gönderilmek istendi: öneriler açılır, uyarı vurgulanır
  onContinueWithout,        // verilirse uyarıda "Konumsuz kaydet" düğmesi çıkar
  recentLocations = [],     // [{name,lat,lng,uses}] takımın/kişinin önceki konumları — ÖNERİ, otomatik doldurma değil
}) {
  // Çevirisi olmayan ortamlarda (admin paneli) anahtar yerine Türkçe yedeği göster.
  const tt = (key, fallback) => { const v = t ? t(key) : key; return !v || v === key ? fallback : v; };

  const [sugg, setSugg] = useState([]);
  const [suggOpen, setSuggOpen] = useState(false);
  const [suggLoading, setSuggLoading] = useState(false);
  const [suggFor, setSuggFor] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [touched, setTouched] = useState(false);
  const [gettingGPS, setGettingGPS] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickedPos, setPickedPos] = useState(null);       // {lat, lng} — onay bekliyor
  const [pickedLabel, setPickedLabel] = useState("");     // haritada aramadan seçilen yerin adı
  const [confirming, setConfirming] = useState(false);   // ters sorgu yükleniyor
  const [mapQuery, setMapQuery] = useState("");
  const [mapResults, setMapResults] = useState([]);
  const [mapSearching, setMapSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const debounceRef = useRef(null);
  const mapDebounceRef = useRef(null);
  const abortRef = useRef(null);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const hasCoords = hasNum(lat) && hasNum(lng);
  const text = locationName || "";
  const [focused, setFocused] = useState(false);
  // Önceki konumlar: kutu boşken hepsi, yazarken adı eşleşenler en üstte.
  // En son kullanılan yer, dışarıdan bias verilmediyse yakınlık için kullanılır.
  const recents = (Array.isArray(recentLocations) ? recentLocations : []).filter((r) => hasNum(r?.lat) && hasNum(r?.lng) && r?.name);
  const effBias = bias || (recents[0] ? { lat: Number(recents[0].lat), lng: Number(recents[0].lng) } : null);
  const needle = text.trim().toLocaleLowerCase("tr");
  const recentMatches = (needle ? recents.filter((r) => r.name.toLocaleLowerCase("tr").includes(needle)) : recents)
    .map((r) => ({
      id: `recent-${r.lat}-${r.lng}`, lat: Number(r.lat), lng: Number(r.lng), name: r.name, recent: true,
      subtitle: r.uses > 1 ? tt("location.usedTimes", "{n} kez kullanıldı").replace("{n}", r.uses) : tt("location.usedBefore", "Daha önce kullanıldı"),
    }));
  // Önceki konumlarla aynı noktadaki Photon önerileri tekrar gösterilmez.
  const photonItems = sugg.filter((s) => !recentMatches.some((r) => Math.abs(r.lat - s.lat) < 0.001 && Math.abs(r.lng - s.lng) < 0.001));
  const items = [...recentMatches, ...(needle ? photonItems : [])];
  const dropdownOpen = !hasCoords && ((suggOpen && needle) || (focused && !needle && recentMatches.length > 0));
  const mapCenter = mapBounds ? (() => { const c = mapBounds.getCenter(); return { lat: c.lat, lng: c.lng }; })() : null;

  const showError = (msg) => {
    setLocationError(msg);
    setTimeout(() => setLocationError(null), 8000);
  };

  const runSuggest = async (q) => {
    const query = (q || "").trim();
    if (query.length < 2) { setSugg([]); setSuggOpen(false); return; }
    abortRef.current?.abort?.();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSuggLoading(true);
    try {
      const list = await photonSearch(query, { bias: effBias, signal: ctrl.signal, lang });
      if (ctrl.signal.aborted) return;
      setSugg(list);
      setSuggFor(query);
      setActiveIdx(list.length ? 0 : -1);
      setSuggOpen(true);
    } catch { /* iptal ya da ağ hatası — sessiz */ }
    finally { if (!ctrl.signal.aborted) setSuggLoading(false); }
  };

  // Form koordinatsız gönderilmek istendiyse: bileşene kaydır, yazılan ad için önerileri aç.
  useEffect(() => {
    if (!needsAttention || hasCoords) return;
    rootRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    if (text.trim().length >= 2) runSuggest(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAttention]);

  useEffect(() => () => { clearTimeout(debounceRef.current); clearTimeout(mapDebounceRef.current); abortRef.current?.abort?.(); }, []);

  const selectSuggestion = (s) => {
    onLat(s.lat);
    onLng(s.lng);
    onLocationName(s.recent ? s.name : suggestionLabel(s));
    setSugg([]); setSuggOpen(false); setActiveIdx(-1);
    setLocationError(null);
  };

  const onTextChange = (v) => {
    onLocationName(v);
    clearTimeout(debounceRef.current);
    if (v.trim().length >= 3) debounceRef.current = setTimeout(() => runSuggest(v), 350);
    else { setSugg([]); setSuggOpen(false); }
  };

  const onTextKeyDown = (e) => {
    if (!dropdownOpen || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === "Enter" && activeIdx >= 0 && items[activeIdx]) { e.preventDefault(); selectSuggestion(items[activeIdx]); }
    else if (e.key === "Escape") { setSuggOpen(false); setFocused(false); }
  };

  // Haritada arama da Photon'la (yazdıkça); görünür alanın merkezi yakınlık için kullanılır.
  const searchPlaces = async (q) => {
    if (!q.trim()) { setMapResults([]); return; }
    setMapSearching(true);
    try {
      const list = await photonSearch(q, { bias: mapCenter || effBias, limit: 8, lang });
      setMapResults(list.map((r) => ({ ...r, dist: mapCenter ? _hav(mapCenter, { lat: r.lat, lng: r.lng }) : null })));
    } catch { /* sessiz */ } finally { setMapSearching(false); }
  };

  // Pin onaylanınca: kullanıcının yazdığı ad varsa KORUNUR (ör. "Gelinkaya" açık haritada yok,
  // ters sorgu "Zeytineli, Urla" derdi). Ad yoksa tek bir Nominatim ters sorgusuyla doldurulur.
  const applyLocation = async (latitude, longitude, preferredName = "") => {
    onLat(latitude);
    onLng(longitude);
    if (preferredName) { onLocationName(preferredName); return; }
    if (text.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        { headers: { "Accept-Language": lang || "tr" } }
      );
      const data = await res.json();
      const name = data.display_name?.split(",").slice(0, 3).join(", ");
      if (name) onLocationName(name);
    } catch { /* ad doldurulamazsa boş kalır, kullanıcı yazar */ }
  };

  const openMap = (prefill = "") => {
    setPickedPos(hasCoords ? { lat: Number(lat), lng: Number(lng) } : null);
    setPickedLabel("");
    if (!hasCoords && effBias) setFlyTarget({ lat: Number(effBias.lat), lng: Number(effBias.lng) });
    setSuggOpen(false);
    setShowMapPicker(true);
    if (prefill.trim()) { setMapQuery(prefill); searchPlaces(prefill); }
  };

  const closeMap = () => { setShowMapPicker(false); setMapResults([]); setMapQuery(""); setPickedLabel(""); };

  const useMyLocation = () => {
    if (!navigator.geolocation) { showError(t("location.noGeo")); return; }
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
        if (err.code === 1) showError(t("location.denied"));
        else if (err.code === 2) showError(t("location.gpsUnavailable"));
        else showError(t("location.gpsTimedOut"));
      },
      { timeout: 15000, maximumAge: 60000, enableHighAccuracy: false }
    );
  };

  const showUnresolved = !hasCoords && text.trim() && !dropdownOpen && (touched || needsAttention);

  return (
    <div ref={rootRef} className="space-y-3">
      {hasCoords ? (
        /* Seçili konum: kartlarda görünecek ad buradan düzenlenir */
        <div className="px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0 mt-2.5" />
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-brand-700 mb-1">
                {tt("location.labelOnCards", "Kartlarda görünecek ad")}
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => onLocationName(e.target.value)}
                className="w-full px-3 py-2 border border-brand-200 bg-white rounded-lg text-base sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-300"
                required
              />
              <div className="text-brand-600 text-xs mt-1">{Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</div>
            </div>
            <button
              type="button"
              onClick={() => { onLat(null); onLng(null); setTouched(true); setTimeout(() => inputRef.current?.focus?.(), 0); }}
              className="flex-shrink-0 text-xs font-medium text-brand-700 hover:text-brand-900 px-2 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
            >
              {tt("location.change", "Değiştir")}
            </button>
          </div>
        </div>
      ) : (
        /* Tek kutu: yazdıkça öneri */
        <div className="relative">
          <div className="relative">
            {suggLoading
              ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400 animate-spin pointer-events-none" />
              : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />}
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={onTextKeyDown}
              onFocus={() => { setFocused(true); setActiveIdx(0); if (sugg.length && suggFor === text.trim()) setSuggOpen(true); }}
              onBlur={() => { setTouched(true); setTimeout(() => { setSuggOpen(false); setFocused(false); }, 150); }}
              placeholder={tt("location.typeToSearch", "Yer adı yaz, listeden seç (örn: Kuşçular, Urla)")}
              autoComplete="off"
              className={`w-full pl-9 pr-4 h-12 border rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 ${needsAttention && !hasCoords ? "border-amber-400" : "border-slate-200"}`}
              required
            />
          </div>

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
              {recentMatches.length > 0 && (
                <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> {tt("location.recentTitle", "Önceki konumlar")}
                </div>
              )}
              {items.map((s, i) => (
                <React.Fragment key={s.id}>
                  {!s.recent && i === recentMatches.length && recentMatches.length > 0 && (
                    <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-t border-slate-100">
                      {tt("location.otherPlaces", "Diğer yerler")}
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors ${i === activeIdx ? "bg-brand-50" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: s.recent ? "#11495618" : `${s.type.color}18` }}>
                      {s.recent
                        ? <History className="w-4 h-4" style={{ color: "#114956" }} />
                        : <MapPin className="w-4 h-4" style={{ color: s.type.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                      {s.subtitle && <p className="text-xs text-slate-500 truncate">{s.subtitle}</p>}
                    </div>
                    {!s.recent && (
                      <span className="flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${s.type.color}18`, color: s.type.color }}>
                        {s.type.label}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              ))}
              {needle && suggOpen && !suggLoading && items.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">
                  {tt("location.noSuggestions", "Öneri bulunamadı. Yeri haritada işaretleyebilirsin.")}
                </div>
              )}
              {needle && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => openMap(text)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-brand-700 bg-slate-50 hover:bg-brand-50 border-t border-slate-100"
                >
                  <MapPin className="w-4 h-4" /> {tt("location.markOnMap", "Haritada işaretle")}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Seçilmedi: haritada görünmeyecek */}
      {showUnresolved && (
        <div className={`px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm ${needsAttention ? "ring-2 ring-amber-300" : ""}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-amber-900">{tt("location.unresolvedTitle", "Bu konum haritada görünmeyecek")}</p>
              <p className="text-amber-800 mt-0.5 leading-snug">
                {tt("location.unresolvedDesc", "Listeden bir öneri seç ya da yeri haritada işaretle. Böylece etkinliğin haritada ve \"Yakınımda\" aramasında çıkar.")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3 pl-6">
            <button type="button" onClick={() => runSuggest(text)}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors">
              {tt("location.showSuggestions", "Önerileri göster")}
            </button>
            <button type="button" onClick={() => openMap(text)}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {tt("location.markOnMap", "Haritada işaretle")}
            </button>
            {needsAttention && onContinueWithout && (
              <button type="button" onClick={onContinueWithout}
                className="px-2 py-2 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950">
                {tt("location.continueWithout", "Konumsuz kaydet")}
              </button>
            )}
          </div>
        </div>
      )}

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
          onClick={() => openMap(hasCoords ? "" : text)}
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
            // Native'de başlık status bar'ın, buton da home indicator'ın altında kalmasın.
            ...(isNative ? { paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" } : {}),
          }}>

          {/* Başlık */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
            <button type="button" onClick={closeMap}
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
                  clearTimeout(mapDebounceRef.current);
                  if (v.trim().length > 1) mapDebounceRef.current = setTimeout(() => searchPlaces(v), 400);
                  else setMapResults([]);
                }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(mapDebounceRef.current); searchPlaces(mapQuery); } }}
                placeholder={t("location.mapSearchPlaceholder")}
                className="w-full pl-9 pr-8 h-10 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-slate-50 focus:bg-white transition-colors"
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
                      setPickedLabel(suggestionLabel(r));
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
            {!mapSearching && mapResults.length === 0 && mapQuery.trim().length > 2 && !pickedLabel && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[700] px-4 py-3 text-sm text-slate-500 text-center">
                {tt("location.noSuggestionsMap", "Bulunamadı. Haritada yere dokunarak pin bırakabilirsin.")}
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
                    setPickedPos(p); setFlyTarget(p); setPickedLabel("");
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
                // Haritaya elle dokunmak = aramadaki yerden farklı bir nokta; yazılan ad korunur.
                onPick={(pos) => { setPickedPos({ lat: pos.lat, lng: pos.lng }); setPickedLabel(""); setMapResults([]); }}
                onDragEnd={(e) => { const p = e.target.getLatLng(); setPickedPos({ lat: p.lat, lng: p.lng }); setPickedLabel(""); }}
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
                await applyLocation(pickedPos.lat, pickedPos.lng, pickedLabel);
                setConfirming(false);
                closeMap();
              }}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity"
              style={{ background: "#114956" }}
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
    </div>
  );
}
