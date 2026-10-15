---
name: sosyal-medya
description: Muuvlink'in organik sosyal medya içeriği — gönderi/karusel/Reels/Story/kapak tasarımı (Canva, Adobe, Envato/Freepik/Adobe Stock), gönderi metni ve hashtag, Instagram, Facebook, Threads, YouTube Shorts, TikTok ve Strava kulübünde yayınlama. Kullanıcı "paylaşım hazırla", "karusel", "Reels", "gönderi metni", "Strava'ya paylaş", "her platformda paylaş", kapak/profil görseli dediğinde kullan. Ücretli reklam için `meta-ads` skill'i.
---

# Sosyal medya — Muuvlink

## Hesaplar
| Platform | Hesap | Nereden yayın |
|---|---|---|
| Instagram | `@muuvlinkapp` | **Melih telefondan** (müzik masaüstünden eklenemiyor) |
| Facebook | `muuvlink` (sayfa `1149293774933710`) | Meta Business Suite |
| Threads | `@muuvlinkapp` | threads.com web |
| YouTube | `@Muuvlink` | YouTube Studio |
| TikTok | `@muuvlink` | TikTok Studio |
| Strava | Muuvlink kulübü | strava.com kulüp gönderisi |
| X | `@muuvlink` (Ekim 2026'da açıldı; sitedeki hesap listesinde henüz yok) | x.com — ücretsiz hesap, 280 karakter |

Hesap listesi koddaki dört yerle aynı kalır (CLAUDE.md "Sosyal medya hesapları").
Tarayıcı: Melih'in oturumu açık olan Chrome (Claude in Chrome). Giriş gerekirse Melih yapar;
şifre girilmez. **X ve TikTok'ta Training Agents hesabı da açık olabiliyor** — işe başlamadan
sağ üst/sol alttaki hesabın @muuvlink olduğunu kontrol et; değilse Melih geçirir.

## Kırmızı çizgiler
- **Yayınlamak = önce onay.** Metni, görselleri ve platform listesini göster; "paylaş" onayı
  gelince yayınla. Onay platform başına değil iş başınadır, ama yeni bir platform ya da
  değişen metin yeniden onay ister.
- **Emoji yok** (bayrak dahil) — metin, açıklama, kulüp tanımı.
- Lisanslı/ücretli stok indirmeden önce adaylar gösterilir.
- Gerçek bir yarışın resmî fotoğrafı (organizatör/fotoğrafçı) izinsiz kullanılmaz; kullanılırsa
  gönderi metninde fotoğrafçı etiketi.
- Kullanıcı (üye) adı, takım üyesi fotoğrafı izinsiz paylaşılmaz.

## Tasarım
- **Ölçüler:** gönderi/karusel 1080×1350 (4:5, karusel en çok 10 kare), Reels/Story/Shorts/
  TikTok 1080×1920. Strava kulüp kapağı 2360×1158 kaynak (görünen ~1183×580, sol alt köşe
  avatarın altında kalır — boş bırak), profil 1024×1024.
- **Kurumsal kimlik** (CLAUDE.md "Renk sistemi"): Deep Teal `#114956` zemin/panel, sarı
  `#F4F818` tek vurgu, Carbon metin, degrade yok (fotoğraf üstü okunurluk karartması hariç).
  Montserrat 700/800 başlık; el yazısı vurgusu Caveat. **Orijinal MUUVLINK yazı logosu**
  (yazı tipiyle yeniden yazılmaz); amblem kendi renklerinde.
- **Görsel dili:** tek koşucudan çok **toplu koşan grup**; enerjik, doğal, poz vermeyen
  insanlar ("abdal bakan" stok kalabalığı değil). Melih bir yön verirse 2–4 aday göster,
  seçtirerek ilerle.
- **Kaynaklar:** Canva, Adobe (Photoshop API: dekupe `image_remove_background`), Envato
  Elements / Freepik / Adobe Stock (SALT hesabı). Melih'in yarış fotoğrafları:
  `~/Library/CloudStorage/GoogleDrive-melihonyer@gmail.com/My Drive/YARIŞ FOTOLARI`.
  Uydu: Sentinel-2 cloudless (EOX, CC BY 4.0) — **atıf görselin üstüne değil gönderi metnine**.
- **Üretim:** HTML → Chrome headless PNG (`store-assets/marketing/<konu>/build-*.mjs`).
  Yazı tipleri yerelden `@font-face` data URI (Google Fonts beklenirse render donuyor).
  Büyük görselli sayfada CDP `Page.captureScreenshot` donar → `--screenshot` + bekçi.
  Örnek: `store-assets/marketing/parkur/` (karusel + video), `store-assets/marketing/strava/`.
- **Video:** animasyonlu katman (`data-a` + `setT(t)`) + Python/ffmpeg birleştirici
  (`parkur/video-parkur.*`). Yazı açılma animasyonunda kelime sonu kırpılmasın
  (`clip-path` payı). Prompt'tan video için `video-uretim-akisi` skill'i (Remotion).
- Kontrol: her kareyi görüntü olarak aç, kesik kelime/taşma var mı bak; sonra Melih'e göster.

## Metin
- Ton X/Z kuşağı, sade, "cringe" yok: "Selam!", ünlem yığını, "kanka/efsane" yok.
- **Sayı yazılmaz** (üye/katılımcı adedi). Soru veya davetle biter ("Yoruma yaz", "sen de gel").
- Yapı: kanca cümlesi → 1–2 cümle değer → `muuvlink.app (link profilde)` → atıflar → hashtag.
- **Hashtag her gönderide** (Melih: "hashtagleri unutma"). Çekirdek:
  `#muuvlink #koşu #sporlabuluş #antrenman #koşutakımı`; konuya göre 3–6 ek
  (örn. `#trailrunning #dağkoşusu #ultratrail` + yer adları). Toplam ~10'u geçme.
- Türkçe önce; başka dil istenirse Türkçe onaylandıktan sonra.

## Platform notları (Ekim 2026'da yaşandı)
- **Müzik:** Melih sade bırakılmasını istemiyor — her platformun **kendi lisanslı kitaplığından**
  trend/uygun bir parça seç, adını kayda yaz. Videoya dışarıdan müzik gömme (Content ID).
  - Facebook: Business Suite Reels → müzik kitaplığı. Business Suite'te eklenen müzik
    **Instagram'a uygulanmıyor** → Instagram'ı "Paylaşılacak yer"den çıkar, Melih telefondan.
    Sayfa ayarı gereği Reels Facebook hikâyesine de düşüyor; hikâye anahtarı hesap geneli
    ayar penceresi açıyor — dokunma.
  - Threads: web'de müzik → "Gündem" listesi.
  - YouTube Shorts: Studio düzenleyici → Ses kitaplığı.
  - TikTok: Studio düzenleyici → "Sesler". TikTok Studio programatik dosya eklemeyi kabul
    etmiyor → **Melih dosyayı sürükleyip bırakır**, sonra devam.
- **X zamanlama (web, Ekim 2026):** ana sayfadaki sabit gönderi kutusunu kullan (pencere
  `compose/post` öğeleri kararsız). Sıra: dosya alanına `file_upload` → metin alanına koordinatla
  tıkla, yaz, Esc (hashtag önerisi) → "…: Hazır" yazısını bekle → takvim simgesine **koordinatla**
  tıkla (ref ile tıklama paneli açmıyor) → `read_page` ile Ay/Gün/Saat/Dakika/AM-PM seçicileri,
  `form_input` → üstteki "… itibarıyla gönderilecek" satırını oku → Onayla → düğme "Planla" olunca
  bas. Metin önce yazılıp video sonra eklenince "Medya hazırlanıyor"da takılıyor. Doğrulama:
  `x.com/compose/post/unsent/scheduled`. Birden çok görsel: en çok 4.
- **TikTok Studio zamanlama (web, Ekim 2026):** `file_upload` artık kabul ediliyor. **Önce
  Gönderiler listesine bak** — aynı içerik daha önce paylaşılmış olabilir (Ekim 2026'da 4 tekrar
  çıktı). Yükleme bitince açıklama dosya adıyla yenilenir: "Yüklendi" yazısını bekle, metnin
  üstüne tıkla + JS `focus()`, sonra yaz; `innerText` ile kontrol et. Müzik: Sesler › **Sınırsız**
  (kurumsal hesap için telifsiz) › + › Kaydet. Planla › saat/dakika tekerleği (aynı noktaya art
  arda tıklama tek sayılıyor, araya ekran görüntüsü koy) › tarih takvimi. **"İçerik kontrolü
  (hafif)"i kapat** — açıkken çıkan pencerede "Hemen paylaş" planı atlayabilir. Takvim ayın
  sonuna kadar seçilebiliyor. `execCommand`/yapıştırma ile metin verme editörü çökertir, yapma.
  Klavye çalışmıyorsa Chrome'da öne çıkan sekme başka sekmedir (bekleyen "ayrıl" penceresi).
- **Tarayıcıya dosya yükleme sınırı 10 MB / çağrı:** büyük videolar ffmpeg 2-geçişle ~9 MB'a
  (gerekirse 720×1280) geçici klasörde yeniden kodlanır; orijinallere dokunulmaz.
- **Instagram'dan içerik okuma:** gönderi sayfası gerçekten açılınca `script[type=application/json]`
  içinde metin + medya var (`fetch` ile çekilen HTML'de yok, `/api/v1` 429/HTML dönüyor). Video
  süresi `mediaPresentationDuration`'da — yerel dosyayla eşleştirmenin en güvenilir yolu.
  Medya adresleri imzalı; araç bunları dışarı vermez, zorlanmaz. Önce yerel orijinal, sonra Canva.
- **Strava kulübü:** yalnız JPEG/PNG (video yok → açılış/kapanış karesi). Metindeki URL
  kaldırılıp bağlantı kartına çevriliyor; kart kapatılınca URL metni de gidiyor → metinde
  adres yazma. Form alanlarına `form_input` ile yaz (click+type tutmuyor); "Güncelle" düğmesi
  koordinatla tıklanır. Instagram gönderilerini kulübe aktarırken eskiden yeniye sırayla.
- **Instagram'dan görsel çekmek:** toplu indirme tarayıcıda engelleniyor; önce yerel
  orijinali ara (`images/`).
- Dosya seçici açılmıyorsa: `HTMLInputElement.prototype.click`'i yakalayıp `file_upload`.

## Teslim ve kayıt
- Bitmiş medya iki klasörde, alt klasör açılmaz: görseller (PNG/JPG, PSD) ve metin
  dosyaları `images/sosyal-medya/gorseller/`, videolar `images/sosyal-medya/video/`.
  Konu dosya adının başına önek olarak yazılır: `parkurlar-01-kapadokya-harita.png`,
  `strava-aday-gorseller.jpg`. Stok/ham kaynaklar `images/stok/<konu>-kaynak-*`,
  logolar `images/logolar/` (kurumsal kimlik `logolar/kurumsal/`). `images/` git'e girmez;
  üretim betikleri `store-assets/marketing/` altında commit edilir, stok dosyaları gitignore.
- Her paylaşım için yanında `<konu>-metin.txt` (ya da `<konu>-gonderi-metni.txt`): metin + hashtag +
  **platform başına durum** (yayında / taslak / Melih telefondan, seçilen müzik, tarih).
  Karusel ise `<konu>-karusel-icerigi.md` (kare kare metin, alternatif metin, kaynak/lisans tablosu).
- Dosya taşındıysa `APPS/GENEL/medya-tasima-kaydi-*.tsv`'ye satır.
- Paylaşım bitince Melih'e platform → durum → müzik listesi, kısa.
