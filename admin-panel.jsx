import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, Users, Activity, Shield, MessageSquare,
  LogOut, Trash2, Eye, EyeOff, CheckCheck, Mail,
  TrendingUp, Calendar, AlertTriangle, Search, X,
  ChevronRight, Lock, Globe, Image, Plus, Edit2, ToggleLeft, ToggleRight,
  Upload, GripVertical, ChevronUp, ChevronDown, Newspaper, GalleryHorizontal, Menu,
  Trophy, User, ClipboardList, CheckCircle2, DoorOpen, Sparkles, Target, Flag,
  Ticket, MapPin, ExternalLink, MousePointerClick,
  Radar, ScanSearch, RefreshCw, Loader2, XCircle, ListChecks,
} from "lucide-react";
import LocationPicker from "./LocationPicker";
import { createT, detectLang } from "./i18n.js";

const SPORT_TYPES = ["Basketbol","Bisiklet","Crossfit","Futbol","Kano","Koşu","Kürek","Padel","Pilates","Tenis","Trekking","Triatlon","Voleybol","Yoga","Yüzme","Diğer"];

// Ana uygulamayla birebir aynı konum seçici (arama + haritadan seçme)
const adminLang = detectLang();
const adminT = createT(adminLang);
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

console.log('%c[Muuvlink Admin v8]', 'color:teal;font-weight:bold');

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
          <h2 className="font-display font-bold text-slate-900 text-xl" style={{letterSpacing:"-0.01em"}}>Takım Etkinlikleri</h2>
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
          <h2 className="font-display font-bold text-slate-900 text-xl" style={{letterSpacing:"-0.01em"}}>Galeri Kartları</h2>
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

