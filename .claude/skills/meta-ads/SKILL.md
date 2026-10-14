---
name: meta-ads
description: Muuvlink'in Meta (Instagram/Facebook) reklamları — kampanya planı, resmî Meta Ads bağlayıcısıyla taslak kurulum, reklam metni ve kreatif, piksel/CAPI ölçümü, optimizasyon ve haftalık rapor. Kullanıcı Meta/Instagram/Facebook reklamı, kampanya, reklam seti, kitle, bütçe, kreatif testi, CPA, Events Manager, piksel, CAPI veya dönüşüm olayı sorduğunda kullan. Organik paylaşım (gönderi, Reels, hikâye) için `sosyal-medya` skill'i.
---

# Meta reklamları — Muuvlink

Bu skill **yöntemi** taşır. Hesap kimlikleri, ölçüm durumu, kitleler ve dil kuralları
**`profil.md`**'de (bu klasörde). Profil okunmadan kampanya kurma, metin yazma, rapor verme.
Ayrıntılı geçmiş: depo kökünde `MUUVLINK-META-DURUM.md` (26.08.2026).

Profildeki bir bilgi eskiyse (yeni kitle, yeni olay, kampanya durumu, kart) **profili
güncelle** ve commit et — bir sonraki oturum oradan okur.

Kaynak: SALT'ın ortak `meta-ads` skill'i (kaynak depo `melihonyer/training-agents`,
`.claude/skills/meta-ads/`), 14.10.2026'da Muuvlink'e uyarlandı. Diğer projelerin
profilleri bu depoya alınmadı.

## 1. Kırmızı çizgiler

- **Açma/kapatma yalnız açık talimatla.** Yeni kampanya / reklam seti / reklam her zaman
  **duraklatılmış (PAUSED)** kurulur. Melih "şunu aç / kapat" dediğinde yalnız o nesnenin
  durumunu değiştir: önce ad + ID ile teyit et, değiştir, yeniden okuyup doğrula.
  Kendiliğinden açma; "performans düşük" diye kendiliğinden kapatma da — öner, Melih karar
  versin. (14.10.2026: Ads MCP "Edit status" açık.)
- **Para harcatan karar = önce sor.** Bütçe tutarı, artışı, yeni kampanya: rakamı ve
  günlük/aylık TL karşılığını söyle, onay al.
- **Yalnız Muuvlink reklam hesabı** (`1342462507830325`). Bağlayıcının izni Melih'in eriştiği
  tüm hesapları kapsıyor (Training Agents, Vibe to Brands, Salt Ajans, müşteriler). Başka
  hesabı açık istek olmadan okuma bile.
- **Kişisel veri:** müşteri listesi yüklemek KVKK/GDPR'da pazarlama rızası ister — sormadan
  yükleme. Hash'leme sunucuda yapılır, düz e-posta yerele inmez. Hedeflemeye, olaya,
  kitleye özel nitelikli veri (sağlık, din, siyaset vb.) girmez.
- **Gizli değerler** (CAPI erişim anahtarı vb.) sohbete, depoya, profile yazılmaz. Anahtar
  sunucudaki `backend/.env`'de (`META_CAPI_TOKEN`).
- **Gerçek kullanıcı verisinde test yapılmaz** (CLAUDE.md). Ölçüm testi: geçici kullanıcı aç,
  akışı dene, sil. `META_TEST_EVENT_CODE` canlıda boş kalır.

## 2. Resmî Meta Ads bağlayıcısı

claude.ai bağlayıcısı **"Meta Ads"** = `https://mcp.facebook.com/ads` (Meta'nın kendi Ads MCP'si).

1. Araçlar yoksa: `session_connectors_status` → "Meta Ads" kapalıysa
   `set_session_connector_enabled("Meta Ads", true)`; araçlar **bir sonraki turda** gelir.
   Listede hiç yoksa Melih'ten claude.ai → Ayarlar → Bağlayıcılar'da eklemesini iste
   (ekledikten sonra yeni oturum gerekebilir).
   Eski yol Windsor.ai (`connector: "facebook"`) yalnız okumaydı; bağlayıcı yoksa rapor
   için hâlâ kullanılabilir.
