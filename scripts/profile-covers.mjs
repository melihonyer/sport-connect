// Profil kapak görselleri. Elle çalıştırılır:  node scripts/profile-covers.mjs
// 14 Kasım 2026 (Melih): kişi fotoğrafı değil, branşın oynandığı yer — sinematik, davetkâr, insansız. Gemini ile üretildi
// (21:9, 1584×672), kaynaklar store-assets/covers-gemini/<branş>.jpeg (repoya girmez, yerelde durur).
// Çıktı public/covers/<branş>.webp (+ seçici için covers/thumb/, 480×160): 3:1 orta kırpma, kaynağın tam genişliği (1584×528). Konu ortada üretildiği için
// kırpma ortadan yapılır. Kapak kodları backend PROFILE_COVER_PHOTOS ve site PROFILE_COVER_PHOTOS ile aynı (dosya adı).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'store-assets', 'covers-gemini');
const OUT = path.join(ROOT, 'public', 'covers');
fs.mkdirSync(path.join(OUT, 'thumb'), { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => /\.jpe?g$/.test(f));
for (const f of files) {
  const src = path.join(SRC, f);
  const { width } = await sharp(src).metadata();
  const w = Math.min(width, 2400);
  await sharp(src).resize(w, Math.round(w / 3), { fit: 'cover', position: 'centre' })
    .webp({ quality: 82 }).toFile(path.join(OUT, f.replace(/\.jpe?g$/, '.webp')));
  // Seçicideki küçük resim (19'u birden yüklenir): 480×160.
  await sharp(src).resize(480, 160, { fit: 'cover', position: 'centre' })
    .webp({ quality: 78 }).toFile(path.join(OUT, 'thumb', f.replace(/\.jpe?g$/, '.webp')));
}
console.log(`[profile-covers] ${files.length} kapak → public/covers/`);
