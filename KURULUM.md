# 🚀 SporlaConnect - Hızlı Kurulum Rehberi

Bu rehber ile SporlaConnect uygulamasını 30 dakikada çalıştırabilirsiniz!

## 📋 Gereksinimler

### Temel Gereksinimler
- ✅ Node.js 18+ ([İndir](https://nodejs.org/))
- ✅ PostgreSQL 14+ ([İndir](https://www.postgresql.org/download/))
- ✅ Git ([İndir](https://git-scm.com/))

### Mobil Geliştirme İçin (Opsiyonel)
- iOS: Xcode 14+ (macOS gerekli)
- Android: Android Studio + JDK 17

---

## ⚡ 5 Dakikada Başlat (Docker ile)

En hızlı yol! Sadece Docker yüklü olsun:

```bash
# 1. Projeyi klonla
git clone https://github.com/sporlaconnect/sporlaconnect.git
cd sporlaconnect

# 2. Environment dosyasını ayarla
cp .env.example .env
# .env dosyasını düzenleyin (en azından JWT_SECRET değiştirin)

# 3. Tüm servisleri başlat
docker-compose up -d

# ✅ HAZIR! 
# Web: http://localhost
# API: http://localhost:3000
# PgAdmin: http://localhost:5050
```

---

## 🔧 Manuel Kurulum (Adım Adım)

### 1️⃣ Backend Kurulumu

```bash
# Backend klasörüne git
cd backend

# Bağımlılıkları yükle
npm install

# Environment dosyasını oluştur
cp .env.example .env

# .env dosyasını düzenle
nano .env  # veya favori editörünüz
```

**Önemli .env ayarları:**
```env
JWT_SECRET=sizin-guclu-secret-anahtariniz-32-karakter
DB_USER=sporla_user
DB_PASSWORD=guclu-sifre-buraya
```

```bash
# PostgreSQL veritabanı oluştur
psql -U postgres
```

PostgreSQL'de:
```sql
CREATE DATABASE sporlaconnect;
CREATE USER sporla_user WITH PASSWORD 'guclu-sifre-buraya';
GRANT ALL PRIVILEGES ON DATABASE sporlaconnect TO sporla_user;
\q
```

```bash
# Sunucuyu başlat
npm start

# ✅ Backend çalışıyor: http://localhost:3000
```

Test edin:
```bash
curl http://localhost:3000/health
# Cevap: {"status":"OK","timestamp":"..."}
```

---

### 2️⃣ Web Uygulaması Kurulumu

Yeni terminal açın:

```bash
# Web klasörüne git
cd web

# React projesi oluştur (ilk kez)
npx create-react-app .

# Bağımlılıkları yükle
npm install lucide-react axios

# sporla-bulusma.jsx dosyasını src/App.js olarak kopyala
cp sporla-bulusma.jsx src/App.js

# Başlat
npm start

# ✅ Web açıldı: http://localhost:3000
```

---

### 3️⃣ Mobil Uygulama Kurulumu (Opsiyonel)

#### iOS (macOS gerekli)

```bash
# Yeni terminal
cd mobile

# React Native projesi oluştur (ilk kez)
npx react-native init SporlaConnect
cd SporlaConnect

# Bağımlılıkları yükle
npm install

# iOS pods yükle
cd ios
pod install
cd ..

# SporlaConnectMobile.js'i App.js olarak kopyala
cp ../SporlaConnectMobile.js App.js

# iOS simülatörde çalıştır
npx react-native run-ios

# ✅ iPhone simülatörde açıldı!
```

#### Android

```bash
# Android Studio'nun kurulu olduğundan emin olun
# Android emulator başlatın

# Android'de çalıştır
npx react-native run-android

# ✅ Android emülatörde açıldı!
```

---

## 🧪 Test Et

### Backend API Test

```bash
# Yeni kullanıcı kaydet
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Kullanıcı",
    "email": "test@test.com",
    "password": "test123"
  }'

# Giriş yap
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "test123"
  }'

# Token'ı kopyalayın ve kullanın
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer BURAYA_TOKEN_YAPISTIRIN"
```

### Web Uygulaması Test

1. Tarayıcıda http://localhost:3000 açın
2. Demo bilgileri: `ahmet@email.com` / `demo123`
3. Giriş yapın ve keşfedin!

---

## 🔍 Sorun Giderme

### Backend başlamıyor

```bash
# Port 3000 kullanımda mı?
lsof -i :3000
# Eğer kullanımdaysa:
kill -9 PID_NUMARASI

# Veya farklı port kullanın
PORT=3001 npm start
```

### PostgreSQL bağlantı hatası

```bash
# PostgreSQL çalışıyor mu?
# macOS:
brew services list

# Linux:
sudo systemctl status postgresql

# Windows:
# Services.msc açın, PostgreSQL servisini kontrol edin

# Çalışmıyorsa başlatın:
# macOS:
brew services start postgresql

# Linux:
sudo systemctl start postgresql
```

### Node modülleri hatası

```bash
# Temiz kurulum
rm -rf node_modules package-lock.json
npm install
```

### React Native hatası

```bash
# Cache temizle
npx react-native start --reset-cache

# Android:
cd android && ./gradlew clean && cd ..

# iOS:
cd ios && pod deintegrate && pod install && cd ..
```

---

## 📱 Gerçek Cihazda Test

### iOS (Fiziksel iPhone)

1. iPhone'u bilgisayara bağlayın
2. Xcode'da Apple Developer hesabınızı ekleyin
3. Xcode'da cihazınızı seçin ve Run

### Android (Fiziksel Telefon)

1. Telefonun ayarlarından "Developer Options" açın
2. "USB Debugging" aktif edin
3. Telefonu USB ile bağlayın
4. Terminal'de:

```bash
# Cihaz bağlı mı?
adb devices

# Çalıştır
npx react-native run-android
```

---

## 🎨 Özelleştirme

### Logo Değiştirme

**Web:**
```javascript
// src/App.js içinde
<Text>SporlaConnect</Text>
// yerine kendi logonuzu kullanın
```

**Mobil:**
- iOS: `ios/SporlaConnect/Images.xcassets/AppIcon.appiconset/`
- Android: `android/app/src/main/res/mipmap-*/`

### Renk Teması

```javascript
// Gradient renkleri
// Mevcut: #667eea ve #764ba2
// Değiştirmek için:
background: 'linear-gradient(135deg, #YENİ_RENK_1 0%, #YENİ_RENK_2 100%)'
```

### Backend URL

**Web:**
```javascript
// src/config.js oluşturun
export const API_URL = 'https://api.sporlaconnect.com';

// Axios instance oluşturun
import axios from 'axios';
export const api = axios.create({
  baseURL: API_URL
});
```

**Mobil:**
```javascript
// config.js
const API_URL = __DEV__ 
  ? 'http://localhost:3000'  // Development
  : 'https://api.sporlaconnect.com';  // Production
```

---

## 🚀 Production'a Almak

### 1. Backend Production

```bash
# Environment'ı production yap
NODE_ENV=production

# PM2 ile çalıştır (crash'lerde auto-restart)
npm install -g pm2
pm2 start backend-api.js --name sporlaconnect
pm2 startup
pm2 save

# Log'ları izle
pm2 logs sporlaconnect
```

### 2. Web Production Build

```bash
cd web
npm run build

# Build klasörü oluştu, bunu deploy edin
# Vercel:
vercel --prod

# Netlify:
netlify deploy --prod --dir=build
```

### 3. Mobil Production Build

**iOS (App Store):**
1. Xcode'da scheme'i "Release" yap
2. Product > Archive
3. Distribute to App Store

**Android (Google Play):**
```bash
cd android
./gradlew bundleRelease

# AAB dosyası şurada:
# android/app/build/outputs/bundle/release/app-release.aab
# Bunu Google Play Console'a yükleyin
```

---

## 📞 Yardım

Sorun mu yaşıyorsunuz?

1. **Dokümantasyonu okuyun:** `DOCUMENTATION.md`
2. **GitHub Issues:** [github.com/sporlaconnect/issues](https://github.com/sporlaconnect)
3. **Email:** support@sporlaconnect.com
4. **Discord:** [discord.gg/sporlaconnect](https://discord.gg/sporlaconnect)

---

## ✅ Kontrol Listesi

Kurulum tamamlandı mı?

- [ ] Backend çalışıyor (`http://localhost:3000/health`)
- [ ] PostgreSQL bağlantısı OK
- [ ] Web uygulaması açılıyor
- [ ] Kullanıcı kaydı yapılabiliyor
- [ ] Giriş yapılabiliyor
- [ ] Takım oluşturuluyor
- [ ] Antrenman eklenebiliyor
- [ ] Mobil uygulama çalışıyor (opsiyonel)

**Hepsi OK? Tebrikler! 🎉**

Şimdi uygulamayı geliştirmeye başlayabilirsiniz!

---

## 🎯 Sonraki Adımlar

1. **iyzico Entegrasyonu**
   - iyzico hesabı açın
   - API anahtarlarını .env'e ekleyin
   - Test ödeme yapın

2. **Firebase Push Notifications**
   - Firebase projesi oluşturun
   - FCM ayarlarını yapın
   - Test bildirim gönderin

3. **Google Maps API**
   - Google Cloud Console'da API key alın
   - Maps ve Geocoding API aktif edin
   - Harita özelliğini test edin

4. **SSL Sertifikası**
   - Domain alın
   - Let's Encrypt ile SSL ekleyin
   - HTTPS'e geçin

5. **Monitoring**
   - Sentry kurulumu
   - Google Analytics
   - Uptime monitoring

**Başarılar! 🚀**
