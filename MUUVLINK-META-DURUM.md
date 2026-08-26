# Muuvlink — Meta Reklam Kurulumu / Devir Teslim Özeti

> Bu dosya, kampanya kurulumunu yeni bir sohbette sürdürmek için hazırlandı.
> Ölçüm altyapısı **tamamlandı ve canlıda doğrulandı**. Kalan iş: kampanya kurgusu.
> Tarih: 26 Ağustos 2026

---

## 1. Kimlikler ve hesaplar

| Varlık | Değer |
|---|---|
| İşletme portföyü | MuuvLink — `1316540033789452` |
| Reklam hesabı | MuuvLink Reklam Hesabı — `1342462507830325` |
| **Web Pixel (Dataset)** | **Muuvlink Web — `1365354095202713`** |
| App dataset | Muuvlink — `1568583344777265` (SDK yok, 0 olay) |
| Facebook sayfası | Muuvlink — `1149293774933710` |
| Instagram | `@muuvlinkapp` |
| Domain | `muuvlink.app` — **doğrulanmış** |

Meta Ads verisi Windsor.ai bağlantısı üzerinden okunabiliyor
(`connector: "facebook"`), Ads Manager'a girmeye gerek yok.

---

## 2. Ölçüm altyapısı — TAMAM

### Çalışan olaylar

| Olay | Pixel | CAPI | Not |
|---|---|---|---|
| `PageView` | ✅ | — | SPA rota değişimlerinde de tetikleniyor |
| `ViewContent` | ✅ | — | Etkinlik / takım detayı |
| `StartRegistration` | ✅ | — | Kayıt formu açıldı (oturumda 1 kez) |
| **`CompleteRegistration`** | ✅ | ✅ | **Ana dönüşüm olayı** |
| **`JoinTraining`** | ✅ | ✅ | **Asıl değer olayı** |
| `JoinTeam` | ✅ | ✅ | |
| `CreateTraining` | — | ✅ | Arz tarafı |
| `CreateTeam` | — | ✅ | |

**Tekilleştirme kurulu:** Pixel ve CAPI aynı `event_id`'yi taşıyor, Meta çift saymıyor.

### Canlıda doğrulandı
- Pixel: `fbevents.js` + `signals/config` + `tr/?ev=PageView` → hepsi 200, `_fbp` çerezi oluşuyor
- CAPI: Test Events ekranında **"Kaydı Tamamlama · Sunucu · İşlendi"** görüldü
- Test gerçek `/api/auth/register` çağrısıyla yapıldı, sonra test kaydı silindi (132 kullanıcı korundu)

### Bilinçli kapalı bırakılanlar
- **Otomatik Gelişmiş Eşleştirme** — CAPI aynı veriyi kontrollü gönderiyor, otomatik form taraması gereksiz risk (Almanca destek var → AB kullanıcıları).

### Ölçülmeyen (bilerek ertelendi)
- `Search` — analytics.js'te hazır, çağrı yeri bağlanmadı. Kritik değil.
- `Purchase` — ücretli akış devreye girince eklenecek.
- **App install** — Meta SDK kurulu değil, mağaza güncellemesi gerektiriyor (Faz 4).

---

## 3. Kurulu kitleler — 5 adet

| Kitle | Kaynak | Büyüme | Not |
|---|---|---|---|
| `Benzer Hedef Kitle (1%) - ML - Tum kullanicilar` | Lookalike | Kaynağa bağlı | Soğuk kitle için ana koz |
| `WEB - Tum ziyaretciler 180g` | Pixel | **Otomatik** | Retargeting tabanı |
| `ML - Tum kullanicilar` | Müşteri listesi (131 hash) | **Statik** | Asıl işlevi **dışlama** |
| `FB - Sayfa etkilesim 365g` | Facebook sayfası | Otomatik | |
| `IG - Etkilesim 365g` | Instagram | Otomatik | |

### Kitlelerle ilgili bilinmesi gerekenler

- **Havuzlar dar.** IG ve FB etkileşim kitlelerinin ikisi de Meta'da "1000'den az" görünüyor. Retargeting yapılabilir ama ölçek soğuk kitleden gelecek.
- **Müşteri listesi minimum 100 kişi şartına takıldı.** Kurulamayan segmentler:
  - `hic-katilmayanlar` — 98 kişi (sınırın hemen altında, birkaç kayıtla açılır)
  - `aktif-katilimcilar` — 33 kişi
  - `etkinlik-olusturanlar` — 9 kişi
- **Müşteri listesi statik.** Yeni kayıtlar otomatik eklenmez. Ama gerek de kalmayabilir: CAPI açık olduğu için `CompleteRegistration` olayından **otomatik büyüyen** bir kitle kurulabilir ve bu daha güvenilirdir (e-posta eşleşmesine bağlı değil).

### Kampanya kurarken kritik: DIŞLAMA
- Uygulama indirme kampanyasından `ML - Tum kullanicilar` **dışlanmalı** — yoksa uygulamayı zaten telefonunda taşıyan insanlara indirme reklamı ödenir.
- Prospecting setlerinden dönüşenler dışlanmalı.

---

## 4. Kendi veritabanımızdaki ölçüm

`users` tablosuna eklenen kolonlar (hepsi çalışıyor, doğrulandı):

```
utm_source, utm_medium, utm_campaign, utm_content, utm_term,
fbclid, acquisition_platform, landing_page, referrer
```

İlk dokunuş mantığı: Kullanıcı reklamdan gelip bir hafta sonra doğrudan girip
kayıt olursa kaynak yine reklam sayılır.

