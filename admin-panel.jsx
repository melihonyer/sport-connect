import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, Users, Activity, Shield, MessageSquare,
  LogOut, Trash2, Eye, EyeOff, CheckCheck, Mail,
  TrendingUp, Calendar, AlertTriangle, Search, X,
  ChevronRight, Lock, Globe, Image, Plus, Edit2, ToggleLeft, ToggleRight,
  Upload, GripVertical, ChevronUp, ChevronDown, Newspaper, GalleryHorizontal, Menu,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

const API_URL  = import.meta.env.VITE_API_URL  ?? (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");
const BASE_URL = import.meta.env.VITE_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");

// ─── Resim yükleme yardımcısı ───────────────────────────────
function ImageUploadBtn({ itemId, endpoint, token, onUploaded, onError, currentUrl }) {
  const [uploading, setUploading] = React.useState(false);
  const ref = React.useRef(null);
  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await fetch(`${API_URL}${endpoint}`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd });
      if (res.ok) {
        const data = await res.json();
        if (data.image_url) onUploaded(data);
        onError?.('Görsel yüklendi.', 'success');
      } else {
        const err = await res.json().catch(()=>({}));
        onError?.(err.error || `Yükleme hatası (${res.status})`, 'error');
      }
    } catch(e) {
      onError?.(`Bağlantı hatası: ${e.message}`, 'error');
    } finally { setUploading(false); e.target.value=''; }
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile}/>
      <button type="button" onClick={()=>ref.current?.click()} disabled={uploading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 transition text-slate-600 disabled:opacity-50">
        <Upload className="w-3.5 h-3.5"/>
        {uploading ? "Yükleniyor…" : currentUrl ? "Resmi Değiştir" : "Resim Yükle"}
      </button>
    </>
  );
}

