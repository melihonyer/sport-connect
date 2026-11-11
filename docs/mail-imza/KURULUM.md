# Muuvlink mail imzası: kurulum

`muuvlink-imza.html`: açık kart, üstte Muuvlink logosu, iletişim, Muuvlink mağaza düğmeleri; altında
gri kutuda Training Agents: logo, tek cümle, mağaza düğmeleri (`utm_medium=imza`, `ct=muuvlink-imza`) ve
kendi sosyal medya hesapları (Training Agents mavisi kare + beyaz ikon, `TT COACH APP/src/lib/socials.ts`
ile aynı liste). Muuvlink'in sosyal medya ikonları kendi mağaza düğmelerinin yanında (Melih, 11 Kasım 2026);
en altta Deep Teal şeritte slogan ve muuvlink.app. SALT imzasının (K · Black Icon)
yapısıyla aynı. "Dost uygulama" etiketi bilerek yok (Melih, 11 Kasım 2026).

Görseller sitede duruyor, imza onları adresten çeker:
`https://muuvlink.app/icons/favicon.png`, `icons/mail/imza-wordmark.png` (logo-yatay.svg'den 3x PNG),
`icons/mail/storebtn-*-tr.png`, `partners/training-agents/mail/logo-black.png`, `icons/social-*.png`;
Training Agents ikonları kendi sitesinden: `https://trainingagentsapp.com/email/icons/<instagram|tiktok|youtube|x|facebook>.png`.
Muuvlink'in sade ikonları (Deep Teal kare + beyaz çizim): `icons/mail/imza-<instagram|tiktok|youtube|facebook|threads>.png`;
ilk dördü Training Agents'ın e-posta ikonlarının kopyası, Threads `icons/social-threads.png`'den ayıklandı.
Bu dosyalar silinir ya da adı değişirse imza bozulur.

## Apple Mail (birebir)

1. Mail → Ayarlar → İmzalar → `+` → adını ver (ör. `Muuvlink`), içine herhangi bir harf yaz.
2. Mail'den tamamen çık (Cmd+Q).
3. Terminal:
   ```bash
   python3 ~/Desktop/Melih/WORK/SALT/APPS/SALT_KREATİF/mail-imza/kur.py "Muuvlink" ~/Desktop/Melih/WORK/SALT/APPS/SPORT-CONNECT/docs/mail-imza/muuvlink-imza.html
   ```
4. Mail'i aç, yeni bir mail açıp imzayı kontrol et.

`kur.py` SALT imzası için yazıldı ve dosya yolunu KENDİ klasörüne göre çözer: imza dosyası tam yolla verilir (göreli yol
"No such file" verir; 11 Kasım 2026). Dosyayı ASCII olarak okur, Türkçe harfler HTML karşılığıyla yazılı olmalı. dosyadaki `<!-- SIGNATURE START -->` / `END` arasını Apple Mail'in imza
dosyasına yazar, eskisini `yedek/`e alır.

## Gmail (kopyala-yapıştır)

1. `muuvlink-imza.html` dosyasını Chrome'da aç → imzanın tamamını seç (Cmd+A) → kopyala (Cmd+C).
2. Gmail → Ayarlar (dişli) → Tüm ayarları göster → Genel → İmza → Yeni oluştur → yapıştır → en altta
   "Değişiklikleri kaydet".
3. Gmail köşe yuvarlamalarını ve bazı boşlukları sadeleştirebilir; içerik ve bağlantılar kalır.

## Değiştirmek

- E-posta adresi: dosyada `muuvlinkapp@gmail.com` iki yerde (`mailto:` ve görünen metin).
- Kişi adı eklemek: logonun altındaki "Spor arkadaşı bul…" satırının üstüne bir satır.
- Training Agents metni e-posta alt bilgisindeki şeritle aynı (`backend-api.js` `taStrip`); o değişirse burası da değişir.
- Sosyal medya hesabı eklenirse: Muuvlink için `MUUV_SOCIAL` (CLAUDE.md'deki dört yer) ve bu dosya; Training Agents için `socials.ts` ve bu dosya.
