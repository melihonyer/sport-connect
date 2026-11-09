# Saat ve Strava başvuruları: taslak

Durum: 9 Kasım 2026, **taslak, hiçbiri gönderilmedi.** Melih metinleri onaylayınca formlar doldurulur;
son gönderim ve varsa onay kutuları Melih'te.

Kural (Training Agents'ta da böyleydi): metne yazılan her şey doğru olmalı. Entegrasyon henüz
yazılmadı, metinler bunu "planned / will" diye söylüyor. Sayılar 9 Kasım 2026 veritabanından:
311 aktif hesap, 38 takım, 160 etkinlik.

Training Agents'ın anahtarları ve uygulamaları burada KULLANILMAZ; her marka için Muuvlink'e ayrı kayıt açılır.

## Göndermeden önce

| # | İş | Neden | Kim |
|---|---|---|---|
| 1 | ~~İngilizce gizlilik sayfası + saat verisi bölümü~~ **yayında, 9 Kasım 2026:** `https://muuvlink.app/en/privacy/` (hukuki kontrolsüz, Melih'in kararı) | İnceleyen açıp bakıyor | Tamam |
| 2 | Garmin v9 sözleşmesini portaldan okumak | Kullanıcılar arası paylaşım maddesi doğrulanmadı; "paylaşım" ve "ısı haritası" cümleleri buna göre kalır ya da çıkar | Melih portalı açar |
| 3 | Saat verisi için ayrı açık rıza akışı | Nabız KVKK'da özel nitelikli veri; metinler bunu vaat ediyor, kodda olmalı | Kod işi, onaydan sonra |

Sıra önerisi: Polar hemen (onay yok) → 1. ve 2. iş → Wahoo, Garmin, Suunto, COROS → Strava en son
(çalışan ürün ve ekran görüntüsü istiyor).

## Ortak: ürün ve veri cümleleri

Dönüş adresleri (hepsi aynı kalıp, sonradan değiştirmek yeni inceleme demek):
`https://muuvlink.app/api/wearable/<marka>/callback`

**Ürün:**

> Muuvlink (https://muuvlink.app) is a community platform where people find sports partners, join local
> teams and attend group events: running, cycling, triathlon, padel and more. It is built by SALT KREATİF
> REKLAM TİCARET LİMİTED ŞİRKETİ, İzmir, Turkey, and is live on the web, the App Store and Google Play in
> seven languages. Today it has 311 members, 38 teams and 160 events.

**Veri ve amaç:**

> With a member's connection we would read completed workout summaries: sport, start time and start
> location, duration, distance, elevation, average heart rate. We use them for three things: confirming
> that the member attended the group event they joined, showing the member their own history, and, only
> if the member turns it on for a given workout, showing that workout to their teammates. Sharing is off
> by default. Heart rate is never shared with other members.

**Isı haritası (Garmin v9 okunana kadar Garmin metnine konmaz; Strava'ya hiç konmaz):**

> If a member opts in, we may add their routes to an anonymous aggregate map of popular routes. No person
> or single workout can be seen on it, the first and last part of each route is removed, and a segment
> appears only after several different members have used it.

**Rıza ve silme:**

> Reading wearable data needs a separate, explicit consent inside the app, distinct from registration. It
> is recorded with a timestamp and can be withdrawn at any time; withdrawing deletes the imported data and
> the stored token. Wearable data is never sold, never used for advertising and never sent to advertising
> or analytics services. We do not train AI models with it.

**Ölçek:**

> We expect a few hundred connected members in the first year.

---

## 1. Polar: self-servis

https://admin.polaraccesslink.com. Polar Flow hesabıyla girilir, client id + secret hemen çıkar.

**İSTEMCİ AÇILDI: 9 Kasım 2026** (melihonyer@gmail.com hesabında, Training Agents'tan ayrı; AccessLink
sözleşmesini Melih kabul etti). Yalnız Exercise data açık; gerçek bağlantı kodu henüz yazılmadı. Bilgi notu:
açıklamadaki rıza, silme ve paylaşım vaatleri kod yazılırken karşılanmak zorunda.
**Kod yayında, kapalı: 9 Kasım 2026** (`backend/wearable.js`, `WearablePanel.jsx`). Anahtarlar sunucuya girince yalnız admin görür.

| Alan | Değer |
|---|---|
| Application name | `Muuvlink` |
| Website | `https://muuvlink.app` |
| Redirect URL | `https://muuvlink.app/api/wearable/polar/callback` |
| Description | Ortak "Ürün" + "Veri ve amaç" |

Sözleşme: üyenin açık izni olmadan veri dışarı verilmez, Polar'a rakip hizmet yasak.

## 2. Wahoo: Production

**GÖNDERİLDİ: 9 Kasım 2026** (melihonyer@gmail.com portalı; API Agreement'ı Melih onayladı). Wahoo 5-7 gün içinde inceliyor,
durum Developer Portal'da "pending". Gönderilen açıklama paylaşımsız: "Sports community app. Reads a member's completed workout
summaries to confirm group event attendance and show the member their own history. Data is shown only to that member." İzinler
`user_read`, `workouts_read`, `offline_data`; webhook kapalı; logosuz.

**Sözleşme maddeleri (9 Kasım 2026, wahoo-api-agreement okundu), başvurudan önce:** token uygulama başına (§3), yani Muuvlink'e
ayrı başvuru şart. §7 API'den gelen coğrafi konumu toplamayı, önbelleklemeyi, saklamayı yasaklıyor: Wahoo'dan başlangıç
konumu saklanmaz, ısı haritasına Wahoo verisi girmez. §8 giriş yoluyla alınan veriyi o kullanıcıyla sınırlıyor; §7 ise
kullanıcının önceden açık onayıyla başkasına göstermeye izin veriyor. Takımla paylaşım riskli, başvuru metni paylaşımsız önerildi.
§6 gizlilik politikasında Wahoo'nun uygulama verisini kullanabileceğini söyleyen zorunlu cümle istiyor; `/en/privacy` ve Türkçe metne 9 Kasım 2026'da eklendi (Wahoo istisnasıyla birlikte).
Kullanıcı isteyince veri silinir; Wahoo isterse 48 saatte, güvenlik olayı 24 saatte bildirilir.

https://developers.wahooligan.com. Başvuru **Production** seçilir (Sandbox sonradan çevrilmiyor).

Form tuzakları (Training Agents'ta yaşandı): açıklama en çok 191 karakter ve aşılınca form sıfırlanıyor;
logo yüklenince 500 veriyor, logosuz gönderilir.

| Alan | Değer |
|---|---|
| Application name | `Muuvlink` |
| Description | `Sports community app. Reads a member's completed workout summaries to confirm group event attendance and show the member their own history. Data is shown only to that member.` |
| Website | `https://muuvlink.app` |
| Redirect URI | `https://muuvlink.app/api/wearable/wahoo/callback` |
| Confidential | Yes |
| Scopes | `user_read`, `workouts_read` (yazma izni istenmez; kalıcı erişim için formda `offline_data` varsa o da) |
| Privacy policy | `https://muuvlink.app/en/privacy/` |

## 3. Garmin: Connect Developer Program, Starter

**Destek e-postası GÖNDERİLDİ: 9 Kasım 2026** (info@saltajans.com → connect-support@developer.garmin.com; ikinci uygulama, takımla paylaşım, Training Agents reklamı soruldu). Cevap bekleniyor; cevapsız Garmin kodu ve paylaşımı açılmaz.

**Sözleşme okundu: 9 Kasım 2026, Rev H (portalda, gizli; metin repoya konmaz).** Özet:
- Sözleşme şirketin birden çok uygulamasını kapsıyor, anahtar ise web adresine bağlı. Apps sayfasında yeni uygulama düğmesi YOK: destekten istenir.
- Veri yalnız Muuvlink içinde, kişinin rızasına uygun gösterilir; başka uygulama ya da uç noktaya yönlendirilemez. Üyeler arası paylaşımı açıkça yasaklayan ya da izin veren madde yok, yazılı sorulmalı.
- Garmin verisi gösterilen her yeni ekran için 30 gün önceden örnek görselle bildirim + marka atfı.
- Garmin'le rekabet eden ürün reklamı Muuvlink'in hiçbir yerinde gösterilemez (5.2t): Training Agents reklamları açısından sorulmalı.
- Rıza kolay geri alınabilmeli; yapay zekâ eğitimi yasak; barındırma ve hizmet sağlayıcılar bildirilir; güvenlik olayı 24 saat.

Önce portalda (developerportal.garmin.com, melih@saltajans.com) ikinci uygulama açılabiliyor mu bakılır.
Starter "tek client ID" diye geçiyor; açılamıyorsa
https://www.garmin.com/en-US/forms/StarterGarminConnectDeveloperAccess/ ya da connect-support@developer.garmin.com.

| Alan | Değer |
|---|---|
| Company | `SALT KREATİF REKLAM TİCARET LİMİTED ŞİRKETİ` |
| Website | `https://muuvlink.app` |
| Privacy Policy URL | `https://muuvlink.app/en/privacy/` |
| Contact | `Melih Önyer`, `Digital Product Manager`, `melih@saltajans.com` |
| Address | `Çınarlı Mah. 1572 Sok. No:33, Konak`, `İzmir`, `35170`, Turkey |
| APIs | Activity API (Training API istenmez) |
| Users in 12 months | 100-1000 |

Overview (en çok 450 karakter):

> Muuvlink is a community platform for finding sports partners, teams and group events, live on the web, App Store and Google Play. With Garmin's OAuth flow we would receive completed activity summaries to confirm that a member attended the event they joined and to show them their own history. Showing an activity to teammates would be opt-in per activity and off by default. Heart rate is never shared with other members.

Business model (en çok 300 karakter):

> Free for members. Muuvlink shows some partner promotions. The Garmin connection is free. We do not sell, license or share Garmin data or API access, and Garmin data is never used for advertising or sent to advertising or analytics services.

Third-party services (en çok 300 karakter):

> Supabase (Ireland): database storage. Güzel Hosting (Türkiye): our application server. No advertising or analytics platform and no AI service processes Garmin data.

Dikkat: Muuvlink'te Meta pikseli ve Training Agents reklamı var. Saat verisinin bunlara gitmediği kodda da
garanti edilmeli. Yeni ekranlar için 30 gün önceden örnek görselle bildirim gerekiyor (TA sözleşmesi 6.6).

## 4. Suunto: Partner Program

**Soru GÖNDERİLDİ: 9 Kasım 2026** (info@saltajans.com → partners@suunto.com; mevcut sözleşmeye eklenebilir mi, ayrı başvuru mu). Cevap bekleniyor.

Form: https://survey.alchemer.eu/s3/90553908/PARTNER-Become-a-Suunto-Partner. Şirket zaten partner olduğu
için önce partners@suunto.com'a sorulur:

> Hello, SALT KREATİF is already a Suunto API partner with Training Agents. We would like to add a second
> product, Muuvlink (https://muuvlink.app), a community platform for sports teams and group events. Should
> we submit a new partner application, or can it be added under our existing API agreement? Our intended
> use: [Ortak "Veri ve amaç" + "Rıza ve silme"]. Thank you, Melih Önyer

Redirect: `https://muuvlink.app/api/wearable/suunto/callback`. Onay gelirse sözleşme gereği ürün ekranında
Suunto uyumluluğu + suunto.com bağlantısı zorunlu. Reklam ağına aktarım ve kullanıcı kimliği paylaşımı yasak.

## 5. COROS: api@coros.com

**Yeni e-posta GÖNDERİLMEZ** (9 Kasım 2026'da görüldü): COROS 28 Eylül'de TA başvurusuna cevap verdi: Partner API
yerleşik ticari platformlara öncelikli, başvuru formu ayrı (support.coros.com, "Submit an API Application"); MCP
bağlayıcı başvuru istemiyor, sporcu kendi hesabını bağlıyor, antrenman özetlerini okuyor. Muuvlink için önce MCP denenir.
Aşağıdaki metin Partner API formu gerekirse diye duruyor.

Konu: `API access request: Muuvlink (sports community platform, Turkey)`

> Hello, I would like to request read access to the COROS API for our application.
>
> Company: SALT KREATİF REKLAM TİCARET LİMİTED ŞİRKETİ, İzmir, Turkey.
>
> [Ortak "Ürün" + "Veri ve amaç" + "Rıza ve silme" + "Ölçek"]
>
> Melih Önyer, melih@saltajans.com

Yedek: COROS MCP (self-servis), ama Muuvlink'in ihtiyacı olan sunucu tarafı okumayı karşılayıp
karşılamadığı denenmedi.

## 6. Strava: en son

https://www.strava.com/settings/api. Yeni uygulama 1 kişilik başlıyor; 10 kişinin üstü için Developer
Program formu, Strava verisinin göründüğü yerlerin ekran görüntüleri ve "Connect with Strava" düğmesi
isteniyor; onay garanti değil. Yani çalışan ürün olmadan inceleme başvurusu yapılmaz.

| Alan | Değer |
|---|---|
| Application name | `Muuvlink` |
| Category | Training ya da Other (form seçeneklerine göre) |
| Website | `https://muuvlink.app` |
| Authorization Callback Domain | `muuvlink.app` |

İnceleme metni:

> Muuvlink is a community platform for finding sports partners, teams and group events. Members can connect
> Strava to confirm attendance at group events they joined and to see their own workouts in their profile.
> Strava data is shown only to the athlete who connected it. It is not used for feeds, leaderboards, maps of
> other athletes or AI, and it is deleted when the athlete disconnects.

Bu metin bilerek yalnız "kişinin kendisine" diyor. Sözleşmenin özet bölümü "açık rıza olmadan paylaşma" diyerek
rızalı paylaşıma kapı aralıyor; ama aynı özet veriyi yalnız o kullanıcıya göstermeyi şart koşuyor, maddelerde
rıza usulü yazmıyor ve rekabet yasağı duruyor. Rızalı paylaşım istenecekse Strava'ya yazılı sorulur, cevap
gelmeden yapılmaz. Strava'dan indirilen arşiv/GPX dosyasını kullanıcının kendisinin yüklemesi API verisi sayılmıyor
(Intervals.icu böyle uyguluyor), ayrı yol olarak değerlendirilebilir.
