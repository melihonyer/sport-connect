# SporlaConnect - Spor Topluluğu Platformu

## 📱 Proje Özeti

SporlaConnect, Türkiye'deki spor tutkunlarını bir araya getiren, antrenman grupları oluşturmalarına ve keşfetmelerine olanak tanıyan sosyal bir platformdur.

### 🎯 Temel Özellikler

- ✅ Kullanıcı kaydı ve girişi (JWT authentication)
- ✅ Takım oluşturma ve yönetimi
- ✅ Antrenman planlama ve katılım
- ✅ Harita entegrasyonu (konum bazlı arama)
- ✅ Özel/Açık grup ayarları
- ✅ Bildirim sistemi
- ✅ Abonelik/Ödeme sistemi (iyzico)
- ✅ Tüm spor dalları desteği
- ✅ Mobil ve web platform

---

## 🏗️ Mimari

```
sporlaconnect/
├── web/                    # React web uygulaması
│   └── sporla-bulusma.jsx
├── mobile/                 # React Native mobil uygulama
│   └── SporlaConnectMobile.js
├── backend/               # Node.js API
│   ├── backend-api.js
│   ├── package.json
│   └── .env
└── docs/                  # Dokümantasyon
    └── README.md
```

### Teknoloji Stack'i

**Frontend (Web):**
- React 18+
- Tailwind CSS (inline styles)
- Responsive design
- Progressive Web App ready

**Frontend (Mobile):**
- React Native
- React Navigation
- React Native Maps
- iOS & Android uyumlu

**Backend:**
- Node.js 18+
- Express.js
- PostgreSQL 14+
- JWT Authentication
- bcryptjs (şifre hashleme)

**Ödeme:**
- iyzico API entegrasyonu

**Deployment:**
- Frontend: Vercel/Netlify
- Backend: AWS EC2/DigitalOcean
- Database: AWS RDS/Heroku Postgres
- Mobile: App Store & Google Play

---

## 🚀 Kurulum

### 1. Backend Kurulum

```bash
# Proje klasörünü oluştur
mkdir sporlaconnect-backend
cd sporlaconnect-backend

# package.json oluştur
npm init -y

# Gerekli paketleri yükle
npm install express cors pg bcryptjs jsonwebtoken dotenv
npm install --save-dev nodemon

# .env dosyası oluştur
cat > .env << EOF
PORT=3000
NODE_ENV=development
JWT_SECRET=sporlaconnect-secret-key-change-in-production

DB_USER=sporla_user
DB_HOST=localhost
DB_NAME=sporlaconnect
DB_PASSWORD=your_secure_password
DB_PORT=5432
EOF

# Backend dosyasını kopyala
# backend-api.js dosyasını buraya yerleştir

# PostgreSQL veritabanı oluştur
psql -U postgres
CREATE DATABASE sporlaconnect;
CREATE USER sporla_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE sporlaconnect TO sporla_user;
\q

# Sunucuyu başlat
npm start
# veya development için:
npx nodemon backend-api.js
```

### 2. Web Uygulaması Kurulum

```bash
# React projesi oluştur
npx create-react-app sporlaconnect-web
cd sporlaconnect-web

# Gerekli paketleri yükle
npm install lucide-react

# src/App.js içeriğini sporla-bulusma.jsx ile değiştir

# Uygulamayı başlat
npm start
```

### 3. React Native Kurulum

```bash
# React Native projesi oluştur
npx react-native init SporlaConnect
cd SporlaConnect

# Gerekli paketleri yükle
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
npm install react-native-maps
npm install @react-native-async-storage/async-storage
npm install react-native-vector-icons

# iOS için
cd ios && pod install && cd ..

# App.js içeriğini SporlaConnectMobile.js ile değiştir

# Çalıştır
# iOS:
npx react-native run-ios

# Android:
npx react-native run-android
```

---

## 📊 Veritabanı Şeması

### Tablolar

**users**
- id (SERIAL PRIMARY KEY)
- name (VARCHAR)
- email (VARCHAR UNIQUE)
- password_hash (VARCHAR)
- phone (VARCHAR)
- avatar (VARCHAR)
- created_at, updated_at (TIMESTAMP)

