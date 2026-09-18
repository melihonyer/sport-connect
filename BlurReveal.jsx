import React, { useEffect, useRef, useState } from "react";

/**
 * Harf harf bulanıklıktan çıkan metin.
 *
 * Animasyon `motion` kütüphanesiyle değil, CSS keyframe'leriyle sürülür
 * (`blurRevealIn` / `blurRevealOut`, index.css). Sebep: efekt tek bir
 * keyframe çiftine sığıyor, kütüphane ~35 kB gzip ekliyordu ve bu paket
 * Capacitor ile telefona da iniyor.
 *
 * Props, kaynak bileşenle aynı: children (string), delay, speedReveal,
 * speedSegment, trigger, as, inView, once, letterSpacing, className, style,
 * onAnimationStart, onAnimationComplete. İki callback de hangi evrenin
 * bittiğini ("in" | "out") argüman olarak alır.
 *
 * Ek olarak `gradient={[renk1, renk2]}`: her harfe, dizideki sırasına göre
 * iki renk arasından karışmış DÜZ bir renk verir. Tek bir
 * `-webkit-background-clip:text` yüzeyi kullanmıyoruz; harflere filter
 * uygulandığı anda o yüzey Android WebView'de bozuluyor.
 */

const _rgb = (hex) => {
  const h = (hex || "#000000").replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ];
};
const _mix = (c1, c2, t) => {
  const [r1, g1, b1] = _rgb(c1), [r2, g2, b2] = _rgb(c2);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
};

export function BlurReveal({
  children,
  className,
  delay = 0,
  speedReveal = 1.5,
  speedSegment = 0.5,
  trigger = true,
  onAnimationComplete,
  onAnimationStart,
  as = "p",
  style,
  inView = false,
  once = true,
  letterSpacing,
  gradient,
}) {
  const Tag = as;
  const hostRef = useRef(null);

  const stagger      = 0.03 / speedReveal;
  const baseDuration = 0.3  / speedSegment;

  const text  = typeof children === "string" ? children : String(children ?? "");
  const words = text.split(" ");
  const total = Math.max(1, text.length);

  // inView: görünür olana kadar bekle
  const [seen, setSeen] = useState(!inView);
  useEffect(() => {
    if (!inView) { setSeen(true); return; }
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { setSeen(true); if (once) io.disconnect(); }
        else if (!once) setSeen(false);
      });
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [inView, once]);

  // idle: hiç oynamadı · in: beliriyor · out: siliniyor
  const playing = trigger && seen;
  const [phase, setPhase] = useState(playing ? "in" : "idle");
  const startedRef = useRef(playing);
  useEffect(() => {
    if (playing) { startedRef.current = true; setPhase("in"); }
    else if (startedRef.current) setPhase("out");
  }, [playing]);

  // Callback'ler her render'da değişebilir; effect'i yeniden kurmasınlar.
  const cbRef = useRef(null);
  cbRef.current = { onAnimationStart, onAnimationComplete };

  useEffect(() => {
    if (phase === "idle") return;
    cbRef.current.onAnimationStart?.(phase);
    const lead = phase === "in" ? delay : 0;
    const span = lead + (total - 1) * stagger + baseDuration;
    const id = setTimeout(() => cbRef.current.onAnimationComplete?.(phase), span * 1000 + 40);
    return () => clearTimeout(id);
  }, [phase, total, delay, stagger, baseDuration]);

  let ci = -1;
  const charSpan = (ch) => {
    ci += 1;
    const i = ci;
    return (
      <span
        key={`${phase}-${i}`}
        className="blur-reveal-char"
        style={{
          animationName:     phase === "idle" ? "none" : (phase === "in" ? "blurRevealIn" : "blurRevealOut"),
          animationDuration: `${baseDuration}s`,
          animationDelay:    `${phase === "in" ? delay + i * stagger : (total - 1 - i) * stagger}s`,
          ...(phase === "idle" ? { opacity: 0 } : null),
          ...(gradient ? { color: _mix(gradient[0], gradient[1], total > 1 ? i / (total - 1) : 0) } : null),
          ...(letterSpacing ? { marginRight: letterSpacing } : null),
        }}
      >
        {ch}
      </span>
    );
  };

  return (
    <Tag ref={hostRef} className={className} style={style}>
      {/* Ekran okuyucu metni tek parça okur; harfler ondan gizli. */}
      <span className="sr-only">{text}</span>
      {words.map((word, wi) => (
        <span key={`w-${wi}`} className="inline-block whitespace-nowrap" aria-hidden="true">
          {word.split("").map((ch) => charSpan(ch))}
          {wi < words.length - 1 && charSpan(" ")}
        </span>
      ))}
    </Tag>
  );
}

export default BlurReveal;
