// Hakkımızda sayfası (4 Kasım 2026, TR metin Melih onayladı; bağlantı yalnız alt bilgide).
// Adresler: /hakkimizda, /en/about, /de/ueber-uns, /el/about, /es/sobre-nosotros, /fr/a-propos,
// /it/chi-siamo (LOCALIZED_PAGE_PATHS + backend SEO_LOCALIZED_PATHS). Metin i18n.js `about`
// bloğundan; botlar aynı metni backend `seoAboutText`'ten alır — burada cümle yazılmaz.
// Modül düzeyinde: ana bileşenin her çiziminde yeniden kurulmaz.
import React from "react";
import { Building2, Compass, CircleCheck, Wallet, EyeOff, ShieldCheck, UserRound, MessageCircle, ArrowRight } from "lucide-react";
import { COMPANY, companyLine } from "./i18n.js";

const PRINCIPLES = [
  { key: "p1", icon: Wallet },
  { key: "p2", icon: EyeOff },
  { key: "p3", icon: ShieldCheck },
  { key: "p4", icon: UserRound },
];
const WHAT_ITEMS = ["i1", "i2", "i3", "i4", "i5"];

const Card = ({ id, icon: Icon, title, children }) => (
  <section aria-labelledby={id} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8">
    <span className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center mb-4" aria-hidden="true">
      <Icon className="w-[22px] h-[22px] text-logo-teal" />
    </span>
    <h2 id={id} className="text-xl sm:text-2xl font-semibold text-brand-900 tracking-tight mb-3">{title}</h2>
    {children}
  </section>
);

export default function AboutPage({ t, onNavigate }) {
  const body = "text-[15px] sm:text-base text-ink-900 leading-relaxed";
  return (
    <div className="min-h-screen min-h-svh bg-smoke">
      {/* Üst bölüm */}
      <header className="bg-brand-50 border-b border-brand-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-12 pb-10 sm:pt-16 sm:pb-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-1 w-10 rounded-full bg-pop-400" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-[0.25em] uppercase text-logo-purple">Muuvlink</span>
          </div>
          <h1 className="font-semibold text-brand-600 tracking-tight leading-[1.05] mb-4"
            style={{ fontSize: "clamp(2.1rem,6vw,3.5rem)" }}>
            {t("about.title")}
          </h1>
          <p className="text-base sm:text-lg text-ink-900/80 leading-relaxed max-w-2xl">{t("about.lead")}</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-6 sm:space-y-8">
        <Card id="about-who" icon={Building2} title={t("about.who.title")}>
          <p className={body}>{t("about.who.body")}</p>
        </Card>
        <Card id="about-why" icon={Compass} title={t("about.why.title")}>
          <p className={body}>{t("about.why.body")}</p>
        </Card>

        <Card id="about-what" icon={CircleCheck} title={t("about.what.title")}>
          <ul className="space-y-3 mb-5">
            {WHAT_ITEMS.map((k) => (
              <li key={k} className="flex gap-3">
                <CircleCheck className="w-5 h-5 text-logo-teal flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">{t(`about.what.${k}`)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed">{t("about.what.after")}</p>
        </Card>

        <section aria-labelledby="about-care">
          <h2 id="about-care" className="text-xl sm:text-2xl font-semibold text-brand-900 tracking-tight mb-4 sm:mb-5">
            {t("about.care.title")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {PRINCIPLES.map(({ key, icon: Icon }) => (
              <div key={key} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <Icon className="w-5 h-5 text-logo-teal" />
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-ink-900">{t(`about.care.${key}.label`)}</h3>
                </div>
                <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">{t(`about.care.${key}.text`)}</p>
              </div>
            ))}
          </div>
        </section>

        <Card id="about-contact" icon={MessageCircle} title={t("about.contact.title")}>
          <p className={`${body} mb-5`}>{t("about.contact.body")}</p>
          <div className="flex gap-3 rounded-xl bg-smoke px-4 py-3.5 mb-6">
            <Building2 className="w-4 h-4 text-logo-teal flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-slate-600 leading-relaxed">
              <span className="font-semibold text-ink-900">{COMPANY.legalName}</span>
              <br />
              {companyLine().replace(`${COMPANY.legalName} · `, "")}
            </p>
          </div>
          {onNavigate && (
            <button type="button" data-btn="solid" onClick={() => onNavigate("contact")}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-600 text-white text-sm font-medium">
              {t("nav.contact")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
