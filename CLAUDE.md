# Muuvlink — çalışma kuralları

Bu dosya her oturumun başında otomatik okunur. Sohbetler birbirini görmez;
kalıcı olması gereken her karar buraya yazılır.

## Bu proje canlıda

muuvlink.app gerçek kullanıcılarla yayında. Her değişiklik dikkatli yapılır,
deploy'dan önce doğrulanır.

**Gerçek kullanıcı içeriğinde test yapılmaz.** Yorum, duvar gönderisi,
etkinliğe katılma/ayrılma, davet, mesaj — gerçek bir kullanıcının oluşturduğu
hiçbir kayda yazılmaz. "Sonra silerim" gerekçe değil: yazı düştüğü anda üyeler
görür ve bildirim gider.

- Gerçek kayıtlarda **sadece okuma**: GET istekleri, DB SELECT, sayfayı tarayıcıda görüntüleme.
- Yazma gerektiren doğrulama için: geçici kullanıcı aç → **o kullanıcının kendi**
  takımını/etkinliğini yarat → akışı orada dene → hepsini sil.
- Kendi verinde üretilemeyen bir akış varsa dur ve Melih'e sor.

## Dosya haritası

| Dosya | Ne |
|---|---|
| `sporla-bulusma.jsx` | Ana site (tek dosya, ~8500 satır) |
| `admin-panel.jsx` + `admin-main.jsx` | Yönetim paneli |
| `i18n.js` | tr/en/de metinleri — **ikisi de kullanır** |
| `tailwind.config.js`, `index.css` | Renk token'ları ve ortak stiller — **ikisi de kullanır** |
| `Tour.jsx`, `TrainingsMapView.jsx`, `ActivityChart.jsx`, `LocationPicker*.jsx` | Site bileşenleri |
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
rsync -az --delete-after --exclude uploads -e "ssh -i ~/.ssh/muuvlink" dist/ root@70.40.138.16:/var/www/muuvlink/dist/
```

Backend:

```bash
scp -i ~/.ssh/muuvlink backend/backend-api.js root@70.40.138.16:/var/www/muuvlink/backend/backend-api.js.staged
ssh -i ~/.ssh/muuvlink root@70.40.138.16 'cd /var/www/muuvlink/backend && mv backend-api.js.staged backend-api.js && node --check backend-api.js && pm2 restart muuvlink-api'
```

Deploy sonrası: `curl -s https://muuvlink.app/api/health` → `{"status":"ok","db":"ok"}`

Doğrulanmış bir değişiklikten sonra **deploy ve git push tekrar sorulmadan** yapılır.

## Mobil uygulama

Capacitor `server.url = https://muuvlink.app?src=app` → JS deploy ile OTA gider,
mağaza güncellemesi gerekmez. Native tarafı değiştiyse `npm run cap:sync`.
Tarayıcıda `?src=app` ile native kod yolu test edilebilir.

## Yazışma

Commit mesajları ve kullanıcıya cevaplar Türkçe.
