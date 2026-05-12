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

// Module-level component — SporlaConnect içinde OLMAMALI.
// SporlaConnect her 55ms'de re-render ederdi (typewriter state),
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
        background:"linear-gradient(90deg,#38BDF8 0%,#818CF8 45%,#C084FC 85%)",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
      }}>{text}</span>
      <span style={{
        display:"inline-block", width:"3px", height:"0.75em",
        marginLeft:"3px", marginBottom:"1px", verticalAlign:"middle",
        background:"linear-gradient(180deg,#38BDF8,#818CF8)",
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

        <h2 className="text-3xl font-bold mb-2 text-center">{titles[authMode]}</h2>
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
                className="text-sm text-purple-600 hover:underline">
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
              className="text-purple-600 text-sm hover:underline">
              ← Giriş yap
            </button>
          )}
          {authMode === "login" && (
            <button onClick={() => setAuthMode("register")}
              className="text-purple-600">
              Hesabın yok mu? Kaydol
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function SporlaConnect() {
  const [currentPage, setCurrentPage] = useState("home");
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
  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyDistance, setNearbyDistance] = useState(10);
  const [nearbyTrainings, setNearbyTrainings] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [resetToken, setResetToken] = useState(null); // URL'den gelen şifre sıfırlama token'ı
  const [joiningTrainingId, setJoiningTrainingId] = useState(null);
  const [joiningTeamId, setJoiningTeamId] = useState(null);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLocationName, setManualLocationName] = useState("");
  const [banners, setBanners] = useState([]);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0);
  const [exitingBannerIdx, setExitingBannerIdx] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDir, setSlideDir] = useState("next"); // "next" | "prev"
  const bannerTimerRef = useRef(null);
  const currentBannerIdxRef = useRef(0);
  const goToRef = useRef(null);
  const [platformStats, setPlatformStats] = useState(null);

  // Avatar'ı render et: URL ise <img>, değilse emoji/harf
  const renderAvatar = (avatar, name, className = "") => {
    if (avatar?.startsWith("/uploads/")) {
      return <img src={`${BASE_URL}${avatar}`} alt="" className={`w-full h-full object-cover ${className}`} />;
    }
    if (avatar?.startsWith("http")) {
      return <img src={avatar} alt="" className={`w-full h-full object-cover ${className}`} />;
    }
    return avatar || (name?.[0]?.toUpperCase() ?? "?");
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
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
              className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-60 flex items-center gap-1"
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
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 text-sm border-b last:border-0 flex items-start gap-2"
                >
                  <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
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
    { icon: Users,    label: "Kayıtlı Sporcu",       value: fmtNum(platformStats?.users),     color: "text-violet-400" },
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
      bg: "bg-violet-50",
      num: "01",
    },
    {
      icon: Users,
      title: "Takım Oluştur",
      description: "Kendi takımını kur, üye davet et, gizlilik ayarlarını belirle ve birlikte antrenman yap.",
      color: "from-indigo-500 to-blue-600",
      bg: "bg-indigo-50",
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

    // Platform istatistiklerini çek
    fetch(`${API_URL}/platform-stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlatformStats(data); })
      .catch(() => {});
  }, []);

  // URL'de reset_token varsa şifre sıfırlama sayfasına yönlendir
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("reset_token");
    if (t) {
      setResetToken(t);
      setCurrentPage("reset-password");
      window.history.replaceState({}, "", window.location.pathname);
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

  // Sayfa değişince document.title güncelle
  useEffect(() => {
    const titles = {
      home: "SporlaConnect — Spor Arkadaşı Bul",
      trainings: "Antrenmanlar — SporlaConnect",
      teams: "Takımlar — SporlaConnect",
      profile: "Profilim — SporlaConnect",
      "create-training": "Antrenman Oluştur — SporlaConnect",
      "create-team": "Takım Kur — SporlaConnect",
      contact: "İletişim — SporlaConnect",
      badges: "Rozetlerim — SporlaConnect",
      "reset-password": "Şifre Sıfırla — SporlaConnect",
    };
    document.title = titles[currentPage] || "SporlaConnect";
  }, [currentPage]);

  // currentBannerIdx ref'i güncel tut (interval stale closure'dan kaçınmak için)
  useEffect(() => { currentBannerIdxRef.current = currentBannerIdx; }, [currentBannerIdx]);

  // Banner otomatik geçiş — goToRef üzerinden (her zaman taze goTo)
  useEffect(() => {
    if (banners.length <= 1) return;
    bannerTimerRef.current = setInterval(() => {
      const next = (currentBannerIdxRef.current + 1) % banners.length;
      goToRef.current?.(next);
    }, 5500);
    return () => clearInterval(bannerTimerRef.current);
  }, [banners.length]);


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
    const endpoint = token ? '/trainings' : '/trainings/public';
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${API_URL}${endpoint}`, { headers });

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
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedTraining(data.training);
        setCurrentPage("training-detail");
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

  const handleDeleteTraining = async (trainingId) => {
    if (!confirm("Silmek istediğinize emin misiniz?")) return;

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

  const handleDeleteTeam = async (teamId) => {
    if (!confirm("Takımı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;
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
        if (myRole === 'owner' || myRole === 'coach') {
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

  const handleCancelInvitation = async (teamId, inviteId) => {
    if (!confirm("Daveti iptal etmek istediğinize emin misiniz?")) return;
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

  const handleRemoveMember = async (teamId, userId) => {
    if (!confirm("Üyeyi çıkarmak istediğinize emin misiniz?")) return;

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

  // ── HERO BANNER SLİDER ──────────────────────────────────────
  const HeroSection = () => {
    const b    = banners[currentBannerIdx]    || null;
    const exitB = exitingBannerIdx !== null ? (banners[exitingBannerIdx] || null) : null;

    const gFrom = b?.gradient_from || "#080B1F";
    const gVia  = b?.gradient_via  || "#0E1F4A";
    const gTo   = b?.gradient_to   || "#0A3070";

    // Giriş / çıkış animasyonları yöne göre
    const enterTextAnim = slideDir === "next"
      ? "bnEnterRight 0.5s cubic-bezier(0.22,1,0.36,1) both"
      : "bnEnterLeft  0.5s cubic-bezier(0.22,1,0.36,1) both";
    const exitTextAnim = slideDir === "next"
      ? "bnExitLeft  0.38s ease forwards"
      : "bnExitRight 0.38s ease forwards";
    const enterImgAnim = slideDir === "next"
      ? "bnEnterRight 0.55s cubic-bezier(0.22,1,0.36,1) 0.06s both"
      : "bnEnterLeft  0.55s cubic-bezier(0.22,1,0.36,1) 0.06s both";
    const exitImgAnim = slideDir === "next"
      ? "bnExitLeft  0.38s ease forwards"
      : "bnExitRight 0.38s ease forwards";

    const goTo = (idx) => {
      if (idx === currentBannerIdx || isTransitioning) return;
      clearInterval(bannerTimerRef.current);
      const dir = idx > currentBannerIdx ? "next" : "prev";
      setSlideDir(dir);
      setExitingBannerIdx(currentBannerIdx);
      setCurrentBannerIdx(idx);
      setIsTransitioning(true);
      setTimeout(() => {
        setExitingBannerIdx(null);
        setIsTransitioning(false);
        // Geçiş bittikten sonra otomatik döngüyü yeniden başlat
        if (banners.length > 1) {
          bannerTimerRef.current = setInterval(() => {
            const next = (currentBannerIdxRef.current + 1) % banners.length;
            goToRef.current?.(next);
          }, 5500);
        }
      }, 480);
    };
    // Her render'da ref'i taze goTo ile güncelle (interval stale olmaz)
    goToRef.current = goTo;

    const handleCtaClick = (url, defaultAction) => {
      if (!url) { defaultAction(); return; }
      if (url.startsWith("http://") || url.startsWith("https://")) {
        window.open(url, "_blank", "noopener");
      } else {
        setCurrentPage(url.replace(/^\//, "") || "home");
      }
    };

    // Sol metin bloğunu verilen banner için render et
    const renderLeft = (banner, animStyle, isMotto) => {
      const bgF = banner?.gradient_from || "#080B1F";
      const hasImg = bannersLoaded && banner?.image_url && banner.image_url !== "";
      return (
        <div className="bn-text-col z-10 space-y-7 pr-8 pb-28 flex flex-col justify-center" style={animStyle}>
          {/* Rozet pill */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-bold border backdrop-blur-sm"
            style={{background:"rgba(255,255,255,0.06)",borderColor:"rgba(255,255,255,0.12)",color:"rgba(186,230,253,0.9)"}}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{background:"#38BDF8"}}/>
            {banner?.badge_text || "🏃 500+ Aktif Sporcu"}
            <span className="w-px h-3 bg-white/20"/>
            <span className="text-white/50 font-normal text-xs">Türkiye geneli</span>
          </div>

          {/* Başlık + typewriter */}
          <div>
            <div className="overflow-hidden">
              <div className="bn-title font-black text-white whitespace-nowrap"
                style={{fontSize:"clamp(2.8rem,5.5vw,4.5rem)",lineHeight:1.1,letterSpacing:"-0.02em"}}>
                {banner?.title || "Sporla Buluş,"}
              </div>
              <div className="bn-title font-black whitespace-nowrap"
                style={{fontSize:"clamp(2.8rem,5.5vw,4.5rem)",lineHeight:1.15,letterSpacing:"-0.02em",minHeight:"1.2em"}}>
                {isMotto ? (
                  <Typewriter mottos={(banner?.mottos?.length > 0) ? banner.mottos : DEFAULT_MOTTOS}/>
                ) : (
                  <span style={{background:"linear-gradient(90deg,#38BDF8 0%,#818CF8 45%,#C084FC 85%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",opacity:0.5}}>
                    &nbsp;
                  </span>
                )}
              </div>
            </div>
            <p className="mt-6 text-lg text-blue-200/70 leading-relaxed max-w-md font-light">
              {banner?.subtitle || "Çevrende spor yapan insanları bul, kendi takımını kur, antrenmanlar planla. GPS ile en yakın etkinlikleri saniyeler içinde keşfet."}
            </p>
          </div>

          {/* CTA butonları */}
          {isMotto && (
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {!user ? (
                <>
                  <button
                    onClick={() => handleCtaClick(banner?.cta_primary_url, () => { setAuthMode("register"); setIsAuthModalOpen(true); })}
                    className="group relative flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold text-white text-sm overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
                    style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",boxShadow:"0 8px 32px rgba(99,102,241,0.4)"}}
                  >
                    <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"/>
                    {banner?.cta_primary_text || "Hemen Başla"}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); }}
                    className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 hover:bg-white/10"
                    style={{color:"rgba(186,230,253,0.85)",border:"1px solid rgba(255,255,255,0.14)"}}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                    </svg>
                    Giriş Yap
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleCtaClick(banner?.cta_primary_url, () => setCurrentPage("trainings"))}
                    className="group relative flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold text-white text-sm overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
                    style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",boxShadow:"0 8px 32px rgba(99,102,241,0.4)"}}
                  >
                    <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"/>
                    {banner?.cta_primary_text || "Hemen Başla"}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                    </svg>
                  </button>
                  {banner?.cta_secondary_text && (
                    <button
                      onClick={() => handleCtaClick(banner?.cta_secondary_url, () => setCurrentPage("teams"))}
                      className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 hover:bg-white/10"
                      style={{color:"rgba(186,230,253,0.85)",border:"1px solid rgba(255,255,255,0.14)"}}
                    >
                      {banner.cta_secondary_text}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* İstatistik çubuğu */}
          {isMotto && (
            <div className="bn-stats flex items-center gap-6 pt-3">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {["#6366F1","#8B5CF6","#EC4899","#06B6D4"].map((c,i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{background:c,borderColor:bgF}}>
                      {["M","A","E","K"][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-white text-sm font-bold">{fmtNum(platformStats?.users) || "—"}</div>
                  <div className="text-blue-200/50 text-xs">kayıtlı sporcu</div>
                </div>
              </div>
              <div className="w-px h-10 bg-white/10"/>
              {stats.slice(0,2).map((s,i) => (
                <div key={i}>
                  <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-blue-200/50 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    // Sağ görsel bloğunu render et. noFloat=true → çıkış overlay'inde float çalışmaz
    const renderRight = (banner, animStyle, noFloat = false) => {
      const hasImg = bannersLoaded && banner?.image_url && banner.image_url !== "";
      return (
        <div className="bn-img-col relative">
          <div className="absolute inset-0 flex items-end justify-center" style={{overflow:"visible", ...animStyle}}>
            {hasImg ? (
              <>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-3xl pointer-events-none"
                  style={{background:"radial-gradient(ellipse,rgba(56,189,248,0.25) 0%,rgba(99,102,241,0.12) 55%,transparent 70%)"}}/>
                <div className="absolute top-16 right-0 w-36 h-36 rounded-full pointer-events-none"
                  style={{border:"1px solid rgba(56,189,248,0.14)"}}/>
                <div className="relative z-10" style={{
                  animation: noFloat ? "none" : "heroFloat 5s ease-in-out infinite",
                  marginBottom:"-100px",
                }}>
                  <img
                    src={`${BASE_URL}${banner.image_url}`}
                    alt=""
                    className="w-auto select-none pointer-events-none"
                    style={{height:"700px",maxWidth:"none",objectFit:"contain",objectPosition:"bottom center",filter:"drop-shadow(0 40px 100px rgba(8,11,31,0.85))"}}
                  />
                </div>
              </>
            ) : null}
          </div>
        </div>
      );
    };

    return (
      <div className="relative" style={{
        background:`linear-gradient(115deg, ${gFrom} 0%, ${gVia} 45%, ${gTo} 100%)`,
        transition:"background 0.7s ease",
      }}>
        {/* Arka plan dekorları */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -left-32 top-1/4 w-[600px] h-[600px] rounded-full"
            style={{background:"radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 65%)"}}/>
          <div className="absolute right-[-60px] top-[-40px] w-[700px] h-[700px] rounded-full"
            style={{background:"radial-gradient(circle,rgba(56,189,248,0.12) 0%,transparent 60%)"}}/>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full"
            style={{background:"radial-gradient(circle,rgba(124,58,237,0.15) 0%,transparent 60%)"}}/>
          <div className="absolute inset-0 opacity-[0.035]"
            style={{backgroundImage:"linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)",backgroundSize:"64px 64px"}}/>
        </div>

        {/* ── Ana içerik — z-index:2 → dalganın üstünde ── */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{zIndex:2}}>

          {/* Grid: position:relative → exit overlay bu div'e göre hizalanır, padding eşleşir */}
          <div className="bn-grid relative" style={{display:"grid", gridTemplateColumns:"55% 45%", minHeight:"680px", paddingTop:"112px"}}>

            {/* Çıkan banner overlay — grid div'ine absolute, padding eşleşir */}
            {exitB && (
              <div className="bn-grid" style={{
                position:"absolute", inset:0, paddingTop:"112px",
                display:"grid", gridTemplateColumns:"55% 45%",
                zIndex:10, pointerEvents:"none",
              }}>
                {renderLeft(exitB,  {animation: exitTextAnim}, false)}
                {renderRight(exitB, {animation: exitImgAnim}, true)}
              </div>
            )}

            {/* Giren banner — grid item'ları */}
            {renderLeft(b,  {animation: isTransitioning ? enterTextAnim : undefined}, true)}
            {renderRight(b, {animation: isTransitioning ? enterImgAnim  : undefined})}

          </div>

        </div>

        {/* ── Sağ dikey navigasyon ── */}
        {banners.length > 1 && (
          <div className="bn-nav" style={{
            position:"absolute", right:"28px", top:"50%", transform:"translateY(-50%)",
            zIndex:30, display:"flex", flexDirection:"column", alignItems:"center", gap:"10px",
          }}>
            <button
              onClick={() => goTo((currentBannerIdx - 1 + banners.length) % banners.length)}
              style={{width:"30px",height:"30px",borderRadius:"50%",border:"none",cursor:"pointer",background:"rgba(255,255,255,0.09)",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s,transform 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.2)";e.currentTarget.style.transform="scale(1.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.09)";e.currentTarget.style.transform="scale(1)";}}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 15l7-7 7 7"/></svg>
            </button>

            {banners.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} style={{
                width:"5px", height: i===currentBannerIdx?"22px":"5px",
                borderRadius:"3px", border:"none", cursor:"pointer", padding:0,
                background: i===currentBannerIdx?"linear-gradient(180deg,#38BDF8,#818CF8)":"rgba(255,255,255,0.28)",
                transition:"all 0.38s cubic-bezier(0.34,1.56,0.64,1)",
              }}/>
            ))}

            <button
              onClick={() => goTo((currentBannerIdx + 1) % banners.length)}
              style={{width:"30px",height:"30px",borderRadius:"50%",border:"none",cursor:"pointer",background:"rgba(255,255,255,0.09)",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s,transform 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.2)";e.currentTarget.style.transform="scale(1.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.09)";e.currentTarget.style.transform="scale(1)";}}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 9l-7 7-7-7"/></svg>
            </button>
          </div>
        )}

        {/* Alt dalga — z:1, içerik z:2 → görsel dalgadan taşar */}
        <div className="absolute bottom-0 left-0 right-0" style={{zIndex:1}}>
          <svg viewBox="0 0 1440 100" className="w-full" preserveAspectRatio="none">
            <path fill="#f8fafc" d="M0,50 C240,100 480,0 720,50 C960,100 1200,0 1440,50 L1440,100 L0,100 Z"/>
          </svg>
        </div>

        <style>{`
          /* Giriş animasyonları */
          @keyframes bnEnterRight { from{opacity:0;transform:translateX(70px)} to{opacity:1;transform:translateX(0)} }
          @keyframes bnEnterLeft  { from{opacity:0;transform:translateX(-70px)} to{opacity:1;transform:translateX(0)} }
          /* Çıkış animasyonları */
          @keyframes bnExitLeft   { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(-70px)} }
          @keyframes bnExitRight  { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(70px)} }
          /* Görsel salınım */
          @keyframes heroFloat {
            0%,100% { transform: translateY(0px); }
            45%     { transform: translateY(-14px); }
            70%     { transform: translateY(-8px); }
          }
          /* Typewriter imleci */
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

          /* ── Mobil responsive ── */
          @media (max-width: 767px) {
            .bn-grid {
              display: flex !important;
              flex-direction: column !important;
              min-height: auto !important;
              padding-top: 88px !important;
              padding-bottom: 40px;
            }
            .bn-text-col {
              padding-right: 0 !important;
              padding-bottom: 0 !important;
            }
            .bn-img-col { display: none !important; }
            .bn-nav    { display: none !important; }
            .bn-title  { white-space: normal !important; font-size: clamp(2rem,9vw,2.8rem) !important; }
            .bn-stats  { display: none !important; }
          }
        `}</style>
      </div>
    );
  };

  const FeaturesSection = () => (
    <div className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold text-violet-700 bg-violet-100 mb-4">
            ✦ Özellikler
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
            Neden{" "}
            <span style={{background:"linear-gradient(90deg,#7C3AED,#4F46E5)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              SporlaConnect?
            </span>
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Spor yapmayı seven insanları bir araya getiren, akıllı ve sosyal spor platformu.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-2xl p-8 border border-slate-100 hover:border-violet-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* Numara arka planda */}
              <div className="absolute top-6 right-6 text-6xl font-black text-slate-100 select-none leading-none">
                {feature.num}
              </div>
              <div className={`relative w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const TrainingCard = ({ training, onClick }) => {
  const progress = training.attendee_count
    ? (training.attendee_count / training.capacity) * 100
    : 0;
  const isOwner = user && training.team_owner_id === user.id;
  const hasCoords = training.location_lat && training.location_lng;

  // Mesafeyi backend'den al ya da client-side hesapla
  const distanceKm = training.distance != null
    ? Number(training.distance)
    : (userLocation && hasCoords
        ? haversineKm(userLocation.lat, userLocation.lng, Number(training.location_lat), Number(training.location_lng))
        : null);

  const difficultyConfig = {
    "Kolay":   { cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
    "Orta":    { cls: "bg-amber-100 text-amber-700",   dot: "bg-amber-500" },
    "Zor":     { cls: "bg-rose-100 text-rose-700",     dot: "bg-rose-500" },
  };
  const diff = difficultyConfig[training.difficulty] || difficultyConfig["Orta"];

  return (
    <div className="group bg-white rounded-2xl border border-slate-100 hover:border-violet-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col">
      {/* Renkli sport header */}
      <div className="cursor-pointer" onClick={() => onClick(training.id)}>
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide text-violet-700 bg-violet-100">
            {training.team_sport || "Genel"}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOwner && !hasCoords && (
              <span title="GPS yok" className="px-2 py-1 bg-orange-100 text-orange-600 rounded-lg text-xs flex items-center gap-1">
                <MapPin className="w-3 h-3"/> GPS yok
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${diff.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${diff.dot}`}/>
              {training.difficulty || "Orta"}
            </span>
          </div>
        </div>

        <div className="px-5 pb-4">
          <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-violet-700 transition-colors line-clamp-1">{training.title}</h3>
          <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">{training.description}</p>
        </div>

        <div className="mx-5 mb-4 bg-slate-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center text-slate-600 text-xs gap-2">
            <MapPin className="w-3.5 h-3.5 text-violet-500 flex-shrink-0"/>
            <span className="truncate">{training.location_name}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center text-slate-600 text-xs gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500"/>
              {new Date(training.training_date).toLocaleDateString("tr-TR")}
            </div>
            <div className="flex items-center text-slate-600 text-xs gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500"/>
              {training.training_time}
            </div>
          </div>
          {distanceKm != null && (
            <div className="flex items-center text-emerald-600 text-xs font-semibold gap-1.5">
              <Navigation2 className="w-3.5 h-3.5"/>
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m uzakta` : `${distanceKm.toFixed(1)} km uzakta`}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Katılımcılar</span>
            <span className="font-semibold text-slate-700">{training.attendee_count || 0}/{training.capacity}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="h-full rounded-full transition-all" style={{width:`${progress}%`, background:"linear-gradient(90deg,#7C3AED,#4F46E5)"}}/>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); handleJoinTraining(training.id); }}
          disabled={joiningTrainingId === training.id}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-300 hover:opacity-90 hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
          style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}
        >
          {joiningTrainingId === training.id ? (
            <><Loader2 className="w-4 h-4 animate-spin"/> Katılınıyor…</>
          ) : "Katıl →"}
        </button>
      </div>
    </div>
  );
};

  const TeamCard = ({ team, onClick }) => (
    <div
      onClick={() => onClick(team.id)}
      className="group bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Dekoratif üst şerit */}
      <div className="h-1.5 w-full" style={{background:"linear-gradient(90deg,#7C3AED,#4F46E5,#06B6D4)"}}/>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-md flex-shrink-0"
              style={{background:"linear-gradient(135deg,#7C3AED22,#4F46E522)",border:"1.5px solid #7C3AED33"}}>
              {team.avatar || "🏅"}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate group-hover:text-violet-700 transition-colors">{team.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-semibold">{team.sport}</span>
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
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg" style={{
              background: team.my_role === 'owner' ? '#FEF3C7' : team.my_role === 'coach' ? '#EDE9FE' : '#F0FDF4',
              color: team.my_role === 'owner' ? '#92400E' : team.my_role === 'coach' ? '#5B21B6' : '#166534',
            }}>
              {team.my_role === 'owner' ? '🏆 Sahip' : team.my_role === 'coach' ? '🎯 Antrenör' : '👤 Üye'}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const BadgeCard = ({ badge, earned }) => (
    <div
      className={`p-6 rounded-2xl border-2 ${
        earned ? "border-yellow-400 bg-yellow-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="text-center mb-4">
        <div className={`text-6xl mb-2 ${earned ? "" : "grayscale opacity-50"}`}>
          {badge.icon}
        </div>
        <h3 className="font-bold text-lg">{badge.name}</h3>
        <p className="text-sm text-gray-600">{badge.description}</p>
      </div>
      {earned && badge.earned_at && (
        <div className="text-xs text-center text-gray-500">
          {new Date(badge.earned_at).toLocaleDateString("tr-TR")}
        </div>
      )}
    </div>
  );

  // =====================================================
  // PAGES
  // =====================================================

  const HomePage = () => (
    <>
      <HeroSection />
      <FeaturesSection />

      {/* YAKINIMDAKI ANTRENMANLAR */}
      <div className="py-20 bg-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5" style={{background:"radial-gradient(circle,#7C3AED,transparent 70%)"}}/>
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-5" style={{background:"radial-gradient(circle,#4F46E5,transparent 70%)"}}/>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold text-violet-700 bg-violet-100 mb-4">
            <MapPin className="w-4 h-4 inline mr-1" /> GPS Destekli Arama
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-3 tracking-tight">Yakınındaki Antrenmanları Bul</h2>
          <p className="text-slate-500 mb-10 max-w-lg mx-auto">Konumuna göre sana en yakın etkinlikleri saniyeler içinde keşfet</p>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[5, 10, 25, 50].map((km) => (
              <button
                key={km}
                onClick={() => setNearbyDistance(km)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all duration-200 ${
                  nearbyDistance === km
                    ? "border-violet-600 text-white shadow-lg"
                    : "border-slate-200 text-slate-600 hover:border-violet-400 bg-white hover:text-violet-600"
                }`}
                style={nearbyDistance === km ? {background:"linear-gradient(135deg,#7C3AED,#4F46E5)"} : {}}
              >
                {km} km
              </button>
            ))}
          </div>

          <button
            onClick={() => handleNearbySearch()}
            disabled={locationLoading}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-white text-base transition-all duration-300 hover:opacity-90 hover:shadow-xl hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 shadow-lg"
            style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}
          >
            {locationLoading ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Konum alınıyor…</>
            ) : (
              <><MapPin className="w-5 h-5"/> Yakınımda Ara</>
            )}
          </button>
        </div>
      </div>

      {/* YAKLAŞAN ANTRENMANLAR */}
      <div className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-indigo-700 bg-indigo-100 mb-3">✦ Keşfet</div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Yaklaşan Antrenmanlar</h2>
            </div>
            <button
              onClick={() => setCurrentPage("trainings")}
              className="flex items-center gap-1.5 text-sm font-bold text-violet-700 hover:text-violet-800 transition-colors"
            >
              Tümünü Gör
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            </button>
          </div>
          {trainings.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {trainings.slice(0, 6).map((training) => (
                <TrainingCard key={training.id} training={training} onClick={fetchTrainingDetails} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <Activity className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold mb-1">Antrenman yüklenemedi</p>
              <p className="text-slate-400 text-sm">Backend sunucusunun çalıştığından emin olun</p>
              <button onClick={fetchTrainings} className="mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200 transition-colors">
                Tekrar Dene
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CTA BANNER */}
      {!user && (
        <div className="py-20" style={{background:"linear-gradient(135deg,#0D0B26,#1a1040,#0f2044)"}}>
          <div className="max-w-3xl mx-auto px-4 text-center">
            <div className="mb-4 flex justify-center"><Dumbbell className="w-14 h-14 text-violet-400" /></div>
            <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Spor topluluğuna katıl!</h2>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">Ücretsiz kaydol, takımlar kur, antrenmanlar planla. Binlerce sporcu seni bekliyor.</p>
            <button
              onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); }}
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-105 hover:shadow-2xl shadow-lg"
              style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}
            >
              Ücretsiz Kaydol
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );

  const ProfilePage = () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl p-8 border">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full overflow-hidden flex items-center justify-center text-white text-3xl font-bold shadow-md">
              {(user?.avatar?.startsWith("/uploads/") || user?.avatar?.startsWith("http")) ? (
                <img src={user.avatar.startsWith("http") ? user.avatar : `${BASE_URL}${user.avatar}`} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                user?.avatar || user?.name?.[0]?.toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{user?.name}</h1>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => setShowProfileEdit(true)}
            className="px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Ayarlar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-purple-50 rounded-xl">
            <div className="text-3xl font-bold text-purple-600">
              {userStats?.total_trainings || 0}
            </div>
            <div className="text-sm text-gray-600">Antrenman</div>
          </div>
          <div className="p-4 bg-pink-50 rounded-xl">
            <div className="text-3xl font-bold text-pink-600">{myTeams.length}</div>
            <div className="text-sm text-gray-600">Takım</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl">
            <div className="text-3xl font-bold text-blue-600">{userBadges.length}</div>
            <div className="text-sm text-gray-600">Rozet</div>
          </div>
          <div className="p-4 bg-green-50 rounded-xl">
            <div className="text-3xl font-bold text-green-600">
              {userStats?.total_distance || 0} km
            </div>
            <div className="text-sm text-gray-600">Mesafe</div>
          </div>
        </div>

        {/* ACTIVITY CHART - YENİ! */}
        {activityData.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              📊 Haftalık Aktivite
            </h3>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    cursor={{ fill: 'rgba(147, 51, 234, 0.1)' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="url(#colorGradient)" 
                    radius={[8, 8, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9333ea" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-sm text-gray-500 text-center mt-4">
                Son 7 günlük antrenman aktivitesi
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-8">
          <button
            onClick={() => setCurrentPage("create-training")}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg flex items-center justify-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Yeni Antrenman Oluştur</span>
          </button>
          <button
            onClick={() => setCurrentPage("create-team")}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg flex items-center justify-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Yeni Takım Oluştur</span>
          </button>
          <button
            onClick={() => setCurrentPage("badges")}
            className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg flex items-center justify-center space-x-2"
          >
            <Award className="w-5 h-5" />
            <span>Rozetlerim</span>
          </button>
        </div>

        {myTrainings.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4">Antrenmanlarım</h3>
            <div className="space-y-4">
              {myTrainings.slice(0, 5).map((training) => (
                <div
                  key={training.id}
                  onClick={() => fetchTrainingDetails(training.id)}
                  className="p-4 border rounded-xl hover:shadow-lg transition-all cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-bold">{training.title}</h4>
                    <p className="text-sm text-gray-600">{training.location_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(training.training_date).toLocaleDateString("tr-TR")} -{" "}
                      {training.training_time}
                    </p>
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-400 rotate-[-90deg]" />
                </div>
              ))}
            </div>
          </div>
        )}

        {myTeams.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4">Takımlarım</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {myTeams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => fetchTeamDetails(team.id)}
                  className="p-4 border rounded-xl hover:shadow-lg transition-all cursor-pointer"
                >
                  <h4 className="font-bold">{team.name}</h4>
                  <p className="text-sm text-gray-600">{team.sport}</p>
                  <p className="text-xs text-gray-500 mt-1">{team.member_count} üye</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const TrainingsPage = () => {
    const sports = ["Futbol", "Basketbol", "Tenis", "Yüzme", "Koşu", "Bisiklet", "Voleybol", "Fitness", "Yoga", "Diğer"];
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
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold">Antrenmanlar</h1>
          {user && (
            <button
              onClick={() => setCurrentPage("create-training")}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Oluştur
            </button>
          )}
        </div>

        {/* ARAMA + FİLTRELER */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Antrenman veya konum ara..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
          >
            <option value="">Tüm Sporlar</option>
            {sports.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
          >
            <option value="">Tüm Seviyeler</option>
            {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {(searchQuery || sportFilter || levelFilter) && (
            <button
              onClick={() => { setSearchQuery(""); setSportFilter(""); setLevelFilter(""); }}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm text-gray-600 flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Temizle
            </button>
          )}
        </div>

        {/* MANUEL KONUM ARAMA PANELİ */}
        {showManualLocation && <ManualLocationSearch />}

        {/* AKTİF KONUM BİLGİSİ */}
        {nearbyMode && userLocation && !showManualLocation && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm">
            <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-green-700 font-medium flex-1">
              {manualLocationName || "Mevcut Konumum"}
            </span>
            <button
              onClick={() => setShowManualLocation(true)}
              className="text-xs text-purple-600 hover:underline flex-shrink-0"
            >
              Değiştir
            </button>
          </div>
        )}

        {/* KONUM FİLTRESİ */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 mb-8 border border-purple-100">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={handleExitNearby}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  !nearbyMode
                    ? "bg-purple-600 text-white shadow-md"
                    : "bg-white text-gray-600 hover:bg-gray-50 border"
                }`}
              >
                Tüm Antrenmanlar
              </button>
              <button
                onClick={() => handleNearbySearch()}
                disabled={locationLoading}
                className={`px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                  nearbyMode
                    ? "bg-purple-600 text-white shadow-md"
                    : "bg-white text-gray-600 hover:bg-gray-50 border"
                } disabled:opacity-60`}
              >
                {locationLoading ? (
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                Yakınımda
              </button>
            </div>

            {nearbyMode && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 font-medium">Mesafe:</span>
                {[5, 10, 25, 50].map((km) => (
                  <button
                    key={km}
                    onClick={() => handleDistanceChange(km)}
                    disabled={nearbyLoading}
                    className={`px-3 py-1 rounded-full text-sm font-medium border transition-all disabled:opacity-60 ${
                      nearbyDistance === km
                        ? "border-purple-600 bg-purple-600 text-white"
                        : "border-gray-300 text-gray-600 hover:border-purple-400 bg-white"
                    }`}
                  >
                    {km} km
                  </button>
                ))}
                {nearbyLoading && (
                  <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                )}
              </div>
            )}

            {nearbyMode && userLocation && (
              <span className="ml-auto text-sm text-green-600 font-medium flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {nearbyLoading ? "Aranıyor..." : `${nearbyTrainings.length} sonuç · ${nearbyDistance} km içinde`}
              </span>
            )}
          </div>
        </div>

        {nearbyLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            <p className="text-gray-500 font-medium">{nearbyDistance} km içinde aranıyor...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {displayedTrainings.map((training) => (
              <TrainingCard key={training.id} training={training} onClick={fetchTrainingDetails} />
            ))}
          </div>
        )}

        {!nearbyLoading && displayedTrainings.length === 0 && (
          <div className="text-center py-20">
            <MapPin className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            {nearbyMode ? (
              <>
                <p className="text-gray-700 text-lg font-semibold mb-2">
                  {nearbyDistance} km içinde antrenman bulunamadı
                </p>
                <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                  Yakınımda araması yalnızca GPS koordinatı eklenmiş antrenmanları gösterir.
                  Antrenman oluştururken "Konum Ara" veya "Bulunduğum Konumu Kullan" ile koordinat ekleyin.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {[10, 25, 50].filter(k => k > nearbyDistance).map(k => (
                    <button
                      key={k}
                      onClick={() => handleDistanceChange(k)}
                      className="px-5 py-2 bg-purple-100 text-purple-600 rounded-full font-medium hover:bg-purple-200"
                    >
                      {k} km'ye genişlet
                    </button>
                  ))}
                  {user && (
                    <button
                      onClick={() => setCurrentPage("create-training")}
                      className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-medium"
                    >
                      + Koordinatlı Antrenman Oluştur
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4 border border-violet-100">
                  <Activity className="w-9 h-9 text-violet-300" />
                </div>
                <p className="text-slate-700 font-bold text-lg mb-1">Henüz antrenman yok</p>
                <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">İlk antrenmanı sen oluştur ve spor arkadaşlarını topla!</p>
                {user && (
                  <button
                    onClick={() => setCurrentPage("create-training")}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 hover:shadow-lg shadow-md"
                    style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}
                  >
                    <Plus className="w-4 h-4" /> Antrenman Oluştur
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const TeamsPage = () => {
    const sports = ["Futbol", "Basketbol", "Tenis", "Yüzme", "Koşu", "Bisiklet", "Voleybol", "Fitness", "Yoga", "Diğer"];
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
      {/* Teams Page Header */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex justify-between items-end mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-indigo-700 bg-indigo-100 mb-2">🛡️ Takımlar</div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Takımları Keşfet</h1>
              <p className="text-slate-500 mt-1">Sana uygun takımı bul ya da kendi takımını kur</p>
            </div>
            {user && (
              <button
                onClick={() => setCurrentPage("create-team")}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 hover:shadow-lg shadow-md"
                style={{background:"linear-gradient(135deg,#4F46E5,#06B6D4)"}}
              >
                <Plus className="w-4 h-4" />
                Yeni Takım
              </button>
            )}
          </div>

          {/* Arama + Filtre */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Takım ara…"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
              />
            </div>
            <select
              value={teamSport}
              onChange={(e) => setTeamSport(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
            >
              <option value="">Tüm Sporlar</option>
              {sports.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {(teamSearch || teamSport) && (
              <button
                onClick={() => { setTeamSearch(""); setTeamSport(""); }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm text-slate-600 flex items-center gap-1.5 transition"
              >
                <X className="w-4 h-4"/> Temizle
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {filteredTeams.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <TeamCard key={team.id} team={team} onClick={fetchTeamDetails} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            {teamSearch || teamSport ? (
              <>
                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-9 h-9 text-slate-300"/>
                </div>
                <p className="text-slate-700 font-bold text-lg mb-1">Sonuç bulunamadı</p>
                <p className="text-slate-400 text-sm mb-5">Farklı bir arama veya spor dalı dene</p>
                <button
                  onClick={() => { setTeamSearch(""); setTeamSport(""); }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Filtreleri Temizle
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                  <Users className="w-9 h-9 text-indigo-300"/>
                </div>
                <p className="text-slate-700 font-bold text-lg mb-1">Henüz takım yok</p>
                <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">İlk takımı sen kur, üyeleri davet et ve birlikte spor yap!</p>
                {user && (
                  <button
                    onClick={() => setCurrentPage("create-team")}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 hover:shadow-lg shadow-md"
                    style={{background:"linear-gradient(135deg,#4F46E5,#06B6D4)"}}
                  >
                    <Plus className="w-4 h-4" /> Takım Kur
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

  const BadgesPage = () => (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <button
        onClick={() => setCurrentPage("profile")}
        className="flex items-center text-purple-600 mb-6 hover:underline"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Geri Dön
      </button>

      <h1 className="text-4xl font-bold mb-8">Rozetler</h1>

      <div className="bg-white p-6 rounded-2xl border mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {userBadges.length} / {badges.length} Rozet
            </h2>
            <p className="text-gray-600">Kazandığın rozetler</p>
          </div>
          <Trophy className="w-14 h-14 text-yellow-500" />
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {badges.map((badge) => {
          const earned = userBadges.find((ub) => ub.id === badge.id);
          return <BadgeCard key={badge.id} badge={earned || badge} earned={!!earned} />;
        })}
      </div>
    </div>
  );
  const TrainingDetailPage = () => {
    if (!selectedTraining) return null;

    const isMyTraining = myTeams.some((team) => team.id === selectedTraining.team_id);
    const isOwner = user && selectedTraining.team_owner_id === user.id;
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
          className="flex items-center text-purple-600 mb-6 hover:underline"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Geri Dön
        </button>

        <div className="bg-white rounded-2xl p-8 border">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">{selectedTraining.title}</h1>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
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

          {isOwner && editMode && (
            <form onSubmit={handleSubmitEdit} className="mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
              <h3 className="text-lg font-bold text-blue-800">Antrenmanı Düzenle</h3>

              <div>
                <label className="block text-sm font-medium mb-1">Başlık</label>
                <input type="text" value={editData.title}
                  onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-xl" required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Açıklama</label>
                <textarea value={editData.description}
                  onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-xl" rows="2" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tarih</label>
                  <input type="date" value={editData.training_date}
                    onChange={(e) => setEditData((d) => ({ ...d, training_date: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-xl" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Saat</label>
                  <input type="time" value={editData.training_time}
                    onChange={(e) => setEditData((d) => ({ ...d, training_time: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-xl" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Konum</label>
                <LocationPicker
                  locationName={editData.location_name}
                  lat={editData.location_lat}
                  lng={editData.location_lng}
                  onLocationName={(v) => setEditData((d) => ({ ...d, location_name: v }))}
                  onLat={(v) => setEditData((d) => ({ ...d, location_lat: v }))}
                  onLng={(v) => setEditData((d) => ({ ...d, location_lng: v }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Kapasite</label>
                  <input type="number" value={editData.capacity} min="1"
                    onChange={(e) => setEditData((d) => ({ ...d, capacity: parseInt(e.target.value) }))}
                    className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Seviye</label>
                  <select value={editData.difficulty}
                    onChange={(e) => setEditData((d) => ({ ...d, difficulty: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-xl">
                    <option value="Kolay">Kolay</option>
                    <option value="Orta">Orta</option>
                    <option value="Zor">Zor</option>
                  </select>
                </div>
              </div>

              <button type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg">
                Kaydet
              </button>
            </form>
          )}

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

          {isMyTraining && (
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4">Katılımcılar</h3>
              {selectedTraining.attendees && selectedTraining.attendees.length > 0 ? (
                <div className="space-y-2">
                  {selectedTraining.attendees.map((attendee) => (
                    <div key={attendee.id} className="flex items-center p-3 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full overflow-hidden flex items-center justify-center text-white font-bold mr-3">
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
          )}

          <div className="mb-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
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
                    className="px-6 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700"
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
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full overflow-hidden flex items-center justify-center text-white font-bold mr-2">
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

          {!isMyTraining && (
            <button
              onClick={() => handleJoinTraining(selectedTraining.id)}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg"
            >
              Katıl
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
    const canManage = isOwner || isCoach; // antrenman ekleyip düzenleyebilir
    const canSeeMembers = !selectedTeam.is_private || isMember;

    const [message, setMessage] = useState("");
    const [activeTab, setActiveTab] = useState("wall"); // wall | members | settings
    const [editForm, setEditForm] = useState({
      name: selectedTeam.name,
      sport: selectedTeam.sport,
      description: selectedTeam.description || "",
      location: selectedTeam.location || "",
      avatar: selectedTeam.avatar || "",
      is_private: selectedTeam.is_private || false,
    });

    const sportTypes = ["Futbol","Basketbol","Tenis","Yüzme","Koşu","Bisiklet","Voleybol","Fitness","Yoga","Diğer"];

    const roleBadge = (role) => {
      if (role === "owner")  return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1"><Crown className="w-3 h-3" /> Sahip</span>;
      if (role === "coach")  return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1"><Target className="w-3 h-3" /> Antrenör</span>;
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

    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button onClick={() => setCurrentPage("teams")} className="flex items-center text-purple-600 mb-6 hover:underline">
          <ArrowLeft className="w-5 h-5 mr-2" /> Geri Dön
        </button>

        <div className="bg-white rounded-2xl border overflow-hidden">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-8 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
                  {selectedTeam.avatar || "🏅"}
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{selectedTeam.name}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">{selectedTeam.sport}</span>
                    {selectedTeam.is_private
                      ? <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm flex items-center gap-1"><Lock className="w-3 h-3" /> Gizli Takım</span>
                      : <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">🌍 Herkese Açık</span>}
                    {myRole && roleBadge(myRole)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {canManage && (
                  <button
                    onClick={() => { setShowInviteModal(true); }}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium flex items-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" /> Davet
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-6 mt-6 text-sm">
              <div><span className="font-bold text-lg">{selectedTeam.members?.length || 0}</span> <span className="opacity-80">üye</span></div>
              {selectedTeam.location && <div className="flex items-center gap-1 opacity-80"><MapPin className="w-4 h-4" />{selectedTeam.location}</div>}
            </div>

            {selectedTeam.description && (
              <p className="mt-4 opacity-90 text-sm">{selectedTeam.description}</p>
            )}
          </div>

          {/* SEKMELER */}
          {tabs.length > 0 && (
            <div className="flex border-b bg-gray-50">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600 bg-white"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="p-8">
            {/* DUVAR SEKMESİ */}
            {activeTab === "wall" && isMember && (
              <div>
                <form onSubmit={handleSubmitPost} className="mb-6">
                  <div className="flex gap-2">
                    <input
                      type="text" value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Takımla bir şey paylaş..."
                      className="flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button type="submit" className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
                {selectedTeam.posts?.length > 0 ? (
                  <div className="space-y-4">
                    {selectedTeam.posts.map((post) => (
                      <div key={post.id} className="p-4 bg-gray-50 rounded-2xl">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm">
                            {renderAvatar(post.user_avatar, post.user_name)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{post.user_name}</div>
                            <div className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString("tr-TR")}</div>
                          </div>
                        </div>
                        <p className="text-gray-700">{post.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-40" />
                    <p>Henüz mesaj yok. İlk mesajı sen at!</p>
                  </div>
                )}
              </div>
            )}

            {/* ÜYELER SEKMESİ */}
            {activeTab === "members" && canSeeMembers && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Üyeler ({selectedTeam.members?.length || 0})</h3>
                  {canManage && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 flex items-center gap-1"
                    >
                      <UserPlus className="w-4 h-4" /> Davet Et
                    </button>
                  )}
                </div>

                {/* Bekleyen davetler */}
                {canManage && pendingInvitations.length > 0 && (
                  <div className="mb-5">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Bekleyen Davetler ({pendingInvitations.length})
                    </h4>
                    <div className="space-y-2">
                      {pendingInvitations.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center text-yellow-700 font-bold text-lg">
                              <Mail className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-700 text-sm">{inv.invitee_email}</div>
                              <div className="text-xs text-gray-400">
                                {inv.inviter_name} tarafından davet edildi · {new Date(inv.created_at).toLocaleDateString("tr-TR")}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCancelInvitation(selectedTeam.id, inv.id)}
                            className="px-3 py-1.5 text-xs bg-red-50 text-red-500 rounded-xl hover:bg-red-100 font-medium"
                          >
                            İptal
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 my-4" />
                  </div>
                )}

                <div className="space-y-3">
                  {selectedTeam.members?.map((member) => {
                    const isThisOwner = member.id === selectedTeam.owner_id;
                    const isMe = member.id === user?.id;
                    return (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full overflow-hidden flex items-center justify-center text-white font-bold">
                            {renderAvatar(member.avatar, member.name)}
                          </div>
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              {member.name}
                              {isMe && <span className="text-xs text-gray-400">(sen)</span>}
                            </div>
                            <div className="mt-0.5">{roleBadge(member.role)}</div>
                          </div>
                        </div>

                        {/* Sahip: rol değiştir + çıkar */}
                        {isOwner && !isThisOwner && (
                          <div className="flex items-center gap-2">
                            <select
                              value={member.role}
                              onChange={(e) => handleChangeMemberRole(selectedTeam.id, member.id, e.target.value)}
                              className="text-sm px-3 py-1.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                            >
                              <option value="member">👤 Üye</option>
                              <option value="coach">🎯 Antrenör</option>
                            </select>
                            <button
                              onClick={() => handleRemoveMember(selectedTeam.id, member.id)}
                              className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"
                              title="Çıkar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Antrenör: çıkar (sadece üyeleri) */}
                        {isCoach && !isThisOwner && !isMe && member.role === "member" && (
                          <button
                            onClick={() => handleRemoveMember(selectedTeam.id, member.id)}
                            className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"
                            title="Çıkar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Kendim: ayrıl (sahip değilsem) */}
                        {isMe && !isThisOwner && (
                          <button
                            onClick={() => handleRemoveMember(selectedTeam.id, user.id)}
                            className="px-3 py-1.5 text-sm bg-red-50 text-red-500 rounded-xl hover:bg-red-100"
                          >
                            Ayrıl
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AYARLAR SEKMESİ - sadece sahip */}
            {activeTab === "settings" && isOwner && (
              <div>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Takım Adı</label>
                      <input type="text" value={editForm.name} required
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Spor</label>
                      <select value={editForm.sport}
                        onChange={(e) => setEditForm((f) => ({ ...f, sport: e.target.value }))}
                        className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300">
                        {sportTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Açıklama</label>
                    <textarea value={editForm.description} rows={3}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Konum</label>
                      <input type="text" value={editForm.location}
                        onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="İstanbul, Türkiye"
                        className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Avatar (Emoji)</label>
                      <input type="text" value={editForm.avatar}
                        onChange={(e) => setEditForm((f) => ({ ...f, avatar: e.target.value }))}
                        placeholder="🏅"
                        className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                  </div>

                  {/* Gizlilik toggle */}
                  <div className={`flex items-center justify-between p-4 rounded-2xl border-2 ${editForm.is_private ? "border-gray-300 bg-gray-50" : "border-blue-200 bg-blue-50"}`}>
                    <div>
                      <div className="font-semibold flex items-center gap-1">{editForm.is_private ? <><Lock className="w-4 h-4" /> Gizli Takım</> : <><Globe className="w-4 h-4" /> Herkese Açık Takım</>}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {editForm.is_private
                          ? "Sadece davet edilenler görebilir. Antrenmanlar otomatik gizli olur."
                          : "Herkes takımı görebilir ve katılma isteği gönderebilir."}
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => setEditForm((f) => ({ ...f, is_private: !f.is_private }))}
                      className={`relative w-12 h-6 rounded-full transition-colors ml-4 flex-shrink-0 ${editForm.is_private ? "bg-gray-400" : "bg-blue-500"}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.is_private ? "translate-x-1" : "translate-x-7"}`} />
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="submit"
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg">
                      Kaydet
                    </button>
                    <button type="button"
                      onClick={() => handleDeleteTeam(selectedTeam.id)}
                      className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" /> Takımı Sil
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* GİZLİ TAKIM - üye değil */}
            {!isMember && !canSeeMembers && (
              <div className="text-center py-12">
                <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Bu gizli bir takım. Üyeleri görmek için katılmanız gerekiyor.</p>
              </div>
            )}

            {/* KATIL butonu */}
            {!isMember && !selectedTeam.is_private && (
              <div className="mt-6">
                <button
                  onClick={() => handleJoinTeam(selectedTeam.id)}
                  disabled={joiningTeamId === selectedTeam.id}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {joiningTeamId === selectedTeam.id
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Katılınıyor...</>
                    : "Takıma Katıl"}
                </button>
              </div>
            )}
          </div>
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
        const devam = window.confirm(
          "⚠️ GPS koordinatı eklemediniz!\n\n" +
          "Koordinat olmadan bu antrenman \"Yakınımda\" aramasında görünmeyecek.\n\n" +
          "Yine de koordinatsız devam etmek istiyor musunuz?"
        );
        if (!devam) return;
      }
      handleCreateTraining(formData);
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl p-8 border">
          <h1 className="text-3xl font-bold mb-6">Yeni Antrenman Oluştur</h1>

          {myTeams.length === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm text-yellow-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 flex-shrink-0" /> Önce bir takım oluşturmalısınız!</p>
              <button
                onClick={() => setCurrentPage("create-team")}
                className="mt-2 text-purple-600 font-semibold"
              >
                Takım Oluştur →
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {myTeams.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Takım</label>
                <select
                  value={formData.team_id}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                >
                  {myTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.is_private ? <Lock className="w-3.5 h-3.5 inline ml-1" /> : <Globe className="w-3.5 h-3.5 inline ml-1" />}
                    </option>
                  ))}
                </select>

                {/* Gizlilik göstergesi */}
                {selectedTeamIsPrivate ? (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl text-sm text-gray-600">
                    <Lock className="w-4 h-4 text-gray-500" />
                    <span>Bu takım gizli — antrenman otomatik olarak <strong>sadece üyelere özel</strong> olacak</span>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between px-3 py-2 bg-purple-50 rounded-xl">
                    <span className="text-sm text-gray-700 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-purple-500" /> <span>Herkese açık antrenman</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, is_public: !f.is_public }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${formData.is_public ? "bg-purple-600" : "bg-gray-300"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.is_public ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Başlık</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                required
              />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tarih</label>
                <input
                  type="date"
                  value={formData.training_date}
                  onChange={(e) => setFormData({ ...formData, training_date: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Saat</label>
                <input
                  type="time"
                  value={formData.training_time}
                  onChange={(e) => setFormData({ ...formData, training_time: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Konum</label>
              <LocationPicker
                locationName={formData.location_name}
                lat={formData.location_lat}
                lng={formData.location_lng}
                onLocationName={(v) => setFormData((f) => ({ ...f, location_name: v }))}
                onLat={(v) => setFormData((f) => ({ ...f, location_lat: v }))}
                onLng={(v) => setFormData((f) => ({ ...f, location_lng: v }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Kapasite</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border rounded-xl"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Seviye</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                >
                  <option value="Kolay">Kolay</option>
                  <option value="Orta">Orta</option>
                  <option value="Zor">Zor</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={myTeams.length === 0}
                className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50"
              >
                Antrenman Oluştur
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
          <h1 className="text-3xl font-bold mb-6">Yeni Takım Oluştur</h1>

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
              style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
              <Lock className="w-8 h-8 text-white"/>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Yeni Şifre Belirle</h1>
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
          <h3 className="font-bold text-lg">
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

          <h2 className="text-3xl font-bold mb-6">Ayarlar</h2>

          {/* Sekmeler */}
          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "profile" ? "bg-white shadow text-purple-600" : "text-gray-500"}`}
            >
              Profil
            </button>
            <button
              onClick={() => setActiveTab("password")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "password" ? "bg-white shadow text-purple-600" : "text-gray-500"}`}
            >
              Şifre
            </button>
          </div>

          {activeTab === "profile" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Avatar fotoğrafı */}
              <div className="flex flex-col items-center gap-3 pb-2">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {(formData.avatar?.startsWith("/uploads/") || formData.avatar?.startsWith("http")) ? (
                      <img src={formData.avatar.startsWith("http") ? formData.avatar : `${BASE_URL}${formData.avatar}`} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      formData.avatar || user?.name?.[0]?.toUpperCase() || "?"
                    )}
                  </div>
                  {avatarLoading && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarLoading}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-purple-200 text-purple-600 hover:bg-purple-50 transition disabled:opacity-50"
                >
                  Fotoğraf Değiştir
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

    const handleSubmit = (e) => {
      e.preventDefault();
      if (selectedTeam && email) {
        handleInviteToTeam(selectedTeam.id, email);
        setEmail("");
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 relative m-4">
          <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4">
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-3xl font-bold mb-6">Takıma Davet Et</h2>

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
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold"
            >
              Davet Gönder
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

    const navLink = (page, label) => (
      <button
        onClick={() => setCurrentPage(page)}
        className={`relative text-sm font-semibold transition-colors duration-200 ${
          isActive(page) ? "text-violet-700" : "text-slate-600 hover:text-violet-600"
        }`}
      >
        {label}
        {isActive(page) && (
          <span className="absolute -bottom-[22px] left-0 right-0 h-0.5 rounded-full" style={{background:"linear-gradient(90deg,#7C3AED,#4F46E5)"}}/>
        )}
      </button>
    );

    return (
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Logo */}
            <button className="flex items-center gap-2.5 group" onClick={() => setCurrentPage("home")}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform" style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}>
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight" style={{background:"linear-gradient(90deg,#7C3AED,#4F46E5)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                SporlaConnect
              </span>
            </button>

            {/* Orta nav linkleri */}
            <div className="hidden md:flex items-center gap-8 h-16">
              {navLink("home", "Ana Sayfa")}
              {navLink("trainings", "Antrenmanlar")}
              {navLink("teams", "Takımlar")}
              {navLink("contact", "İletişim")}
            </div>

            {/* Sağ aksiyonlar */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <button
                    onClick={() => setCurrentPage("create-training")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-lg"
                    style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}
                  >
                    <Plus className="w-4 h-4" />
                    Antrenman
                  </button>

                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <Bell className="w-5 h-5 text-slate-600" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <button onClick={() => setCurrentPage("profile")} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0" style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}>
                      {(user.avatar?.startsWith("/uploads/") || user.avatar?.startsWith("http")) ? (
                        <img src={user.avatar.startsWith("http") ? user.avatar : `${BASE_URL}${user.avatar}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.avatar || user.name[0].toUpperCase()
                      )}
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{user.name.split(" ")[0]}</span>
                  </button>

                  <button onClick={handleLogout} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setAuthMode("login"); setIsAuthModalOpen(true); }}
                    className="px-5 py-2 text-sm font-semibold text-slate-600 hover:text-violet-700 transition-colors"
                  >
                    Giriş Yap
                  </button>
                  <button
                    onClick={() => { setAuthMode("register"); setIsAuthModalOpen(true); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-lg"
                    style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}
                  >
                    Kaydol
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
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
      { q: "SporlaConnect'e nasıl üye olurum?", a: "Sağ üst köşedeki 'Kaydol' butonuna tıklayarak adınızı, e-posta adresinizi ve şifrenizi girerek ücretsiz üye olabilirsiniz." },
      { q: "Takım nasıl kurarım?", a: "'Takımlar' sayfasına gidin ve '+ Takım Oluştur' butonuna tıklayın. Takım adı, spor branşı ve gizlilik ayarını belirleyerek dakikalar içinde takımınızı oluşturabilirsiniz." },
      { q: "Antrenman nasıl oluştururum?", a: "Üst menüdeki '+ Antrenman' butonuna tıklayın. Tarih, saat, konum ve kapasite bilgilerini doldurarak antrenmanınızı yayınlayabilirsiniz." },
      { q: "Gizli takım nedir?", a: "Gizli takımlar sadece davet edilen üyeler tarafından görülebilir. Antrenmanlar da otomatik olarak gizli olur ve dışarıdan kimse katılamaz." },
      { q: "Takıma nasıl üye eklerim?", a: "Takım detay sayfasında 'Üyeler' sekmesine gidin ve 'Davet Et' butonuyla e-posta adresi aracılığıyla üye ekleyebilirsiniz. Davet edilen kişiye e-posta gönderilir." },
      { q: "Antrenman kartındaki km bilgisi nasıl hesaplanır?", a: "Tarayıcınızın konum iznine göre bulunduğunuz yere olan mesafe Haversine formülüyle hesaplanır. Konum iznini tarayıcınızdan verebilirsiniz." },
      { q: "Üyelik ücretli mi?", a: "SporlaConnect tamamen ücretsizdir. Temel tüm özellikler herkes için açıktır." },
      { q: "Şifremi unuttum, ne yapmalıyım?", a: "Şu an için 'Profil' > 'Şifre Değiştir' bölümünden şifrenizi güncelleyebilirsiniz. Şifre sıfırlama maili yakında eklenecek." },
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

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Hero */}
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 text-white py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="mb-4 flex justify-center"><MessageCircle className="w-14 h-14 text-purple-200" /></div>
            <h1 className="text-4xl font-bold mb-3">Bizimle İletişime Geçin</h1>
            <p className="text-purple-100 text-lg">Sorularınız için buradayız. Size en kısa sürede dönüş yaparız.</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">

            {/* Sol: İletişim Bilgileri */}
            <div className="space-y-6">
              {/* Sosyal Medya */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 text-lg mb-4">📱 Sosyal Medya</h3>
                <div className="space-y-3">
                  {[
                    { icon: "📸", label: "Instagram", handle: "@sporlaconnect", url: "https://instagram.com/sporlaconnect", color: "text-pink-600 bg-pink-50" },
                    { icon: "𝕏", label: "X (Twitter)", handle: "@sporlaconnect", url: "https://twitter.com/sporlaconnect", color: "text-gray-800 bg-gray-100" },
                    { icon: "💼", label: "LinkedIn", handle: "SporlaConnect", url: "https://linkedin.com/company/sporlaconnect", color: "text-blue-600 bg-blue-50" },
                    { icon: "▶️", label: "YouTube", handle: "SporlaConnect", url: "https://youtube.com/@sporlaconnect", color: "text-red-600 bg-red-50" },
                  ].map((s) => (
                    <a key={s.label} href={s.url} target="_blank" rel="noreferrer"
                       className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                      <span className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center text-lg font-bold`}>{s.icon}</span>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{s.label}</div>
                        <div className="text-gray-500 text-xs">{s.handle}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* İletişim Bilgileri */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 text-lg mb-4">📬 İletişim</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center"><Mail className="w-5 h-5 text-purple-500" /></span>
                    <div>
                      <div className="text-gray-500 text-xs">E-posta</div>
                      <div className="font-medium text-gray-900">melihonyer@gmail.com</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-base">📍</span>
                    <div>
                      <div className="text-gray-500 text-xs">Konum</div>
                      <div className="font-medium text-gray-900">İzmir, Türkiye</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-base">⏰</span>
                    <div>
                      <div className="text-gray-500 text-xs">Yanıt Süresi</div>
                      <div className="font-medium text-gray-900">24 saat içinde</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Orta + Sağ: Form + FAQ */}
            <div className="md:col-span-2 space-y-8">
              {/* İletişim Formu */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 text-xl mb-6">✍️ Mesaj Gönderin</h3>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Adınız</label>
                      <input value={contactForm.name} onChange={e => setContactForm(p => ({...p, name: e.target.value}))}
                        placeholder="Adınız Soyadınız" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">E-posta</label>
                      <input type="email" value={contactForm.email} onChange={e => setContactForm(p => ({...p, email: e.target.value}))}
                        placeholder="ornek@mail.com" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Konu</label>
                    <select value={contactForm.subject} onChange={e => setContactForm(p => ({...p, subject: e.target.value}))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
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
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Mesajınız</label>
                    <textarea value={contactForm.message} onChange={e => setContactForm(p => ({...p, message: e.target.value}))}
                      rows={5} placeholder="Mesajınızı buraya yazın…"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                  </div>
                  <button type="submit" disabled={sending}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 transition">
                    {sending ? "Gönderiliyor…" : "Mesaj Gönder 📨"}
                  </button>
                </form>
              </div>

              {/* SSS */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 text-xl mb-6">❓ Sık Sorulan Sorular</h3>
                <div className="space-y-3">
                  {faqs.map((faq, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors">
                        <span className="font-medium text-gray-800 text-sm pr-4">{faq.q}</span>
                        <span className={`text-purple-500 text-lg flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}>⌄</span>
                      </button>
                      {openFaq === i && (
                        <div className="px-4 pb-4">
                          <p className="text-gray-600 text-sm leading-relaxed border-t border-gray-50 pt-3">{faq.a}</p>
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
<p>SporlaConnect olarak; kayıt sırasında sağladığınız bilgiler (ad, e-posta), platform kullanımı sırasında oluşan veriler (antrenmanlar, takımlar, konum) ve çerezler aracılığıyla teknik veriler toplarız.</p>

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
<p>SporlaConnect platformunu kullanarak bu koşulları kabul etmiş sayılırsınız. Koşulları kabul etmiyorsanız platformu kullanmayınız.</p>

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
            <h2 className="text-lg font-bold text-slate-800">{content.title}</h2>
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
            <button onClick={() => setLegalModal("cerez")} className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
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
              className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}
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
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md" style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}>
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black tracking-tight" style={{background:"linear-gradient(90deg,#a78bfa,#818cf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  SporlaConnect
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
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Uygulama</h3>
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
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Yasal</h3>
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
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">İletişim</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5 text-sm text-slate-400">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-400" />
                  <a href="mailto:info@sporlaconnect.com" className="hover:text-white transition-colors">
                    info@sporlaconnect.com {/* TODO: gerçek mail ile güncelle */}
                  </a>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-slate-400">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-400" />
                  <span>Çınarlı Mah. 1572 Sk. No:33<br/>PK.35170 Konak, İzmir</span>
                </li>
              </ul>
              <div className="mt-5">
                <button
                  onClick={() => setCurrentPage("contact")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}
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
      toast.type === "error" ? "bg-red-600" : "bg-indigo-600"
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
      <LegalModal />
      <CookieBanner />
      <Toast />
      <Footer />
    </div>
  );
}