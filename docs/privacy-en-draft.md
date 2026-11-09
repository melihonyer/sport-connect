# İngilizce gizlilik sayfası: taslak

Durum: **9 Kasım 2026'da yayınlandı** (`public/en/privacy/index.html` + `sporla-bulusma.jsx` `legalContent`). Hukuki kontrolden geçmedi; Melih "kontrolsüz yayınla" dedi. Köşeli parantezli Threshold cümlesi ve telefon numarası da yayına girdi. Bu dosya kayıt için duruyor; metnin kaynağı yayındaki iki dosya.

İngilizce metin, yayındaki Türkçe KVKK + Gizlilik metinlerinin karşılığıdır; yeni olan yalnız "Watch and sports
service data" bölümü (5). Türkçe metne eklenecek karşılığı en altta.

## Melih'in karar vermesi gerekenler

1. **Hukuki kontrol.** CLAUDE.md'ye göre yasal metin çevirisi hukuki kontrol ister. Yayından önce hukukçuya
   göstermek ya da kontrolsüz yayınlamak senin kararın. Özellikle sor: nabız verisi KVKK m.6 özel nitelikli veri,
   veriler İrlanda'da (Supabase) duruyor, yani yurt dışı aktarım (m.9) açısından açık rıza metni yeterli mi?
2. **Threshold mevcut metinlerde yok.** `backend/threshold.js` oturum açık üyelerin tam adını ve gezdiği sayfayı
   Threshold'a gönderiyor (21 Ekim kararı). Türkçe KVKK ve Gizlilik metinleri bundan söz etmiyor. Aşağıda köşeli
   parantezli cümleyi ekledim; bence hem İngilizceye hem Türkçeye girmeli.
3. **Makinece okunabilir kopya.** Metin "istersen JSON kopya veririz" diyor. Kodda dışa aktarma ucu yok; talep
   gelirse elle hazırlanır (30 gün içinde). Garmin'in formu bu hakkı arıyor.
