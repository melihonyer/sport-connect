// Saat ve spor servisi penceresi (9 Kasım 2026). Modül düzeyinde: kök çizimlerinde sökülüp yeniden kurulmaz.
// Sunucu "available" boş dönerse hiç açılmaz. Kurallar backend/wearable.js başında.
import React, { useCallback, useEffect, useState } from "react";
import { X, Watch, Loader2, RefreshCw, CalendarCheck, ShieldCheck } from "lucide-react";

const BRAND_NAME = { polar: "Polar", wahoo: "Wahoo" };

const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });

const fmtDuration = (sec) => {
  if (!sec) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

export default function WearablePanel({ apiUrl, t, isNative, showToast, sportLabel, onClose, onOpenPrivacy, onOpenTraining }) {
  const [data, setData] = useState(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(null);
  const [confirmOff, setConfirmOff] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${apiUrl}/wearable/status`, { headers: authHeaders() });
      if (!r.ok) throw new Error("status");
      setData(await r.json());
      setFailed(false);
    } catch { setFailed(true); }
  }, [apiUrl]);

  useEffect(() => {
    load();
    const refresh = () => { if (document.visibilityState !== "hidden") load(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("muuv:wearable-refresh", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("muuv:wearable-refresh", refresh);
    };
  }, [load]);

  const giveConsent = async () => {
    setBusy("consent");
    try {
      const r = await fetch(`${apiUrl}/wearable/consent`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ granted: true }) });
      if (!r.ok) throw new Error("consent");
      await load();
    } catch { showToast(t("wearable.error"), "error"); }
    setBusy(null);
  };

  const connect = async (provider) => {
    setBusy(provider);
    try {
      const r = await fetch(`${apiUrl}/wearable/${provider}/connect`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ native: Boolean(isNative) }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error("connect");
      if (isNative) { window.open(j.url, "_blank", "noopener"); setBusy(null); }
      else window.location.href = j.url;
    } catch { showToast(t("wearable.error"), "error"); setBusy(null); }
  };

  const sync = async (provider) => {
    setBusy(`sync-${provider}`);
    try {
      const r = await fetch(`${apiUrl}/wearable/${provider}/sync`, { method: "POST", headers: authHeaders() });
      if (!r.ok) throw new Error("sync");
      await load();
    } catch { showToast(t("wearable.error"), "error"); await load(); }
    setBusy(null);
  };

  const disconnect = async (provider) => {
    setBusy(`off-${provider}`);
    try {
      const r = await fetch(`${apiUrl}/wearable/${provider}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error("off");
      setConfirmOff(null);
      setAgree(false);
      await load();
      showToast(t("wearable.disconnected"), "success");
    } catch { showToast(t("wearable.error"), "error"); }
    setBusy(null);
  };

  const fmtDate = (v) => new Date(v).toLocaleString(document.documentElement.lang || undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const connOf = (p) => data?.connections?.find((c) => c.provider === p);

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center overflow-y-auto overscroll-contain p-4"
      style={{ zIndex: 1000000 }} role="dialog" aria-modal="true" aria-label={t("wearable.title")}>
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 relative my-auto">
        <button onClick={onClose} aria-label={t("common.close")}
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
          <X className="w-6 h-6" />
        </button>
        <h2 className="font-display font-bold text-2xl text-brand-900 pr-10 mb-5">{t("wearable.title")}</h2>

        {failed && !data && <p className="py-6 text-center text-sm text-slate-500">{t("wearable.error")}</p>}
        {!failed && !data && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>}

        {data && data.available?.length > 0 && !data.consented && (
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
              <ShieldCheck className="w-5 h-5 text-brand-600 flex-shrink-0" /> {t("wearable.consentTitle")}
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{t("wearable.consentBody")}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700 list-disc pl-5">
              <li>{t("wearable.point1")}</li>
              <li>{t("wearable.point2")}</li>
              <li>{t("wearable.point3")}</li>
              <li>{t("wearable.point4")}</li>
            </ul>
            <button type="button" onClick={onOpenPrivacy} className="mt-3 text-sm font-medium text-brand-600 underline">{t("footer.privacy")}</button>
            <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-5 h-5 flex-shrink-0 accent-brand-600" />
              <span>{t("wearable.consentCheck")}</span>
            </label>
            <button disabled={!agree || busy === "consent"} onClick={giveConsent} data-btn="solid"
              className="mt-5 w-full h-12 rounded-xl font-semibold bg-brand-600 text-white disabled:opacity-40">
              {t("wearable.continue")}
            </button>
          </div>
        )}

        {data && data.available?.length > 0 && data.consented && (
          <div>
            <div className="space-y-3">
            {data.available.map((p) => {
              const c = connOf(p);
              const on = c?.status === "connected";
              return (
                <div key={p} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0"><Watch className="w-5 h-5 text-brand-600" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800">{BRAND_NAME[p] || p}</div>
                      <div className="text-xs text-slate-500">
                        {on ? (c.last_sync_at ? t("wearable.lastSync").replace("{date}", fmtDate(c.last_sync_at)) : t("wearable.connected"))
                          : c ? t("wearable.reconnect") : t("wearable.notConnected")}
                      </div>
                    </div>
                    {!on && (
                      <button disabled={busy === p} onClick={() => connect(p)} data-btn="solid"
                        className="h-11 px-4 rounded-xl font-semibold text-sm bg-brand-600 text-white disabled:opacity-50">{t("wearable.connect")}</button>
                    )}
                    {on && (
                      <button onClick={() => sync(p)} disabled={busy === `sync-${p}`} data-hover="own" aria-label={t("wearable.syncNow")} title={t("wearable.syncNow")}
                        className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-brand-600 hover:bg-slate-50 disabled:opacity-50">
                        <RefreshCw className={`w-5 h-5 ${busy === `sync-${p}` ? "animate-spin" : ""}`} />
                      </button>
                    )}
                  </div>
                  {c && confirmOff !== p && (
                    <button onClick={() => setConfirmOff(p)} className="mt-3 text-sm font-medium text-slate-500 underline">{t("wearable.disconnect")}</button>
                  )}
                  {confirmOff === p && (
                    <div className="mt-3 rounded-xl bg-red-50 p-3">
                      <p className="text-sm text-slate-700">{t("wearable.disconnectConfirm")}</p>
                      <div className="mt-3 flex gap-2">
                        <button disabled={busy === `off-${p}`} onClick={() => disconnect(p)}
                          className="flex-1 h-11 rounded-lg text-sm font-semibold text-white bg-red-600 disabled:opacity-50">{t("wearable.disconnect")}</button>
                        <button onClick={() => setConfirmOff(null)}
                          className="flex-1 h-11 rounded-lg text-sm font-semibold text-slate-700 border border-slate-200 bg-white">{t("common.cancel")}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>

            <h3 className="mt-6 mb-2 font-semibold text-slate-800">{t("wearable.historyTitle")}</h3>
            <p className="text-xs text-slate-500 mb-3">{t("wearable.onlyYou")}</p>
            {data.activities?.length === 0 && <p className="py-4 text-sm text-slate-500">{t("wearable.empty")}</p>}
            <div className="space-y-2">
              {data.activities?.map((a) => (
                <div key={a.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-sm text-slate-800">{a.sport ? sportLabel(a.sport) : t("wearable.workout")}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0">{fmtDate(a.started_at)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    {[fmtDuration(a.duration_sec), a.distance_m ? `${(a.distance_m / 1000).toFixed(1)} km` : null, a.avg_hr ? `${a.avg_hr} bpm` : null, BRAND_NAME[a.provider]].filter(Boolean).join(" · ")}
                  </div>
                  {a.training_id && (
                    <button onClick={() => onOpenTraining(a.training_id)} className="mt-1.5 flex w-full min-w-0 items-center gap-1.5 text-left text-xs font-medium text-brand-600">
                      <CalendarCheck className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="min-w-0 truncate">{t("wearable.attended").replace("{title}", a.training_title || "")}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
