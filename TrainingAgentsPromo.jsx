// Training Agents tanıtım alanları (8 Ekim 2026).
//
// Kaynak: Training Agents'ın marka özeti (muuvlink-tanitim-brief.md). Yaklaşım "alttan
// alttan": Muuvlink'in dilini bozmadan, doğru yerde tek cümle. Training Agents bu sayfada
// misafir — logosu Muuvlink'inkinden küçük, renginden yalnız ana mavi (düğme, marka adı).
// Her bölümde tek CTA; her bağlantı UTM (site) ya da kampanya etiketi (mağaza) taşır.
//
// Bağlantı kuralı: uygulamada (isNative) CTA ve rozet doğrudan cihazın mağazasına gider
// (iOS'ta dış siteye yönlendirmek yerine App Store sayfası). Web'de masaüstünde siteye,
// telefonda rozet mağazaya. Training Agents sitesi yalnız tr/en; diğer diller İngilizce sayfa.
import React, { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { StoreButton } from "./StoreButtons.jsx";

const SITE = "https://trainingagentsapp.com";
const APP_STORE_ID = "6808657949";
const PLAY_ID = "com.trainingagentsapp.android";
const CAMPAIGN = "muuvlink-2026q4";
const BRAND = "Training Agents";
const ASSET = "/partners/training-agents";

// Training Agents sayfaları: [tr, en]
const PAGES = {
  home: ["", "/en"],
  method: ["/metodoloji", "/en/methodology"],
};

const isTr = (lang) => lang === "tr";

export function taPlatform(isNative) {
  const cap = typeof window !== "undefined" ? window.Capacitor?.getPlatform?.() : null;
  if (cap === "ios" || cap === "android") return cap;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return isNative ? "ios" : "desktop";
}

const utm = (medium) => `utm_source=muuvlink&utm_medium=${medium}&utm_campaign=${CAMPAIGN}`;

export function taSiteUrl(lang, page, medium) {
  const [tr, en] = PAGES[page] || PAGES.home;
  return `${SITE}${isTr(lang) ? tr : en}/?${utm(medium)}`.replace("//?", "/?");
}

export function taStoreUrl(platform, lang, medium) {
  if (platform === "android") {
    const ref = encodeURIComponent(utm(medium));
    return `https://play.google.com/store/apps/details?id=${PLAY_ID}&referrer=${ref}`;
  }
  return `https://apps.apple.com/${isTr(lang) ? "tr/" : ""}app/id${APP_STORE_ID}?ct=muuvlink-${medium}`;
}

// Tek CTA'nın hedefi: uygulamada mağaza, web'de site.
function ctaUrl({ isNative, lang, medium, page = "home" }) {
  return isNative ? taStoreUrl(taPlatform(true), lang, medium) : taSiteUrl(lang, page, medium);
}

// Uygulamada dış bağlantı window.open ile açılır (Capacitor sistem tarayıcısına/mağazaya
// verir); web'de düz <a target=_blank>.
function ExtLink({ href, isNative, className, style, children, ...rest }) {
  const onClick = isNative ? (e) => { e.preventDefault(); window.open(href, "_blank", "noopener"); } : undefined;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className} style={style} {...rest}>
      {children}
    </a>
  );
}

// "{brand}" yer tutucusunu kalın, ana mavi marka adıyla değiştirir.
function withBrand(text, className = "font-bold text-ta-blue") {
  const [a, b = ""] = String(text).split("{brand}");
  return <>{a}<strong className={className}>{BRAND}</strong>{b}</>;
}