// ─── Haberler sekmesi ────────────────────────────────────────
function HomeNewsTab({ items, setItems, api, token, showToast }) {
  const [showForm, setShowForm] = React.useState(false);
  const [editId, setEditId]   = React.useState(null);
  const [saving, setSaving]   = React.useState(false);
  const [form, setForm]       = React.useState({ title:"", description:"", date_label:"", is_active:true, order_index:0 });

  const startNew  = () => { setForm({ title:"", description:"", date_label:"", is_active:true, order_index:items.length }); setEditId(null); setShowForm(true); };
  const startEdit = (item) => { setForm({ title:item.title, description:item.description||"", date_label:item.date_label||"", is_active:item.is_active, order_index:item.order_index||0 }); setEditId(item.id); setShowForm(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        const r = await api(`/admin/home-news/${editId}`, { method:"PUT", body:JSON.stringify(form) });
        if (r) setItems(prev=>prev.map(i=>i.id===editId?r:i));
      } else {
        const r = await api("/admin/home-news", { method:"POST", body:JSON.stringify(form) });
        if (r) setItems(prev=>[...prev,r]);
      }
      setShowForm(false); setEditId(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.title}" silinecek. Emin misiniz?`)) return;
    await api(`/admin/home-news/${item.id}`, { method:"DELETE" });
    setItems(prev=>prev.filter(i=>i.id!==item.id));
  };

  const toggleActive = async (item) => {
    const r = await api(`/admin/home-news/${item.id}`, { method:"PUT", body:JSON.stringify({...item,is_active:!item.is_active}) });
    if (r) setItems(prev=>prev.map(i=>i.id===item.id?r:i));
  };

  const lbl = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
  const inp = "w-full h-10 px-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-slate-900 text-lg">Takım Etkinlikleri</h2>
          <p className="text-slate-400 text-sm mt-0.5">Anasayfadaki haber kartlarını yönetin.</p>
        </div>
        <button onClick={startNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition hover:opacity-90 shadow-lg"
          style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
          <Plus className="w-4 h-4"/> Yeni Haber
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div><label className={lbl}>Başlık</label><input className={inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Etkinlik başlığı"/></div>
          <div><label className={lbl}>Açıklama <span className="normal-case font-normal text-slate-400">(isteğe bağlı)</span></label><textarea className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" rows="3" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Etkinlik hakkında kısa bir açıklama…"/></div>
          <div><label className={lbl}>Tarih</label><input className={inp} value={form.date_label} onChange={e=>setForm(f=>({...f,date_label:e.target.value}))} placeholder="12 Mayıs 2026"/></div>
          <div className="flex items-center gap-3">
            <label className={lbl + " mb-0"}>Aktif</label>
            <button type="button" onClick={()=>setForm(f=>({...f,is_active:!f.is_active}))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active?"bg-brand-500":"bg-slate-300"}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${form.is_active?"left-6":"left-1"}`}/>
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>{setShowForm(false);setEditId(null);}} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">İptal</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition hover:opacity-90"
              style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
              {saving?"Kaydediliyor…":"Kaydet"}
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {items.length === 0 && !showForm && (
          <div className="col-span-2 text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
            <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-30"/>
            <p>Henüz haber eklenmedi</p>
          </div>
        )}
        {items.map(item=>(
          <div key={item.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="h-36 relative bg-slate-100 overflow-hidden">
              {item.image_url
                ? <img src={item.image_url} alt="" className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-slate-300"><Upload className="w-8 h-8"/></div>}
              <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${item.is_active?"bg-brand-100 text-brand-700":"bg-slate-100 text-slate-500"}`}>
                {item.is_active?"Aktif":"Pasif"}
              </span>
            </div>
            <div className="p-4">
              <p className="font-medium text-slate-800 text-sm line-clamp-2 mb-1">{item.title}</p>
              {item.date_label && <p className="text-xs text-slate-400 mb-3">{item.date_label}</p>}
              <div className="flex gap-2 flex-wrap">
                <ImageUploadBtn itemId={item.id} endpoint={`/admin/home-news/${item.id}/image`} token={token}
                  currentUrl={item.image_url} onUploaded={r=>setItems(prev=>prev.map(i=>i.id===item.id?r:i))} onError={showToast}/>
                <button onClick={()=>toggleActive(item)}
                  className="py-1.5 px-3 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition text-slate-600">
                  {item.is_active?"Pasife Al":"Aktife Al"}
                </button>
                <button onClick={()=>startEdit(item)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition text-slate-600">
                  <Edit2 className="w-3.5 h-3.5"/>
                </button>
                <button onClick={()=>handleDelete(item)}
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition text-red-500">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Galeri sekmesi ──────────────────────────────────────────
function HomeGalleryTab({ items, setItems, api, token, showToast }) {
  const [showForm, setShowForm] = React.useState(false);
  const [editId, setEditId]   = React.useState(null);
  const [saving, setSaving]   = React.useState(false);
  const [form, setForm]       = React.useState({ is_active:true, order_index:0 });

  const startNew  = () => { setForm({ is_active:true, order_index:items.length }); setEditId(null); setShowForm(true); };
  const startEdit = (item) => { setForm({ is_active:item.is_active, order_index:item.order_index||0 }); setEditId(item.id); setShowForm(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        const r = await api(`/admin/home-gallery/${editId}`, { method:"PUT", body:JSON.stringify(form) });
        if (r) setItems(prev=>prev.map(i=>i.id===editId?r:i));
      } else {
        const r = await api("/admin/home-gallery", { method:"POST", body:JSON.stringify(form) });
        if (r) setItems(prev=>[...prev,r]);
      }
      setShowForm(false); setEditId(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm("Bu galeri kartı silinecek. Emin misiniz?")) return;
    await api(`/admin/home-gallery/${item.id}`, { method:"DELETE" });
    setItems(prev=>prev.filter(i=>i.id!==item.id));
  };

  const toggleActive = async (item) => {
    const r = await api(`/admin/home-gallery/${item.id}`, { method:"PUT", body:JSON.stringify({...item,is_active:!item.is_active}) });
    if (r) setItems(prev=>prev.map(i=>i.id===item.id?r:i));
  };

  const lbl = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-slate-900 text-lg">Galeri Kartları</h2>
          <p className="text-slate-400 text-sm mt-0.5">Anasayfadaki galeri bölümünü yönetin.</p>
        </div>
        <button onClick={startNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition hover:opacity-90 shadow-lg"
          style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
          <Plus className="w-4 h-4"/> Yeni Kart
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <label className={lbl + " mb-0"}>Aktif</label>
            <button type="button" onClick={()=>setForm(f=>({...f,is_active:!f.is_active}))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active?"bg-brand-500":"bg-slate-300"}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${form.is_active?"left-6":"left-1"}`}/>
            </button>
          </div>
          <p className="text-xs text-slate-400">Kartı oluşturduktan sonra resim yükleyebilirsiniz.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>{setShowForm(false);setEditId(null);}} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">İptal</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition hover:opacity-90"
              style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
              {saving?"Kaydediliyor…":"Kaydet"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.length === 0 && !showForm && (
          <div className="col-span-4 text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
            <GalleryHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30"/>
            <p>Henüz galeri kartı eklenmedi</p>
          </div>
        )}
        {items.map(item=>(
          <div key={item.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="h-28 relative bg-slate-100 overflow-hidden">
              {item.image_url
                ? <img src={item.image_url} alt="" className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-slate-300"><Upload className="w-6 h-6"/></div>}
              <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${item.is_active?"bg-brand-100 text-brand-700":"bg-slate-100 text-slate-500"}`}>
                {item.is_active?"Aktif":"Pasif"}
              </span>
            </div>
            <div className="p-3 flex flex-col gap-2">
              <ImageUploadBtn itemId={item.id} endpoint={`/admin/home-gallery/${item.id}/image`} token={token}
                currentUrl={item.image_url} onUploaded={r=>setItems(prev=>prev.map(i=>i.id===item.id?r:i))} onError={showToast}/>
              <div className="flex gap-2">
                <button onClick={()=>toggleActive(item)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition text-slate-600">
                  {item.is_active?"Pasif":"Aktif"}
                </button>
                <button onClick={()=>startEdit(item)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition text-slate-600">
                  <Edit2 className="w-3.5 h-3.5"/>
                </button>
                <button onClick={()=>handleDelete(item)}
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition text-red-500">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Yardımcı: tarih formatı ───────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR", { day:"numeric", month:"short", year:"numeric" }) : "—";
const fmtFull = (d) => d ? new Date(d).toLocaleString("tr-TR") : "—";

// ─── Toast bildirimi ────────────────────────────────────────
function AdminToast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium text-white pointer-events-auto transition-all
          ${t.type==='error'?'bg-red-500':'bg-brand-600'}`}>
          {t.type==='error'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Ana bileşen ────────────────────────────────────────────
export default function AdminPanel() {
  const [token, setToken]       = useState(() => sessionStorage.getItem("admin_token") || "");
  const [loginError, setLoginError] = useState("");
  const [toasts, setToasts]     = useState([]);
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
  const [homeNews, setHomeNews] = useState([]);
  const [homeGallery, setHomeGallery] = useState([]);
  const [logs, setLogs]         = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [logFilter, setLogFilter] = useState("all");
  const [chartPeriod, setChartPeriod] = useState("daily");
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  // ─── Toast helper ───────────────────────────────────────
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };

  // ─── API helper ─────────────────────────────────────────
  const api = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (res.status === 401 || res.status === 403) { handleLogout(); return null; }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Sunucu hatası (${res.status})`);
    return data;
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
      else if (t === "banners")  setBanners(await api("/admin/banners") || []);
      else if (t === "home-news") setHomeNews(await api("/admin/home-news") || []);
      else if (t === "home-gallery") setHomeGallery(await api("/admin/home-gallery") || []);
      else if (t === "logs") {
        const [logsData, analyticsData] = await Promise.all([
          api("/admin/logs"),
          api("/admin/analytics"),
        ]);
        setLogs(logsData || []);
        setAnalytics(analyticsData || null);
      }
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f0fdf4 0%,#e5f9f9 60%,#bbf7d0 100%)" }}>
        {/* Arka plan blob */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-20" style={{ background: "radial-gradient(circle,#00b7ba,transparent 70%)" }} />
          <div className="absolute bottom-[-100px] left-[-80px] w-[350px] h-[350px] rounded-full opacity-15" style={{ background: "radial-gradient(circle,#009295,transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.8) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        <div className="relative w-full max-w-md mx-4">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src="/icons/logo-yatay.svg" alt="Muuvlink" className="h-10 w-auto mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Admin Panel</h1>
            <p className="text-slate-500 text-sm mt-1">Yönetim Konsolu</p>
          </div>

          {/* Login kutusu */}
          <div className="bg-white border border-brand-100 rounded-2xl p-8 shadow-xl">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-2">E-posta</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="admin@mail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-2">Şifre</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition">
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 hover:shadow-xl disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}
              >
                {loginLoading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Giriş yapılıyor…</>
                ) : (
                  <><Lock className="w-4 h-4" /> Giriş Yap</>
                )}
              </button>
            </form>

            <p className="text-center text-slate-400 text-xs mt-6">
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
    { id: "logs",      label: "Loglar",       icon: Activity },
    { id: "messages",  label: "Mesajlar",     icon: MessageSquare,
      badge: stats?.unreadContact > 0 ? stats.unreadContact : null },
    { id: "banners",      label: "Bannerlar",    icon: Image },
    { id: "home-news",    label: "Haberler",     icon: Newspaper },
    { id: "home-gallery", label: "Galeri",       icon: GalleryHorizontal },
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
      showToast("Banner kaydedildi ✓");
    } catch (e) {
      showToast(e.message || "Banner kaydedilemedi.", "error");
    }
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
        showToast('Görsel yüklendi.');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Yükleme hatası (${res.status})`, 'error');
      }
    } catch (e) {
      showToast(`Bağlantı hatası: ${e.message}`, 'error');
    }
    finally { setUploadingId(null); }
  };

  // ─── Relative time helper ───────────────────────────────
  const relativeTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return "az önce";
    if (mins  < 60) return `${mins} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days  < 30) return `${days} gün önce`;
    return fmt(dateStr);
  };

  const EVENT_CONFIG = {
    user_register:    { icon: "👤", label: "Üye Oldu",              color: "bg-blue-100 text-blue-700"   },
    team_create:      { icon: "🏆", label: "Takım Kurdu",           color: "bg-purple-100 text-purple-700" },
    team_join:        { icon: "👥", label: "Takıma Katıldı",        color: "bg-indigo-100 text-indigo-700" },
    training_create:  { icon: "📋", label: "Antrenman Oluşturdu",   color: "bg-brand-100 text-brand-700"  },
    training_join:    { icon: "✅", label: "Antrenmana Katıldı",    color: "bg-brand-100 text-brand-700" },
    training_leave:   { icon: "🚪", label: "Antrenman Ayrıldı",     color: "bg-orange-100 text-orange-700" },
  };

  const LOG_FILTERS = [
    { id: "all",            label: "Tümü" },
    { id: "user_register",  label: "Üye Kayıt" },
    { id: "team_create",    label: "Takım" },
    { id: "team_join",      label: "Takım Katıl" },
    { id: "training_create",label: "Antrenman" },
    { id: "training_join",  label: "Katılım" },
  ];

  const PERIOD_LABELS = { daily: "Günlük", weekly: "Haftalık", monthly: "Aylık" };

  const LogsPage = () => {
    const chartData = analytics?.[chartPeriod] || [];
    const filteredLogs = logFilter === "all"
      ? logs.slice(0, 100)
      : logs.filter(l => l.event_type === logFilter).slice(0, 100);

    const periodKey = chartPeriod === "monthly" ? 7 : 5;

    // Filtre → grafik serisi eşleştirmesi
    const FILTER_SERIES = {
      all:             ["users","teams","teamJoins","trainings","joins"],
      user_register:   ["users"],
      team_create:     ["teams"],
      team_join:       ["teamJoins"],
      training_create: ["trainings"],
      training_join:   ["joins"],
    };
    const activeSeries = FILTER_SERIES[logFilter] || ["users","teams","teamJoins","trainings","joins"];
    const show = (key) => activeSeries.includes(key);
    const seriesStroke = (key, color) => show(key) ? color : "#e2e8f0";
    const seriesWidth  = (key) => show(key) ? 2.5 : 0;
    const seriesFill   = (key) => show(key) ? 1 : 0;

    return (
      <div className="space-y-6">
        {/* ── Stats summary ───────────────────────────── */}
        {analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Yeni Üye",        key: "users",     grad: "from-blue-500 to-blue-700",     icon: "👤" },
              { label: "Takım Kuruldu",   key: "teams",     grad: "from-purple-500 to-purple-700",  icon: "🏆" },
              { label: "Takıma Katılım",  key: "teamJoins", grad: "from-indigo-500 to-indigo-700",  icon: "👥" },
              { label: "Yeni Antrenman",  key: "trainings", grad: "from-brand-500 to-brand-700",    icon: "📋" },
              { label: "Antrenmana Kat.", key: "joins",     grad: "from-amber-500 to-orange-500",   icon: "✅" },
            ].map(({ label, key, grad, icon }) => (
              <div key={key} className={`bg-gradient-to-br ${grad} rounded-2xl p-5 text-white shadow-lg`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-xs opacity-75 font-medium bg-white/20 px-2 py-0.5 rounded-lg">bugün</span>
                </div>
                <div className="text-3xl font-semibold mb-0.5">{analytics.totals.today[key] ?? 0}</div>
                <div className="text-sm opacity-80 font-medium">{label}</div>
                <div className="mt-2 flex gap-3 text-xs opacity-70">
                  <span>Bu hafta: <strong className="opacity-100">{analytics.totals.week[key] ?? 0}</strong></span>
                  <span>Bu ay: <strong className="opacity-100">{analytics.totals.month[key] ?? 0}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Chart ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="font-semibold text-slate-900">Büyüme Grafiği</h2>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {Object.entries(PERIOD_LABELS).map(([p, lbl]) => (
                <button key={p} onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    chartPeriod === p ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Henüz veri yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gUsers"     x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#3B82F6" stopOpacity={show("users")     ? 0.35 : 0}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gTeams"     x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#8B5CF6" stopOpacity={show("teams")     ? 0.35 : 0}/><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gTeamJoins" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#6366F1" stopOpacity={show("teamJoins") ? 0.35 : 0}/><stop offset="95%" stopColor="#6366F1" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gTrainings" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#00b7ba" stopOpacity={show("trainings") ? 0.35 : 0}/><stop offset="95%" stopColor="#00b7ba" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gJoins"     x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#F59E0B" stopOpacity={show("joins")     ? 0.35 : 0}/><stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={v => v.slice(periodKey === 7 ? 0 : 5)} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="users"     name="Üye"           stroke={seriesStroke("users",     "#3B82F6")} fill="url(#gUsers)"     strokeWidth={seriesWidth("users")}     dot={false} fillOpacity={seriesFill("users")} />
                <Area type="monotone" dataKey="teams"     name="Takım Kuruldu" stroke={seriesStroke("teams",     "#8B5CF6")} fill="url(#gTeams)"     strokeWidth={seriesWidth("teams")}     dot={false} fillOpacity={seriesFill("teams")} />
                <Area type="monotone" dataKey="teamJoins" name="Takıma Katılım" stroke={seriesStroke("teamJoins", "#6366F1")} fill="url(#gTeamJoins)" strokeWidth={seriesWidth("teamJoins")} dot={false} fillOpacity={seriesFill("teamJoins")} />
                <Area type="monotone" dataKey="trainings" name="Antrenman"      stroke={seriesStroke("trainings", "#00b7ba")} fill="url(#gTrainings)" strokeWidth={seriesWidth("trainings")} dot={false} fillOpacity={seriesFill("trainings")} />
                <Area type="monotone" dataKey="joins"     name="Antrenmana Kat." stroke={seriesStroke("joins",    "#F59E0B")} fill="url(#gJoins)"     strokeWidth={seriesWidth("joins")}     dot={false} fillOpacity={seriesFill("joins")} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Activity Feed ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-slate-900">Aktivite Akışı
              <span className="ml-2 text-slate-400 font-normal text-sm">({filteredLogs.length})</span>
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {LOG_FILTERS.map(f => (
                <button key={f.id} onClick={() => setLogFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    logFilter === f.id
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-slate-50">
            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">Henüz aktivite yok</div>
            )}
            {filteredLogs.map(log => {
              const cfg = EVENT_CONFIG[log.event_type] || { icon: "•", label: log.event_type, color: "bg-slate-100 text-slate-600" };
              const meta = log.meta || {};
              const detail = meta.team_name || meta.training_title || meta.email || "";
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3.5">
                  <span className="text-xl flex-shrink-0 mt-0.5">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-slate-500 text-xs font-medium truncate">{log.user_name || log.user_email || "—"}</span>
                    </div>
                    {detail && <div className="text-slate-400 text-xs mt-0.5 truncate">{detail}</div>}
                  </div>
                  <span className="text-slate-300 text-xs flex-shrink-0 text-right">{relativeTime(log.created_at)}</span>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Zaman</th>
                  <th className="text-left px-4 py-3">Olay</th>
                  <th className="text-left px-4 py-3">Kullanıcı</th>
                  <th className="text-left px-4 py-3">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-12 text-slate-400">Henüz aktivite yok</td></tr>
                )}
                {filteredLogs.map(log => {
                  const cfg = EVENT_CONFIG[log.event_type] || { icon: "•", label: log.event_type, color: "bg-slate-100 text-slate-600" };
                  const meta = log.meta || {};
                  const detail = meta.team_name || meta.training_title || meta.email || "";
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{relativeTime(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium text-sm">
                        {log.user_name || <span className="text-slate-400">{log.user_email || "—"}</span>}
                        {log.user_email && log.user_name && (
                          <div className="text-slate-400 text-xs font-normal">{log.user_email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{detail || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const statCards = stats ? [
    { label: "Toplam Kullanıcı",   value: stats.users,            icon: Users,        grad: "from-brand-500 to-brand-700" },
    { label: "Toplam Antrenman",   value: stats.trainings,        icon: Activity,     grad: "from-brand-400 to-brand-600" },
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
      <AdminToast toasts={toasts}/>

      {/* ── Mobil overlay ─────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)}/>
      )}

      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 flex flex-col bg-white border-r border-slate-100 shadow-sm
        transform transition-transform duration-200 ease-in-out
        ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <img src="/icons/amblem.svg" alt="Muuvlink" className="h-8 w-auto flex-shrink-0" />
          <div className="flex-1">
            <div className="text-slate-800 font-semibold text-sm tracking-tight">Muuvlink</div>
            <div className="text-slate-400 text-xs font-medium">Admin Panel</div>
          </div>
          <button className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition" onClick={() => setMobileNavOpen(false)}>
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => { loadTab(id); setMobileNavOpen(false); }}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                tab === id
                  ? "text-white shadow-md"
                  : "text-slate-500 hover:text-brand-700 hover:bg-brand-50"
              }`}
              style={tab === id ? { background: "linear-gradient(135deg,#00b7ba,#009295)" } : {}}
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </span>
              {badge && (
                <span className="w-5 h-5 bg-amber-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">{badge}</span>
              )}
              {tab === id && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </button>
          ))}
        </nav>

        {/* Çıkış */}
        <div className="px-3 py-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
          <a
            href="/"
            className="mt-1 w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-all"
          >
            <TrendingUp className="w-4 h-4" />
            Uygulamaya Dön
          </a>
        </div>
      </aside>

      {/* ── İçerik ────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Üst bar */}
        <header className="bg-white border-b border-slate-100 px-4 md:px-8 py-4 flex items-center gap-3 sticky top-0 z-10">
          {/* Hamburger (mobil) */}
          <button className="md:hidden flex-shrink-0 p-2 rounded-xl hover:bg-slate-100 transition" onClick={() => setMobileNavOpen(true)}>
            <Menu className="w-5 h-5 text-slate-600"/>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold text-slate-900 truncate">
              {navItems.find(n => n.id === tab)?.label || "Panel"}
            </h1>
            <p className="text-slate-400 text-xs hidden sm:block">Muuvlink Yönetim Konsolu</p>
          </div>
          {/* Arama */}
          {tab !== "dashboard" && (
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ara…"
                className="w-36 sm:w-56 pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:bg-white transition"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </header>

        <div className="p-4 md:p-8">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
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
                    <div className="text-4xl font-semibold mb-1">{s.value ?? "—"}</div>
                    <div className="text-sm opacity-75 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Son kayıtlar */}
              {stats?.recentUsers?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-50">
                    <h2 className="font-medium text-slate-900">🆕 Son Kayıt Olan Kullanıcılar</h2>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {stats.recentUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-medium text-sm shadow-sm flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
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
              <div className="px-4 md:px-6 py-4 border-b border-slate-100">
                <h2 className="font-medium text-slate-900">Kullanıcılar <span className="text-slate-400 font-normal text-sm">({filteredUsers.length})</span></h2>
              </div>

              {/* Mobil kart listesi */}
              <div className="sm:hidden divide-y divide-slate-50">
                {filteredUsers.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">Kullanıcı bulunamadı</div>
                )}
                {filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
                      {(u.avatar?.startsWith("/uploads/") || u.avatar?.startsWith("http"))
                        ? <img src={u.avatar.startsWith("http") ? u.avatar : `${BASE_URL}${u.avatar}`} alt="" className="w-full h-full object-cover" />
                        : u.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">{u.name}</span>
                        {u.is_admin
                          ? <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded-lg text-[10px] font-medium">Admin</span>
                          : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[10px]">Üye</span>}
                      </div>
                      <div className="text-slate-400 text-xs truncate">{u.email}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        <span>{u.team_count ?? 0} takım</span>
                        <span>·</span>
                        <span>{u.training_count ?? 0} antrenman</span>
                        <span>·</span>
                        <span>{fmt(u.created_at)}</span>
                      </div>
                    </div>
                    {!u.is_admin && (
                      <button onClick={() => del(`/admin/users/${u.id}`, u.name, "users")}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Masaüstü tablo */}
              <div className="hidden sm:block overflow-x-auto">
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
                            <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                              style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
                              {(u.avatar?.startsWith("/uploads/") || u.avatar?.startsWith("http"))
                                ? <img src={u.avatar.startsWith("http") ? u.avatar : `${BASE_URL}${u.avatar}`} alt="" className="w-full h-full object-cover" />
                                : u.name[0].toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-900">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{u.email}</td>
                        <td className="px-4 py-3.5 text-center text-slate-700 font-semibold">{u.team_count ?? "—"}</td>
                        <td className="px-4 py-3.5 text-center text-slate-700 font-semibold">{u.training_count ?? "—"}</td>
                        <td className="px-4 py-3.5 text-center">
                          {u.is_admin
                            ? <span className="px-2.5 py-1 bg-brand-100 text-brand-700 rounded-lg text-xs font-medium">Admin</span>
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
              <div className="px-4 md:px-6 py-4 border-b border-slate-100">
                <h2 className="font-medium text-slate-900">Antrenmanlar <span className="text-slate-400 font-normal text-sm">({filteredTrainings.length})</span></h2>
              </div>

              {/* Mobil kart listesi */}
              <div className="sm:hidden divide-y divide-slate-50">
                {filteredTrainings.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">Antrenman bulunamadı</div>
                )}
                {filteredTrainings.map(t => {
                  const trainingDateObj = new Date(t.training_date);
                  const localDateStr = trainingDateObj.toLocaleDateString('en-CA');
                  const timeStr = t.training_time?.slice(0, 5) || "00:00";
                  const trainingDateTime = new Date(`${localDateStr}T${timeStr}:00`);
                  const isPast = trainingDateTime < new Date();
                  return (
                    <div key={t.id} className="flex items-start gap-3 px-4 py-3.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
                        <Activity className="w-5 h-5 text-white"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-sm truncate">{t.title}</div>
                        <div className="text-slate-400 text-xs">{t.team_name || "—"}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                          <span>{fmt(t.training_date)}</span>
                          <span>·</span>
                          <span>{t.training_time?.slice(0,5) || "—"}</span>
                          <span>·</span>
                          <span>{t.participant_count}/{t.capacity} kişi</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${isPast ? "bg-slate-100 text-slate-500" : "bg-brand-100 text-brand-700"}`}>
                          {isPast ? "Bitti" : "Aktif"}
                        </span>
                        <button onClick={() => del(`/admin/trainings/${t.id}`, t.title, "trainings")}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Masaüstü tablo */}
              <div className="hidden sm:block overflow-x-auto">
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
                      const trainingDateObj = new Date(t.training_date);
                      const localDateStr = trainingDateObj.toLocaleDateString('en-CA');
                      const timeStr = t.training_time?.slice(0, 5) || "00:00";
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
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${isPast ? "bg-slate-100 text-slate-500" : "bg-brand-100 text-brand-700"}`}>
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
              <div className="px-4 md:px-6 py-4 border-b border-slate-100">
                <h2 className="font-medium text-slate-900">Takımlar <span className="text-slate-400 font-normal text-sm">({filteredTeams.length})</span></h2>
              </div>

              {/* Mobil kart listesi */}
              <div className="sm:hidden divide-y divide-slate-50">
                {filteredTeams.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">Takım bulunamadı</div>
                )}
                {filteredTeams.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm"
                      style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
                      {(t.avatar?.startsWith("/uploads/") || t.avatar?.startsWith("http"))
                        ? <img src={t.avatar.startsWith("http") ? t.avatar : `${BASE_URL}${t.avatar}`} alt="" className="w-full h-full object-cover" />
                        : t.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 text-sm truncate">{t.name}</div>
                      <div className="text-slate-400 text-xs">{t.sport} · {t.owner_name}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                        <span>{t.member_count} üye</span>
                        <span>·</span>
                        <span className={`flex items-center gap-0.5 ${t.is_private ? "text-slate-500" : "text-brand-600"}`}>
                          {t.is_private ? <><Lock className="w-3 h-3"/> Gizli</> : <><Globe className="w-3 h-3"/> Açık</>}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => del(`/admin/teams/${t.id}`, t.name, "teams")}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Masaüstü tablo */}
              <div className="hidden sm:block overflow-x-auto">
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
                            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm"
                              style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
                              {(t.avatar?.startsWith("/uploads/") || t.avatar?.startsWith("http"))
                                ? <img src={t.avatar.startsWith("http") ? t.avatar : `${BASE_URL}${t.avatar}`} alt="" className="w-full h-full object-cover" />
                                : t.name[0].toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-900">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{t.sport}</td>
                        <td className="px-4 py-3.5 text-slate-600">{t.owner_name}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{t.member_count}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${t.is_private ? "bg-slate-100 text-slate-600" : "bg-brand-100 text-brand-700"}`}>
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
                  <h2 className="font-medium text-slate-900 text-lg">Hero Bannerları</h2>
                  <p className="text-slate-400 text-sm mt-0.5">Anasayfadaki slider'ı buradan yönetebilirsiniz.</p>
                </div>
                <button
                  onClick={() => { setBannerForm(emptyBanner); setEditingBannerId(null); setShowBannerForm(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition hover:opacity-90 shadow-lg"
                  style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}
                >
                  <Plus className="w-4 h-4"/> Yeni Banner
                </button>
              </div>

              {/* Banner form (ekleme/düzenleme) */}
              {showBannerForm && (
                <div className="bg-white rounded-2xl border border-brand-200 shadow-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                    style={{background:"linear-gradient(90deg,#00b7ba11,#00929511)"}}>
                    <h3 className="font-medium text-slate-900">{editingBannerId ? "Banner Düzenle" : "Yeni Banner Ekle"}</h3>
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
                        <div className="text-white font-semibold text-xl leading-tight">
                          {bannerForm.title || "Başlık"}{" "}
                          <span className="text-brand-400">{bannerForm.title_highlight || "Vurgulu metin"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Renk seçiciler */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Arka Plan Gradyanı</label>
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
                              className="w-24 text-center text-xs border border-slate-200 rounded-lg px-2 py-1 font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
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
                          ? <ToggleRight className="w-8 h-8 text-brand-600"/>
                          : <ToggleLeft className="w-8 h-8 text-slate-400"/>}
                      </button>
                      <span className="text-sm font-semibold text-slate-700">
                        {bannerForm.is_active ? "Aktif — sayfada görünür" : "Pasif — gizli"}
                      </span>
                    </div>

                    {/* Başlık + Alt metin */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Başlık <span className="text-slate-400 font-normal">(sabit satır)</span></label>
                        <input value={bannerForm.title} onChange={e=>setBannerForm(p=>({...p,title:e.target.value}))}
                          placeholder="Sporla Buluş,"
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Rozet Metni</label>
                        <input value={bannerForm.badge_text} onChange={e=>setBannerForm(p=>({...p,badge_text:e.target.value}))}
                          placeholder="🏃 500+ Aktif Sporcu"
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Alt Metin</label>
                      <textarea value={bannerForm.subtitle} onChange={e=>setBannerForm(p=>({...p,subtitle:e.target.value}))}
                        placeholder="Açıklama metni…" rows={2}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"/>
                    </div>

                    {/* Butonlar */}
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Butonlar</label>

                      {/* Ana buton */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full" style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}/>
                          <span className="text-xs font-medium text-slate-600">Ana Buton</span>
                          <span className="text-xs text-slate-400">(gradient, öne çıkan)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Buton Metni</label>
                            <input value={bannerForm.cta_primary_text} onChange={e=>setBannerForm(p=>({...p,cta_primary_text:e.target.value}))}
                              placeholder="Hemen Başla"
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Link / URL</label>
                            <input value={bannerForm.cta_primary_url} onChange={e=>setBannerForm(p=>({...p,cta_primary_url:e.target.value}))}
                              placeholder="/antrenmanlar veya https://..."
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                          </div>
                        </div>
                      </div>

                      {/* İkinci buton */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-slate-400"/>
                          <span className="text-xs font-medium text-slate-600">İkinci Buton</span>
                          <span className="text-xs text-slate-400">(şeffaf, giriş yapanlara gösterilir)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Buton Metni</label>
                            <input value={bannerForm.cta_secondary_text} onChange={e=>setBannerForm(p=>({...p,cta_secondary_text:e.target.value}))}
                              placeholder="Antrenmanları Keşfet"
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Link / URL</label>
                            <input value={bannerForm.cta_secondary_url} onChange={e=>setBannerForm(p=>({...p,cta_secondary_url:e.target.value}))}
                              placeholder="/takimlar veya https://..."
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Motto listesi */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          Typewriter Mottoları
                          <span className="ml-2 text-slate-400 font-normal normal-case">(sırayla yazılıp silinir)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setBannerForm(p => ({ ...p, mottos: [...(p.mottos||[""]), ""] }))}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition"
                        >
                          <Plus className="w-3 h-3"/> Motto Ekle
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(bannerForm.mottos || [""]).map((m, mi) => (
                          <div key={mi} className="flex items-center gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-600 text-[10px] font-medium flex items-center justify-center">{mi+1}</span>
                            <input
                              type="text"
                              value={m}
                              onChange={e => {
                                const arr = [...(bannerForm.mottos||[""])];
                                arr[mi] = e.target.value;
                                setBannerForm(p => ({ ...p, mottos: arr }));
                              }}
                              placeholder={`Motto ${mi+1}…`}
                              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
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
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition hover:opacity-90"
                        style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
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

                    <div className="p-4 md:p-5">
                      {/* Üst satır: görsel + bilgi */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-shrink-0 w-16 h-11 rounded-xl flex items-center justify-center relative overflow-hidden border border-slate-100"
                          style={{background:`linear-gradient(135deg,${b.gradient_from},${b.gradient_via || b.gradient_to},${b.gradient_to})`}}>
                          {b.image_url
                            ? <img src={`${BASE_URL}${b.image_url}`} alt="" className="w-full h-full object-cover"/>
                            : <Image className="w-4 h-4 text-white/40"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-slate-900 text-sm truncate max-w-[140px] md:max-w-none">{b.title} {b.title_highlight}</span>
                            {b.badge_text && <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">{b.badge_text}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.is_active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"}`}>
                              {b.is_active ? "Aktif" : "Pasif"}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{b.subtitle}</p>
                        </div>
                      </div>

                      {/* Alt satır: aksiyonlar (her zaman tam genişlik, kaymaz) */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="relative cursor-pointer">
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                            onChange={e => { if (e.target.files[0]) uploadBannerImage(b.id, e.target.files[0]); e.target.value=""; }}/>
                          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap ${uploadingId === b.id ? "bg-brand-100 text-brand-500" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                            {uploadingId === b.id
                              ? <div className="w-3 h-3 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin"/>
                              : <Upload className="w-3 h-3"/>}
                            Görsel
                          </span>
                        </label>
                        <button onClick={() => toggleBannerActive(b)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap ${b.is_active ? "bg-brand-50 text-brand-700 hover:bg-brand-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                          {b.is_active ? <ToggleRight className="w-3.5 h-3.5"/> : <ToggleLeft className="w-3.5 h-3.5"/>}
                          {b.is_active ? "Aktif" : "Pasif"}
                        </button>
                        <button onClick={() => copyBanner(b)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-xl text-xs font-medium hover:bg-brand-100 transition whitespace-nowrap">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                          </svg>
                          Kopyala
                        </button>
                        <button onClick={() => startEditBanner(b)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-200 transition whitespace-nowrap">
                          <Edit2 className="w-3 h-3"/> Düzenle
                        </button>
                        <button onClick={() => deleteBanner(b)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 rounded-xl text-xs font-medium hover:bg-red-100 transition whitespace-nowrap">
                          <Trash2 className="w-3 h-3"/> Sil
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── HOME NEWS ────────────────────────────────── */}
          {!loading && tab === "home-news" && (
            <HomeNewsTab
              items={homeNews} setItems={setHomeNews} api={api} token={token} showToast={showToast}
            />
          )}

          {/* ── HOME GALLERY ─────────────────────────────── */}
          {!loading && tab === "home-gallery" && (
            <HomeGalleryTab
              items={homeGallery} setItems={setHomeGallery} api={api} token={token} showToast={showToast}
            />
          )}

          {/* ── LOGS ─────────────────────────────────────── */}
          {!loading && tab === "logs" && <LogsPage />}

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
                <div key={m.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${m.is_read ? "border-slate-100" : "border-brand-200"}`}>
                  {!m.is_read && <div className="h-1" style={{ background: "linear-gradient(90deg,#00b7ba,#009295)" }} />}
                  <div className="p-4 md:p-6">
                    <div className="flex items-start justify-between gap-3 flex-wrap md:flex-nowrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {!m.is_read && (
                            <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded-lg text-xs font-medium">Yeni</span>
                          )}
                          <span className="font-medium text-slate-900">{m.name}</span>
                          <span className="text-slate-300 text-sm">·</span>
                          <a href={`mailto:${m.email}`} className="text-brand-600 text-sm hover:underline">{m.email}</a>
                          <span className="text-slate-400 text-xs ml-auto">{fmtFull(m.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700 text-sm">{m.subject}</span>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap border-l-2 border-brand-200 pl-4">
                          {m.message}
                        </p>
                      </div>

                      <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 flex-wrap">
                        {!m.is_read && (
                          <button onClick={() => markRead(m.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 rounded-xl text-xs font-medium hover:bg-brand-100 transition whitespace-nowrap">
                            <CheckCheck className="w-3.5 h-3.5" /> Okundu
                          </button>
                        )}
                        <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-200 transition whitespace-nowrap">
                          <Mail className="w-3.5 h-3.5" /> Yanıtla
                        </a>
                        <button onClick={() => del(`/admin/contact/${m.id}`, m.subject, "messages")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-medium hover:bg-red-100 transition whitespace-nowrap">
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
