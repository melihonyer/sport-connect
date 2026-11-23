// Sürükle-bırak dosya yükleme (23 Kasım 2026, Melih: "bu alanı sürükle bırak olarak revize eder misin? başka varsa
// o alanları da"). Site ve admin ortak kullanır. Tıklayınca yine dosya seçici açılır; dokunmatikte sürükleme olmadığı
// için yalnız tıklama kalır. Tür/boyut denetimi çağıranda (sunucu da reddeder), burada yalnız dosya alınır.
import React from "react";

// Bir öğeyi bırakma hedefi yapar. Çocuk öğeler üstünden geçerken dragleave yanıp sönmesin diye sayaçla tutulur.
export function useFileDrop(onFile, { disabled = false } = {}) {
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
  const bind = {
    onDragEnter: (e) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (e) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e) => {
      if (disabled || !hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (e) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
  };
  return { dragging, bind };
}

// İmleçli cihaz mı? Dokunmatikte "buraya sürükle" yazmak yanıltıcı.
const canHover = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

// Büyük kesik çizgili alan: ikon + başlık + alt satır + ipucu. Sürüklerken Deep Teal çerçeve ve "bırak" yazısı.
export function DropZone({ onFile, accept, disabled, busy, icon: Icon, title, touchTitle, orText, hint, dropText, className = "" }) {
  const inputRef = React.useRef(null);
  const { dragging, bind } = useFileDrop(onFile, { disabled: disabled || busy });
  const hover = canHover();
  return (
    <div {...bind}>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <button type="button" disabled={disabled || busy} onClick={() => inputRef.current?.click()} data-hover="own"
        className={`w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors disabled:opacity-60 ${
          dragging ? "border-brand-600 bg-brand-50" : "border-slate-300 hover:border-brand-400 hover:bg-brand-50/50"} ${className}`}>
        {busy
          ? <span className="w-8 h-8 border-[3px] border-brand-200 border-t-brand-600 rounded-full animate-spin" aria-hidden="true" />
          : Icon && <Icon className={`w-8 h-8 ${dragging ? "text-brand-600" : "text-logo-teal"}`} aria-hidden="true" />}
        <span className="text-base font-semibold text-brand-900">{dragging ? dropText : (hover ? title : (touchTitle || title))}</span>
        {hover && !dragging && orText && <span className="text-sm text-slate-500">{orText}</span>}
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </button>
    </div>
  );
}