// ── Etkinlik türüne göre rehber yazısı (özet 7.5) ─────────────────────────────
const GUIDES = [
  { re: /triatlon|triathlon|ironman|aquathlon|duatlon|duathlon/, tr: "ilk-triatlon", en: "first-triathlon" },
  { re: /ultra|patika|trail|da[gğ] ko[sş]u/, tr: "ultra-ve-patika-kosusu", en: "ultra-and-trail-running" },
  { re: /yar[ıi] ?maraton|half ?marathon|\b21([.,]1)? ?k(m)?\b/, tr: "yari-maraton-antrenman-programi", en: "half-marathon-training-plan" },
  { re: /maraton|marathon|\b42([.,]2)? ?k(m)?\b/, tr: "maraton-antrenman-programi", en: "marathon-training-plan" },
  { re: /\b(5|10) ?k(m)?\b|\b(5|10)\.?000 ?m\b/, tr: "5k-10k-antrenman-programi", en: "5k-10k-training-plan" },
  { re: /gran ?fondo|medio ?fondo|granfondo/, tr: "gran-fondo-hazirligi", en: "gran-fondo-training" },
  { re: /a[çc][ıi]k ?su|open ?water|bo[gğ]az ge[çc]i[sş]/, tr: "acik-su-yuzme", en: "open-water-swimming" },
];
const TAPER = { tr: "yaris-oncesi-yuk-azaltma", en: "taper" };
// Organizatör etkinliği olmayan (takım/bireysel) kayıtta kart yalnız açık yarış
// kelimesiyle çıkar: "Pazar Koşusu"na "yarışa hazırlanıyor musun" denmez.
const RACE_WORD = /yar[ıi][sş]|race|maraton|marathon|triatlon|triathlon|ironman|ultra|gran ?fondo|\b(21|42) ?k\b/;

export function taRaceGuide(training, isOrg) {
  // İki küçültme birlikte: Türkçe kural "TRAIL"ı "traıl" (noktasız ı) yapıyor,
  // İngilizce kural "İZMİR"i bozuyor. Biri tutsun yeter.
  const raw = `${training?.title || ""} ${training?.sport || ""} ${training?.team_sport || ""}`;
  const text = `${raw.toLocaleLowerCase("tr")} ${raw.toLowerCase()}`;
  if (!isOrg && !RACE_WORD.test(text)) return null;
  return GUIDES.find((g) => g.re.test(text)) || TAPER;
}

function guideUrl(lang, guide) {
  const path = isTr(lang) ? `/rehber/${guide.tr}` : `/en/guides/${guide.en}`;
  return `${SITE}${path}?${utm("rehber")}`;
}

// ── Logo ve mağaza rozetleri ───────────────────────────────────────────────
// Özet: oran 564×113, yeniden renklendirme yok, en dar 96 px. Açık zeminde siyah,
// koyu zeminde beyaz sürüm.
export function TaLogo({ dark = false, width = 112, className = "" }) {
  return (
    <img src={`${ASSET}/logo-${dark ? "white" : "black"}.svg`} alt={BRAND}
      width={width} height={Math.round((width * 113) / 564)}
      className={`block flex-shrink-0 ${className}`} style={{ width, height: "auto" }} />
  );
}

// Mağaza düğmeleri: Muuvlink'inkilerle aynı kalıp (StoreButtons.jsx). Her zaman doğrudan
// mağazaya (Melih, 8 Ekim 2026: "rozete tıklayınca sayfaya gidiyor, storelara gitmeli" —
// özetteki "masaüstünde siteye" kuralı bu yüzden uygulanmıyor). Masaüstünde ikisi yan yana;
// telefonda (web ya da uygulama) yalnız cihazın mağazası.
export function TaStoreBadges({ t, lang, medium, isNative, className = "" }) {
  const platform = taPlatform(isNative);
  const open = (href) => (isNative ? (e) => { e.preventDefault(); window.open(href, "_blank", "noopener"); } : undefined);
  const appleHref = taStoreUrl("ios", lang, medium);
  const playHref = taStoreUrl("android", lang, medium);
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {platform !== "android" && <StoreButton store="apple" href={appleHref} top={t("download.badgeTop")} onClick={open(appleHref)} />}
      {platform !== "ios" && <StoreButton store="play" href={playHref} top={t("download.badgeTop")} onClick={open(playHref)} />}
    </div>
  );
}

// Tanıtım düğmesi: mağaza düğmeleriyle aynı boy ve köşe (h-12, rounded-xl).
// light = mavi zemin üstünde beyaz düğme (hover'da Training Agents sarısı).
function TaButton({ href, isNative, children, light = false }) {
  return (
    <ExtLink href={href} isNative={isNative} data-btn={light ? "ta-light" : "ta"}
      className={`inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[15px] font-semibold ${light ? "bg-white text-ta-blue" : "bg-ta-blue text-white"}`}>
      {children} <ArrowRight className="w-4 h-4" />
    </ExtLink>
  );
}

