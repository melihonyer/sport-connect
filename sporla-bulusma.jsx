import React, { useState, useEffect, useRef } from "react";
import { detectLang, createT } from "./i18n.js";
import {
  MapPin,
  Users,
  Calendar,
  Clock,
  Bell,
  Plus,
  X,
  Heart,
  TrendingUp,
  Award,
  Activity,
  Target,
  LogOut,
  ArrowLeft,
  Lock,
  Edit,
  Trash2,
  Send,
  Search,
  UserPlus,
  MessageCircle,
  Settings,
  ChevronDown,
  Check,
  Navigation2,
  Loader2,
  CheckCircle,
  XCircle,
  Info,
  MessageSquare,
  Crown,
  User,
  Globe,
  AlertTriangle,
  Dumbbell,
  Trophy,
  Mail,
  ShieldCheck,
  Eye,
  ZoomIn,
  Image,
  Menu,
  ChevronUp,
  ExternalLink,
  Link,
} from "lucide-react";
// Ağır kütüphaneler lazy yüklenir — ilk bundle'ı küçültür
const TrainingsMapViewLazy = React.lazy(() => import("./TrainingsMapView"));
const ActivityChartLazy    = React.lazy(() => import("./ActivityChart"));
const LocationPickerMapLazy = React.lazy(() => import("./LocationPickerMap"));

const API_URL  = import.meta.env.VITE_API_URL  ?? (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");

// ── Global hata yakalayıcı — beyaz ekran yerine kullanıcı dostu mesaj ──
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error("[ErrorBoundary]", err, info); }
  render() {
    if (!this.state.error) return this.props.children;
    const reset = () => this.setState({ error: null });
    const lng = (typeof localStorage !== "undefined" && localStorage.getItem("muuvlang")) || "tr";
    const _eb = {
      title: { tr: "Bir şeyler ters gitti", en: "Something went wrong", de: "Etwas ist schiefgelaufen" },
      retry: { tr: "Tekrar Dene", en: "Try Again", de: "Erneut versuchen" },
      unexpected: { tr: "Beklenmedik bir hata oluştu.", en: "An unexpected error occurred.", de: "Ein unerwarteter Fehler ist aufgetreten." },
    };
    const _t = (k) => _eb[k][lng] || _eb[k].en;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center gap-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-50">
          <AlertTriangle className="w-8 h-8 text-red-400"/>
        </div>
        <div>
          <p className="text-slate-800 font-semibold text-lg mb-1">{_t("title")}</p>
          <p className="text-slate-400 text-sm max-w-xs">
            {this.state.error?.message || _t("unexpected")}
          </p>
        </div>
        <button onClick={reset}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
          {_t("retry")}
        </button>
      </div>
    );
  }
}
const BASE_URL = import.meta.env.VITE_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");

// ── Tarih formatlama yardımcıları ──────────────────────────────────────────
// "1 Haziran 2026 Pazartesi" — antrenman detay gibi önemli yerlerde
const fmtDateFull = (d) => d
  ? new Date(d).toLocaleDateString("tr-TR", { timeZone:"UTC", weekday:"long", day:"numeric", month:"long", year:"numeric" })
  : "";
// "1 Haziran 2026" — kartlar ve listeler için
const fmtDateMed = (d) => d
  ? new Date(d).toLocaleDateString("tr-TR", { timeZone:"UTC", day:"numeric", month:"long", year:"numeric" })
  : "";
// "1 Haz 2026" — kompakt yerler (yorum tarihi, bildirim vb.)
const fmtDateShort = (d) => d
  ? new Date(d).toLocaleDateString("tr-TR", { day:"numeric", month:"short", year:"numeric" })
  : "";

// Harita arama yardımcıları
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
    }[typ] || "#00b7ba";
    return { label: entry[l] || entry.en, color };
  }
  if (cls==="natural")  return { label: {tr:"Doğa", en:"Nature",  de:"Natur" }[l],   color:"#15803d" };
  if (cls==="highway")  return { label: {tr:"Sokak", en:"Street",  de:"Straße"}[l],   color:"#94a3b8" };
  if (cls==="shop")     return { label: {tr:"Mağaza", en:"Shop",   de:"Geschäft"}[l], color:"#9333ea" };
  return { label: {tr:"Yer", en:"Place", de:"Ort"}[l], color:"#00b7ba" };
};

const DEFAULT_MOTTOS = {
  tr: ["Birlikte Hareket Et!", "Yeni Dostlar Edin!", "Limitlerini Aş!", "En İyini Keşfet!"],
  en: ["Move Together!", "Make New Friends!", "Push Your Limits!", "Discover Your Best!"],
  de: ["Gemeinsam bewegen!", "Neue Freunde finden!", "Grenzen überwinden!", "Entdecke dein Bestes!"],
};


// Module-level component — Muuvlink içinde OLMAMALI.
// Muuvlink her 55ms'de re-render ederdi (typewriter state),
// bu da AuthModal gibi nested component'lerin unmount/remount olmasına
// ve form alanlarının sıfırlanmasına yol açıyordu.
// Hex → RGB yardımcısı
const _hx = h => { const x = h.replace('#',''); return [parseInt(x.slice(0,2),16), parseInt(x.slice(2,4),16), parseInt(x.slice(4,6),16)]; };
const _lerpColor = (c1, c2, t) => {
  const [r1,g1,b1] = _hx(c1), [r2,g2,b2] = _hx(c2);
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
};
// Hex rengin algısal parlaklığı (0-255)
const _brightness = hex => {
  const h = (hex || "#000000").replace('#','');
  const r = parseInt(h.slice(0,2),16)||0, g = parseInt(h.slice(2,4),16)||0, b = parseInt(h.slice(4,6),16)||0;
  return (r*299 + g*587 + b*114) / 1000;
};

