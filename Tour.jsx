// Tanıtım turu (coach-mark / spotlight onboarding).
// Ekranı karartır, hedef öğenin üstünde "delik" açar ve yanında açıklama baloncuğu gösterir.
// Işıklı alan GERÇEKTEN tıklanabilir: karartma 4 ayrı bloklayıcı div ile yapılır,
// deliğin olduğu yer boş bırakılır → tıklama alttaki gerçek butona geçer.
import React, { useState, useEffect, useCallback, useRef } from "react";

const PAD = 8;         // spotlight'ın hedefin etrafında bıraktığı boşluk
const RADIUS = 14;     // delik köşe yuvarlaklığı
const MASK = "rgba(15,23,42,0.65)";
const BUBBLE_W = 290;
const GAP = 14;        // delik ile baloncuk arası

const findTarget = (key) => (key ? document.querySelector(`[data-tour="${key}"]`) : null);

const Tour = ({ steps, onFinish, t }) => {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const finishedRef = useRef(false);

  const step = steps[idx];
  const total = steps.length;

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish?.();
  }, [onFinish]);

  const goNext = useCallback(() => {
    setReady(false);
    setRect(null);
    if (idx + 1 >= total) finish();
    else setIdx(i => i + 1);
  }, [idx, total, finish]);

  // Adım hazırlığı: varsa before() ile sayfayı değiştir, sonra hedefi bekle.
  // Hedef bulunamazsa (öğe yok/gizli) adım sessizce atlanır — tur kırılmaz.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let tries = 0;

    const measure = (el) => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setReady(true);
    };

    const attempt = () => {
      if (cancelled) return;
      const el = findTarget(step.target);
      if (el && el.getBoundingClientRect().width > 0) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        // scroll oturduktan sonra ölç
        setTimeout(() => { if (!cancelled) measure(el); }, 320);
        return;
      }
      if (++tries > 25) { if (!cancelled) goNext(); return; }  // ~2.5sn sonra atla
      setTimeout(attempt, 100);
    };

    try { step.before?.(); } catch { /* yoksay */ }
    setTimeout(attempt, step.before ? 260 : 60);
    return () => { cancelled = true; };
  }, [idx]); // eslint-disable-line

  // Ölçüyü tazele (döndürme, yeniden boyutlandırma, kaydırma)
  useEffect(() => {
    if (!ready) return;
    const update = () => {
      const el = findTarget(step?.target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [ready, step?.target]);

  // ESC ile çık
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  if (!step || !ready || !rect) return null;

  const hole = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
  const vw = window.innerWidth, vh = window.innerHeight;

  // Baloncuk yerleşimi. Hedef ekrandan uzunsa (ör. tüm takım listesi) delik
  // yukarı/aşağı taşar; bu durumda baloncuğu deliğin dışına değil, GÖRÜNEN
  // alanın içine koyarız — yoksa ekranın üstünden taşıp kırpılıyordu.
  const BUBBLE_H = 190;
  const spaceBelow = vh - (hole.top + hole.height);
  const spaceAbove = hole.top;
  let bubbleTop;
  if (spaceBelow >= BUBBLE_H + GAP) {
    bubbleTop = hole.top + hole.height + GAP;             // altta yer var
  } else if (spaceAbove >= BUBBLE_H + GAP) {
    bubbleTop = hole.top - GAP - BUBBLE_H;                // üstte yer var
  } else {
    // Hiçbir yanda yer yok (hedef ekrandan uzun) → görünen alanın üst kısmına,
    // deliğin başladığı yerin hemen altına yerleştir.
    bubbleTop = Math.max(12, Math.min(hole.top + GAP, vh - BUBBLE_H - 12));
  }
  bubbleTop = Math.max(12, Math.min(bubbleTop, vh - BUBBLE_H - 12)); // her hâlükârda ekran içi
  const bubbleLeft = Math.min(
    Math.max(12, hole.left + hole.width / 2 - BUBBLE_W / 2),
    vw - BUBBLE_W - 12
  );

  const blocker = { position: "fixed", background: MASK, zIndex: 9998 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none" }}>
      {/* Karartma — 4 parça; delik boş kalır, oraya tıklama geçer */}
      <div style={{ ...blocker, top: 0, left: 0, right: 0, height: Math.max(0, hole.top), pointerEvents: "auto" }} />
      <div style={{ ...blocker, top: hole.top + hole.height, left: 0, right: 0, bottom: 0, pointerEvents: "auto" }} />
      <div style={{ ...blocker, top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, pointerEvents: "auto" }} />
      <div style={{ ...blocker, top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, pointerEvents: "auto" }} />

      {/* Spotlight halkası (tıklamayı engellemez) */}
      <div style={{
        position: "fixed", top: hole.top, left: hole.left, width: hole.width, height: hole.height,
        borderRadius: RADIUS, boxShadow: "0 0 0 3px rgba(255,255,255,0.9), 0 0 22px 6px rgba(0,183,186,0.45)",
        zIndex: 9999, pointerEvents: "none", transition: "all .25s ease",
      }} />

      {/* Açıklama baloncuğu */}
      <div style={{
        position: "fixed", top: bubbleTop, left: bubbleLeft, width: BUBBLE_W,
        background: "#fff", borderRadius: 16, padding: "16px 16px 12px",
        boxShadow: "0 18px 50px rgba(0,0,0,.28)", zIndex: 10000, pointerEvents: "auto",
        fontFamily: "'Montserrat',system-ui,sans-serif",
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 6, lineHeight: 1.3 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, marginBottom: 14 }}>
          {step.text}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* İlerleme noktaları */}
          <div style={{ display: "flex", gap: 5, flex: "1 1 auto" }}>
            {steps.map((_, i) => (
              <span key={i} style={{
                width: i === idx ? 16 : 6, height: 6, borderRadius: 99,
                background: i === idx ? "#00b7ba" : "#cbd5e1", transition: "all .2s",
              }} />
            ))}
          </div>
          <button onClick={finish} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12.5, fontWeight: 600, color: "#94a3b8", padding: "6px 4px",
          }}>
            {t ? t("tour.skip") : "Atla"}
          </button>
          <button onClick={goNext} style={{
            background: "linear-gradient(135deg,#00b7ba,#009295)", border: "none", cursor: "pointer",
            color: "#fff", fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: 10,
          }}>
            {idx + 1 >= total ? (t ? t("tour.finish") : "Bitir") : (t ? t("tour.next") : "İleri")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tour;