// ── 7.1 Training Agents'tan gelen etkinliğin altında ───────────────────────
export function TaSessionNote({ t, lang, isNative }) {
  return (
    <p className="text-[13px] text-slate-500 mb-6 -mt-3">
      {withBrand(t("taPromo.session"), "font-semibold text-ta-blue")}{" "}
      <ExtLink isNative={isNative} href={ctaUrl({ isNative, lang, medium: "rozet" })}
        className="italic text-slate-500 underline-offset-2 hover:underline whitespace-nowrap">
        {t("taPromo.sessionCta")} →
      </ExtLink>
    </p>
  );
}

// ── 7.2 Etkinlikler listesinde tanıtım kartı ───────────────────────────────
// Liste ızgarasında tam satır kaplar (etkinlik kartları kısa; dikey kart sırayı bozuyordu).
export function TaDiscoverCard({ t, lang, isNative, medium = "kesfet-karti" }) {
  return (
    <div className="relative col-span-full rounded-2xl border border-ta-blue/15 bg-ta-blue/[0.04] px-5 py-4 sm:px-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
      {/* Reklam olduğu açıkça görünsün (Melih, 8 Ekim 2026); zemin mavinin çok hafif tonu. */}
      <span className="absolute top-2.5 right-3 text-[11px] font-medium text-slate-400">{t("taPromo.adLabel")}</span>
      <TaLogo width={100} />
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-slate-900 leading-snug">{t("taPromo.cardTitle")}</h3>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">{withBrand(t("taPromo.cardBody"))}</p>
      </div>
      <div className="flex-shrink-0">
        <TaButton isNative={isNative} href={ctaUrl({ isNative, lang, medium })}>{t("taPromo.cardCta")}</TaButton>
      </div>
    </div>
  );
}

// ── Ana sayfa bandı: Ai koç + 6 disiplin ──────────────────────────────────
// Melih, 8 Ekim 2026: Training Agents'ın kurumsal renkleri, tek dekupe fotoğraf; sonra
// "çok renkli ve karmaşık, sadeleştir": renkli disiplin etiketleri yerine tek satır sade
// yazı, telefonda görsel üstte + tek düğme (doğrudan mağazaya), masaüstünde düğme + rozetler.
// Zemin ana mavi, düz sarı daire (sarı yalnız zemin/grafik), önünde Training Agents'ın kendi
// mağaza görselindeki dekupe triatlet. Degrade yok.
const DISCIPLINE_KEYS = ["triathlon", "run", "bike", "swim", "strength", "yoga"];

