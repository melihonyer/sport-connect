# Meta reklam profili — Muuvlink

Alan adı `muuvlink.app` · depo `SPORT-CONNECT` (`melihonyer/sport-connect`) · güncelleme: 14.10.2026
Ayrıntı: `MUUVLINK-META-DURUM.md` (26.08.2026). Çelişki olursa canlı hesaba bak, sonra burayı güncelle.

## Kimlikler
| Ne | Değer |
|---|---|
| Kısa ad | `ML` |
| İşletme portföyü | MuuvLink — `1316540033789452` |
| Reklam hesabı | MuuvLink Reklam Hesabı — `1342462507830325` · TRY · kart 7178 |
| Veri kümesi (piksel) | Muuvlink Web — `1365354095202713` (`.env.production` `VITE_META_PIXEL_ID`, build'e gömülü) |
| Uygulama veri kümesi | Muuvlink — `1568583344777265` (SDK yok, 0 olay) |
| Facebook sayfası / Instagram | Muuvlink — `1149293774933710` · `@muuvlinkapp` |
| Alan adı | `muuvlink.app` doğrulandı — `index.html`'deki `facebook-domain-verification` etiketi STATİK kalmalı |
| Ads MCP "Edit status" | **Allowed** — açma/kapatma yalnız Melih'in açık talimatıyla |

Kart 7178 Training Agents ile ortak; Meta'nın "kart başına reklam hesabı" sınırına takılmıştı
(14.10.2026). Ödeme hatası görülürse önce bunu kontrol et.

## Ürün ve hedef dönüşüm
- Spor buluşma platformu: yakındaki antrenman/etkinliği bul, takıma katıl ya da takım kur.
  Ücretsiz. Web + iOS/Android (uygulama siteyi yükler).
- Ana optimizasyon olayı: **CompleteRegistration**. Asıl değer: **JoinTraining** (haftada ~50
  olunca ona geç). Arz tarafı: CreateTeam / CreateTraining.
- Ücretli akış yok → Purchase yok.
- Pazar: **Türkiye, Türkçe** öncelikli. Site 7 dilde (tr, en, de, el, es, fr, it); yabancı
  dil reklamı açılırsa o dilin açılış sayfası (`/en/events` vb.) ve AB'de GDPR rızası.

## Ölçüm durumu
| Olay | Piksel | CAPI | Not |
|---|---|---|---|
| PageView | ✅ | — | SPA rota değişimlerinde de |
| ViewContent | ✅ | — | etkinlik / takım detayı |
| StartRegistration | ✅ | — | oturumda 1 kez |
| CompleteRegistration | ✅ | ✅ | ana dönüşüm |
| JoinTraining | ✅ | ✅ | asıl değer olayı |
| JoinTeam | ✅ | ✅ | |
| CreateTraining / CreateTeam | — | ✅ | arz tarafı |

- Kod: `analytics.js` (piksel, olay haritası, kaynak yakalama), `backend/backend-api.js`
  (`sendMetaEvent`, `trackMeta`), `sporla-bulusma.jsx` (çağrılar).
- Tekilleştirme kurulu (aynı `event_id`). Otomatik gelişmiş eşleştirme bilerek kapalı.
- Ölçülmeyen: `Search` (analytics.js'te hazır, bağlanmadı), Purchase, uygulama yüklemesi.
- **Gerçek sayı:** `users` tablosu — `utm_source/medium/campaign/content/term`, `fbclid`,
  `acquisition_platform`, `landing_page`, `referrer` (ilk dokunuş). Yalnız SELECT.
- `utm_source` değerleri: `meta` (reklam), `share` (paylaşım butonları), `muuvlink`
  (e-posta rozetleri). Reklam UTM'si: SKILL.md §4.
- CAPI log tuzağı: `pm2 logs` eski satırları da gösterir; kesin kontrol `pm2 flush` +
  `pm2 restart` sonrası.

## Kitleler
- `Benzer Hedef Kitle (1%) - ML - Tum kullanicilar` — soğuk kitlede ana koz
- `WEB - Tum ziyaretciler 180g` — piksel, otomatik büyür (retargeting tabanı)
- `ML - Tum kullanicilar` — müşteri listesi (131 hash, Ağu 2026), statik; asıl işi **hariç tutma**
- `FB - Sayfa etkilesim 365g`, `IG - Etkilesim 365g` — ikisi de < 1000, dar
- Kurulamayan (Meta'nın 100 kişi alt sınırı, Ağu 2026): hiç katılmayanlar (98), aktif
  katılımcılar (33), etkinlik oluşturanlar (9). Hash'li CSV'ler hazır; sayı artınca, rıza
  kontrolüyle yüklenebilir.
- Statik liste yerine **CompleteRegistration olay kitlesi** kur (otomatik büyür) — yapılmadı.

## Kampanyalar (Ads Manager'dan okundu: 14.10.2026, son 30 gün 14.09–13.10)
| Kampanya | Reklam seti | Durum | Sonuç | Harcama |
|---|---|---|---|---|
| `MUUV \| Kayit \| Web` (`120253936542240288`) | `14 il \| 19-50 \| Genis \| FB+IG` (`120253936559940288`) · 100 ₺/gün | **açık — 14.10.2026, Melih'in talimatıyla** | 34 CompleteRegistration (Meta), 66,43 ₺/kayıt | 2.258,55 ₺ |
| `MUUV \| Takipci \| IG` (`120253936790580288`) | `Takipci \| 14 il \| 19-50 \| IG profil` · 200 ₺/gün | **duraklatıldı — 20.10.2026, Melih** (#2016153 yüzünden hiç teslim yoktu) | 546 profil ziyareti, 2,34 ₺ | 1.278,06 ₺ |
| Beğenme Reklamı | — | kapalı | — | 0 |
| Yeni Uygulama tanıtımı | — | kapalı · 55 ₺/gün | SDK yok, ölçülemez | 0 |

- Kayıt kampanyası: açık reklamlar V5, V8, V9 (en iyi), V11; kapalı V1–V4, V6, V7.
  Kampanya açılınca dördü de `delivery: active`, hata yok (14.10.2026).
- Takipçi kampanyası hatası: "Ad account isn't eligible for Profile Visit ads" — hesap bu
  reklam türüne uygun değil (Meta destek). Ayrıca `Takipci | 14 il | 19-50` seti ve
  "Tavsiye edilen ayarlarla yeni Trafik Reklam" (inceleme bekliyor) var.
- **Politika (14.10.2026):** Business Support Home'da ihlal yok, reddedilen reklam yok, veri
  kümelerinde sorun yok. Açık destek talebi: "Ad publishing error" (12.10.2026, inceleniyor) —
  büyük olasılıkla profil ziyareti uygunluğu.
  **19.10.2026 Meta cevabı** (vaka 1090881883725173, durum "Action required"): teknik ekip hatanın
  Reklam Yöneticisi MOBİL uygulamasında hedef kitle düzenlenirken profil ziyareti reklamlarında oluşan
  bir yayınlama sorunundan kaynaklandığını söyledi. Öneri: reklamı BİLGİSAYARDAN Reklam Yöneticisi'nde
  çoğalt, yeni kopyayı yayınla; hedef kitleyi mobilden düzenleme. Sürerse hatayı gösteren İngilizce ekran
  kaydı istiyorlar. Cevap verilmediği için sohbet duraklatıldı; vaka uzman ekipte açık.
  **20.10.2026:** Melih'in kararıyla takipçi kampanyası duraklatıldı, bütçe kayıt kampanyasına kalıyor
  (14–19 Ekim: 795,90 ₺ / 18 kayıt / 44,22 ₺ Meta sayımıyla). Destek sohbetine "kampanyayı duraklattık,
  talebi kapatıyoruz" yazıldı; "Close this support case" iki kez "trouble completing your request" hatası
  verdi — vaka açık kaldı (temsilci kuyruğunda). Profil ziyareti gerekirse: masaüstü Reklam Yöneticisi'nde çoğalt. Kontrol yeri:
  `facebook.com/business-support-home/1316540033789452/`. Meta bildirim e-postaları bağlı
  Gmail'de (`info@saltajans.com`) yok; hangi adrese gittiği bilinmiyor (muhtemelen Facebook hesabının e-postası).
- Hesapta **2 yayımlanmamış taslak** ("Review and publish (2)"; V8 ve Takipçi setinde
  değişiklik). Kimin/neden yaptığı bilinmiyor — Melih'e sormadan yayımlama/atma.
- Reklamlar zaten §4'teki UTM'yi taşıyor (`utm_source=meta&utm_medium=paid`, kampanya ve
  reklam adı) → `users.utm_campaign` / `utm_content` reklam bazında eşleşiyor.

**Kendi verimiz (aynı 30 gün):** toplam 75 kayıt; `utm_source=meta` 20 (+1 yalnız fbclid).
Reklam bazında: V9 12 · V5 3 · V11 3 · V8 2. Meta 34 diyor (rıza/iOS/atıf penceresi farkı +
uygulamadan kayıtlar). Gerçek kayıt başı ≈ 113 ₺. Bu 21 kişiden **yalnız 2'si** bir
etkinliğe katıldı → asıl sorun kayıttan katılıma geçiş.

## Dil ve marka kuralları (CLAUDE.md'den)
- **Emoji yok** — metinde de görselde de. Görselde ikon gerekiyorsa SVG (lucide).
- Ton X/Z kuşağı, "cringe" olmayan: "Selam!", ünlem yığını, zorlama argo ("kanka", "efsane") yok.
- **Sayı yazılmaz:** üye, katılımcı, boş yer adedi yok ("hâlâ yer var" gibi).
- Takım/etkinlik adına Türkçe ek getirilmez ("{ad} takımını").
- Branştan bağımsız örnek; padel kitlesine "sabah koşusu" denmez.
- Spor: kişisel sağlık/vücut durumu varsayan hitap yok, öncesi/sonrası yok.
- Türkçe önce onaylanır, diğer diller ona göre çevrilir.
- Görsel: kurumsal palet (Deep Teal `#114956`, sarı `#F4F818` tek vurgu, Carbon `#1F2121`
  metin, White Smoke `#F4F4F4`), **degrade yok** (fotoğraf üstü okunurluk karartması hariç),
  Montserrat, orijinal MUUVLINK yazı logosu.
- Training Agents reklamı bu hesaptan verilmez (ayrı hesap, ayrı profil).

**Reklam açıları:**
1. Birlikte daha iyi: "Bugün kiminle koşuyorsun?" — yakınındaki antrenmanlar
2. Takımını kur, insanlar seni bulsun (arz tarafı, liderler)
3. Branş çeşitliliği: koşu, bisiklet, yüzme, triatlon, padel… tek yerde
4. Parkur/yer: tanıdık rotalar ("balonların arasında koştuk" karusel dili)
5. Ücretsiz, hesap açınca hemen katıl

## Açık işler / dikkat
- **Rıza boşluğu:** `initAnalytics()` (`main.jsx`) pikseli açılışta yüklüyor; çerez bandı
  (`CookieBanner`) yalnız "Kabul et" kaydediyor, piksel onayı beklemiyor, reddetme düğmesi
  yok. AB dili reklamından önce çözülmeli; karar Melih'in (hukuki).
- Kampanya kurgusu bekliyor (ölçüm altyapısı tamam).
- Instagram içi tarayıcıda kayıt akışı reklamdan önce denenmeli.
- Pikselde "otomatik sayfa/ürün bilgisi" açık — gözden geçirilecek (düşük öncelik).
- Meta SDK + SKAdNetwork (yükleme ölçümü) — mağaza güncellemesi gerekir, ertelendi.
