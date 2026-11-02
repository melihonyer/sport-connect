// Branş rengi + ikonu — takım kartının üst bandı ve etkinlik kartının takvim şeridi/rozeti
// (2 Kasım 2026, Melih: "bakıldığında ne takım olduğu hızlıca anlaşılsın"). Branş renkleri
// kurumsal paletin DIŞINDA bilinçli bir istisna ve TEK kaynak burası: JSX'e branş rengi yazılmaz.
// Hepsi düz renk (degrade yok). Lucide'de olmayan branşlar için aynı çizgi stilinde küçük ikonlar.
import {
  Activity, Bike, Dumbbell, Flower2, Footprints, Kayak, Medal, Mountain,
  PawPrint, PersonStanding, Volleyball, Waves,
} from "lucide-react";

// Lucide ile aynı ölçü ve çizgi: 24×24, stroke 2, yuvarlak uçlar.
const lucideLike = (children) => function SportGlyph({ className = "", strokeWidth = 2, ...rest }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
      {children}
    </svg>
  );
};

const Basketball = lucideLike(<>
  <circle cx="12" cy="12" r="10" />
  <path d="M12 2v20M2 12h20" />
  <path d="M4.9 4.9C7 7 8 9.4 8 12s-1 5-3.1 7.1M19.1 4.9C17 7 16 9.4 16 12s1 5 3.1 7.1" />
</>);
const TennisBall = lucideLike(<>
  <circle cx="12" cy="12" r="10" />
  <path d="M6 3.9a10 10 0 0 1 0 16.2M18 3.9a10 10 0 0 0 0 16.2" />
</>);
const SoccerBall = lucideLike(<>
  <circle cx="12" cy="12" r="10" />
  <path d="M12 7.5l4.3 3.1-1.6 5h-5.4l-1.6-5z" />
  <path d="M12 7.5V2.5M16.3 10.6l4.5-1.5M14.7 15.6l2.8 3.8M9.3 15.6l-2.8 3.8M7.7 10.6l-4.5-1.5" />
</>);
const PadelRacket = lucideLike(<>
  <ellipse cx="9.5" cy="9.5" rx="6" ry="6.8" transform="rotate(-45 9.5 9.5)" />
  <path d="M13.8 13.8l6.7 6.7" />
  <path d="M7.5 8h.01M10.5 7h.01M8.5 11h.01M11.5 10h.01" />
</>);
const Runner = lucideLike(<>
  <circle cx="14.5" cy="4" r="2" />
  <path d="M6.5 12l3-3.5 4 .5 2.5 3.5 3 .5" />
  <path d="M13.5 9l-2.5 5.5 3.5 2.5-1 5" />
  <path d="M11 14.5L8 21" />
</>);
const Oars = lucideLike(<>
  <path d="M5 19L16 8M19 19L8 8" />
  <path d="M15 4.5l4.5 4.5-2.5 1.5-3.5-3.5zM9 4.5L4.5 9 7 10.5l3.5-3.5z" />
</>);

// Griye kayan soluk tonlar (Melih, 2 Kasım 2026: canlı hali "çok renkli", üç seçenekten "daha
// gri"yi seçti). OKLCH'de düşük doygunluk (C 0.06) + hafif mavi-gri ton; tonlar çarkta dağıtıldı,
// en çok kullanılan dört branş (Triatlon, Koşu, Bisiklet, Yüzme) birbirinden en uzak: mor, gül
// kurusu, haki, mavi. Hepsinde beyaz yazı ≥ 4.5:1; yazı rengi yine de kontrasta göre seçilir
// (ileride açık bir renk eklenirse koyu yazı). Yeni renk de bu doygunlukta seçilir.
const RAW = {
  Triatlon:       ["#5A507D", Medal],
  Koşu:           ["#8F6870", Runner],
  Bisiklet:       ["#7D7256", Bike],
  Yüzme:          ["#426D93", Waves],
  Tenis:          ["#5E7A5F", TennisBall],
  Basketbol:      ["#74554A", Basketball],
  Padel:          ["#367C85", PadelRacket],
  Yürüyüş:        ["#30665A", Footprints],
  Trekking:       ["#6C6868", Mountain],
  Voleybol:       ["#8C6985", Volleyball],
  Futbol:         ["#29513E", SoccerBall],
  Kano:           ["#10556D", Kayak],
  Kürek:          ["#293B65", Oars],
  Crossfit:       ["#3A495C", Dumbbell],
  Pilates:        ["#69465B", PersonStanding],
  Yoga:           ["#80668D", Flower2],
  Canicross:      ["#66553D", PawPrint],
  Bikejoring:     ["#5C4133", PawPrint],
  "Dog Triatlon": ["#4E2E2D", PawPrint],
  Diğer:          ["#114956", Activity], // brand-600
};

// WCAG göreli parlaklık → beyaz mı koyu (Carbon) mı daha okunur
const INK = "#1F2121";
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const textOn = (hex) => (1.05 / (lum(hex) + 0.05) >= (lum(hex) + 0.05) / (lum(INK) + 0.05) ? "#FFFFFF" : INK);

export const SPORT_STYLE = Object.fromEntries(
  Object.entries(RAW).map(([k, [color, Icon]]) => [k, { color, text: textOn(color), Icon }])
);

export const sportStyle = (sport) => SPORT_STYLE[sport] || SPORT_STYLE.Diğer;
