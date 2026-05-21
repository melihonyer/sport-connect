import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_URL  = import.meta.env.VITE_API_URL  ?? (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");
const BASE_URL = import.meta.env.VITE_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");

const DEFAULT_MOTTOS = [
  "Birlikte Hareket Et!",
  "Yeni Dostlar Edin!",
  "Limitlerini Aş!",
  "En İyini Keşfet!",
];

// Module-level component — Muuvlink içinde OLMAMALI.
// Muuvlink her 55ms'de re-render ederdi (typewriter state),
// bu da AuthModal gibi nested component'lerin unmount/remount olmasına
// ve form alanlarının sıfırlanmasına yol açıyordu.
const Typewriter = React.memo(({ mottos }) => {
  const [idx, setIdx]       = useState(0);
  const [text, setText]     = useState("");

  useEffect(() => {
    const target = mottos[idx % mottos.length];
    let pos = 0, deleting = false, timer;
    const tick = () => {
      if (!deleting) {
        pos++;
        setText(target.slice(0, pos));
        if (pos < target.length) { timer = setTimeout(tick, 55); }
        else { timer = setTimeout(() => { deleting = true; tick(); }, 1400); }
      } else {
        pos--;
        setText(target.slice(0, pos));
        if (pos > 0) { timer = setTimeout(tick, 38); }
        else { timer = setTimeout(() => setIdx(p => (p + 1) % mottos.length), 220); }
      }
    };
    setText("");
    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <span style={{
        background:"linear-gradient(90deg,#38BDF8 0%,#4ADE80 45%,#C084FC 85%)",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
      }}>{text}</span>
      <span style={{
        display:"inline-block", width:"3px", height:"0.75em",
        marginLeft:"3px", marginBottom:"1px", verticalAlign:"middle",
        background:"linear-gradient(180deg,#38BDF8,#4ADE80)",
        borderRadius:"2px", animation:"blink 1s step-end infinite",
      }}/>
    </>
  );
});

// Module-level — uncontrolled inputs ile focus sorunu tamamen çözülür
const AuthModal = ({ authMode, setAuthMode, onClose, handleLogin, handleRegister }) => {
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef  = useRef();
  const emailRef = useRef();
  const passRef  = useRef();

  // authMode değişince error/success temizle
  useEffect(() => { setError(""); setSuccess(""); }, [authMode]);

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
      await handleRegister(name, email, password, setError);
    } else if (authMode === "forgot") {
      try {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          setSuccess("Şifre sıfırlama linki e-postana gönderildi. Spam kutusunu da kontrol et.");
        } else {
          const d = await res.json();
          setError(d.error || "Bir hata oluştu.");
        }
      } catch {
        setError("Sunucuya bağlanılamadı.");
      }
    }
    setLoading(false);
  };

  const titles = { login: "Giriş Yap", register: "Kaydol", forgot: "Şifremi Unuttum" };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 relative m-4">
        <button onClick={onClose} className="absolute top-4 right-4">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-medium mb-2 text-center">{titles[authMode]}</h2>
        {authMode === "forgot" && (
          <p className="text-slate-500 text-sm text-center mb-5">E-postanı gir, sıfırlama linki gönderelim.</p>
        )}
        {authMode !== "forgot" && <div className="mb-6"/>}

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === "register" && (
            <input ref={nameRef} type="text" placeholder="Ad Soyad"
              className="w-full px-4 py-3 border rounded-xl" required/>
          )}
          <input ref={emailRef} type="email" placeholder="E-posta"
            className={`w-full px-4 py-3 border rounded-xl ${error ? "border-red-300" : ""}`} required/>
          {authMode !== "forgot" && (
            <input ref={passRef} type="password" placeholder="Şifre"
              className={`w-full px-4 py-3 border rounded-xl ${error ? "border-red-300" : ""}`} required/>
          )}
          {authMode === "login" && (
            <div className="text-right -mt-1">
              <button type="button" onClick={() => setAuthMode("forgot")}
                className="text-sm text-green-600 hover:underline">
                Şifremi unuttum
              </button>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {authMode === "login" ? "Giriş Yap" : authMode === "register" ? "Kaydol" : "Link Gönder"}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2">
          {authMode !== "login" && (
            <button onClick={() => setAuthMode("login")}
              className="text-green-600 text-sm hover:underline">
              ← Giriş yap
            </button>
          )}
          {authMode === "login" && (
            <button onClick={() => setAuthMode("register")}
              className="text-green-600">
              Hesabın yok mu? Kaydol
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Haber kartı ────────────────────────────────────────────
function NewsSection({ items }) {
  const [lightbox, setLightbox] = useState(null);
  if (!items || items.length === 0) return null;
  return (
    <section style={{background:"#f2f2f2"}} className="pt-16 pb-20">
      <div className="text-center mb-10 px-4">
        <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 tracking-widest uppercase mb-3">
          Takım Etkinlikleri
        </h2>
        <p className="text-slate-400 font-light italic text-base">Muuvlink topluluğundan etkinlik haberleri</p>
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
              {item.date_label && <p className="text-white/50 text-xs font-light">Yayın {item.date_label}</p>}
            </div>
          </article>
        ))}
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
                <p className="text-xs text-slate-400 mb-3">Yayın {lightbox.date_label}</p>
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
function GallerySection({ items }) {
  const [lightbox, setLightbox] = useState(null);
  if (!items || items.length === 0) return null;
  const total = items.length;
  return (
    <section className="bg-white pt-16 pb-0">
      <div className="text-center mb-10 px-4">
        <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 tracking-widest uppercase mb-3">Galeri</h2>
        <p className="text-slate-400 font-light italic text-base mb-6">Muuvlink etkinliklerinden kareler</p>
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
function HeroSection({ banners, bannersLoaded, user, setCurrentPage, setAuthMode, setIsAuthModalOpen, platformStats, stats, fmtNum }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef(null);

  const startTimer = (len) => {
    clearInterval(timerRef.current);
    if (len <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % len);
    }, 5500);
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
      setCurrentPage(url.replace(/^\//, "") || "home");
    }
  };

  if (!bannersLoaded || banners.length === 0) return null;

  const activeBanner = banners[activeIdx];
  const gFrom = activeBanner?.gradient_from || "#052e16";
  const gVia  = activeBanner?.gradient_via  || "#14532d";
  const gTo   = activeBanner?.gradient_to   || "#166534";

  return (
    <div className="relative" style={{
      background: `linear-gradient(115deg, ${gFrom} 0%, ${gVia} 45%, ${gTo} 100%)`,
      transition: "background 1s ease",
    }}>
      {/* Arka plan dekorları */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-32 top-1/4 w-[600px] h-[600px] rounded-full"
          style={{background:"radial-gradient(circle,rgba(22,163,74,0.18) 0%,transparent 65%)"}}/>
        <div className="absolute right-[-60px] top-[-40px] w-[700px] h-[700px] rounded-full"
          style={{background:"radial-gradient(circle,rgba(74,222,128,0.1) 0%,transparent 60%)"}}/>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{backgroundImage:"linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)", backgroundSize:"64px 64px"}}/>
      </div>

      {/* Banner katmanları — cross-fade */}
      <div className="relative" style={{minHeight:"680px"}}>
        {banners.map((banner, i) => {
          const isActive = i === activeIdx;
          const bgF = banner?.gradient_from || "#052e16";
          const hasImg = banner?.image_url && banner.image_url !== "";
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
                        style={{background:"rgba(255,255,255,0.06)",borderColor:"rgba(255,255,255,0.12)",color:"rgba(186,230,253,0.9)"}}>
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{background:"#4ADE80"}}/>
                        {banner.badge_text}
                      </div>
                    )}

                    <div>
                      <h1 className="bn-title text-white" style={{fontSize:"clamp(2.8rem,5.5vw,4.5rem)", lineHeight:1.1, fontWeight:600}}>
                        {banner?.title || "Sporla Buluş,"}
                      </h1>
                      <h1 className="bn-title" style={{fontSize:"clamp(2.8rem,5.5vw,4.5rem)", lineHeight:1.15, fontWeight:600, minHeight:"1.2em", whiteSpace:"nowrap", overflow:"hidden"}}>
                        {isActive
                          ? <Typewriter mottos={(banner?.mottos?.length > 0) ? banner.mottos : DEFAULT_MOTTOS}/>
                          : <span style={{color:"rgba(134,239,172,0.6)"}}>&nbsp;</span>
                        }
                      </h1>
                      <p className="mt-5 text-lg leading-relaxed max-w-md font-light" style={{color:"rgba(186,230,253,0.75)"}}>
                        {banner?.subtitle || "Çevrende spor yapan insanları bul, kendi takımını kur, antrenmanlar planla. GPS ile en yakın etkinlikleri saniyeler içinde keşfet."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {!user ? (
                        <>
                          <button
                            onClick={() => handleCtaClick(banner?.cta_primary_url, () => { setAuthMode("register"); setIsAuthModalOpen(true); })}
                            className="group relative flex items-center gap-2.5 px-7 py-3.5 font-medium text-white text-sm overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
                            style={{background:"linear-gradient(135deg,#16A34A,#15803D)", borderRadius:"14px", boxShadow:"0 8px 32px rgba(22,163,74,0.4)"}}
                          >
                            <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[14px]"/>
                            {banner?.cta_primary_text || "Hemen Başla"}
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                          </button>
                          <button
                            onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); }}
                            className="flex items-center gap-2 px-7 py-3.5 font-semibold text-sm transition-all duration-300 hover:bg-white/10 rounded-[14px]"
                            style={{color:"rgba(186,230,253,0.85)", border:"1px solid rgba(255,255,255,0.14)"}}
                          >
                            Giriş Yap
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCtaClick(banner?.cta_primary_url, () => setCurrentPage("trainings"))}
                            className="group relative flex items-center gap-2.5 px-7 py-3.5 font-medium text-white text-sm overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
                            style={{background:"linear-gradient(135deg,#16A34A,#15803D)", borderRadius:"14px", boxShadow:"0 8px 32px rgba(22,163,74,0.4)"}}
                          >
                            <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[14px]"/>
                            {banner?.cta_primary_text || "Antrenmanlar"}
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                          </button>
                          {banner?.cta_secondary_text && (
                            <button
                              onClick={() => handleCtaClick(banner?.cta_secondary_url, () => setCurrentPage("teams"))}
                              className="flex items-center gap-2 px-7 py-3.5 font-semibold text-sm transition-all duration-300 hover:bg-white/10 rounded-[14px]"
                              style={{color:"rgba(186,230,253,0.85)", border:"1px solid rgba(255,255,255,0.14)"}}
                            >
                              {banner.cta_secondary_text}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    <div className="bn-stats flex items-center gap-6 pt-2">
                      {stats.slice(0,2).map((s,si) => (
                        <div key={si}>
                          <div className={`text-xl font-semibold ${s.color}`}>{s.value}</div>
                          <div className="text-xs" style={{color:"rgba(186,230,253,0.5)"}}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sağ: görsel */}
                  <div className="bn-img-col relative">
                    <div className="absolute inset-0 flex items-end justify-center" style={{overflow:"visible"}}>
                      {hasImg && (
                        <>
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-3xl pointer-events-none"
                            style={{background:"radial-gradient(ellipse,rgba(74,222,128,0.2) 0%,rgba(22,163,74,0.1) 55%,transparent 70%)"}}/>
                          <div className="relative z-10" style={{animation:"heroFloat 5s ease-in-out infinite", marginBottom:"-100px"}}>
                            <img
                              src={`${BASE_URL}${banner.image_url}`}
                              alt=""
                              className="w-auto select-none pointer-events-none"
                              style={{height:"700px", maxWidth:"none", objectFit:"contain", objectPosition:"bottom center", filter:"drop-shadow(0 8px 24px rgba(0,0,0,0.18))"}}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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
            <button key={i} onClick={() => goTo(i)} style={{
              height:"3px",
              width: i === activeIdx ? "32px" : "16px",
              borderRadius:"2px", border:"none", cursor:"pointer", padding:0,
              background: i === activeIdx ? "linear-gradient(90deg,#4ADE80,#16A34A)" : "rgba(255,255,255,0.3)",
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
          .bn-nav      { display:flex !important; }
          .bn-title    { white-space:normal !important; font-size:clamp(2rem,9vw,2.8rem) !important; }
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

  const PAGE_META = {
    home:              { title:"Muuvlink — Spor Arkadaşı Bul, Takım Kur",        desc:"Çevrende spor yapan insanları bul, kendi takımını kur, antrenmanlar planla. GPS ile en yakın etkinlikleri saniyeler içinde keşfet." },
    trainings:         { title:"Antrenmanlar — Muuvlink",                          desc:"Yakınındaki spor antrenmanlarını bul ve katıl. Koşu, bisiklet, yüzme, futbol ve daha fazlası seni bekliyor." },
    teams:             { title:"Takımlar — Muuvlink",                              desc:"Spor takımlarını keşfet veya kendi takımını kur. Takım arkadaşı bul, birlikte daha güçlü ol." },
    contact:           { title:"İletişim — Muuvlink",                              desc:"Muuvlink ekibiyle iletişime geç. Sorularını sor, geri bildirim ver." },
    profile:           { title:"Profilim — Muuvlink",                              desc:"Muuvlink profil sayfan." },
    "create-training": { title:"Antrenman Oluştur — Muuvlink",                    desc:"Yeni bir antrenman oluştur, konum ve zaman ayarla, sporcuları davet et." },
    "create-team":     { title:"Takım Kur — Muuvlink",                             desc:"Kendi spor takımını kur ve üyeleri davet et." },
    badges:            { title:"Rozetlerim — Muuvlink",                            desc:"Kazandığın spor rozetlerini görüntüle." },
  };

  const [currentPage, setCurrentPage] = useState(() => PATH_TO_PAGE[window.location.pathname] || "home");
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [trainings, setTrainings] = useState([]);
  const [teams, setTeams] = useState([]);
  const [myTrainings, setMyTrainings] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [badges, setBadges] = useState([]);
  const [userBadges, setUserBadges] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [activityData, setActivityData] = useState([]);
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
    const letter = name?.[0]?.toUpperCase() ?? "?";
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
              Vazgeç
            </button>
            <div className="w-px bg-slate-100"/>
            <button
              onClick={() => { close(); onConfirm(); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${danger ? "text-red-600 hover:bg-red-50" : "text-green-700 hover:bg-green-50"}`}
            >
              Evet, devam et
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
          { headers: { "Accept-Language": "tr" } }
        );
        const data = await res.json();
        if (data.length === 0) showError("Sonuç bulunamadı. Farklı bir adres dene.");
        setResults(data);
      } catch {
        showError("Arama başarısız. İnternet bağlantını kontrol et.");
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
          { headers: { "Accept-Language": "tr" } }
        );
        const data = await res.json();
        const name = data.display_name?.split(",").slice(0, 3).join(", ") || locationName;
        onLocationName(name);
      } catch { /* konum adı doldurulamazsa mevcut kalır */ }
    };

    const useMyLocation = () => {
      if (!navigator.geolocation) {
        showError("Bu tarayıcı konum özelliğini desteklemiyor. Lütfen adres arama kutusunu kullan.");
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
            showError("Konum izni reddedildi. Tarayıcı adres çubuğundaki kilit ikonuna tıklayıp 'Konum → İzin Ver' seç, sonra sayfayı yenile.");
          } else {
            showError("GPS konumu alınamadı. Lütfen yukarıdaki adres arama kutusunu kullanarak konumunu gir.");
          }
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    };

    return (
      <div className="space-y-3">
        {/* Adres arama */}
        <div>
          <label className="block text-sm font-medium mb-1">Konum Ara</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchAddress())}
              placeholder="Örn: Kadıköy Sahil, İstanbul"
              className="flex-1 px-4 py-2 border rounded-xl text-sm"
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={searching}
              className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60 flex items-center gap-1"
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
                  className="w-full text-left px-4 py-3 hover:bg-green-50 text-sm border-b last:border-0 flex items-start gap-2"
                >
                  <MapPin className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Benim konumum butonu */}
        <button
          type="button"
          onClick={useMyLocation}
          disabled={gettingGPS}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 disabled:opacity-60"
        >
          {gettingGPS
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Navigation2 className="w-4 h-4" />}
          Bulunduğum Konumu Kullan
        </button>

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
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm">
            <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-green-800 truncate">{locationName || "Seçili konum"}</div>
              <div className="text-green-600 text-xs">{Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</div>
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
          <label className="block text-sm font-medium mb-1">Konum Adı <span className="text-gray-400 font-normal">(kartlarda görünür)</span></label>
          <input
            type="text"
            value={locationName}
            onChange={(e) => onLocationName(e.target.value)}
            placeholder="Örn: Kordon Boyu, Alsancak"
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
    { icon: Users,    label: "Kayıtlı Sporcu",       value: fmtNum(platformStats?.users),     color: "text-green-400" },
    { icon: Activity, label: "Toplam Antrenman",      value: fmtNum(platformStats?.trainings), color: "text-cyan-400" },
    { icon: Target,   label: "Aktif Takım",           value: fmtNum(platformStats?.teams),     color: "text-emerald-400" },
    { icon: Award,    label: "Kazanılan Rozet",       value: fmtNum(platformStats?.badges),    color: "text-amber-400" },
  ];

  const features = [
    {
      icon: MapPin,
      title: "Yakınındaki Etkinlikler",
      description: "GPS teknolojisiyle çevrenizdeki antrenmanları anında keşfedin, konuma göre filtreleyin.",
      color: "from-violet-500 to-purple-600",
      bg: "bg-green-50",
      num: "01",
    },
    {
      icon: Users,
      title: "Takım Oluştur",
      description: "Kendi takımını kur, üye davet et, gizlilik ayarlarını belirle ve birlikte antrenman yap.",
      color: "from-indigo-500 to-blue-600",
      bg: "bg-green-50",
      num: "02",
    },
    {
      icon: Calendar,
      title: "Etkinlik Planla",
      description: "Antrenmanlarını planla, kapasite belirle, katılımcılara otomatik bildirim gönder.",
      color: "from-cyan-500 to-teal-600",
      bg: "bg-cyan-50",
      num: "03",
    },
    {
      icon: Award,
      title: "Rozetler Kazan",
      description: "Hedeflere ulaş, özel rozetler kazan, sporcu profilini zenginleştir.",
      color: "from-amber-500 to-orange-500",
      bg: "bg-amber-50",
      num: "04",
    },
    {
      icon: TrendingUp,
      title: "İlerlemeyi Takip Et",
      description: "Haftalık aktivite grafikleri ve istatistiklerle gelişimini analiz et.",
      color: "from-emerald-500 to-green-600",
      bg: "bg-emerald-50",
      num: "05",
    },
    {
      icon: Heart,
      title: "Topluluk Desteği",
      description: "Takım duvarında mesajlaş, birbirini motive et, spor kültürünü büyüt.",
      color: "from-rose-500 to-pink-600",
      bg: "bg-rose-50",
      num: "06",
    },
  ];

  const sportTypes = [
    "Koşu",
    "Bisiklet",
    "Yüzme",
    "Yoga",
    "Pilates",
    "Futbol",
    "Basketbol",
    "Voleybol",
    "Tenis",
    "Triatlon",
    "Padel",
    "Kürek",
    "Kano",
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserData(token);
    }
    fetchTrainings();
    fetchTeams();
    fetchBadges();

    // Sessizce GPS al — km gösterimi için (hata vermez, zorunlu değil)
    const savedLoc = localStorage.getItem("userLocation");
    if (savedLoc) {
      try { setUserLocation(JSON.parse(savedLoc)); } catch (_) {}
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          localStorage.setItem("userLocation", JSON.stringify(loc));
        },
        () => {} // sessiz hata
      );
    }

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
            showToast("Takıma başarıyla katıldınız! 👥", "success");
            fetchTeamDetails(acceptInvite);
          } else {
            showToast(data.error || "Davet bulunamadı.", "error");
          }
        }).catch(() => showToast("Bir hata oluştu.", "error"));
      } else {
        // Giriş yapılmamış — login modalı aç, sonra tekrar dene
        localStorage.setItem("pendingInvite", acceptInvite);
        setAuthMode("login");
        setIsAuthModalOpen(true);
        showToast("Daveti kabul etmek için giriş yapın.", "info");
      }
    }
  }, []);

  // Real-time bildirimler: SSE bağlantısı
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const es = new EventSource(`${API_URL}/notifications/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === "notification" && msg.data) {
          setNotifications(prev => [msg.data, ...prev]);
          showToast(`🔔 ${msg.data.title}`, "info");
        }
      } catch {}
    };
    return () => es.close();
  }, [user?.id]);

  // Sayfa değişince URL + title + meta güncelle
  useEffect(() => {
    const meta  = PAGE_META[currentPage];
    const path  = PAGE_TO_PATH[currentPage];
    const title = meta?.title || "Muuvlink";
    const desc  = meta?.desc  || "Spor arkadaşı bul, antrenman planla, takım kur.";
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
      const page = PATH_TO_PAGE[window.location.pathname] || "home";
      setCurrentPage(page);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);



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
            if (d.message) { showToast("Takıma başarıyla katıldınız! 👥", "success"); fetchTeamDetails(pendingInvite); }
          });
        }
      } else {
        const msg = data.error || "Giriş başarısız!";
        if (setError) setError(
          msg === "Invalid credentials"
            ? "E-posta veya şifre hatalı."
            : msg
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      if (setError) setError("Sunucuya bağlanılamadı. Backend çalışıyor mu?");
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
        const msg = data.error || "Kayıt başarısız!";
        if (setError) setError(
          msg.includes("duplicate") || msg.includes("unique")
            ? "Bu e-posta zaten kayıtlı."
            : msg
        );
      }
    } catch (error) {
      console.error("Register error:", error);
      if (setError) setError("Sunucuya bağlanılamadı. Backend çalışıyor mu?");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setMyTrainings([]);
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
        showToast("Profil güncellendi! ✅", "success");
      }
    } catch (error) {
      console.error("Update profile error:", error);
    }
  };

  const fetchTrainings = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/trainings`, { headers });
      if (response.ok) {
        const data = await response.json();
        setTrainings(data.trainings || []);
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
        { headers }
      );
      if (response.ok) {
        const data = await response.json();
        setNearbyTrainings(data.trainings || []);
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

    if (!navigator.geolocation) {
      setLocationLoading(false);
      setShowManualLocation(true);
      setCurrentPage("trainings");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyNearbyLocation(position.coords.latitude, position.coords.longitude, "Mevcut Konumum", distanceOverride);
      },
      () => {
        // GPS çalışmıyor → adres arama modunu göster
        setLocationLoading(false);
        setShowManualLocation(true);
        setCurrentPage("trainings");
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const fetchMyTrainings = async (token) => {
    try {
      const response = await fetch(`${API_URL}/trainings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMyTrainings(data.trainings || []);
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
        showToast("Antrenman'a katıldın! 🎉", "success");
        fetchTrainings();
        fetchMyTrainings(token);
        if (selectedTraining?.id === trainingId) {
          fetchTrainingDetails(trainingId);
        }
      } else {
        const data = await response.json();
        showToast(data.error || "Katılım başarısız!", "error");
      }
    } catch (error) {
      console.error("Join training error:", error);
      showToast("Bağlantı hatası!", "error");
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
        showToast("Antrenman kaydın silindi.", "success");
        fetchTrainings();
        fetchMyTrainings(token);
        if (selectedTraining?.id === trainingId) {
          fetchTrainingDetails(trainingId);
        }
      } else {
        const data = await response.json();
        showToast(data.error || "Ayrılma başarısız!", "error");
      }
    } catch (error) {
      console.error("Leave training error:", error);
      showToast("Bağlantı hatası!", "error");
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
        showToast("Antrenman oluşturuldu! 🏋️", "success");
        setCurrentPage("profile");
        fetchTrainings();
        fetchMyTrainings(token);
      } else {
        const data = await response.json();
        showToast(data.error || "Oluşturulamadı!", "error");
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
        showToast("Antrenman güncellendi! ✅", "success");
        fetchTrainingDetails(trainingId);
        fetchTrainings();
        fetchMyTrainings(token);
      } else {
        const data = await response.json();
        showToast(data.error || "Güncellenemedi!", "error");
      }
    } catch (error) {
      console.error("Update training error:", error);
    }
  };

  const handleDeleteTraining = (trainingId) => {
    showConfirm("Antrenmanı silmek istediğinize emin misiniz?", async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/trainings/${trainingId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          showToast("Antrenman silindi.", "info");
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
        showToast("Takım güncellendi! ✅", "success");
        fetchTeamDetails(teamId);
        fetchTeams();
        fetchMyTeams(token);
      } else {
        const data = await response.json();
        showToast(data.error || "Güncellenemedi!", "error");
      }
    } catch { showToast("Bağlantı hatası!", "error"); }
  };

  const handleDeleteTeam = (teamId) => {
    showConfirm("Takımı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!", async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/teams/${teamId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          showToast("Takım silindi.", "info");
          setCurrentPage("teams");
          fetchTeams();
          fetchMyTeams(token);
        } else {
          const data = await response.json();
          showToast(data.error || "Silinemedi!", "error");
        }
      } catch { showToast("Bağlantı hatası!", "error"); }
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
        showToast("Rol güncellendi! ✅", "success");
        fetchTeamDetails(teamId);
      } else {
        const data = await response.json();
        showToast(data.error || "Rol güncellenemedi!", "error");
      }
    } catch { showToast("Bağlantı hatası!", "error"); }
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
        showToast("🔒 Bu gizli bir takım. Erişmek için davet edilmeniz gerekiyor.", "info");
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
    showConfirm("Daveti iptal etmek istediğinize emin misiniz?", async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/teams/${teamId}/invitations/${inviteId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setPendingInvitations(prev => prev.filter(i => i.id !== inviteId));
          showToast("Davet iptal edildi.", "info");
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
        showToast("Takıma katıldın! 👥", "success");
        fetchTeams();
        fetchMyTeams(token);
        if (selectedTeam?.id === teamId) {
          fetchTeamDetails(teamId);
        }
      } else {
        const data = await response.json();
        showToast(data.error || "Katılım başarısız!", "error");
      }
    } catch (error) {
      console.error("Join team error:", error);
      showToast("Bağlantı hatası!", "error");
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
        showToast("Takım oluşturuldu! 🏆", "success");
        setCurrentPage("profile");
        fetchTeams();
        fetchMyTeams(token);
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
        showToast(data.error || "Davet gönderilemedi.", "error");
        return;
      }

      if (data.is_registered) {
        showToast("Davet gönderildi! 📧 Kullanıcıya bildirim ve e-posta iletildi.", "success");
      } else {
        showToast("Davet gönderildi! 📧 Kullanıcı kayıtlı değil — kayıt daveti e-postası gönderildi.", "info");
      }
      setShowInviteModal(false);
      fetchPendingInvitations(teamId);
    } catch (error) {
      console.error("Invite error:", error);
      showToast("Bir hata oluştu.", "error");
    }
  };

  const handleRemoveMember = (teamId, userId) => {
    showConfirm("Üyeyi takımdan çıkarmak istediğinize emin misiniz?", async () => {
      try {
        const token = localStorage.getItem("token");
        await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("Üye çıkarıldı.", "info");
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
        showToast(data.error || "Gönderi paylaşılamadı.", "error");
        return;
      }

      // Takım detayını yenileyerek yeni gönderiyi göster
      fetchTeamDetails(teamId);
      showToast("Gönderi paylaşıldı! Üyelere bildirim gönderildi. 📬", "success");
    } catch (error) {
      console.error("Add post error:", error);
      showToast("Bir hata oluştu.", "error");
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
        setActivityData(data.activity);
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
        num:"01", icon: MapPin, accent:"#16A34A",
        bg:"linear-gradient(135deg,#f0fdf4 0%,#dcfce7 50%,#bbf7d0 100%)",
        sub:"GPS Destekli Arama",
        title:"Yakınındaki Etkinlikleri Bul",
        desc:"Konumunu paylaş, çevrenizdeki antrenmanları saniyeler içinde keşfet. Mesafe filtresiyle en uygun etkinliği bul.",
        points:["5–50 km aralığında filtreleme","Harita üzerinde görüntüleme","Anlık bildirimler"],
      },
      {
        num:"02", icon: Users, accent:"#15803D",
        bg:"linear-gradient(135deg,#dcfce7 0%,#bbf7d0 50%,#86efac 100%)",
        sub:"Takım Yönetimi",
        title:"Kendi Takımını Kur ve Yönet",
        desc:"Spor takımını oluştur, antrenör ekle, üye davet et. Tüm takvimi ve iletişimi tek platformdan yönet.",
        points:["Sınırsız üye kapasitesi","Rol tabanlı yönetim (Sahip / Antrenör / Üye)","Antrenman takvimi & duyurular"],
      },
      {
        num:"03", icon: Trophy, accent:"#166534",
        bg:"linear-gradient(135deg,#bbf7d0 0%,#86efac 50%,#4ade80 100%)",
        sub:"Başarı Sistemi",
        title:"Rozetler Kazan, İlerlemeni Göster",
        desc:"Her antrenmanla yeni başarılar aç. İstatistikler ve rozetlerinle sporcu profilini zenginleştir.",
        points:["20+ farklı başarı rozeti","Haftalık aktivite grafikleri","Topluluk liderlik tablosu"],
      },
    ];

    return (
      <div className="bg-white overflow-hidden">
        {/* Section header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-20 pb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <span className="text-xs font-semibold tracking-[0.35em] text-green-500 uppercase block mb-3">Platform</span>
              <h2 className="text-5xl md:text-7xl font-semibold text-slate-900 tracking-tighter leading-[0.92]">
                Neden<br/>
                <span style={{WebkitTextStroke:"2px #16A34A", color:"transparent"}}>Muuvlink?</span>
              </h2>
            </div>
            <p className="md:max-w-xs text-slate-400 text-sm leading-relaxed md:pb-2">
              Spor yapmayı seven insanları bir araya getiren, akıllı ve sosyal spor platformu.
            </p>
          </div>
        </div>

        {/* Alternating editorial rows */}
        {editorialFeatures.map((f, i) => (
          <div key={i} className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} border-t border-slate-100`} style={{minHeight:"340px"}}>
            {/* Color panel */}
            <div className="md:w-5/12 relative flex items-center justify-center py-14 px-10 overflow-hidden flex-shrink-0" style={{background: f.bg}}>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
                style={{fontSize:"clamp(120px,18vw,220px)", fontWeight:600, color:"rgba(21,128,61,0.08)", lineHeight:1, letterSpacing:"-0.05em"}}>
                {f.num}
              </div>
              <div className="absolute inset-0 opacity-[0.04]"
                style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"40px 40px"}}/>
              <div className="relative z-10 text-center">
                <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                  style={{background:`${f.accent}18`, border:`1.5px solid ${f.accent}35`}}>
                  <f.icon className="w-10 h-10" style={{color: f.accent}}/>
                </div>
                <div className="text-7xl font-semibold leading-none" style={{color: f.accent, letterSpacing:"-0.04em", opacity:0.9}}>{f.num}</div>
              </div>
            </div>
            {/* Text panel */}
            <div className="md:w-7/12 flex items-center px-8 md:px-14 py-12 bg-white">
              <div className="max-w-lg">
                <div className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase mb-4">{f.sub}</div>
                <h3 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-4 tracking-tight leading-tight">{f.title}</h3>
                <p className="text-slate-500 text-base leading-relaxed mb-7">{f.desc}</p>
                <ul className="space-y-3">
                  {f.points.map((p, j) => (
                    <li key={j} className="flex items-center gap-3 text-slate-700 font-semibold text-sm">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{background:`${f.accent}20`}}>
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
  const monthNames = ["OCA","ŞUB","MAR","NİS","MAY","HAZ","TEM","AĞU","EYL","EKİ","KAS","ARA"];
  const month = monthNames[dateObj.getUTCMonth()];

  const difficultyColor = { "Kolay": "#6ee7b7", "Orta": "#fcd34d", "Zor": "#fca5a5" };
  const accentColor = difficultyColor[training.difficulty] || "#6ee7b7";

  return (
    <div
      onClick={() => onClick(training.id)}
      className="group flex items-stretch gap-0 bg-white border-b border-dashed border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors duration-200 py-6 px-2"
    >
      {/* Sol: Takvim tarihi */}
      <div className="flex flex-col items-center justify-center w-20 flex-shrink-0 pr-5">
        <span className="text-5xl font-bold leading-none" style={{color: accentColor, fontVariantNumeric:"tabular-nums"}}>{day}</span>
        <span className="text-[10px] font-bold tracking-[0.2em] mt-1.5 text-slate-400 uppercase">{month}</span>
      </div>

      {/* Dikey ayraç */}
      <div className="w-px bg-slate-200 self-stretch flex-shrink-0"/>

      {/* Sağ: İçerik */}
      <div className="flex-1 pl-5 flex flex-col justify-center gap-1 min-w-0">
        <h3 className="text-base font-bold text-slate-900 group-hover:text-green-700 transition-colors line-clamp-1 leading-snug">
          {training.title}
        </h3>
        <p className="text-sm text-slate-400 italic">
          {training.training_time && <span>{training.training_time}</span>}
          {training.training_time && (training.team_name || training.location_name) && <span className="mx-2">·</span>}
          {training.team_name && <span className="not-italic font-medium text-green-700">{training.team_name}</span>}
          {training.team_name && training.location_name && <span className="mx-2">-</span>}
          {training.location_name && <span>{training.location_name}</span>}
        </p>
        {distanceKm != null && (
          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <Navigation2 className="w-3 h-3"/>
            {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m uzakta` : `${distanceKm.toFixed(1)} km uzakta`}
          </p>
        )}
      </div>

      {/* Sağ ok */}
      <div className="flex items-center pl-4 flex-shrink-0">
        <svg className="w-4 h-4 text-slate-300 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
      </div>
    </div>
  );
};

  const TeamCard = ({ team, onClick }) => (
    <div
      onClick={() => onClick(team.id)}
      className="group bg-white rounded-2xl border border-slate-100 hover:border-green-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Dekoratif üst şerit */}
      <div className="h-1.5 w-full" style={{background:"linear-gradient(90deg,#16A34A,#15803D,#06B6D4)"}}/>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
              style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}>
              {(team.avatar?.startsWith("/uploads/") || team.avatar?.startsWith("http"))
                ? <img src={team.avatar.startsWith("http") ? team.avatar : `${BASE_URL}${team.avatar}`} alt="" className="w-full h-full object-cover" />
                : (team.name?.[0]?.toUpperCase() || "T")}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 truncate group-hover:text-green-700 transition-colors">{team.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-md text-xs font-semibold">{team.sport}</span>
                {team.location && <span className="text-slate-400 text-xs truncate">📍 {team.location}</span>}
              </div>
            </div>
          </div>
          {team.is_private && (
            <span className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium">
              <Lock className="w-3 h-3"/> Gizli
            </span>
          )}
        </div>

        <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-4">
          {team.description || (team.is_private ? "Bu takım gizlidir." : "Açıklama eklenmemiş.")}
        </p>

        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <Users className="w-4 h-4"/>
            <span className="font-semibold text-slate-700">{team.member_count || 0}</span>
            <span>üye</span>
          </div>
          {team.my_role && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-lg" style={{
              background: team.my_role === 'owner' ? '#FEF3C7' : team.my_role === 'coach' ? '#EDE9FE' : team.my_role === 'captain' ? '#DCFCE7' : '#F0FDF4',
              color: team.my_role === 'owner' ? '#92400E' : team.my_role === 'coach' ? '#5B21B6' : team.my_role === 'captain' ? '#166534' : '#166534',
            }}>
              {team.my_role === 'owner' ? '🏆 Sahip' : team.my_role === 'coach' ? '🎯 Antrenör' : team.my_role === 'captain' ? '⚓ Kaptan' : '👤 Üye'}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const BadgeCard = ({ badge, earned }) => (
    <div className={`relative rounded-2xl p-5 border transition-all duration-300 overflow-hidden ${
      earned
        ? "border-amber-300/60 hover:border-amber-400 hover:shadow-lg hover:-translate-y-0.5"
        : "border-slate-100 opacity-60"
    }`}
    style={earned
      ? {background:"linear-gradient(135deg,#fffbeb,#fef3c7)"}
      : {background:"#f8fafc"}}>
      {earned && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
          style={{background:"linear-gradient(135deg,#F59E0B,#FBBF24)"}}>
          <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 20 20">
            <path d="M10 1l2.39 5.26L18 7.27l-4 4.14.94 5.59L10 14.27l-4.94 2.73L6 11.41 2 7.27l5.61-.99z"/>
          </svg>
        </div>
      )}
      <div className="text-center">
        <div className={`text-5xl mb-3 leading-none ${earned ? "" : "grayscale opacity-40"}`}>{badge.icon}</div>
        <h3 className={`font-semibold text-sm mb-1 ${earned ? "text-amber-900" : "text-slate-400"}`}>{badge.name}</h3>
        <p className={`text-xs leading-relaxed ${earned ? "text-amber-700/70" : "text-slate-400"}`}>{badge.description}</p>
        {earned && badge.earned_at && (
          <div className="mt-2.5 text-[10px] font-medium text-amber-500/70 uppercase tracking-wider">
            {new Date(badge.earned_at).toLocaleDateString("tr-TR")}
          </div>
        )}
      </div>
    </div>
  );

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
      />
      <FeaturesSection />

      {/* ── GPS SEARCH + UPCOMING TRAININGS — yan yana ── */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col lg:flex-row gap-12">

            {/* Sol: GPS arama */}
            <div className="lg:w-72 flex-shrink-0">
              <span className="text-xs font-semibold tracking-[0.3em] text-green-500 uppercase block mb-3">GPS Arama</span>
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight leading-snug mb-3">
                Yakınındaki<br/>Antrenmanları Bul
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Konumunu paylaş, çevrenizdeki etkinlikleri saniyeler içinde keşfet.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[5, 10, 25, 50].map((km) => (
                  <button
                    key={km}
                    onClick={() => setNearbyDistance(km)}
                    className="px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200"
                    style={nearbyDistance === km
                      ? {background:"linear-gradient(135deg,#16A34A,#15803D)", color:"#fff", boxShadow:"0 4px 20px rgba(22,163,74,0.35)"}
                      : {background:"#f0fdf4", color:"#15803D", border:"1px solid #bbf7d0"}}
                  >
                    {km} km
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleNearbySearch()}
                disabled={locationLoading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white text-sm transition-all duration-300 hover:opacity-90 hover:scale-105 disabled:opacity-50 disabled:scale-100"
                style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 6px 24px rgba(22,163,74,0.3)"}}
              >
                {locationLoading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Konum alınıyor…</>
                  : <><MapPin className="w-4 h-4"/> Yakınımda Ara</>}
              </button>
            </div>

            {/* Dikey ayraç */}
            <div className="hidden lg:block w-px bg-slate-100 self-stretch"/>

            {/* Sağ: Antrenman listesi */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold tracking-[0.3em] text-green-500 uppercase block mb-3">Keşfet</span>
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight leading-snug">
                    Yaklaşan Antrenmanlar
                  </h2>
                </div>
                <button
                  onClick={() => setCurrentPage("trainings")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:shadow-md flex-shrink-0"
                  style={{background:"linear-gradient(135deg,#16A34A,#15803D)", color:"#fff"}}
                >
                  Tümünü Gör
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
                  <p className="text-slate-500 font-medium mb-1">Antrenman bulunamadı</p>
                  <p className="text-slate-400 text-sm mb-4">Sunucu bağlantısı kontrol ediliyor…</p>
                  <button onClick={fetchTrainings} className="px-5 py-2.5 rounded-xl text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 transition-colors">
                    Tekrar Dene
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <NewsSection items={homeNews} />
      <GallerySection items={homeGallery} />

      {/* ── CTA — Full Bleed Cinematic ── */}
      {!user && (
        <div className="relative overflow-hidden py-28" style={{background:"linear-gradient(135deg,#052e16 0%,#14532d 40%,#166534 70%,#15803d 100%)"}}>
          {/* grid */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
            style={{backgroundImage:"linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)", backgroundSize:"60px 60px"}}/>
          {/* glow orbs */}
          <div className="absolute -left-32 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{background:"radial-gradient(circle,rgba(74,222,128,0.18) 0%,transparent 65%)"}}/>
          <div className="absolute -right-32 top-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{background:"radial-gradient(circle,rgba(134,239,172,0.12) 0%,transparent 65%)"}}/>

          <div className="relative max-w-4xl mx-auto px-4 text-center">
            {/* Big line decoration */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="h-px flex-1 max-w-20" style={{background:"linear-gradient(90deg,transparent,rgba(74,222,128,0.5))"}}/>
              <Dumbbell className="w-8 h-8" style={{color:"#4ADE80"}}/>
              <div className="h-px flex-1 max-w-20" style={{background:"linear-gradient(90deg,rgba(74,222,128,0.5),transparent)"}}/>
            </div>
            <span className="text-xs font-semibold tracking-[0.4em] text-green-400 uppercase block mb-6">Topluluğa Katıl</span>
            <h2 className="text-5xl md:text-7xl font-semibold text-white mb-6 tracking-tighter leading-[0.95]">
              Spor seni<br/>
              <span style={{background:"linear-gradient(90deg,#4ADE80,#38BDF8)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>
                bekliyor.
              </span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              Ücretsiz kaydol, takımlar kur, antrenmanlar planla. Binlerce sporcu seni bekliyor.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); }}
                className="inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl font-semibold text-white text-base transition-all hover:scale-105 hover:shadow-2xl"
                style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 12px 40px rgba(22,163,74,0.4)"}}
              >
                Ücretsiz Başla
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
              </button>
              <button
                onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); }}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-sm transition-all hover:bg-white/10"
                style={{color:"rgba(186,230,253,0.8)", border:"1px solid rgba(255,255,255,0.12)"}}
              >
                Zaten hesabım var
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
      <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#bbf7d0 100%)"}}>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
        <div className="absolute inset-0 pointer-events-none"
          style={{background:"radial-gradient(ellipse at 30% center,rgba(22,163,74,0.18) 0%,transparent 65%)"}}/>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-8 py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            {/* Avatar + name */}
            <div className="flex items-center gap-5">
              <div className="relative cursor-pointer group" onClick={() => setShowProfileEdit(true)} title="Profili düzenle">
                <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
                  style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 8px 24px rgba(22,163,74,0.4)"}}>
                  {(user?.avatar?.startsWith("/uploads/") || user?.avatar?.startsWith("http")) ? (
                    <img src={user.avatar.startsWith("http") ? user.avatar : `${BASE_URL}${user.avatar}`} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.[0]?.toUpperCase() || "?"
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Image className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-green-900 tracking-tight">{user?.name}</h1>
                <p className="text-slate-400 text-sm mt-0.5">{user?.email}</p>
              </div>
            </div>
            <button onClick={() => setShowProfileEdit(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{background:"white", color:"#15803D", border:"1px solid #bbf7d0"}}>
              <Settings className="w-4 h-4"/> Profili Düzenle
            </button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px mt-10 rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
            {[
              {val: userStats?.total_trainings || 0, label:"Antrenman", accent:"#4ADE80"},
              {val: myTeams.length, label:"Takım", accent:"#38BDF8"},
              {val: userBadges.length, label:"Rozet", accent:"#FBBF24"},
              {val: `${userStats?.total_distance || 0} km`, label:"Mesafe", accent:"#34D399"},
            ].map((s, i) => (
              <div key={i} className="px-6 py-5" style={{background:"rgba(22,163,74,0.15)"}}>
                <div className="text-2xl font-semibold text-green-700">{s.val}</div>
                <div className="text-[10px] text-green-600 mt-1 uppercase tracking-widest font-semibold">{s.label}</div>
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
            <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-4">Hızlı Erişim</div>
            {[
              {label:"Antrenman Oluştur", icon:Plus, page:"create-training", grad:"linear-gradient(135deg,#16A34A,#15803D)", shadow:"rgba(22,163,74,0.3)"},
              {label:"Takım Oluştur", icon:Users, page:"create-team", grad:"linear-gradient(135deg,#0EA5E9,#06B6D4)", shadow:"rgba(14,165,233,0.3)"},
              {label:"Rozetlerim", icon:Trophy, page:"badges", grad:"linear-gradient(135deg,#F59E0B,#FBBF24)", shadow:"rgba(245,158,11,0.3)"},
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
            {activityData.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-5">Haftalık Aktivite</div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="day" tick={{fill:"#94a3b8", fontSize:11}} axisLine={{stroke:"#e2e8f0"}} tickLine={false}/>
                      <YAxis tick={{fill:"#94a3b8", fontSize:11}} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{backgroundColor:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", boxShadow:"0 4px 16px rgba(0,0,0,0.08)"}} cursor={{fill:"rgba(22,163,74,0.06)"}}/>
                      <Bar dataKey="count" fill="url(#pgrd)" radius={[6,6,0,0]}/>
                      <defs>
                        <linearGradient id="pgrd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16A34A" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#15803D" stopOpacity={0.7}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* My Trainings */}
            {myTrainings.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-4">Antrenmanlarım</div>
                <div className="space-y-2">
                  {myTrainings.slice(0, 5).map((t) => (
                    <button key={t.id} onClick={() => fetchTrainingDetails(t.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left border border-transparent hover:border-slate-100">
                      <div>
                        <div className="font-medium text-slate-800 text-sm">{t.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <MapPin className="w-3 h-3"/> {t.location_name}
                          <span>·</span>
                          <Calendar className="w-3 h-3"/> {new Date(t.training_date).toLocaleDateString("tr-TR")}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90 flex-shrink-0"/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* My Teams */}
            {myTeams.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-4">Takımlarım</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {myTeams.map((team) => (
                    <button key={team.id} onClick={() => fetchTeamDetails(team.id)}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-green-200 hover:bg-green-50/30 transition-all text-left">
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                        style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}>
                        {(team.avatar?.startsWith("/uploads/") || team.avatar?.startsWith("http"))
                          ? <img src={team.avatar.startsWith("http") ? team.avatar : `${BASE_URL}${team.avatar}`} alt="" className="w-full h-full object-cover" />
                          : (team.name?.[0]?.toUpperCase() || "T")}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 text-sm truncate">{team.name}</div>
                        <div className="text-xs text-slate-400">{team.sport} · {team.member_count} üye</div>
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
    const sports = ["Futbol", "Basketbol", "Tenis", "Yüzme", "Koşu", "Bisiklet", "Voleybol", "Fitness", "Yoga", "Triatlon", "Padel", "Kürek", "Kano", "Diğer"];
    const difficulties = ["Kolay", "Orta", "Zor"];

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
            { headers: { "Accept-Language": "tr" } }
          );
          const data = await res.json();
          setResults(data);
        } catch {
          showToast("Arama başarısız, internet bağlantını kontrol et.", "error");
        } finally {
          setSearching(false);
        }
      };

      return (
        <div className="mb-6 p-5 bg-orange-50 border border-orange-200 rounded-2xl">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">📍</span>
            <div>
              <p className="font-semibold text-orange-800">GPS konumu alınamadı</p>
              <p className="text-sm text-orange-600">Yakınımda araması için mahallenizi veya şehrinizi yazın</p>
            </div>
            <button onClick={() => setShowManualLocation(false)} className="ml-auto text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Örn: Bornova İzmir, Kadıköy İstanbul..."
              className="flex-1 px-4 py-2.5 border border-orange-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              autoFocus
            />
            <button
              onClick={search}
              disabled={searching}
              className="px-4 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-60 flex items-center gap-1"
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
    };

    return (
      <div className="min-h-screen bg-slate-50">
        {/* ── Dark athletic page header ── */}
        <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#bbf7d0 100%)"}}>
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
          <div className="absolute right-0 top-0 w-[500px] h-full pointer-events-none"
            style={{background:"radial-gradient(ellipse at right center,rgba(22,163,74,0.15) 0%,transparent 65%)"}}/>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <span className="text-xs font-semibold tracking-[0.35em] text-green-400 uppercase block mb-3">Keşfet</span>
                <h1 className="text-5xl md:text-6xl font-semibold text-green-900 tracking-tighter leading-none">Antrenmanlar</h1>
                <p className="text-slate-400 mt-3 text-base">Katıl, yeni arkadaşlar edin, birlikte spor yap.</p>
              </div>
              {user && (
                <button
                  onClick={() => setCurrentPage("create-training")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 flex-shrink-0"
                  style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 8px 24px rgba(22,163,74,0.35)"}}
                >
                  <Plus className="w-4 h-4" /> Antrenman Oluştur
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-white border-b border-slate-100 sticky top-[68px] z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3">
            <div className="flex flex-wrap gap-2.5 items-center">
              {/* Search */}
              <div className="flex-1 min-w-48 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Antrenman veya konum ara…"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-300 focus:bg-white transition"
                />
              </div>
              {/* Sport filter */}
              <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-300 focus:bg-white transition">
                <option value="">Tüm Sporlar</option>
                {sports.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {/* Level filter */}
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-300 focus:bg-white transition">
                <option value="">Tüm Seviyeler</option>
                {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {/* GPS toggle */}
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <button onClick={handleExitNearby}
                  className="px-3 py-2.5 text-xs font-medium transition-all"
                  style={!nearbyMode ? {background:"linear-gradient(135deg,#16A34A,#15803D)", color:"#fff"} : {color:"#64748b"}}>
                  Tümü
                </button>
                <button onClick={() => handleNearbySearch()} disabled={locationLoading}
                  className="px-3 py-2.5 text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                  style={nearbyMode ? {background:"linear-gradient(135deg,#16A34A,#15803D)", color:"#fff"} : {color:"#64748b"}}>
                  {locationLoading
                    ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin"/>
                    : <MapPin className="w-3 h-3"/>}
                  Yakınımda
                </button>
              </div>
              {/* Distance pills (when nearby active) */}
              {nearbyMode && [5,10,25,50].map(km => (
                <button key={km} onClick={() => handleDistanceChange(km)} disabled={nearbyLoading}
                  className="px-3 py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
                  style={nearbyDistance === km
                    ? {background:"linear-gradient(135deg,#16A34A,#15803D)", color:"#fff", border:"none"}
                    : {borderColor:"#e2e8f0", color:"#64748b", background:"#fff"}}>
                  {km} km
                </button>
              ))}
              {/* Clear */}
              {(searchQuery || sportFilter || levelFilter) && (
                <button onClick={() => { setSearchQuery(""); setSportFilter(""); setLevelFilter(""); }}
                  className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-medium text-slate-600 transition">
                  <X className="w-3.5 h-3.5"/> Temizle
                </button>
              )}
              {/* Nearby result count */}
              {nearbyMode && userLocation && !nearbyLoading && (
                <span className="ml-auto text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3"/> {nearbyTrainings.length} sonuç · {nearbyDistance} km içinde
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
          {showManualLocation && <ManualLocationSearch />}

          {nearbyMode && userLocation && !showManualLocation && (
            <div className="mb-5 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0"/>
              <span className="text-emerald-700 font-semibold flex-1">{manualLocationName || "Mevcut Konumum"}</span>
              <button onClick={() => setShowManualLocation(true)} className="text-xs text-green-600 hover:underline">Değiştir</button>
            </div>
          )}

          {nearbyLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-5">
              <div className="w-14 h-14 border-4 border-green-100 rounded-full" style={{borderTopColor:"#16A34A", animation:"spin 0.8s linear infinite"}}/>
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
                    style={{background:"rgba(22,163,74,0.08)", border:"1px solid rgba(22,163,74,0.15)"}}>
                    <MapPin className="w-9 h-9" style={{color:"rgba(22,163,74,0.4)"}}/>
                  </div>
                  <p className="text-slate-800 font-semibold text-xl mb-2">{nearbyDistance} km içinde antrenman yok</p>
                  <p className="text-slate-400 text-sm mb-7 max-w-sm mx-auto">Yakınımda araması sadece GPS koordinatı girilmiş antrenmanları gösterir.</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {[10,25,50].filter(k => k > nearbyDistance).map(k => (
                      <button key={k} onClick={() => handleDistanceChange(k)}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-700 transition">
                        {k} km'ye genişlet
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                    style={{background:"rgba(22,163,74,0.08)", border:"1px solid rgba(22,163,74,0.15)"}}>
                    <Activity className="w-9 h-9" style={{color:"rgba(22,163,74,0.4)"}}/>
                  </div>
                  <p className="text-slate-800 font-semibold text-xl mb-2">Henüz antrenman yok</p>
                  <p className="text-slate-400 text-sm mb-7 max-w-xs mx-auto">İlk antrenmanı sen oluştur, spor arkadaşlarını topla!</p>
                  {user && (
                    <button onClick={() => setCurrentPage("create-training")}
                      className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 hover:shadow-lg"
                      style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 8px 24px rgba(22,163,74,0.3)"}}>
                      <Plus className="w-4 h-4"/> Antrenman Oluştur
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const TeamsPage = () => {
    const sports = ["Futbol", "Basketbol", "Tenis", "Yüzme", "Koşu", "Bisiklet", "Voleybol", "Fitness", "Yoga", "Triatlon", "Padel", "Kürek", "Kano", "Diğer"];
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
        <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#bbf7d0 100%)"}}>
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
          <div className="absolute left-0 top-0 w-[500px] h-full pointer-events-none"
            style={{background:"radial-gradient(ellipse at left center,rgba(56,189,248,0.12) 0%,transparent 65%)"}}/>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <span className="text-xs font-semibold tracking-[0.35em] text-green-600 uppercase block mb-3">Topluluk</span>
                <h1 className="text-5xl md:text-6xl font-semibold text-green-900 tracking-tighter leading-none">Takımlar</h1>
                <p className="text-slate-400 mt-3 text-base">Sana uygun takımı bul ya da kendi takımını kur.</p>
              </div>
              {user && (
                <button
                  onClick={() => setCurrentPage("create-team")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 flex-shrink-0"
                  style={{background:"linear-gradient(135deg,#0EA5E9,#06B6D4)", boxShadow:"0 8px 24px rgba(14,165,233,0.3)"}}
                >
                  <Plus className="w-4 h-4" /> Takım Oluştur
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
                  placeholder="Takım ara…"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"/>
              </div>
              <select value={teamSport} onChange={(e) => setTeamSport(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition">
                <option value="">Tüm Sporlar</option>
                {sports.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {(teamSearch || teamSport) && (
                <button onClick={() => { setTeamSearch(""); setTeamSport(""); }}
                  className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-medium text-slate-600 transition">
                  <X className="w-3.5 h-3.5"/> Temizle
                </button>
              )}
              <span className="ml-auto text-xs text-slate-400 font-semibold">{filteredTeams.length} takım</span>
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
                {teamSearch || teamSport ? "Sonuç bulunamadı" : "Henüz takım yok"}
              </p>
              <p className="text-slate-400 text-sm mb-7 max-w-xs mx-auto">
                {teamSearch || teamSport ? "Farklı bir arama veya spor dalı dene." : "İlk takımı sen kur, üyeleri davet et ve birlikte spor yap!"}
              </p>
              {teamSearch || teamSport ? (
                <button onClick={() => { setTeamSearch(""); setTeamSport(""); }}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition">
                  Filtreleri Temizle
                </button>
              ) : user && (
                <button onClick={() => setCurrentPage("create-team")}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 hover:shadow-lg"
                  style={{background:"linear-gradient(135deg,#0EA5E9,#06B6D4)", boxShadow:"0 8px 24px rgba(14,165,233,0.3)"}}>
                  <Plus className="w-4 h-4"/> Takım Kur
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
      <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#bbf7d0 100%)"}}>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
        <div className="absolute inset-0 pointer-events-none"
          style={{background:"radial-gradient(ellipse at center,rgba(22,163,74,0.08) 0%,transparent 65%)"}}/>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-12">
          <button onClick={() => setCurrentPage("profile")}
            className="flex items-center gap-2 text-sm font-semibold mb-6 transition-colors"
            style={{color:"#15803D"}}
            onMouseEnter={e=>e.currentTarget.style.color="#166534"}
            onMouseLeave={e=>e.currentTarget.style.color="#15803D"}>
            <ArrowLeft className="w-4 h-4"/> Profile Dön
          </button>
          <div className="flex items-end justify-between gap-6">
            <div>
              <span className="text-xs font-semibold tracking-[0.35em] text-green-600 uppercase block mb-3">Başarılar</span>
              <h1 className="text-5xl md:text-6xl font-semibold text-green-900 tracking-tighter leading-none">Rozetler</h1>
              <p className="text-green-700 mt-3 text-base">Her antrenman yeni bir başarının kapısını aralar.</p>
            </div>
            {/* Progress summary */}
            <div className="hidden md:flex items-center gap-4 pb-1">
              <div className="text-right">
                <div className="text-4xl font-semibold text-green-700">{userBadges.length}<span className="text-green-500 text-2xl">/{badges.length}</span></div>
                <div className="text-xs text-green-600 font-semibold uppercase tracking-wider mt-1">Kazanılan Rozet</div>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{background:"rgba(22,163,74,0.12)", border:"1px solid rgba(22,163,74,0.25)"}}>
                <Trophy className="w-7 h-7 text-green-600"/>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-8 max-w-md">
            <div className="flex justify-between text-xs font-medium text-green-700 mb-2">
              <span>İlerleme</span>
              <span style={{color:"#15803D"}}>{badges.length > 0 ? Math.round((userBadges.length/badges.length)*100) : 0}%</span>
            </div>
            <div className="h-1.5 bg-green-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{width:`${badges.length > 0 ? (userBadges.length/badges.length)*100 : 0}%`, background:"linear-gradient(90deg,#16A34A,#15803D)"}}/>
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
          className="flex items-center text-green-600 mb-6 hover:underline"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Geri Dön
        </button>

        <div className="bg-white rounded-2xl p-8 border">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-medium">{selectedTraining.title}</h1>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-sm font-medium">
                {selectedTraining.team_sport || "Genel"}
              </span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-600 rounded-full text-sm font-medium">
                {selectedTraining.difficulty}
              </span>
            </div>
          </div>

          {isOwner && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setEditMode(!editMode)}
                className="px-4 py-2 bg-blue-100 text-blue-600 rounded-xl font-semibold hover:bg-blue-200 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                {editMode ? "İptal" : "Düzenle"}
              </button>
              <button
                onClick={() => handleDeleteTraining(selectedTraining.id)}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-semibold hover:bg-red-200 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Sil
              </button>
            </div>
          )}

          {isOwner && editMode && (() => {
            const iCls = "w-full h-12 px-4 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 transition-colors";
            const sCls = `${iCls} appearance-none cursor-pointer`;
            const lCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
            return (
              <form onSubmit={handleSubmitEdit} className="mb-8 space-y-5">
                <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                  <Edit className="w-4 h-4 text-green-600"/> Antrenmanı Düzenle
                </h3>

                {/* Başlık */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <label className={lCls}>Başlık</label>
                  <input type="text" value={editData.title}
                    onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
                    className={iCls} placeholder="Örn: Pazartesi Koşusu" required />
                </div>

                {/* Açıklama */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <label className={lCls}>Açıklama <span className="normal-case font-normal text-slate-400">(isteğe bağlı)</span></label>
                  <textarea value={editData.description}
                    onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 transition-colors resize-none"
                    rows="3" placeholder="Antrenman hakkında kısa bir açıklama…"/>
                </div>

                {/* Tarih + Saat */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lCls}>Tarih</label>
                      <input type="date" value={editData.training_date}
                        onChange={(e) => setEditData((d) => ({ ...d, training_date: e.target.value }))}
                        className={iCls} required />
                    </div>
                    <div>
                      <label className={lCls}>Saat</label>
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
                  <label className={lCls}>Konum</label>
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
                      <label className={lCls}>Kapasite</label>
                      <input type="number" value={editData.capacity} min="1"
                        onChange={(e) => setEditData((d) => ({ ...d, capacity: parseInt(e.target.value) }))}
                        className={iCls} />
                    </div>
                    <div>
                      <label className={lCls}>Seviye</label>
                      <select value={editData.difficulty}
                        onChange={(e) => setEditData((d) => ({ ...d, difficulty: e.target.value }))}
                        className={sCls}>
                        <option value="Kolay">🟢 Kolay</option>
                        <option value="Orta">🟡 Orta</option>
                        <option value="Zor">🔴 Zor</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button type="submit"
                  className="w-full h-12 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
                  style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 4px 14px rgba(22,163,74,0.3)"}}>
                  Kaydet
                </button>
              </form>
            );
          })()}

          <p className="text-gray-600 mb-6">{selectedTraining.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <MapPin className="w-5 h-5 mr-2" />
                <span className="font-semibold">Konum</span>
              </div>
              <p>{selectedTraining.location_name}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Calendar className="w-5 h-5 mr-2" />
                <span className="font-semibold">Tarih</span>
              </div>
              <p>{new Date(selectedTraining.training_date).toLocaleDateString("tr-TR")}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Clock className="w-5 h-5 mr-2" />
                <span className="font-semibold">Saat</span>
              </div>
              <p>{selectedTraining.training_time}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Users className="w-5 h-5 mr-2" />
                <span className="font-semibold">Kapasite</span>
              </div>
              <p>
                {selectedTraining.attendees?.length || 0}/{selectedTraining.capacity}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-medium mb-4">
              Katılımcılar ({selectedTraining.attendees?.length || 0})
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
                        {new Date(attendee.joined_at).toLocaleDateString("tr-TR")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Henüz katılımcı yok</p>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-medium mb-4 flex items-center">
              <MessageCircle className="w-5 h-5 mr-2" />
              Yorumlar ({selectedTraining.comments?.length || 0})
            </h3>

            {user && (
              <form onSubmit={handleSubmitComment} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Yorum yaz..."
                    className="flex-1 px-4 py-2 border rounded-xl"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
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
                          {new Date(c.created_at).toLocaleDateString("tr-TR")}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700">{c.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Henüz yorum yok</p>
            )}
          </div>

          {!user ? (
            <div className="rounded-2xl overflow-hidden border border-green-100 shadow-sm">
              {/* Üst gradient şerit */}
              <div className="h-1.5" style={{background:"linear-gradient(90deg,#16A34A,#4ADE80,#16A34A)"}}/>
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50">
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md"
                    style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}>
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">Spor topluluğuna katıl</h3>
                  <p className="text-sm text-slate-500">Ücretsiz hesap aç, antrenmanlara katıl ve yeni spor arkadaşları edin.</p>
                </div>

                {/* Özellikler */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { icon:"🏃", label:"Antrenmanlara katıl" },
                    { icon:"🛡️", label:"Takım kur veya katıl" },
                    { icon:"🤝", label:"Spor arkadaşı edin" },
                  ].map(f => (
                    <div key={f.label} className="bg-white rounded-xl p-3 text-center border border-green-100 shadow-sm">
                      <div className="text-2xl mb-1">{f.icon}</div>
                      <div className="text-xs font-medium text-slate-600 leading-tight">{f.label}</div>
                    </div>
                  ))}
                </div>

                {/* Butonlar */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); }}
                    className="flex-1 py-3 font-semibold text-white text-sm rounded-xl transition hover:opacity-90 hover:shadow-lg"
                    style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}
                  >
                    Ücretsiz Kayıt Ol
                  </button>
                  <button
                    onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); }}
                    className="flex-1 py-3 font-semibold text-green-700 text-sm rounded-xl border border-green-300 bg-white hover:bg-green-50 transition"
                  >
                    Giriş Yap
                  </button>
                </div>
              </div>
            </div>
          ) : isParticipant ? (
            <div className="flex gap-3">
              <div className="flex-1 py-4 rounded-xl font-semibold text-center text-green-700 bg-green-50 border border-green-200">
                ✓ Katıldın
              </div>
              <button
                onClick={() => handleLeaveTraining(selectedTraining.id)}
                disabled={joiningTrainingId === selectedTraining.id}
                className="px-6 py-4 rounded-xl font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition disabled:opacity-60"
              >
                {joiningTrainingId === selectedTraining.id
                  ? <span className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin inline-block"/>
                  : "Ayrıl"}
              </button>
            </div>
          ) : isFull ? (
            <div className="w-full py-4 rounded-xl font-semibold text-center text-slate-500 bg-slate-100 border border-slate-200">
              Kapasite Dolu
            </div>
          ) : (
            <button
              onClick={() => handleJoinTraining(selectedTraining.id)}
              disabled={joiningTrainingId === selectedTraining.id}
              className="w-full py-4 font-semibold text-white rounded-xl transition hover:opacity-90 hover:shadow-lg disabled:opacity-60"
              style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}
            >
              {joiningTrainingId === selectedTraining.id
                ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Katılıyor…</span>
                : "Antrenmana Katıl"}
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

    const sportTypes = ["Futbol","Basketbol","Tenis","Yüzme","Koşu","Bisiklet","Voleybol","Fitness","Yoga","Triatlon","Padel","Kürek","Kano","Diğer"];

    const roleBadge = (role) => {
      if (role === "owner")   return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1"><Crown className="w-3 h-3" /> Sahip</span>;
      if (role === "coach")   return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1"><Target className="w-3 h-3" /> Antrenör</span>;
      if (role === "captain") return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Kaptan</span>;
      return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold flex items-center gap-1"><User className="w-3 h-3" /> Üye</span>;
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
      { id: "wall",    label: "Duvar",   icon: <MessageSquare className="w-4 h-4" />, show: isMember },
      { id: "members", label: "Üyeler",  icon: <Users className="w-4 h-4" />,        show: canSeeMembers },
      { id: "settings",label: "Ayarlar", icon: <Settings className="w-4 h-4" />,     show: isOwner },
    ].filter((t) => t.show);

    const iCls = "w-full h-11 px-4 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 transition-colors";
    const lCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <button onClick={() => setCurrentPage("teams")} className="flex items-center gap-1.5 text-green-600 font-medium mb-6 hover:text-green-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Takımlara Dön
        </button>

        {/* HEADER KARTI */}
        <div className="relative rounded-3xl overflow-hidden mb-4 shadow-sm">
          <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 px-8 pt-8 pb-6 text-white">
            {/* üst satır */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold shadow-inner">
                    {(selectedTeam.avatar?.startsWith("/uploads/") || selectedTeam.avatar?.startsWith("http"))
                      ? <img src={selectedTeam.avatar.startsWith("http") ? selectedTeam.avatar : `${BASE_URL}${selectedTeam.avatar}`} alt="" className="w-full h-full object-cover" />
                      : (selectedTeam.name?.[0]?.toUpperCase() || "T")}
                  </div>
                  {isOwner && (
                    <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-green-50 transition-colors" title="Fotoğraf yükle">
                      <Image className="w-3 h-3 text-green-600" />
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
                          showToast("Takım fotoğrafı güncellendi!", "success");
                        } else showToast("Yükleme başarısız!", "error");
                      }} />
                    </label>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{selectedTeam.name}</h1>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium">{selectedTeam.sport}</span>
                    {selectedTeam.is_private
                      ? <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium flex items-center gap-1"><Lock className="w-3 h-3" /> Gizli</span>
                      : <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium flex items-center gap-1"><Globe className="w-3 h-3" /> Herkese Açık</span>}
                    {myRole && (() => {
                      const badges = { owner:"👑 Sahip", coach:"🎯 Antrenör", captain:"⚓ Kaptan", member:"👤 Üye" };
                      return <span className="px-2.5 py-0.5 bg-white/30 rounded-full text-xs font-semibold">{badges[myRole] || myRole}</span>;
                    })()}
                  </div>
                </div>
              </div>
              {canManage && (
                <button onClick={() => setShowInviteModal(true)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors backdrop-blur">
                  <UserPlus className="w-4 h-4" /> Davet Et
                </button>
              )}
            </div>

            {/* istatistikler */}
            <div className="flex items-center gap-5 mt-5 text-sm">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 opacity-80" />
                <span className="font-semibold">{selectedTeam.members?.length || 0}</span>
                <span className="opacity-75">üye</span>
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
                    ? "bg-white text-green-700 shadow-sm"
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
                    placeholder="Takımla bir şey paylaş..."
                    className={`flex-1 ${iCls}`} />
                  <button type="submit"
                    className="px-5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {selectedTeam.posts?.length > 0 ? (
                <div className="space-y-3">
                  {selectedTeam.posts.map((post) => (
                    <div key={post.id} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {renderAvatar(post.user_avatar, post.user_name)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-800">{post.user_name}</div>
                          <div className="text-xs text-slate-400">{new Date(post.created_at).toLocaleDateString("tr-TR")}</div>
                        </div>
                      </div>
                      <p className="text-slate-700 text-sm leading-relaxed">{post.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-14">
                  <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="font-semibold text-slate-600">Henüz mesaj yok</p>
                  <p className="text-sm text-slate-400 mt-1">İlk mesajı sen at!</p>
                </div>
              )}
            </div>
          )}

          {/* ÜYELER */}
          {activeTab === "members" && canSeeMembers && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-800 text-lg">Üyeler <span className="text-slate-400 font-normal text-base">({selectedTeam.members?.length || 0})</span></h3>
                {canManage && (
                  <button onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-semibold hover:bg-green-100 transition-colors">
                    <UserPlus className="w-4 h-4" /> Davet Et
                  </button>
                )}
              </div>

              {/* Bekleyen davetler */}
              {canManage && pendingInvitations.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Bekleyen Davetler ({pendingInvitations.length})
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
                            <div className="text-xs text-slate-400">{inv.inviter_name} · {new Date(inv.created_at).toLocaleDateString("tr-TR")}</div>
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
                        <div className="w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {renderAvatar(member.avatar, member.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {member.name}
                            {isMe && <span className="text-xs text-slate-400 font-normal">(sen)</span>}
                          </div>
                          <div className="mt-0.5">{roleBadge(member.role)}</div>
                        </div>
                      </div>

                      {isOwner && !isThisOwner && (
                        <div className="flex items-center gap-2">
                          <select value={member.role}
                            onChange={(e) => handleChangeMemberRole(selectedTeam.id, member.id, e.target.value)}
                            className="text-sm h-9 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300 bg-white text-slate-700">
                            <option value="member">👤 Üye</option>
                            <option value="captain">⚓ Kaptan</option>
                            <option value="coach">🎯 Antrenör</option>
                            <option value="owner">🏆 Sahip</option>
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
                          Ayrıl
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
                  <label className={lCls}>Takım Adı</label>
                  <input type="text" value={editForm.name} required
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Spor Dalı</label>
                  <select value={editForm.sport}
                    onChange={(e) => setEditForm((f) => ({ ...f, sport: e.target.value }))}
                    className={`${iCls} appearance-none cursor-pointer`}>
                    {sportTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={lCls}>Açıklama</label>
                <textarea value={editForm.description} rows={3}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className={`${iCls} h-auto py-3 resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lCls}>Konum</label>
                  <input type="text" value={editForm.location}
                    onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="İstanbul, Türkiye"
                    className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Takım Fotoğrafı</label>
                  <label className="flex items-center gap-3 h-11 px-4 border border-slate-200 rounded-xl bg-white cursor-pointer hover:border-green-400 transition-colors">
                    <Image className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-slate-500 truncate">
                      {(editForm.avatar?.startsWith("/uploads/") || editForm.avatar?.startsWith("http")) ? "Fotoğraf yüklendi ✓" : "Fotoğraf seç..."}
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
                        showToast("Takım fotoğrafı güncellendi!", "success");
                      } else showToast("Yükleme başarısız!", "error");
                    }} />
                  </label>
                </div>
              </div>

              <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-colors ${editForm.is_private ? "border-slate-200 bg-slate-50" : "border-green-200 bg-green-50"}`}>
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5 text-sm">
                    {editForm.is_private ? <><Lock className="w-4 h-4 text-slate-500" /> Gizli Takım</> : <><Globe className="w-4 h-4 text-green-600" /> Herkese Açık Takım</>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {editForm.is_private ? "Sadece davet edilenler görebilir." : "Herkes görebilir ve katılabilir."}
                  </div>
                </div>
                <button type="button"
                  onClick={() => setEditForm((f) => ({ ...f, is_private: !f.is_private }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ml-4 flex-shrink-0 ${editForm.is_private ? "bg-slate-300" : "bg-green-500"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${editForm.is_private ? "left-1" : "left-6"}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit"
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors">
                  Kaydet
                </button>
                <button type="button" onClick={() => handleDeleteTeam(selectedTeam.id)}
                  className="px-6 h-12 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Sil
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
              <p className="font-semibold text-slate-700">Gizli Takım</p>
              <p className="text-sm text-slate-400 mt-1">Üyeleri görmek için katılmanız gerekiyor.</p>
            </div>
          )}

          {/* KATIL butonu */}
          {!isMember && !selectedTeam.is_private && (
            <div className="mt-6">
              <button onClick={() => handleJoinTeam(selectedTeam.id)}
                disabled={joiningTeamId === selectedTeam.id}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {joiningTeamId === selectedTeam.id
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Katılınıyor...</>
                  : <><UserPlus className="w-4 h-4" /> Takıma Katıl</>}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const CreateTrainingPage = () => {
    const defaultTeam = myTeams.length > 0 ? myTeams[0] : null;
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
      team_id: defaultTeam?.id || null,
      is_public: defaultTeam ? !defaultTeam.is_private : true,
    });

    // Seçili takım nesnesini bul
    const selectedTeamObj = myTeams.find((t) => t.id === parseInt(formData.team_id));
    const selectedTeamIsPrivate = selectedTeamObj?.is_private || false;

    const handleTeamChange = (teamId) => {
      const team = myTeams.find((t) => t.id === parseInt(teamId));
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
          "GPS koordinatı eklemediniz. Koordinat olmadan bu antrenman \"Yakınımda\" aramasında görünmeyecek. Yine de koordinatsız devam etmek istiyor musunuz?",
          () => handleCreateTraining(formData)
        );
        return;
      }
      handleCreateTraining(formData);
    };

    const inputCls = "w-full h-12 px-4 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 transition-colors";
    const selectCls = `${inputCls} appearance-none cursor-pointer`;
    const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

    return (
      <form onSubmit={handleSubmit}>
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-xl mx-auto">

          {/* Başlık */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">Yeni Antrenman</h1>
            <p className="text-sm text-slate-400 mt-1">Takımın için antrenman planla</p>
          </div>

          {myTeams.length === 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Önce bir takım oluşturmalısınız</p>
                <button onClick={() => setCurrentPage("create-team")} className="text-sm text-green-600 font-semibold mt-1">Takım Oluştur →</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">

            {/* Takım + Gizlilik */}
            {myTeams.length > 0 && (
              <div className="p-5 space-y-3">
                <div>
                  <label className={labelCls}>Takım</label>
                  <select
                    value={formData.team_id}
                    onChange={(e) => handleTeamChange(e.target.value)}
                    className={selectCls}
                    required
                  >
                    {myTeams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                {selectedTeamIsPrivate ? (
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 rounded-xl text-sm text-slate-500 border border-slate-200">
                    <Lock className="w-4 h-4 flex-shrink-0" />
                    <span>Gizli takım — antrenman otomatik olarak <strong className="text-slate-700">sadece üyelere özel</strong> olacak</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-xl border border-green-100">
                    <span className="text-sm text-slate-700 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-green-500" /> Herkese açık antrenman
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, is_public: !f.is_public }))}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${formData.is_public ? "bg-green-500" : "bg-slate-300"}`}
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
                <label className={labelCls}>Başlık</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={inputCls}
                  placeholder="Örn: Pazartesi Koşusu"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Açıklama <span className="normal-case font-normal text-slate-400">(isteğe bağlı)</span></label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 transition-colors resize-none"
                  rows="3"
                  placeholder="Antrenman hakkında kısa bir açıklama…"
                />
              </div>
            </div>

            {/* Tarih + Saat */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tarih</label>
                  <input
                    type="date"
                    value={formData.training_date}
                    onChange={(e) => setFormData({ ...formData, training_date: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Saat</label>
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
              <label className={labelCls}>Konum</label>
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
                  <label className={labelCls}>Kapasite</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    className={inputCls}
                    min="1"
                  />
                </div>
                <div>
                  <label className={labelCls}>Seviye</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className={selectCls}
                  >
                    <option value="Kolay">🟢 Kolay</option>
                    <option value="Orta">🟡 Orta</option>
                    <option value="Zor">🔴 Zor</option>
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
              İptal
            </button>
            <button
              type="submit"
              disabled={myTeams.length === 0}
              className="flex-1 h-12 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 hover:shadow-lg"
              style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}
            >
              Antrenman Oluştur
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

    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl p-8 border">
          <h1 className="text-3xl font-medium mb-6">Yeni Takım Oluştur</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Takım Adı</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Spor</label>
              <select
                value={formData.sport}
                onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                required
              >
                <option value="">Seçin</option>
                {sportTypes.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Açıklama</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Konum</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                placeholder="Örn: İzmir"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_private}
                onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Özel Takım (Sadece davet ile)</label>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg"
              >
                Takım Oluştur
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage("profile")}
                className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
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
      if (password !== password2) return setError("Şifreler eşleşmiyor.");
      if (password.length < 6)    return setError("Şifre en az 6 karakter olmalı.");
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
          setError(data.error || "Bir hata oluştu.");
        }
      } catch {
        setError("Sunucuya bağlanılamadı.");
      }
      setLoading(false);
    };

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}>
              <Lock className="w-8 h-8 text-white"/>
            </div>
            <h1 className="text-2xl font-medium text-slate-900">Yeni Şifre Belirle</h1>
            <p className="text-slate-500 text-sm mt-1">En az 6 karakter olmalı.</p>
          </div>

          {success ? (
            <div className="text-center py-4">
              <div className="mb-4 flex justify-center"><CheckCircle className="w-14 h-14 text-green-500" /></div>
              <p className="text-green-700 font-semibold">Şifren başarıyla güncellendi!</p>
              <p className="text-slate-500 text-sm mt-1">Ana sayfaya yönlendiriliyorsun…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <input type="password" placeholder="Yeni şifre" value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                required/>
              <input type="password" placeholder="Yeni şifre (tekrar)" value={password2}
                onChange={e => { setPassword2(e.target.value); setError(""); }}
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                required/>
              <button type="submit" disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                Şifremi Güncelle
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
            Bildirimler {unreadCount > 0 && `(${unreadCount})`}
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
                      {new Date(notif.created_at).toLocaleDateString("tr-TR")}
                    </span>
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkNotificationRead(notif.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Okundu işaretle
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Bildirim yok</p>
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
          showToast("Fotoğraf güncellendi!", "success");
        } else {
          const err = await res.json();
          showToast(err.error || "Yükleme başarısız!", "error");
        }
      } catch {
        showToast("Bağlantı hatası!", "error");
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
        showToast("Yeni şifreler eşleşmiyor!", "error");
        return;
      }
      if (pwData.newPassword.length < 4) {
        showToast("Şifre en az 4 karakter olmalı!", "error");
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
          showToast("Şifre güncellendi! 🔐", "success");
          setShowProfileEdit(false);
        } else {
          const data = await response.json();
          showToast(data.error || "Şifre güncellenemedi!", "error");
        }
      } catch {
        showToast("Bağlantı hatası!", "error");
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

          <h2 className="text-3xl font-medium mb-6">Ayarlar</h2>

          {/* Sekmeler */}
          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "profile" ? "bg-white shadow text-green-600" : "text-gray-500"}`}
            >
              Profil
            </button>
            <button
              onClick={() => setActiveTab("password")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "password" ? "bg-white shadow text-green-600" : "text-gray-500"}`}
            >
              Şifre
            </button>
          </div>

          {activeTab === "profile" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Avatar fotoğrafı */}
              <div className="flex flex-col items-center gap-3 pb-2">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center text-white text-3xl font-bold shadow-lg"
                    style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}>
                    {(formData.avatar?.startsWith("/uploads/") || formData.avatar?.startsWith("http")) ? (
                      <img src={formData.avatar.startsWith("http") ? formData.avatar : `${BASE_URL}${formData.avatar}`} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      user?.name?.[0]?.toUpperCase() || "?"
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
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50">
                  <Image className="w-3.5 h-3.5" /> Fotoğraf Değiştir
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">İsim</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Telefon</label>
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
                Kaydet
              </button>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Mevcut Şifre</label>
                <input
                  type="password"
                  value={pwData.currentPassword}
                  onChange={(e) => setPwData({ ...pwData, currentPassword: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Yeni Şifre</label>
                <input
                  type="password"
                  value={pwData.newPassword}
                  onChange={(e) => setPwData({ ...pwData, newPassword: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Yeni Şifre (Tekrar)</label>
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
                {pwLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Güncelleniyor...</> : "Şifreyi Güncelle"}
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
        showToast("Takım bilgisi bulunamadı.", "error");
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

          <h2 className="text-3xl font-medium mb-6">Takıma Davet Et</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl"
                placeholder="ornek@email.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? "Gönderiliyor…" : "Davet Gönder"}
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
        style={{color: isActive(page) ? "#15803D" : "#64748b"}}
        onMouseEnter={e=>{ if(!isActive(page)) e.currentTarget.style.color="#166534"; }}
        onMouseLeave={e=>{ if(!isActive(page)) e.currentTarget.style.color="#64748b"; }}
      >
        {label}
        <span className="absolute -bottom-[24px] left-0 right-0 h-0.5 rounded-full transition-all duration-300"
          style={{
            background:"linear-gradient(90deg,#16A34A,#22C55E)",
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
          background: isActive(page) ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "transparent",
          color: isActive(page) ? "#15803D" : "#475569",
        }}
      >
        {icon}
        {label}
      </button>
    );

    return (
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-[68px]">

            {/* Logo */}
            <button className="flex items-center gap-2.5 group flex-shrink-0" onClick={() => setCurrentPage("home")}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform"
                style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 4px 14px rgba(22,163,74,0.35)"}}>
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold tracking-tight"
                style={{background:"linear-gradient(90deg,#166534,#16A34A)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>
                Muuvlink
              </span>
            </button>

            {/* Orta nav — desktop */}
            <div className="hidden md:flex items-center gap-8 h-[68px]">
              {navLink("home", "Ana Sayfa")}
              {navLink("trainings", "Antrenmanlar")}
              {navLink("teams", "Takımlar")}
              {navLink("contact", "İletişim")}
            </div>

            {/* Sağ aksiyonlar — desktop */}
            <div className="hidden md:flex items-center gap-2.5">
              {user ? (
                <>
                  <button
                    onClick={() => setCurrentPage("create-training")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg"
                    style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 4px 14px rgba(22,163,74,0.3)"}}
                  >
                    <Plus className="w-4 h-4" /> Antrenman
                  </button>

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

                  <button onClick={() => setCurrentPage("profile")}
                    className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center text-white font-medium text-xs flex-shrink-0"
                      style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}>
                      {(user.avatar?.startsWith("/uploads/") || user.avatar?.startsWith("http")) ? (
                        <img src={user.avatar.startsWith("http") ? user.avatar : `${BASE_URL}${user.avatar}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.avatar || user.name[0].toUpperCase()
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
                    className="px-5 py-2 text-sm font-semibold text-slate-600 hover:text-green-700 transition-colors"
                  >
                    Giriş Yap
                  </button>
                  <button
                    onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg"
                    style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 4px 14px rgba(22,163,74,0.3)"}}
                  >
                    Kaydol
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
              {mobileNavLink("home",      "Ana Sayfa",    <Activity className="w-4 h-4"/>)}
              {mobileNavLink("trainings", "Antrenmanlar", <Dumbbell className="w-4 h-4"/>)}
              {mobileNavLink("teams",     "Takımlar",     <Users className="w-4 h-4"/>)}
              {mobileNavLink("contact",   "İletişim",     <Mail className="w-4 h-4"/>)}

              <div className="my-2 border-t border-slate-100"/>

              {user ? (
                <>
                  <button
                    onClick={() => { setCurrentPage("create-training"); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-white transition-all"
                    style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}
                  >
                    <Plus className="w-4 h-4"/> Antrenman Oluştur
                  </button>
                  <button
                    onClick={() => { setCurrentPage("profile"); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0"
                      style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}>
                      {(user.avatar?.startsWith("/uploads/") || user.avatar?.startsWith("http")) ? (
                        <img src={user.avatar.startsWith("http") ? user.avatar : `${BASE_URL}${user.avatar}`} alt="" className="w-full h-full object-cover" />
                      ) : (user.avatar || user.name[0].toUpperCase())}
                    </div>
                    {user.name.split(" ")[0]} — Profil
                  </button>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4"/> Çıkış Yap
                  </button>
                </>
              ) : (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); setMobileOpen(false); }}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    Giriş Yap
                  </button>
                  <button
                    onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); setMobileOpen(false); }}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-white transition-all"
                    style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}
                  >
                    Kaydol
                  </button>
                </div>
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

    const faqs = [
      { q: "Muuvlink'e nasıl üye olurum?", a: "Sağ üst köşedeki 'Kaydol' butonuna tıklayarak adınızı, e-posta adresinizi ve şifrenizi girerek ücretsiz üye olabilirsiniz." },
      { q: "Takım nasıl kurarım?", a: "'Takımlar' sayfasına gidin ve '+ Takım Oluştur' butonuna tıklayın. Takım adı, spor branşı ve gizlilik ayarını belirleyerek dakikalar içinde takımınızı oluşturabilirsiniz." },
      { q: "Antrenman nasıl oluştururum?", a: "Bir takıma sahip veya antrenör olarak kayıtlı olmanız gerekiyor. Ardından 'Antrenman Oluştur' butonuna tıklayıp tarih, saat, konum ve kapasite bilgilerini doldurarak antrenmanınızı yayınlayabilirsiniz. Takım üyelerine otomatik olarak bildirim ve e-posta gönderilir." },
      { q: "Gizli takım nedir?", a: "Gizli takımlar listede görünmez, sadece davet edilen üyeler katılabilir. Gizli takımların antrenmanları da otomatik olarak yalnızca üyelere özel olur." },
      { q: "Takıma nasıl üye eklerim?", a: "Takım detay sayfasında 'Üyeler' sekmesine gidin ve 'Davet Et' butonuyla e-posta adresi aracılığıyla üye ekleyebilirsiniz. Muuvlink üyesiyse davet bildirimi, değilse kayıt daveti e-postası gönderilir." },
      { q: "Antrenman bildirimleri nasıl çalışır?", a: "Takımınızda yeni bir antrenman oluşturulduğunda hem uygulama içi bildirim hem de e-posta alırsınız. Ayrıca antrenmanınızdan 3 gün ve 1 gün önce otomatik hatırlatma bildirimi gelir." },
      { q: "Antrenman kartındaki km bilgisi nasıl hesaplanır?", a: "Tarayıcınızın konum iznine göre bulunduğunuz yere olan mesafe hesaplanır. Konum iznini tarayıcı adres çubuğundaki kilit ikonundan verebilirsiniz." },
      { q: "Üyelik ücretli mi?", a: "Şu an için Muuvlink tamamen ücretsizdir. Temel tüm özellikler herkes için açıktır. İleride ek özellikler sunan premium bir plan gelebilir, ancak mevcut özellikler ücretsiz kalmaya devam edecektir." },
      { q: "Şifremi unuttum, ne yapmalıyım?", a: "Giriş ekranındaki 'Şifremi Unuttum' bağlantısına tıklayın. E-posta adresinize şifre sıfırlama linki gönderilecektir." },
    ];

    const handleContactSubmit = async (e) => {
      e.preventDefault();
      if (!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message) {
        showToast("Lütfen tüm alanları doldurun.", "error"); return;
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
          showToast("Mesajınız gönderildi! En kısa sürede dönüş yapacağız. 📬", "success");
          setContactForm({ name: user?.name || "", email: user?.email || "", subject: "", message: "" });
        } else {
          showToast(data.error || "Bir hata oluştu.", "error");
        }
      } catch {
        showToast("Bağlantı hatası.", "error");
      } finally {
        setSending(false);
      }
    };

    const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-300 focus:bg-white transition";

    return (
      <div className="min-h-screen bg-slate-50">
        {/* ── Dark header ── */}
        <div className="relative overflow-hidden" style={{background:"linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#bbf7d0 100%)"}}>
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{backgroundImage:"linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize:"50px 50px"}}/>
          <div className="absolute inset-0 pointer-events-none"
            style={{background:"radial-gradient(ellipse at center,rgba(22,163,74,0.15) 0%,transparent 65%)"}}/>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-14 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{background:"rgba(22,163,74,0.15)", border:"1px solid rgba(22,163,74,0.3)"}}>
              <MessageCircle className="w-8 h-8" style={{color:"#4ADE80"}}/>
            </div>
            <span className="text-xs font-semibold tracking-[0.35em] text-green-400 uppercase block mb-3">Destek</span>
            <h1 className="text-5xl md:text-6xl font-semibold text-green-900 tracking-tighter leading-none mb-4">İletişim</h1>
            <p className="text-slate-400 text-base max-w-md mx-auto">Sorularınız için buradayız. En kısa sürede dönüş yaparız.</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8">

            {/* Sol: İletişim + Sosyal */}
            <div className="space-y-5">
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-4">İletişim</div>
                <div className="space-y-4">
                  {[
                    {icon:<Mail className="w-4 h-4" style={{color:"#4ADE80"}}/>, label:"E-posta", value:"info@sporlaconnect.com", href:"mailto:info@sporlaconnect.com"},
                    {icon:<MapPin className="w-4 h-4" style={{color:"#34D399"}}/>, label:"Konum", value:"İzmir, Türkiye", href:null},
                    {icon:<Clock className="w-4 h-4" style={{color:"#38BDF8"}}/>, label:"Yanıt Süresi", value:"24 saat içinde", href:null},
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"#f8fafc", border:"1px solid #f1f5f9"}}>
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{item.label}</div>
                        {item.href
                          ? <a href={item.href} className="text-sm font-semibold text-slate-700 hover:text-green-600 transition-colors">{item.value}</a>
                          : <div className="text-sm font-semibold text-slate-700">{item.value}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-4">Sosyal Medya</div>
                <div className="space-y-2">
                  {[
                    {label:"Instagram", handle:"@muuvlinkapp", bg:"#fdf2f8", color:"#db2777"},
                    {label:"X (Twitter)", handle:"@muuvlinkapp", bg:"#f8fafc", color:"#0f172a"},
                    {label:"LinkedIn", handle:"Muuvlink", bg:"#eff6ff", color:"#1d4ed8"},
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={{background:s.bg, color:s.color}}>{s.label[0]}</div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">{s.label}</div>
                        <div className="text-xs text-slate-400">{s.handle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Orta + Sağ */}
            <div className="md:col-span-2 space-y-6">
              {/* Form */}
              <div className="bg-white rounded-2xl p-8 border border-slate-100">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-6">Mesaj Gönderin</div>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Adınız</label>
                      <input value={contactForm.name} onChange={e => setContactForm(p => ({...p, name: e.target.value}))}
                        placeholder="Adınız Soyadınız" className={inputCls}/>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">E-posta</label>
                      <input type="email" value={contactForm.email} onChange={e => setContactForm(p => ({...p, email: e.target.value}))}
                        placeholder="ornek@mail.com" className={inputCls}/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Konu</label>
                    <select value={contactForm.subject} onChange={e => setContactForm(p => ({...p, subject: e.target.value}))} className={inputCls}>
                      <option value="">Konu seçin…</option>
                      <option>Üyelik & Hesap</option>
                      <option>Takım Kurma</option>
                      <option>Antrenman Soruları</option>
                      <option>Teknik Sorun</option>
                      <option>İş Birliği & Sponsorluk</option>
                      <option>Öneri & Geri Bildirim</option>
                      <option>Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Mesajınız</label>
                    <textarea value={contactForm.message} onChange={e => setContactForm(p => ({...p, message: e.target.value}))}
                      rows={5} placeholder="Mesajınızı buraya yazın…" className={`${inputCls} resize-none`}/>
                  </div>
                  <button type="submit" disabled={sending}
                    className="w-full py-3.5 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{background:"linear-gradient(135deg,#16A34A,#15803D)", boxShadow:"0 8px 24px rgba(22,163,74,0.3)"}}>
                    {sending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Gönderiliyor…</> : <><Send className="w-4 h-4"/> Mesaj Gönder</>}
                  </button>
                </form>
              </div>

              {/* SSS */}
              <div className="bg-white rounded-2xl p-8 border border-slate-100">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase mb-6">Sık Sorulan Sorular</div>
                <div className="space-y-2">
                  {faqs.map((faq, i) => (
                    <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors">
                        <span className="font-semibold text-slate-800 text-sm pr-4">{faq.q}</span>
                        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-green-500 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}/>
                      </button>
                      {openFaq === i && (
                        <div className="px-5 pb-4 border-t border-slate-50">
                          <p className="text-slate-500 text-sm leading-relaxed pt-3">{faq.a}</p>
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
      title: "KVKK Aydınlatma Metni",
      body: `
<h3>Kişisel Verilerin İşlenmesi Hakkında Aydınlatma Metni</h3>
<p>SALT KREATİF REKLAM TİC. LTD. ŞTİ. ("Şirket") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla kişisel verilerinizi aşağıda açıklanan amaçlar doğrultusunda işlemekteyiz.</p>

<h4>1. Veri Sorumlusu</h4>
<p>SALT KREATİF REKLAM TİC. LTD. ŞTİ.<br/>
Çınarlı Mahallesi 1572 Sokak No:33 PK.35170 Konak, İzmir<br/>
Vergi Dairesi: Karşıyaka V.D. | VN: 7420957827<br/>
E-posta: <a href="mailto:info@sporlaconnect.com">info@sporlaconnect.com</a></p>

<h4>2. İşlenen Kişisel Veriler</h4>
<p>Ad, soyad, e-posta adresi, telefon numarası, profil fotoğrafı, konum bilgisi, uygulama kullanım verileri.</p>

<h4>3. İşleme Amaçları</h4>
<p>Üyelik ve kimlik doğrulama işlemleri, platform hizmetlerinin sunulması, antrenman ve takım özelliklerinin sağlanması, bildirim ve e-posta gönderimi, yasal yükümlülüklerin yerine getirilmesi.</p>

<h4>4. Hukuki Dayanak</h4>
<p>KVKK Madde 5/1 kapsamında açık rıza, Madde 5/2-c kapsamında sözleşmenin ifası, Madde 5/2-ç kapsamında hukuki yükümlülük.</p>

<h4>5. Veri Aktarımı</h4>
<p>Kişisel verileriniz; altyapı hizmet sağlayıcıları (Supabase, Render), e-posta hizmet sağlayıcıları ve yasal zorunluluk halinde kamu kurumlarıyla paylaşılabilir.</p>

<h4>6. Saklama Süresi</h4>
<p>Kişisel verileriniz, üyelik süresince ve üyeliğin sona ermesinden itibaren yasal süreler boyunca saklanır.</p>

<h4>7. Haklarınız</h4>
<p>KVKK Madde 11 kapsamında; verilerinize erişim, düzeltme, silme, işlemenin kısıtlanması, itiraz ve taşınabilirlik haklarına sahipsiniz. Talepleriniz için: <a href="mailto:info@sporlaconnect.com">info@sporlaconnect.com</a></p>
      `
    },
    gizlilik: {
      title: "Gizlilik Politikası",
      body: `
<h3>Gizlilik Politikası</h3>
<p>Son güncelleme: Mayıs 2025</p>

<h4>1. Toplanan Bilgiler</h4>
<p>Muuvlink olarak; kayıt sırasında sağladığınız bilgiler (ad, e-posta), platform kullanımı sırasında oluşan veriler (antrenmanlar, takımlar, konum) ve çerezler aracılığıyla teknik veriler toplarız.</p>

<h4>2. Bilgilerin Kullanımı</h4>
<p>Toplanan veriler; hesabınızı yönetmek, size özel içerik sunmak, platform güvenliğini sağlamak ve yasal yükümlülükleri yerine getirmek amacıyla kullanılır.</p>

<h4>3. Veri Güvenliği</h4>
<p>Verileriniz endüstri standardı şifreleme yöntemleriyle korunmaktadır. Şifreler hash'lenerek saklanır, hiçbir zaman düz metin olarak tutulmaz.</p>

<h4>4. Üçüncü Taraflar</h4>
<p>Verileriniz, hizmet sunumu için gerekli olan üçüncü taraf sağlayıcılarla (altyapı, e-posta) paylaşılabilir. Bu sağlayıcılar gizlilik yükümlülükleriyle bağlıdır.</p>

<h4>5. Çerezler</h4>
<p>Platform deneyiminizi iyileştirmek için çerez kullanılmaktadır. Detaylar için Çerez Politikamızı inceleyiniz.</p>

<h4>6. İletişim</h4>
<p>Gizlilik konularında: <a href="mailto:info@sporlaconnect.com">info@sporlaconnect.com</a></p>
      `
    },
    kullanim: {
      title: "Kullanım Koşulları",
      body: `
<h3>Kullanım Koşulları</h3>
<p>Son güncelleme: Mayıs 2025</p>

<h4>1. Kabul</h4>
<p>Muuvlink platformunu kullanarak bu koşulları kabul etmiş sayılırsınız. Koşulları kabul etmiyorsanız platformu kullanmayınız.</p>

<h4>2. Üyelik</h4>
<p>Platform hizmetlerinden yararlanmak için 18 yaşını doldurmuş olmanız ve doğru bilgilerle kayıt olmanız gerekmektedir. Hesap güvenliğinden siz sorumlusunuz.</p>

<h4>3. Kullanım Kuralları</h4>
<p>Platformda; yanıltıcı, hakaret içeren veya yasadışı içerik paylaşmak, başkalarını taciz etmek, platformun güvenliğini tehdit etmek yasaktır.</p>

<h4>4. İçerik</h4>
<p>Paylaştığınız içeriklerin sorumluluğu size aittir. Şirket, uygunsuz içerikleri kaldırma ve hesabı askıya alma hakkını saklı tutar.</p>

<h4>5. Hizmet Değişiklikleri</h4>
<p>Şirket, platformu önceden haber vermeksizin değiştirme, güncelleme veya durdurma hakkını saklı tutar.</p>

<h4>6. Sorumluluk Sınırlaması</h4>
<p>Platform "olduğu gibi" sunulmaktadır. Şirket, platformun kesintisiz çalışacağını garanti etmez.</p>

<h4>7. Uygulanacak Hukuk</h4>
<p>Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda İzmir mahkemeleri yetkilidir.</p>

<h4>8. İletişim</h4>
<p><a href="mailto:info@sporlaconnect.com">info@sporlaconnect.com</a></p>
      `
    },
    cerez: {
      title: "Çerez Politikası",
      body: `
<h3>Çerez Politikası</h3>
<p>Son güncelleme: Mayıs 2025</p>

<h4>Çerez Nedir?</h4>
<p>Çerezler, tarayıcınız aracılığıyla cihazınıza kaydedilen küçük metin dosyalarıdır. Web sitelerinin sizi tanımasını ve tercihlerinizi hatırlamasını sağlar.</p>

<h4>Kullandığımız Çerezler</h4>
<p><strong>Zorunlu Çerezler:</strong> Platformun temel işlevleri için gereklidir. Oturum yönetimi, güvenlik. Devre dışı bırakılamaz.</p>
<p><strong>İşlevsel Çerezler:</strong> Dil, tercih gibi ayarlarınızı hatırlamak için kullanılır.</p>
<p><strong>Analitik Çerezler:</strong> Platform kullanımını anlamamıza yardımcı olur. Veriler anonim olarak işlenir.</p>

<h4>Çerez Yönetimi</h4>
<p>Tarayıcı ayarlarınızdan çerezleri yönetebilir veya silebilirsiniz. Zorunlu çerezlerin devre dışı bırakılması platform işlevselliğini olumsuz etkileyebilir.</p>

<h4>Onayınız</h4>
<p>Platformu kullanmaya devam ederek çerez kullanımını kabul etmiş sayılırsınız. Onayınızı geri almak için: <a href="mailto:info@sporlaconnect.com">info@sporlaconnect.com</a></p>
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
            style={{"--tw-prose-headings":"#1e293b","--tw-prose-links":"#7c3aed"}}
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
            <span className="font-semibold text-white">🍪 Çerez Bildirimi</span>
            {" "}Platform deneyiminizi geliştirmek için çerezler kullanıyoruz.{" "}
            <button onClick={() => setLegalModal("cerez")} className="text-green-400 hover:text-green-300 underline underline-offset-2 transition-colors">
              Çerez Politikası
            </button>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setLegalModal("cerez")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 transition-colors"
            >
              Detaylar
            </button>
            <button
              onClick={() => { setCookieConsent(true); localStorage.setItem("cookieConsent", "true"); }}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}
            >
              Kabul Et
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
              <button onClick={() => setCurrentPage("home")} className="flex items-center gap-2.5 mb-4 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md" style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}>
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-semibold tracking-tight" style={{background:"linear-gradient(90deg,#a78bfa,#818cf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  Muuvlink
                </span>
              </button>
              <p className="text-slate-400 text-sm leading-relaxed mb-5">
                Spor topluluğunu bir araya getiren platform. Takımlar kur, antrenmanlar planla, spor arkadaşları bul.
              </p>
              <div className="text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-400">SALT KREATİF REKLAM TİC. LTD. ŞTİ.</p>
                <p>Çınarlı Mah. 1572 Sk. No:33</p>
                <p>PK.35170 Konak, İzmir</p>
                <p>Karşıyaka V.D. | VN: 7420957827</p>
              </div>
            </div>

            {/* Kolon 2 — Uygulama */}
            <div>
              <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">Uygulama</h3>
              <ul className="space-y-2.5">
                {footerLinks([
                  { label: "Ana Sayfa",     action: () => setCurrentPage("home") },
                  { label: "Antrenmanlar",  action: () => setCurrentPage("trainings") },
                  { label: "Takımlar",      action: () => setCurrentPage("teams") },
                  { label: "Rozetler",      action: () => setCurrentPage("badges") },
                  { label: "İletişim",      action: () => setCurrentPage("contact") },
                ])}
              </ul>
            </div>

            {/* Kolon 3 — Yasal */}
            <div>
              <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">Yasal</h3>
              <ul className="space-y-2.5">
                {footerLinks([
                  { label: "KVKK Aydınlatma Metni",  action: () => setLegalModal("kvkk") },
                  { label: "Gizlilik Politikası",      action: () => setLegalModal("gizlilik") },
                  { label: "Kullanım Koşulları",       action: () => setLegalModal("kullanim") },
                  { label: "Çerez Politikası",         action: () => setLegalModal("cerez") },
                ])}
              </ul>
            </div>

            {/* Kolon 4 — İletişim */}
            <div>
              <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">İletişim</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5 text-sm text-slate-400">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-400" />
                  <a href="mailto:muuvlinkapp@gmail.com" className="hover:text-white transition-colors">
                    muuvlinkapp@gmail.com
                  </a>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-slate-400">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-400" />
                  <span>Çınarlı Mah. 1572 Sk. No:33<br/>PK.35170 Konak, İzmir</span>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-slate-400">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-400" fill="currentColor" viewBox="0 0 24 24">
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
                  style={{background:"linear-gradient(135deg,#16A34A,#15803D)"}}
                >
                  <MessageCircle className="w-4 h-4" /> Bize Ulaşın
                </button>
              </div>
            </div>

          </div>

          {/* Alt çizgi */}
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-slate-500 text-xs">
              © {new Date().getFullYear()} SALT KREATİF REKLAM TİC. LTD. ŞTİ. — Tüm hakları saklıdır.
            </p>
            <div className="flex items-center gap-4">
              <button onClick={() => setLegalModal("kvkk")} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">KVKK</button>
              <button onClick={() => setLegalModal("gizlilik")} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">Gizlilik</button>
              <button onClick={() => setLegalModal("kullanim")} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">Kullanım Koşulları</button>
            </div>
          </div>
        </div>
      </footer>
    );
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================

  // TOAST BİLDİRİMİ
  const Toast = () => !toast ? null : (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white font-medium max-w-sm transition-all animate-in slide-in-from-bottom-2 ${
      toast.type === "success" ? "bg-emerald-600" :
      toast.type === "error" ? "bg-red-600" : "bg-green-600"
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

      {isAuthModalOpen && <AuthModal
        authMode={authMode} setAuthMode={setAuthMode}
        onClose={() => { setIsAuthModalOpen(false); setAuthMode("login"); }}
        handleLogin={handleLogin} handleRegister={handleRegister}
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