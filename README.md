# ⚡ SporlaConnect - Spor Topluluğu Platformu

Türkiye'deki spor tutkunlarını bir araya getiren, antrenman grupları oluşturmalarına ve keşfetmelerine olanak tanıyan tam özellikli sosyal platform.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![React Native](https://img.shields.io/badge/React_Native-0.73-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 Özellikler

### ✅ Kullanıcı Yönetimi
- Kayıt ol / Giriş yap (JWT authentication)
- Profil yönetimi
- Avatar sistemi

### ✅ Takım Yönetimi
- Takım oluşturma (tüm spor dalları)
- Özel/Açık grup seçenekleri
- Üye yönetimi (owner/admin/member rolleri)
- Takım değerlendirme sistemi

### ✅ Antrenman Planlama
- Antrenman oluşturma ve düzenleme
- Tarih, saat, konum belirleme
- Kapasite yönetimi
- Zorluk seviyesi (Kolay/Orta/Zor)
- Katılımcı takibi

### ✅ Harita & Konum
- Google Maps entegrasyonu
- Yakındaki antrenmanları bulma
- Konum bazlı arama (radius search)
- Yol tarifi

### ✅ Bildirim Sistemi
- Real-time bildirimler
- Push notifications (Firebase FCM)
- Email bildirimleri
- SMS bildirimleri (opsiyonel)

### ✅ Ödeme Sistemi
- iyzico entegrasyonu
- Takım abonelikleri
- Üyelik paketleri
- 30 gün ücretsiz deneme

### ✅ Platform Desteği
- 🌐 Web (React - Progressive Web App)
- 📱 iOS (React Native)
- 🤖 Android (React Native)

---

## 📁 Proje Yapısı

```
SporlaConnect/
├── 📱 Web Uygulaması
│   └── sporla-bulusma.jsx          # React web app
│
├── 📱 Mobil Uygulama
│   ├── SporlaConnectMobile.js      # React Native app
│   └── mobile-package.json         # Mobil dependencies
│
├── 🔧 Backend API
│   ├── backend-api.js              # Express.js API
│   ├── package.json                # Backend dependencies
│   └── .env.example                # Environment variables
│
├── 🐳 DevOps
│   ├── Dockerfile                  # Container image
│   └── docker-compose.yml          # Multi-container setup
│
└── 📚 Dokümantasyon
    ├── DOCUMENTATION.md            # Detaylı dokümantasyon
    ├── KURULUM.md                  # Kurulum rehberi
    └── API-TESTS.md                # API test koleksiyonu
```

---

## 🚀 Hızlı Başlangıç

### Docker ile (Önerilen)

```bash
# 1. Projeyi klonla
git clone https://github.com/sporlaconnect/sporlaconnect.git
cd sporlaconnect

# 2. Environment dosyasını ayarla
cp .env.example .env

# 3. Tüm servisleri başlat
docker-compose up -d

# ✅ HAZIR! 
# Web: http://localhost
# API: http://localhost:3000
# Database UI: http://localhost:5050
```

### Manuel Kurulum

Detaylı kurulum için [KURULUM.md](KURULUM.md) dosyasına bakın.

---

## 🛠️ Teknoloji Stack

### Frontend
- **Web:** React 18, Tailwind CSS
- **Mobile:** React Native 0.73
- **Navigation:** React Navigation
- **Maps:** React Native Maps / Google Maps
- **Icons:** Lucide React

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 14+
- **Cache:** Redis (opsiyonel)
- **Authentication:** JWT
- **Password:** bcryptjs

### DevOps & Tools
- **Container:** Docker & Docker Compose
- **Reverse Proxy:** Nginx
- **Monitoring:** Sentry
- **CI/CD:** GitHub Actions (yapılandırılacak)

### Üçüncü Parti Entegrasyonlar
- **Ödeme:** iyzico
- **Push Notifications:** Firebase Cloud Messaging
- **Maps:** Google Maps API
- **Email:** SendGrid
- **SMS:** Twilio (opsiyonel)
- **Storage:** AWS S3 (opsiyonel)

---

## 📊 Veritabanı