2. **Oku:** reklam hesabı, mevcut kampanyalar, veri kümesindeki olaylar, son 7 gün.
3. **Kur:** kampanya → reklam seti → kreatif (görsel/video yükle) → reklam; hepsi PAUSED.
4. **Doğrula:** oluşturduğunu yeniden oku (amaç, olay, bütçe, kitle, yerleşim, URL + UTM).
5. Melih'e özet ver (Ads Manager'da gözden geçirme yolu dahil), açma talimatını bekle.
6. **Aç/kapat talimatı gelince:** nesneyi teyit et → durumu değiştir → yeniden oku → sonucu
   (ad, ID, yeni durum, günlük bütçe) tek satırda bildir.

Yetki ayarı: İşletme Ayarları → Entegrasyonlar → **Ads MCP server** → hesap → Details.

**Tuzak:** Ads Manager formları varsayılan olarak **Vibe to Brands** sayfasını/portföyünü
seçebiliyor (kitle kurarken yaşandı). Her nesnede sayfanın Muuvlink (`1149293774933710`)
olduğunu oku.

## 3. Ölçüm ilkeleri

- **Piksel + CAPI, aynı `event_id`** → Meta tekilleştirir. Muuvlink'te kurulu
  (`analytics.js` ↔ `backend-api.js` `sendMetaEvent`/`trackMeta`).
- **Meta eksik sayar** — gerçek sayı kendi veritabanımızda: `users.utm_*`, `fbclid`,
  `acquisition_platform`, `landing_page` (ilk dokunuş). Raporda iki rakam yan yana.
  Veritabanında yalnız SELECT.
- **Uygulama Capacitor kabuğu** (`server.url = muuvlink.app?src=app`): uygulama içi olaylar
  web pikseliyle gider, ama mağaza **yüklemesi** ölçülmez (Meta SDK yok) → App Promotion
  kampanyası açma. Eski "Yeni Uygulama tanıtımı" bu yüzden ölçülemedi.
- **EMQ (Olay Eşleşme Kalitesi)** 6'nın altındaysa önce takibi düzelt, sonra bütçe artır.
- **Otomatik gelişmiş eşleştirme** kapalı kalır; eşleştirme verisini CAPI kontrollü gönderir.
- **Rıza:** profildeki "Açık işler"e bak — piksel şu an çerez onayını beklemeden yükleniyor.
- **Instagram/Facebook içi tarayıcı:** reklam tıklamalarının çoğu orada açılır. Kayıt akışını
  (e-posta ve varsa sosyal giriş) orada dene; Google ile giriş gömülü tarayıcıda çalışmaz.

## 4. Kampanya yapısı

**Amaç:**
- Ana olay **CompleteRegistration** → **Leads** amacı, dönüşüm yeri **Website**.
- `JoinTraining` haftada ~50'yi geçince ona geç (asıl değer olayı).
- **Traffic kullanma** (tıklayanı bulur, dönüşeni değil). Eski "Beğenme Reklamı" LINK_CLICKS idi.
  Awareness yalnız bilinçli marka işi.

**Yapı (bütçe payı):**
| Kampanya | Kitle | Pay |
|---|---|---|
| Prospecting | geniş / Advantage+ audience + Lookalike %1, Türkiye | %60–70 |
| Retargeting | `WEB - Tum ziyaretciler 180g` + IG/FB etkileşim, kayıt olanlar hariç | %20–25 |
| Reaktivasyon / test | kayıtlı ama katılmamış (JoinTraining) ya da yeni kreatif açısı | %10–15 |

- **Bütçe:** reklam seti başına haftada 50 (en az 25) dönüşüm →
  `günlük bütçe ≈ hedef CPA × 50 / 7`. Yetmiyorsa reklam seti sayısını azalt, bölme.
  Geçmiş tempo ~250 ₺/gün (Ağu 2026).