const Typewriter = React.memo(({ mottos, color1 = "#00b7ba", color2 = "#981dd8" }) => {
  const [idx,   setIdx]   = useState(0);
  const [count, setCount] = useState(0);   // kaç karakter görünüyor
  const [phase, setPhase] = useState("typing"); // typing | holding | fading

  const word = mottos[idx % mottos.length];
  const len  = word.length;
  // Layout shift önlemi: en uzun motto ghost olarak render edilir
  const longestMotto = mottos.reduce((a, b) => a.length > b.length ? a : b, "");

  useEffect(() => {
    let t;
    if (phase === "typing") {
      if (count < len) {
        t = setTimeout(() => setCount(c => c + 1), 62);
      } else {
        t = setTimeout(() => setPhase("holding"), 2600);
      }
    } else if (phase === "holding") {
      t = setTimeout(() => setPhase("fading"), 80);
    } else if (phase === "fading") {
      // CSS transition süresi 480ms — sonra mottoyu değiştir
      t = setTimeout(() => {
        setIdx(i => (i + 1) % mottos.length);
        setCount(0);
        setPhase("typing");
      }, 500);
    }
    return () => clearTimeout(t);
  }, [phase, count, len, mottos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fading  = phase === "fading";
  const visible = word.slice(0, count);

  return (
    <span style={{ display: "inline-block", position: "relative", width: "100%" }}>
      {/* Ghost: en uzun mottoya göre yükseklik rezerve eder — layout shift yok */}
      <span style={{ visibility: "hidden", display: "inline" }}>
        {longestMotto}
      </span>
      {/* Gerçek typewriter metni — absolute, üst üste oturur */}
      <span style={{
        position: "absolute",
        left: 0,
        top: 0,
        background: `linear-gradient(90deg,${color1},${color2})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        color: color1, // fallback: gradient desteklenmezse ilk renk
        display: "inline-block",
        width: "100%",
        opacity:    fading ? 0 : 1,
        filter:     fading ? "blur(10px)" : "blur(0)",
        transform:  fading ? "translateY(-6px)" : "translateY(0)",
        transition: fading ? "opacity .45s ease, filter .45s ease, transform .45s ease" : "none",
      }}>
        {visible}
      </span>
    </span>
  );
});
// Module-level — uncontrolled inputs ile focus sorunu tamamen çözülür
const AuthModal = ({ authMode, setAuthMode, onClose, handleLogin, handleRegister, setLegalModal, t }) => {
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [kvkkChecked, setKvkk]    = useState(false);
  const nameRef  = useRef();
  const emailRef = useRef();
  const passRef  = useRef();

  // authMode değişince error/success/kvkk temizle
  useEffect(() => { setError(""); setSuccess(""); setKvkk(false); }, [authMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    const email = emailRef.current?.value || "";
    const password = passRef.current?.value || "";
    const name = nameRef.current?.value || "";
    if (authMode === "login") {
      await handleLogin(email, password, setError);
    } else if (authMode === "register") {
      if (!kvkkChecked) {
        setError(t("auth.kvkkRequired"));
        setLoading(false);
        return;
      }
      await handleRegister(name, email, password, setError);
    } else if (authMode === "forgot") {
      try {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          setSuccess(t("auth.resetEmailSent"));
        } else {
          const d = await res.json();
          setError(d.error || t("common.error"));
        }
      } catch {
        setError(t("common.networkError"));
      }
    }
    setLoading(false);
  };

  const titles = { login: t("auth.loginTitle"), register: t("auth.registerTitle"), forgot: t("auth.forgotTitle") };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4 modal-backdrop">
      <div className="bg-white rounded-3xl max-w-md w-full relative overflow-hidden shadow-2xl modal-content">

        {/* Üst gradient şerit */}
        <div className="h-1.5" style={{background:"linear-gradient(90deg,#00b7ba,#981dd8)"}}/>

        <div className="px-8 pt-7 pb-8">
          {/* Kapat butonu */}
          <button onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>

          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <img src="/icons/favicon.png" alt="" className="h-8 w-auto" width="32" height="32"/>
            <img src="/icons/logo-yatay.svg" alt="Muuvlink" className="h-5 w-auto" width="120" height="20"/>
          </div>

          {/* Başlık */}
          <h2 className="font-display font-bold text-slate-900 text-center mb-1" style={{fontSize:"1.8rem", letterSpacing:"-0.01em"}}>
            {titles[authMode]}
          </h2>
          {authMode === "forgot" ? (
            <p className="text-slate-400 text-sm text-center mb-6">{t("auth.forgotTitle")}</p>
          ) : (
            <p className="text-slate-400 text-sm text-center mb-6">
              {authMode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
            </p>
          )}

          {/* Hata / Başarı */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-700 text-sm flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {authMode === "register" && (
              <input ref={nameRef} type="text" placeholder={t("auth.namePlaceholder")}
                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm font-medium outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                required/>
            )}
            <input ref={emailRef} type="email" placeholder={t("auth.emailPlaceholder")}
              className={`w-full px-4 py-3.5 border rounded-xl text-slate-800 placeholder-slate-400 text-sm font-medium outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all ${error ? "border-red-300 bg-red-50/50" : "border-slate-200"}`}
              required
              onInvalid={e => e.target.setCustomValidity(t("auth.emailInvalid"))}
              onInput={e => e.target.setCustomValidity("")}/>
            {authMode !== "forgot" && (
              <input ref={passRef} type="password" placeholder={t("auth.passwordLabel")}
                className={`w-full px-4 py-3.5 border rounded-xl text-slate-800 placeholder-slate-400 text-sm font-medium outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all ${error ? "border-red-300 bg-red-50/50" : "border-slate-200"}`}
                required/>
            )}
            {authMode === "login" && (
              <div className="text-right">
                <button type="button" onClick={() => setAuthMode("forgot")}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline">
                  {t("auth.forgotLink")}
                </button>
              </div>
            )}

            {authMode === "register" && (
              <label className="flex items-start gap-2.5 cursor-pointer group mt-1">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={kvkkChecked}
                    onChange={e => setKvkk(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-all ${kvkkChecked ? "bg-brand-500 border-brand-500" : "border-slate-300 bg-white group-hover:border-brand-400"}`}>
                    {kvkkChecked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                <span className="text-xs text-slate-500 leading-relaxed">
                  {t("auth.kvkkText1")}{" "}
                  <button type="button"
                    onClick={() => setLegalModal && setLegalModal("kvkk")}
                    className="text-brand-600 font-semibold hover:underline">
                    {t("auth.kvkkLink")}
                  </button>
                  {" "}{t("auth.kvkkText2")}
                </span>
              </label>
            )}

            <button type="submit" disabled={loading || (authMode === "register" && !kvkkChecked)}
              className="w-full py-3.5 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity hover:opacity-90 mt-2"
              style={{background:"linear-gradient(90deg,#00b7ba,#981dd8)"}}>
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {authMode === "login" ? t("auth.loginBtn") : authMode === "register" ? t("auth.registerBtn") : t("auth.sendResetBtn")}
            </button>
          </form>

          {/* Alt linkler */}
          <div className="mt-5 flex flex-col items-center gap-2">
            {authMode !== "login" && (
              <button onClick={() => setAuthMode("login")}
                className="text-brand-600 text-sm font-medium hover:underline">
                ← {t("auth.loginBtn")}
              </button>
            )}
            {authMode === "login" && (
              <p className="text-slate-500 text-sm">
                {t("auth.noAccount")}{" "}
                <button onClick={() => setAuthMode("register")}
                  className="text-brand-600 font-semibold hover:underline">
                  {t("auth.registerBtn")}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Haber kartı ────────────────────────────────────────────
function NewsSection({ items, t, setCurrentPage }) {
  const [lightbox, setLightbox] = useState(null);
  if (!items || items.length === 0) return null;
  return (
    <section style={{background:"#f2f2f2"}} className="pt-16 pb-20">
      <div className="text-center mb-10 px-4">
        <h2 className="font-display font-bold text-slate-900 uppercase mb-3"
          style={{fontSize:"clamp(2rem,5vw,3rem)", letterSpacing:"0.08em"}}>
          {t ? t("news.title") : "Team Events"}
        </h2>
        <p className="text-slate-400 font-light italic text-base">{t ? t("news.subtitle") : "Event news from the Muuvlink community"}</p>
      </div>
      <div className="flex w-full" style={{height:"320px"}}>
        {items.map((item) => (
          <article key={item.id}
            onClick={() => setLightbox(item)}
            className="group relative flex-1 overflow-hidden cursor-pointer"
            style={{background:"#1a2a1a"}}>
            {item.image_url && (
              <img src={item.image_url} alt={item.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
            )}
            <div className="absolute inset-0" style={{background:"linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 55%, transparent 100%)"}}/>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
              <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"/>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="text-white font-semibold text-sm leading-snug mb-1 line-clamp-2">{item.title}</h3>
              {item.date_label && <p className="text-white/50 text-xs font-light">{t ? t("news.published") : "Published"} {item.date_label}</p>}
            </div>
          </article>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center mt-10 px-4">
        <p className="text-slate-500 text-sm mb-3">
          {t ? t("news.cta") : "Want to share your team's event with the Muuvlink community?"}
        </p>
        <button
          onClick={() => setCurrentPage && setCurrentPage("contact")}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all"
        >
          {t ? t("news.ctaBtn") : "Contact Us"} →
        </button>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}>
          <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <button
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition"
              onClick={() => setLightbox(null)}>
              <X className="w-4 h-4"/>
            </button>
            {lightbox.image_url && (
              <img src={lightbox.image_url} alt={lightbox.title}
                className="w-full object-cover" style={{maxHeight:"420px"}}/>
            )}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{lightbox.title}</h3>
              {lightbox.date_label && (
                <p className="text-xs text-slate-400 mb-3">{t ? t("news.published") : "Published"} {lightbox.date_label}</p>
              )}
              {lightbox.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{lightbox.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Galeri fotoğraf ─────────────────────────────────────────
function GalleryItem({ p, style, onOpen }) {
  return (
    <div className="group relative overflow-hidden cursor-pointer bg-slate-900" style={style}
      onClick={() => p.image_url && onOpen(p)}>
      {p.image_url && (
        <img src={p.image_url} alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
        {p.image_url && <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"/>}
      </div>
    </div>
  );
}

// ── Galeri bölümü ───────────────────────────────────────────
function GallerySection({ items, t, setCurrentPage }) {
  const [lightbox, setLightbox] = useState(null);
  if (!items || items.length === 0) return null;
  const total = items.length;
  return (
    <section className="bg-white pt-16 pb-0">
      <div className="text-center mb-10 px-4">
        <h2 className="font-display font-bold text-slate-900 uppercase mb-3"
          style={{fontSize:"clamp(2rem,5vw,3rem)", letterSpacing:"0.08em"}}>{t ? t("gallery.title") : "Gallery"}</h2>
        <p className="text-slate-400 font-light italic text-base mb-6">{t ? t("gallery.subtitle") : "Moments from Muuvlink events"}</p>
        <div className="flex items-center justify-center gap-0 max-w-lg mx-auto">
          <div className="flex-1 border-t border-dashed border-slate-300"/>
          <div className="mx-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <line x1="4" y1="28" x2="28" y2="4" stroke="#94a3b8" strokeWidth="1.5"/>
              <line x1="4" y1="4" x2="28" y2="28" stroke="#94a3b8" strokeWidth="1.5"/>
              <circle cx="4" cy="28" r="2" fill="#94a3b8"/>
              <circle cx="28" cy="28" r="2" fill="#94a3b8"/>
            </svg>
          </div>
          <div className="flex-1 border-t border-dashed border-slate-300"/>
        </div>
      </div>

      {total <= 3 ? (
        <div style={{display:"grid", gridTemplateColumns:`repeat(${total},1fr)`, gridTemplateRows:"280px"}}>
          {items.map(p => <GalleryItem key={p.id} p={p} onOpen={setLightbox}/>)}
        </div>
      ) : total <= 4 ? (
        <div style={{display:"grid", gridTemplateColumns:"1fr 2fr 1fr", gridTemplateRows:"280px 280px"}}>
          <GalleryItem p={items[0]} style={{gridColumn:"1", gridRow:"1 / 3"}} onOpen={setLightbox}/>
          <GalleryItem p={items[1]} style={{gridColumn:"2", gridRow:"1 / 3"}} onOpen={setLightbox}/>
          <GalleryItem p={items[2]} style={{gridColumn:"3", gridRow:"1"}} onOpen={setLightbox}/>
          {items[3] && <GalleryItem p={items[3]} style={{gridColumn:"3", gridRow:"2"}} onOpen={setLightbox}/>}
        </div>
      ) : (
        <>
          <div style={{display:"grid", gridTemplateColumns:"1fr 2fr 1fr", gridTemplateRows:"280px 280px"}}>
            <GalleryItem p={items[0]} style={{gridColumn:"1", gridRow:"1 / 3"}} onOpen={setLightbox}/>
            <GalleryItem p={items[1]} style={{gridColumn:"2", gridRow:"1 / 3"}} onOpen={setLightbox}/>
            <GalleryItem p={items[2]} style={{gridColumn:"3", gridRow:"1"}} onOpen={setLightbox}/>
            <GalleryItem p={items[3]} style={{gridColumn:"3", gridRow:"2"}} onOpen={setLightbox}/>
          </div>
          {items.slice(4).length > 0 && (
            <div style={{display:"grid", gridTemplateColumns:`repeat(${Math.min(items.slice(4).length,3)},1fr)`, gridTemplateRows:"240px"}}>
              {items.slice(4,7).map(p => <GalleryItem key={p.id} p={p} onOpen={setLightbox}/>)}
            </div>
          )}
        </>
      )}

      {/* CTA */}
      <div className="text-center py-12 px-4">
        <p className="text-slate-500 text-sm mb-3">
          {t ? t("gallery.cta") : "Want your photos featured in the Muuvlink gallery?"}
        </p>
        <button
          onClick={() => setCurrentPage && setCurrentPage("contact")}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all"
        >
          {t ? t("gallery.ctaBtn") : "Contact Us"} →
        </button>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition" onClick={() => setLightbox(null)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <img src={lightbox.image_url} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}/>
        </div>
      )}
    </section>
  );
}

// ── HERO BANNER SLİDER ─────────────────────────────────────
function HeroSection({ banners, bannersLoaded, user, setCurrentPage, setAuthMode, setIsAuthModalOpen, platformStats, stats, fmtNum, t, lang }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef(null);

  const startTimer = (len) => {
    clearInterval(timerRef.current);
    if (len <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % len);
    }, 14000);
  };

  useEffect(() => {
    startTimer(banners.length);
    return () => clearInterval(timerRef.current);
  }, [banners.length]);

  const goTo = (idx) => {
    if (idx === activeIdx) return;
    setActiveIdx(idx);
    startTimer(banners.length);
  };

  const handleCtaClick = (url, defaultAction) => {
    if (!url) { defaultAction(); return; }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.open(url, "_blank", "noopener");
    } else {
      // Türkçe URL path → page key dönüşümü
      const pathToPage = {
        "antrenmanlar": "trainings", "/antrenmanlar": "trainings",
        "takimlar":     "teams",     "/takimlar":     "teams",
        "iletisim":     "contact",   "/iletisim":     "contact",
        "profil":       "profile",   "/profil":       "profile",
        "rozetlerim":   "badges",    "/rozetlerim":   "badges",
      };
      const key = pathToPage[url] || pathToPage[url.replace(/^\//, "")] || url.replace(/^\//, "") || "home";
      setCurrentPage(key);
    }
  };

  if (!bannersLoaded || banners.length === 0) return null;

  const activeBanner = banners[activeIdx];
  const gFrom = activeBanner?.gradient_from || "#052e16";
  const gVia  = activeBanner?.gradient_via  || "#004849";
  const gTo   = activeBanner?.gradient_to   || "#006d6f";
  // Nav butonları için aktif banner'ın kontrast durumu
  const activeIsLightBg = (
    _brightness(activeBanner?.gradient_from) +
    _brightness(activeBanner?.gradient_via) +
    _brightness(activeBanner?.gradient_to)
  ) / 3 > 140;
  const navActiveColor   = activeIsLightBg ? "#0d6b6d"            : "#00b7ba";
  const navInactiveColor = activeIsLightBg ? "rgba(0,0,0,0.2)"    : "rgba(255,255,255,0.3)";

  return (
    <div className="relative" style={{
      background: `linear-gradient(115deg, ${gFrom} 0%, ${gVia} 45%, ${gTo} 100%)`,
      transition: "background 1s ease",
      overflow: "hidden",
    }}>
      {/* Arka plan dekorları */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-32 top-1/4 w-[600px] h-[600px] rounded-full"
          style={{background:"radial-gradient(circle,rgba(0,183,186,0.18) 0%,transparent 65%)"}}/>
        <div className="absolute right-[-60px] top-[-40px] w-[700px] h-[700px] rounded-full"
          style={{background:"radial-gradient(circle,rgba(0,183,186,0.1) 0%,transparent 60%)"}}/>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{backgroundImage:"linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)", backgroundSize:"64px 64px"}}/>
      </div>

      {/* Banner katmanları — cross-fade */}
      <div className="relative" style={{minHeight:"680px", overflow:"hidden"}}>
        {banners.map((banner, i) => {
          const isActive = i === activeIdx;
          const bgF = banner?.gradient_from || "#052e16";
          const hasImg = banner?.image_url && banner.image_url !== "";
          // Arka plan parlaklığına göre otomatik kontrast
          const _bgBrightness = (
            _brightness(banner?.gradient_from) +
            _brightness(banner?.gradient_via) +
            _brightness(banner?.gradient_to)
          ) / 3;
          const isLightBg    = _bgBrightness > 140;
          const uiText       = isLightBg ? "rgba(0,0,0,0.72)"   : "rgba(186,230,253,0.88)";
          const uiBorder     = isLightBg ? "rgba(0,0,0,0.18)"   : "rgba(255,255,255,0.14)";
          const uiMuted      = isLightBg ? "rgba(0,0,0,0.48)"   : "rgba(186,230,253,0.5)";
          const uiBadgeBg    = isLightBg ? "rgba(0,0,0,0.07)"   : "rgba(255,255,255,0.06)";
          const uiSecHover   = isLightBg ? "rgba(0,0,0,0.06)"   : "rgba(255,255,255,0.08)";
          return (
            <div key={banner.id} style={{
              position:"absolute", inset:0,
              opacity: isActive ? 1 : 0,
              transform: isActive ? "scale(1)" : "scale(1.015)",
              transition:"opacity 0.9s ease, transform 0.9s ease",
              pointerEvents: isActive ? "auto" : "none",
              zIndex: isActive ? 2 : 1,
            }}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bn-grid" style={{display:"grid", gridTemplateColumns:"55% 45%", minHeight:"680px", paddingTop:"112px"}}>

                  {/* Sol: metin */}
                  <div className="bn-text-col z-10 space-y-7 pr-8 pb-28 flex flex-col justify-center">
                    {banner?.badge_text && (
                      <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold border backdrop-blur-sm"
                        style={{background:uiBadgeBg, borderColor:uiBorder, color:uiText}}>
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{background:"#00b7ba"}}/>
                        {banner.badge_text}
                      </div>
                    )}

                    <div>
                      <h1 className="bn-title font-display" style={{fontSize:"clamp(2.8rem,5.8vw,4.8rem)", lineHeight:1.15, fontWeight:700, letterSpacing:"-0.02em", color: banner?.title_color || "#ffffff", paddingBottom:"0.05em"}}>
                        {(lang === "tr" ? banner?.title : null) || (t ? t("home.heroTitleFallback") : "Connect Through Sport,")}
                      </h1>
                      <h1 className="bn-title bn-motto">
                        {isActive
                          ? <Typewriter
                              mottos={(banner?.mottos?.length > 0 && lang === "tr") ? banner.mottos : (DEFAULT_MOTTOS[lang] || DEFAULT_MOTTOS.en)}
                              color1={banner?.motto_color_1 || "#00b7ba"}
                              color2={banner?.motto_color_2 || "#981dd8"}
                            />
                          : <span>&nbsp;</span>
                        }
                      </h1>
                      <p className="mt-5 text-lg leading-relaxed max-w-md font-light" style={{color: banner?.subtitle_color || "rgba(186,230,253,0.75)"}}>
                        {(lang === "tr" ? banner?.subtitle : null) || (t ? t("home.heroSubtitleFallback") : "")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {!user && (
                        /* Buton 1: Statik "Hemen Başla" — sadece giriş yapılmamışken */
                        <button
                          onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); }}
                          className="group relative flex items-center gap-2.5 px-7 py-3.5 font-medium text-white text-sm overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
                          style={{background:"linear-gradient(135deg,#00b7ba,#009295)", borderRadius:"14px", boxShadow:"0 8px 32px rgba(0,183,186,0.4)"}}
                        >
                          <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[14px]"/>
                          {t ? t("home.startBtn") : "Get Started"}
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                        </button>
                      )}
                      {/* Buton 2: Admin panelinden düzenlenebilir — her zaman göster */}
                      <button
                        onClick={() => handleCtaClick(banner?.cta_primary_url, () => setCurrentPage("trainings"))}
                        className={`flex items-center gap-2 px-7 py-3.5 font-semibold text-sm transition-all duration-300 rounded-[14px] ${user ? "group relative overflow-hidden hover:scale-[1.03] hover:shadow-2xl" : ""}`}
                        style={user
                          ? {background:"linear-gradient(135deg,#00b7ba,#009295)", color:"#fff", borderRadius:"14px", boxShadow:"0 8px 32px rgba(0,183,186,0.4)"}
                          : {color:uiText, border:`1px solid ${uiBorder}`, background:"transparent"}}
                        onMouseEnter={e=>{ if(!user) e.currentTarget.style.background=uiSecHover; }}
                        onMouseLeave={e=>{ if(!user) e.currentTarget.style.background="transparent"; }}
                      >
                        {user && <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[14px]"/>}
                        {(lang === "tr" ? banner?.cta_primary_text : lang === "en" ? banner?.cta_primary_text_en : banner?.cta_primary_text_de) || t("home.heroCtaSecondary")}
                        {user && <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>}
                      </button>
                    </div>

                    <div className="bn-stats flex items-stretch gap-0 pt-2">
                      {stats.slice(0,2).map((s, si) => {
                        const Icon = s.icon;
                        return (
                          <React.Fragment key={si}>
                            {si > 0 && (
                              <div style={{width:"1px", alignSelf:"stretch", margin:"0 20px", background: isLightBg ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)"}}/>
                            )}
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2.5">
                                <div style={{
                                  width:"30px", height:"30px", borderRadius:"9px", flexShrink:0,
                                  background: isLightBg ? "rgba(0,183,186,0.14)" : "rgba(0,183,186,0.22)",
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                }}>
                                  <Icon style={{width:"14px", height:"14px", color:"#00b7ba"}}/>
                                </div>
                                <span style={{
                                  fontSize:"1.6rem", fontWeight:800, lineHeight:1,
                                  color: isLightBg ? "#0d6b6d" : "#00b7ba",
                                }}>{s.value}</span>
                              </div>
                              <div style={{
                                fontSize:"0.68rem", fontWeight:600, letterSpacing:"0.06em",
                                textTransform:"uppercase", color:uiMuted, paddingLeft:"40px",
                              }}>{s.label}</div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sağ: görsel — layout için boş kolon */}
                  <div className="bn-img-col"/>
                </div>
              </div>

              {/* Görsel: banner container'ına absolute — kolon sınırı yok, sadece banner dışına çıkmaz */}
              {hasImg && (
                <>
                  {/* Glow */}
                  <div className="absolute pointer-events-none"
                    style={{right:"10%", bottom:0, width:"500px", height:"400px", borderRadius:"50%", filter:"blur(80px)", background:"radial-gradient(ellipse,rgba(0,183,186,0.2) 0%,rgba(0,183,186,0.1) 55%,transparent 70%)"}}/>
                  {/* Görsel: right side, bottom:-50px → float sırasında alt kenar görünmez */}
                  <div className="bn-banner-img absolute pointer-events-none"
                    style={{right:0, top:0, bottom:"-50px", width:"52%", display:"flex", justifyContent:"center", alignItems:"flex-end", animation:"heroFloat 5s ease-in-out infinite"}}>
                    <img
                      src={`${BASE_URL}${banner.image_url}`}
                      alt=""
                      className="select-none"
                      style={{height:"100%", width:"auto", maxWidth:"none", objectFit:"contain", objectPosition:"bottom center", filter:"drop-shadow(0 8px 32px rgba(0,0,0,0.22))"}}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigasyon — alt orta progress çubukları */}
      {banners.length > 1 && (
        <div className="bn-nav" style={{
          position:"absolute", bottom:"32px", left:"50%", transform:"translateX(-50%)",
          zIndex:30, display:"flex", alignItems:"center", gap:"8px",
        }}>
          {banners.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              aria-label={`Slayt ${i + 1}`}
              aria-current={i === activeIdx ? "true" : undefined}
              style={{
                height:"3px",
                width: i === activeIdx ? "32px" : "16px",
                borderRadius:"2px", border:"none", cursor:"pointer", padding:0,
                background: i === activeIdx ? navActiveColor : navInactiveColor,
                transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
              }}/>
          ))}
        </div>
      )}

      <style>{`
        @keyframes heroFloat { 0%,100%{transform:translateY(0)} 45%{transform:translateY(-14px)} 70%{transform:translateY(-8px)} }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
        @media (max-width: 767px) {
          .bn-grid     { display:flex !important; flex-direction:column !important; min-height:auto !important; padding-top:88px !important; padding-bottom:60px; }
          .bn-text-col { padding-right:0 !important; padding-bottom:0 !important; }
          .bn-img-col  { display:none !important; }
          .bn-banner-img { display:none !important; }
          .bn-nav      { display:flex !important; }
          .bn-title    { white-space:normal !important; font-size:4.5rem !important; line-height:1.18 !important; word-break:normal !important; overflow-wrap:normal !important; padding-bottom:0.05em !important; }
          .bn-motto    { white-space:normal !important; font-size:4.5rem !important; line-height:1.18 !important; word-break:normal !important; overflow-wrap:normal !important; padding-bottom:0.1em !important; }
          .bn-stats    { display:none !important; }
        }
      `}</style>
    </div>
  );
}

export default function Muuvlink() {
  // ── URL ↔ sayfa eşlemesi ─────────────────────────────
  const PAGE_TO_PATH = {
    home:              "/",
    trainings:         "/antrenmanlar",
    teams:             "/takimlar",
    contact:           "/iletisim",
    profile:           "/profil",
    "create-training": "/antrenman-ekle",
    "create-team":     "/takim-kur",
    badges:            "/rozetlerim",
  };
  const PATH_TO_PAGE = Object.fromEntries(Object.entries(PAGE_TO_PATH).map(([k,v])=>[v,k]));

  // PAGE_META moved below – uses t() for localised titles/descriptions

  // ── Dil ─────────────────────────────────────────────────
  const [lang, setLang] = useState(() => {
    const l = detectLang();
    document.documentElement.lang = l;
    return l;
  });
  const t = createT(lang);
  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem("muuvlang", l);
    document.documentElement.lang = l;
  };
  const [langDropOpen, setLangDropOpen] = useState(false);
  const langDropRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target)) setLangDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const PAGE_META = {
    home:              { title:`Muuvlink — ${t("home.heroTagline")}`,             desc: t("home.heroSubtitleFallback")  },
    trainings:         { title:`${t("trainings.pageTitle")} — Muuvlink`,          desc: t("trainings.pageSubtitle")     },
    teams:             { title:`${t("teams.pageTitle")} — Muuvlink`,              desc: t("teams.pageSubtitle")         },
    contact:           { title:`${t("contact.pageTitle")} — Muuvlink`,            desc: t("contact.pageSubtitle")       },
    profile:           { title:`${t("profile.pageTitle")} — Muuvlink`,            desc: t("profile.pageTitle")          },
    "create-training": { title:`${t("createTraining.pageTitle")} — Muuvlink`,     desc: t("createTraining.pageSubtitle")},
    "create-team":     { title:`${t("createTeam.pageTitle")} — Muuvlink`,         desc: t("createTeam.pageSubtitle")    },
    badges:            { title:`${t("badges.pageTitle")} — Muuvlink`,             desc: t("badges.pageSubtitle")        },
    "not-found":       { title:`${t("notFound.title")} — Muuvlink`,               desc: t("notFound.subtitle")          },
  };

  const [currentPage, setCurrentPage] = useState(() => PATH_TO_PAGE[window.location.pathname] ?? (window.location.pathname === "/" ? "home" : "not-found"));
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [trainings, setTrainings] = useState([]);
  const [teams, setTeams] = useState([]);
  const [myTrainings, setMyTrainings] = useState([]);
  const [joinedTrainings, setJoinedTrainings] = useState([]);
  const [myTeamTrainings, setMyTeamTrainings] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [badges, setBadges] = useState([]);
  const [userBadges, setUserBadges] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [activityData, setActivityData] = useState([]);
  const [activityMeta, setActivityMeta] = useState({ streak: 0, weekTotal: 0 });
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [legalModal, setLegalModal] = useState(null); // 'kvkk' | 'gizlilik' | 'kullanim' | 'cerez'
  const [cookieConsent, setCookieConsent] = useState(() => localStorage.getItem("cookieConsent") === "true");
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [teamActiveTab, setTeamActiveTab] = useState("wall");
  const teamActiveTabRef = useRef("wall");
  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyDistance, setNearbyDistance] = useState(10);
  const [nearbyTrainings, setNearbyTrainings] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // {message, onConfirm, danger}
  const [resetToken, setResetToken] = useState(null); // URL'den gelen şifre sıfırlama token'ı
  const [joiningTrainingId, setJoiningTrainingId] = useState(null);
  const [joiningTeamId, setJoiningTeamId] = useState(null);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [gpsErrorCode, setGpsErrorCode] = useState(null); // 1=denied, 2=unavailable, 3=timeout
  const [manualLocationName, setManualLocationName] = useState("");
  const [banners, setBanners] = useState([]);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [homeNews, setHomeNews] = useState([]);
  const [homeGallery, setHomeGallery] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);

  // Avatar'ı render et: URL ise <img>, değilse emoji/harf
  const renderAvatar = (avatar, name, className = "") => {
    if (avatar?.startsWith("/uploads/") || avatar?.startsWith("http")) {
      const src = avatar.startsWith("http") ? avatar : `${BASE_URL}${avatar}`;
      return <img src={src} alt="" className={`w-full h-full object-cover ${className}`} />;
    }
    const letter = name?.[0]?.toLocaleUpperCase("en-US") ?? "?";
    return <span className="text-inherit font-bold">{letter}</span>;
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const showConfirm = (message, onConfirm, { danger = false } = {}) => {
    setConfirmModal({ message, onConfirm, danger });
  };

  const ConfirmModal = () => {
    if (!confirmModal) return null;
    const { message, onConfirm, danger } = confirmModal;
    const close = () => setConfirmModal(null);
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200]">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
          <div className="p-6">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${danger ? "bg-red-50" : "bg-amber-50"}`}>
              <svg className={`w-5 h-5 ${danger ? "text-red-500" : "text-amber-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
              </svg>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed font-medium">{message}</p>
          </div>
          <div className="flex border-t border-slate-100">
            <button onClick={close} className="flex-1 py-3.5 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
              {t("common.cancel")}
            </button>
            <div className="w-px bg-slate-100"/>
            <button
              onClick={() => { close(); onConfirm(); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${danger ? "text-red-600 hover:bg-red-50" : "text-brand-700 hover:bg-brand-50"}`}
            >
              {t("common.confirm")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---- LOCATION PICKER (adres arama + benim konumum) ----
  const LocationPicker = ({ locationName, lat, lng, onLocationName, onLat, onLng }) => {
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
          } else {
            showError(t("location.gpsFail"));
          }
        },
        { timeout: 8000, enableHighAccuracy: false }
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
          <div className="fixed inset-0 z-[600] flex flex-col bg-white">

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
                style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}
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
  };
  // ---- END LOCATION PICKER ----

  const fmtNum = (n) => n == null ? "—" : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(n);
  const stats = [
    { icon: Users,    label: t("home.statsUsers"),     value: fmtNum(platformStats?.users),     color: "text-brand-400" },
    { icon: Activity, label: t("home.statsTrainings"), value: fmtNum(platformStats?.trainings), color: "text-cyan-400" },
    { icon: Target,   label: t("home.statsTeams"),     value: fmtNum(platformStats?.teams),     color: "text-brand-400" },
    { icon: Award,    label: t("home.statsBadges"),    value: fmtNum(platformStats?.badges),    color: "text-amber-400" },
  ];

  const sportTypes = [
    "Basketbol",
    "Bisiklet",
    "Crossfit",
    "Futbol",
    "Kano",
    "Koşu",
    "Kürek",
    "Padel",
    "Pilates",
    "Tenis",
    "Trekking",
    "Triatlon",
    "Voleybol",
    "Yoga",
    "Yüzme",
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserData(token);
    }
    fetchTrainings();
    fetchTeams();
    fetchBadges();

    // Kaydedilmiş konum varsa yükle (GPS izni istemez)
    const savedLoc = localStorage.getItem("userLocation");
    if (savedLoc) {
      try { setUserLocation(JSON.parse(savedLoc)); } catch (_) {}
    }
    // İzin daha önce verilmişse sessizce güncel konumu al (prompt çıkmaz)
    // Böylece km mesafeleri her zaman gerçek anlık konuma göre hesaplanır
    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then(perm => {
        if (perm.state === "granted") {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              setUserLocation(loc);
              localStorage.setItem("userLocation", JSON.stringify(loc));
            },
            () => {} // Sessiz hata — eski konum kalmaya devam eder
          );
        }
      }).catch(() => {});
    }
    // GPS'i otomatik isteme — kullanıcı "Yakınımda Ara" butonuna bastığında sorulur
    // (Sayfa açılışında permission prompt = PageSpeed penaltı + UX kötü)

    // Banner'ları çek
    fetch(`${API_URL}/banners`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setBanners(data);
        setBannersLoaded(true);
      })
      .catch(() => setBannersLoaded(true));

    // Anasayfa haber ve galeri
    fetch(`${API_URL}/home-news`).then(r=>r.ok?r.json():[]).then(d=>{ if(Array.isArray(d)) setHomeNews(d); }).catch(()=>{});
    fetch(`${API_URL}/home-gallery`).then(r=>r.ok?r.json():[]).then(d=>{ if(Array.isArray(d)) setHomeGallery(d); }).catch(()=>{});

    // Platform istatistiklerini çek
    fetch(`${API_URL}/platform-stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlatformStats(data); })
      .catch(() => {});
  }, []);

  // Trainings sayfasına geçilince güncel veri çek
  useEffect(() => {
    if (currentPage === "trainings") fetchTrainings();
  }, [currentPage]);

  // URL'de reset_token / auth=register / accept_invite varsa yönlendir
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("reset_token");
    const auth = params.get("auth");
    const acceptInvite = params.get("accept_invite");
    if (t) {
      setResetToken(t);
      setCurrentPage("reset-password");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (auth === "register") {
      setAuthMode("register");
      setIsAuthModalOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (acceptInvite) {
      window.history.replaceState({}, "", window.location.pathname);
      const token = localStorage.getItem("token");
      if (token) {
        fetch(`${API_URL}/teams/${acceptInvite}/accept-invite`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(data => {
          if (data.message) {
            showToast(t("notifications.inviteAccepted"), "success");
            fetchTeamDetails(acceptInvite);
          } else {
            showToast(data.error || t("toast.inviteNotFound"), "error");
          }
        }).catch(() => showToast(t("common.error"), "error"));
      } else {
        // Giriş yapılmamış — login modalı aç, sonra tekrar dene
        localStorage.setItem("pendingInvite", acceptInvite);
        setAuthMode("login");
        setIsAuthModalOpen(true);
        showToast(t("toast.inviteLogin"), "info");
      }
    }
    // Takım deep-link: ?takim=ID  /  mail'deki duvara git: ?takim=ID&tab=duvar
    const takimId = params.get("takim");
    if (takimId) {
      const tab = params.get("tab"); // "duvar" → wall, yoksa members
      window.history.replaceState({}, "", window.location.pathname);
      teamActiveTabRef.current = tab === "duvar" ? "wall" : "members";
      const token = localStorage.getItem("token");
      if (token) {
        fetchTeamDetails(takimId);
      } else {
        localStorage.setItem("pendingTeam", takimId);
        localStorage.setItem("pendingTeamTab", tab || "members");
        setAuthMode("login");
        setIsAuthModalOpen(true);
      }
    }
    // Antrenman deep-link: ?antrenman=ID (paylaşılan link)
    const antrenmanId = params.get("antrenman");
    if (antrenmanId) {
      window.history.replaceState({}, "", window.location.pathname);
      const token = localStorage.getItem("token");
      if (token) {
        fetchTrainingDetails(antrenmanId);
      } else {
        localStorage.setItem("pendingTraining", antrenmanId);
        setAuthMode("login");
        setIsAuthModalOpen(true);
      }
    }
  }, []);

  // Real-time bildirimler: SSE bağlantısı
  // bfcache için: sayfa gizlenince kapat, tekrar görününce yeniden aç
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    let es = null;
    const connect = () => {
      if (es) es.close();
      es = new EventSource(`${API_URL}/notifications/stream?token=${encodeURIComponent(token)}`);
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === "notification" && msg.data) {
            setNotifications(prev => [msg.data, ...prev]);
            showToast(msg.data.title, "info");
          }
        } catch {}
      };
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { es?.close(); es = null; }
      else connect();
    };

    connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      es?.close();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id]);

  // Sayfa değişince URL + title + meta güncelle
  useEffect(() => {
    const meta  = PAGE_META[currentPage];
    const path  = PAGE_TO_PATH[currentPage];
    const title = meta?.title || "Muuvlink";
    const desc  = meta?.desc  || t("home.heroSubtitleFallback");
    const url   = `https://muuvlink.app${path || "/"}`;

    document.title = title;

    if (path && window.location.pathname !== path) {
      window.history.pushState({ page: currentPage }, title, path);
    }

    const setMeta = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
    setMeta('meta[name="description"]',          "content", desc);
    setMeta('meta[property="og:title"]',          "content", title);
    setMeta('meta[property="og:description"]',    "content", desc);
    setMeta('meta[property="og:url"]',            "content", url);
    setMeta('meta[name="twitter:title"]',         "content", title);
    setMeta('meta[name="twitter:description"]',   "content", desc);
    setMeta('meta[name="twitter:url"]',           "content", url);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = url;
  }, [currentPage]);

  // Tarayıcı geri/ileri tuşu
  useEffect(() => {
    const onPop = () => {
      const page = PATH_TO_PAGE[window.location.pathname] ?? (window.location.pathname === "/" ? "home" : "not-found");
      setCurrentPage(page);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Sayfa değişince en üste scroll
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentPage]);

  // Profil sayfasına her gelindiğinde verileri taze çek
  useEffect(() => {
    if (currentPage === "profile") {
      const token = localStorage.getItem("token");
      if (token) {
        fetchMyTrainings(token);
        fetchMyTeams(token);
      }
    }
  }, [currentPage]);

  const fetchUserData = async (token) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        fetchMyTrainings(token);
        fetchMyTeams(token);
        fetchNotifications(token);
        fetchUserStats(token, data.user.id);
        fetchUserBadges(token, data.user.id);
        fetchUserActivity(token, data.user.id);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleLogin = async (email, password, setError) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        setUser(data.user);
        setIsAuthModalOpen(false);
        fetchUserData(data.token);
        fetchTrainings();
        fetchTeams();
        const pendingInvite = localStorage.getItem("pendingInvite");
        if (pendingInvite) {
          localStorage.removeItem("pendingInvite");
          fetch(`${API_URL}/teams/${pendingInvite}/accept-invite`, {
            method: "POST",
            headers: { Authorization: `Bearer ${data.token}` },
          }).then(r => r.json()).then(d => {
            if (d.message) { showToast(t("notifications.inviteAccepted"), "success"); fetchTeamDetails(pendingInvite); fetchMyTeams(data.token); fetchMyTrainings(data.token); }
          });
        }
        const pendingTeam = localStorage.getItem("pendingTeam");
        if (pendingTeam) {
          localStorage.removeItem("pendingTeam");
          const pendingTab = localStorage.getItem("pendingTeamTab") || "members";
          localStorage.removeItem("pendingTeamTab");
          teamActiveTabRef.current = pendingTab === "duvar" ? "wall" : pendingTab;
          fetchTeamDetails(pendingTeam);
        }
        const pendingTraining = localStorage.getItem("pendingTraining");
        if (pendingTraining) {
          localStorage.removeItem("pendingTraining");
          fetchTrainingDetails(pendingTraining);
        }
      } else {
        const msg = data.error || t("auth.loginFail");
        if (setError) setError(
          msg === "Invalid credentials"
            ? t("auth.invalidCredentials")
            : msg
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      if (setError) setError(t("auth.serverError"));
    }
  };

  const handleRegister = async (name, email, password, setError) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        setUser(data.user);
        setIsAuthModalOpen(false);
        fetchUserData(data.token);
        fetchTrainings();
        fetchTeams();
      } else {
        const msg = data.error || t("auth.registerFail");
        if (setError) setError(
          msg.includes("duplicate") || msg.includes("unique")
            ? t("auth.emailInUse")
            : msg
        );
      }
    } catch (error) {
      console.error("Register error:", error);
      if (setError) setError(t("auth.serverError"));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setMyTrainings([]);
    setJoinedTrainings([]);
    setMyTeamTrainings([]);
    setMyTeams([]);
    setNotifications([]);
    setUserBadges([]);
    setUserStats(null);
    setActivityData([]);
    setCurrentPage("home");
  };

  const handleUpdateProfile = async (formData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setShowProfileEdit(false);
        showToast(t("toast.profileUpdated"), "success");
      }
    } catch (error) {
      console.error("Update profile error:", error);
    }
  };

  // Saat geçmiş antrenmanları client tarafında da filtrele
  const filterPastTrainings = (list) => {
    const istFmt  = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' });
    const timeFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul',
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const now        = new Date();
    const todayStr   = istFmt.format(now);   // 'YYYY-MM-DD'
    const nowTimeStr = timeFmt.format(now);  // 'HH:MM:SS'
    return list.filter(tr => {
      // training_date pg'den Date nesnesi veya string olarak gelebilir — ikisini de destekle
      const raw = tr.training_date;
      if (!raw) return true;
      const d = raw instanceof Date
        ? raw.toISOString().slice(0, 10)   // Date nesnesi → UTC ISO string → YYYY-MM-DD
        : String(raw).slice(0, 10);        // string → YYYY-MM-DD
      const t = tr.training_time ? String(tr.training_time).slice(0, 8) : null;
      if (d > todayStr) return true;
      if (d < todayStr) return false;
      return !t || t >= nowTimeStr;
    });
  };

  const fetchTrainings = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/trainings`, { headers, cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setTrainings(filterPastTrainings(data.trainings || []));
      }
    } catch (error) {
      console.error("Fetch trainings error:", error);
    }
  };

  const fetchNearbyTrainings = async (lat, lng, radius) => {
    setNearbyLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(
        `${API_URL}/trainings/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
        { headers, cache: 'no-store' }
      );
      if (response.ok) {
        const data = await response.json();
        setNearbyTrainings(filterPastTrainings(data.trainings || []));
      }
    } catch (error) {
      console.error("Fetch nearby trainings error:", error);
    } finally {
      setNearbyLoading(false);
    }
  };

  const applyNearbyLocation = (latitude, longitude, locationName, distanceOverride) => {
    const radius = distanceOverride ?? nearbyDistance;
    setUserLocation({ lat: latitude, lng: longitude });
    setManualLocationName(locationName || "");
    setNearbyMode(true);
    setLocationLoading(false);
    setShowManualLocation(false);
    fetchNearbyTrainings(latitude, longitude, radius);
    setCurrentPage("trainings");
  };

  const handleNearbySearch = (distanceOverride) => {
    setLocationLoading(true);
    setShowManualLocation(false);
    setGpsErrorCode(null);

    if (!navigator.geolocation) {
      setLocationLoading(false);
      setGpsErrorCode(2);
      setShowManualLocation(true);
      setCurrentPage("trainings");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const lat = position?.coords?.latitude;
          const lng = position?.coords?.longitude;
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) throw new Error("Geçersiz koordinat");
          setGpsErrorCode(null);
          applyNearbyLocation(lat, lng, t("trainings.currentLocation"), distanceOverride);
        } catch (e) {
          console.error("GPS callback error:", e);
          setLocationLoading(false);
          setGpsErrorCode(2);
          setShowManualLocation(true);
          setCurrentPage("trainings");
        }
      },
      (err) => {
        setLocationLoading(false);
        setGpsErrorCode(err?.code ?? 2); // 1=denied, 2=unavailable, 3=timeout
        setShowManualLocation(true);
        setCurrentPage("trainings");
      },
      { timeout: 15000, enableHighAccuracy: false }
    );
  };

  const fetchMyTrainings = async (token) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [joinedRes, teamRes] = await Promise.all([
        fetch(`${API_URL}/trainings/my-joined`, { headers }),
        fetch(`${API_URL}/trainings/my-team-trainings`, { headers }),
      ]);
      if (joinedRes.ok) {
        const data = await joinedRes.json();
        setJoinedTrainings(data.trainings || []);
      }
      if (teamRes.ok) {
        const data = await teamRes.json();
        setMyTeamTrainings(data.trainings || []);
      }
    } catch (error) {
      console.error("Fetch my trainings error:", error);
    }
  };

  const fetchTrainingDetails = async (trainingId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/trainings/${trainingId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedTraining(data.training);
        setCurrentPage("training-detail");
      } else {
        const data = await response.json().catch(() => ({}));
        // Giriş gerektiren içerik → login modal aç
        if (response.status === 401 || data.requiresAuth) {
          setAuthMode("login");
          setIsAuthModalOpen(true);
        }
      }
    } catch (error) {
      console.error("Fetch training details error:", error);
    }
  };

  const handleJoinTraining = async (trainingId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setAuthMode("login");
        setIsAuthModalOpen(true);
        return;
      }
      setJoiningTrainingId(trainingId);
      const response = await fetch(`${API_URL}/trainings/${trainingId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        showToast(t("toast.joinTraining"), "success");
        fetchTrainings();
        fetchMyTrainings(token);
        if (selectedTraining?.id === trainingId) {
          fetchTrainingDetails(trainingId);
        }
      } else {
        const data = await response.json();
        showToast(data.error || t("toast.joinFail"), "error");
      }
    } catch (error) {
      console.error("Join training error:", error);
      showToast(t("toast.networkError"), "error");
    } finally {
      setJoiningTrainingId(null);
    }
  };

  const handleLeaveTraining = async (trainingId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      setJoiningTrainingId(trainingId);
      const response = await fetch(`${API_URL}/trainings/${trainingId}/leave`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        showToast(t("toast.leaveTraining"), "success");
        fetchTrainings();
        fetchMyTrainings(token);
        if (selectedTraining?.id === trainingId) {
          fetchTrainingDetails(trainingId);
        }
      } else {
        const data = await response.json();
        showToast(data.error || t("toast.leaveFail"), "error");
      }
    } catch (error) {
      console.error("Leave training error:", error);
      showToast(t("toast.networkError"), "error");
    } finally {
      setJoiningTrainingId(null);
    }
  };

  const handleCreateTraining = async (formData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/trainings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showToast(t("toast.trainingCreated"), "success");
        setCurrentPage("profile");
        fetchTrainings();
        fetchMyTrainings(token);
      } else {
        const data = await response.json();
        showToast(data.error || t("toast.createFail"), "error");
      }
    } catch (error) {
      console.error("Create training error:", error);
    }
  };

  const handleUpdateTraining = async (trainingId, formData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/trainings/${trainingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        showToast(t("toast.trainingUpdated"), "success");
        fetchTrainingDetails(trainingId);
        fetchTrainings();
        fetchMyTrainings(token);
      } else {
        const data = await response.json();
        showToast(data.error || t("toast.updateFail"), "error");
      }
    } catch (error) {
      console.error("Update training error:", error);
    }
  };

  const handleDeleteTraining = (trainingId) => {
    showConfirm(t("trainingDetail.confirmDelete"), async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/trainings/${trainingId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          showToast(t("toast.trainingDeleted"), "info");
          setCurrentPage("profile");
          fetchTrainings();
          fetchMyTrainings(token);
        }
      } catch (error) {
        console.error("Delete error:", error);
      }
    }, { danger: true });
  };

  const handleAddComment = async (trainingId, comment) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/trainings/${trainingId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment }),
      });
      fetchTrainingDetails(trainingId);
    } catch (error) {
      console.error("Add comment error:", error);
    }
  };

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/teams`, { headers });

      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error("Fetch teams error:", error);
    }
  };

  const fetchMyTeams = async (token) => {
    try {
      // member_only=true → sadece gerçekten üye olduğum takımlar
      const response = await fetch(`${API_URL}/teams?member_only=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMyTeams(data.teams || []);
      }
    } catch (error) {
      console.error("Fetch my teams error:", error);
    }
  };

  const handleUpdateTeam = async (teamId, formData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/teams/${teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        showToast(t("toast.teamUpdated"), "success");
        fetchTeamDetails(teamId);
        fetchTeams();
        fetchMyTeams(token);
      } else {
        const data = await response.json();
        showToast(data.error || t("toast.updateFail"), "error");
      }
    } catch { showToast(t("toast.networkError"), "error"); }
  };

  const handleDeleteTeam = (teamId) => {
    showConfirm(t("teamDetail.confirmDelete"), async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/teams/${teamId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          showToast(t("toast.teamDeleted"), "info");
          setCurrentPage("teams");
          fetchTeams();
          fetchMyTeams(token);
          fetchMyTrainings(token);
        } else {
          const data = await response.json();
          showToast(data.error || t("toast.deleteFail"), "error");
        }
      } catch { showToast(t("toast.networkError"), "error"); }
    }, { danger: true });
  };

  const handleChangeMemberRole = async (teamId, userId, role) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/teams/${teamId}/members/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      if (response.ok) {
        showToast(t("toast.roleUpdated"), "success");
        fetchTeamDetails(teamId);
      } else {
        const data = await response.json();
        showToast(data.error || t("toast.roleUpdateFail"), "error");
      }
    } catch { showToast(t("toast.networkError"), "error"); }
  };

  const fetchTeamDetails = async (teamId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedTeam(data.team);
        setCurrentPage("team-detail");
        // owner/coach ise bekleyen davetleri çek
        const myRole = data.team?.members?.find(m => m.id === user?.id)?.role;
        if (myRole === 'owner' || myRole === 'coach' || myRole === 'captain') {
          fetchPendingInvitations(teamId, token);
        } else {
          setPendingInvitations([]);
        }
      } else if (response.status === 403) {
        showToast("Bu gizli bir takım. Erişmek için davet edilmeniz gerekiyor.", "info");
      } else {
        showToast("Takım detaylarına erişim yok!", "error");
      }
    } catch (error) {
      console.error("Fetch team details error:", error);
    }
  };

  const fetchPendingInvitations = async (teamId, token) => {
    try {
      const res = await fetch(`${API_URL}/teams/${teamId}/invitations`, {
        headers: { Authorization: `Bearer ${token || localStorage.getItem("token")}` },
      });
      if (res.ok) setPendingInvitations(await res.json());
    } catch (e) { /* sessizce geç */ }
  };

  const handleCancelInvitation = (teamId, inviteId) => {
    showConfirm(t("teamDetail.confirmCancelInvite"), async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/teams/${teamId}/invitations/${inviteId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setPendingInvitations(prev => prev.filter(i => i.id !== inviteId));
          showToast(t("toast.inviteCancelled"), "info");
        }
      } catch (e) {
        showToast("Bir hata oluştu.", "error");
      }
    });
  };

  const handleJoinTeam = async (teamId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setAuthMode("login");
        setIsAuthModalOpen(true);
        return;
      }
      setJoiningTeamId(teamId);
      const response = await fetch(`${API_URL}/teams/${teamId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        showToast(t("teams.joinSuccess"), "success");
        fetchTeams();
        fetchMyTeams(token);
        fetchMyTrainings(token);
        if (selectedTeam?.id === teamId) {
          fetchTeamDetails(teamId);
        }
      } else {
        const data = await response.json();
        showToast(data.error || t("toast.joinFail"), "error");
      }
    } catch (error) {
      console.error("Join team error:", error);
      showToast(t("toast.networkError"), "error");
    } finally {
      setJoiningTeamId(null);
    }
  };

  const handleCreateTeam = async (formData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showToast(t("createTeam.success"), "success");
        setCurrentPage("profile");
        fetchTeams();
        fetchMyTeams(token);
        fetchMyTrainings(token);
      }
    } catch (error) {
      console.error("Create team error:", error);
    }
  };

  const handleInviteToTeam = async (teamId, email) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/teams/${teamId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || t("toast.inviteFail"), "error");
        return;
      }

      if (data.is_registered) {
        showToast(t("toast.inviteSent"), "success");
      } else {
        showToast(t("toast.inviteSentNew"), "info");
      }
      setShowInviteModal(false);
      fetchPendingInvitations(teamId);
    } catch (error) {
      console.error("Invite error:", error);
      showToast(t("common.error"), "error");
    }
  };

  const handleRemoveMember = (teamId, userId) => {
    showConfirm(t("teamDetail.confirmRemoveMember"), async () => {
      try {
        const token = localStorage.getItem("token");
        await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast(t("toast.memberRemoved"), "info");
        fetchTeamDetails(teamId);
      } catch (error) {
        console.error("Remove member error:", error);
      }
    }, { danger: true });
  };

  const handleAddTeamPost = async (teamId, message) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/teams/${teamId}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || t("toast.postFail"), "error");
        return;
      }

      // Takım detayını yenileyerek yeni gönderiyi göster
      fetchTeamDetails(teamId);
      showToast(t("toast.postShared"), "success");
    } catch (error) {
      console.error("Add post error:", error);
      showToast(t("common.error"), "error");
    }
  };

  const fetchNotifications = async (token) => {
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Fetch notifications error:", error);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications(token);
    } catch (error) {
      console.error("Mark notification error:", error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/notifications/${notificationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications(token);
    } catch (error) {
      console.error("Delete notification error:", error);
    }
  };

  const fetchBadges = async () => {
    try {
      const response = await fetch(`${API_URL}/badges`);
      if (response.ok) {
        const data = await response.json();
        setBadges(data.badges || []);
      }
    } catch (error) {
      console.error("Fetch badges error:", error);
    }
  };

  const fetchUserBadges = async (token, userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUserBadges(data.stats.badges || []);
      }
    } catch (error) {
      console.error("Fetch user badges error:", error);
    }
  };

  const fetchUserStats = async (token, userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUserStats(data.stats);
      }
    } catch (error) {
      console.error("Fetch user stats error:", error);
    }
  };

  const fetchUserActivity = async (token, userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setActivityData(data.activity || []);
        setActivityMeta({ streak: data.streak || 0, weekTotal: data.weekTotal || 0 });
      }
    } catch (error) {
      console.error("Fetch activity error:", error);
    }
  };
  // =====================================================
  // COMPONENTS
  // =====================================================



  // ── SPORT CATEGORIES STRIP ──────────────────────────

  // ── FEATURES SECTION — Editorial Split-Screen ────────
  const FeaturesSection = () => {
    const editorialFeatures = [
      {
        num:"01", icon: MapPin, accent:"#006d6f",
        bg:"linear-gradient(135deg,#e5f9f9 0%,#e5f9f9 50%,#cbf3f3 100%)",
        image: "/uploads/feature-01.webp",
        sub:   t("home.ef1Sub"),
        title: t("home.ef1Title"),
        desc:  t("home.ef1Desc"),
        points:[t("home.ef1p1"), t("home.ef1p2"), t("home.ef1p3")],
      },
      {
        num:"02", icon: Users, accent:"#006d6f",
        bg:"linear-gradient(135deg,#e5f9f9 0%,#cbf3f3 50%,#97e7e8 100%)",
        image: "/uploads/feature-02.webp",
        sub:   t("home.ef2Sub"),
        title: t("home.ef2Title"),
        desc:  t("home.ef2Desc"),
        points:[t("home.ef2p1"), t("home.ef2p2"), t("home.ef2p3")],
      },
      {
        num:"03", icon: Trophy, accent:"#006d6f",
        bg:"linear-gradient(135deg,#e5f9f9 0%,#00b7ba 50%,#009295 100%)",
        image: "/uploads/feature-03.webp",
        sub:   t("home.ef3Sub"),
        title: t("home.ef3Title"),
        desc:  t("home.ef3Desc"),
        points:[t("home.ef3p1"), t("home.ef3p2"), t("home.ef3p3")],
      },
    ];

    return (
      <div className="bg-white overflow-hidden">
        {/* Section header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <span className="text-[11px] font-bold tracking-[0.4em] uppercase block mb-5"
                style={{color:"#006d6f"}}>{t("home.platform")}</span>
              <h2 className="font-display font-bold tracking-tight leading-[0.88]"
                style={{fontSize:"clamp(3.6rem,8vw,6.5rem)"}}>
                <span className="text-slate-900 block">{t("home.whyNeden")}</span>
                <span style={{
                  background:"linear-gradient(90deg,#00b7ba 0%,#009295 100%)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
                }}>{t("home.whyMuuvlink")}</span>
              </h2>
            </div>
            <div className="md:max-w-md md:pb-3">
              <p className="font-bold italic leading-snug text-slate-700"
                style={{fontSize:"clamp(1.15rem,2.2vw,1.45rem)"}}>
                {t("home.featTagline")}
              </p>
            </div>
          </div>
        </div>

        {/* Alternating editorial rows */}
        {editorialFeatures.map((f, i) => (
          <div key={i} className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
            style={{borderTop:"1px solid #f1f5f9", minHeight:"360px"}}>
            {/* Görsel ya da renkli panel */}
            <div className="md:w-5/12 relative overflow-hidden flex-shrink-0"
              style={{minHeight:"360px", background: f.image ? "#0a0a0a" : f.bg}}>
              {f.image ? (
                <>
                  {/* Fotoğraf — cover */}
                  <img src={f.image} alt={f.sub}
                    className="absolute inset-0 w-full h-full object-cover select-none"
                    style={{opacity:0.88}}/>
                  {/* Alt gradient overlay */}
                  <div className="absolute inset-0"
                    style={{background:"linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)"}}/>

                </>
              ) : (
                <>
                  {/* Büyük numara — dekoratif */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
                    style={{fontSize:"clamp(140px,20vw,240px)", fontWeight:800, color:`${f.accent}12`, lineHeight:1, letterSpacing:"-0.06em"}}>
                    {f.num}
                  </div>
                  <div className="relative h-full flex items-center justify-center py-16 px-10">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{background:`${f.accent}18`, border:`1.5px solid ${f.accent}30`}}>
                        <f.icon className="w-8 h-8" style={{color: f.accent}}/>
                      </div>
                      <div className="font-black leading-none" style={{fontSize:"5rem", color: f.accent, letterSpacing:"-0.04em", opacity:0.85}}>
                        {f.num}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Metin paneli */}
            <div className="md:w-7/12 flex items-center px-8 md:px-16 py-14 bg-white">
              <div className="max-w-lg">
                <div className="text-[11px] font-bold tracking-[0.35em] uppercase mb-5"
                  style={{color: f.accent}}>{f.sub}</div>
                <h3 className="font-display font-bold text-slate-900 mb-4 leading-tight"
                  style={{fontSize:"clamp(1.8rem,3.2vw,2.4rem)", letterSpacing:"-0.01em"}}>{f.title}</h3>
                <p className="text-slate-500 leading-relaxed mb-8" style={{fontSize:"0.95rem"}}>{f.desc}</p>
                <ul className="space-y-3">
                  {f.points.map((p, j) => (
                    <li key={j} className="flex items-center gap-3 text-slate-700 font-semibold text-sm">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{background:`${f.accent}18`}}>
                        <div className="w-2 h-2 rounded-full" style={{background: f.accent}}/>
                      </div>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const TrainingCard = ({ training, onClick }) => {
  const hasCoords = training.location_lat && training.location_lng;
  const distanceKm = training.distance != null
    ? Number(training.distance)
    : (userLocation && hasCoords
        ? haversineKm(userLocation.lat, userLocation.lng, Number(training.location_lat), Number(training.location_lng))
        : null);

  const dateObj = new Date(training.training_date);
  const day = String(dateObj.getUTCDate()).padStart(2, "0");
  const localeMap = { tr: "tr-TR", en: "en-US", de: "de-DE" };
  const month = dateObj.toLocaleDateString(localeMap[lang] || "en-US", { month: "short", timeZone: "UTC" }).toLocaleUpperCase("en-US");

  // WCAG AA uyumlu renkler (beyaz üzerinde ≥ 4.5:1 kontrast)
  const difficultyColor = { "Kolay": "#047857", "Orta": "#b45309", "Zor": "#b91c1c" };
  const accentColor = difficultyColor[training.difficulty] || "#047857";

  return (
    <div
      onClick={() => onClick(training.id)}
      className="group flex items-stretch gap-0 bg-white border-b border-dashed border-slate-100 cursor-pointer transition-all duration-200 py-6 px-2 hover:bg-slate-50/80 hover:border-slate-200 active:scale-[0.99]"
    >
      {/* Sol: Takvim tarihi */}
      <div className="flex flex-col items-center justify-center w-20 flex-shrink-0 pr-5">
        <span className="font-display font-bold leading-none" style={{fontSize:"3rem", color: accentColor, fontVariantNumeric:"tabular-nums"}}>{day}</span>
        <span className="font-display text-[11px] font-bold tracking-[0.18em] mt-1.5 text-slate-400 uppercase">{month}</span>
      </div>

      {/* Dikey ayraç */}
      <div className="w-px bg-slate-200 self-stretch flex-shrink-0"/>

      {/* Sağ: İçerik */}
      <div className="flex-1 pl-5 flex flex-col justify-center gap-1 min-w-0">
        <h3 className="font-display font-bold text-slate-900 group-hover:text-brand-700 transition-colors line-clamp-1 leading-snug"
          style={{fontSize:"1.05rem", letterSpacing:"-0.01em"}}>
          {training.title}
        </h3>
        <p className="text-sm text-slate-400 italic">
          {training.training_time && <span>{training.training_time}</span>}
          {training.training_time && (training.team_name || training.location_name) && <span className="mx-2">·</span>}
          {training.team_name && <span className="not-italic font-medium text-brand-700">{training.team_name}</span>}
          {training.team_name && training.location_name && <span className="mx-2">-</span>}
          {training.location_name && <span>{training.location_name}</span>}
        </p>
        {distanceKm != null && (
          <p className="text-xs text-brand-600 font-medium flex items-center gap-1">
            <Navigation2 className="w-3 h-3"/>
            {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m ${t("trainings.away")}` : `${distanceKm.toFixed(1)} km ${t("trainings.away")}`}
          </p>
        )}
      </div>

      {/* Sağ ok */}
      <div className="flex items-center pl-4 flex-shrink-0">
        <svg className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
      </div>
    </div>
  );
};

  const TeamCard = ({ team, onClick }) => (
    <div
      onClick={() => onClick(team.id)}
      className="group bg-white rounded-2xl border border-slate-100 hover:border-brand-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Dekoratif üst şerit */}
      <div className="h-1.5 w-full" style={{background:"linear-gradient(90deg,#00b7ba,#009295,#06B6D4)"}}/>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
              style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
              {(team.avatar?.startsWith("/uploads/") || team.avatar?.startsWith("http"))
                ? <img src={team.avatar.startsWith("http") ? team.avatar : `${BASE_URL}${team.avatar}`} alt="" className="w-full h-full object-cover" />
                : (team.name?.[0]?.toLocaleUpperCase("en-US") || "T")}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 truncate group-hover:text-brand-700 transition-colors">{team.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 bg-brand-50 text-brand-600 rounded-md text-xs font-semibold">{team.sport}</span>
                {team.location && <span className="text-slate-400 text-xs truncate flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0"/>{team.location}</span>}
              </div>
            </div>
          </div>
          {team.is_private && (
            <span className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium">
              <Lock className="w-3 h-3"/> {t("common.private")}
            </span>
          )}
        </div>

        <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-4">
          {team.description || (team.is_private ? t("teams.privateDesc") : t("common.noDescription"))}
        </p>

        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <Users className="w-4 h-4"/>
            <span className="font-semibold text-slate-700">{team.member_count || 0}</span>
            <span>{t("teams.members")}</span>
          </div>
          {team.my_role && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-lg" style={{
              background: team.my_role === 'owner' ? '#FEF3C7' : team.my_role === 'coach' ? '#EDE9FE' : team.my_role === 'captain' ? '#DCFCE7' : '#F0FDF4',
              color: team.my_role === 'owner' ? '#92400E' : team.my_role === 'coach' ? '#5B21B6' : team.my_role === 'captain' ? '#006d6f' : '#006d6f',
            }}>
              {team.my_role === 'owner' ? <><Crown className="w-3 h-3 inline mr-1"/>{t("teamDetail.roles.owner")}</> : team.my_role === 'coach' ? <><Target className="w-3 h-3 inline mr-1"/>{t("teamDetail.roles.coach")}</> : team.my_role === 'captain' ? <><Navigation2 className="w-3 h-3 inline mr-1"/>{t("teamDetail.roles.captain")}</> : <><User className="w-3 h-3 inline mr-1"/>{t("teamDetail.roles.member")}</>}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const BADGE_ICON_MAP = {
    "Başlangıç":      Award,
    "Düzenli":        TrendingUp,
    "Azimli":         Activity,
    "Sporcu":         Dumbbell,
    "Efsane":         Trophy,
    "Takım Oyuncusu": Users,
    "Lider":          Crown,
  };

  const BadgeCard = ({ badge, earned }) => {
    const IconComp = BADGE_ICON_MAP[badge.name] || Award;
    return (
      <div className={`relative rounded-2xl p-5 border transition-all duration-300 overflow-hidden group ${
        earned
          ? "border-amber-200 hover:border-amber-300 hover:shadow-xl hover:-translate-y-1 cursor-default"
          : "border-slate-100"
      }`}
      style={earned
        ? {background:"linear-gradient(145deg,#fffdf5 0%,#fffbeb 60%,#fef3c7 100%)"}
        : {background:"#f8fafc"}}>

        {/* Kazanıldı işareti */}
        {earned && (
          <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
            style={{background:"linear-gradient(135deg,#F59E0B,#FBBF24)"}}>
            <CheckCircle className="w-3 h-3 text-white fill-white"/>
          </div>
        )}

        {/* Dekoratif arka plan halkası */}
        {earned && (
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
            style={{background:"radial-gradient(circle,rgba(251,191,36,0.12) 0%,transparent 70%)"}}/>
        )}

        <div className="text-center relative">
          {/* İkon kutusu */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-transform duration-300 ${earned ? "group-hover:scale-110" : ""}`}
            style={earned
              ? {background:"linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.1))", border:"1.5px solid rgba(245,158,11,0.3)", boxShadow:"0 4px 16px rgba(245,158,11,0.15)"}
              : {background:"#f1f5f9", border:"1.5px solid #e2e8f0"}}>
            <IconComp className={`w-7 h-7 ${earned ? "text-amber-500" : "text-slate-300"}`}/>
          </div>

          <h3 className={`font-semibold text-sm mb-1 ${earned ? "text-slate-800" : "text-slate-400"}`}>{badge.name}</h3>
          <p className={`text-xs leading-relaxed ${earned ? "text-slate-500" : "text-slate-400"}`}>{badge.description}</p>

          {earned && badge.earned_at && (
            <div className="mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{background:"rgba(245,158,11,0.12)", color:"#b45309"}}>
              <CheckCircle className="w-2.5 h-2.5"/>
              {fmtDateShort(badge.earned_at)}
            </div>
          )}

          {!earned && (
            <div className="mt-2.5 text-[10px] font-medium text-slate-300 uppercase tracking-wider">
              {t("badges.notEarned")}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── TAKİM ETKİNLİKLERİ — Leisure Club Activities stili ──

  // =====================================================
  // PAGES
  // =====================================================

  const HomePage = () => (
    <>
      <HeroSection
        banners={banners}
        bannersLoaded={bannersLoaded}
        user={user}
        setCurrentPage={setCurrentPage}
        setAuthMode={setAuthMode}
        setIsAuthModalOpen={setIsAuthModalOpen}
        platformStats={platformStats}
        stats={stats}
        fmtNum={fmtNum}
        t={t}
        lang={lang}
      />
      <FeaturesSection />

      {/* ── GPS SEARCH + UPCOMING TRAININGS — yan yana ── */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col lg:flex-row gap-12">

            {/* Sol: GPS arama */}
            <div className="lg:w-72 flex-shrink-0">
              <span className="text-xs font-semibold tracking-[0.3em] text-brand-800 uppercase block mb-3">{t("home.gpsLabel")}</span>
              <h2 className="font-display font-bold text-slate-900 leading-snug mb-3"
                style={{fontSize:"clamp(1.6rem,3vw,2rem)", letterSpacing:"-0.01em"}}>
                {t("home.findNearby")}
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                {t("home.gpsDesc")}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[5, 10, 25, 50].map((km) => (
                  <button
                    key={km}
                    onClick={() => setNearbyDistance(km)}
                    className="px-4 py-2 rounded-xl text-xs font-medium transition-all duration-300 hover:scale-105 hover:shadow-md"
                    style={nearbyDistance === km
                      ? {background:"linear-gradient(135deg,#00b7ba,#009295)", color:"#fff", boxShadow:"0 4px 20px rgba(0,183,186,0.35)"}
                      : {background:"#e5f9f9", color:"#006d6f", border:"1px solid #cbf3f3", boxShadow:"0 2px 8px rgba(0,183,186,0.0)"}}
                    onMouseEnter={e => { if(nearbyDistance !== km) e.currentTarget.style.boxShadow="0 4px 16px rgba(0,183,186,0.25)"; }}
                    onMouseLeave={e => { if(nearbyDistance !== km) e.currentTarget.style.boxShadow="0 2px 8px rgba(0,183,186,0.0)"; }}
                  >
                    {km} km
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleNearbySearch()}
                disabled={locationLoading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white text-sm transition-all duration-300 hover:opacity-90 hover:scale-105 disabled:opacity-50 disabled:scale-100"
                style={{background:"linear-gradient(135deg,#00b7ba,#009295)", boxShadow:"0 6px 24px rgba(0,183,186,0.3)"}}
              >
                {locationLoading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> {t("home.gettingLocation")}</>
                  : <><MapPin className="w-4 h-4"/> {t("home.searchNearby")}</>}
              </button>
            </div>

            {/* Dikey ayraç */}
            <div className="hidden lg:block w-px bg-slate-100 self-stretch"/>

            {/* Sağ: Antrenman listesi */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold tracking-[0.3em] text-brand-800 uppercase block mb-3">{t("home.discover")}</span>
                  <h2 className="font-display font-bold text-slate-900 leading-snug"
                    style={{fontSize:"clamp(1.6rem,3vw,2rem)", letterSpacing:"-0.01em"}}>
                    {t("home.upcoming")}
                  </h2>
                </div>
                <button
                  onClick={() => setCurrentPage("trainings")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:shadow-md flex-shrink-0"
                  style={{background:"linear-gradient(135deg,#00b7ba,#009295)", color:"#fff"}}
                >
                  {t("home.viewAll")}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </button>
              </div>

              {trainings.length > 0 ? (
                <div className="divide-y-0">
                  {trainings.slice(0, 6).map((training) => (
                    <TrainingCard key={training.id} training={training} onClick={fetchTrainingDetails} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-6">
                  <Activity className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium mb-1">{t("home.noTrainingsFound")}</p>
                  <p className="text-slate-400 text-sm mb-4">{t("home.checkingServer")}</p>
                  <button onClick={fetchTrainings} className="px-5 py-2.5 rounded-xl text-sm font-medium text-brand-700 bg-brand-100 hover:bg-brand-200 transition-colors">
                    {t("common.retry")}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <NewsSection items={homeNews} t={t} setCurrentPage={setCurrentPage} />
      <GallerySection items={homeGallery} t={t} setCurrentPage={setCurrentPage} />

      {/* ── CTA — Full Bleed Cinematic ── */}
      {!user && (
        <div className="relative overflow-hidden py-28" style={{background:"linear-gradient(135deg,#052e16 0%,#004849 40%,#006d6f 70%,#009295 100%)"}}>
          {/* grid */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
            style={{backgroundImage:"linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)", backgroundSize:"60px 60px"}}/>
          {/* glow orbs */}
          <div className="absolute -left-32 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{background:"radial-gradient(circle,rgba(0,183,186,0.18) 0%,transparent 65%)"}}/>
          <div className="absolute -right-32 top-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{background:"radial-gradient(circle,rgba(134,239,172,0.12) 0%,transparent 65%)"}}/>

          <div className="relative max-w-4xl mx-auto px-4 text-center">
            {/* Big line decoration */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="h-px flex-1 max-w-20" style={{background:"linear-gradient(90deg,transparent,rgba(0,183,186,0.5))"}}/>
              <Dumbbell className="w-8 h-8" style={{color:"#00b7ba"}}/>
              <div className="h-px flex-1 max-w-20" style={{background:"linear-gradient(90deg,rgba(0,183,186,0.5),transparent)"}}/>
            </div>
            <span className="text-xs font-semibold tracking-[0.4em] text-brand-800 uppercase block mb-6">{t("home.ctaJoinCommunity")}</span>
            <h2 className="font-display font-bold text-white mb-6 leading-[0.92]"
              style={{fontSize:"clamp(4rem,10vw,7.5rem)", letterSpacing:"-0.02em"}}>
              {t("home.ctaLine1")}<br/>
              <span style={{background:"linear-gradient(90deg,#00b7ba,#981dd8)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>
                {t("home.ctaLine2")}
              </span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              {t("home.ctaSignupDesc")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); }}
                className="inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl font-semibold text-white text-base transition-all hover:scale-105 hover:shadow-2xl"
                style={{background:"linear-gradient(135deg,#00b7ba,#009295)", boxShadow:"0 12px 40px rgba(0,183,186,0.4)"}}
              >
                {t("home.startFree")}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
              </button>
              <button
                onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); }}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-sm transition-all hover:bg-white/10"
                style={{color:"rgba(186,230,253,0.8)", border:"1px solid rgba(255,255,255,0.12)"}}
              >
                {t("home.alreadyMember")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const ProfilePage = () => (
    <div className="min-h-screen bg-slate-50">
      {/* ── Profile hero header ── */}
      <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#e5f9f9 0%,#e5f9f9 60%,#cbf3f3 100%)"}}>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
        <div className="absolute inset-0 pointer-events-none"
          style={{background:"radial-gradient(ellipse at 30% center,rgba(0,183,186,0.18) 0%,transparent 65%)"}}/>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-8 py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            {/* Avatar + name */}
            <div className="flex items-center gap-5">
              <div className="relative cursor-pointer group" onClick={() => setShowProfileEdit(true)} title="Profili düzenle">
                <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
                  style={{background:"linear-gradient(135deg,#00b7ba,#009295)", boxShadow:"0 8px 24px rgba(0,183,186,0.4)"}}>
                  {(user?.avatar?.startsWith("/uploads/") || user?.avatar?.startsWith("http")) ? (
                    <img src={user.avatar.startsWith("http") ? user.avatar : `${BASE_URL}${user.avatar}`} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.[0]?.toLocaleUpperCase("en-US") || "?"
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Image className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="font-display font-bold text-brand-900" style={{fontSize:"2rem", letterSpacing:"-0.01em"}}>{user?.name}</h1>
                <p className="text-slate-400 text-sm mt-0.5">{user?.email}</p>
              </div>
            </div>
            <button onClick={() => setShowProfileEdit(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{background:"white", color:"#009295", border:"1px solid #cbf3f3"}}>
              <Settings className="w-4 h-4"/> {t("profile.editProfile")}
            </button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-px mt-10 rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
            {[
              {val: userStats?.total_trainings || 0, label: t("home.statTrainings"), accent:"#00b7ba"},
              {val: myTeams.length,                  label: t("home.statTeams"),     accent:"#981dd8"},
              {val: userBadges.length,               label: t("home.statBadges"),    accent:"#f59e0b"},
            ].map((s, i) => (
              <div key={i} className="px-6 py-5" style={{background:"rgba(0,183,186,0.15)"}}>
                <div className="text-2xl font-semibold text-brand-700">{s.val}</div>
                <div className="text-[10px] text-brand-600 mt-1 uppercase tracking-widest font-semibold">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">
        <div className="grid md:grid-cols-3 gap-6">

          {/* Left: Quick actions */}
          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-4">{t("home.quickAccess")}</div>
            {[
              {label: t("createTraining.pageTitle"), icon:Plus,   page:"create-training", grad:"linear-gradient(135deg,#00b7ba,#009295)", shadow:"rgba(0,183,186,0.3)"},
              {label: t("teams.create"),             icon:Users,  page:"create-team",     grad:"linear-gradient(135deg,#0EA5E9,#06B6D4)", shadow:"rgba(14,165,233,0.3)"},
              {label: t("badges.pageTitle"),         icon:Trophy, page:"badges",          grad:"linear-gradient(135deg,#F59E0B,#FBBF24)", shadow:"rgba(245,158,11,0.3)"},
            ].map((a) => (
              <button key={a.label} onClick={() => setCurrentPage(a.page)}
                className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 hover:shadow-lg"
                style={{background:a.grad, boxShadow:`0 6px 20px ${a.shadow}`}}>
                <a.icon className="w-4 h-4"/> {a.label}
              </button>
            ))}
          </div>

          {/* Right: Activity + Lists */}
          <div className="md:col-span-2 space-y-6">
            {/* Chart */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              {/* Başlık + özet */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase">{t("home.weeklyActivity")}</div>
                <div className="flex items-center gap-3">
                  {activityMeta.streak > 1 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-orange-500 bg-orange-50 px-2.5 py-1 rounded-full">
                      🔥 {activityMeta.streak} {t("activity.streakDays")}
                    </span>
                  )}
                </div>
              </div>
              <React.Suspense fallback={<div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>}>
                <ActivityChartLazy activityData={activityData} activityMeta={activityMeta} t={t}/>
              </React.Suspense>
            </div>

            {/* Joined Trainings */}
            {joinedTrainings.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                  <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase">{t("home.joinedTrainingsList")}</div>
                  <span className="ml-auto text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">{joinedTrainings.length}</span>
                </div>
                <div className="space-y-2">
                  {joinedTrainings.slice(0, 5).map((t) => (
                    <button key={t.id} onClick={() => fetchTrainingDetails(t.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-brand-50/50 transition-colors text-left border border-transparent hover:border-brand-100">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 text-sm truncate">{t.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <MapPin className="w-3 h-3 flex-shrink-0"/> <span className="truncate">{t.location_name}</span>
                          <span>·</span>
                          <Calendar className="w-3 h-3 flex-shrink-0"/> {fmtDateMed(t.training_date)}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90 flex-shrink-0 ml-2"/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Team Trainings */}
            {myTeamTrainings.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase">{t("home.teamTrainingsList")}</div>
                  <span className="ml-auto text-xs font-semibold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{myTeamTrainings.length}</span>
                </div>
                <div className="space-y-2">
                  {myTeamTrainings.slice(0, 5).map((t) => (
                    <button key={t.id} onClick={() => fetchTrainingDetails(t.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-blue-50/50 transition-colors text-left border border-transparent hover:border-blue-100">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 text-sm truncate">{t.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <span className="truncate font-medium text-blue-400">{t.team_name}</span>
                          <span>·</span>
                          <Calendar className="w-3 h-3 flex-shrink-0"/> {fmtDateMed(t.training_date)}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90 flex-shrink-0 ml-2"/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* My Teams */}
            {myTeams.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-4">{t("profile.myTeams")}</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {myTeams.map((team) => (
                    <button key={team.id} onClick={() => fetchTeamDetails(team.id)}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all text-left">
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                        style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
                        {(team.avatar?.startsWith("/uploads/") || team.avatar?.startsWith("http"))
                          ? <img src={team.avatar.startsWith("http") ? team.avatar : `${BASE_URL}${team.avatar}`} alt="" className="w-full h-full object-cover" />
                          : (team.name?.[0]?.toLocaleUpperCase("en-US") || "T")}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 text-sm truncate">{team.name}</div>
                        <div className="text-xs text-slate-400">{team.sport} · {team.member_count} {t("teams.members")}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const TrainingsPage = () => {
    const sports = ["Basketbol", "Bisiklet", "Crossfit", "Futbol", "Kano", "Koşu", "Kürek", "Padel", "Pilates", "Tenis", "Trekking", "Triatlon", "Voleybol", "Yoga", "Yüzme", "Diğer"];
    const difficulties = [
      { val: "Kolay", label: t("trainings.levelEasy") },
      { val: "Orta",  label: t("trainings.levelMid")  },
      { val: "Zor",   label: t("trainings.levelHard") },
    ];
    const [viewMode, setViewMode] = React.useState("list"); // "list" | "map"

    // Manuel konum arama (GPS çalışmadığında)
    const ManualLocationSearch = () => {
      const [q, setQ] = useState("");
      const [results, setResults] = useState([]);
      const [searching, setSearching] = useState(false);

      const search = async () => {
        if (!q.trim()) return;
        setSearching(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
            { headers: { "Accept-Language": lang } }
          );
          const data = await res.json();
          setResults(data);
        } catch {
          showToast(t("toast.searchFail"), "error");
        } finally {
          setSearching(false);
        }
      };

      return (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-start gap-3 p-4 pb-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-orange-800 text-sm">
                {gpsErrorCode === 1 ? t("trainings.locationDenied") :
                 gpsErrorCode === 3 ? t("trainings.locationTimeout") :
                 t("trainings.locationError")}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                {gpsErrorCode === 1 ? t("trainings.gpsHint1") :
                 gpsErrorCode === 3 ? t("trainings.gpsHint3") :
                 t("trainings.gpsHintOther")}
              </p>
            </div>
            <button onClick={() => setShowManualLocation(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contextual hint */}
          <div className="mx-4 mb-3 p-3 bg-white border border-orange-100 rounded-xl text-xs text-gray-600 leading-relaxed">
            {gpsErrorCode === 1 ? (
              <><Lock className="w-3.5 h-3.5 inline mr-1 -mt-0.5"/><span className="font-medium">{t("trainings.gpsHowToEnable")}</span><br/>{t("trainings.gpsEnableHint")}</>
            ) : gpsErrorCode === 3 ? (
              <>⏱ <span className="font-medium">{t("trainings.gpsTimeout")}.</span> {t("trainings.gpsTimeoutHint")}</>
            ) : (
              <>📡 <span className="font-medium">{t("trainings.gpsNotWorking")}.</span> {t("trainings.gpsNotWorkingHint")}</>
            )}
          </div>

          {/* Retry button */}
          <div className="px-4 mb-4">
            <button
              onClick={() => handleNearbySearch()}
              disabled={locationLoading}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {locationLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t("trainings.gettingLocation")}</>
              ) : (
                <><MapPin className="w-4 h-4" /> {t("trainings.retryLocation")}</>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-4 mb-3">
            <div className="flex-1 h-px bg-orange-200" />
            <span className="text-xs text-orange-400 font-medium">{t("trainings.manualLocation")}</span>
            <div className="flex-1 h-px bg-orange-200" />
          </div>

          {/* Manual search */}
          <div className="px-4 pb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder={t("trainings.searchPlaceholder")}
                className="flex-1 px-4 py-2.5 border border-orange-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
              <button
                onClick={search}
                disabled={searching}
                className="px-4 py-2.5 bg-orange-100 text-orange-600 border border-orange-300 rounded-xl hover:bg-orange-200 disabled:opacity-60 flex items-center gap-1"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {results.length > 0 && (
              <div className="mt-2 border border-orange-200 rounded-xl overflow-hidden bg-white shadow">
                {results.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => applyNearbyLocation(parseFloat(r.lat), parseFloat(r.lon), r.display_name.split(",").slice(0, 2).join(", "))}
                    className="w-full text-left px-4 py-3 hover:bg-orange-50 text-sm border-b last:border-0 flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span className="line-clamp-1">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    };

    const baseTrainings = nearbyMode ? nearbyTrainings : trainings;
    const displayedTrainings = baseTrainings.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || t.title?.toLowerCase().includes(q) || t.location_name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
      const matchesSport = !sportFilter || t.team_sport === sportFilter;
      const matchesDifficulty = !levelFilter || t.difficulty === levelFilter;
      return matchesSearch && matchesSport && matchesDifficulty;
    });

    const handleDistanceChange = (km) => {
      setNearbyDistance(km);
      if (userLocation) {
        fetchNearbyTrainings(userLocation.lat, userLocation.lng, km);
      } else {
        handleNearbySearch(km);
      }
    };

    const handleExitNearby = () => {
      setNearbyMode(false);
      setNearbyTrainings([]);
      setShowManualLocation(false);
      setGpsErrorCode(null);
    };

    return (
      <div className="min-h-screen bg-slate-50">
        {/* ── Dark athletic page header ── */}
        <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#e5f9f9 0%,#e5f9f9 60%,#cbf3f3 100%)"}}>
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
          <div className="absolute right-0 top-0 w-[500px] h-full pointer-events-none"
            style={{background:"radial-gradient(ellipse at right center,rgba(0,183,186,0.15) 0%,transparent 65%)"}}/>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-12">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold tracking-[0.35em] text-brand-800 uppercase block mb-2">{t("home.heroCta")}</span>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-brand-900 tracking-tighter leading-none">{t("trainings.pageTitle")}</h1>
                <p className="text-slate-400 mt-2 text-sm sm:text-base">{t("trainings.pageSubtitle")}</p>
              </div>
              {user && (
                <button
                  onClick={() => setCurrentPage("create-training")}
                  className="flex-shrink-0 flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90"
                  style={{background:"linear-gradient(135deg,#00b7ba,#009295)", boxShadow:"0 8px 24px rgba(0,183,186,0.35)"}}
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("trainings.create")}</span>
                  <span className="sm:hidden">{t("trainings.create")}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-white border-b border-slate-100 sticky top-[68px] z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 space-y-2">

            {/* Satır 1: Arama (full-width) + tek view toggle butonu */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("trainings.searchPlaceholder")}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors placeholder:text-slate-400"
                />
              </div>
              {/* View toggle — tek buton, aktif moda göre değişir */}
              <button
                onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
                className="flex-shrink-0 whitespace-nowrap px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 border shadow-sm"
                style={viewMode === "map"
                  ? {background:"linear-gradient(135deg,#00b7ba,#009295)", color:"#fff", borderColor:"transparent", boxShadow:"0 1px 8px rgba(0,183,186,0.35)"}
                  : {background:"linear-gradient(135deg,rgba(0,183,186,0.06),rgba(0,146,149,0.06))", color:"#00a0a3", borderColor:"rgba(0,183,186,0.3)"}}>
                {viewMode === "map" ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                    {t("trainings.listView")}
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5"/>
                    {t("trainings.mapView")}
                  </>
                )}
              </button>
            </div>

            {/* Satır 2: Branş + Seviye + temizle */}
            <div className="flex items-center gap-2">
              <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors appearance-none cursor-pointer">
                <option value="">{t("trainings.filterSport")}</option>
                {sports.map((s) => <option key={s} value={s}>{t(`sports.${s}`)}</option>)}
              </select>
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors appearance-none cursor-pointer">
                <option value="">{t("trainings.filterLevel")}</option>
                {difficulties.map((d) => <option key={d.val} value={d.val}>{d.label}</option>)}
              </select>
              {(searchQuery || sportFilter || levelFilter) && (
                <button onClick={() => { setSearchQuery(""); setSportFilter(""); setLevelFilter(""); }}
                  className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 shadow-sm transition-colors">
                  <X className="w-4 h-4"/>
                </button>
              )}
            </div>

            {/* Satır 3: GPS toggle */}
            <div className="flex items-center gap-2">
              <button onClick={handleExitNearby}
                className="px-4 py-2 text-xs font-semibold rounded-xl transition-all border shadow-sm"
                style={!nearbyMode
                  ? {background:"linear-gradient(135deg,#00b7ba,#009295)", color:"#fff", borderColor:"transparent", boxShadow:"0 1px 8px rgba(0,183,186,0.25)"}
                  : {background:"#fff", color:"#94a3b8", borderColor:"#e2e8f0"}}>
                {t("common.all")}
              </button>
              <button onClick={() => handleNearbySearch()} disabled={locationLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all border shadow-sm disabled:opacity-50"
                style={nearbyMode
                  ? {background:"linear-gradient(135deg,#00b7ba,#009295)", color:"#fff", borderColor:"transparent", boxShadow:"0 1px 8px rgba(0,183,186,0.25)"}
                  : {background:"#fff", color:"#64748b", borderColor:"#e2e8f0"}}>
                {locationLoading
                  ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin"/>
                  : <MapPin className="w-3 h-3"/>}
                {t("trainings.nearbySearch")}
              </button>
              {nearbyMode && userLocation && !nearbyLoading && (
                <span className="ml-auto text-xs font-semibold text-brand-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3"/> {nearbyTrainings.length} sonuç
                </span>
              )}
            </div>

            {/* Satır 4: Mesafe pilleri (GPS aktifken) */}
            {nearbyMode && (
              <div className="flex items-center gap-2 flex-wrap">
                {[5,10,25,50].map(km => (
                  <button key={km} onClick={() => handleDistanceChange(km)} disabled={nearbyLoading}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50"
                    style={nearbyDistance === km
                      ? {background:"linear-gradient(135deg,#00b7ba,#009295)", color:"#fff", borderColor:"transparent"}
                      : {borderColor:"#e2e8f0", color:"#64748b", background:"#fff"}}>
                    {km} km
                  </button>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
          {showManualLocation && <ManualLocationSearch />}

          {nearbyMode && userLocation && !showManualLocation && (
            <div className="mb-5 flex items-center gap-2 px-4 py-2.5 bg-brand-50 border border-brand-200 rounded-xl text-sm">
              <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0"/>
              <span className="text-brand-700 font-semibold flex-1">{manualLocationName || t("trainings.currentLocation")}</span>
              <button onClick={() => setShowManualLocation(true)} className="text-xs text-brand-600 hover:underline">{t("trainings.changeLocation")}</button>
            </div>
          )}

          {/* ── Harita görünümü ── */}
          {viewMode === "map" && (
            <ErrorBoundary key="map-boundary">
              <React.Suspense fallback={<div className="h-[600px] flex items-center justify-center bg-slate-50 rounded-2xl"><div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>}>
              <TrainingsMapViewLazy
                trainings={displayedTrainings}
                onSelectTraining={fetchTrainingDetails}
                t={t}
              />
              </React.Suspense>
            </ErrorBoundary>
          )}

          {/* ── Liste görünümü ── */}
          {viewMode === "list" && (nearbyLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-5">
              <div className="w-14 h-14 border-4 border-brand-100 rounded-full" style={{borderTopColor:"#00b7ba", animation:"spin 0.8s linear infinite"}}/>
              <p className="text-slate-500 font-semibold">{nearbyDistance} km içinde aranıyor…</p>
            </div>
          ) : displayedTrainings.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedTrainings.map((training) => (
                <TrainingCard key={training.id} training={training} onClick={fetchTrainingDetails} />
              ))}
            </div>
          ) : (
            <div className="text-center py-28">
              {nearbyMode ? (
                <>
                  <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                    style={{background:"rgba(0,183,186,0.08)", border:"1px solid rgba(0,183,186,0.15)"}}>
                    <MapPin className="w-9 h-9" style={{color:"rgba(0,183,186,0.4)"}}/>
                  </div>
                  <p className="text-slate-800 font-semibold text-xl mb-2">{nearbyDistance} km {t("trainings.noNearby")}</p>
                  <p className="text-slate-400 text-sm mb-7 max-w-sm mx-auto">{t("trainings.nearbyGpsNote")}</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {[10,25,50].filter(k => k > nearbyDistance).map(k => (
                      <button key={k} onClick={() => handleDistanceChange(k)}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700 transition">
                        {k} km {t("trainings.expandTo")}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                    style={{background:"rgba(0,183,186,0.08)", border:"1px solid rgba(0,183,186,0.15)"}}>
                    <Activity className="w-9 h-9" style={{color:"rgba(0,183,186,0.4)"}}/>
                  </div>
                  <p className="text-slate-800 font-semibold text-xl mb-2">{t("trainings.noTrainings")}</p>
                  <p className="text-slate-400 text-sm mb-7 max-w-xs mx-auto">{t("trainings.noTrainingsHint")}</p>
                  {user && (
                    <button onClick={() => setCurrentPage("create-training")}
                      className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 hover:shadow-lg"
                      style={{background:"linear-gradient(135deg,#00b7ba,#009295)", boxShadow:"0 8px 24px rgba(0,183,186,0.3)"}}>
                      <Plus className="w-4 h-4"/> {t("trainings.create")}
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const TeamsPage = () => {
    const sports = ["Basketbol", "Bisiklet", "Crossfit", "Futbol", "Kano", "Koşu", "Kürek", "Padel", "Pilates", "Tenis", "Trekking", "Triatlon", "Voleybol", "Yoga", "Yüzme", "Diğer"];
    const [teamSearch, setTeamSearch] = useState("");
    const [teamSport, setTeamSport] = useState("");

    const filteredTeams = teams.filter((t) => {
      const q = teamSearch.toLowerCase();
      const matchesSearch = !q || t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.location?.toLowerCase().includes(q);
      const matchesSport = !teamSport || t.sport === teamSport;
      return matchesSearch && matchesSport;
    });

    return (
      <div className="min-h-screen bg-slate-50">
        {/* ── Dark athletic page header ── */}
        <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#e5f9f9 0%,#e5f9f9 60%,#cbf3f3 100%)"}}>
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
          <div className="absolute left-0 top-0 w-[500px] h-full pointer-events-none"
            style={{background:"radial-gradient(ellipse at left center,rgba(56,189,248,0.12) 0%,transparent 65%)"}}/>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <span className="text-xs font-semibold tracking-[0.35em] text-brand-600 uppercase block mb-3">{t("teams.community")}</span>
                <h1 className="text-5xl md:text-6xl font-semibold text-brand-900 tracking-tighter leading-none">{t("teams.pageTitle")}</h1>
                <p className="text-slate-400 mt-3 text-base">{t("teams.pageSubtitle")}</p>
              </div>
              {user && (
                <button
                  onClick={() => setCurrentPage("create-team")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 flex-shrink-0"
                  style={{background:"linear-gradient(135deg,#0EA5E9,#06B6D4)", boxShadow:"0 8px 24px rgba(14,165,233,0.3)"}}
                >
                  <Plus className="w-4 h-4" /> {t("teams.create")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-white border-b border-slate-100 sticky top-[68px] z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3">
            <div className="flex flex-wrap gap-2.5 items-center">
              <div className="flex-1 min-w-48 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                <input type="text" value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder={t("teams.searchPlaceholder")}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"/>
              </div>
              <select value={teamSport} onChange={(e) => setTeamSport(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition">
                <option value="">{t("trainings.filterSport")}</option>
                {sports.map((s) => <option key={s} value={s}>{t(`sports.${s}`)}</option>)}
              </select>
              {(teamSearch || teamSport) && (
                <button onClick={() => { setTeamSearch(""); setTeamSport(""); }}
                  className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-medium text-slate-600 transition">
                  <X className="w-3.5 h-3.5"/> {t("trainings.clearFilters")}
                </button>
              )}
              <span className="ml-auto text-xs text-slate-400 font-semibold">{filteredTeams.length} {t("teams.members")}</span>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
          {filteredTeams.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTeams.map((team) => (
                <TeamCard key={team.id} team={team} onClick={fetchTeamDetails} />
              ))}
            </div>
          ) : (
            <div className="text-center py-28">
              <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                style={{background:"rgba(14,165,233,0.08)", border:"1px solid rgba(14,165,233,0.15)"}}>
                {teamSearch || teamSport
                  ? <Search className="w-9 h-9" style={{color:"rgba(14,165,233,0.4)"}}/>
                  : <Users className="w-9 h-9" style={{color:"rgba(14,165,233,0.4)"}}/>}
              </div>
              <p className="text-slate-800 font-semibold text-xl mb-2">
                {teamSearch || teamSport ? t("common.noResults") : t("teams.noTeams")}
              </p>
              <p className="text-slate-400 text-sm mb-7 max-w-xs mx-auto">
                {teamSearch || teamSport ? t("teams.noResultsHint") : t("teams.noTeamsHint")}
              </p>
              {teamSearch || teamSport ? (
                <button onClick={() => { setTeamSearch(""); setTeamSport(""); }}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition">
                  {t("trainings.clearFilters")}
                </button>
              ) : user && (
                <button onClick={() => setCurrentPage("create-team")}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 hover:shadow-lg"
                  style={{background:"linear-gradient(135deg,#0EA5E9,#06B6D4)", boxShadow:"0 8px 24px rgba(14,165,233,0.3)"}}>
                  <Plus className="w-4 h-4"/> {t("teams.create")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const BadgesPage = () => (
    <div className="min-h-screen bg-slate-50">
      {/* ── Light green header ── */}
      <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#e5f9f9 0%,#e5f9f9 60%,#cbf3f3 100%)"}}>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
        <div className="absolute inset-0 pointer-events-none"
          style={{background:"radial-gradient(ellipse at center,rgba(0,183,186,0.08) 0%,transparent 65%)"}}/>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-12">
          <button onClick={() => setCurrentPage("profile")}
            className="flex items-center gap-2 text-sm font-semibold mb-6 transition-colors"
            style={{color:"#009295"}}
            onMouseEnter={e=>e.currentTarget.style.color="#006d6f"}
            onMouseLeave={e=>e.currentTarget.style.color="#009295"}>
            <ArrowLeft className="w-4 h-4"/> {t("common.back")}
          </button>
          <div className="flex items-end justify-between gap-6">
            <div>
              <span className="text-xs font-semibold tracking-[0.35em] text-brand-600 uppercase block mb-3">{t("badges.pageTitle")}</span>
              <h1 className="text-5xl md:text-6xl font-semibold text-brand-900 tracking-tighter leading-none">{t("badges.pageTitle")}</h1>
              <p className="text-brand-700 mt-3 text-base">{t("badges.pageSubtitle")}</p>
            </div>
            {/* Progress summary */}
            <div className="hidden md:flex items-center gap-4 pb-1">
              <div className="text-right">
                <div className="text-4xl font-semibold text-brand-700">{userBadges.length}<span className="text-brand-500 text-2xl">/{badges.length}</span></div>
                <div className="text-xs text-brand-600 font-semibold uppercase tracking-wider mt-1">{t("badges.earned")}</div>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{background:"rgba(0,183,186,0.12)", border:"1px solid rgba(0,183,186,0.25)"}}>
                <Trophy className="w-7 h-7 text-brand-600"/>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-8 max-w-md">
            <div className="flex justify-between text-xs font-medium text-brand-700 mb-2">
              <span>{t("badges.progress")}</span>
              <span style={{color:"#009295"}}>{badges.length > 0 ? Math.round((userBadges.length/badges.length)*100) : 0}%</span>
            </div>
            <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{width:`${badges.length > 0 ? (userBadges.length/badges.length)*100 : 0}%`, background:"linear-gradient(90deg,#00b7ba,#009295)"}}/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Badges grid ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {badges.map((badge) => {
            const earned = userBadges.find((ub) => ub.id === badge.id);
            return <BadgeCard key={badge.id} badge={earned || badge} earned={!!earned}/>;
          })}
        </div>
      </div>
    </div>
  );
  const TrainingDetailPage = () => {
    if (!selectedTraining) return null;

    const isOwner = user && selectedTraining.team_owner_id === user.id;
    const isParticipant = user && selectedTraining.attendees?.some(a => a.id === user.id);
    const isFull = (selectedTraining.attendees?.length || 0) >= selectedTraining.capacity;
    const isMyTraining = false; // herkes join/leave yapabilir
    const [comment, setComment] = useState("");
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({
      title: selectedTraining.title,
      description: selectedTraining.description || "",
      training_date: selectedTraining.training_date?.slice(0, 10) || "",
      training_time: selectedTraining.training_time || "",
      location_name: selectedTraining.location_name || "",
      location_lat: selectedTraining.location_lat || null,
      location_lng: selectedTraining.location_lng || null,
      capacity: selectedTraining.capacity || 20,
      difficulty: selectedTraining.difficulty || "Orta",
    });

    const handleSubmitEdit = (e) => {
      e.preventDefault();
      handleUpdateTraining(selectedTraining.id, editData);
      setEditMode(false);
    };

    const handleSubmitComment = (e) => {
      e.preventDefault();
      if (comment.trim()) {
        handleAddComment(selectedTraining.id, comment);
        setComment("");
      }
    };

    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => setCurrentPage("trainings")}
          className="flex items-center text-brand-600 mb-6 hover:underline"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {t("common.back")}
        </button>

        <div className="bg-white rounded-2xl p-6 sm:p-8 border">
          <div className="mb-6">
            <h1 className="font-display font-bold mb-3" style={{fontSize:"clamp(1.8rem,4vw,2.4rem)", letterSpacing:"-0.01em"}}>{selectedTraining.title}</h1>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="px-3 py-1 bg-brand-100 text-brand-600 rounded-full text-sm font-medium">
                {selectedTraining.team_sport || "Genel"}
              </span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-600 rounded-full text-sm font-medium">
                {selectedTraining.difficulty}
              </span>
              <button
                onClick={() => {
                  const link = `${window.location.origin}/antrenmanlar?antrenman=${selectedTraining.id}`;
                  navigator.clipboard.writeText(link).then(() => showToast(t("toast.linkCopied"), "success"));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm font-medium transition-colors"
                title={t("common.copyLink")}
              >
                <Link className="w-3.5 h-3.5" /> {t("common.copyLink")}
              </button>
            </div>
          </div>

          {isOwner && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setEditMode(!editMode)}
                className="px-4 py-2 bg-blue-100 text-blue-600 rounded-xl font-semibold hover:bg-blue-200 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                {editMode ? t("common.cancel") : t("common.edit")}
              </button>
              <button
                onClick={() => handleDeleteTraining(selectedTraining.id)}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-semibold hover:bg-red-200 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t("common.delete")}
              </button>
            </div>
          )}

          {isOwner && editMode && (() => {
            const iCls = "w-full h-12 px-4 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors";
            const sCls = `${iCls} appearance-none cursor-pointer`;
            const lCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
            return (
              <form onSubmit={handleSubmitEdit} className="mb-8 space-y-5">
                <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                  <Edit className="w-4 h-4 text-brand-600"/> {t("trainingDetail.editTraining")}
                </h3>

                {/* Başlık */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <label className={lCls}>{t("createTraining.titleLabel")}</label>
                  <input type="text" value={editData.title}
                    onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
                    className={iCls} placeholder={t("createTraining.titlePlaceholder")} required />
                </div>

                {/* Açıklama */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <label className={lCls}>{t("createTraining.descLabel")} <span className="normal-case font-normal text-slate-400">({t("common.optional")})</span></label>
                  <textarea value={editData.description}
                    onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors resize-none"
                    rows="3" placeholder={t("createTraining.descPlaceholder")}/>
                </div>

                {/* Tarih + Saat */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lCls}>{t("createTraining.dateLabel")}</label>
                      <input type="date" value={editData.training_date}
                        onChange={(e) => setEditData((d) => ({ ...d, training_date: e.target.value }))}
                        className={iCls} required />
                    </div>
                    <div>
                      <label className={lCls}>{t("createTraining.timeLabel")}</label>
                      <div className="flex gap-2">
                        <select
                          value={editData.training_time ? editData.training_time.split(":")[0] : ""}
                          onChange={(e) => {
                            const min = editData.training_time ? editData.training_time.split(":")[1] : "00";
                            setEditData((d) => ({ ...d, training_time: e.target.value ? `${e.target.value}:${min}` : "" }));
                          }}
                          className={sCls} required>
                          <option value="">--</option>
                          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <select
                          value={editData.training_time ? editData.training_time.split(":")[1] : "00"}
                          onChange={(e) => {
                            const hr = editData.training_time ? editData.training_time.split(":")[0] : "";
                            if (hr) setEditData((d) => ({ ...d, training_time: `${hr}:${e.target.value}` }));
                          }}
                          className={sCls}>
                          {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Konum */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <label className={lCls}>{t("createTraining.locationLabel")}</label>
                  <LocationPicker
                    locationName={editData.location_name}
                    lat={editData.location_lat}
                    lng={editData.location_lng}
                    onLocationName={(v) => setEditData((d) => ({ ...d, location_name: v }))}
                    onLat={(v) => setEditData((d) => ({ ...d, location_lat: v }))}
                    onLng={(v) => setEditData((d) => ({ ...d, location_lng: v }))}
                  />
                </div>

                {/* Kapasite + Seviye */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lCls}>{t("createTraining.capacityLabel")}</label>
                      <input type="number" value={editData.capacity} min="1"
                        onChange={(e) => setEditData((d) => ({ ...d, capacity: parseInt(e.target.value) }))}
                        className={iCls} />
                    </div>
                    <div>
                      <label className={lCls}>{t("createTraining.levelLabel")}</label>
                      <select value={editData.difficulty}
                        onChange={(e) => setEditData((d) => ({ ...d, difficulty: e.target.value }))}
                        className={sCls}>
                        <option value="Kolay">🟢 {t("trainings.levelEasy")}</option>
                        <option value="Orta">🟡 {t("trainings.levelMid")}</option>
                        <option value="Zor">🔴 {t("trainings.levelHard")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button type="submit"
                  className="w-full h-12 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
                  style={{background:"linear-gradient(135deg,#00b7ba,#009295)", boxShadow:"0 4px 14px rgba(0,183,186,0.3)"}}>
                  {t("common.save")}
                </button>
              </form>
            );
          })()}

          <p className="text-gray-600 mb-6">{selectedTraining.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <MapPin className="w-5 h-5 mr-2" />
                <span className="font-semibold">{t("common.location")}</span>
              </div>
              <p>{selectedTraining.location_name}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Calendar className="w-5 h-5 mr-2" />
                <span className="font-semibold">{t("common.date")}</span>
              </div>
              <p>{fmtDateFull(selectedTraining.training_date)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Clock className="w-5 h-5 mr-2" />
                <span className="font-semibold">{t("common.time")}</span>
              </div>
              <p>{selectedTraining.training_time}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Users className="w-5 h-5 mr-2" />
                <span className="font-semibold">{t("common.capacity")}</span>
              </div>
              <p>
                {selectedTraining.attendees?.length || 0}/{selectedTraining.capacity}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-medium mb-4">
              {t("trainingDetail.joinedList")} ({selectedTraining.attendees?.length || 0})
            </h3>
            {selectedTraining.attendees && selectedTraining.attendees.length > 0 ? (
              <div className="space-y-2">
                {selectedTraining.attendees.map((attendee) => (
                  <div key={attendee.id} className="flex items-center p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full overflow-hidden flex items-center justify-center text-white font-medium mr-3">
                      {renderAvatar(attendee.avatar, attendee.name)}
                    </div>
                    <div>
                      <div className="font-semibold">{attendee.name}</div>
                      <div className="text-sm text-gray-600">
                        {fmtDateShort(attendee.joined_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">{t("trainingDetail.noParticipants")}</p>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-medium mb-4 flex items-center">
              <MessageCircle className="w-5 h-5 mr-2" />
              {t("trainingDetail.comments")} ({selectedTraining.comments?.length || 0})
            </h3>

            {user && (
              <form onSubmit={handleSubmitComment} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("trainingDetail.addComment")}
                    className="flex-1 px-4 py-2 border rounded-xl"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            )}

            {selectedTraining.comments && selectedTraining.comments.length > 0 ? (
              <div className="space-y-3">
                {selectedTraining.comments.map((c) => (
                  <div key={c.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full overflow-hidden flex items-center justify-center text-white font-medium mr-2">
                        {renderAvatar(c.user_avatar, c.user_name)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{c.user_name}</div>
                        <div className="text-xs text-gray-500">
                          {fmtDateShort(c.created_at)}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700">{c.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">{t("trainingDetail.noComments")}</p>
            )}
          </div>

          {!user ? (
            <div className="rounded-2xl overflow-hidden border border-brand-100 shadow-sm">
              {/* Üst gradient şerit */}
              <div className="h-1.5" style={{background:"linear-gradient(90deg,#00b7ba,#981dd8,#00b7ba)"}}/>
              <div className="p-6 bg-gradient-to-br from-brand-50 to-brand-50">
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md"
                    style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">{t("trainingDetail.loginPromptTitle")}</h3>
                  <p className="text-sm text-slate-500">{t("trainingDetail.loginPromptDesc")}</p>
                </div>

                {/* Özellikler */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { icon: Activity,    label: t("trainingDetail.loginFeat1") },
                    { icon: ShieldCheck, label: t("trainingDetail.loginFeat2") },
                    { icon: Users,       label: t("trainingDetail.loginFeat3") },
                  ].map(f => (
                    <div key={f.label} className="bg-white rounded-xl p-3 text-center border border-brand-100 shadow-sm">
                      <div className="mb-1.5 flex justify-center"><f.icon className="w-5 h-5 text-brand-500"/></div>
                      <div className="text-xs font-medium text-slate-600 leading-tight">{f.label}</div>
                    </div>
                  ))}
                </div>

                {/* Butonlar */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); }}
                    className="flex-1 py-3 font-semibold text-white text-sm rounded-xl transition hover:opacity-90 hover:shadow-lg"
                    style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}
                  >
                    {t("home.ctaBtn")}
                  </button>
                  <button
                    onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); }}
                    className="flex-1 py-3 font-semibold text-brand-700 text-sm rounded-xl border border-brand-300 bg-white hover:bg-brand-50 transition"
                  >
                    {t("nav.login")}
                  </button>
                </div>
              </div>
            </div>
          ) : isParticipant ? (
            <div className="flex gap-3">
              <div className="flex-1 py-4 rounded-xl font-semibold text-center text-brand-700 bg-brand-50 border border-brand-200">
                ✓ {t("trainings.joined")}
              </div>
              <button
                onClick={() => handleLeaveTraining(selectedTraining.id)}
                disabled={joiningTrainingId === selectedTraining.id}
                className="px-6 py-4 rounded-xl font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition disabled:opacity-60"
              >
                {joiningTrainingId === selectedTraining.id
                  ? <span className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin inline-block"/>
                  : t("trainings.leave")}
              </button>
            </div>
          ) : isFull ? (
            <div className="w-full py-4 rounded-xl font-semibold text-center text-slate-500 bg-slate-100 border border-slate-200">
              {t("trainings.full")}
            </div>
          ) : (
            <button
              onClick={() => handleJoinTraining(selectedTraining.id)}
              disabled={joiningTrainingId === selectedTraining.id}
              className="w-full py-4 font-semibold text-white rounded-xl transition hover:opacity-90 hover:shadow-lg disabled:opacity-60"
              style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}
            >
              {joiningTrainingId === selectedTraining.id
                ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>{t("trainings.joining")}</span>
                : t("trainingDetail.joinBtn")}
            </button>
          )}
        </div>
      </div>
    );
  };

  const TeamDetailPage = () => {
    if (!selectedTeam) return null;

    const isOwner = user && selectedTeam.owner_id === user.id;
    const myMembership = selectedTeam.members?.find((m) => m.id === user?.id);
    const myRole = myMembership?.role || null;
    const isMember = !!myMembership;
    const isCoach = myRole === "coach";
    const canManage = isOwner || isCoach || myRole === "captain";
    const canSeeMembers = !selectedTeam.is_private || isMember;

    const [message, setMessage] = useState("");
    const [activeTab, setActiveTabState] = useState(teamActiveTabRef.current);
    const setActiveTab = (tab) => { teamActiveTabRef.current = tab; setActiveTabState(tab); setTeamActiveTab(tab); };
    const [editForm, setEditForm] = useState({
      name: selectedTeam.name,
      sport: selectedTeam.sport,
      description: selectedTeam.description || "",
      location: selectedTeam.location || "",
      avatar: selectedTeam.avatar || "",
      is_private: selectedTeam.is_private || false,
    });

    const sportTypes = ["Basketbol","Bisiklet","Crossfit","Futbol","Kano","Koşu","Kürek","Padel","Pilates","Tenis","Trekking","Triatlon","Voleybol","Yoga","Yüzme","Diğer"];

    const roleBadge = (role) => {
      if (role === "owner")   return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1"><Crown className="w-3 h-3" /> {t("teamDetail.roles.owner")}</span>;
      if (role === "coach")   return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1"><Target className="w-3 h-3" /> {t("teamDetail.roles.coach")}</span>;
      if (role === "captain") return <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full text-xs font-semibold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {t("teamDetail.roles.captain")}</span>;
      return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold flex items-center gap-1"><User className="w-3 h-3" /> {t("teamDetail.roles.member")}</span>;
    };

    const handleSubmitPost = (e) => {
      e.preventDefault();
      if (message.trim()) { handleAddTeamPost(selectedTeam.id, message); setMessage(""); }
    };

    const handleEditSubmit = (e) => {
      e.preventDefault();
      handleUpdateTeam(selectedTeam.id, editForm);
    };

    const tabs = [
      { id: "wall",    label: t("teamDetail.wall"),       icon: <MessageSquare className="w-4 h-4" />, show: isMember },
      { id: "members", label: t("teamDetail.membersTab"), icon: <Users className="w-4 h-4" />,        show: canSeeMembers },
      { id: "settings",label: t("common.settings"),      icon: <Settings className="w-4 h-4" />,     show: isOwner },
    ].filter((t) => t.show);

    const iCls = "w-full h-11 px-4 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors";
    const lCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <button onClick={() => setCurrentPage("teams")} className="flex items-center gap-1.5 text-brand-600 font-medium mb-6 hover:text-brand-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("teams.pageTitle")}
        </button>

        {/* HEADER KARTI */}
        <div className="relative rounded-3xl overflow-hidden mb-4 shadow-sm">
          <div className="bg-gradient-to-br from-brand-600 via-brand-600 to-teal-600 px-8 pt-8 pb-6 text-white">
            {/* üst satır */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold shadow-inner">
                    {(selectedTeam.avatar?.startsWith("/uploads/") || selectedTeam.avatar?.startsWith("http"))
                      ? <img src={selectedTeam.avatar.startsWith("http") ? selectedTeam.avatar : `${BASE_URL}${selectedTeam.avatar}`} alt="" className="w-full h-full object-cover" />
                      : (selectedTeam.name?.[0]?.toLocaleUpperCase("en-US") || "T")}
                  </div>
                  {isOwner && (
                    <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-brand-50 transition-colors" title="Fotoğraf yükle">
                      <Image className="w-3 h-3 text-brand-600" />
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append("avatar", file);
                        const token = localStorage.getItem("token");
                        const res = await fetch(`${API_URL}/teams/${selectedTeam.id}/avatar`, { method:"POST", headers:{ Authorization:`Bearer ${token}` }, body:fd });
                        if (res.ok) {
                          const data = await res.json();
                          setSelectedTeam(t => ({ ...t, avatar: data.avatar }));
                          setTeams(ts => ts.map(t => t.id === selectedTeam.id ? { ...t, avatar: data.avatar } : t));
                          showToast(t("toast.teamPhotoUpdated"), "success");
                        } else showToast(t("toast.uploadFail"), "error");
                      }} />
                    </label>
                  )}
                </div>
                <div>
                  <h1 className="font-display font-bold" style={{fontSize:"1.8rem", letterSpacing:"-0.01em"}}>{selectedTeam.name}</h1>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium">{selectedTeam.sport}</span>
                    {selectedTeam.is_private
                      ? <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium flex items-center gap-1"><Lock className="w-3 h-3" /> {t("common.private")}</span>
                      : <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium flex items-center gap-1"><Globe className="w-3 h-3" /> {t("common.public")}</span>}
                    {myRole && (() => {
                      const roleIcons = { owner: Crown, coach: Target, captain: Navigation2, member: User };
                      const roleLabels = { owner: t("teamDetail.roles.owner"), coach: t("teamDetail.roles.coach"), captain: t("teamDetail.roles.captain"), member: t("teamDetail.roles.member") };
                      const RoleIcon = roleIcons[myRole] || User;
                      return <span className="px-2.5 py-0.5 bg-white/30 rounded-full text-xs font-semibold flex items-center gap-1"><RoleIcon className="w-3 h-3"/>{roleLabels[myRole] || myRole}</span>;
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {canManage && (
                  <button onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors backdrop-blur">
                    <UserPlus className="w-4 h-4" /> {t("teamDetail.invite")}
                  </button>
                )}
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/takimlar?takim=${selectedTeam.id}`;
                    navigator.clipboard.writeText(link).then(() => showToast(t("toast.linkCopied"), "success"));
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors backdrop-blur"
                  title={t("common.copyLink")}
                >
                  <Link className="w-4 h-4" /> {t("common.copyLink")}
                </button>
              </div>
            </div>

            {/* istatistikler */}
            <div className="flex items-center gap-5 mt-5 text-sm">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 opacity-80" />
                <span className="font-semibold">{selectedTeam.members?.length || 0}</span>
                <span className="opacity-75">{t("teams.members")}</span>
              </div>
              {selectedTeam.location && (
                <div className="flex items-center gap-1.5 opacity-85">
                  <MapPin className="w-4 h-4" />
                  <span>{selectedTeam.location}</span>
                </div>
              )}
            </div>

            {selectedTeam.description && (
              <p className="mt-3 text-sm text-white/85 leading-relaxed">{selectedTeam.description}</p>
            )}
          </div>

          {/* dekoratif daire */}
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute -bottom-12 -left-6 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
        </div>

        {/* SEKMELER */}
        {tabs.length > 0 && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-4">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* İÇERİK */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">

          {/* DUVAR */}
          {activeTab === "wall" && isMember && (
            <div>
              <form onSubmit={handleSubmitPost} className="mb-6">
                <div className="flex gap-2">
                  <input type="text" value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("teamDetail.postPlaceholder")}
                    className={`flex-1 ${iCls}`} />
                  <button type="submit"
                    className="px-5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {selectedTeam.posts?.length > 0 ? (
                <div className="space-y-3">
                  {selectedTeam.posts.map((post) => (
                    <div key={post.id} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {renderAvatar(post.user_avatar, post.user_name)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-800">{post.user_name}</div>
                          <div className="text-xs text-slate-400">{fmtDateShort(post.created_at)}</div>
                        </div>
                      </div>
                      <p className="text-slate-700 text-sm leading-relaxed">{post.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-14">
                  <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-brand-400" />
                  </div>
                  <p className="font-semibold text-slate-600">{t("teamDetail.noWallPosts")}</p>
                </div>
              )}
            </div>
          )}

          {/* ÜYELER */}
          {activeTab === "members" && canSeeMembers && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-800 text-lg">{t("teamDetail.membersTab")} <span className="text-slate-400 font-normal text-base">({selectedTeam.members?.length || 0})</span></h3>
                {canManage && (
                  <button onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-50 text-brand-700 rounded-xl text-sm font-semibold hover:bg-brand-100 transition-colors">
                    <UserPlus className="w-4 h-4" /> {t("teamDetail.invite")}
                  </button>
                )}
              </div>

              {/* Bekleyen davetler */}
              {canManage && pendingInvitations.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {t("teamDetail.pendingInvites")} ({pendingInvitations.length})
                  </p>
                  <div className="space-y-2">
                    {pendingInvitations.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center">
                            <Mail className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-700 text-sm">{inv.invitee_email}</div>
                            <div className="text-xs text-slate-400">{inv.inviter_name} · {fmtDateShort(inv.created_at)}</div>
                          </div>
                        </div>
                        <button onClick={() => handleCancelInvitation(selectedTeam.id, inv.id)}
                          className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 font-semibold transition-colors">
                          İptal
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 my-5" />
                </div>
              )}

              <div className="space-y-2">
                {selectedTeam.members?.map((member) => {
                  const isThisOwner = member.id === selectedTeam.owner_id;
                  const isMe = member.id === user?.id;
                  return (
                    <div key={member.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-transparent hover:bg-slate-50 hover:border-slate-100 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {renderAvatar(member.avatar, member.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {member.name}
                            {isMe && <span className="text-xs text-slate-400 font-normal">({t("teamDetail.me")})</span>}
                          </div>
                          <div className="mt-0.5">{roleBadge(member.role)}</div>
                        </div>
                      </div>

                      {isOwner && !isThisOwner && (
                        <div className="flex items-center gap-2">
                          <select value={member.role}
                            onChange={(e) => handleChangeMemberRole(selectedTeam.id, member.id, e.target.value)}
                            className="text-sm h-9 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white text-slate-700">
                            <option value="member">{t("teamDetail.roles.member")}</option>
                            <option value="captain">{t("teamDetail.roles.captain")}</option>
                            <option value="coach">{t("teamDetail.roles.coach")}</option>
                            <option value="owner">{t("teamDetail.roles.owner")}</option>
                          </select>
                          <button onClick={() => handleRemoveMember(selectedTeam.id, member.id)}
                            className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isCoach && !isThisOwner && !isMe && member.role === "member" && (
                        <button onClick={() => handleRemoveMember(selectedTeam.id, member.id)}
                          className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {isMe && !isThisOwner && (
                        <button onClick={() => handleRemoveMember(selectedTeam.id, user.id)}
                          className="px-3 py-1.5 text-sm bg-red-50 text-red-500 rounded-xl hover:bg-red-100 font-semibold transition-colors">
                          {t("teams.leave")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AYARLAR */}
          {activeTab === "settings" && isOwner && (
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lCls}>{t("createTeam.nameLabel")}</label>
                  <input type="text" value={editForm.name} required
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className={iCls} />
                </div>
                <div>
                  <label className={lCls}>{t("createTeam.sportLabel")}</label>
                  <select value={editForm.sport}
                    onChange={(e) => setEditForm((f) => ({ ...f, sport: e.target.value }))}
                    className={`${iCls} appearance-none cursor-pointer`}>
                    {sportTypes.map((s) => <option key={s} value={s}>{t(`sports.${s}`)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={lCls}>{t("createTeam.descLabel")}</label>
                <textarea value={editForm.description} rows={3}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className={`${iCls} h-auto py-3 resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lCls}>{t("common.location")}</label>
                  <input type="text" value={editForm.location}
                    onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder={t("createTeam.locationPlaceholder")}
                    className={iCls} />
                </div>
                <div>
                  <label className={lCls}>{t("teamDetail.teamPhoto")}</label>
                  <label className="flex items-center gap-3 h-11 px-4 border border-slate-200 rounded-xl bg-white cursor-pointer hover:border-brand-400 transition-colors">
                    <Image className="w-4 h-4 text-brand-600 flex-shrink-0" />
                    <span className="text-sm text-slate-500 truncate">
                      {(editForm.avatar?.startsWith("/uploads/") || editForm.avatar?.startsWith("http")) ? t("teamDetail.photoUploaded") : t("teamDetail.selectPhoto")}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("avatar", file);
                      const token = localStorage.getItem("token");
                      const res = await fetch(`${API_URL}/teams/${selectedTeam.id}/avatar`, { method:"POST", headers:{ Authorization:`Bearer ${token}` }, body:fd });
                      if (res.ok) {
                        const data = await res.json();
                        setEditForm(f => ({ ...f, avatar: data.avatar }));
                        setSelectedTeam(t => ({ ...t, avatar: data.avatar }));
                        setTeams(ts => ts.map(t => t.id === selectedTeam.id ? { ...t, avatar: data.avatar } : t));
                        showToast(t("toast.teamPhotoUpdated"), "success");
                      } else showToast(t("toast.uploadFail"), "error");
                    }} />
                  </label>
                </div>
              </div>

              <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-colors ${editForm.is_private ? "border-slate-200 bg-slate-50" : "border-brand-200 bg-brand-50"}`}>
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5 text-sm">
                    {editForm.is_private ? <><Lock className="w-4 h-4 text-slate-500" /> {t("teams.privateTeam")}</> : <><Globe className="w-4 h-4 text-brand-600" /> {t("teamDetail.publicTeam")}</>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {editForm.is_private ? t("teamDetail.privateDesc") : t("teamDetail.publicDesc")}
                  </div>
                </div>
                <button type="button"
                  onClick={() => setEditForm((f) => ({ ...f, is_private: !f.is_private }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ml-4 flex-shrink-0 ${editForm.is_private ? "bg-slate-300" : "bg-brand-500"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${editForm.is_private ? "left-1" : "left-6"}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit"
                  className="flex-1 h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold transition-colors">
                  {t("common.save")}
                </button>
                <button type="button" onClick={() => handleDeleteTeam(selectedTeam.id)}
                  className="px-6 h-12 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> {t("common.delete")}
                </button>
              </div>
            </form>
          )}

          {/* GİZLİ TAKIM - üye değil */}
          {!isMember && !canSeeMembers && (
            <div className="text-center py-14">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700">{t("teams.privateTeam")}</p>
              <p className="text-sm text-slate-400 mt-1">{t("teams.privateInfo")}</p>
            </div>
          )}

          {/* KATIL butonu */}
          {!isMember && !selectedTeam.is_private && (
            <div className="mt-6">
              <button onClick={() => handleJoinTeam(selectedTeam.id)}
                disabled={joiningTeamId === selectedTeam.id}
                className="w-full h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {joiningTeamId === selectedTeam.id
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("teams.joining")}</>
                  : <><UserPlus className="w-4 h-4" /> {t("teamDetail.joinTeam")}</>}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const CreateTrainingPage = () => {
    // Backend'den doğrudan sadece antrenman oluşturabileceği takımları çek
    const [eligibleTeams, setEligibleTeams] = useState([]);
    const [eligibleLoading, setEligibleLoading] = useState(true);
    useEffect(() => {
      const token = localStorage.getItem("token");
      if (!token) { setEligibleLoading(false); return; }
      fetch(`${API_URL}/teams?can_create_training=true`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { teams: [] })
        .then(d => {
          // Sadece sahip/antrenör/kaptan olduğu takımlar — backend filtre + frontend güvence
          const ALLOWED = ['owner', 'coach', 'captain'];
          const filtered = (d.teams || []).filter(t => ALLOWED.includes(t.my_role));
          setEligibleTeams(filtered);
          setEligibleLoading(false);
        })
        .catch(() => setEligibleLoading(false));
    }, []);
    const [formData, setFormData] = useState({
      title: "",
      description: "",
      training_date: "",
      training_time: "",
      location_name: "",
      location_lat: null,
      location_lng: null,
      capacity: 20,
      difficulty: "Orta",
      team_id: null,
      is_public: true,
    });

    // Takımlar yüklenince formdaki team_id'yi ilk uygun takıma ayarla
    useEffect(() => {
      if (eligibleTeams.length > 0 && !formData.team_id) {
        const first = eligibleTeams[0];
        setFormData(f => ({ ...f, team_id: first.id, is_public: !first.is_private }));
      }
    }, [eligibleTeams]);

    // Seçili takım nesnesini bul
    const selectedTeamObj = eligibleTeams.find((t) => t.id === parseInt(formData.team_id));
    const selectedTeamIsPrivate = selectedTeamObj?.is_private || false;

    const handleTeamChange = (teamId) => {
      const team = eligibleTeams.find((t) => t.id === parseInt(teamId));
      setFormData((f) => ({
        ...f,
        team_id: parseInt(teamId),
        is_public: team?.is_private ? false : f.is_public,
      }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.location_lat || !formData.location_lng) {
        showConfirm(
          t("createTraining.noGpsConfirm"),
          () => handleCreateTraining(formData)
        );
        return;
      }
      handleCreateTraining(formData);
    };

    const inputCls = "w-full h-12 px-4 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors";
    const selectCls = `${inputCls} appearance-none cursor-pointer`;
    const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

    return (
      <form onSubmit={handleSubmit}>
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-xl mx-auto">

          {/* Başlık */}
          <div className="mb-6">
            <h1 className="font-display font-bold text-slate-900" style={{fontSize:"2.2rem", letterSpacing:"-0.01em"}}>{t("createTraining.pageTitle")}</h1>
            <p className="text-sm text-slate-400 mt-1">{t("createTraining.pageSubtitle")}</p>
          </div>

          {eligibleLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
          ) : eligibleTeams.length === 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                {myTeams.length === 0 ? (
                  <>
                    <p className="text-sm font-medium text-amber-800">{t("createTraining.noTeamFirst")}</p>
                    <button onClick={() => setCurrentPage("create-team")} className="text-sm text-brand-600 font-semibold mt-1">{t("teams.create")} →</button>
                  </>
                ) : (
                  <p className="text-sm font-medium text-amber-800">{t("createTraining.noEligibleTeam")}</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">

            {/* Takım + Gizlilik */}
            {eligibleTeams.length > 0 && (
              <div className="p-5 space-y-3">
                <div>
                  <label className={labelCls}>{t("createTraining.teamLabel")}</label>
                  <select
                    value={formData.team_id}
                    onChange={(e) => handleTeamChange(e.target.value)}
                    className={selectCls}
                    required
                  >
                    {eligibleTeams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                {selectedTeamIsPrivate ? (
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 rounded-xl text-sm text-slate-500 border border-slate-200">
                    <Lock className="w-4 h-4 flex-shrink-0" />
                    <span>{t("createTraining.privateTeamNote")}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 bg-brand-50 rounded-xl border border-brand-100">
                    <span className="text-sm text-slate-700 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-brand-500" /> {t("createTraining.publicTraining")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, is_public: !f.is_public }))}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${formData.is_public ? "bg-brand-500" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${formData.is_public ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Başlık + Açıklama */}
            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>{t("createTraining.titleLabel")}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={inputCls}
                  placeholder={t("createTraining.titlePlaceholder")}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>{t("createTraining.descLabel")} <span className="normal-case font-normal text-slate-400">({t("common.optional")})</span></label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors resize-none"
                  rows="3"
                  placeholder={t("createTraining.descPlaceholder")}
                />
              </div>
            </div>

            {/* Tarih + Saat */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t("createTraining.dateLabel")}</label>
                  <input
                    type="date"
                    value={formData.training_date}
                    onChange={(e) => setFormData({ ...formData, training_date: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("createTraining.timeLabel")}</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.training_time ? formData.training_time.split(":")[0] : ""}
                      onChange={(e) => {
                        const min = formData.training_time ? formData.training_time.split(":")[1] : "00";
                        setFormData({ ...formData, training_time: e.target.value ? `${e.target.value}:${min}` : "" });
                      }}
                      className={selectCls}
                      required
                    >
                      <option value="">--</option>
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={formData.training_time ? formData.training_time.split(":")[1] : "00"}
                      onChange={(e) => {
                        const hr = formData.training_time ? formData.training_time.split(":")[0] : "";
                        if (hr) setFormData({ ...formData, training_time: `${hr}:${e.target.value}` });
                      }}
                      className={selectCls}
                    >
                      {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Konum */}
            <div className="p-5">
              <label className={labelCls}>{t("createTraining.locationLabel")}</label>
              <LocationPicker
                locationName={formData.location_name}
                lat={formData.location_lat}
                lng={formData.location_lng}
                onLocationName={(v) => setFormData((f) => ({ ...f, location_name: v }))}
                onLat={(v) => setFormData((f) => ({ ...f, location_lat: v }))}
                onLng={(v) => setFormData((f) => ({ ...f, location_lng: v }))}
              />
            </div>

            {/* Kapasite + Seviye */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t("createTraining.capacityLabel")}</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    className={inputCls}
                    min="1"
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("createTraining.levelLabel")}</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className={selectCls}
                  >
                    <option value="Kolay">🟢 {t("trainings.levelEasy")}</option>
                    <option value="Orta">🟡 {t("trainings.levelMid")}</option>
                    <option value="Zor">🔴 {t("trainings.levelHard")}</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* Butonlar */}
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={() => setCurrentPage("profile")}
              className="h-12 px-6 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={eligibleTeams.length === 0}
              className="flex-1 h-12 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 hover:shadow-lg"
              style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}
            >
              {t("createTraining.submitBtn")}
            </button>
          </div>
        </div>
      </div>
      </form>
    );
  };

  const CreateTeamPage = () => {
    const [formData, setFormData] = useState({
      name: "",
      sport: "",
      description: "",
      location: "",
      is_private: false,
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      handleCreateTeam(formData);
    };

    const inputCls = "w-full h-12 px-4 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors";
    const selectCls = `${inputCls} appearance-none cursor-pointer`;
    const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

    return (
      <form onSubmit={handleSubmit}>
        <div className="min-h-screen bg-slate-50 py-10 px-4">
          <div className="max-w-xl mx-auto">

            {/* Başlık */}
            <div className="mb-6">
              <h1 className="font-display font-bold text-slate-900" style={{fontSize:"2.2rem", letterSpacing:"-0.01em"}}>{t("createTeam.pageTitle")}</h1>
              <p className="text-sm text-slate-400 mt-1">{t("createTeam.pageSubtitle")}</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">

              {/* Takım Adı + Spor */}
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelCls}>{t("createTeam.nameLabel")}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputCls}
                    placeholder={t("createTeam.namePlaceholder")}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("createTeam.sportLabel")}</label>
                  <select
                    value={formData.sport}
                    onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                    className={selectCls}
                    required
                  >
                    <option value="">{t("createTeam.selectSport")}</option>
                    {sportTypes.map((sport) => (
                      <option key={sport} value={sport}>{t(`sports.${sport}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Açıklama */}
              <div className="p-5">
                <label className={labelCls}>{t("createTeam.descLabel")} <span className="normal-case font-normal text-slate-400">({t("common.optional")})</span></label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors resize-none"
                  rows="3"
                  placeholder={t("createTeam.descPlaceholder")}
                />
              </div>

              {/* Konum */}
              <div className="p-5">
                <label className={labelCls}>{t("common.location")} <span className="normal-case font-normal text-slate-400">({t("common.optional")})</span></label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className={inputCls}
                  placeholder={t("createTeam.locationPlaceholder")}
                />
              </div>

              {/* Gizlilik */}
              <div className="p-5">
                <label className={labelCls}>{t("createTeam.privacyLabel")}</label>
                <button
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, is_private: !f.is_private }))}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    formData.is_private
                      ? "bg-slate-50 border-slate-200"
                      : "bg-brand-50 border-brand-100"
                  }`}
                >
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    {formData.is_private
                      ? <><Lock className="w-4 h-4 text-slate-400" /> {t("common.private")} — {t("createTeam.privateDesc")}</>
                      : <><Globe className="w-4 h-4 text-brand-500" /> {t("common.public")} — {t("createTeam.publicDesc")}</>
                    }
                  </span>
                  <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${formData.is_private ? "bg-slate-400" : "bg-brand-500"}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${formData.is_private ? "left-6" : "left-1"}`} />
                  </div>
                </button>
              </div>

            </div>

            {/* Butonlar */}
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setCurrentPage("profile")}
                className="h-12 px-6 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="flex-1 h-12 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
                style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}
              >
                {t("createTeam.submitBtn")}
              </button>
            </div>

          </div>
        </div>
      </form>
    );
  };

  // =====================================================
  // MODALS
  // =====================================================

  // AuthModal aşağıda module-level tanımlı — buradan kaldırıldı

  const ResetPasswordPage = () => {
    const [password, setPassword]   = useState("");
    const [password2, setPassword2] = useState("");
    const [error, setError]         = useState("");
    const [success, setSuccess]     = useState(false);
    const [loading, setLoading]     = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setError("");
      if (password !== password2) return setError(t("settings.passwordMismatch"));
      if (password.length < 6)    return setError(t("reset.minLength"));
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess(true);
          setTimeout(() => { setCurrentPage("home"); setResetToken(null); }, 3000);
        } else {
          setError(data.error || t("common.error"));
        }
      } catch {
        setError(t("auth.serverError"));
      }
      setLoading(false);
    };

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
              <Lock className="w-8 h-8 text-white"/>
            </div>
            <h1 className="text-2xl font-medium text-slate-900">{t("reset.title")}</h1>
            <p className="text-slate-500 text-sm mt-1">{t("reset.subtitle")}</p>
          </div>

          {success ? (
            <div className="text-center py-4">
              <div className="mb-4 flex justify-center"><CheckCircle className="w-14 h-14 text-brand-500" /></div>
              <p className="text-brand-700 font-semibold">{t("reset.success")}</p>
              <p className="text-slate-500 text-sm mt-1">{t("reset.redirecting")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <input type="password" placeholder={t("auth.passwordNew")} value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                required/>
              <input type="password" placeholder={t("auth.passwordConfirm")} value={password2}
                onChange={e => { setPassword2(e.target.value); setError(""); }}
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                required/>
              <button type="submit" disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {t("reset.btn")}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  };

  const NotificationsPanel = () => {
    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
      <div className="fixed right-4 top-20 w-96 bg-white rounded-2xl shadow-2xl border z-50 max-h-[600px] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-medium text-lg">
            {t("notifications.title")} {unreadCount > 0 && `(${unreadCount})`}
          </h3>
          <button onClick={() => setShowNotifications(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-gray-50 ${!notif.is_read ? "bg-blue-50" : ""}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{notif.title}</h4>
                    <button
                      onClick={() => handleDeleteNotification(notif.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{notif.message}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      {fmtDateShort(notif.created_at)}
                    </span>
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkNotificationRead(notif.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {t("notifications.markRead")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>{t("notifications.noNotifications")}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const ProfileEditModal = () => {
    const [formData, setFormData] = useState({
      name: user?.name || "",
      phone: user?.phone || "",
      avatar: user?.avatar || "",
    });
    const [pwData, setPwData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [pwLoading, setPwLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");
    const avatarInputRef = useRef(null);

    const handleAvatarUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAvatarLoading(true);
      try {
        const fd = new FormData();
        fd.append("avatar", file);
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/auth/avatar`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setFormData(f => ({ ...f, avatar: data.user.avatar }));
          showToast(t("toast.photoUpdated"), "success");
        } else {
          const err = await res.json();
          showToast(err.error || t("toast.uploadFail"), "error");
        }
      } catch {
        showToast(t("toast.networkError"), "error");
      } finally {
        setAvatarLoading(false);
      }
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      handleUpdateProfile(formData);
    };

    const handleChangePassword = async (e) => {
      e.preventDefault();
      if (pwData.newPassword !== pwData.confirmPassword) {
        showToast(t("settings.passwordMismatch"), "error");
        return;
      }
      if (pwData.newPassword.length < 4) {
        showToast(t("settings.passwordShort"), "error");
        return;
      }
      setPwLoading(true);
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/auth/password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword: pwData.currentPassword, newPassword: pwData.newPassword }),
        });
        if (response.ok) {
          showToast(t("toast.passwordUpdated"), "success");
          setShowProfileEdit(false);
        } else {
          const data = await response.json();
          showToast(data.error || t("settings.passwordUpdateFail"), "error");
        }
      } catch {
        showToast(t("toast.networkError"), "error");
      } finally {
        setPwLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 relative m-4">
          <button onClick={() => setShowProfileEdit(false)} className="absolute top-4 right-4">
            <X className="w-6 h-6" />
          </button>

          <h2 className="font-display font-bold mb-6" style={{fontSize:"2rem"}}>{t("settings.pageTitle")}</h2>

          {/* Sekmeler */}
          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "profile" ? "bg-white shadow text-brand-600" : "text-gray-500"}`}
            >
              {t("nav.profile")}
            </button>
            <button
              onClick={() => setActiveTab("password")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "password" ? "bg-white shadow text-brand-600" : "text-gray-500"}`}
            >
              {t("auth.passwordLabel")}
            </button>
          </div>

          {activeTab === "profile" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Avatar fotoğrafı */}
              <div className="flex flex-col items-center gap-3 pb-2">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center text-white text-3xl font-bold shadow-lg"
                    style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
                    {(formData.avatar?.startsWith("/uploads/") || formData.avatar?.startsWith("http")) ? (
                      <img src={formData.avatar.startsWith("http") ? formData.avatar : `${BASE_URL}${formData.avatar}`} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      user?.name?.[0]?.toLocaleUpperCase("en-US") || "?"
                    )}
                  </div>
                  {avatarLoading && (
                    <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarLoading}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-brand-200 text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-50">
                  <Image className="w-3.5 h-3.5" /> {t("profile.changePhoto")}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t("auth.nameLabel")}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t("profile.phone")}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold"
              >
                {t("common.save")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t("settings.currentPassword")}</label>
                <input
                  type="password"
                  value={pwData.currentPassword}
                  onChange={(e) => setPwData({ ...pwData, currentPassword: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t("settings.newPassword")}</label>
                <input
                  type="password"
                  value={pwData.newPassword}
                  onChange={(e) => setPwData({ ...pwData, newPassword: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t("settings.confirmPassword")}</label>
                <input
                  type="password"
                  value={pwData.confirmPassword}
                  onChange={(e) => setPwData({ ...pwData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={pwLoading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {pwLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("reset.updating")}</> : t("reset.btn")}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  };

  const InviteModal = () => {
    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!selectedTeam) {
        showToast(t("teams.teamNotFound"), "error");
        return;
      }
      if (!email) return;
      setSending(true);
      await handleInviteToTeam(selectedTeam.id, email);
      setSending(false);
      setEmail("");
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 relative m-4">
          <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4">
            <X className="w-6 h-6" />
          </button>

          <h2 className="font-display font-bold mb-6" style={{fontSize:"2rem"}}>{t("teamDetail.inviteByEmail")}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t("auth.emailLabel")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl"
                placeholder={t("teamDetail.emailPlaceholder")}
                required
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-600 text-white rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? t("contact.sending") : t("teamDetail.sendInvite")}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // =====================================================
  // NAVIGATION
  // =====================================================

  const Navigation = () => {
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    const isActive = (page) => currentPage === page;
    const [mobileOpen, setMobileOpen] = React.useState(false);

    const navLink = (page, label) => (
      <button
        onClick={() => setCurrentPage(page)}
        className="relative text-sm font-medium tracking-wide transition-all duration-200"
        style={{color: isActive(page) ? "#009295" : "#64748b"}}
        onMouseEnter={e=>{ if(!isActive(page)) e.currentTarget.style.color="#006d6f"; }}
        onMouseLeave={e=>{ if(!isActive(page)) e.currentTarget.style.color="#64748b"; }}
      >
        {label}
        <span className="absolute -bottom-[24px] left-0 right-0 h-0.5 rounded-full transition-all duration-300"
          style={{
            background:"linear-gradient(90deg,#00b7ba,#22C55E)",
            opacity: isActive(page) ? 1 : 0,
            transform: isActive(page) ? "scaleX(1)" : "scaleX(0)",
          }}/>
      </button>
    );

    const mobileNavLink = (page, label, icon) => (
      <button
        key={page}
        onClick={() => { setCurrentPage(page); setMobileOpen(false); }}
        className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-colors"
        style={{
          background: isActive(page) ? "linear-gradient(135deg,#e5f9f9,#e5f9f9)" : "transparent",
          color: isActive(page) ? "#009295" : "#475569",
        }}
      >
        {icon}
        {label}
      </button>
    );

    return (
      <nav className="sticky top-0 z-50 nav-frosted shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-[68px]">

            {/* Logo */}
            <button className="flex items-center gap-2 group flex-shrink-0 hover:opacity-85 transition-opacity" onClick={() => setCurrentPage("home")} aria-label="Muuvlink - Ana Sayfa">
              {/* Amblem her zaman görünür */}
              <img src="/icons/favicon.png" alt="" className="h-7 w-auto flex-shrink-0" width="28" height="28"/>
              {/* Metin: desktop'ta görünür */}
              <img src="/icons/logo-yatay.svg" alt="Muuvlink" className="hidden md:block h-5 w-auto" width="120" height="20"/>
            </button>

            {/* Orta nav — desktop */}
            <div className="hidden md:flex items-center gap-8 h-[68px]">
              {navLink("home",      t("nav.home"))}
              {navLink("trainings", t("nav.trainings"))}
              {navLink("teams",     t("nav.teams"))}
              {navLink("contact",   t("nav.contact"))}
            </div>

            {/* Sağ aksiyonlar — desktop */}
            <div className="hidden md:flex items-center gap-2.5">

              {/* Dil seçici — dropdown */}
              <div className="relative" ref={langDropRef}>
                <button
                  onClick={() => setLangDropOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all duration-150 select-none"
                >
                  <Globe className="w-3.5 h-3.5"/>
                  <span className="uppercase tracking-wider">{lang}</span>
                  <ChevronDown className={`w-3 h-3 opacity-50 transition-transform duration-200 ${langDropOpen ? "rotate-180" : ""}`}/>
                </button>
                {langDropOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden z-[200] w-40">
                    {[
                      { code:"tr", label:"Türkçe" },
                      { code:"en", label:"English" },
                      { code:"de", label:"Deutsch" },
                    ].map(({ code, label }) => (
                      <button key={code}
                        onClick={() => { changeLang(code); setLangDropOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left transition-colors hover:bg-slate-50"
                        style={lang === code ? {background:"rgba(0,183,186,0.07)", color:"#009295", fontWeight:600} : {color:"#475569"}}
                      >
                        <span className="text-[10px] font-bold tracking-widest w-6 text-slate-400">{code.toLocaleUpperCase("en-US")}</span>
                        <span className="flex-1">{label}</span>
                        {lang === code && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{color:"#00b7ba"}}/>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {user ? (
                <>
                  <button
                    onClick={() => setCurrentPage("create-training")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg"
                    style={{background:"linear-gradient(135deg,#00b7ba,#009295)", boxShadow:"0 4px 14px rgba(0,183,186,0.3)"}}
                  >
                    <Plus className="w-4 h-4" /> {t("nav.createTraining")}
                  </button>

                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
                    aria-label={t("nav.notifications") || "Bildirimler"}
                  >
                    <Bell className="w-[18px] h-[18px] text-slate-500"/>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <button onClick={() => setCurrentPage("profile")}
                    className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center text-white font-medium text-xs flex-shrink-0"
                      style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
                      {(user.avatar?.startsWith("/uploads/") || user.avatar?.startsWith("http")) ? (
                        <img src={user.avatar.startsWith("http") ? user.avatar : `${BASE_URL}${user.avatar}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.avatar || user.name[0].toLocaleUpperCase("en-US")
                      )}
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{user.name.split(" ")[0]}</span>
                  </button>

                  <button onClick={handleLogout}
                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4 text-slate-400 hover:text-red-500"/>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); }}
                    className="px-5 py-2 text-sm font-semibold text-slate-600 hover:text-brand-700 transition-colors"
                  >
                    {t("nav.login")}
                  </button>
                  <button
                    onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg"
                    style={{background:"linear-gradient(135deg,#00b7ba,#009295)", boxShadow:"0 4px 14px rgba(0,183,186,0.3)"}}
                  >
                    {t("nav.register")}
                  </button>
                </>
              )}
            </div>

            {/* Hamburger — mobile */}
            <div className="flex md:hidden items-center gap-2">
              {user && (
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <Bell className="w-[18px] h-[18px] text-slate-500"/>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setMobileOpen(o => !o)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
              >
                {mobileOpen ? <X className="w-5 h-5 text-slate-600"/> : <Menu className="w-5 h-5 text-slate-600"/>}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menü paneli */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 shadow-lg">
            <div className="flex flex-col gap-1">
              {mobileNavLink("home",      t("nav.home"),      <Activity className="w-4 h-4"/>)}
              {mobileNavLink("trainings", t("nav.trainings"), <Dumbbell className="w-4 h-4"/>)}
              {mobileNavLink("teams",     t("nav.teams"),     <Users className="w-4 h-4"/>)}
              {mobileNavLink("contact",   t("nav.contact"),   <Mail className="w-4 h-4"/>)}

              <div className="my-2 border-t border-slate-100"/>

              {user ? (
                <>
                  <button
                    onClick={() => { setCurrentPage("create-training"); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-white transition-all"
                    style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}
                  >
                    <Plus className="w-4 h-4"/> {t("nav.createTrainingFull")}
                  </button>
                  <button
                    onClick={() => { setCurrentPage("profile"); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0"
                      style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
                      {(user.avatar?.startsWith("/uploads/") || user.avatar?.startsWith("http")) ? (
                        <img src={user.avatar.startsWith("http") ? user.avatar : `${BASE_URL}${user.avatar}`} alt="" className="w-full h-full object-cover" />
                      ) : (user.avatar || user.name[0].toLocaleUpperCase("en-US"))}
                    </div>
                    {user.name.split(" ")[0]} — {t("nav.profile")}
                  </button>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4"/> {t("nav.logout")}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); setMobileOpen(false); }}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      {t("nav.login")}
                    </button>
                    <button
                      onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); setMobileOpen(false); }}
                      className="flex-1 py-3 rounded-xl text-sm font-medium text-white transition-all"
                      style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}
                    >
                      {t("nav.register")}
                    </button>
                  </div>
                  {/* Mobil dil seçici */}
                  <div className="mt-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 px-1 mb-1">
                      <Globe className="w-3.5 h-3.5 text-slate-400"/>
                      <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Language</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {[
                        { code:"tr", label:"Türkçe" },
                        { code:"en", label:"English" },
                        { code:"de", label:"Deutsch" },
                      ].map(({ code, label }) => (
                        <button key={code}
                          onClick={() => { changeLang(code); setMobileOpen(false); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-left transition-colors"
                          style={lang === code
                            ? {background:"rgba(0,183,186,0.07)", color:"#009295", fontWeight:600}
                            : {color:"#475569"}}>
                          <span className="text-[10px] font-bold tracking-widest w-6 text-slate-400">{code.toLocaleUpperCase("en-US")}</span>
                          <span className="flex-1">{label}</span>
                          {lang === code && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{color:"#00b7ba"}}/>}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    );
  };

  // =====================================================
  // CONTACT PAGE
  // =====================================================
  const ContactPage = () => {
    const [contactForm, setContactForm] = React.useState({ name: user?.name || "", email: user?.email || "", subject: "", message: "" });
    const [sending, setSending] = React.useState(false);
    const [openFaq, setOpenFaq] = React.useState(null);

    const faqs = [1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => ({ q: t(`faq.q${n}`), a: t(`faq.a${n}`) }));

    const handleContactSubmit = async (e) => {
      e.preventDefault();
      if (!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message) {
        showToast(t("contact.fillAll"), "error"); return;
      }
      setSending(true);
      try {
        const res = await fetch(`${API_URL}/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactForm),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(t("contact.sentSuccess"), "success");
          setContactForm({ name: user?.name || "", email: user?.email || "", subject: "", message: "" });
        } else {
          showToast(data.error || t("common.error"), "error");
        }
      } catch {
        showToast(t("toast.networkError"), "error");
      } finally {
        setSending(false);
      }
    };

    const inputCls = "w-full h-12 border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition placeholder:text-slate-400";

    return (
      <div className="min-h-screen bg-slate-50">
        {/* ── Header ── */}
        <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#e5f9f9 0%,#e5f9f9 60%,#cbf3f3 100%)"}}>
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
          <div className="absolute inset-0 pointer-events-none"
            style={{background:"radial-gradient(ellipse at center,rgba(0,183,186,0.15) 0%,transparent 65%)"}}/>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-14 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{background:"rgba(0,183,186,0.15)", border:"1px solid rgba(0,183,186,0.3)"}}>
              <MessageCircle className="w-8 h-8" style={{color:"#00b7ba"}}/>
            </div>
            <span className="section-label block mb-3">{t("contact.support")}</span>
            <h1 className="font-display font-bold text-brand-900 leading-none mb-4" style={{fontSize:"clamp(3.5rem,8vw,5.5rem)", letterSpacing:"-0.02em"}}>{t("contact.pageTitle")}</h1>
            <p className="text-slate-500 text-base max-w-md mx-auto">{t("contact.pageSubtitle")}</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8">

            {/* Sol: Instagram */}
            <div className="space-y-5">
              {/* Instagram kartı */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="section-label mb-5">{t("contact.social")}</div>
                <a
                  href="https://www.instagram.com/muuvlinkapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
                  style={{background:"linear-gradient(135deg,#fdf2f8,#fce7f3)", border:"1px solid #fbcfe8"}}
                >
                  {/* Instagram gradient icon */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{background:"linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)"}}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="font-display font-bold text-slate-900 text-base leading-tight">Instagram</div>
                    <div className="text-sm text-pink-600 font-medium mt-0.5">@muuvlinkapp</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-pink-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"/>
                </a>
                <p className="text-xs text-slate-400 mt-4 leading-relaxed text-center">
                  {t("contact.followUs")}
                </p>
              </div>

              {/* Bilgi notu */}
              <div className="rounded-2xl p-5 border border-brand-100" style={{background:"linear-gradient(135deg,#e5f9f9,#f0fdfd)"}}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{background:"rgba(0,183,186,0.15)"}}>
                    <MessageCircle className="w-4 h-4" style={{color:"#00b7ba"}}/>
                  </div>
                  <div>
                    <div className="font-display font-bold text-brand-900 text-sm mb-1">{t("contact.quickReply")}</div>
                    <p className="text-xs text-brand-700 leading-relaxed">
                      {t("contact.quickReplyDesc")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Orta + Sağ */}
            <div className="md:col-span-2 space-y-6">
              {/* Form */}
              <div className="bg-white rounded-2xl p-8 border border-slate-100">
                <div className="section-label mb-2">{t("contact.formTitle")}</div>
                <p className="text-slate-400 text-sm mb-6">{t("contact.formSubtitle")}</p>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{t("contact.nameLabel")}</label>
                      <input
                        value={contactForm.name}
                        onChange={e => setContactForm(p => ({...p, name: e.target.value}))}
                        placeholder={t("contact.namePlaceholder")}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{t("contact.emailLabel")}</label>
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={e => setContactForm(p => ({...p, email: e.target.value}))}
                        placeholder="ornek@mail.com"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{t("contact.subjectLabel")}</label>
                    <select
                      value={contactForm.subject}
                      onChange={e => setContactForm(p => ({...p, subject: e.target.value}))}
                      className={inputCls}
                    >
                      <option value="">{t("contact.subjectSelect")}</option>
                      <option value="Üyelik & Hesap">{t("contact.subjects.account")}</option>
                      <option value="Takım Kurma">{t("contact.subjects.team")}</option>
                      <option value="Antrenman Soruları">{t("contact.subjects.training")}</option>
                      <option value="Teknik Sorun">{t("contact.subjects.technical")}</option>
                      <option value="İş Birliği & Sponsorluk">{t("contact.subjects.collab")}</option>
                      <option value="Öneri & Geri Bildirim">{t("contact.subjects.feedback")}</option>
                      <option value="Diğer">{t("contact.subjects.other")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{t("contact.messageLabel")}</label>
                    <textarea
                      value={contactForm.message}
                      onChange={e => setContactForm(p => ({...p, message: e.target.value}))}
                      rows={5}
                      placeholder={t("contact.messagePlaceholder")}
                      className={`${inputCls} !h-auto resize-none`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="btn-primary w-full py-3.5 text-base font-semibold"
                  >
                    {sending
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> {t("contact.sending")}</>
                      : <><Send className="w-4 h-4"/> {t("contact.sendBtn")}</>
                    }
                  </button>
                </form>
              </div>

              {/* SSS */}
              <div className="bg-white rounded-2xl p-8 border border-slate-100">
                <div className="section-label mb-2">{t("contact.faqTitle")}</div>
                <p className="text-slate-400 text-sm mb-6">{t("contact.faqSubtitle")}</p>
                <div className="space-y-2">
                  {faqs.map((faq, i) => (
                    <div key={i} className="border border-slate-100 rounded-xl overflow-hidden transition-all duration-200"
                      style={openFaq === i ? {borderColor:"#cbf3f3", boxShadow:"0 0 0 3px rgba(0,183,186,0.07)"} : {}}>
                      <button
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
                        style={openFaq === i ? {background:"#f0fdfd"} : {}}
                        onMouseEnter={e => { if (openFaq !== i) e.currentTarget.style.background = "#f8fafc"; }}
                        onMouseLeave={e => { if (openFaq !== i) e.currentTarget.style.background = ""; }}
                      >
                        <span className="font-semibold text-slate-800 text-sm pr-4">{faq.q}</span>
                        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : "text-slate-400"}`}
                          style={openFaq === i ? {color:"#00b7ba"} : {}}/>
                      </button>
                      {openFaq === i && (
                        <div className="px-5 pb-5 border-t border-brand-100">
                          <p className="text-slate-500 text-sm leading-relaxed pt-4">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // =====================================================
  // LEGAL MODAL
  // =====================================================
  const legalContent = {
    kvkk: {
      title: t("footer.kvkk"),
      body: `
<h3>Kişisel Verilerin İşlenmesi Hakkında Aydınlatma Metni</h3>
<p>SALT KREATİF REKLAM TİC. LTD. ŞTİ. ("Şirket") olarak, Muuvlink platformu aracılığıyla 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla kişisel verilerinizi aşağıda açıklanan amaçlar doğrultusunda işlemekteyiz.</p>

<h4>1. Veri Sorumlusu</h4>
<p>SALT KREATİF REKLAM TİC. LTD. ŞTİ.<br/>
Çınarlı Mahallesi 1572 Sokak No:33 PK.35170 Konak, İzmir<br/>
Vergi Dairesi: Karşıyaka V.D. | VN: 7420957827<br/>
İletişim: Uygulama içi iletişim formu aracılığıyla ulaşabilirsiniz.</p>

<h4>2. İşlenen Kişisel Veriler</h4>
<p>Ad, soyad, e-posta adresi, profil fotoğrafı, konum bilgisi (yalnızca kullanıcı izni ile), antrenman ve takım verileri, uygulama kullanım geçmişi.</p>

<h4>3. İşleme Amaçları</h4>
<p>Üyelik oluşturma ve kimlik doğrulama; platform hizmetlerinin (antrenman oluşturma, takım yönetimi, spor arkadaşı eşleştirme) sunulması; bildirim ve e-posta gönderimi; platform güvenliğinin sağlanması; yasal yükümlülüklerin yerine getirilmesi.</p>

<h4>4. Hukuki Dayanak</h4>
<p>KVKK Madde 5/2-c uyarınca sözleşmenin ifası; Madde 5/2-ç uyarınca hukuki yükümlülük; Madde 5/2-f uyarınca meşru menfaat; gerektiğinde Madde 5/1 uyarınca açık rıza.</p>

<h4>5. Veri Aktarımı</h4>
<p>Kişisel verileriniz; yalnızca hizmet sunumu için zorunlu olan altyapı ve e-posta hizmet sağlayıcılarıyla ve yasal zorunluluk halinde yetkili kamu kurumlarıyla paylaşılabilir. Bu sağlayıcılar, gizlilik yükümlülükleriyle bağlıdır ve verilerinizi kendi amaçları için kullanamazlar.</p>

<h4>6. Saklama Süresi</h4>
<p>Kişisel verileriniz, hesabınız aktif olduğu sürece ve hesabın silinmesinden itibaren ilgili mevzuatta öngörülen süreler boyunca saklanır. Hesabınızı silmeniz halinde verileriniz 30 gün içinde anonimleştirilir veya kalıcı olarak silinir.</p>

<h4>7. Haklarınız (KVKK Madde 11)</h4>
<p>Veri sorumlusuna başvurarak kişisel verilerinize erişme, düzeltme, silme veya yok etme talep etme, işlemenin kısıtlanmasını isteme, veri taşınabilirliği talep etme ve otomatik işleme dayalı kararlara itiraz etme haklarına sahipsiniz. Talepleriniz için uygulama içi iletişim formumuzu kullanabilirsiniz.</p>
      `
    },
    gizlilik: {
      title: t("footer.privacy"),
      body: `
<h3>Gizlilik Politikası</h3>
<p>Son güncelleme: Haziran 2025</p>
<p>SALT KREATİF REKLAM TİC. LTD. ŞTİ. olarak, Muuvlink platformu üzerinden kullanıcı gizliliğini en temel önceliklerimizden biri olarak kabul ediyoruz. Bu politika, hangi verileri topladığımızı, nasıl kullandığımızı ve nasıl koruduğumuzu açıklamaktadır.</p>

<h4>1. Topladığımız Bilgiler</h4>
<p><strong>Doğrudan sağladığınız bilgiler:</strong> Kayıt sırasında girdiğiniz ad, e-posta adresi ve şifre; profil sayfasında eklediğiniz fotoğraf ve biyografi.<br/>
<strong>Platform kullanım verileri:</strong> Oluşturduğunuz veya katıldığınız antrenmanlar, takım üyelikleri, rozet bilgileri.<br/>
<strong>Konum verisi:</strong> Yalnızca tarayıcı izni verdiğinizde ve yalnızca yakın antrenmanları listelemek için kullanılır. Sunucularımızda kalıcı olarak saklanmaz.<br/>
<strong>Teknik veriler:</strong> Çerezler ve oturum bilgileri (detaylar için Çerez Politikamıza bakınız).</p>

<h4>2. Verilerin Kullanımı</h4>
<p>Toplanan veriler; hesabınızı ve oturumunuzu yönetmek, spor arkadaşı eşleştirme ve antrenman önerilerini kişiselleştirmek, platform güvenliğini korumak, bildirim ve hatırlatıcı e-postalar göndermek ve yasal yükümlülükleri yerine getirmek amacıyla kullanılır. Verileriniz reklam amacıyla üçüncü taraflarla paylaşılmaz.</p>

<h4>3. Veri Güvenliği</h4>
<p>Verileriniz endüstri standardı şifreleme (HTTPS/TLS) ile iletilmekte; şifreleriniz bcrypt algoritmasıyla hash'lenerek saklanmakta, hiçbir zaman düz metin olarak tutulmamaktadır. Sunucu altyapımız düzenli güvenlik güncellemeleri almaktadır.</p>

<h4>4. Üçüncü Taraf Hizmetler</h4>
<p>Platform; altyapı (sunucu barındırma) ve e-posta bildirimleri için güvenilir üçüncü taraf sağlayıcılar kullanmaktadır. Bu sağlayıcılara yalnızca hizmet sunumu için gereken minimum veri aktarılır ve sağlayıcılar verilerinizi kendi amaçları için kullanamaz.</p>

<h4>5. Haklarınız</h4>
<p>Verilerinize erişim, düzeltme veya silinmesini talep etme hakkına sahipsiniz. Hesap silme işlemi; profil sayfası → Ayarlar üzerinden yapılabilir. Ek talepler için uygulama içi iletişim formumuzu kullanabilirsiniz.</p>

<h4>6. Politika Güncellemeleri</h4>
<p>Bu politika güncellenebildiğinde kullanıcılara bildirim gönderilir. Güncel politikaya her zaman bu sayfa üzerinden ulaşabilirsiniz.</p>
      `
    },
    kullanim: {
      title: t("footer.terms"),
      body: `
<h3>Kullanım Koşulları</h3>
<p>Son güncelleme: Haziran 2025</p>
<p>Muuvlink platformunu kullanarak aşağıdaki koşulları okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan etmiş olursunuz. Bu koşullar, SALT KREATİF REKLAM TİC. LTD. ŞTİ. ile kullanıcı arasındaki hukuki ilişkiyi düzenler.</p>

<h4>1. Hizmet Tanımı</h4>
<p>Muuvlink; spor yapan bireylerin bir araya gelerek takım kurmasına, antrenman planlamasına ve spor arkadaşları bulmasına olanak tanıyan bir platformdur. Platform, web tarayıcısı üzerinden erişilebilen bir web uygulaması olarak sunulmaktadır.</p>

<h4>2. Üyelik Koşulları</h4>
<p>Platforma kayıt olmak için 18 yaşını doldurmuş olmanız ve geçerli bir e-posta adresi ile doğru kimlik bilgileri sağlamanız gerekmektedir. Bir kişi yalnızca bir hesap açabilir. Hesap güvenliğinizden (şifre, oturum) tamamen siz sorumlusunuz.</p>

<h4>3. Kabul Edilemez Kullanım</h4>
<p>Aşağıdaki davranışlar kesinlikle yasaktır:<br/>
— Yanıltıcı, hakaret içeren, ırkçı veya yasadışı içerik paylaşmak<br/>
— Diğer kullanıcıları taciz etmek, tehdit etmek veya kişisel verilerini izinsiz paylaşmak<br/>
— Platform altyapısını bozmaya yönelik girişimlerde bulunmak (bot, spam, DDoS vb.)<br/>
— Başka bir kullanıcının kimliğine bürünmek<br/>
— Ticari reklam veya spam içerik yaymak</p>

<h4>4. İçerik Sorumluluğu</h4>
<p>Platforma yüklediğiniz veya paylaştığınız tüm içeriklerin (profil fotoğrafı, antrenman açıklaması, yorumlar) hukuki sorumluluğu size aittir. Muuvlink, platformun güvenliğini ve kullanıcılarının haklarını korumak amacıyla uygunsuz içerikleri önceden bildirim yapmaksızın kaldırma ve ilgili hesabı askıya alma ya da kalıcı olarak kapatma hakkını saklı tutar.</p>

<h4>5. Fikri Mülkiyet</h4>
<p>Muuvlink markası, logosu, tasarımı ve yazılımı telif hakkı ve fikri mülkiyet mevzuatı kapsamında koruma altındadır. Platforma ait materyaller izinsiz kopyalanamaz, dağıtılamaz veya ticari amaçla kullanılamaz.</p>

<h4>6. Hizmet Değişiklikleri ve Kesintiler</h4>
<p>Muuvlink; platformu geliştirmek, güncellemek veya gerektiğinde hizmeti geçici ya da kalıcı olarak durdurmak hakkını saklı tutar. Önemli değişiklikler öncesinde kayıtlı kullanıcılara bildirim yapılmaya çalışılır; ancak teknik zorunluluk halinde bu mümkün olmayabilir.</p>

<h4>7. Sorumluluk Sınırlaması</h4>
<p>Platform "olduğu gibi" sunulmaktadır. Muuvlink; hizmetin kesintisiz veya hatasız çalışacağını garanti etmez. Platform üzerinde organize edilen fiziksel aktivitelerden (antrenman, spor etkinliği) doğabilecek yaralanma veya maddi zararlardan Muuvlink sorumlu tutulamaz.</p>

<h4>8. Uygulanacak Hukuk ve Yetki</h4>
<p>Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Taraflar arasında doğabilecek uyuşmazlıklarda İzmir mahkemeleri ve icra daireleri yetkilidir.</p>

<h4>9. İletişim</h4>
<p>Kullanım koşullarına ilişkin sorularınız için uygulama içi iletişim formumuzu kullanabilirsiniz.</p>
      `
    },
    cerez: {
      title: t("footer.cookies"),
      body: `
<h3>Çerez Politikası</h3>
<p>Son güncelleme: Haziran 2025</p>
<p>Bu politika, SALT KREATİF REKLAM TİC. LTD. ŞTİ. tarafından işletilen Muuvlink platformunun çerezleri nasıl kullandığını ve bu konuda tercihlerinizi nasıl yönetebileceğinizi açıklamaktadır.</p>

<h4>Çerez Nedir?</h4>
<p>Çerezler, bir web sitesini ziyaret ettiğinizde tarayıcınız aracılığıyla cihazınıza kaydedilen küçük metin dosyalarıdır. Oturum bilgilerinizi hatırlamak, tercihlerinizi kaydetmek ve platform deneyiminizi iyileştirmek amacıyla kullanılırlar.</p>

<h4>Kullandığımız Çerez Türleri</h4>
<p><strong>Zorunlu Çerezler</strong><br/>
Platformun temel işlevleri için gereklidir: kullanıcı oturumu, güvenlik doğrulaması ve çerez tercih kaydı. Bu çerezler devre dışı bırakılamaz; devre dışı bırakılması durumunda platform düzgün çalışmayabilir.</p>
<p><strong>İşlevsel Çerezler</strong><br/>
Dil, tema veya son görüntülediğiniz sayfa gibi tercihlerinizi hatırlamak için kullanılır. Oturum kapandığında veya belirli bir süre sonra sona erer.</p>
<p><strong>Analitik Çerezler</strong><br/>
Platform kullanımını ve performansını anlamamıza yardımcı olur. Toplanan veriler anonim olarak işlenir; bireysel kimliğinizle ilişkilendirilmez. Bu çerezler reddedilebilir.</p>

<h4>Çerez Süresi</h4>
<p><strong>Oturum çerezleri:</strong> Tarayıcıyı kapattığınızda otomatik olarak silinir.<br/>
<strong>Kalıcı çerezler:</strong> Belirlenen süre (genellikle 30 gün) sonunda sona erer.</p>

<h4>Çerez Yönetimi</h4>
<p>Çerez tercihlerinizi tarayıcınızın ayarlar menüsünden yönetebilir, tüm çerezleri silebilir veya belirli çerezleri engelleyebilirsiniz. Bununla birlikte, zorunlu çerezlerin engellenmesi oturum açma ve temel platform işlevlerini olumsuz etkileyebilir.</p>

<h4>Rızanız</h4>
<p>Platformu ilk ziyaretinizde gösterilen çerez bildirimine "Kabul Et" diyerek çerez kullanımını onaylarsınız. Zorunlu çerezler rıza olmaksızın da kullanılabilir; diğer çerezler için onayınız gereklidir. Onayınızı geri almak için tarayıcı ayarlarından çerezleri temizleyebilirsiniz.</p>
      `
    }
  };

  const LegalModal = () => {
    if (!legalModal) return null;
    const content = legalContent[legalModal];
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.6)"}}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-medium text-slate-800">{content.title}</h2>
            <button onClick={() => setLegalModal(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div
            className="overflow-y-auto px-6 py-5 text-sm text-slate-600 leading-relaxed space-y-3 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{__html: content.body}}
            style={{"--tw-prose-headings":"#1e293b","--tw-prose-links":"#981dd8"}}
          />
        </div>
      </div>
    );
  };

  // =====================================================
  // COOKIE BANNER
  // =====================================================
  const CookieBanner = () => {
    if (cookieConsent) return null;
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[250] bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 px-4 py-4 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 text-sm text-slate-300 leading-relaxed">
            <span className="font-semibold text-white">{t("cookie.title")}</span>
            {" "}{t("cookie.text")}{" "}
            <button onClick={() => setLegalModal("cerez")} className="text-brand-400 hover:text-brand-300 underline underline-offset-2 transition-colors">
              {t("cookie.policy")}
            </button>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setLegalModal("cerez")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 transition-colors"
            >
              {t("cookie.details")}
            </button>
            <button
              onClick={() => { setCookieConsent(true); localStorage.setItem("cookieConsent", "true"); }}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}
            >
              {t("cookie.accept")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =====================================================
  // FOOTER
  // =====================================================
  const Footer = () => {
    const footerLinks = (items) => items.map(({label, action}) => (
      <li key={label}>
        <button onClick={action} className="text-slate-400 hover:text-white text-sm transition-colors duration-200">
          {label}
        </button>
      </li>
    ));

    return (
      <footer className="bg-slate-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

            {/* Kolon 1 — Marka */}
            <div className="lg:col-span-1">
              <button onClick={() => setCurrentPage("home")} className="flex items-center gap-2 mb-4 group hover:opacity-80 transition-opacity">
                <img src="/icons/favicon.png" alt="" className="h-8 w-auto flex-shrink-0" />
                <img src="/icons/logo-yatay.svg" alt="Muuvlink" className="h-5 w-auto" style={{filter:"brightness(0) invert(1)"}} />
              </button>
              <p className="text-slate-400 text-sm leading-relaxed">
                {t("footer.tagline")}
              </p>
            </div>

            {/* Kolon 2 — Uygulama */}
            <div>
              <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">{t("footer.app")}</h3>
              <ul className="space-y-2.5">
                {footerLinks([
                  { label: t("nav.home"),      action: () => setCurrentPage("home") },
                  { label: t("nav.trainings"), action: () => setCurrentPage("trainings") },
                  { label: t("nav.teams"),     action: () => setCurrentPage("teams") },
                  { label: t("footer.badges"), action: () => setCurrentPage("badges") },
                  { label: t("nav.contact"),   action: () => setCurrentPage("contact") },
                ])}
              </ul>
            </div>

            {/* Kolon 3 — Yasal */}
            <div>
              <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">{t("footer.legal")}</h3>
              <ul className="space-y-2.5">
                {footerLinks([
                  { label: t("footer.kvkk"),    action: () => setLegalModal("kvkk") },
                  { label: t("footer.privacy"),  action: () => setLegalModal("gizlilik") },
                  { label: t("footer.terms"),    action: () => setLegalModal("kullanim") },
                  { label: t("footer.cookies"),  action: () => setLegalModal("cerez") },
                ])}
              </ul>
            </div>

            {/* Kolon 4 — İletişim */}
            <div>
              <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">{t("footer.contactCol")}</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5 text-sm text-slate-400">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                  <a href="https://www.instagram.com/muuvlinkapp/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    @muuvlinkapp
                  </a>
                </li>
              </ul>
              <div className="mt-5">
                <button
                  onClick={() => setCurrentPage("contact")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}
                >
                  <MessageCircle className="w-4 h-4" /> {t("footer.reach")}
                </button>
              </div>
            </div>

          </div>

          {/* Alt çizgi */}
          <div className="border-t border-slate-800 pt-6 text-center">
            <p className="text-slate-500 text-xs">
              © {new Date().getFullYear()} Muuvlink — {t("footer.rights")}
            </p>
          </div>
        </div>
      </footer>
    );
  };

  // =====================================================
  // 404 NOT FOUND PAGE
  // =====================================================

  const NotFoundPage = () => (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md mx-auto">
        {/* Büyük 404 */}
        <div className="relative mb-8">
          <div className="text-[10rem] font-black leading-none select-none"
            style={{ background: "linear-gradient(135deg, #981dd8 0%, #00b7ba 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-bounce mt-4 flex justify-center"><Activity className="w-12 h-12 text-brand-400"/></div>
          </div>
        </div>

        {/* Mesaj */}
        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          {t("notFound.title")}
        </h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          {t("notFound.subtitle")}
        </p>

        {/* Butonlar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setCurrentPage("home")}
            className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all shadow-lg shadow-brand-200 hover:shadow-brand-300 hover:-translate-y-0.5 active:translate-y-0"
          >
            {t("notFound.btn")}
          </button>
          <button
            onClick={() => setCurrentPage("trainings")}
            className="px-6 py-3 rounded-xl bg-white border border-slate-200 hover:border-brand-300 text-slate-700 font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
          >
            <Dumbbell className="w-4 h-4 mr-2 inline -mt-0.5"/>{t("home.heroCta")}
          </button>
        </div>
      </div>
    </div>
  );

  // =====================================================
  // MAIN RENDER
  // =====================================================

  // TOAST BİLDİRİMİ
  const Toast = () => !toast ? null : (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white font-medium max-w-sm transition-all animate-in slide-in-from-bottom-2 ${
      toast.type === "success" ? "bg-brand-600" :
      toast.type === "error" ? "bg-red-600" : "bg-brand-600"
    }`}>
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
        {toast.type === "success" ? <CheckCircle className="w-5 h-5" /> : toast.type === "error" ? <XCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
      </div>
      <span className="flex-1 text-sm leading-snug">{toast.message}</span>
      <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 flex-shrink-0 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      <Navigation />

      {currentPage === "home" && <HomePage />}
      {currentPage === "profile" && <ProfilePage />}
      {currentPage === "trainings" && <TrainingsPage />}
      {currentPage === "teams" && <TeamsPage />}
      {currentPage === "badges" && <BadgesPage />}
      {currentPage === "training-detail" && <TrainingDetailPage />}
      {currentPage === "team-detail" && <TeamDetailPage />}
      {currentPage === "create-training" && <CreateTrainingPage />}
      {currentPage === "create-team" && <CreateTeamPage />}
      {currentPage === "contact" && <ContactPage />}
      {currentPage === "reset-password" && <ResetPasswordPage />}
      {currentPage === "not-found" && <NotFoundPage />}

      {isAuthModalOpen && <AuthModal
        authMode={authMode} setAuthMode={setAuthMode}
        onClose={() => { setIsAuthModalOpen(false); setAuthMode("login"); }}
        handleLogin={handleLogin} handleRegister={handleRegister}
        setLegalModal={setLegalModal}
        t={t}
      />}
      {showNotifications && <NotificationsPanel />}
      {showProfileEdit && <ProfileEditModal />}
      {showInviteModal && <InviteModal />}
      <ConfirmModal />
      <LegalModal />
      <CookieBanner />
      <Toast />
      <Footer />
    </div>
  );
}