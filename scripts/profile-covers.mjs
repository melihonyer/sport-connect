// Profil kapak görselleri (13 Kasım 2026, Melih: profil özelleştirme 3). Elle çalıştırılır:
//   node scripts/profile-covers.mjs
// public/story/<branş>.jpg (1080×1920, hikâye kartı fotoğrafları) → public/covers/<branş>.webp (1080×360, 3:1 yatay bant).
// Kırpma sharp "attention" ile: sporcuların olduğu bölgeyi bulur (sabit kırpma noktası her fotoğrafa uymuyordu).
// Kapak kodları backend PROFILE_COVER_PHOTOS ve site PROFILE_COVER_PHOTOS ile aynı (dosya adı).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public', 'story');
const OUT = path.join(ROOT, 'public', 'covers');
fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.jpg'));
for (const f of files) {
  await sharp(path.join(SRC, f)).resize(1080, 360, { fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 80 }).toFile(path.join(OUT, f.replace(/\.jpg$/, '.webp')));
}
console.log(`[profile-covers] ${files.length} kapak → public/covers/ (${files.map((f) => f.replace('.jpg', '')).join(', ')})`);
