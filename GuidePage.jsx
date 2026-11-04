// Rehber sayfası — "Muuvlink nasıl kullanılır?" (4 Kasım 2026, Melih onayladı).
// Adresler: /rehber, /en/guide, /de/anleitung, /el/guide, /es/guia, /fr/guide, /it/guida
// (LOCALIZED_PAGE_PATHS + backend SEO_LOCALIZED_PATHS). Metin i18n.js `guide` bloğundan;
// botlar aynı metni backend `seoGuideText`'ten (seo-content.json) alır — burada cümle yazılmaz.
// Modül düzeyinde: ana bileşenin her çiziminde yeniden kurulmaz.
import React from "react";
import { MapPin, CalendarCheck, Handshake, Users, CalendarPlus, Share2, Info, ArrowRight } from "lucide-react";

// Sıra, metin anahtarı (g1…g6) ve isteğe bağlı düğme (mevcut etiketler, yeni metin yok).
const GUIDES = [
  { key: "g1", icon: MapPin,        cta: { page: "trainings",       label: "nav.trainings" } },
  { key: "g2", icon: CalendarCheck },
  { key: "g3", icon: Handshake,     cta: { page: "teams",           label: "nav.teams" } },
  { key: "g4", icon: Users,         cta: { page: "create-team",     label: "teams.create" } },
  { key: "g5", icon: CalendarPlus,  cta: { page: "create-training", label: "nav.createTrainingFull" } },
  { key: "g6", icon: Share2 },
];

// Adım sayısı metinden okunur (s1, s2, …): dile göre sabit yazılmaz.
const stepsOf = (t, key) => {
  const out = [];
  for (let i = 1; i <= 12; i++) {
    const k = `guide.${key}.s${i}`;
    const v = t(k);
    if (!v || v === k) break;
    out.push(v);
  }
  return out;
};
const optional = (t, k) => { const v = t(k); return v && v !== k ? v : null; };

export default function GuidePage({ t, onNavigate }) {
  // Bağlantı adres çubuğunu değiştirmeden kaydırır (#g1 adresi yazılmaz).
  const jump = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen min-h-svh bg-smoke">
      {/* Üst bölüm */}
      <header className="bg-brand-50 border-b border-brand-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-12 pb-10 sm:pt-16 sm:pb-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-1 w-10 rounded-full bg-pop-400" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-[0.25em] uppercase text-logo-purple">{t("guide.eyebrow")}</span>
          </div>
          <h1 className="font-semibold text-brand-600 tracking-tight leading-[1.05] mb-4"
            style={{ fontSize: "clamp(2.1rem,6vw,3.5rem)" }}>
            {t("guide.title")}
          </h1>
          <p className="text-base sm:text-lg text-ink-900/80 leading-relaxed max-w-2xl">{t("guide.lead")}</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* İçindekiler: altı rehber */}
        <nav aria-label={t("guide.title")} className="mb-10 sm:mb-14">
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GUIDES.map(({ key, icon: Icon }, i) => (
              <li key={key}>
                <a href={`#${key}`} onClick={(e) => jump(e, key)}
                  className="group flex items-center gap-3 h-full min-h-[64px] bg-white rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:border-brand-300">
                  <span className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <Icon className="w-5 h-5 text-logo-teal" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] text-logo-teal">{String(i + 1).padStart(2, "0")}</span>
                    <span className="block text-sm font-semibold text-ink-900 leading-snug">{t(`guide.${key}.title`)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Rehberler */}
        <div className="space-y-6 sm:space-y-8">
          {GUIDES.map(({ key, icon: Icon, cta }, i) => {
            const steps = stepsOf(t, key);
            const note = optional(t, `guide.${key}.note`);
            return (
              <section key={key} id={key} aria-labelledby={`${key}-h`}
                className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 p-5 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <Icon className="w-[22px] h-[22px] text-logo-teal" />
                  </span>
                  <span className="font-mono text-xs text-logo-teal">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h2 id={`${key}-h`} className="text-xl sm:text-2xl font-semibold text-brand-900 tracking-tight mb-3">
                  {t(`guide.${key}.title`)}
                </h2>
                <p className="text-[15px] sm:text-base text-ink-900 leading-relaxed mb-6">{t(`guide.${key}.sum`)}</p>

                <ol className="space-y-3.5">
                  {steps.map((s, j) => (
                    <li key={j} className="flex gap-3.5">
                      <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-px" aria-hidden="true">
                        {j + 1}
                      </span>
                      <span className="text-sm sm:text-[15px] text-slate-700 leading-relaxed pt-[3px]">{s}</span>
                    </li>
                  ))}
                </ol>

                {note && (
                  <div className="mt-6 flex gap-3 rounded-xl bg-smoke px-4 py-3.5">
                    <Info className="w-4 h-4 text-logo-teal flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-sm text-slate-600 leading-relaxed">{note}</p>
                  </div>
                )}

                {cta && onNavigate && (
                  <button type="button" data-btn="solid" onClick={() => onNavigate(cta.page)}
                    className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-600 text-white text-sm font-medium">
                    {t(cta.label)} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
