# Muuvlink mail imzası: kurulum

`muuvlink-imza.html`: açık kart, üstte Muuvlink logosu, iletişim, Muuvlink mağaza düğmeleri; altında
"dost uygulama" kutusunda Training Agents (mağaza bağlantıları `utm_medium=imza`, `ct=muuvlink-imza`);
en altta Deep Teal şerit ve sosyal medya ikonları. SALT imzasının (K · Black Icon) yapısıyla aynı.

Görseller sitede duruyor, imza onları adresten çeker:
`https://muuvlink.app/icons/favicon.png`, `icons/mail/imza-wordmark.png` (logo-yatay.svg'den 3x PNG),
`icons/mail/storebtn-*-tr.png`, `partners/training-agents/mail/logo-black.png`, `icons/social-*.png`.
Bu dosyalar silinir ya da adı değişirse imza bozulur.

## Apple Mail (birebir)

1. Mail → Ayarlar → İmzalar → `+` → adını ver (ör. `Muuvlink`), içine herhangi bir harf yaz.
2. Mail'den tamamen çık (Cmd+Q).
3. Terminal:
   ```bash
   cd ~/Desktop/Melih/WORK/SALT/APPS/SPORT-CONNECT && python3 ~/Desktop/Melih/WORK/SALT/APPS/SALT_KREATİF/mail-imza/kur.py "Muuvlink" docs/mail-imza/muuvlink-imza.html
   ```
4. Mail'i aç, yeni bir mail açıp imzayı kontrol et.

`kur.py` SALT imzası için yazıldı; dosyadaki `<!-- SIGNATURE START -->` / `END` arasını Apple Mail'in imza
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