**teams**
- id (SERIAL PRIMARY KEY)
- name (VARCHAR)
- sport (VARCHAR)
- description (TEXT)
- location (VARCHAR)
- is_private (BOOLEAN)
- owner_id (FK → users)
- avatar (VARCHAR)
- rating (DECIMAL)
- subscription_end (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)

**team_members**
- id (SERIAL PRIMARY KEY)
- team_id (FK → teams)
- user_id (FK → users)
- role (VARCHAR: owner/admin/member)
- joined_at (TIMESTAMP)

**trainings**
- id (SERIAL PRIMARY KEY)
- team_id (FK → teams)
- title (VARCHAR)
- description (TEXT)
- training_date (DATE)
- training_time (TIME)
- duration_minutes (INTEGER)
- location_name (VARCHAR)
- location_lat, location_lng (DECIMAL)
- location_address (TEXT)
- capacity (INTEGER)
- is_public (BOOLEAN)
- difficulty (VARCHAR)
- created_at, updated_at (TIMESTAMP)

**training_attendees**
- id (SERIAL PRIMARY KEY)
- training_id (FK → trainings)
- user_id (FK → users)
- status (VARCHAR: confirmed/cancelled/attended)
- joined_at (TIMESTAMP)

**subscriptions**
- id (SERIAL PRIMARY KEY)
- user_id (FK → users)
- team_id (FK → teams)
- subscription_type (VARCHAR)
- amount (DECIMAL)
- currency (VARCHAR)
- payment_method (VARCHAR)
- payment_status (VARCHAR)
- starts_at, expires_at (TIMESTAMP)
- auto_renew (BOOLEAN)

**notifications**
- id (SERIAL PRIMARY KEY)
- user_id (FK → users)
- title (VARCHAR)
- message (TEXT)
- notification_type (VARCHAR)
- reference_id (INTEGER)
- is_read (BOOLEAN)
- created_at (TIMESTAMP)

**team_reviews**
- id (SERIAL PRIMARY KEY)
- team_id (FK → teams)
- user_id (FK → users)
- rating (INTEGER 1-5)
- comment (TEXT)
- created_at (TIMESTAMP)

---

## 🔌 API Endpoints

### Authentication

```
POST   /api/auth/register
Body: { name, email, password, phone? }
Response: { user, token }

POST   /api/auth/login
Body: { email, password }
Response: { user, token }

GET    /api/auth/me
Headers: Authorization: Bearer <token>
Response: { user }
```

### Teams

```
POST   /api/teams
Headers: Authorization: Bearer <token>
Body: { name, sport, description?, location?, is_private?, avatar? }
Response: { team }

GET    /api/teams?sport=Koşu&search=İzmir
Headers: Authorization: Bearer <token>
Response: { teams: [] }

GET    /api/teams/:id
Headers: Authorization: Bearer <token>
Response: { team }

POST   /api/teams/:id/join
Headers: Authorization: Bearer <token>
Response: { message }
```

### Trainings

```
POST   /api/trainings
Headers: Authorization: Bearer <token>
Body: { 
  team_id, title, description?, training_date, training_time,
  duration_minutes?, location_name, location_lat?, location_lng?,
  location_address?, capacity?, is_public?, difficulty?
}
Response: { training }

GET    /api/trainings?team_id=1&date_from=2024-01-01&is_public=true
Headers: Authorization: Bearer <token>
Response: { trainings: [] }

GET    /api/trainings/:id
Headers: Authorization: Bearer <token>
Response: { training }

POST   /api/trainings/:id/join
Headers: Authorization: Bearer <token>
Response: { message }

GET    /api/trainings/nearby?lat=38.4192&lng=27.1287&radius=10
Headers: Authorization: Bearer <token>
Response: { trainings: [] }
```

### Notifications

```
GET    /api/notifications
Headers: Authorization: Bearer <token>
Response: { notifications: [] }

PUT    /api/notifications/:id/read
Headers: Authorization: Bearer <token>
Response: { message }
```

### Subscriptions

```
POST   /api/subscriptions
Headers: Authorization: Bearer <token>
Body: { team_id, subscription_type, amount, payment_method? }
Response: { subscription }
```

---