4. **İletişim adresi.** Metinde `info@saltajans.com` kullandım (Play'de zaten herkese açık). Başka adres istersen değişir.
5. **Isı haritası metinde yok.** Yapılmamış şey yazılmaz; yapılırsa ayrı rızayla eklenir.
6. **Telefon numarası mevcut metinlerde eksik.** Kayıt `users.phone` yazıyor ve metin hash'li telefonun Meta'ya gittiğini
   söylüyor, ama "toplanan veriler" listelerinde telefon yok. İngilizceye ekledim; Türkçe KVKK madde 2 ve Gizlilik
   madde 1'e de eklenmeli.

## Metnin verdiği sözler (kod yazılırken zorunlu)

Bölüm 5'teki şu sözlerin hepsi saat bağlantısı kodunda karşılanmalı; biri eksikse özellik açılmaz:
ayrı açık rıza + zaman damgası · bağlantıyı kesince verinin, jetonun ve o veriden çıkan katılım teyidinin silinmesi ·
paylaşımın antrenman başına ve varsayılan kapalı olması · nabzın kimseye gösterilmemesi · Strava verisinin yalnız
sahibine gösterilmesi · Meta, Umami ve Threshold'a saat verisi gitmemesi.

Sayfa ilk yayında "kullanıma açılıyor" diyor, çünkü özellik henüz yok ve inceleyenler sayfayı açıp bakıyor. Özellik
açılınca o cümle kalkar.

---

# Privacy Policy

Last updated: [publication date]

This policy explains what personal data Muuvlink collects, how it is used and how it is protected. It is the
English version of our Turkish privacy notice. Muuvlink is for people aged 18 and over.

## 1. Who we are

SALT KREATİF REKLAM TİC. LTD. ŞTİ. ("we") is the data controller for Muuvlink.

Çınarlı Mahallesi 1572 Sokak No:33, 35170 Konak, İzmir, Türkiye\
Contact: the contact form at https://muuvlink.app/en/contact or info@saltajans.com

We process personal data under Turkey's Personal Data Protection Law No. 6698 (KVKK) and, where it applies to you,
the EU General Data Protection Regulation.

## 2. Information we collect

**Information you give us:** your name, email address, password and, if you provide one, phone number at
registration; the photo and bio you add to your profile.

**Platform usage:** events you create or join, team memberships and badges.

**Location:** used only when you allow it, and only to list nearby events. It is not permanently stored on our
servers. Workout start locations are covered separately in section 5.

**Technical data:** session information, advertising measurement cookies (Meta pixel) and cookie-free visit
statistics.

## 3. How we use it

We use this information to manage your account and session; to provide the platform (creating events, managing
teams, finding sports partners) and personalise event suggestions; to send notifications and reminder emails; to
keep the platform secure; to measure the results of our own advertising and decide who sees it; to count page visits
and which campaign they came from; and to meet legal obligations.

Your data is not sold and is not used to advertise other companies' products.

**Legal bases under KVKK:** performance of a contract (Art. 5/2-c); legal obligation (Art. 5/2-ç); legitimate
interest, including advertising measurement and cookie-free statistics (Art. 5/2-f); and explicit consent where
required (Art. 5/1 and Art. 6).

## 4. Third-party services

We use trusted providers for server hosting, storage, email and push notifications. They receive only the minimum
data needed to provide the service and may not use it for their own purposes. We may also share data with authorities
when the law requires it.

**Meta Platforms Ireland Ltd. (advertising measurement):** through the Meta pixel on the website and mobile app, the
pages viewed and the steps of registering and joining events or teams; at those moments, SHA-256 hashed email address,
phone number and name, IP address and browser information. This data is processed outside Turkey. Meta uses it to
measure advertising results and decide who sees ads.

**Umami Software, Inc. (Umami Cloud, data stored in the European Union):** cookie-free visit statistics on the
website: pages viewed, referring source, browser and device type, and country derived from IP address. No cookie is
written and IP addresses are not stored.

[**Threshold (our internal activity dashboard):** the full name of signed-in members, the page being viewed and
activity events, so we can see how the service is used. Email addresses, phone numbers and message contents are not
included.]

## 5. Watch and sports service data

*This feature is being rolled out.* It applies only if you connect a watch or sports service to Muuvlink: Polar,
Garmin, Wahoo, Suunto, COROS or Strava. Connecting is optional, and Muuvlink works fully without it.

**Consent.** Before anything is read we ask for your separate, explicit consent, distinct from registration. We
record when you gave it. Heart rate is health data, which KVKK treats as a special category.

**What we read.** Summaries of your completed workouts: sport, start time, start location, duration, distance,
elevation and average heart rate.

**Why.** To confirm that you attended a group event you joined, and to show you your own workout history.

**Who can see it.**
- By default, only you.
- If you turn it on for a specific workout, your teammates can see that workout. Sharing is off by default and
  applies only to the workout you choose.
- Your heart rate is never shown to other members.
- Data from Strava is only ever shown to you.

**Who processes it.** Only Güzel Hosting (application server, Türkiye) and Supabase (database, Ireland). By giving
consent you agree to this storage in Ireland.

Watch and sports service data is never sold, never used for advertising, never sent to Meta or to analytics services,
never shared with any other third party and never used to train AI models.

**The brand's own policy.** On the brand's side, its own privacy policy applies; for Garmin, see
https://www.garmin.com/privacy/connect.

**Withdrawing.** You can disconnect a service and withdraw consent at any time in Settings. We then delete the
workout data we imported from it, any attendance confirmation based on that data, and the stored access token.
Deleting your account has the same effect.

## 6. Security

Data is transmitted with industry-standard encryption (HTTPS/TLS). Passwords are hashed with bcrypt and never stored
in plain text. Our server infrastructure receives regular security updates.

## 7. Retention

We keep your personal data while your account is active and afterwards for the periods required by law. If you delete
your account, your data is anonymised or permanently deleted within 30 days.

## 8. Your rights

You can ask to access, correct or delete your personal data, to restrict its processing, to receive a copy in a
machine-readable format (JSON), and to object to decisions based on automated processing. You can withdraw consent at
any time. You can delete your account under Profile → Settings. For other requests, use the contact form or write to
info@saltajans.com. We respond within 30 days.

## 9. Changes

When this policy changes we notify users. The current version is always available on this page.

---

# Türkçe metinlere eklenecekler

Onaylanırsa `sporla-bulusma.jsx` `legalContent` içine; tarih de güncellenir.

**Gizlilik, Konum verisi satırının sonuna:** "Antrenmanların başlangıç konumu aşağıdaki Saat ve Spor Hizmeti Verileri
bölümüne tabidir."

**Gizlilik ve KVKK, yeni bölüm: Saat ve Spor Hizmeti Verileri**

> *Bu özellik kullanıma açılıyor.* Yalnızca Muuvlink'e bir saat ya da spor hizmeti (Polar, Garmin, Wahoo, Suunto,
> COROS, Strava) bağlarsan geçerlidir. Bağlamak isteğe bağlıdır; Muuvlink bağlamadan da eksiksiz çalışır.
>
> **Açık rıza:** Herhangi bir veri okunmadan önce, üyelikten ayrı olarak açık rızanı isteriz ve ne zaman verdiğini
> kaydederiz. Nabız, KVKK'da özel nitelikli kişisel veridir (Madde 6).
>
> **Okunan veriler:** Tamamladığın antrenmanların özeti: spor türü, başlangıç saati ve konumu, süre, mesafe, tırmanış
> ve ortalama nabız.
>
> **Amaç:** Katıldığın grup etkinliğine gerçekten gittiğini doğrulamak ve kendi antrenman geçmişini sana göstermek.
>
> **Kim görür:** Varsayılan olarak yalnızca sen. Bir antrenman için açarsan takım arkadaşların yalnızca o antrenmanı
> görür; paylaşım varsayılan olarak kapalıdır. Nabzın diğer üyelere hiçbir zaman gösterilmez. Strava'dan gelen veriler
> yalnızca sana gösterilir.
>
> **İşleyenler:** Yalnızca Güzel Hosting (uygulama sunucusu, Türkiye) ve Supabase (veritabanı, İrlanda). Rızanla bu
> verilerin İrlanda'da saklanmasını da kabul etmiş olursun. Bu veriler satılmaz, reklam için kullanılmaz, Meta'ya ya da
> analiz hizmetlerine gönderilmez, başka üçüncü kişiyle paylaşılmaz ve yapay zekâ modeli eğitmek için kullanılmaz.
>
> **Markanın kendi politikası:** Markanın tarafında o markanın gizlilik politikası geçerlidir.
>
> **Geri alma:** Ayarlar'dan bağlantıyı istediğin an kesip rızanı geri alabilirsin. Bu durumda o hizmetten aldığımız
> antrenman verilerini, bu veriye dayanan katılım teyidini ve erişim anahtarını sileriz. Hesabını silmek de aynı sonucu doğurur.

**KVKK ve Gizlilik, Üçüncü Taraf bölümüne (karar 2 onaylanırsa):**

> **Threshold (dahili etkinlik paneli):** Oturum açmış üyelerin adı soyadı, görüntülenen sayfa ve etkinlik kayıtları;
> hizmetin nasıl kullanıldığını görmek için. E-posta adresi, telefon numarası ve mesaj içeriği gönderilmez.
