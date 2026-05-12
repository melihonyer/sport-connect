import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, Users, Activity, Shield, MessageSquare,
  LogOut, Trash2, Eye, EyeOff, CheckCheck, Mail,
  TrendingUp, Calendar, AlertTriangle, Search, X,
  ChevronRight, Lock, Globe, Image, Plus, Edit2, ToggleLeft, ToggleRight,
  Upload, GripVertical, ChevronUp, ChevronDown,
} from "lucide-react";

const API_URL  = import.meta.env.VITE_API_URL  ?? (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");
const BASE_URL = import.meta.env.VITE_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");

// ─── Yardımcı: tarih formatı ───────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR", { day:"numeric", month:"short", year:"numeric" }) : "—";
const fmtFull = (d) => d ? new Date(d).toLocaleString("tr-TR") : "—";

// ─── Ana bileşen ────────────────────────────────────────────
export default function AdminPanel() {
  const [token, setToken]       = useState(() => sessionStorage.getItem("admin_token") || "");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm]         = useState({ email: "", password: "" });

  // İçerik state'leri
  const [tab, setTab]           = useState("dashboard");
  const [stats, setStats]       = useState(null);
  const [users, setUsers]       = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [teams, setTeams]       = useState([]);
  const [messages, setMessages] = useState([]);
  const [banners, setBanners]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");

  // Banner form state
  const emptyBanner = { title:"", subtitle:"", badge_text:"", cta_primary_text:"Hemen Başla", cta_primary_url:"", cta_secondary_text:"Antrenmanları Keşfet", cta_secondary_url:"", gradient_from:"#0D0B26", gradient_via:"#1a1040", gradient_to:"#0f2044", is_active:true, order_index:0, mottos:[""] };
  const [bannerForm, setBannerForm] = useState(emptyBanner);
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRef = useRef(null);

  // ─── Login ──────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Giriş başarısız."); return; }

      // Admin kontrolü
      const meRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const me = await meRes.json();
      if (!me.user?.is_admin) { setLoginError("Bu hesabın admin yetkisi yok."); return; }

      setToken(data.token);
      sessionStorage.setItem("admin_token", data.token);
    } catch {
      setLoginError("Sunucuya bağlanılamadı.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    setToken("");
    setForm({ email: "", password: "" });
  };

  // ─── API helper ─────────────────────────────────────────
  const api = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (res.status === 401 || res.status === 403) { handleLogout(); return null; }
    return res.json();
  }, [token]);

  // ─── Veri yükleme ───────────────────────────────────────
  const loadTab = useCallback(async (t) => {
    setTab(t);
    setLoading(true);
    setSearch("");
    try {
      if (t === "dashboard") setStats(await api("/admin/stats"));
      else if (t === "users") setUsers(await api("/admin/users") || []);
      else if (t === "trainings") setTrainings(await api("/admin/trainings") || []);
      else if (t === "teams") setTeams(await api("/admin/teams") || []);
      else if (t === "messages") setMessages(await api("/admin/contact") || []);
      else if (t === "banners") setBanners(await api("/admin/banners") || []);
    } catch { /* sessiz */ }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { if (token) loadTab("dashboard"); }, [token]);

  // ─── Silme / işlemler ───────────────────────────────────
  const del = async (path, label, reload) => {
    if (!window.confirm(`"${label}" silinecek. Emin misiniz?`)) return;
    await api(path, { method: "DELETE" });
    loadTab(reload);
  };

  const markRead = async (id) => {
    await api(`/admin/contact/${id}/read`, { method: "PUT" });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
    setStats(prev => prev ? { ...prev, unreadContact: Math.max(0, (prev.unreadContact || 1) - 1) } : prev);
  };

  // ─── LOGIN SAYFASI ──────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0D0B26 0%,#1a1040 50%,#0f2044 100%)" }}>
        {/* Arka plan blob */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-20" style={{ background: "radial-gradient(circle,#7C3AED,transparent 70%)" }} />
          <div className="absolute bottom-[-100px] left-[-80px] w-[350px] h-[350px] rounded-full opacity-15" style={{ background: "radial-gradient(circle,#4F46E5,transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.8) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        <div className="relative w-full max-w-md mx-4">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-2xl mb-4" style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)" }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Admin Panel</h1>
            <p className="text-slate-400 text-sm mt-1">SporlaConnect Yönetim Konsolu</p>
          </div>

          {/* Login kutusu */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">E-posta</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="admin@mail.com"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Şifre</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 hover:shadow-xl disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)" }}
              >
                {loginLoading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Giriş yapılıyor…</>
                ) : (
                  <><Lock className="w-4 h-4" /> Giriş Yap</>
                )}
              </button>
            </form>

            <p className="text-center text-slate-500 text-xs mt-6">
              Bu panel yalnızca yetkili yöneticiler içindir.<br />
              Yetkisiz erişim girişimleri kayıt altına alınır.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── ADMIN PANEL (giriş yapıldıktan sonra) ──────────────
  const navItems = [
    { id: "dashboard", label: "Genel Bakış", icon: LayoutDashboard },
    { id: "users",     label: "Kullanıcılar", icon: Users },
    { id: "trainings", label: "Antrenmanlar", icon: Activity },
    { id: "teams",     label: "Takımlar",     icon: Shield },
    { id: "messages",  label: "Mesajlar",     icon: MessageSquare,
      badge: stats?.unreadContact > 0 ? stats.unreadContact : null },
    { id: "banners",   label: "Bannerlar",    icon: Image },
  ];

  // ─── Banner helpers ──────────────────────────────────────
  const startEditBanner = (b) => {
    setBannerForm({
      title: b.title || "",
      subtitle: b.subtitle || "",
      badge_text: b.badge_text || "",
      cta_primary_text: b.cta_primary_text || "Hemen Başla",
      cta_primary_url: b.cta_primary_url || "",
      cta_secondary_text: b.cta_secondary_text || "Antrenmanları Keşfet",
      cta_secondary_url: b.cta_secondary_url || "",
      gradient_from: b.gradient_from || "#0D0B26",
      gradient_via: b.gradient_via || "#1a1040",
      gradient_to: b.gradient_to || "#0f2044",
      is_active: b.is_active !== false,
      order_index: b.order_index || 0,
      mottos: (Array.isArray(b.mottos) && b.mottos.length > 0) ? b.mottos : [""],
    });
    setEditingBannerId(b.id);
    setShowBannerForm(true);
  };

  const saveBanner = async () => {
    setBannerSaving(true);
    try {
      if (editingBannerId) {
        const updated = await api(`/admin/banners/${editingBannerId}`, {
          method: "PUT", body: JSON.stringify(bannerForm),
        });
        if (updated) setBanners(prev => prev.map(b => b.id === editingBannerId ? updated : b));
      } else {
        const created = await api("/admin/banners", {
          method: "POST", body: JSON.stringify({ ...bannerForm, order_index: banners.length }),
        });
        if (created) setBanners(prev => [...prev, created]);
      }
      setShowBannerForm(false);
      setEditingBannerId(null);
      setBannerForm(emptyBanner);
    } catch { /* sessiz */ }
    finally { setBannerSaving(false); }
  };

  const copyBanner = async (b) => {
    const created = await api("/admin/banners", {
      method: "POST",
      body: JSON.stringify({
        title: b.title,
        subtitle: b.subtitle,
        badge_text: b.badge_text,
        cta_primary_text: b.cta_primary_text,
        cta_primary_url: b.cta_primary_url || "",
        cta_secondary_text: b.cta_secondary_text,
        cta_secondary_url: b.cta_secondary_url || "",
        gradient_from: b.gradient_from,
        gradient_via: b.gradient_via,
        gradient_to: b.gradient_to,
        is_active: false,          // kopya pasif başlasın
        order_index: banners.length,
        mottos: b.mottos || [],
      }),
    });
    if (created) setBanners(prev => [...prev, created]);
  };

  const toggleBannerActive = async (b) => {
    const updated = await api(`/admin/banners/${b.id}`, {
      method: "PUT", body: JSON.stringify({ ...b, is_active: !b.is_active }),
    });
    if (updated) setBanners(prev => prev.map(x => x.id === b.id ? updated : x));
  };

  const deleteBanner = async (b) => {
    if (!window.confirm(`"${b.title}" banneri silinecek. Emin misiniz?`)) return;
    await api(`/admin/banners/${b.id}`, { method: "DELETE" });
    setBanners(prev => prev.filter(x => x.id !== b.id));
  };

  const uploadBannerImage = async (bannerId, file) => {
    setUploadingId(bannerId);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await fetch(`${API_URL}/admin/banners/${bannerId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const updated = await res.json();
        setBanners(prev => prev.map(b => b.id === bannerId ? updated : b));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Görsel yükleme hatası: ${err.error || res.status}`);
      }
    } catch (e) {
      alert(`Bağlantı hatası: ${e.message}`);
    }
    finally { setUploadingId(null); }
  };

  const statCards = stats ? [
    { label: "Toplam Kullanıcı",   value: stats.users,            icon: Users,        grad: "from-violet-500 to-purple-600" },
    { label: "Toplam Antrenman",   value: stats.trainings,        icon: Activity,     grad: "from-indigo-500 to-blue-600" },
    { label: "Toplam Takım",       value: stats.teams,            icon: Shield,       grad: "from-cyan-500 to-teal-600" },
    { label: "Yeni Mesaj",         value: stats.unreadContact,    icon: MessageSquare,grad: "from-amber-500 to-orange-500" },
  ] : [];

  // Arama filtresi
  const q = search.toLowerCase();
  const filteredUsers     = users.filter(u => !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  const filteredTrainings = trainings.filter(t => !q || t.title?.toLowerCase().includes(q));
  const filteredTeams     = teams.filter(t => !q || t.name?.toLowerCase().includes(q));
  const filteredMessages  = messages.filter(m => !q || m.name?.toLowerCase().includes(q) || m.subject?.toLowerCase().includes(q));

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: "linear-gradient(160deg,#0D0B26,#1a1040)" }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)" }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-black text-sm tracking-tight">SporlaConnect</div>
            <div className="text-violet-400 text-xs font-semibold">Admin Panel</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => loadTab(id)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                tab === id
                  ? "text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              style={tab === id ? { background: "linear-gradient(135deg,#7C3AED44,#4F46E544)", border: "1px solid #7C3AED55" } : {}}
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </span>
              {badge && (
                <span className="w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{badge}</span>
              )}
              {tab === id && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </button>
          ))}
        </nav>

        {/* Çıkış */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
          <a
            href="/"
            className="mt-1 w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            <TrendingUp className="w-4 h-4" />
            Uygulamaya Dön
          </a>
        </div>
      </aside>

      {/* ── İçerik ────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {/* Üst bar */}
        <header className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-black text-slate-900">
              {navItems.find(n => n.id === tab)?.label || "Panel"}
            </h1>
            <p className="text-slate-400 text-xs">SporlaConnect Yönetim Konsolu</p>
          </div>
          {/* Arama */}
          {tab !== "dashboard" && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ara…"
                className="w-56 pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </header>

        <div className="p-8">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          )}

          {/* ── DASHBOARD ────────────────────────────────── */}
          {!loading && tab === "dashboard" && (
            <div className="space-y-8">
              {/* Stat kartları */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {statCards.map((s, i) => (
                  <div key={i} className={`bg-gradient-to-br ${s.grad} rounded-2xl p-6 text-white shadow-lg`}>
                    <div className="flex items-center justify-between mb-4">
                      <s.icon className="w-6 h-6 opacity-80" />
                      <TrendingUp className="w-4 h-4 opacity-50" />
                    </div>
                    <div className="text-4xl font-black mb-1">{s.value ?? "—"}</div>
                    <div className="text-sm opacity-75 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Son kayıtlar */}
              {stats?.recentUsers?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-50">
                    <h2 className="font-bold text-slate-900">🆕 Son Kayıt Olan Kullanıcılar</h2>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {stats.recentUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)" }}>
                            {u.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{u.name}</div>
                            <div className="text-slate-400 text-xs">{u.email}</div>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">{fmt(u.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── USERS ────────────────────────────────────── */}
          {!loading && tab === "users" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Kullanıcılar <span className="text-slate-400 font-normal text-sm">({filteredUsers.length})</span></h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-6 py-3">Kullanıcı</th>
                      <th className="text-left px-4 py-3">E-posta</th>
                      <th className="text-center px-4 py-3">Takım</th>
                      <th className="text-center px-4 py-3">Antrenman</th>
                      <th className="text-center px-4 py-3">Rol</th>
                      <th className="text-left px-4 py-3">Kayıt</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                              style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)" }}>
                              {u.name[0].toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-900">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{u.email}</td>
                        <td className="px-4 py-3.5 text-center text-slate-700 font-semibold">{u.team_count ?? "—"}</td>
                        <td className="px-4 py-3.5 text-center text-slate-700 font-semibold">{u.training_count ?? "—"}</td>
                        <td className="px-4 py-3.5 text-center">
                          {u.is_admin
                            ? <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold">Admin</span>
                            : <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs">Üye</span>
                          }
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs">{fmt(u.created_at)}</td>
                        <td className="px-4 py-3.5">
                          {!u.is_admin && (
                            <button onClick={() => del(`/admin/users/${u.id}`, u.name, "users")}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="text-center py-16 text-slate-400">Kullanıcı bulunamadı</div>
                )}
              </div>
            </div>
          )}

          {/* ── TRAININGS ────────────────────────────────── */}
          {!loading && tab === "trainings" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-900">Antrenmanlar <span className="text-slate-400 font-normal text-sm">({filteredTrainings.length})</span></h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-6 py-3">Başlık</th>
                      <th className="text-left px-4 py-3">Takım</th>
                      <th className="text-left px-4 py-3">Tarih</th>
                      <th className="text-left px-4 py-3">Saat</th>
                      <th className="text-center px-4 py-3">Katılımcı</th>
                      <th className="text-center px-4 py-3">Durum</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTrainings.map(t => {
                      // Tarih + saat birlikte karşılaştır — UTC→yerel dönüşümü doğru yap
                      const trainingDateObj = new Date(t.training_date);
                      // Yerel takvimde gün/ay/yıl al (Türkiye saati için doğru tarih)
                      const localDateStr = trainingDateObj.toLocaleDateString('en-CA'); // "2026-05-09"
                      const timeStr = t.training_time?.slice(0, 5) || "00:00"; // "16:12"
                      const trainingDateTime = new Date(`${localDateStr}T${timeStr}:00`);
                      const isPast = trainingDateTime < new Date();
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3.5 font-semibold text-slate-900 max-w-[200px] truncate">{t.title}</td>
                          <td className="px-4 py-3.5 text-slate-500">{t.team_name || "—"}</td>
                          <td className="px-4 py-3.5 text-slate-600">{fmt(t.training_date)}</td>
                          <td className="px-4 py-3.5 text-slate-600">{t.training_time?.slice(0,5) || "—"}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-semibold text-slate-700">{t.participant_count}</span>
                            <span className="text-slate-400">/{t.capacity}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${isPast ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                              {isPast ? "Tamamlandı" : "Aktif"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button onClick={() => del(`/admin/trainings/${t.id}`, t.title, "trainings")}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredTrainings.length === 0 && (
                  <div className="text-center py-16 text-slate-400">Antrenman bulunamadı</div>
                )}
              </div>
            </div>
          )}

          {/* ── TEAMS ────────────────────────────────────── */}
          {!loading && tab === "teams" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-900">Takımlar <span className="text-slate-400 font-normal text-sm">({filteredTeams.length})</span></h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-6 py-3">Takım</th>
                      <th className="text-left px-4 py-3">Branş</th>
                      <th className="text-left px-4 py-3">Kurucu</th>
                      <th className="text-center px-4 py-3">Üye</th>
                      <th className="text-center px-4 py-3">Gizlilik</th>
                      <th className="text-left px-4 py-3">Oluşturma</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTeams.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm"
                              style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)" }}>
                              {t.avatar || t.name[0]}
                            </div>
                            <span className="font-semibold text-slate-900">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{t.sport}</td>
                        <td className="px-4 py-3.5 text-slate-600">{t.owner_name}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{t.member_count}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${t.is_private ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                            <span className="flex items-center gap-1">{t.is_private ? <><Lock className="w-3 h-3" /> Gizli</> : <><Globe className="w-3 h-3" /> Açık</>}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs">{fmt(t.created_at)}</td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => del(`/admin/teams/${t.id}`, t.name, "teams")}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTeams.length === 0 && (
                  <div className="text-center py-16 text-slate-400">Takım bulunamadı</div>
                )}
              </div>
            </div>
          )}

          {/* ── BANNERS ──────────────────────────────────── */}
          {!loading && tab === "banners" && (
            <div className="space-y-6">
              {/* Üst bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">Hero Bannerları</h2>
                  <p className="text-slate-400 text-sm mt-0.5">Anasayfadaki slider'ı buradan yönetebilirsiniz.</p>
                </div>
                <button
                  onClick={() => { setBannerForm(emptyBanner); setEditingBannerId(null); setShowBannerForm(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 shadow-lg"
                  style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}
                >
                  <Plus className="w-4 h-4"/> Yeni Banner
                </button>
              </div>

              {/* Banner form (ekleme/düzenleme) */}
              {showBannerForm && (
                <div className="bg-white rounded-2xl border border-violet-200 shadow-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                    style={{background:"linear-gradient(90deg,#7C3AED11,#4F46E511)"}}>
                    <h3 className="font-bold text-slate-900">{editingBannerId ? "Banner Düzenle" : "Yeni Banner Ekle"}</h3>
                    <button onClick={() => setShowBannerForm(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-5 h-5"/>
                    </button>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Önizleme şeridi */}
                    <div className="rounded-xl overflow-hidden h-24 flex items-center px-8 relative"
                      style={{background:`linear-gradient(135deg,${bannerForm.gradient_from},${bannerForm.gradient_via},${bannerForm.gradient_to})`}}>
                      <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:"linear-gradient(rgba(255,255,255,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.8) 1px,transparent 1px)",backgroundSize:"40px 40px"}}/>
                      <div className="relative">
                        <div className="text-white/60 text-xs font-semibold mb-1">{bannerForm.badge_text || "Rozet metni"}</div>
                        <div className="text-white font-black text-xl leading-tight">
                          {bannerForm.title || "Başlık"}{" "}
                          <span className="text-violet-300">{bannerForm.title_highlight || "Vurgulu metin"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Renk seçiciler */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Arka Plan Gradyanı</label>
                      <div className="flex items-center gap-4">
                        {[
                          { key:"gradient_from", label:"Başlangıç" },
                          { key:"gradient_via",  label:"Orta" },
                          { key:"gradient_to",   label:"Bitiş" },
                        ].map(({key, label}) => (
                          <div key={key} className="flex flex-col items-center gap-2">
                            <label className="text-xs text-slate-500">{label}</label>
                            <div className="relative">
                              <input
                                type="color"
                                value={bannerForm[key]}
                                onChange={e => setBannerForm(p => ({...p,[key]:e.target.value}))}
                                className="w-12 h-12 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5"
                              />
                            </div>
                            <input
                              type="text"
                              value={bannerForm[key]}
                              onChange={e => setBannerForm(p => ({...p,[key]:e.target.value}))}
                              className="w-24 text-center text-xs border border-slate-200 rounded-lg px-2 py-1 font-mono focus:outline-none focus:ring-2 focus:ring-violet-300"
                            />
                          </div>
                        ))}
                        {/* Önizleme gradyan çubuğu */}
                        <div className="flex-1 h-12 rounded-xl border border-slate-200"
                          style={{background:`linear-gradient(90deg,${bannerForm.gradient_from},${bannerForm.gradient_via},${bannerForm.gradient_to})`}}/>
                      </div>
                    </div>

                    {/* Aktif/Pasif toggle */}
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={()=>setBannerForm(p=>({...p,is_active:!p.is_active}))}>
                        {bannerForm.is_active
                          ? <ToggleRight className="w-8 h-8 text-violet-600"/>
                          : <ToggleLeft className="w-8 h-8 text-slate-400"/>}
                      </button>
                      <span className="text-sm font-semibold text-slate-700">
                        {bannerForm.is_active ? "Aktif — sayfada görünür" : "Pasif — gizli"}
                      </span>
                    </div>

                    {/* Başlık + Alt metin */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Başlık <span className="text-slate-400 font-normal">(sabit satır)</span></label>
                        <input value={bannerForm.title} onChange={e=>setBannerForm(p=>({...p,title:e.target.value}))}
                          placeholder="Sporla Buluş,"
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Rozet Metni</label>
                        <input value={bannerForm.badge_text} onChange={e=>setBannerForm(p=>({...p,badge_text:e.target.value}))}
                          placeholder="🏃 500+ Aktif Sporcu"
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Alt Metin</label>
                      <textarea value={bannerForm.subtitle} onChange={e=>setBannerForm(p=>({...p,subtitle:e.target.value}))}
                        placeholder="Açıklama metni…" rows={2}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"/>
                    </div>

                    {/* Butonlar */}
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Butonlar</label>

                      {/* Ana buton */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full" style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)"}}/>
                          <span className="text-xs font-bold text-slate-600">Ana Buton</span>
                          <span className="text-xs text-slate-400">(gradient, öne çıkan)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Buton Metni</label>
                            <input value={bannerForm.cta_primary_text} onChange={e=>setBannerForm(p=>({...p,cta_primary_text:e.target.value}))}
                              placeholder="Hemen Başla"
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Link / URL</label>
                            <input value={bannerForm.cta_primary_url} onChange={e=>setBannerForm(p=>({...p,cta_primary_url:e.target.value}))}
                              placeholder="/antrenmanlar veya https://..."
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                          </div>
                        </div>
                      </div>

                      {/* İkinci buton */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-slate-400"/>
                          <span className="text-xs font-bold text-slate-600">İkinci Buton</span>
                          <span className="text-xs text-slate-400">(şeffaf, giriş yapanlara gösterilir)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Buton Metni</label>
                            <input value={bannerForm.cta_secondary_text} onChange={e=>setBannerForm(p=>({...p,cta_secondary_text:e.target.value}))}
                              placeholder="Antrenmanları Keşfet"
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Link / URL</label>
                            <input value={bannerForm.cta_secondary_url} onChange={e=>setBannerForm(p=>({...p,cta_secondary_url:e.target.value}))}
                              placeholder="/takimlar veya https://..."
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Motto listesi */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          Typewriter Mottoları
                          <span className="ml-2 text-slate-400 font-normal normal-case">(sırayla yazılıp silinir)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setBannerForm(p => ({ ...p, mottos: [...(p.mottos||[""]), ""] }))}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 transition"
                        >
                          <Plus className="w-3 h-3"/> Motto Ekle
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(bannerForm.mottos || [""]).map((m, mi) => (
                          <div key={mi} className="flex items-center gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center">{mi+1}</span>
                            <input
                              type="text"
                              value={m}
                              onChange={e => {
                                const arr = [...(bannerForm.mottos||[""])];
                                arr[mi] = e.target.value;
                                setBannerForm(p => ({ ...p, mottos: arr }));
                              }}
                              placeholder={`Motto ${mi+1}…`}
                              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
                            />
                            {(bannerForm.mottos||[""]).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const arr = (bannerForm.mottos||[""]).filter((_,i) => i !== mi);
                                  setBannerForm(p => ({ ...p, mottos: arr }));
                                }}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <X className="w-4 h-4"/>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Kaydet/İptal */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                      <button onClick={()=>setShowBannerForm(false)}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">
                        İptal
                      </button>
                      <button onClick={saveBanner} disabled={bannerSaving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition hover:opacity-90"
                        style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}>
                        {bannerSaving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Kaydediliyor…</> : "Kaydet"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Banner listesi */}
              {banners.length === 0 && !showBannerForm && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
                  <Image className="w-12 h-12 mx-auto mb-3 text-slate-200"/>
                  <p className="font-semibold text-slate-400">Henüz banner yok</p>
                  <p className="text-slate-300 text-sm mt-1">Yukarıdan yeni banner ekleyebilirsiniz.</p>
                </div>
              )}

              <div className="space-y-3">
                {banners.map((b) => (
                  <div key={b.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${b.is_active ? "border-slate-100" : "border-slate-200 opacity-60"}`}>
                    {/* Gradyan şerit */}
                    <div className="h-2" style={{background:`linear-gradient(90deg,${b.gradient_from},${b.gradient_via || b.gradient_to},${b.gradient_to})`}}/>

                    <div className="p-5 flex items-center gap-5">
                      {/* Küçük önizleme */}
                      <div className="flex-shrink-0 w-20 h-14 rounded-xl flex items-center justify-center relative overflow-hidden border border-slate-100"
                        style={{background:`linear-gradient(135deg,${b.gradient_from},${b.gradient_via || b.gradient_to},${b.gradient_to})`}}>
                        {b.image_url
                          ? <img src={`${BASE_URL}${b.image_url}`} alt="" className="w-full h-full object-cover"/>
                          : <Image className="w-5 h-5 text-white/40"/>}
                      </div>

                      {/* Bilgiler */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm truncate">{b.title} {b.title_highlight}</span>
                          {b.badge_text && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{b.badge_text}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {b.is_active ? "Aktif" : "Pasif"}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{b.subtitle}</p>
                      </div>

                      {/* Aksiyonlar */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Görsel yükle */}
                        <label className="relative cursor-pointer">
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                            onChange={e => { if (e.target.files[0]) uploadBannerImage(b.id, e.target.files[0]); e.target.value=""; }}/>
                          <span className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${uploadingId === b.id ? "bg-violet-100 text-violet-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                            {uploadingId === b.id
                              ? <div className="w-3 h-3 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin"/>
                              : <Upload className="w-3 h-3"/>}
                            Görsel
                          </span>
                        </label>

                        {/* Aktif/Pasif toggle */}
                        <button onClick={() => toggleBannerActive(b)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${b.is_active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                          {b.is_active ? <ToggleRight className="w-3.5 h-3.5"/> : <ToggleLeft className="w-3.5 h-3.5"/>}
                          {b.is_active ? "Aktif" : "Pasif"}
                        </button>

                        {/* Kopyala */}
                        <button onClick={() => copyBanner(b)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition whitespace-nowrap">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                          </svg>
                          Kopyala
                        </button>

                        {/* Düzenle */}
                        <button onClick={() => startEditBanner(b)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition whitespace-nowrap">
                          <Edit2 className="w-3 h-3"/> Düzenle
                        </button>

                        {/* Sil */}
                        <button onClick={() => deleteBanner(b)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold hover:bg-red-100 transition whitespace-nowrap">
                          <Trash2 className="w-3 h-3"/> Sil
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MESSAGES ─────────────────────────────────── */}
          {!loading && tab === "messages" && (
            <div className="space-y-4">
              {filteredMessages.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                  <p className="font-semibold">Henüz mesaj yok</p>
                </div>
              )}
              {filteredMessages.map(m => (
                <div key={m.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${m.is_read ? "border-slate-100" : "border-violet-200"}`}>
                  {!m.is_read && <div className="h-1" style={{ background: "linear-gradient(90deg,#7C3AED,#4F46E5)" }} />}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {!m.is_read && (
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold">Yeni</span>
                          )}
                          <span className="font-bold text-slate-900">{m.name}</span>
                          <span className="text-slate-300 text-sm">·</span>
                          <a href={`mailto:${m.email}`} className="text-violet-600 text-sm hover:underline">{m.email}</a>
                          <span className="text-slate-400 text-xs ml-auto">{fmtFull(m.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700 text-sm">{m.subject}</span>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap border-l-2 border-violet-200 pl-4">
                          {m.message}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {!m.is_read && (
                          <button onClick={() => markRead(m.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition whitespace-nowrap">
                            <CheckCheck className="w-3.5 h-3.5" /> Okundu
                          </button>
                        )}
                        <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition whitespace-nowrap">
                          <Mail className="w-3.5 h-3.5" /> Yanıtla
                        </a>
                        <button onClick={() => del(`/admin/contact/${m.id}`, m.subject, "messages")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold hover:bg-red-100 transition whitespace-nowrap">
                          <Trash2 className="w-3.5 h-3.5" /> Sil
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