## 💳 Ödeme Sistemi (iyzico)

### Entegrasyon Adımları

1. **iyzico Hesabı Oluştur**
   - https://www.iyzico.com adresinden kayıt ol
   - API Key ve Secret Key al

2. **iyzico NPM Paketi Yükle**
```bash
npm install iyzipay
```

3. **iyzico Konfigürasyonu**
```javascript
const Iyzipay = require('iyzipay');

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  uri: 'https://sandbox-api.iyzipay.com' // Production: https://api.iyzipay.com
});
```

4. **Ödeme İsteği Örneği**
```javascript
app.post('/api/payment/create', authenticateToken, async (req, res) => {
  const { team_id, amount, card_info } = req.body;
  
  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: `TEAM_${team_id}_${Date.now()}`,
    price: amount.toString(),
    paidPrice: amount.toString(),
    currency: Iyzipay.CURRENCY.TRY,
    installment: '1',
    basketId: `BASKET_${team_id}`,
    paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
    paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
    paymentCard: {
      cardHolderName: card_info.holder_name,
      cardNumber: card_info.number,
      expireMonth: card_info.expire_month,
      expireYear: card_info.expire_year,
      cvc: card_info.cvc,
    },
    buyer: {
      id: req.user.id.toString(),
      name: req.user.name.split(' ')[0],
      surname: req.user.name.split(' ')[1] || '',
      email: req.user.email,
      identityNumber: '11111111111',
      registrationAddress: 'İzmir, Türkiye',
      city: 'İzmir',
      country: 'Turkey',
    },
    basketItems: [
      {
        id: team_id.toString(),
        name: 'Takım Aboneliği',
        category1: 'Spor',
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: amount.toString(),
      },
    ],
  };

  iyzipay.payment.create(request, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    
    if (result.status === 'success') {
      // Veritabanına kaydet
      // subscription oluştur
      res.json({ success: true, payment: result });
    } else {
      res.status(400).json({ error: result.errorMessage });
    }
  });
});
```

### Fiyatlandırma

**Takım Aboneliği:**
- Aylık: ₺49
- 6 Aylık: ₺249 (%15 indirim)
- Yıllık: ₺449 (%25 indirim)

**Üyelik (Takıma Katılım):**
- Aylık: ₺19
- 3 Aylık: ₺49
- Yıllık: ₺149

**İlk 30 Gün Ücretsiz Deneme**

---

## 📲 Push Notification

### Firebase Cloud Messaging (FCM) Kurulumu

```bash
npm install firebase-admin
```

```javascript
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

// Bildirim gönder
const sendNotification = async (userId, title, body) => {
  const userToken = await getUserFCMToken(userId);
  
  const message = {
    notification: {
      title,
      body,
    },
    token: userToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification sent:', response);
  } catch (error) {
    console.error('Notification error:', error);
  }
};
```

---

## 🚀 Deployment

### Backend (AWS EC2)

```bash
# EC2 instance'a bağlan
ssh -i your-key.pem ubuntu@your-ec2-ip

# Gerekli paketleri yükle
sudo apt update
sudo apt install nodejs npm postgresql nginx

# Proje dosyalarını kopyala
git clone your-repo
cd your-repo

# Bağımlılıkları yükle
npm install

# PM2 ile çalıştır
npm install -g pm2
pm2 start backend-api.js --name sporlaconnect-api
pm2 startup
pm2 save

# Nginx reverse proxy ayarla
sudo nano /etc/nginx/sites-available/sporlaconnect
```

Nginx config:
```nginx
server {
    listen 80;
    server_name api.sporlaconnect.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sporlaconnect /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL sertifikası (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.sporlaconnect.com
```

### Frontend (Vercel)

```bash
# Vercel CLI yükle
npm install -g vercel

# Deploy
cd sporlaconnect-web
vercel --prod
```

### Mobile (App Store & Google Play)

**iOS:**
```bash
cd ios
# Development build
npx react-native run-ios

# Production build
# Xcode'da Archive → Distribute → App Store Connect
```

**Android:**
```bash
cd android

# Release keystore oluştur
keytool -genkey -v -keystore sporlaconnect.keystore -alias sporlaconnect -keyalg RSA -keysize 2048 -validity 10000

# build.gradle'da signing config ayarla
# Release build
./gradlew assembleRelease

# AAB oluştur (Google Play için)
./gradlew bundleRelease
```