- **Öğrenme dönemi** 5–7 gün dokunma; bütçe bir seferde en fazla **+%20**.
- **Yerleşim:** Advantage+ placements; Audience Network dönüşüm getirmiyorsa çıkar.
- **Hariç tut:** `ML - Tum kullanicilar` (ve CompleteRegistration olay kitlesi kurulunca o).
- **Açılış sayfaları:** `/` · `/etkinlikler` · `/takimlar` · `/takim-kur`; dil reklamı
  için önekli adresler (`/en/events`, `/de/teams`…). Detay sayfası (`/etkinlik/..`,
  `/takim/..`) yalnız o kayda özel reklamda.
- **UTM** (reklam düzeyinde "URL parametreleri"; `users.utm_*` bunu okur):
  `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`
  Var olan değerler: `share` (paylaşım butonları), `muuvlink`/`eposta` (e-posta) — karıştırma.
- **Adlandırma:** `ML_<Amaç>_<Kitle>_<YYYYAA>` / `<Kitle>_<Yaş>_<Yerleşim>` / `<Açı>_<Format>_v<N>`.

## 5. Yayından önce kontrol listesi

- [ ] CompleteRegistration Events Manager'da son 7 günde geliyor (Server satırı dahil)
- [ ] Açılış sayfası Instagram içi tarayıcıda açıldı, kayıt tamamlanabiliyor
- [ ] Çerez bandı mobilde açılış sayfasının düğmesini kapatmıyor
- [ ] Kreatif 4:5 (Feed) + 9:16 (Reels/Stories), videoda altyazı
- [ ] Metin §6 ve profildeki dil kurallarına uyuyor; sayfadaki iddiayla aynı
- [ ] Sayfa Muuvlink, hesap `1342462507830325`
- [ ] Bütçe Melih onaylı; her şey PAUSED; açma talimatı Melih'ten geldi

## 6. Reklam metni ve kreatif

**Meta politikası:**
- **Kişisel özellik ima etme:** sağlık, kilo, yaş, vücut, mali durum vb. varsayan hitap yasak
  ("Kilo mu aldın?", "Yalnız mı koşuyorsun?" bile sınırda). Ürün/topluluk merkezli yaz.
- Öncesi/sonrası görseli, gerçek dışı sonuç, sağlık vaadi yok.

**Ölçüler:** birincil metin < 125 karakter, başlık < 40, açıklama < 30. Video: ilk 3 saniye
kanca, kalın altyazı (çoğu kişi sessiz izler), değer önde. 3–5 açıyı dönüşümlü test et
(açılar profilde). Tek değişken test et: kreatif mi, kitle mi, sayfa mı.

**Kreatif üretimi** `sosyal-medya` skill'iyle aynı kurallarla: kurumsal palet, degrade yok,
emoji yok, stok lisansı, teslim klasörü `images/sosyal-medya/reklam/<kampanya>/`.

## 7. Optimizasyon ve rapor

İlk 5–7 gün karar verme. Sonra haftalık:

| Sinyal | Eşik | Hareket |
|---|---|---|
| Kreatif yorgunluğu | 7 günde CTR %20+ düşüş, frekans > 3 (prospecting) | yeni kreatif sıraya |
| Boşa harcama | reklam seti 2× hedef CPA harcadı, 0 dönüşüm | durdurmayı öner; Melih derse kapat |
| Kazanan | CPA hedefin altında, 50+ dönüşüm/hafta | bütçe +%20 öner |
| Kitle çakışması | aynı kişilere yarışan setler | birleştirmeyi öner |
| Teslim düştü | ani düşüş | reddedilen reklam, ödeme, politika uyarısı |

**Rapor:** harcama, CPM, CTR, CPC, CompleteRegistration sayısı ve CPA — Meta'ya göre **ve**
`users.utm_source='meta'` kayıtlarına göre; o kayıtlardan kaçı bir etkinliğe katıldı
(gerçek değer); en iyi/en kötü 3 kreatif; sonraki hafta için en fazla 3 öneri. Kısa tut;
uzunsa Artifact olarak yayımla. Kişi adı raporlanmaz, yalnız sayı.

Otomatik haftalık rapor/hatırlatma **kurulmaz** — Melih ister.

---

Genel çerçeve (amaç seçimi, kampanya yapısı, öğrenme dönemi, %20 kuralı, kreatif yorgunluğu)
narayan-metaflow/metaflow-marketing-skills (MIT) Meta skill'lerinden uyarlandı.
