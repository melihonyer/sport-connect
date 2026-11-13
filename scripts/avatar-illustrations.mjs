// Hazır profil çizimleri (13 Kasım 2026, Melih: altı setin hepsi). Elle çalıştırılır:
//   node scripts/avatar-illustrations.mjs
// public/avatars/<set>-<nn>.webp üretir (6 set × 12 = 72 dosya, 256 px). Dosyalar repoya girer;
// site/uygulama/e-posta bu adresleri profil fotoğrafı gibi gösterir, DiceBear paketleri pakete GİRMEZ
// (yalnız devDependency). Seçim ucu: backend POST /api/auth/avatar/illustration (AVATAR_SETS ile aynı).
// Lisans: çizimler CC0 1.0 — Notionists (Zoish), Lorelei (Lisa Wischofsky), Open Peeps (Pablo Stanley),
// Thumbs/Glass/Shapes (DiceBear); https://www.dicebear.com/licenses (kod MIT). Atıf zorunlu değil.
// Tohum ve renk değişirse çizimler de değişir: kullanıcıların seçtiği dosyanın üzerine yazılır.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createAvatar } from '@dicebear/core';
import * as notionists from '@dicebear/notionists';
import * as lorelei from '@dicebear/lorelei';
import * as openPeeps from '@dicebear/open-peeps';
import * as thumbs from '@dicebear/thumbs';
import * as glass from '@dicebear/glass';
import * as shapes from '@dicebear/shapes';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'avatars');
const SEEDS = ['Ada', 'Deniz', 'Ege', 'Lale', 'Mira', 'Arda', 'Defne', 'Kaan', 'Nehir', 'Selin', 'Toprak', 'Yagmur'];
// Kurumsal paletin açık tonları (tailwind.config.js token değerleri birebir).
const PASTEL = ['e6f7f5', 'f2ecf7', 'fdfee0', 'c2ede9', 'f4f4f4', 'e3d8ee']; // brand-50, purple-50, pop-50, brand-100, smoke, purple-100
// Thumbs zemini: Deep Teal, Ana1, Ana2 (ana renkler).
const THUMBS_BG = ['114956', '00a499', '643e87'];
const SETS = {
  nt: [notionists, { backgroundColor: PASTEL }],
  lo: [lorelei, { backgroundColor: PASTEL }],
  op: [openPeeps, { backgroundColor: PASTEL }],
  th: [thumbs, { backgroundColor: THUMBS_BG }],
  gl: [glass, {}],
  sh: [shapes, {}],
};

fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [set, [style, opts]] of Object.entries(SETS)) {
  for (let i = 0; i < SEEDS.length; i++) {
    const svg = createAvatar(style, { seed: SEEDS[i], size: 256, ...opts }).toString();
    const file = path.join(OUT, `${set}-${String(i + 1).padStart(2, '0')}.webp`);
    await sharp(Buffer.from(svg), { density: 144 }).resize(256, 256).webp({ quality: 86 }).toFile(file);
    total++;
  }
}
console.log(`[avatar-illustrations] ${total} çizim yazıldı → public/avatars/`);