---

## 🧪 Test

### Backend Test

```bash
# Jest yükle
npm install --save-dev jest supertest

# Test dosyası oluştur: __tests__/api.test.js
```

```javascript
const request = require('supertest');
const app = require('../backend-api');

describe('Auth Endpoints', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@test.com',
        password: 'test123',
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('should login user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@test.com',
        password: 'test123',
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});
```

---

## 📈 Monitoring & Analytics

### Sentry (Error Tracking)

```bash
npm install @sentry/node
```

```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Google Analytics (Web)

```html
<!-- public/index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## 🔐 Güvenlik

### Best Practices

1. **Environment Variables**
   - Hassas bilgileri .env dosyasında sakla
   - .env dosyasını .gitignore'a ekle

2. **Rate Limiting**
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100 // IP başına max 100 istek
});

app.use('/api/', limiter);
```

3. **Helmet.js (Security Headers)**
```javascript
const helmet = require('helmet');
app.use(helmet());
```

4. **SQL Injection Prevention**
   - Parametreli sorgular kullan (✅ kullanılıyor)

5. **XSS Protection**
   - Input sanitization
   - Output encoding

---

## 📱 Özellik Roadmap

### Faz 1 (MVP - Tamamlandı) ✅
- Kullanıcı kaydı/girişi
- Takım oluşturma
- Antrenman planlama
- Temel harita entegrasyonu
- Bildirimler

### Faz 2 (3 ay) 🔄
- ✅ Ödeme sistemi (iyzico)
- ✅ Push notifications (FCM)
- Chat/mesajlaşma sistemi
- Profil fotoğrafı yükleme
- Sosyal medya paylaşımı

### Faz 3 (6 ay) 📋
- Video paylaşımı
- Antrenman istatistikleri
- Leaderboard/sıralama
- Hava durumu entegrasyonu
- Gamification (rozetler, başarılar)

### Faz 4 (12 ay) 🚀
- AI antrenör önerileri
- Wearable device entegrasyonu (Garmin, Fitbit)
- Kurumsal paket
- White-label çözümü

---

## 💰 Maliyet Tahmini

### Geliştirme (Outsource)
- Backend Developer: ₺80,000 - ₺120,000
- Frontend Developer: ₺70,000 - ₺100,000
- Mobile Developer: ₺90,000 - ₺130,000
- UI/UX Designer: ₺40,000 - ₺60,000
- QA/Test: ₺30,000 - ₺50,000
**Toplam: ₺310,000 - ₺460,000**

### Aylık İşletme Maliyetleri
- Server (AWS EC2): ₺500 - ₺1,500
- Database (RDS): ₺800 - ₺2,000
- CDN/Storage (S3): ₺200 - ₺800
- Push Notifications (FCM): Ücretsiz - ₺500
- iyzico komisyon: %2.9 + ₺0.30/işlem
- SMS bildirimleri: ₺0.05/SMS
- Domain + SSL: ₺500/yıl
**Toplam: ₺2,000 - ₺5,000/ay**

---

## 📞 Destek

- Email: support@sporlaconnect.com
- Dokümantasyon: https://docs.sporlaconnect.com
- GitHub: https://github.com/sporlaconnect

---

## 📄 Lisans

MIT License - Ticari kullanım için uygun

---

## 🎉 Başarılı Bir Lansman İçin

1. **Beta Test** (2-4 hafta)
   - 50-100 kullanıcı ile pilot
   - Geri bildirim toplama
   - Bug fixing

2. **Soft Launch** (1 ay)
   - Tek şehirde (İzmir) başlat
   - Influencer işbirlikleri
   - Sosyal medya kampanyası

3. **Ulusal Lansman**
   - PR kampanyası
   - App Store/Play Store optimizasyonu
   - Referans programı

4. **Büyüme Stratejisi**
   - Kullanıcı başına edinim maliyeti: ₺5-10
   - İlk 6 ayda 10,000 kullanıcı hedefi
   - Yıllık %200 büyüme

**Başarılar! 🚀**
