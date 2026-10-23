// Etkinlik oluştur/düzenle formundaki "Rota (GPX)" alanı. Dosya tarayıcıda
// okunur (gpxRoute.js); forma yalnız { points, distance_m } yazılır.
import React, { useRef, useState } from "react";
import { Route, Upload, X } from "lucide-react";
import { gpxToRoute, formatRouteDistance, ROUTE_MAX_FILE_BYTES } from "./gpxRoute.js";

// MapView: sporla-bulusma.jsx'teki lazyWithReload(RouteMap) — parça 404'ünde sayfa bir kez yenilenir.
export default function RouteField({ t, lang, value, onChange, meeting, labelCls, MapView }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  const pick = async (file) => {
    setError("");
    if (!file) return;
    if (file.size > ROUTE_MAX_FILE_BYTES) { setError(t("route.tooBig")); return; }
    try {
      const route = gpxToRoute(await file.text());
      if (!route) { setError(t("route.invalid")); return; }
      setFileName(file.name);
      onChange(route);
    } catch {
      setError(t("route.invalid"));
    }
  };

  return (
    <div>
      <label className={labelCls}>{t("route.label")}</label>
      <input
        ref={inputRef}
        type="file"
        // iOS "application/gpx+xml"i tanımıyor, uzantı da veriliyor; tanımayan
        // tarayıcıda tüm dosyalar seçilebilir, içerik zaten okunarak denetleniyor.
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
      />
      {value?.points?.length > 1 ? (
        <div className="space-y-2">
          <React.Suspense fallback={<div className="h-48 rounded-xl bg-slate-100 animate-pulse" />}>
            <MapView points={value.points} meeting={meeting} className="h-48" />
          </React.Suspense>
          <div className="flex items-center gap-2 min-w-0">
            <Route className="w-4 h-4 flex-shrink-0 text-logo-teal" />
            <span className="text-sm font-semibold text-slate-800 flex-shrink-0">{formatRouteDistance(value.distance_m, lang)}</span>
            {fileName && <span className="text-xs text-slate-400 truncate min-w-0">{fileName}</span>}
            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
              <button type="button" onClick={() => inputRef.current?.click()}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-brand-600 hover:bg-brand-50">
                {t("route.replace")}
              </button>
              <button type="button" onClick={() => { setFileName(""); onChange(null); }}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 inline-flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> {t("route.remove")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-brand-600 hover:border-brand-400 hover:bg-brand-50/50 transition-colors">
          <Upload className="w-4 h-4" /> {t("route.add")}
        </button>
      )}
      {error
        ? <p className="mt-2 text-xs text-red-600">{error}</p>
        : <p className="mt-2 text-xs text-slate-500 leading-relaxed">{t("route.hint")}</p>}
    </div>
  );
}