export function TaHomeBand({ t, lang, isNative }) {
  const platform = taPlatform(isNative);
  const phone = platform !== "desktop";
  // Telefonda (web ya da uygulama) tek CTA doğrudan cihazın mağazasına; masaüstünde siteye.
  const href = phone ? taStoreUrl(platform, lang, "anasayfa") : taSiteUrl(lang, "home", "anasayfa");
  return (
    <section className="py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-ta-blue lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-stretch">
          <div aria-hidden="true" className="relative h-60 sm:h-72 lg:h-[27rem] lg:order-2 overflow-hidden">
            <div className="absolute rounded-full bg-ta-yellow w-48 h-48 sm:w-60 sm:h-60 lg:w-[22rem] lg:h-[22rem] right-5 top-5 sm:right-12 sm:top-6 lg:right-auto lg:left-1/2 lg:-translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2" />
            <img src={`${ASSET}/athlete.webp`} alt="" loading="lazy"
              className="absolute bottom-0 right-3 sm:right-16 h-[96%] w-auto max-w-none lg:right-auto lg:left-1/2 lg:-translate-x-1/2" />
            <div className="absolute left-6 top-6 sm:left-10 sm:top-8 lg:hidden"><TaLogo dark width={128} /></div>
          </div>
          <div className="relative px-6 pb-7 pt-1 sm:px-10 sm:pb-10 lg:p-12 lg:order-1 flex flex-col justify-center">
            <div className="hidden lg:block"><TaLogo dark width={150} /></div>
            <h2 className="lg:mt-8 text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight leading-[1.15]">{t("taPromo.homeTitle")}</h2>
            <p className="mt-3 text-sm sm:text-base text-white/75 leading-relaxed max-w-xl">{t("taPromo.homeBody")}</p>
            <p className="mt-4 text-xs sm:text-[13px] font-medium text-white/60 tracking-wide">
              {/* Ad içinde satır bölünmesin ("Yoga &" / "Esneme"): boşluklar bölünmez boşluk. */}
              {DISCIPLINE_KEYS.map((k) => t(`taPromo.disc.${k}`).replace(/ /g, "\u00a0")).join(" · ")}
            </p>
            <div className="mt-6 lg:mt-8 flex flex-wrap items-center gap-3">
              <div className={phone ? "w-full [&>a]:w-full [&>a]:justify-center" : ""}>
                <TaButton light isNative={isNative} href={href}>{t("taPromo.cardCta")}</TaButton>
              </div>
              {!phone && <TaStoreBadges t={t} lang={lang} medium="anasayfa" isNative={isNative} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 7.3 Etkinlik açan/takım yöneten antrenöre ipucu ────────────────────────
// Kapatılınca 30 gün görünmez.
const COACH_KEY = "ta_coach_hidden_until";
export function TaCoachTip({ t, lang, isNative }) {
  const [hidden, setHidden] = useState(() => {
    try { return Number(localStorage.getItem(COACH_KEY) || 0) > Date.now(); } catch { return false; }
  });
  if (hidden) return null;
  const close = () => {
    try { localStorage.setItem(COACH_KEY, String(Date.now() + 30 * 864e5)); } catch {}
    setHidden(true);
  };
  return (
    <div className="relative mb-5 rounded-2xl border border-slate-200 bg-white p-4 pr-10">
      <button type="button" onClick={close} aria-label={t("taPromo.close")}
        className="absolute top-1 right-1 w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700">
        <X className="w-4 h-4" />
      </button>
      <TaLogo width={96} />
      <div className="mt-3 text-sm font-semibold text-slate-800">{t("taPromo.coachTitle")}</div>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{withBrand(t("taPromo.coachBody"), "font-semibold text-ta-blue")}</p>
      <ExtLink isNative={isNative} href={ctaUrl({ isNative, lang, medium: "antrenor", page: "method" })}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ta-blue hover:underline underline-offset-2">
        {t("taPromo.coachCta")} <ArrowRight className="w-3.5 h-3.5" />
      </ExtLink>
    </div>
  );
}

// ── 7.4 Boş durum: yaklaşan etkinliği olmayan profil ───────────────────────
export function TaEmptyState({ t, lang, isNative }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <TaLogo width={104} />
      <p className="mt-4 text-sm text-slate-600 leading-relaxed">{withBrand(t("taPromo.empty"))}</p>
      <div className="mt-4">
        <TaButton isNative={isNative} href={ctaUrl({ isNative, lang, medium: "bos-durum" })}>{t("taPromo.emptyCta")}</TaButton>
      </div>
    </div>
  );
}

// ── 7.5 Yarış/uzun etkinlik sayfası ────────────────────────────────────────
export function TaRaceCard({ t, lang, isNative, guide }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <TaLogo width={96} />
      <p className="mt-3 text-sm text-slate-600 leading-relaxed">{withBrand(t("taPromo.race"))}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <TaButton isNative={isNative} href={ctaUrl({ isNative, lang, medium: "etkinlik" })}>{t("taPromo.raceCta")}</TaButton>
        {guide && (
          <ExtLink isNative={isNative} href={guideUrl(lang, guide)}
            className="text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">
            {t("taPromo.raceGuide")} →
          </ExtLink>
        )}
      </div>
    </div>
  );
}

// ── 7.6 Alt bilgi şeridi (koyu Deep Teal zemin) ────────────────────────────
export function TaFooterStrip({ t, lang, isNative }) {
  return (
    <div className="border-t border-slate-800 pt-8 pb-2 mb-4 flex flex-col sm:flex-row items-center justify-between gap-5">
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-center sm:text-left">
        <TaLogo dark width={112} />
        <p className="text-slate-400 text-sm">{withBrand(t("taPromo.footer"), "font-semibold text-white")}</p>
      </div>
      <TaStoreBadges t={t} lang={lang} medium="footer" isNative={isNative} />
    </div>
  );
}
