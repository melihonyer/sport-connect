# Muuvlink — çalışma kuralları

Bu dosya her oturumun başında otomatik okunur. Sohbetler birbirini görmez;
kalıcı olması gereken her karar buraya yazılır.

## Bu proje canlıda

muuvlink.app gerçek kullanıcılarla yayında. Her değişiklik dikkatli yapılır,
deploy'dan önce doğrulanır.

**Gerçek kullanıcı içeriğinde test yapılmaz.** Yorum, duvar gönderisi,
etkinliğe katılma/ayrılma, davet, mesaj — gerçek bir kullanıcının oluşturduğu
hiçbir kayda yazılmaz.

"Sonra silerim" gerekçe değil. Tek bir yorum **üç ayrı kanala** birden dağılır:
uygulama içi bildirim (silinebilir), cihaza push bildirimi (**geri alınamaz**) ve
e-posta (**geri alınamaz**). Veritabanı satırını silmek gönderilmiş push'u ve
e-postayı geri getirmez.

- Gerçek kayıtlarda **sadece okuma**: GET istekleri, DB SELECT, sayfayı tarayıcıda görüntüleme.
- Yazma gerektiren doğrulama için: geçici kullanıcı aç → **o kullanıcının kendi**
  takımını/etkinliğini yarat → akışı orada dene → hepsini sil.
- Test takımları **gizli** kurulur (`is_private = true`), test etkinlikleri de
  herkese açık listede görünmeyecek şekilde. Açık takım listesinde birkaç
  saniyeliğine bile `sandbox-…` görünmesin. Testin konusu herkese açık takım
  davranışıysa (ör. anonim ziyaretçi), takım yalnız o istek için açılır ve
  hemen gizliye döner.
- Kendi verinde üretilemeyen bir akış varsa dur ve Melih'e sor.

## Dosya haritası

| Dosya | Ne |
|---|---|
| `sporla-bulusma.jsx` | Ana site (tek dosya, ~8500 satır) |
| `admin-panel.jsx` + `admin-main.jsx` | Yönetim paneli |
| `i18n.js` | tr/en/de metinleri — **ikisi de kullanır**; SEO metinlerinin de TEK kaynağı |
| `scripts/seo-static.mjs` | `npm run build` öncesi çalışır: `index.html`'e statik SEO metni + şema + hreflang basar, `public/seo-content.json` üretir |
| `tailwind.config.js`, `index.css` | Renk token'ları ve ortak stiller — **ikisi de kullanır** |
| `Tour.jsx`, `TrainingsMapView.jsx`, `ActivityChart.jsx`, `LocationPicker*.jsx` | Site bileşenleri |
| `VectorBasemap.jsx` | Harita altlığı (OpenFreeMap Positron) — iki harita da bunu kullanır |
| `backend/backend-api.js` | Express API (tek dosya) |

## Paralel sohbet uyarısı

`vite build` **hem siteyi hem admin panelini aynı `dist/` klasörüne** üretir ve
deploy `rsync --delete-after dist/` ile bu klasörün tamamını gönderir.

Sonuç: **hangi oturum deploy ederse, kendi çalışma kopyasındaki site + admin
birlikte yayına gider.** Diğer oturumun commit'lenmemiş değişiklikleri ezilir.

Bu yüzden:
- Aynı anda iki oturumda kod yazıp deploy edilmez. Biri bitip commit + push
  edilmeden diğerine geçilmez.
- Yeni bir oturuma başlarken önce `git pull` / `git log` ile son durum görülür.
- Deploy öncesi `git status` temiz olmalı; başkasının yarım işi varsa deploy edilmez.
- Site ve admin ortak dosyalara (`i18n.js`, `tailwind.config.js`, `index.css`)
  dokunduğu için "admin ayrı, site ayrı" diye bölmek güvenli değildir.

## Arama motoru / yapay zeka görünürlüğü

Site React ile çiziliyor; ChatGPT, Perplexity ve Claude'un tarayıcıları
JavaScript ÇALIŞTIRMAZ. Bu yüzden metin sunucudan basılır.

- **Metin tek yerden yazılır: `i18n.js` (`faq` ve `seo` blokları).** JSX'e ya da
  `backend-api.js`'e elle SEO cümlesi yazılmaz. `scripts/seo-static.mjs` bunları
  hem `index.html`'e hem `public/seo-content.json`'a üretir; backend JSON'u
  `dist/` içinden okur, yani **frontend deploy'u içeriği de taşır.**
- **Bot yönlendirmesi nginx'te.** `map $http_user_agent $muuv_og_bot` sosyal ve
  yapay zeka botlarını backend'e düşürür; insanlar statik `index.html`'i
  nginx'ten alır. Node insan trafiğinin yolunda değildir.
- **`faq` bloğu tek:** ana sayfa SSS'si, iletişim sayfası SSS'si ve SEO metni aynı 6 soru
  (`faq.q1–q6`). 27 Ağustos'ta eklenen SEO bloğu eski 13 soruluk iletişim SSS'sini aynı adla
  ezmişti, sayfada "faq.q7" gibi ham anahtarlar çıkıyordu (8 Ekim 2026'da düzeltildi; eski
  metinler `faqLegacy`). i18n.js'e aynı adla ikinci bir üst anahtar YAZILMAZ — sessizce ezer.
- **Şema görünür metni işaretler, yerine geçmez.** Bir sayfada FAQPage şeması
  varsa aynı metin sayfada da olmalı; olmayan sayfalarda şema kaldırılır.
- **Çok dillilik yalnız dört sabit sayfada**: ana sayfa, etkinlikler, takımlar,
  iletişim. Türkçe kökte (`/takimlar`), diğer diller önekli (`/en/teams`,
  `/de/teams`, `/el/teams`; önekler Latin harfli). Yol tablosu İKİ yerde:
  `sporla-bulusma.jsx` `LOCALIZED_PAGE_PATHS` ve `backend-api.js`
  `SEO_LOCALIZED_PATHS` — **birebir aynı kalmalı** — ve nginx'teki liste
  sayfaları `location`'ı bu yolları içermeli (yoksa botlar SPA iskeletini
  alır). Detay sayfaları (`/takim/`, `/etkinlik/`) bilerek tek adrestedir:
  içeriği kullanıcı kendi dilinde yazıyor.
- **Adres dili, kayıtlı tercihi ezer.** `/en/events` açıldığında `muuvlang`
  ne olursa olsun İngilizce gösterilir; yoksa hreflang yalan söyler.
- **Zafiyet tarayıcılarına 404** (nginx, `sites-enabled/muuvlink`, Cache-Control
  bloğunun ÜSTÜNDE): nokta ile başlayan yollar, `*.php`, `wp-*`, `xmlrpc`,
  `phpmyadmin`, `cgi-bin`. **`/.well-known/` hariç tutulmalı** — iOS/Android
  uygulama bağlantı dosyaları orada; kural değişirse iki dosyanın 200 döndüğü
  kontrol edilir. Önceki hali yedekte: `/root/nginx-muuvlink.bak-20260921-143454`.
