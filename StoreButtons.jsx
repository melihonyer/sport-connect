// Tek tip mağaza düğmeleri (8 Ekim 2026, Melih: "butonun, rozetlerin hepsi bir standart olsun").
//
// Muuvlink'in ve Training Agents'ın App Store / Google Play düğmeleri aynı kalıptan çıkar:
// siyah zemin, 48 px yükseklik, rounded-xl, solda marka simgesi, iki satır yazı. Resmî
// rozet görselleri birbirinden farklı çerçeve/boşlukla geliyor ve yanındaki düğmeyle aynı
// boyda durmuyordu. E-postadaki PNG'ler de bu tasarımdan üretilir (icons/mail/storebtn-*).
// Hover: yalnız imleçli cihazda hafif yükselme + koyulaşma (`.store-btn`, index.css).
import React from "react";

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.54c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.02-3.77-2.05-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.15-.47 7.8 1.29 10.36.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.86 1.41-2.93-.03-.01-2.7-1.04-2.73-4.12zM14.54 4.84c.71-.87 1.19-2.07 1.06-3.27-1.02.04-2.27.68-3.01 1.54-.66.76-1.24 1.99-1.09 3.16 1.14.09 2.31-.58 3.04-1.43z"/>
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 512 512" className="w-6 h-6 flex-shrink-0" aria-hidden="true">
    <path fill="#00d3ff" d="M47 24.8c-3.5 3.7-5.5 9.4-5.5 16.8v429c0 7.4 2 13.1 5.5 16.8l1.4 1.4L288 258.8v-5.6L48.4 23.4 47 24.8z"/>
    <path fill="#ffce00" d="M368 338.8l-80-80v-5.6l80.1-80.1 1.8 1L465 229c27.1 15.4 27.1 40.6 0 56l-95.1 54-1.9 1z"/>
    <path fill="#ff3948" d="M369.9 337.8L288 256 47 497c8.9 9.4 23.7 10.6 40.3 1.2l282.6-160.4z"/>
    <path fill="#00f076" d="M369.9 174.2L87.3 13.8C70.7 4.4 55.9 5.6 47 15l241 241 81.9-81.8z"/>
  </svg>
);

export function StoreButton({ store, href, top, onClick }) {
  const apple = store === "apple";
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}
      className="store-btn inline-flex items-center gap-2.5 h-12 pl-3.5 pr-4 rounded-xl bg-black text-white">
      {apple ? <AppleIcon /> : <PlayIcon />}
      <span className="flex flex-col leading-none text-left">
        <span className="text-[10px] font-medium opacity-80">{top}</span>
        <span className="text-[17px] font-semibold mt-0.5 whitespace-nowrap">{apple ? "App Store" : "Google Play"}</span>
      </span>
    </a>
  );
}