**Neden önemli:** Meta "50 kayıt geldi, tanesi 40 ₺" der ama o 50 kişinin kaçının
gerçekten bir etkinliğe katıldığını söyleyemez. Gerçek edinme maliyeti bu
kolonlardan çıkar. Kampanya kurarken **her reklama UTM etiketi** verilmeli.

Önerilen UTM şablonu (Meta reklam düzeyinde "URL parametreleri" alanına):

```
utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

---

## 5. Mevcut kampanya durumu

| Kampanya | Hedef | Durum | Harcama | Sonuç |
|---|---|---|---|---|
| Yeni Uygulama tanıtımı | `APP_INSTALLS` | Duraklatıldı | 584,74 ₺ | CTR %0,41 — SDK yoktu, ölçülemedi |
| **Beğenme Reklamı** | `LINK_CLICKS` | **AKTİF** | 1.563,48 ₺ | 744 tıklama, CPC 2,10 ₺ |

Toplam ~2.148 ₺ harcandı, **hiçbiri dönüşüm sinyali üretmedi** (o dönemde ölçüm yoktu).

> **"Beğenme Reklamı"nı hemen kapatma.** Yeni dönüşüm kampanyası kurulup
> çalıştığı doğrulanana kadar açık kalsın; önce kapatmak arada boşluk yaratır.

---

## 6. Kampanya kurarken dikkat edilecekler

1. **Optimizasyon olayı: başlangıçta `CompleteRegistration`.**
   `JoinTraining` asıl değer olayı ama hacmi düşük. Meta'nın öğrenme aşamasından
   çıkması için **haftada ~50 dönüşüm** gerekiyor. Haftada 50 katılım eşiği
   aşıldığında `JoinTraining`'e geçilmeli.

2. **İlk 1-2 hafta dalgalı olacak.** Pixel'in dönüşüm geçmişi yok, Meta sıfırdan
   öğreniyor. Erken müdahale (bütçe/hedefleme değiştirme) öğrenmeyi sıfırlar.

3. **Önerilen yapı:**

| Katman | Optimizasyon | Kitle | Bütçe payı |
|---|---|---|---|
| Huni üstü | `CompleteRegistration` | Geniş + Lookalike %1 + ilgi alanı (ayrı setler) | %60–70 |
| Retargeting | `CompleteRegistration` | Site ziyaretçileri + IG/FB etkileşenler, dönüşenler hariç | %20–25 |
| Reaktivasyon | `JoinTraining` | Kayıtlı ama pasif | %10–15 |

4. **Kreatif:** En az 3 farklı açı, ayrı reklam olarak. Frekans 2'yi aşınca yenile.

5. **Mevcut harcama temposu:** günde ~250 ₺.

---

## 7. Teknik notlar (yeni sohbet için)

- **Deploy tek dosya mantığıyla:** `backend/backend-api.js` scp ile gidiyor,
  yeni backend dosyası eklenirse deploy edilmez.
- **`VITE_META_PIXEL_ID` build zamanında gömülüyor** — değişirse yeniden build şart.
- **CAPI log tuzağı:** `pm2 logs` geçmiş satırları da gösterir. "CAPI kapalı"
  uyarısı yanıltabilir; kesin kontrol `pm2 flush` + `pm2 restart` sonrası temiz log.
- **`META_TEST_EVENT_CODE` boş olmalı** (yayın modu). Doluyken olaylar Test Events'e
  düşer ve gerçek dönüşüm sayılmaz.
- **Facebook sayfası kitlesi kurarken** form varsayılan olarak "Vibe to Brands"
  sayfasını seçiyor — Muuvlink portföyünü elle seçmek gerekiyor.
- **Gerçek kullanıcı verisinde test yapılmaz.** Doğrulama için geçici kullanıcı
  açılır, akış denenir, sonra silinir.

---

## 8. Kalan işler

| # | İş | Durum |
|---|---|---|
| 1 | **Kampanya kurgusu** | ⬅ sıradaki iş |
| 2 | UTM şablonunun reklamlara eklenmesi | Kampanyayla birlikte |
| 3 | "Beğenme Reklamı"nın kapatılması | Yeni kampanya doğrulandıktan **sonra** |
| 4 | `CompleteRegistration` olayından otomatik büyüyen kitle | Veri birikince |
| 5 | Meta SDK + SKAdNetwork (app install ölçümü) | Faz 4, mağaza güncellemesi gerekir |
| 6 | Pixel ayarlarındaki "Otomatik sayfa/ürün bilgisi" açık — gözden geçirilmeli | Düşük öncelik |
| 7 | Haftalık performans raporu (Windsor üzerinden) | Kampanya yayına girince |

---

## 9. İlgili dosyalar

| Dosya | İçerik |
|---|---|
| `analytics.js` | Pixel yükleyici, olay haritası, kaynak yakalama |
| `backend/backend-api.js` | CAPI göndericisi (`sendMetaEvent`, `trackMeta`), SHA-256 normalizasyon |
| `sporla-bulusma.jsx` | Olay çağrıları (kayıt, katılma, PageView, ViewContent) |
| `index.html` | Domain doğrulama meta etiketi — **statik kalmalı** |
| `.env.production` | `VITE_META_PIXEL_ID` |
| `backend/.env` (sunucuda) | `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE` (boş) |

Detaylı yol haritası: https://claude.ai/code/artifact/9bcdc4ff-a9fd-4ec1-ae22-3e5e6b648ab8