// ─── Ücretli Etkinlikler sekmesi ───────────────────────────
const emptyPaidEvent = {
  title:"", description:"", sport:"", organizer:"", registration_url:"",
  training_date:"", training_time:"", location_name:"",
  location_lat:"", location_lng:"", location_address:"",
};
function PaidEventsTab({ items, setItems, api, token, showToast }) {
  const [showForm, setShowForm] = React.useState(false);
  const [editId, setEditId]     = React.useState(null);
  const [saving, setSaving]     = React.useState(false);
  const [form, setForm]         = React.useState(emptyPaidEvent);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const startNew  = () => { setForm(emptyPaidEvent); setEditId(null); setShowForm(true); };
  const startEdit = (it) => {
    setForm({
      title: it.title || "", description: it.description || "", sport: it.sport || "",
      organizer: it.organizer || "", registration_url: it.registration_url || "",
      training_date: it.training_date ? it.training_date.slice(0,10) : "",
      training_time: it.training_time ? it.training_time.slice(0,5) : "",
      location_name: it.location_name || "",
      location_lat: it.location_lat ?? "", location_lng: it.location_lng ?? "",
      location_address: it.location_address || "",
    });
    setEditId(it.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast("Başlık zorunlu.", "error"); return; }
    if (!form.training_date) { showToast("Tarih zorunlu.", "error"); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        location_lat: form.location_lat === "" ? null : Number(form.location_lat),
        location_lng: form.location_lng === "" ? null : Number(form.location_lng),
      };
      if (editId) {
        const r = await api(`/admin/paid-events/${editId}`, { method:"PUT", body:JSON.stringify(body) });
        if (r) { setItems(prev => prev.map(i => i.id===editId ? { ...i, ...r } : i)); showToast("Güncellendi.", "success"); }
      } else {
        const r = await api("/admin/paid-events", { method:"POST", body:JSON.stringify(body) });
        if (r) { setItems(prev => [r, ...prev]); showToast("Oluşturuldu. Şimdi görsel yükleyebilirsiniz.", "success"); }
      }
      setShowForm(false); setEditId(null);
    } catch (e) {
      showToast(e.message || "Kaydedilemedi.", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (it) => {
    if (!window.confirm(`"${it.title}" silinecek. Emin misiniz?`)) return;
    await api(`/admin/paid-events/${it.id}`, { method:"DELETE" });
    setItems(prev => prev.filter(i => i.id !== it.id));
  };

  const lbl = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
  const inp = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-slate-900 text-xl" style={{letterSpacing:"-0.01em"}}>Ücretli Etkinlikler</h2>
          <p className="text-slate-400 text-sm mt-0.5">Yarış vb. ücretli etkinlikler. Normal etkinlik akışında ve haritada görünür; "Kayıt Ol" butonu dış kayıt linkini açar.</p>
        </div>
        <button onClick={startNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition hover:opacity-90 shadow-lg"
          style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
          <Plus className="w-4 h-4"/> Yeni Ücretli Etkinlik
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div>
            <label className={lbl}>Başlık *</label>
            <input className={inp} value={form.title} onChange={e=>set("title", e.target.value)} placeholder="Örn. İstanbul Bisiklet Yarışı 2026"/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Spor Dalı</label>
              <select className={inp} value={form.sport} onChange={e=>set("sport", e.target.value)}>
                <option value="">Seçiniz…</option>
                {SPORT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Organizatör</label>
              <input className={inp} value={form.organizer} onChange={e=>set("organizer", e.target.value)} placeholder="Örn. Muuvlink Spor Kulübü"/>
            </div>
          </div>
          <div>
            <label className={lbl}>Kayıt Linki (Kayıt Ol butonu buraya götürür)</label>
            <input className={inp} value={form.registration_url} onChange={e=>set("registration_url", e.target.value)} placeholder="https://..."/>
          </div>
          <div>
            <label className={lbl}>Açıklama</label>
            <textarea className={inp} rows={3} value={form.description} onChange={e=>set("description", e.target.value)} placeholder="Etkinlik detayları…"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Tarih *</label>
              <input type="date" className={inp} value={form.training_date} onChange={e=>set("training_date", e.target.value)}/>
            </div>
            <div>
              <label className={lbl}>Saat</label>
              <input type="time" className={inp} value={form.training_time} onChange={e=>set("training_time", e.target.value)}/>
            </div>
          </div>
          <div>
            <label className={lbl}>Konum (arama + haritadan seç)</label>
            <LocationPicker
              locationName={form.location_name}
              lat={form.location_lat === "" ? null : form.location_lat}
              lng={form.location_lng === "" ? null : form.location_lng}
              onLocationName={(v)=>set("location_name", v)}
              onLat={(v)=>set("location_lat", v)}
              onLng={(v)=>set("location_lng", v)}
              t={adminT} lang={adminLang} isNative={false}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>{setShowForm(false);setEditId(null);}} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">İptal</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition hover:opacity-90"
              style={{background:"linear-gradient(135deg,#00b7ba,#009295)"}}>
              {saving?"Kaydediliyor…":(editId?"Güncelle":"Oluştur")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.length === 0 && !showForm && (
          <div className="md:col-span-2 text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
            <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30"/>
            <p>Henüz ücretli etkinlik eklenmedi</p>
          </div>
        )}
        {items.map(it => (
          <div key={it.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col">
            <div className="h-36 relative bg-slate-100 overflow-hidden">
              {it.image_url
                ? <img src={it.image_url} alt="" className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-slate-300"><Upload className="w-6 h-6"/></div>}
              <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-semibold bg-brand-600 text-white flex items-center gap-1">
                <Ticket className="w-3 h-3"/> Ücretli
              </span>
              {it.sport && <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium bg-brand-100 text-brand-700">{it.sport}</span>}
            </div>
            <div className="p-4 flex flex-col gap-2 flex-1">
              <div className="font-semibold text-slate-800 leading-tight">{it.title}</div>
              <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                {it.organizer && <span>{it.organizer}</span>}
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{fmt(it.training_date)}{it.training_time?` · ${it.training_time.slice(0,5)}`:""}</span>
                {it.location_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{it.location_name}</span>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-50 text-brand-700">
                  <MousePointerClick className="w-3.5 h-3.5"/> {it.registration_clicks || 0} kayıt tıklaması
                </span>
                {it.registration_url && (
                  <a href={it.registration_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600 truncate">
                    <ExternalLink className="w-3 h-3 flex-shrink-0"/> <span className="truncate max-w-[140px]">{it.registration_url}</span>
                  </a>
                )}
              </div>
              <div className="mt-auto pt-2 flex flex-col gap-2">
                <ImageUploadBtn itemId={it.id} endpoint={`/admin/paid-events/${it.id}/image`} token={token}
                  currentUrl={it.image_url} onUploaded={r=>setItems(prev=>prev.map(i=>i.id===it.id?{...i,...r}:i))} onError={showToast}/>
                <div className="flex gap-2">
                  <button onClick={()=>startEdit(it)}
                    className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition text-slate-600 flex items-center justify-center gap-1">
                    <Edit2 className="w-3.5 h-3.5"/> Düzenle
                  </button>
                  <button onClick={()=>handleDelete(it)}
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition text-red-500">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Yarış Keşfi sekmesi ───────────────────────────────────
// İnternetten toplanan yarış adayları. Hiçbiri otomatik yayına girmez;
// onaylanan aday "Ücretli Etkinlik" olarak yayınlanır ve haritada görünür.
function DiscoveryTab({ api, showToast }) {
  const [filter, setFilter]   = React.useState("pending");
  const [items, setItems]     = React.useState([]);
  const [counts, setCounts]   = React.useState({});
  const [scan, setScan]       = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId]   = React.useState(null);
  const [editId, setEditId]   = React.useState(null);
  const [form, setForm]       = React.useState(null);
  const [queries, setQueries] = React.useState([]);
  const [selQ, setSelQ]       = React.useState([]);
  const [webOpen, setWebOpen] = React.useState(false);
  const [showSources, setShowSources] = React.useState(false);
  const [sources, setSources] = React.useState([]);
  const [newSrc, setNewSrc]   = React.useState({ name: "", url: "" });

  const filterRef = React.useRef(filter);
  filterRef.current = filter;
  const pollRef = React.useRef(null);

  const lbl = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
  const inp = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white";

  const load = React.useCallback(async (st) => {
    setLoading(true);
    try {
      const d = await api(`/admin/discovery/candidates?status=${st}`);
      if (d) { setItems(d.items || []); setCounts(d.counts || {}); }
    } catch (e) { showToast(e.message || "Adaylar alınamadı.", "error"); }
    finally { setLoading(false); }
  }, [api, showToast]);

  const poll = React.useCallback(async () => {
    try {
      const s = await api("/admin/discovery/status");
      if (!s) return;
      setScan(s);
      if (s.running) pollRef.current = setTimeout(poll, 2500);
      else load(filterRef.current);
    } catch { /* geçici hata — bir sonraki turda düzelir */ }
  }, [api, load]);

  React.useEffect(() => {
    load(filter);
    poll();
    api("/admin/discovery/queries").then(d => setQueries(d || [])).catch(() => {});
    return () => clearTimeout(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => { load(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const startScan = async (mode) => {
    if (mode === "web" && selQ.length === 0) { showToast("En az bir sorgu seçin.", "error"); return; }
    try {
      await api("/admin/discovery/scan", { method: "POST", body: JSON.stringify({ mode, queries: mode === "web" ? selQ : undefined }) });
      showToast(mode === "web" ? "Web araması başladı." : "Kaynak taraması başladı.", "success");
      clearTimeout(pollRef.current);
      poll();
    } catch (e) { showToast(e.message || "Tarama başlatılamadı.", "error"); }
  };

  const startEdit = (c) => {
    setForm({
      title: c.title || "", description: c.description || "", sport: c.sport || "",
      organizer: c.organizer || "", registration_url: c.registration_url || "",
      training_date: c.training_date ? c.training_date.slice(0, 10) : "",
      training_time: c.training_time ? c.training_time.slice(0, 5) : "",
      location_name: c.location_name || "",
      location_lat: c.location_lat ?? "", location_lng: c.location_lng ?? "",
      location_address: c.location_address || "",
    });
    setEditId(c.id);
  };

  const saveEdit = async () => {
    setBusyId(editId);
    try {
      const body = {
        ...form,
        location_lat: form.location_lat === "" ? null : Number(form.location_lat),
        location_lng: form.location_lng === "" ? null : Number(form.location_lng),
      };
      const r = await api(`/admin/discovery/candidates/${editId}`, { method: "PUT", body: JSON.stringify(body) });
      if (r) { setItems(prev => prev.map(i => i.id === editId ? r : i)); showToast("Aday güncellendi.", "success"); setEditId(null); }
    } catch (e) { showToast(e.message || "Güncellenemedi.", "error"); }
    finally { setBusyId(null); }
  };

  const approve = async (c) => {
    if (c.location_lat == null || c.location_lng == null) {
      if (!window.confirm(`"${c.title}" için koordinat yok — haritada görünmez. Yine de yayınlansın mı?`)) return;
    }
    setBusyId(c.id);
    try {
      const r = await api(`/admin/discovery/candidates/${c.id}/approve`, { method: "POST" });
      if (r) {
        setItems(prev => prev.filter(i => i.id !== c.id));
        setCounts(p => ({ ...p, pending: Math.max(0, (p.pending || 1) - 1), approved: (p.approved || 0) + 1 }));
        showToast("Yayınlandı — Ücretli Etkinlikler sekmesinde.", "success");
      }
    } catch (e) { showToast(e.message || "Yayınlanamadı.", "error"); }
    finally { setBusyId(null); }
  };

  const reject = async (c) => {
    setBusyId(c.id);
    try {
      await api(`/admin/discovery/candidates/${c.id}/reject`, { method: "POST" });
      setItems(prev => prev.filter(i => i.id !== c.id));
      setCounts(p => ({ ...p, pending: Math.max(0, (p.pending || 1) - 1), rejected: (p.rejected || 0) + 1 }));
    } catch (e) { showToast(e.message || "Reddedilemedi.", "error"); }
    finally { setBusyId(null); }
  };

  const restore = async (c) => {
    setBusyId(c.id);
    try {
      await api(`/admin/discovery/candidates/${c.id}/restore`, { method: "POST" });
      setItems(prev => prev.filter(i => i.id !== c.id));
      setCounts(p => ({ ...p, rejected: Math.max(0, (p.rejected || 1) - 1), pending: (p.pending || 0) + 1 }));
      showToast("Aday onay kuyruğuna geri alındı.", "success");
    } catch (e) { showToast(e.message || "Geri alınamadı.", "error"); }
    finally { setBusyId(null); }
  };

  const [bulkBusy, setBulkBusy] = React.useState(false);
  const bulk = async (action) => {
    const n = counts.rejected ?? items.length; // liste 500 ile sınırlı, işlem tüm kayıtlara gider
    const msg = action === "restore"
      ? `Reddedilen ${n} aday onay kuyruğuna geri alınacak. Devam edilsin mi?`
      : `Reddedilen ${n} aday kalıcı olarak silinecek.\n\nDikkat: silinen adaylar "bir daha gösterme" kaydını da kaybeder — bir sonraki taramada tekrar önerilebilirler. Sadece listeyi temizlemek istiyorsan reddedilmiş halde bırakman daha iyi.\n\nDevam edilsin mi?`;
    if (!window.confirm(msg)) return;
    setBulkBusy(true);
    try {
      const r = await api("/admin/discovery/candidates/bulk", {
        method: "POST", body: JSON.stringify({ action, status: "rejected" }),
      });
      showToast(action === "restore" ? `${r?.affected ?? 0} aday geri alındı.` : `${r?.affected ?? 0} aday silindi.`, "success");
      load(filter);
    } catch (e) { showToast(e.message || "İşlem başarısız.", "error"); }
    finally { setBulkBusy(false); }
  };

  const removeItem = async (c) => {
    if (!window.confirm(`"${c.title}" aday listesinden tamamen silinecek. Emin misiniz?`)) return;
    await api(`/admin/discovery/candidates/${c.id}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.id !== c.id));
  };

  const loadSources = async () => {
    const d = await api("/admin/discovery/sources");
    if (d) setSources(d);
  };
  const toggleSources = () => {
    const next = !showSources;
    setShowSources(next);
    if (next && sources.length === 0) loadSources();
  };
  const addSource = async () => {
    if (!/^https?:\/\//i.test(newSrc.url)) { showToast("http(s) ile başlayan bir adres girin.", "error"); return; }
    try {
      const r = await api("/admin/discovery/sources", { method: "POST", body: JSON.stringify(newSrc) });
      if (r) { setSources(p => [...p, r]); setNewSrc({ name: "", url: "" }); showToast("Kaynak eklendi.", "success"); }
    } catch (e) { showToast(e.message || "Kaynak eklenemedi.", "error"); }
  };
  const toggleSource = async (s) => {
    const r = await api(`/admin/discovery/sources/${s.id}`, { method: "PUT", body: JSON.stringify({ is_active: !s.is_active }) });
    if (r) setSources(p => p.map(x => x.id === s.id ? r : x));
  };
  const deleteSource = async (s) => {
    if (!window.confirm(`"${s.name || s.url}" kaynağı silinecek. Emin misiniz?`)) return;
    await api(`/admin/discovery/sources/${s.id}`, { method: "DELETE" });
    setSources(p => p.filter(x => x.id !== s.id));
  };

  const running = !!scan?.running;
  const pct = scan?.total ? Math.round((scan.done / scan.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-slate-900 text-xl" style={{ letterSpacing: "-0.01em" }}>Yarış Keşfi</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            İnternetteki yarış takvimleri taranır, bulunanlar onayınıza düşer. Onayladığınız yarış ücretli etkinlik olarak yayınlanır.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => startScan("sources")} disabled={running}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition hover:opacity-90 shadow-lg disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
            <ScanSearch className="w-4 h-4" /> Kaynakları Tara
          </button>
          <button onClick={() => setWebOpen(o => !o)} disabled={running}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition disabled:opacity-50">
            <Globe className="w-4 h-4" /> Web'de Ara
            <ChevronRight className={`w-3.5 h-3.5 text-slate-300 transition ${webOpen ? "rotate-90" : ""}`} />
          </button>
        </div>
      </div>

      {webOpen && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-700">Hangi sorgular çalışsın?</span>
            <span className="text-xs text-slate-400">Maliyet sorgu sayısıyla orantılı — sadece ihtiyacın olanı seç.</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setSelQ(queries.map(q => q.id))} className="text-xs text-brand-600 hover:underline">Tümü</button>
              <button onClick={() => setSelQ([])} className="text-xs text-slate-400 hover:underline">Temizle</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {queries.map(q => {
              const on = selQ.includes(q.id);
              return (
                <button key={q.id}
                  onClick={() => setSelQ(p => on ? p.filter(x => x !== q.id) : [...p, q.id])}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${on ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                  {q.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button onClick={() => startScan("web")} disabled={running || selQ.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
              Seçilenleri Tara ({selQ.length})
            </button>
            <span className="text-xs text-slate-400">
              Her sorgu 2-5 dakika sürer{scan?.model ? ` · model: ${scan.model}` : ""}
            </span>
          </div>
        </div>
      )}

      {scan?.configured === false && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Sunucuda <code className="font-mono">ANTHROPIC_API_KEY</code> tanımlı değil; tarama çalışmaz. Anahtarı <code className="font-mono">backend/.env</code> dosyasına ekleyip servisi yeniden başlatın.</span>
        </div>
      )}

      {(running || scan?.log?.length > 0) && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            {running
              ? <><Loader2 className="w-4 h-4 animate-spin text-brand-600" /> Tarama sürüyor…</>
              : <><CheckCircle2 className="w-4 h-4 text-brand-600" /> Son tarama tamamlandı</>}
            <span className="ml-auto text-xs font-normal text-slate-400">
              {scan?.done || 0}/{scan?.total || 0} kaynak · {scan?.found || 0} yarış okundu · {scan?.added || 0} yeni aday
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#00b7ba,#009295)" }} />
          </div>
          {running && scan?.current && <div className="text-xs text-slate-500 truncate">→ {scan.current}</div>}
          {scan?.log?.length > 0 && (
            <pre className="text-[11px] leading-relaxed text-slate-500 bg-slate-50 rounded-xl p-3 max-h-40 overflow-auto whitespace-pre-wrap">
              {scan.log.slice(-12).join("\n")}
            </pre>
          )}
          {scan?.error && <div className="text-xs text-red-500">{scan.error}</div>}
        </div>
      )}

      {/* Kaynaklar */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm">
        <button onClick={toggleSources} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700">
          <ListChecks className="w-4 h-4 text-slate-400" /> Taranan Kaynaklar
          <ChevronRight className={`w-4 h-4 ml-auto text-slate-300 transition ${showSources ? "rotate-90" : ""}`} />
        </button>
        {showSources && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
            {sources.map(s => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <button onClick={() => toggleSource(s)} className="flex-shrink-0">
                  {s.is_active ? <ToggleRight className="w-6 h-6 text-brand-600" /> : <ToggleLeft className="w-6 h-6 text-slate-300" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-700 truncate">{s.name || s.url}</div>
                  <div className="text-xs text-slate-400 truncate">{s.url}</div>
                  {s.last_scanned_at && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Son tarama: {fmtFull(s.last_scanned_at)} · {s.last_status} · {s.last_found} yeni
                    </div>
                  )}
                </div>
                <button onClick={() => deleteSource(s)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2 flex-wrap">
              <input className={inp + " flex-1 min-w-[140px]"} placeholder="Kaynak adı" value={newSrc.name}
                onChange={e => setNewSrc(s => ({ ...s, name: e.target.value }))} />
              <input className={inp + " flex-[2] min-w-[200px]"} placeholder="https://…" value={newSrc.url}
                onChange={e => setNewSrc(s => ({ ...s, url: e.target.value }))} />
              <button onClick={addSource} className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>Ekle</button>
            </div>
            <p className="text-xs text-slate-400">
              Sayfa metni indirilip ayrıştırılır; robots.txt engelliyorsa kaynak atlanır. İçeriği JavaScript ile yüklenen siteler okunamaz.
            </p>
          </div>
        )}
      </div>

      {/* Durum filtresi */}
      <div className="flex gap-2 flex-wrap">
        {[["pending", "Onay Bekleyen"], ["approved", "Yayınlanan"], ["rejected", "Reddedilen"]].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition border ${filter === k ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {label}{counts[k] ? ` (${counts[k]})` : ""}
          </button>
        ))}
        <button onClick={() => load(filter)} className="ml-auto p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-brand-600">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {filter === "rejected" && items.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
          <span className="text-sm text-slate-600 flex-1">Reddedilen {counts.rejected ?? items.length} aday</span>
          <button onClick={() => bulk("restore")} disabled={bulkBusy}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Tümünü Onay Bekleyene Al
          </button>
          <button onClick={() => bulk("delete")} disabled={bulkBusy}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Tümünü Sil
          </button>
        </div>
      )}

      {/* Adaylar */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
          <Radar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{filter === "pending" ? "Onay bekleyen aday yok — taramayı başlatın." : "Kayıt yok"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="font-semibold text-slate-800 leading-tight flex-1">{c.title}</div>
                {c.sport && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-brand-100 text-brand-700 flex-shrink-0">{c.sport}</span>}
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmt(c.training_date)}{c.training_time ? ` · ${c.training_time.slice(0, 5)}` : ""}</span>
                {(c.location_name || c.city) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location_name || c.city}</span>}
                {c.organizer && <span>{c.organizer}</span>}
              </div>
              {c.description && <p className="text-xs text-slate-500 line-clamp-2">{c.description}</p>}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className={`px-2 py-0.5 rounded-lg font-semibold ${c.confidence >= 0.8 ? "bg-emerald-50 text-emerald-700" : c.confidence >= 0.5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                  %{Math.round((c.confidence || 0) * 100)} güven
                </span>
                {(c.location_lat == null || c.location_lng == null) && (
                  <span className="px-2 py-0.5 rounded-lg font-semibold bg-red-50 text-red-600">konum yok</span>
                )}
                {c.source_url && (
                  <a href={c.source_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-brand-600 truncate">
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[220px]">{c.source_name || c.source_url}</span>
                  </a>
                )}
              </div>

              {editId === c.id && form && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 mt-1">
                  <div>
                    <label className={lbl}>Başlık</label>
                    <input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Spor Dalı</label>
                      <select className={inp} value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}>
                        <option value="">Seçiniz…</option>
                        {SPORT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Organizatör</label>
                      <input className={inp} value={form.organizer} onChange={e => setForm(f => ({ ...f, organizer: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Kayıt Linki</label>
                    <input className={inp} value={form.registration_url} onChange={e => setForm(f => ({ ...f, registration_url: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Açıklama</label>
                    <textarea className={inp} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Tarih</label>
                      <input type="date" className={inp} value={form.training_date} onChange={e => setForm(f => ({ ...f, training_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>Saat</label>
                      <input type="time" className={inp} value={form.training_time} onChange={e => setForm(f => ({ ...f, training_time: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Konum (arama + haritadan seç)</label>
                    <LocationPicker
                      locationName={form.location_name}
                      lat={form.location_lat === "" ? null : form.location_lat}
                      lng={form.location_lng === "" ? null : form.location_lng}
                      onLocationName={(v) => setForm(f => ({ ...f, location_name: v }))}
                      onLat={(v) => setForm(f => ({ ...f, location_lat: v }))}
                      onLng={(v) => setForm(f => ({ ...f, location_lng: v }))}
                      t={adminT} lang={adminLang} isNative={false}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">İptal</button>
                    <button onClick={saveEdit} disabled={busyId === c.id}
                      className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
                      {busyId === c.id ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                  </div>
                </div>
              )}

              {filter === "pending" && editId !== c.id && (
                <div className="flex gap-2 mt-auto pt-2">
                  <button onClick={() => approve(c)} disabled={busyId === c.id}
                    className="flex-1 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                    style={{ background: "linear-gradient(135deg,#00b7ba,#009295)" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Onayla ve Yayınla
                  </button>
                  <button onClick={() => startEdit(c)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1">
                    <Edit2 className="w-3.5 h-3.5" /> Düzenle
                  </button>
                  <button onClick={() => reject(c)} disabled={busyId === c.id}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Reddet
                  </button>
                </div>
              )}
              {filter !== "pending" && (
                <div className="flex gap-2 mt-auto pt-2">
                  <span className="text-xs text-slate-400 flex-1 self-center">
                    {c.status === "approved" ? "Yayınlandı" : "Reddedildi"}{c.reviewed_at ? ` · ${fmtFull(c.reviewed_at)}` : ""}
                  </span>
                  {c.status === "rejected" && (
                    <button onClick={() => restore(c)} disabled={busyId === c.id}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1 disabled:opacity-50">
                      <RefreshCw className="w-3.5 h-3.5" /> Geri Al
                    </button>
                  )}
                  <button onClick={() => removeItem(c)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Canlı sekmesi ─────────────────────────────────────────
// Sunucuda bellekte tutulan anlık trafiği gösterir (DB'ye hiçbir şey yazılmaz).
// Sayfa arka plana alınınca sorgu durur — boşuna istek atmasın.
function LiveTab({ api, showToast }) {
  const [data, setData] = React.useState(null);
  const [err, setErr]   = React.useState(null);
  const [paused, setPaused] = React.useState(false);
  const timerRef = React.useRef(null);
  const pausedRef = React.useRef(paused);
  pausedRef.current = paused;

  const tick = React.useCallback(async () => {
    if (document.visibilityState === "visible" && !pausedRef.current) {
      try { const d = await api("/admin/live"); if (d) { setData(d); setErr(null); } }
      catch (e) { setErr(e.message || "Canlı veri alınamadı."); }
    }
    timerRef.current = setTimeout(tick, 5000);
  }, [api]);

  React.useEffect(() => {
    tick();
    return () => clearTimeout(timerRef.current);
  }, [tick]);

  const hhmm = (t) => new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const hhmmss = (t) => new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const ago = (s) => s == null ? "—" : s < 60 ? `${s} sn önce` : `${Math.floor(s / 60)} dk önce`;

  const chartData = (data?.minutes || []).map(m => ({ ...m, label: hhmm(m.t) }));
  const peak = Math.max(1, ...chartData.map(m => m.requests));

  const cards = [
    { label: "Şu an içeride", value: data?.totals?.onlineUsers ?? "—", hint: "üye (son 5 dk)", icon: Users },
    { label: "Aktif ziyaretçi", value: data?.totals?.activeVisitors ?? "—", hint: "üye olmayan (son 5 dk)", icon: Globe },
    { label: "Son 5 dakika", value: data?.totals?.last5 ?? "—", hint: "istek", icon: Activity },
    { label: "Son 1 saat", value: data?.totals?.last60 ?? "—", hint: "istek", icon: TrendingUp },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-slate-900 text-xl flex items-center gap-2" style={{ letterSpacing: "-0.01em" }}>
            Canlı
            <span className="relative flex h-2.5 w-2.5">
              {!paused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${paused ? "bg-slate-300" : "bg-emerald-500"}`} />
            </span>
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Son bir saatin trafiği ve şu anki hareketler. Veriler sunucu belleğinde tutulur, veritabanına yazılmaz; servis yeniden başlarsa sıfırlanır.
          </p>
        </div>
        <button onClick={() => setPaused(p => !p)}
          className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition">
          {paused ? "Devam Et" : "Duraklat"}
        </button>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-2xl p-3 text-sm">{err}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
              <c.icon className="w-3.5 h-3.5" /> {c.label}
            </div>
            <div className="font-display font-bold text-slate-900 text-3xl leading-none">{c.value}</div>
            <div className="text-xs text-slate-400 mt-1">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 text-sm">Dakikalık istek trafiği — son 60 dakika</h3>
          <span className="text-xs text-slate-400">tepe: {peak} istek/dk</span>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="liveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00b7ba" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00b7ba" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={9} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                formatter={(v, n) => [v, n === "requests" ? "istek" : "tekil kişi"]}
                labelFormatter={(l) => `${l}`}
              />
              <Area type="monotone" dataKey="requests" stroke="#00b7ba" strokeWidth={2} fill="url(#liveFill)" />
              <Area type="monotone" dataKey="visitors" stroke="#981dd8" strokeWidth={1.5} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: "#00b7ba" }} /> istek/dk</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: "#981dd8" }} /> tekil kişi/dk</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Şu an içeride */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">
            Şu an içeride {data?.online?.length ? `(${data.online.length})` : ""}
          </h3>
          {!data?.online?.length ? (
            <p className="text-slate-400 text-sm py-8 text-center">Şu anda giriş yapmış aktif kullanıcı yok</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {data.online.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.connected ? "bg-emerald-500" : "bg-amber-400"}`}
                    title={u.connected ? "Uygulama açık" : "Son 5 dakikada aktifti"} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-700 truncate">{u.name}</div>
                    <div className="text-xs text-slate-400 truncate">{u.lastLabel || "geziniyor"}</div>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{ago(u.secondsAgo)}</span>
                </div>
              ))}
            </div>
          )}
          {data?.activeVisitors > 0 && (
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
              Ayrıca {data.activeVisitors} üye olmayan ziyaretçi geziniyor.
            </p>
          )}
        </div>

        {/* Canlı akış */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">Canlı akış</h3>
          {!data?.feed?.length ? (
            <p className="text-slate-400 text-sm py-8 text-center">Son bir saatte kayda değer hareket yok</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-auto">
              {data.feed.map((f, i) => (
                <div key={`${f.ts}-${i}`} className="flex items-start gap-2.5 py-1.5 text-sm">
                  <span className="text-[11px] text-slate-300 font-mono flex-shrink-0 pt-0.5">{hhmmss(f.ts)}</span>
                  <span className={`font-medium flex-shrink-0 ${f.isUser ? "text-brand-700" : "text-slate-400"}`}>{f.who}</span>
                  <span className="text-slate-500 min-w-0">{f.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
  // Mail'den gelen "Panelde Görüntüle" linki ?tab=messages ile doğrudan ilgili sekmeyi açar
  const [tab, setTab]           = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("tab") || "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const [stats, setStats]       = useState(null);
  const [users, setUsers]       = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [teams, setTeams]       = useState([]);
  const [messages, setMessages] = useState([]);
  const [banners, setBanners]   = useState([]);
  const [homeNews, setHomeNews] = useState([]);
  const [homeGallery, setHomeGallery] = useState([]);
  const [paidEvents, setPaidEvents] = useState([]);
  const [logs, setLogs]         = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [reports, setReports]   = useState([]);
  const [logFilter, setLogFilter] = useState("all");
  const [chartPeriod, setChartPeriod] = useState("daily");
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Banner form state
  const emptyBanner = { title:"", subtitle:"", badge_text:"", cta_primary_text:"Hemen Başla", cta_primary_text_en:"", cta_primary_text_de:"", cta_primary_url:"", cta_secondary_text:"Etkinlikleri Keşfet", cta_secondary_url:"", gradient_from:"#0D0B26", gradient_via:"#1a1040", gradient_to:"#0f2044", is_active:true, order_index:0, mottos:[""], motto_color_1:"#00b7ba", motto_color_2:"#981dd8", title_color:"#ffffff", subtitle_color:"rgba(186,230,253,0.75)" };
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...opts,
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
      });
      if (res.status === 401 || res.status === 403) { handleLogout(); return null; }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Sunucu hatası (${res.status})`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }, [token]);

  // ─── Veri yükleme ───────────────────────────────────────
  const loadReqRef = useRef(0);
  const loadTab = useCallback(async (t) => {
    const reqId = ++loadReqRef.current;
    setTab(t);
    setLoading(true);
    setSearch("");
    try {
      if (t === "dashboard") { const d = await api("/admin/stats"); if (reqId === loadReqRef.current) setStats(d); }
      else if (t === "users") { const d = await api("/admin/users"); if (reqId === loadReqRef.current) setUsers(d || []); }
      else if (t === "trainings") { const d = await api("/admin/trainings"); if (reqId === loadReqRef.current) setTrainings(d || []); }
      else if (t === "teams") { const d = await api("/admin/teams"); if (reqId === loadReqRef.current) setTeams(d || []); }
      else if (t === "messages") { const d = await api("/admin/contact"); if (reqId === loadReqRef.current) setMessages(d || []); }
      else if (t === "banners") { const d = await api("/admin/banners"); if (reqId === loadReqRef.current) setBanners(d || []); }
      else if (t === "home-news") { const d = await api("/admin/home-news"); if (reqId === loadReqRef.current) setHomeNews(d || []); }
      else if (t === "home-gallery") { const d = await api("/admin/home-gallery"); if (reqId === loadReqRef.current) setHomeGallery(d || []); }
      else if (t === "paid-events") { const d = await api("/admin/paid-events"); if (reqId === loadReqRef.current) setPaidEvents(d || []); }
      else if (t === "reports") { const d = await api("/admin/flags"); if (reqId === loadReqRef.current) setReports(d || []); }
      else if (t === "logs") {
        const [logsData, analyticsData] = await Promise.all([api("/admin/logs"), api("/admin/analytics")]);
        if (reqId === loadReqRef.current) { setLogs(logsData || []); setAnalytics(analyticsData || null); }
      }
    } catch (err) { console.error('[loadTab] hata:', t, err); }
    finally { if (reqId === loadReqRef.current) setLoading(false); }
  }, [api]);

  useEffect(() => { if (token) loadTab("dashboard"); }, [token]);

  // ─── Silme / işlemler ───────────────────────────────────
  const del = async (path, label, reload) => {
    if (!window.confirm(`"${label}" silinecek. Emin misiniz?`)) return;
    await api(path, { method: "DELETE" });
    loadTab(reload);
  };

  // Kullanıcıya admin yetkisi ver / al (sadece panelden yönetilir)
  const toggleAdmin = async (u) => {
    const makeAdmin = !u.is_admin;
    if (!window.confirm(`"${u.name}" ${makeAdmin ? "ADMIN yapılacak" : "adminlikten çıkarılacak"}. Emin misiniz?`)) return;
    try {
      const r = await api(`/admin/users/${u.id}/toggle-admin`, { method: "PUT" });
      if (r) {
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_admin: r.is_admin } : x));
        showToast(r.is_admin ? "Admin yapıldı." : "Admin yetkisi kaldırıldı.", "success");
      }
    } catch (e) {
      showToast(e.message || "İşlem başarısız.", "error");
    }
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
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src="/icons/favicon.png" alt="" className="h-10 w-auto"/>
              <img src="/icons/logo-yatay.svg" alt="Muuvlink" className="h-8 w-auto"/>
            </div>
            <h1 className="font-display font-bold text-slate-800 tracking-tight" style={{fontSize:"clamp(1.75rem,4vw,2.25rem)", letterSpacing:"-0.02em"}}>Admin Panel</h1>
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
    { id: "live",      label: "Canlı",       icon: Activity },
    { id: "users",     label: "Kullanıcılar", icon: Users },
    { id: "trainings", label: "Etkinlikler", icon: Activity },
    { id: "paid-events", label: "Ücretli Etkinlikler", icon: Ticket },
    { id: "discovery",   label: "Yarış Keşfi",       icon: Radar },
    { id: "teams",     label: "Takımlar",     icon: Shield },
    { id: "logs",      label: "Loglar",       icon: Activity },
    { id: "messages",  label: "Mesajlar",     icon: MessageSquare,
      badge: stats?.unreadContact > 0 ? stats.unreadContact : null },
    { id: "banners",      label: "Bannerlar",    icon: Image },
    { id: "home-news",    label: "Haberler",     icon: Newspaper },
    { id: "home-gallery", label: "Galeri",       icon: GalleryHorizontal },
    { id: "reports",      label: "Şikayetler",   icon: Flag,
      badge: reports.filter(r => !r.resolved).length || null },
  ];

  // ─── Banner helpers ──────────────────────────────────────
  const startEditBanner = (b) => {
    setBannerForm({
      title: b.title || "",
      subtitle: b.subtitle || "",
      badge_text: b.badge_text || "",
      cta_primary_text: b.cta_primary_text || "Hemen Başla",
      cta_primary_text_en: b.cta_primary_text_en || "",
      cta_primary_text_de: b.cta_primary_text_de || "",
      cta_primary_url: b.cta_primary_url || "",
      cta_secondary_text: b.cta_secondary_text || "Etkinlikleri Keşfet",
      cta_secondary_url: b.cta_secondary_url || "",
      gradient_from: b.gradient_from || "#0D0B26",
      gradient_via: b.gradient_via || "#1a1040",
      gradient_to: b.gradient_to || "#0f2044",
      is_active: b.is_active !== false,
      order_index: b.order_index || 0,
      mottos: (Array.isArray(b.mottos) && b.mottos.length > 0) ? b.mottos : [""],
      motto_color_1: b.motto_color_1 || "#00b7ba",
      motto_color_2: b.motto_color_2 || "#981dd8",
      title_color: b.title_color || "#ffffff",
      subtitle_color: b.subtitle_color || "rgba(186,230,253,0.75)",
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
        motto_color_1: b.motto_color_1 || "#00b7ba",
        motto_color_2: b.motto_color_2 || "#981dd8",
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
    user_register:    { icon: User,          label: "Üye Oldu",              color: "bg-blue-100 text-blue-700"   },
    team_create:      { icon: Trophy,        label: "Takım Kurdu",           color: "bg-purple-100 text-purple-700" },
    team_join:        { icon: Users,         label: "Takıma Katıldı",        color: "bg-indigo-100 text-indigo-700" },
    training_create:  { icon: ClipboardList, label: "Etkinlik Oluşturdu",   color: "bg-brand-100 text-brand-700"  },
    training_join:    { icon: CheckCircle2,  label: "Etkinliğe Katıldı",    color: "bg-brand-100 text-brand-700" },
    training_leave:   { icon: DoorOpen,      label: "Etkinlik Ayrıldı",     color: "bg-orange-100 text-orange-700" },
  };

  const LOG_FILTERS = [
    { id: "all",            label: "Tümü" },
    { id: "user_register",  label: "Üye Kayıt" },
    { id: "team_create",    label: "Takım" },
    { id: "team_join",      label: "Takım Katıl" },
    { id: "training_create",label: "Etkinlik" },
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
              { label: "Yeni Üye",        key: "users",     grad: "from-blue-500 to-blue-700",     icon: User          },
              { label: "Takım Kuruldu",   key: "teams",     grad: "from-purple-500 to-purple-700",  icon: Trophy        },
              { label: "Takıma Katılım",  key: "teamJoins", grad: "from-indigo-500 to-indigo-700",  icon: Users         },
              { label: "Yeni Etkinlik",  key: "trainings", grad: "from-brand-500 to-brand-700",    icon: ClipboardList },
              { label: "Etkinliğe Kat.", key: "joins",     grad: "from-amber-500 to-orange-500",   icon: CheckCircle2  },
            ].map(({ label, key, grad, icon }) => (
              <div key={key} className={`bg-gradient-to-br ${grad} rounded-2xl p-5 text-white shadow-lg`}>
                <div className="flex items-center justify-between mb-3">
                  {React.createElement(icon, { className: "w-6 h-6 opacity-90" })}
                  <span className="text-xs opacity-75 font-medium bg-white/20 px-2 py-0.5 rounded-lg">bugün</span>
                </div>
                <div className="font-display font-bold mb-0.5" style={{fontSize:"2rem", letterSpacing:"-0.02em"}}>{analytics.totals.today[key] ?? 0}</div>
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
            <h2 className="font-display font-bold text-slate-900 text-lg" style={{letterSpacing:"-0.01em"}}>Büyüme Grafiği</h2>
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
                <Area type="monotone" dataKey="trainings" name="Etkinlik"      stroke={seriesStroke("trainings", "#00b7ba")} fill="url(#gTrainings)" strokeWidth={seriesWidth("trainings")} dot={false} fillOpacity={seriesFill("trainings")} />
                <Area type="monotone" dataKey="joins"     name="Etkinliğe Kat." stroke={seriesStroke("joins",    "#F59E0B")} fill="url(#gJoins)"     strokeWidth={seriesWidth("joins")}     dot={false} fillOpacity={seriesFill("joins")} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Activity Feed ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-display font-bold text-slate-900 text-lg" style={{letterSpacing:"-0.01em"}}>Aktivite Akışı
              <span className="ml-2 text-slate-400 font-normal text-sm" style={{fontFamily:"'Montserrat',sans-serif"}}>({filteredLogs.length})</span>
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
              const cfg = EVENT_CONFIG[log.event_type] || { icon: Activity, label: log.event_type, color: "bg-slate-100 text-slate-600" };
              const meta = log.meta || {};
              // Etkinlik başlığı önce gelir: bireysel etkinliklerde team_name hep
              // "Bireysel" olduğu için, farklı etkinlikler listede aynı görünüyordu.
              const detail = meta.training_title
                ? (meta.team_name ? `${meta.training_title} · ${meta.team_name}` : meta.training_title)
                : (meta.team_name || meta.email || "");
              const CfgIcon = cfg.icon;
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3.5">
                  <span className={`flex-shrink-0 mt-0.5 p-1.5 rounded-lg ${cfg.color}`}><CfgIcon className="w-3.5 h-3.5"/></span>
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
                  const cfg = EVENT_CONFIG[log.event_type] || { icon: Activity, label: log.event_type, color: "bg-slate-100 text-slate-600" };
                  const meta = log.meta || {};
                  // Etkinlik başlığı önce gelir: bireysel etkinliklerde team_name hep
              // "Bireysel" olduğu için, farklı etkinlikler listede aynı görünüyordu.
              const detail = meta.training_title
                ? (meta.team_name ? `${meta.training_title} · ${meta.team_name}` : meta.training_title)
                : (meta.team_name || meta.email || "");
                  const CfgIconTbl = cfg.icon;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{relativeTime(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.color}`}>
                          <CfgIconTbl className="w-3.5 h-3.5"/> {cfg.label}
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
    { label: "Toplam Etkinlik",   value: stats.trainings,        icon: Activity,     grad: "from-brand-400 to-brand-600" },
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
          <img src="/icons/favicon.png" alt="Muuvlink" className="h-8 w-auto flex-shrink-0" />
          <div className="flex-1">
            <div className="font-display font-bold text-slate-800 text-base tracking-tight" style={{letterSpacing:"-0.01em"}}>Muuvlink</div>
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
            <h1 className="font-display font-bold text-slate-900 truncate" style={{fontSize:"clamp(1rem,2.5vw,1.2rem)", letterSpacing:"-0.01em"}}>
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
                    <div className="font-display font-bold mb-1" style={{fontSize:"2.5rem", letterSpacing:"-0.02em"}}>{s.value ?? "—"}</div>
                    <div className="text-sm opacity-75 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Son kayıtlar */}
              {stats?.recentUsers?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-50">
                    <h2 className="font-medium text-slate-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand-400"/>Son Kayıt Olan Kullanıcılar</h2>
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
                        <span>{u.training_count ?? 0} etkinlik</span>
                        <span>·</span>
                        <span>{fmt(u.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <button onClick={() => toggleAdmin(u)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${u.is_admin ? "border-purple-200 text-purple-700 hover:bg-purple-50" : "border-brand-200 text-brand-700 hover:bg-brand-50"}`}>
                        {u.is_admin ? "Admin kaldır" : "Admin yap"}
                      </button>
                      {!u.is_admin && (
                        <button onClick={() => del(`/admin/users/${u.id}`, u.name, "users")}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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
                      <th className="text-center px-4 py-3">Etkinlik</th>
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
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => toggleAdmin(u)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${u.is_admin ? "border-purple-200 text-purple-700 hover:bg-purple-50" : "border-brand-200 text-brand-700 hover:bg-brand-50"}`}>
                              {u.is_admin ? "Admin kaldır" : "Admin yap"}
                            </button>
                            {!u.is_admin && (
                              <button onClick={() => del(`/admin/users/${u.id}`, u.name, "users")}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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
                <h2 className="font-medium text-slate-900">Etkinlikler <span className="text-slate-400 font-normal text-sm">({filteredTrainings.length})</span></h2>
              </div>

              {/* Mobil kart listesi */}
              <div className="sm:hidden divide-y divide-slate-50">
                {filteredTrainings.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">Etkinlik bulunamadı</div>
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
                  <div className="text-center py-16 text-slate-400">Etkinlik bulunamadı</div>
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
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-slate-500">Başlık <span className="text-slate-400 font-normal">(sabit satır)</span></label>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400">Renk</span>
                            <label className="relative cursor-pointer">
                              <span className="block w-5 h-5 rounded border border-slate-200 shadow-sm" style={{background: bannerForm.title_color || "#ffffff"}}/>
                              <input type="color" value={bannerForm.title_color || "#ffffff"}
                                onChange={e=>setBannerForm(p=>({...p,title_color:e.target.value}))}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                            </label>
                            <span className="text-[11px] font-mono text-slate-500">{bannerForm.title_color || "#ffffff"}</span>
                          </div>
                        </div>
                        <input value={bannerForm.title} onChange={e=>setBannerForm(p=>({...p,title:e.target.value}))}
                          placeholder="Sporla Buluş,"
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Rozet Metni</label>
                        <input value={bannerForm.badge_text} onChange={e=>setBannerForm(p=>({...p,badge_text:e.target.value}))}
                          placeholder="500+ Aktif Sporcu"
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-slate-500">Alt Metin</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400">Renk</span>
                          <label className="relative cursor-pointer">
                            <span className="block w-5 h-5 rounded border border-slate-200 shadow-sm" style={{background: bannerForm.subtitle_color || "rgba(186,230,253,0.75)"}}/>
                            <input type="color" value={(() => { const s = bannerForm.subtitle_color || "rgba(186,230,253,0.75)"; if(s.startsWith("#")) return s; const m=s.match(/[\d.]+/g); return m ? "#"+[m[0],m[1],m[2]].map(n=>Math.round(+n).toString(16).padStart(2,"0")).join("") : "#bae6fd"; })()}
                              onChange={e=>setBannerForm(p=>({...p,subtitle_color:e.target.value}))}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                          </label>
                          <span className="text-[11px] font-mono text-slate-500">{bannerForm.subtitle_color || "rgba(186,230,253,0.75)"}</span>
                        </div>
                      </div>
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
                            <label className="block text-[11px] text-slate-400 mb-1">Buton Metni 🇹🇷</label>
                            <input value={bannerForm.cta_primary_text} onChange={e=>setBannerForm(p=>({...p,cta_primary_text:e.target.value}))}
                              placeholder="Etkinlikleri Keşfet"
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Link / URL</label>
                            <input value={bannerForm.cta_primary_url} onChange={e=>setBannerForm(p=>({...p,cta_primary_url:e.target.value}))}
                              placeholder="/etkinlikler veya https://..."
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Buton Metni 🇬🇧</label>
                            <input value={bannerForm.cta_primary_text_en} onChange={e=>setBannerForm(p=>({...p,cta_primary_text_en:e.target.value}))}
                              placeholder="Explore Trainings"
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"/>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Buton Metni 🇩🇪</label>
                            <input value={bannerForm.cta_primary_text_de} onChange={e=>setBannerForm(p=>({...p,cta_primary_text_de:e.target.value}))}
                              placeholder="Trainings entdecken"
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
                              placeholder="Etkinlikleri Keşfet"
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

                    {/* Motto gradyan renkleri */}
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">
                        Motto Gradyan Renkleri
                        <span className="ml-2 text-slate-400 font-normal normal-case">(yazı rengi geçişi)</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 border border-slate-200 rounded-xl px-3 py-2">
                          <input type="color" value={bannerForm.motto_color_1 || "#00b7ba"}
                            onChange={e => setBannerForm(p => ({ ...p, motto_color_1: e.target.value }))}
                            className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0"
                          />
                          <span className="text-xs text-slate-500 font-mono">{bannerForm.motto_color_1 || "#00b7ba"}</span>
                          <span className="text-xs text-slate-400 ml-auto">Başlangıç</span>
                        </div>
                        <div className="flex items-center justify-center w-6 flex-shrink-0">
                          <div className="h-0.5 w-4 rounded" style={{background:`linear-gradient(90deg,${bannerForm.motto_color_1||"#00b7ba"},${bannerForm.motto_color_2||"#981dd8"})`}}/>
                        </div>
                        <div className="flex items-center gap-2 flex-1 border border-slate-200 rounded-xl px-3 py-2">
                          <input type="color" value={bannerForm.motto_color_2 || "#981dd8"}
                            onChange={e => setBannerForm(p => ({ ...p, motto_color_2: e.target.value }))}
                            className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0"
                          />
                          <span className="text-xs text-slate-500 font-mono">{bannerForm.motto_color_2 || "#981dd8"}</span>
                          <span className="text-xs text-slate-400 ml-auto">Bitiş</span>
                        </div>
                      </div>
                      {/* Önizleme */}
                      <div className="mt-2 text-center text-base font-semibold" style={{
                        background:`linear-gradient(90deg,${bannerForm.motto_color_1||"#00b7ba"},${bannerForm.motto_color_2||"#981dd8"})`,
                        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text"
                      }}>
                        {(bannerForm.mottos?.[0]) || "Motto önizlemesi"}
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

          {/* ── PAID EVENTS ──────────────────────────────── */}
          {!loading && tab === "paid-events" && (
            <PaidEventsTab
              items={paidEvents} setItems={setPaidEvents} api={api} token={token} showToast={showToast}
            />
          )}

          {/* ── LIVE ────────────────────────────────────── */}
          {!loading && tab === "live" && <LiveTab api={api} showToast={showToast} />}

          {/* ── DISCOVERY ────────────────────────────────── */}
          {!loading && tab === "discovery" && (
            <DiscoveryTab api={api} showToast={showToast} />
          )}

          {/* ── LOGS ─────────────────────────────────────── */}
          {!loading && tab === "logs" && <LogsPage />}

          {/* ── REPORTS ──────────────────────────────────── */}
          {!loading && tab === "reports" && (
            <div className="space-y-3">
              {reports.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400">
                  <Flag className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                  <p className="font-semibold">Henüz şikayet yok</p>
                </div>
              )}
              {reports.map(r => (
                <div key={r.id} className={`bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4 ${r.resolved ? "opacity-50" : "border-red-100"}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${r.resolved ? "bg-slate-100" : "bg-red-50"}`}>
                    <Flag className={`w-5 h-5 ${r.resolved ? "text-slate-400" : "text-red-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{r.reporter_name}</span>
                      <span className="text-xs text-slate-400">{r.reporter_email}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.content_type === "training" ? "bg-blue-100 text-blue-600" :
                        r.content_type === "comment"  ? "bg-purple-100 text-purple-600" :
                        r.content_type === "wall_post"? "bg-orange-100 text-orange-600" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {{ training: "Etkinlik", comment: "Yorum", wall_post: "Duvar Gönderisi", user: "Kullanıcı" }[r.content_type] || r.content_type} #{r.content_id}
                      </span>
                    </div>
                    {r.content_preview && (
                      <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 mt-1 mb-1 border border-slate-100 italic">
                        "{r.content_preview}"
                      </p>
                    )}
                    {!r.content_preview && (
                      <p className="text-xs text-slate-400 italic mt-1">İçerik silinmiş veya bulunamadı</p>
                    )}
                    <p className="text-sm text-slate-600">Neden: <strong>{{ inappropriate: "Uygunsuz içerik", spam: "Spam/reklam", harassment: "Taciz/zorbalık", fake: "Sahte profil", other: "Diğer" }[r.reason] || r.reason}</strong></p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleString("tr-TR")}</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {!r.resolved && (
                      <>
                        <button
                          onClick={async () => {
                            if (!window.confirm("Bu içeriği gizlemek istiyor musunuz? İstersen geri alabilirsin.")) return;
                            await api(`/admin/flags/${r.id}/content`, { method: "DELETE" });
                            setReports(prev => prev.map(x => x.id === r.id ? { ...x, resolved: true, content_deleted: true } : x));
                            showToast("İçerik gizlendi.", "success");
                          }}
                          className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 font-semibold transition-colors whitespace-nowrap"
                        >
                          İçeriği Gizle
                        </button>
                        <button
                          onClick={async () => {
                            await api(`/admin/flags/${r.id}/resolve`, { method: "PUT" });
                            setReports(prev => prev.map(x => x.id === r.id ? { ...x, resolved: true } : x));
                          }}
                          className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 font-semibold transition-colors whitespace-nowrap"
                        >
                          Çözüldü
                        </button>
                      </>
                    )}
                    {r.resolved && r.content_deleted && (
                      <button
                        onClick={async () => {
                          await api(`/admin/flags/${r.id}/restore`, { method: "POST" });
                          setReports(prev => prev.map(x => x.id === r.id ? { ...x, resolved: false, content_deleted: false } : x));
                          showToast("İçerik geri getirildi.", "success");
                        }}
                        className="text-xs px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 font-semibold transition-colors whitespace-nowrap"
                      >
                        Geri Al
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