- **Google Search Console** `muuvlinkapp@gmail.com` hesabında, alan adı mülkü
  (`sc-domain:muuvlink.app`). melih@saltajans.com'un erişimi YOK. Claude in
  Chrome ile: hesap "MUUVLINK Browser" adlı Chrome'da açık; bağlantı isteği
  gönderilir, Melih o tarayıcıda Connect'e basar. Bağlantı başka Chrome'a
  kayabiliyor: her adımdan önce sekmede Search Console'un açık olduğunu kontrol
  et. Şifre girilmez; giriş gerekirse Melih yapar.
  - Site haritaları: `/sitemap.xml` (dizin) + `/api/sitemap.xml` (asıl liste).
  - Google IndexNow kullanmaz: yeni sayfa/dil eklenince Search Console'da
    URL denetimi → "Dizine eklenmesini iste" (günlük sınırlı; önce ana sayfalar).
  - 28 Eylül 2026: `/sitemap.xml` yeniden gönderildi; 4 dil ana sayfası ve
    dizinde olmayan alt sayfalar için dizine eklenme istendi. Kota dolduğu için
    `/it/squadre` ve `/it/contatti` kaldı (sonraki gün). Zaten dizinde olanlar:
    `/el/events`, `/es/equipos`, `/fr/evenements`.
  - **"Yönlendirmeli sayfa" raporu:** www/http ve eski `?takim=`/`?etkinlik=`
    adresleri kasıtlı yönlenir, zararsız. Ama detay adresi (`/takim/..-id`)
    görünürse gerçek hata: açılışta adres çubuğu değişiyor demektir. 28 Eylül
    2026'da bulundu — SPA arka plan listesine geçerken adresi `/en/teams`'e çekip
    geri alıyordu; Google bunu JS yönlendirmesi saydı. Düzeltme `detailBootRef`
    (sporla-bulusma.jsx): detay yüklenene kadar adres detayda kalır. Açılışta
    adres değiştiren yeni kod YAZILMAZ; kontrol: iframe'de
    `contentWindow.location.pathname`'i 50 ms'de bir izle, tek adres görmelisin.
    Melih'e anlatılan hali: "Takım/etkinlik linki açılınca adres satırı bir
    anlığına listeye dönüp geri geliyordu; Google bunu 'başka yere giden sayfa'
    sanıp o sayfaları aramaya eklemiyordu. Artık adres hiç değişmiyor."
    **29 Eylül 2026 ek düzeltme:** adres kalıyordu ama başlık ve canonical
    ~350 ms `/en/teams` / "Teams" oluyordu; URL denetimi detay sayfasının
    "kullanıcı tarafından beyan edilen standart URL"sini `/en/teams` gösterdi.
    Artık `bootWait` sürerken meta efekti hiç çalışmaz (erken `return`), sunucunun
    bastığı detay etiketleri kalır. Kontrolde iframe izine canonical ve
    `document.title`'ı da ekle: detayda canonical hiç liste adresi olmamalı.
  - **Takip (5–12 Ekim 2026):** Search Console › Sayfa dizine ekleme ›
    "Yönlendirmeli sayfa" satırını aç. Beklenen: `/takim/..`, `/etkinlik/..`
    adresleri listeden çıkmış, "Dizine eklenen" sayısı 66'dan artmış; satırda
    yalnız www/http ve `?takim=` adresleri kalmış. Detay adresi hâlâ varsa URL
    denetimiyle tek tek bak. Aynı gün `/it/squadre` ve `/it/contatti` için de
    dizine eklenme durumuna bak (28 Eylül'de kota yüzünden istenemedi).
    29 Eylül ara kontrol: rapor 21 Eylül verisinde (düzeltmeden önce), 15
    adresten 5'i detay (`etkinlik/..-164`, `-108`, `-110`, `takim/..-39`, `-20`);
    `/it/squadre` 29 Eylül'de tarandı, "Tarandı - dizinde değil"; kota yine
    doluydu — `/it/squadre` ve `/it/contatti` için istek 30 Eylül'den sonra
    tekrar denenir (kota son istekten 24 saat sonra açılıyor). `takim/spor-severler-39` silinmiş takım: 200 + ana sayfa canonical
    dönüyordu → aynı gün 404'e çevrildi (aşağıda).
    **5 Ekim 2026 takip sonucu:** "Sayfa dizine ekleme" raporu hâlâ 21 Eylül
    verisinde (Google güncellemedi). URL denetimi ise düzeltmenin tuttuğunu
    gösterdi: `etkinlik/..-164` (3 Ekim'de tarandı, beyan edilen standart URL
    artık kendi adresi), `-108`, `-110` ve `/it/squadre` DİZİNDE. `takim/
    roots-triathlon-20` hâlâ eski "Yönlendirmeli" kaydında (7 Eylül'den beri
    taranmadı) → dizine eklenme istendi. `/it/contatti` Google'ca bilinmiyordu
    (site haritasında var) → istendi. Sıradaki bakış: rapor güncellenince 15'lik
    listenin www/http/`?takim=` + 404'lere inmesi.
    **Otomatik hatırlatma/zamanlanmış görev KURULMAZ** — Melih kendisi
    "Search Console takibini yapalım" diye soracak.
- **Silinmiş takım/etkinlik adresi → botlara 404 + `noindex`** (29 Eylül 2026,
  Melih istedi). `backend-api.js` detay prerender'ında `notFound()`. Yalnız
  kayıt YOKSA; gizli takım / herkese açık olmayan etkinlik var olduğu için 200
  kalır. İnsanlar nginx'ten statik `index.html` alır (200) — Node insan
  yoluna sokulmaz. SPA'da API 404 dönünce "Etkinlik/Takım bulunamadı" sayfası
  açılır (`missingDetail` + `NotFoundPage`, `notFound.event*`/`team*`, 7 dil;
  Melih onayladı 29 Eylül 2026). Adres değişmez. Gizli takım (403) bu sayfayı
  GÖRMEZ: var olan kayda "bulunamadı" denmez, eski uyarı kalır. Kontrol:
  `curl -A 'Googlebot/2.1' -o /dev/null -w '%{http_code}' https://muuvlink.app/takim/x-<silinmiş id>`.
  Search Console'da bu adresler "Yönlendirmeli sayfa"dan "Bulunamadı (404)"
  satırına geçer — silinmiş sayfa için doğru yer, düzeltilecek hata değil;
  "Doğrula"ya basılmaz. Ekim takibinde `takim/spor-severler-39` orada beklenir.
- **404 sayfasının tasarımı** (`NotFoundPage`, 29 Eylül 2026, Melih'in verdiği
  şablondan): arkada çok silik dev "404" (Deep Teal, %6), üstte kısa sarı
  çizgi, büyük Deep Teal başlık, açıklama, arama kutusu + "Ara", altta "Geri"
  ve ana buton (mobilde ana buton üstte). Arama silinmiş etkinlikte
  `searchQuery` ile etkinlikler sayfasına, takımda `teamSearchSeedRef` ile
  takımlar sayfasına geçer (TeamsPage aramasını kendi state'inde tutuyor).
  "Geri" geçmiş yoksa ana sayfaya gider. `PageHost` içinde çizilir — yoksa
  üst-render arama kutusunu söküp yazılanı siler. Metinler mevcut anahtarlar
  (`common.search`, `common.back`, `teams.searchPlaceholder`) + etkinlikte `notFound.eventSearch` ("Etkinlik ara…", Melih'in metni); yeni metin Melih
  onayı ister. Denenip bırakılanlar: zıplayan monitör ikonu ("çok kötü
  basit"), Deep Teal kartlı sarı halkalı sürüm.
- **IndexNow anahtar dosyası `public/<key>.txt` silinmemeli** — her bildirimde
  okunuyor. Bing doğrulama etiketi `msvalidate.01` de silinmemeli.

## Diller

Diller: tr, en, de, el, es, fr, it (Eylül 2026'da Yunanca, İspanyolca, Fransızca
ve İtalyanca eklendi; Flemenkçe getirisi düşük görüldü, Arapça sağdan sola
düzen ister — ayrı proje).
Adres önekleri o dilin kelimeleriyle: `/es/eventos`, `/fr/evenements`,
`/it/eventi`; el için
Latin harfli `/el/events`. Dil seçicide dil KODU gösterilir (EL, GR değil —
GR ülke kodu; hreflang da `el` ister).

- **Tek kaynak `i18n.js` → `LANGUAGES`** (kod, görünen ad, tarih yerel ayarı).
  Dil seçiciler, tarih biçimi ve `seo-static.mjs` buradan okur; JSX'e dil
  listesi elle yazılmaz. **Sıra dil koduna göre alfabetik** (de, el, en, es, fr,
  it, tr — Melih, 5 Ekim 2026); yeni dil araya bu kuralla girer. Sıraya mantık
  bağlanmaz (`LANGUAGES[0]` varsayılan değildir; varsayılan Türkçe açıkça yazılı).
- tr/en/de metinleri `i18n.js`'te satır içinde. **Yeni diller
  `locales/<kod>.js`** dosyasında aynı anahtar ağacıyla yazılır, açılışta
  birleştirilir; eksik anahtar İngilizceye düşer. Yeni anahtar eklerken
  `locales/el.js`'e de yazılır. Yer tutucular (`{n}`, `{name}`) her dilde aynı.
- Satır içi küçük sözlükler (`{ tr, en, de, el }`) `pickLang(map, lang)` ile
  okunur; `map[lang] || map.en` yazılmaz.
- **Sayıyla birleşen metin parça parça kurulmaz**: `{n}` yer tutucusu
  kullanılır. "10 km km içinde" hatası buradan çıkmıştı.
- Yeni dil eklemek: `LANGUAGES` + `locales/<kod>.js` + iki yol tablosu + nginx
  liste sayfaları + backend `seoFormatDate` / iletişim konuları. Ardından
  IndexNow'a yeni adresler bildirilir.
- **Yazı tipi:** Montserrat'ta Yunan/Arap harfi yok. `index.css`'te Manrope'un
  Yunan alt kümesi `'Montserrat'` adı + unicode-range ile tanımlı
  (`public/fonts/manrope-greek.woff2`); her Montserrat kullanımı Yunan
  harfini kendiliğinden onunla çizer. Arapça gelirse aynı yöntem.
- Konum önerileri bazı dillerde ev ülkesini öne alır: el → GR, it → IT, tr/en/de → TR.
  **es ve fr'de ülke süzülmez** (birçok ülkede konuşuluyor); sıralamayı
  kullanıcının konumu belirler. Yeni dilde `HOME_COUNTRY` kararı verilir
  (`LocationPicker.jsx`).
- **İlk açılış dili:** adres (`/it/...`) > kayıtlı seçim (`muuvlang` / hesap
  dili) > telefon/tarayıcı dili > İngilizce (`detectLang`). Web'de dil seçici
  menüde (giriş yapmadan da). **Uygulamada** giriş öncesi menü yok: giriş/kayıt
  penceresinin sol üstünde dil açılır menüsü (`AuthModal` `onLangChange`, yalnız
  `isNative`; 5 Ekim 2026, Melih). Web penceresine konmadı.
- Yasal metinler (KVKK, gizlilik, koşullar) yalnız Türkçe; çevirisi hukuki
  kontrol ister, kod işi değil.
- **Hesap dili `users.lang`.** Yalnız kayıtta ve kullanıcı dili ELLE
  değiştirince (`PUT /api/users/me/lang`) yazılır. **Boş = Türkçe**: bu işten
  önceki hesapların hepsi boş, onlara giden hiçbir şey değişmedi. Girişte
  hesaptaki dil açılır; adres bir dil sayfasıysa (`/el/events`) adres kazanır.
- **E-posta ve bildirim metinleri `backend-api.js` → `MAIL`** (tr/en/de/el).
  `createNotif` ve `sendEmail` bir `build: (L) => ({...})` alır ve dili ALICININ
  hesabından kendileri bulur; gönderim noktasında dil sorgusu yazılmaz. Kayıtlı
  olmayan alıcıda (davet, iletişim) `fallbackLang: reqLang(req)`. Türkçe
  çıktının eskisiyle birebir aynı olduğu doğrulandı — Türkçe metinler
  `MAIL.tr`'de değiştirilmeden durmalı.
- **Sunucu hata/bilgi mesajları `SERVER_MSG`**: uç Türkçe yazar, yanıt çıkarken
  `X-Muuv-Lang` başlığına göre çevrilir. Site her API isteğine bu başlığı
  ekler (`sporla-bulusma.jsx` başındaki `window.fetch` sarmalı). Yeni
  kullanıcıya dönük mesaj → `SERVER_MSG`'e de ekle; yoksa Türkçe gider.
- Bildirim tekrar kontrolü BAŞLIĞA bakmaz (başlık alıcı diline göre değişir);
  tür + zaman penceresine bakar.

## Emoji kullanılmaz

Arayüzde, e-postada, bildirimde, hazır paylaşım mesajında **standart emoji
yok** (Melih'in kararı, Eylül 2026). Görsel gerekiyorsa modern SVG ikon
(lucide). E-postada Gmail SVG göstermediği için ikon deep teal PNG olarak
`public/icons/mail/`'e üretilir. Düz metinde (push, WhatsApp mesajı) ikon
konamaz; emoji sadece çıkarılır.

## Renk sistemi (kurumsal palet)

Token'lar `tailwind.config.js` içinde. Renk **tek noktadan** değişir, JSX'e
sabit hex yazılmaz.

| Rol | Değer | Nerede |
|---|---|---|
| 01 Deep Teal | `#114956` = `brand-600` | Büyük koyu yüzeyler, birincil aksiyon, bağlantı |
| 02 Yellow | `#F4F818` = `pop-400` | Tek vurgu: Ücretli rozeti, rol rozeti, Katıl, hover |
| 03 Carbon | `#1F2121` = `ink-900` | Metin — **büyük zemin olarak kullanılmaz** |
| 04 White Smoke | `#F4F4F4` = `smoke` | Sayfa zemini |
| Ana1 / Ana2 | `#00a499` / `#643e87` = `logo.teal` / `logo.purple` | Sadece küçük öğe: ikon, ince çizgi, nokta, sayı |

Kurallar:
- `brand` rampasının açık ucu (50–500) Ana1 tealinden türer, koyu ucu (600–950)
  Deep Teal'dir. Açık tonları koyudan türetme — griye kaçar.
- Degrade kullanılmaz; yüzeyler düz renktir.
- Birincil butonlar `data-btn="solid"` taşır → hover'da sarı zemin + deep teal metin.
  Sarı butonlar `data-btn="pop"` taşır → hover'da deep teal zemin + beyaz metin.
- Hover kuralları `@media (hover: hover) and (pointer: fine)` içindedir.
  Dokunmatikte hover "yapışkan" kalır, bu yüzden mobilde hiç uygulanmaz.
- **Genel hover** (8 Ekim 2026, Melih): kendi hover'ı olmayan her düğme ve düğme görünümlü
  bağlantı (`a[class*=rounded]`) üzerine gelince `opacity: .82` (index.css, yalnız sitede —
  `body.muuv-site`, main.jsx). Muaf: `hover:` sınıfı, `data-btn`, `.store-btn`, `.ta-chip`,
  harita kontrolleri ve hover'ı JS ile yapanlar — onlara `data-hover="own"` yazılır
  (onMouseEnter ile renk değiştiren yeni düğmeye de eklenir, yoksa iki etki üst üste biner).

## Doğrulama

- **Backend değişikliği statik okumayla onaylanmaz.** Gerçek istek atılır
  (`curl` veya sunucuda çalıştırılan kısa bir `.mjs`), sonuç görülür.
- Frontend değişikliği tarayıcıda açılıp ekran görüntüsüyle kontrol edilir;
  mobil (375px) ve masaüstü ayrı ayrı.
- Test edilemeyen bir şey varsa "çalışıyor" denmez, durum olduğu gibi söylenir.

## Deploy

Sunucudaki checkout `origin/main`'in gerisindedir; **orada `git pull` yapılmaz**,
dosya kopyalanarak deploy edilir.

Frontend (önce `npm run build`):

```bash
rsync -az --exclude uploads -e "ssh -i ~/.ssh/muuvlink" dist/ root@70.40.138.16:/var/www/muuvlink/dist/
```

**`--delete-after` KULLANMA.** Vite her derlemede parça adlarına yeni bir özet
ekler. Eski dosyalar silinirse, o an sitede AÇIK duran sekmeler bozulur: onların
`index.html`'i eski parça adlarını biliyor, dosya artık yok, kullanıcı haritayı
ya da grafiği açtığında "Bir şeyler ters gitti · Failed to fetch dynamically
imported module" görüyor. 7 Eylül 2026'da canlıda yaşandı.

İki taraflı korumamız var: eski dosyalar silinmediği için açık sekmeler
çalışmaya devam eder, ayrıca `lazyWithReload` bir parça 404 dönerse sayfayı
BİR kez yeniler (`sporla-bulusma.jsx`; sessionStorage bayrağı döngüyü keser).

`dist/assets/` zamanla birikir. Gerçekten silinmesi gereken bir dosya olursa
(ör. kaldırılan bir görsel) elle sil; toplu temizlik gerekirse yayından en az
bir hafta sonra ve kimse sitede değilken yapılır.

Backend:

```bash
scp -i ~/.ssh/muuvlink backend/backend-api.js root@70.40.138.16:/var/www/muuvlink/backend/backend-api.js.staged
ssh -i ~/.ssh/muuvlink root@70.40.138.16 'cd /var/www/muuvlink/backend && mv backend-api.js.staged backend-api.js && node --check backend-api.js && pm2 restart muuvlink-api'
```

Deploy sonrası: `curl -s https://muuvlink.app/api/health` → `{"status":"ok","db":"ok"}`

Doğrulanmış bir değişiklikten sonra **deploy ve git push tekrar sorulmadan** yapılır.

## UptimeRobot alarmı geldiğinde

Alarm "sunucu kapandı" demek değildir; "bir izleme noktası ulaşamadı" demektir.
Sağlayıcının DDoS filtresi IP bloğu saldırı altındayken bazı kaynaklardan gelen
paketleri düşürüyor — sunucu hizmet vermeye devam ederken tek bir kontrol noktası
zaman aşımı görebiliyor (bkz. MTU/MSS notu; 18 Eylül 2026'da yaşandı).

Önce bu üçü, sırayla:

1. **Alarmı veren IP nginx kaydında var mı?**
   `grep "<IP>" /var/log/nginx/access.log` — hiç satır yoksa istek sunucuya
   ULAŞMAMIŞ demektir, sorun bizim tarafımızda değil.
2. **Aynı dakikalarda başka noktalar ne almış?**
   UptimeRobot birden çok bölgeden bakar. Kesinti penceresinde başka IP'ler 200
   alıyorsa site ayaktaydı, mesele o tek noktaya giden yoldu.
3. **İç belirti var mı?** `pm2 list` (yeniden başlatma), `/api/health` durum
   kodları, `nginx/error.log`, `muuvlink-api-error.log`. Hepsi temizse rapor
   "kesinti yok, erişim sorunu" diye yazılır.

Yanıltıcı olan: `/var/log/nginx/access.log`'da dakikadaki istek sayısının aniden
düşmesi genelde kesinti değildir. Açık duran admin paneli 5 saniyede bir
`/api/admin/live` çağırıyor; sekme kapanınca trafik 12/dk'dan 1/dk'ya iner.
Menü rozetleri (`/api/admin/badges`) ayrıca 20 sn'de bir, sekme arka plandayken
60 sn'de bir gelir — panel açık unutulursa dakikada 1 istek sürer.

Bu alarmlar tekrar edecek: **sunucu taşıma yeniden önerilmez**, Melih VPS'te
kalmaya karar verdi. Yapılacak iş sadece ne olduğunu doğru raporlamak.

## Sayfa bileşenleri ve PageHost

Sayfa/modal bileşenlerinin çoğu ana bileşenin İÇİNDE tanımlı. Her üst-render'da
yeni kimlik alıyorlar, React alt ağacı söküp yeniden kuruyor: yerel state
sıfırlanıyor, imlecin altındaki düğme hover rengini kaybedip geri alıyor
(yanıp sönme), `<img>` src'leri yeniden yükleniyor.

`PageHost` kimliği SABİT bir kabuk: `<PageHost key="..." render={SayfaBileseni} />`.
Hook'lar bu sabit fiber'a bağlanır, closure'lar her render tazelenir.

- Yeni bir sayfayı PageHost'a alırken: içinde hook'lardan ÖNCE koşullu `return`
  olmamalı — koşul çağrı yerine taşınır.
- Detay sayfalarının key'i kaydın id'sini taşır (`training-detail-${id}`), yoksa
  başka kayda geçince form eski veriyle kalır.
- Uygulandı: team-detail, training-detail, create-training, Navigation, Footer,
  BottomNav. Kalanlar tek tek geçirilebilir; her birinde `useState` başlangıç
  değerinin "her render'da tazelensin" varsayımına dayanıp dayanmadığı kontrol edilir.

## Konum seçici

Konumu yazıp listeden SEÇMEYEN kullanıcı koordinatsız etkinlik yaratıyordu;
bunlar haritada ve "Yakınımda" aramasında hiç çıkmıyor.

- Tek kutu, yazdıkça öneri. Önerilerde ilçe/il ZORUNLU: aynı ad Türkiye'de
  onlarca yerde (Kuşçular → Urla, Tarsus, Nazilli…).
- Yazdıkça arama **Photon** ile (photon.komoot.io). Nominatim'in kullanım
  politikası yazdıkça aramayı yasaklıyor; Nominatim yalnız pin onayındaki TEK
  ters sorguda kalır.
- **Otomatik coğrafi çözümleme yapılmaz.** Denendi: "Kuscular" Tarsus'a,
  "Gelinkaya" Kütahya'ya düşüyor. Yanlış raptiye, raptiye olmamasından kötü.
- Takımın önceki konumları ÖNERİ olarak gösterilir, otomatik doldurulmaz
  (takım/konum her etkinlikte değişebilir kararı).
- Haritada elle pin bırakılırsa kullanıcının yazdığı ad korunur.

## Harita kümeleme

`supercluster` ile: uzakta sayı yazan daire, yaklaştıkça bölünür.

- `MAP_MAX_ZOOM` ile `CLUSTER_MAX_ZOOM` **aynı kalmalı** (18). Kümeleme daha
  erken biterse, koordinatı birebir aynı olan etkinlikler son yakınlaştırmalarda
  yine üst üste biner.
- Ayrılamayan kümeler (açılım zoom'u sınırı aşanlar) zoom 15'ten sonra
  kendiliğinden yelpazeye açılır; merkezde tam konum noktası kalır.
- **Sığdırma kutu boyut alınca yapılır** (`FitBoundsToTrainings`). Harita tembel
  yüklenirken kutu bir an 0 boyutlu; o anda sığdırınca yakınlık 13'te kalıyor,
  işaretçiler ekran dışına düşüyordu ("6 etkinlik" yazıyor, harita boş — 6 Ekim
  2026'da canlıda bulundu). Artık `ResizeObserver` kullanıcı haritayı elle
  oynatana kadar yeniden sığdırır; `ClusteredMarkers` görünümü açılışta ve
  `resize`'da haritadan okur (ilk `moveend`'i kaçırabiliyordu). Kontrol:
  Etkinlikler › Haritada Göster'de `.leaflet-marker-icon` sayısı > 0.
- Haritaya verilen liste öne çıkanları DA içermeli. Öne çıkanlar listede ayrı
  bölümde olduğu için `displayedTrainings`'ten çıkarılıyor; harita o listeyi
  alırsa öne çıkan etkinlikler haritadan düşer (Eylül 2026'da yaşandı).

## Silme ve kayıt

- Kullanıcı hesabı **yumuşak** silinir (`users.deleted_at`, 30 gün, sonra purge).
  Takım ve etkinlik **kalıcı** silinir; geri getirme yok.
- Silinen takım/etkinlik `activity_logs`'a `team_delete` / `training_delete`
  olarak yazılır (`logDeletion`), panelde "Silinenler" filtresinde görünür.
  `source_ref` benzersiz: aynı silme iki kez yazılmaz.
- Ayrılan hesaplar `account_departures`'ta; **kişisel veri tutulmaz** (isim/e-posta
  yok), purge'den sonra da sayılar kalır.
- **Ayrılma nedeni** (5 Ekim 2026, Melih): Hesabımı sil penceresinde isteğe bağlı
  tek seçim (`settings.leaveReasons.*`, 7 dil; kodlar backend `LEAVE_REASONS`:
  no_local, no_sport, too_many_notifs, hard_to_use, other_app, just_looking,
  other). Kod hem `users.leave_reason`'a hem `account_departures.reason`'a
  yazılır (sayı purge'den sonra kalır). "Diğer" metni (≤200) YALNIZ
  `users.leave_note`'ta — kişisel bilgi içerebilir, purge'de hesapla gider.
  Geri gelişte ikisi de temizlenir. Admin: "Ayrıldı" etiketinin altında neden
  (+ not); ayrılış kartında dağılım. 5 Ekim öncesi ayrılanlara sorulmadığı için
  onlarda neden satırı gösterilmez. Pencere `PageHost` içinde (yazılan silinmesin).
- Kayıt tutulmadan önce silinenler için uydurma satır üretilmez; numara
  boşluklarından yalnız SAYI olarak gösterilir.

## İsim ve yorum gizliliği

Kural **sunucuda** uygulanır; arayüz yalnız sunucunun söylediğini gösterir.
Ekranda gizlemek yetmez — tam isim API cevabında durursa tarayıcıdan görülür.

- **Takım sayfası** (`GET /api/teams/:id`): üye olmayana üye isimleri
  `maskPersonName` ile "M........ Ö........" (nokta sayısı sabit, uzunluk
  sızmasın), profil fotoğrafı `null`, takım duvarı hiç gönderilmez. Üye ve
  platform admini tam görür. id'ler kalır: arayüz "üye miyim" kararını id ile verir.
- **Etkinlik katılımcıları** (`GET /api/trainings/:id`): tam isim + fotoğraf
  takım üyesine, katılana, oluşturana ve admine; diğerleri maskeli.
- **Etkinlik yorumları**: `canSeeTrainingComments` tek kaynak — görme, yazma,
  beğenme ve yeni yorum BİLDİRİMİNİN alıcı listesi dördü de ona bakar. Takım üyeleri (katılmasa da), katılanlar (takım
  dışından olsa da), takımsız etkinlikte oluşturan, admin. Diğerlerine
  `comments: []` + `comments_hidden: true`.
- **Bireysel (takımsız) etkinlik** aynı kuralla çalışır; "takımın" yerini
  oluşturan tutar: oluşturan, katılanlar ve admin tam görür, diğerleri maskeli.
- **Profil fotoğrafı ismin kuralına bağlıdır:** tam ismi göremeyen kişiye
  fotoğraf da gitmez (`avatar` / `user_avatar` = `null`, arayüz baş harfe düşer).
  Takım logoları (`team_avatar`) kişiye ait değil, herkese açık kalır.
- Kişi fotoğrafı döndüren uçlar (Eylül 2026 taraması, hepsi kurala bağlı):
  | Uç | Takım dışındakine |
  |---|---|
  | `GET /api/teams/:id` üyeler | isim maskeli, fotoğraf yok |
  | `GET /api/teams/:id` duvar | hiç gönderilmez |
  | `POST /api/teams/:id/posts` | yalnız üye yazabilir |
  | `GET /api/trainings/:id` katılımcılar | isim maskeli, fotoğraf yok |
  | `GET /api/trainings/:id` yorumlar | hiç gönderilmez |
  | `GET /api/admin/users` | yalnız admin |

  Yeni bir sorguya `u.avatar` eklenirse bu tabloya da eklenir.
- Kontrol her istekte yeniden yapılır: takımdan/etkinlikten çıkan kişi bir
  sonraki yüklemede yine maskeli görür.
- Yeni bir uç isim, fotoğraf ya da beğenen listesi döndürüyorsa aynı kurala
  bağlanır. Beğeni uçları cevapta tam isimli `likers` taşır — yetki kontrolü şart.
- Yorum yazma testi alıcılara bildirim + e-posta tetikler: izinli yolu denerken
  **geçmiş bir etkinlik** kullan (yetkiyi geçer, 409 döner, hiçbir şey yazılmaz).

## Harekete geçiren e-postalar

`backend-api.js` → `ACT` (7 dil) + `activationEmail(kind, d, lang)`. Her birinde
seçilebilir link kutusu, WhatsApp/Telegram/e-posta butonları, hazır davet mesajı.

- **Yeni bir kullanıcı e-postası/metni → ÖNCE Melih'e örnek, onaydan SONRA
  canlı gönderim.** Şablonu yaz, `melihonyer@gmail.com`'a Türkçe örnek gönder
  (`[Örnek · …]` konulu), onay gelene kadar otomatik gönderimi AÇMA. 29 Eylül
  2026'da hoş geldin maili onaysız açıldı ve ilk turda iki gerçek kullanıcıya
  (Sinan Şahin, Ramazan Uzun) gitti; Melih "önce bana gösterseydin" dedi.
  Durdurmayı önerince "açık kalsın" dedi: hoş geldin maili Melih'in kararıyla
  AÇIK; içerik onayı sonradan örnek üzerinden (`[Örnek · Hoş geldin · TR]`),
  değişiklik gelirse Türkçe düzeltilip 6 dile yansıtılır.
- **Hoş geldin (`wu`)**: `welcomeEmail` + `WELCOME` (7 dil). İki seçenek kartı:
  "Kendi takımını kur" (`/takim-kur`) ve "Sana uygun bir takıma katıl" (dilin
  takımlar sayfası). Kayıt ucuna konmadı (kayıt Meta'ya dönüşüm gönderiyor);
  `activation_email_log`'da `ref_id` = kullanıcı id. es/it/fr metinleri
  cinsiyetsiz kurulu ("Te damos la bienvenida", "Ti diamo il benvenuto") —
  "Bienvenido/Benvenuto" yazılmaz.
- Kalıplar: `tc` takım kuruldu · `ec` etkinlik yayında · `lc` son çağrı (24 saat
  kala boş yer) · `te` ilk etkinlik (takım 3 gün etkinliksiz) · `gt`/`ge` mevcut
  takım/etkinliği büyüt (admin butonu).
- **`tc`/`ec`/`lc`/`te` otomatik** (Eylül 2026, Melih onayladı): `runActivationEmails`,
  15 dakikada bir. Uçların içinde DEĞİL — takım/etkinlik oluşturma Meta'ya dönüşüm
  gönderiyor; ayrı iş hem bunu ayırıyor hem test edilebiliyor (sandbox satırı DB'ye
  yazılır, iş onu da alır).
  | Tür | Ne zaman | Kime | Sınır |
  |---|---|---|---|
  | wu | kayıttan 2 dk–6 saat sonra (hoş geldin) | yeni kullanıcı | kişi başına 1 |
  | tc | takım kurulduktan 10 dk–6 saat sonra | sahibi | takım başına 1 |
  | ec | etkinlik açıldıktan 10 dk–6 saat sonra, başlamamışsa | takımın yöneticileri* | kişi başına 7 günde 1 |
  | lc | başlamasına 20–28 saat kala, kontenjan dolmamışsa | takımın yöneticileri* | etkinlik+kişi başına 1; o kişiye son 24 saatte bu etkinliğin ec'si gittiyse atlanır |
  \* `activationEventRecipients`: takım etkinliğinde etkinliği KİM açarsa açsın
  (MUUVLINK dahil) takımın owner/editor/coach/captain'ı; takımsızda oluşturan.
  Platform adminleri hiç almaz (2 Ekim 2026, Melih: MUUVLINK'in açtığı etkinliğin
  maili kendimize gidiyor, 7 gün sınırına takılıp liderlere hiç ulaşmıyordu).
  | te | takım 3–7 gün önce kurulmuş, hiç etkinliği yok | sahibi | takım başına 1 |
  Organizatör/ücretli etkinliğe gitmez. Pencereler bilerek dar: açılışta eski
  kayıtlara toplu gönderim olmadı, olmamalı. Kayıt `activation_email_log`
  (alıcı başına: tekil indeks `(kind, ref_id, user_id)`, gönderimden ÖNCE
  yazılır → iki kez gitmez; bir etkinliğin herhangi bir ec satırı varsa o
  etkinlik tekrar işlenmez).
  `gt`/`ge` admin butonuyla gider.
- Paylaşım butonlarındaki link `utm_source=share&utm_medium=whatsapp|telegram|email
  &utm_campaign=team_invite|event_invite` taşır; kayıt olanın kaynağı users.utm_*'da.
- **"Linki kopyala" butonu `public/kopyala/?l=<dil>&u=<link>` sayfasını açar**:
  e-posta programları panoya yazdırmıyor. `u` yalnız `https://muuvlink.app/`
  ile başlayabilir. Uygulaması kurulu telefonda link uygulamada açılır;
  `appUrlOpen`/`getLaunchUrl` `/kopyala` görünce bu sayfayı yükler — o satırlar
  silinirse buton uygulamada ana sayfaya düşer.
- Buton ikonları `public/icons/mail/*.png` (Gmail SVG göstermiyor). Renkler
  kurumsal: kopyala sarı, paylaş butonları beyaz + deep teal çerçeve, alt alta.
  Link kutusu kesik çizgili (Melih beğendi, kalsın). Başlığın üstünde türüne
  göre ikon: `icons/mail/k-<tür>.png`.
- Gizli takım/etkinlikte paylaşım bölümü çıkmaz (link üye olmayana açılmıyor),
  yerine e-postayla davet yönlendirmesi.
- **Admin "Mail" butonu** (Takımlar ve Etkinlikler listesi): yalnız takımın
  owner/captain/coach'ına (takımsız etkinlikte oluşturana). Geçmiş ve organizatör
  etkinliğine gitmez. Kayıt `grow_email_log`; son gönderim satırda görünür;
  24 saat içinde ikinci gönderim ayrıca onay ister.
- **Tercih `tips` ("Muuvlink'ten ipuçları")**: yalnız e-posta, **varsayılan AÇIK**
  (`EMAIL_DEFAULT_ON`). Kapatan atlanır; her mailin altında nasıl kapatılacağı yazar.
  **Melih'in kararı (28 Eylül 2026): yeni bildirim türleri varsayılan AÇIK gelir,
  isteyen kapatır.** 6 Ekim 2026: liderlere giden "Yeni takım üyesi"
  (`team_member`) ve "Yeni katılımcı" (`event_join`) e-postaları da varsayılan
  AÇIK (önceden herkeste kapalıydı, 223 kişiden açan yoktu). Yorum, duvar
  gönderisi, etkinlik hatırlatma e-postaları bilerek kapalı (sık gelir). İYS/onay riski konuşuldu, bilerek seçildi; tekrar sorulmaz.
  Yeni bir e-posta türü eklenirse `EMAIL_DEFAULT_ON`'a ve arayüzde
  `emailDefault: true` ile eklenir.
- E-posta çerçevesi dar ekrana uyar (`mv-*` sınıfları + media query). Sabit
  600px'e geri dönülmez; telefonda sağ taraf kesiliyordu.
- Örnek göndermek için gerçek alıcı yerine `delivered+etiket@resend.dev` kullan
  (Resend test adresi: kimseye gitmez, itibar bozmaz).
- **Metin kuralları (Melih'le tek tek revize edildi, Eylül 2026):**
  - Ton X ve Z kuşağına göre, "cringe" olmayacak: "Selam!" açılışı, ünlem,
    zorlama argo ("kanka", "efsane") yok. Hazır mesaj "sen de gel" diye biter.
  - **Sayı yazılmaz**: boş yer, üye, katılımcı adedi yok ("hâlâ boş yer var").
    Paylaşılan mesaj sonradan yanlış kalır; küçük takıma "2 üyeli" demek cesaret kırar.
  - Takım/etkinlik adına Türkçe ek getirilmez ("OpenWaterTurkey'i" değil
    "OpenWaterTurkey takımını"; "{ad} etkinliğini" değil "bir etkinlik açtım: {ad}").
    Ek adın sesine göre değişir; adında "etkinlik" geçen başlıkta tekrar da oluyordu.
  - Fikir/örnek listeleri branştan bağımsız (padel takımına "sabah koşusu" önerilmez).
  - Türkçe önce onaylanır, diğer 6 dil ona göre çevrilir (her dilde samimi "sen").
- Tasarım: kesik çizgili link kutusu + sarı "Linki kopyala" + alt alta ikonlu
  paylaş butonları (WhatsApp, Instagram hikâyesi, Telegram, e-posta). Başlığın
  üstünde türe göre ikon (`icons/mail/k-<tür>.png`), emoji yok.
- **"Bu mail kimlere gitti?"** `grow_email_log` yalnız SAYI tutar (kaç kişi,
  kaç atlandı), isim tutmaz. Kime gittiği Resend'den okunur:
  `GET https://api.resend.com/emails?limit=100` (to, subject, last_event;
  `delivered` = teslim). Otomatik maillerde kişi `activation_email_log.user_id`.
  Hepsi salt okuma; sonucu Melih'e isim + rol olarak raporla.
- **Elle tek gönderim** (ör. pencereyi kaçıran takım): sunucuda kısa bir betikle,
  `backend-api.js`'ten `activationEmail` alınır, alıcının `lang`'ı ve `tips`
  tercihi kontrol edilir, **önce** `activation_email_log`'a `(kind, ref_id,
  user_id)` yazılır (çakışırsa gönderme), sonra Resend'e gider, durum `sent`/`failed`
  güncellenir. Böylece otomatik iş aynı yere tekrar göndermez.
  28 Eylül 2026: "Sabah sporu sevenler" (id 55) açılıştan önce kurulduğu için
  6 saatlik pencereyi kaçırdı, hoş geldin maili Melih'in isteğiyle elle gitti.
- Admin listesinde (takım/etkinlik) otomatik giden son mail görünür
  (`last_auto_email`; gönderilen, atlanandan önce gösterilir). Atlananlar turuncu.

## Admin › Bildirimler (e-posta + uygulama bildirimi istatistiği)

Sekmenin adı "Bildirimler" (6 Ekim 2026, Melih); üstte "E-posta" / "Uygulama
bildirimi" seçimi, gün seçimi ortak.
- **Uygulama bildirimi:** `GET /api/admin/notifications?date=`. Oluşturulan,
  kişi, okunan `notifications`'tan (Mayıs 2026'dan beri; kullanıcının sildiği
  sayılmaz). Atlanan (uygulama tercihi kapalı) ve push sonucu `notif_log`'dan
  (6 Ekim 2026'dan beri): `createNotif` her çağrıda yazar; `sendPushToUser`
  cihaz başına `{ ok, fail }` döner. Tür adları admin `NOTIF_KIND_TR`.
- **E-posta** — aşağıdaki gibi.

5 Ekim 2026. `GET /api/admin/emails?date=YYYY-MM-DD` (gün İstanbul saatiyle).
- **Her gönderim `email_log`'a yazılır** (`sendEmail` sarmalı → `sendEmailRaw`):
  tür (`kind`; verilmezse `prefKey`), alıcı `user_id`, sonuç sent/skipped/
  failed/mocked, `resend_id`. **Adres saklanmaz.** Yeni bir gönderim noktası
  eklenirse `kind` verilir (ör. `act_<tür>`, `grow`, `password_reset`) ve
  admin'deki `EMAIL_KIND_TR`'ye Türkçe adı eklenir.
- Gönderilen/teslim/geri dönen/spam **Resend'den** (`last_event`), sayfa sayfa
  geriye okunur, 60 sn önbellek. **Resend hesabı Training Agents ile ORTAK** —
  yalnız `from` `@muuvlink.app` olanlar sayılır. Resend'den kime gitti raporu
  çıkarırken de bu süzgeç unutulmaz.
- Tür: önce `email_log` (resend_id eşleşmesi), yoksa Türkçe konu kalıbından
  (`SUBJECT_KIND`; `[Örnek` → "Örnek / test"). Başka dildeki eski konular "Diğer".
  Konu metni değişirse kalıp da güncellenir.
- Atlanan ikiye ayrılır (6 Ekim 2026, Melih): `skip_default` = tür varsayılan
  kapalı, kişi hiç açmamış; `skip_user` = kişi kendisi kapatmış (tercih kaydı
  `email:false`). `sendEmailRaw` `skipReason` döner. Eski `skipped` satırları o
  günkü tercihe göre ayrıldı. Atlanan ve hata yalnız `email_log`'da → 5 Ekim öncesi 0.
- Uygulama bildirimi varsayılan AÇIK, bu yüzden oradaki atlanan her zaman "kişi kapattı".
  E-posta ile uygulama bildirimi ayrı tercihlerdir: e-posta atlanınca uygulama
  bildirimi yine gider (Melih bir kez karıştırdı — ekran görüntüsü e-posta görünümüydü).
- Bugün açıksa dakikada bir tazelenir; tabloda satıra tıklayınca konular açılır.

## Instagram hikâye kartı

Takım ve etkinlik sayfasında "Hikâye" butonu (sporla-bulusma.jsx `StoryShareModal`,
`storyCardBlob`). Kart 1080×1920, Canvas 2D ile tarayıcıda çizilir; mobilde paylaş,
masaüstünde indir. Açılırken link panoya kopyalanır (Instagram link çıkartması için).
E-postadaki "Instagram hikâyesi hazırla" butonu detay adresine `?hikaye=1` ekler,
sayfa kartı kendisi açar (uygulamada `appUrlOpen` de bu parametreyi okur).

- **Fotoğraf branşa göre**: `public/story/<dosya>.jpg`, eşleme `STORY_BG_BY_SPORT`
  (anahtar `sports.*` ile aynı). Listede olmayan branş → `diger.jpg`. Fotoğraflar
  Canva ile üretildi (telifsiz, markasız kıyafet). **Sporcular alt yarıda olmalı**:
  logo ve başlık üst yarıda duruyor. Yeni branş fotoğrafı da bu kuralla üretilir.
- Koyu zeminde yazılar beyaz: `STORY_DARK_BG` (tenis, futbol, kürek).
- Logo dikey: üstte M amblemi (`icons/favicon.png`), altında yazı logosu.
- **Yazı tipi `MuuvStory`** (`public/fonts/montserrat-*.woff2`, `FontFace` ile).
  Sitenin Google Fonts Montserrat'ı canvas'ta görünmüyor (Times'a düşüyordu).
  Yunanca ayrı ailede (`MuuvStoryGr`): aynı adda tanımlanınca Chrome 800'lük
  Türkçe harfleri (Ş, İ, Ğ) yedek yazı tipine düşürüyor.
- Instagram'a dışarıdan içerik verilemez (WhatsApp'taki gibi paylaşım adresi yok);
  bu yüzden akış "görseli kaydet/paylaş + link kopyalandı".
- Kart metni GÖRENİN dilinde (`story.*` anahtarları, 7 dil): üst satır
  ("TAKIMIMIZA KATIL" / "ETKİNLİĞE KATIL"), tarih biçimi. Başlık kullanıcının
  yazdığı ad, `toLocaleUpperCase(dil)` ile büyük harf; uzunsa küçülür, sonra en
  çok 3 satıra bölünür. Alttaki "muuvlink.app" yarı saydam beyaz etikette
  (fotoğrafın altındaki sporcuların üstüne binince okunmuyordu).
- Pencere mobilde alt menünün (zIndex 999999) ÜSTÜNDE: `zIndex: 1000000`;
  önizleme yüksekliği ekrana göre (`46dvh`). Yoksa uygulamada buton kesiliyor.
- Kartı kontrol etmek: `dist`'i yerelde sunup (API canlıya salt GET ile), sayfayı
  `?hikaye=1` ile açıp önizleme görselini kaydetmek. Kod içine test kancası
  bırakılmaz.

## Süresi dolmuş oturum

Oturum anahtarı 30 gün geçerli. Süresi dolunca sunucu 403 `Invalid token` döner.
Eskiden anahtar telefonda kalıyordu: kişi misafir görünüyor ama "Katıl" eski
anahtarla gidip reddediliyor, ekranda "Invalid token" çıkıyordu (5 Ekim 2026,
Beyaz Triatlon Akademi'ye iki kez katılmaya çalışan biri).
- `sporla-bulusma.jsx` fetch sarmalı: Authorization'lı istek 403 + `Invalid token`
  dönerse anahtarı siler, `muuv:session-expired` olayı yayar (cevap çağırana
  dönmeden önce). Dinleyici kullanıcıyı misafire çevirir; açılıştaki `/auth/me`
  ise sessiz, bir işlem sırasındaysa giriş penceresi açılır. 4 sn boyunca hata
  uyarıları bastırılır (pencere zaten mesaj). Yeni metin yok.
- `authenticateToken`'ın 403 `Invalid token` metni bu kontrolün anahtarı —
  değiştirilirse sarmal da değişir.
- Admin "Canlı" akışı etiketi isteğin ADRESİNDEN yazar; sonuç `res.on('finish')`
  ile `failed` olarak eklenir: reddedilen işlem üstü çizili + "reddedildi ·
  oturum yok" / "olmadı · <kod>". Akışta "katıldı" görünce önce bu etikete bak.

## Push bildirimleri

Cihaz jetonu yalnız uygulama açılışında geliyordu; o an giriş yapılmamışsa jeton
sahipsiz kalıp kullanıcıya hiç bağlanmıyordu (Eylül 2026: 54 geçerli Android
cihaz sahipsizdi). Jeton `localStorage`'da saklanır; **giriş ve kayıt başarılı
olunca** kimlikle yeniden gönderilir, **çıkışta** kimliksiz gönderilip bağı
koparılır.

## Training Agents entegrasyonu

trainingagentsapp.com'da yapay zeka bir antrenman yazar; antrenör imzalı bir
bağlantıyla (`https://muuvlink.app/?ta=<jwt>`) buraya gelip saat, konum ve takım
seçerek yayınlar. Sunucular arası API YOK — yayınlayan zaten burada oturumu açık
olan kullanıcı.

- Uç: `POST /api/integrations/training-agents/verify` (kimlik istemez, DB'ye
  dokunmaz). HS256'ya sabit, `iss=training-agents` ve `exp` zorunlu. Takım, saat,
  konum, kontenjan ve ücret alanları payload'dan **kabul edilmez**.
- Ortak anahtar `TA_SHARED_SECRET`, iki projenin `.env`'inde. Repoya girmez.
- Jeton varışta bir kez doğrulanır, doğrulanmış içerik 24 saat saklanır; web'de
  adres çubuğundan, uygulamada `appUrlOpen` + `getLaunchUrl` ile yakalanır
  (AASA tüm adresleri uygulamaya yönlendiriyor, ikisi de gerekli).
- **Sözleşmenin tek kaynağı bu depoda değil:**
  `TT COACH APP/docs/muuvlink-integration.md`. İki taraf da oraya yazıyor.
- **Etkinlik oluşturma formunda takım seçimi** (30 Eylül 2026, Melih): listede
  takımlar önce, "Bireysel" en sonda. Takımı olan kullanıcıda varsayılan İLK
  takım (bireysel yayınlanan etkinlik sonradan takıma taşınamıyor). İstisnalar:
  takım sayfasından gelindiyse o takım; Training Agents taslağında takım boş
  kalır (aşağıdaki karar).
- Karar: antrenmanlar arasında takım/konum hatırlanmaz — değişebilen bir alanı
  önceden doldurmak, yanlış yerde etkinlik yayınlanmasına yol açar.

## Training Agents tanıtımı (8 Ekim 2026)

Training Agents lansmanı için Muuvlink'te "dost uygulama" alanları. Kaynak: Training
Agents'ın marka özeti (`muuvlink-tanitim-brief.md`, Melih verdi). Training Agents bu
sayfada **misafir**: logosu küçük, renginden yalnız ana mavi (`ta-blue` #2458ea, düğme +
marka adı), her bölümde tek CTA, fiyat/"2 hafta"/birebir koçluk/saat markası yok, "Ai".
- Kod: `TrainingAgentsPromo.jsx` (bileşenler + bağlantılar), metinler `i18n.js` `taPromo`
  + `locales/<kod>.js` (7 dil; tr/en özetten aynen, diğerleri Melih onaylı çeviri).
  Varlıklar `public/partners/training-agents/` (resmî rozetler + logolar; e-posta PNG'leri `mail/`).
- Alanlar: ana sayfa bandı (Haberler üstü; web ve uygulama ana sayfası) · alt bilgi şeridi · Etkinlikler listesinde tam
  satır kart (6. etkinlikten sonra, kişi başı günde bir — `ta_card_day`) · etkinlik
  sayfasında `source = 'training-agents'` ise "Bu antrenmanı Training Agents yazdı" ·
  yarış/organizatör etkinliğinin altında hazırlık kartı + rehber (`taRaceGuide`; takım
  etkinliğinde yalnız açık yarış kelimesiyle) · etkinlik oluşturmada antrenör ipucu
  (kapatılınca 30 gün) · profilde yaklaşan etkinlik yoksa boş durum · **her e-postanın**
  alt bilgisinde önce Muuvlink rozetleri, altında Training Agents şeridi (Melih).
- Bağlantılar: site `?utm_source=muuvlink&utm_medium=<bölüm>&utm_campaign=muuvlink-2026q4`;
  App Store `?ct=muuvlink-<bölüm>`, Play `&referrer=<kodlu utm>`. Bölümler: rozet,
  kesfet-karti, antrenor, bos-durum, etkinlik, footer, rehber + bizim eklediğimiz
  anasayfa, eposta. Uygulamada (isNative) CTA doğrudan cihazın mağazasına (iOS'ta dış
  siteye yönlendirme yok); web masaüstünde rozetler siteye, telefonda tek rozet mağazaya.
- **Ana sayfa bandı** (Melih): Training Agents mavisi zemin, düz sarı daire önünde dekupe
  triatlet (`athlete.webp`, Training Agents'ın mağaza görseli `mobile/store/marketing/assets/
  triathlete-side.png`). Sade tutulur (Melih: "çok renkli ve karmaşık" — renkli disiplin
  etiketleri kaldırıldı, disiplinler tek satır soluk yazı). Telefonda görsel üstte + TEK düğme
  (doğrudan cihazın mağazasına, rozet yok); masaüstünde düğme + iki rozet (siteye).
  Sarı (`ta-yellow`) yalnız zemin/grafik, yazı rengi değil.
- **Tek tip mağaza düğmesi** (`StoreButtons.jsx`, Melih: "hepsi bir standart olsun"): Muuvlink
  ve Training Agents'ın App Store/Google Play düğmeleri aynı kalıp — siyah, 48 px, rounded-xl,
  üst satır `download.badgeTop`. Resmî rozet görselleri kullanılmıyor (yanındaki düğmeyle aynı
  boy/çerçevede durmuyordu). E-postadaki PNG'ler bu tasarımdan üretildi (`icons/mail/storebtn-*`);
  tasarım değişirse PNG'ler de yeniden üretilir. Tanıtım düğmesi de aynı boy (h-12).
  Hover yalnız imleçli cihazda (`.store-btn`, `data-btn="ta"|"ta-light"`, `.ta-chip`).
- `trainings.source`: yalnız Training Agents taslağından yayınlanan etkinlikte yazılır
  (arayüz `taCurrent` varken gönderir, backend yalnız bu değeri kabul eder). 8 Ekim
  öncesi yayınlananlar işaretsiz.

## Açık sayfa tazeliği

- **Veri:** sitede açık detay/liste 60 sn'de bir + öne gelişte sessizce tazelenir
  (`refreshOpenPageRef`); bildirimler SSE ile anlık. Admin'de Genel Bakış,
  Kullanıcılar, Etkinlikler, Takımlar, Mesajlar, Şikayetler 30 sn'de bir ve
  sekmeye dönünce sessizce tazelenir (`refreshTab`: yükleniyor ekranı yok,
  arama/filtre korunur). Form içeren sekmeler (Banner, Haber, Galeri,
  Organizasyon) tazelenmez. "Canlı" 5 sn.
- **Admin menüsü gruplu + canlı rozetler** (6 Ekim 2026, Melih): Takip ·
  Gelen Kutusu · Topluluk · Dış Etkinlikler · Site İçeriği. Gruplar açılır/
  kapanır (seçim `admin_nav_collapsed_v1`); kapalı grubun rozetleri başlıkta
  toplanır. Başlık/sekme ayrımı: başlık koyu karbon büyük harf + ok, sekmeler
  girintili ve ince dikey çizgiyle bağlı (önce ikisi de griydi, karışıyordu —
  Melih). Başlıkta `font-extrabold` kullanılmaz: Montserrat 800 panelde
  yüklenmiyor, Türkçe harfler farklı kalınlıkta çıkıyor; 600 kullanılır. Rozetler tek uçtan
  (`GET /api/admin/badges`, 20 sn; arka planda 60 sn). Türler: kırmızı = aksiyon
  bekliyor (okunmamış mesaj, çözülmemiş şikayet); sarı `+n` = son bakıştan beri
  yeni üye/takım/etkinlik (bakanın kendi oluşturdukları sayılmaz; son bakış
  tarayıcıda `admin_seen_v1`, sunucu saatiyle; ilk açılışta geçmiş "yeni"
  sayılmaz); gri = Yarış Keşfi bekleyen kuyruk; yeşil nokta = şu an sitede
  (Canlı sekmesiyle aynı sayım: `liveOnlineIds` + `liveActiveGuestCount`).
  Açık sekmeye yeni kayıt gelince liste 30 sn beklemeden tazelenir. Tarayıcı
  sekmesi başlığında aksiyon sayısı: "(3) Muuvlink - Admin Panel". Mobilde
  hamburger üstünde kırmızı nokta. Yeni bir sekmeye rozet eklenecekse sayım bu
  uca eklenir; sekme verisinden hesaplanmaz (açılmayan sekmenin sayısı olmaz —
  eski Şikayetler rozetinin hatası buydu).
- **Yeni sürüm (`FreshBuildWatcher.jsx`, site + admin, 30 Eylül 2026):** Training
  Agents'taki bileşenin karşılığı. Öne gelişte (visibilitychange, focus, online,
  Capacitor appStateChange) sunucudaki HTML'in (`/index.html`, admin'de `/admin`)
  ana betik adını açık sayfanınkiyle karşılaştırır; farklıysa aynı adrese gidip
  yeniler. Backend ucu yok.
  - Yarım iş (`hasUnsavedWork` / admin `[data-admin-form]`, yazılmış alan) varsa
    yenilemez, şerit çıkar: sitede üstte menünün altında "Yeni sürüm hazır ·
    Yenile" (`common.newBuild*`, 7 dil, Melih onayladı), admin'de altta.
    Yeni bir form sayfası/pencere eklenirse `hasUnsavedWork`'e de eklenir.
  - Yeni betik `HEAD` ile 200 + `javascript` içerik türü dönmeden yenilemez
    (rsync HTML'i önce yazarsa yarım deploy'a gitmesin; SPA yedeği HTML döner).
  - Aynı sürüm için bir kez kendiliğinden yeniler (`muuv_reloaded_for`,
    sessionStorage); tekrar eskide kalırsa şerit gösterir, döngüye girmez.
  - **Takım/etkinlik kurulunca şerit ÇIKMAZ.** Yeni kayıt listelere veri
    tazelemesiyle gelir (admin ≤30 sn, site ≤60 sn). Şerit yalnız yeni KOD
    yayınlandığında ve kullanıcı o an yarım bir iş yapıyorsa görünür; yarım iş
    yoksa sayfa sessizce yenilenir (Melih'e böyle anlatıldı).
  - Test: `dist/index.html`'deki `main-*.js` adını bir kopyasıyla değiştirip
    sayfada `focus` tetikle (panel gizliyse `visibilityState` taklit edilir).
    Test dosyaları deploy'dan önce `npm run build` ile temizlenir.

## Etkinlik görüntülenme sayısı

`training_views (training_id, viewer, viewed_at)`, kişi başına bir satır (1 Ekim 2026).
- **Kim görür:** takım/bireysel etkinlikte yalnız yöneten (`can_manage`) ve
  platform admini — Düzenle/Sil'in yanında "{n} kişi görüntüledi". **Organizasyon
  etkinliğinde (is_organizer_event / is_paid) herkes** — organizatör kutusunda;
  0 iken gösterilmez. Admin › Etkinlikler "Katılımcı · Bakan" sütununda.
  Sayıyı sunucu yalnız görmesi gerekene gönderir (`view_count`).
- **Ne sayılır:** `GET /api/trainings/:id`. Yöneten, oluşturan, admin ve botlar
  sayılmaz. Anahtar: girişliyse `u:<id>`, değilse tarayıcı kimliği
  `v:<muuv_vid>` (site her API isteğine `X-Muuv-Visitor` ekler), o da yoksa
  `h:` + sha256(IP|UA) — ham IP saklanmaz. `h:` biçimi DEĞİŞTİRİLMEZ: aynı
  cihazın geçmişten gelen `h:` satırı varsa yeni anahtarla tekrar sayılmaz.
- **Geçmiş:** 17 Eylül–1 Ekim 2026 arası 167 görüntülenme nginx kayıtlarından
  dolduruldu (admin paneli kullanan cihazlar ve etkinliği düzenleyen cihazlar
  hariç). Kayıtlarda kim giriş yapmış yazmadığı için geçmiş sayılarda yönetenin
  kendi bakışı kalmış olabilir. nginx 14 gün tutar; daha eskisi yok.
- **Test ederken** yerel önizleme canlı API'ye gider ve SAYILIR: testten sonra
  önizleme sekmesinin `localStorage.muuv_vid`'iyle `DELETE FROM training_views
  WHERE viewer = 'v:<vid>'`.

## Mobil uygulama

Capacitor `server.url = https://muuvlink.app?src=app` → JS deploy ile OTA gider,
mağaza güncellemesi gerekmez. Native tarafı değiştiyse `npm run cap:sync`.
Tarayıcıda `?src=app` ile native kod yolu test edilebilir.

## Yazışma

Commit mesajları ve kullanıcıya cevaplar Türkçe.