### Temel Tablolar
- `users` - Kullanıcı bilgileri
- `teams` - Takım bilgileri
- `team_members` - Takım üyelikleri
- `trainings` - Antrenman planları
- `training_attendees` - Antrenman katılımcıları
- `subscriptions` - Abonelik/Ödeme kayıtları
- `notifications` - Bildirimler
- `team_reviews` - Takım değerlendirmeleri

Detaylı şema için [DOCUMENTATION.md](DOCUMENTATION.md#-veritabanı-şeması) bakın.

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register    # Kayıt ol
POST   /api/auth/login       # Giriş yap
GET    /api/auth/me          # Profil bilgisi
```

### Teams
```
POST   /api/teams            # Takım oluştur
GET    /api/teams            # Takımları listele
GET    /api/teams/:id        # Takım detayı
POST   /api/teams/:id/join   # Takıma katıl
```

### Trainings
```
POST   /api/trainings                  # Antrenman oluştur
GET    /api/trainings                  # Antrenmanları listele
GET    /api/trainings/:id              # Antrenman detayı
POST   /api/trainings/:id/join         # Antrenmana katıl
GET    /api/trainings/nearby           # Yakınları bul
```

Tüm endpoint'ler için [API-TESTS.md](API-TESTS.md) bakın.

---

## 💰 Fiyatlandırma Modeli

### Takım Aboneliği
- **Aylık:** ₺49
- **6 Aylık:** ₺249 (%15 indirim)
- **Yıllık:** ₺449 (%25 indirim)

### Üyelik (Takıma Katılım)
- **Aylık:** ₺19
- **3 Aylık:** ₺49
- **Yıllık:** ₺149

**🎁 İlk 30 Gün Ücretsiz Deneme**

---

## 🧪 Test

### Backend Test
```bash
npm test
```

### API Test (cURL)
```bash
# Kullanıcı kaydı
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123"}'

# Giriş
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

Daha fazla test senaryosu için [API-TESTS.md](API-TESTS.md) bakın.

---

## 📈 Roadmap

### ✅ Faz 1 - MVP (Tamamlandı)
- Kullanıcı sistemi
- Takım yönetimi
- Antrenman planlama
- Temel harita
- Bildirimler

### 🔄 Faz 2 - Gelişmiş Özellikler (3 ay)
- Chat/Mesajlaşma
- Profil fotoğrafı yükleme
- Sosyal medya paylaşımı
- Video paylaşımı
- Hava durumu entegrasyonu

### 📋 Faz 3 - Gamification (6 ay)
- Rozetler ve başarılar
- Leaderboard
- Antrenman istatistikleri
- AI antrenör önerileri
- Wearable device entegrasyonu

### 🚀 Faz 4 - Kurumsal (12 ay)
- B2B paket
- White-label çözümü
- Admin dashboard
- Analytics

---

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen şu adımları takip edin:

1. Projeyi fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın

---

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 📞 İletişim

- **Website:** https://sporlaconnect.com
- **Email:** support@sporlaconnect.com
- **Twitter:** @sporlaconnect
- **Instagram:** @sporlaconnect
- **LinkedIn:** SporlaConnect

---

## 🙏 Teşekkürler

Bu projeyi mümkün kılan açık kaynak topluluğuna teşekkürler:
- React & React Native ekibi
- Node.js & Express.js topluluğu
- PostgreSQL geliştiricileri
- Tüm katkıda bulunanlar

---

## 🎉 Demo

### Web Demo
👉 [https://demo.sporlaconnect.com](https://demo.sporlaconnect.com)

**Demo Kullanıcı:**
- Email: `ahmet@email.com`
- Şifre: `demo123`

### Mobil Demo
📱 iOS: App Store'dan indir (yakında)
🤖 Android: Google Play'den indir (yakında)

---

## 📸 Ekran Görüntüleri

### Web Uygulaması
![Ana Sayfa](screenshots/home.png)
![Keşfet](screenshots/explore.png)
![Takım Detay](screenshots/team.png)

### Mobil Uygulama
![Giriş](screenshots/mobile-login.png)
![Ana Sayfa](screenshots/mobile-home.png)
![Harita](screenshots/mobile-map.png)

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=sporlaconnect/sporlaconnect&type=Date)](https://star-history.com/#sporlaconnect/sporlaconnect&Date)

---

**SporlaConnect ile spor yapma deneyiminizi sosyalleştirin! 🏃‍♂️⚡**

Made with ❤️ in Turkey
