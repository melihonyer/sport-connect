# SporlaConnect API Test Koleksiyonu
# Bu dosyayı Postman veya Insomnia'ya import edebilirsiniz

## Base URL
BASE_URL=http://localhost:3000

---

## 1. Authentication Tests

### 1.1 Register New User
POST {{BASE_URL}}/api/auth/register
Content-Type: application/json

{
  "name": "Ahmet Yılmaz",
  "email": "ahmet@test.com",
  "password": "test12345",
  "phone": "+905551234567"
}

Expected Response (201):
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "name": "Ahmet Yılmaz",
    "email": "ahmet@test.com",
    "avatar": "👤"
  },
  "token": "eyJhbGc..."
}

---

### 1.2 Login User
POST {{BASE_URL}}/api/auth/login
Content-Type: application/json

{
  "email": "ahmet@test.com",
  "password": "test12345"
}

Expected Response (200):
{
  "message": "Login successful",
  "user": { ... },
  "token": "eyJhbGc..."
}

# Token'ı sonraki istekler için saklayın!
@token = {{response.body.token}}

---

### 1.3 Get Current User
GET {{BASE_URL}}/api/auth/me
Authorization: Bearer {{token}}

Expected Response (200):
{
  "user": {
    "id": 1,
    "name": "Ahmet Yılmaz",
    "email": "ahmet@test.com",
    ...
  }
}

---

## 2. Teams Tests

### 2.1 Create Team
POST {{BASE_URL}}/api/teams
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "İzmir Sabah Koşucuları",
  "sport": "Koşu",
  "description": "Her sabah 06:30'da Kordon'da koşuyoruz!",
  "location": "İzmir Kordon",
  "is_private": false,
  "avatar": "🏃‍♂️"
}

Expected Response (201):
{
  "message": "Team created successfully",
  "team": {
    "id": 1,
    "name": "İzmir Sabah Koşucuları",
    ...
  }
}

@teamId = {{response.body.team.id}}

---

### 2.2 Get All Teams
GET {{BASE_URL}}/api/teams
Authorization: Bearer {{token}}

Expected Response (200):
{
  "teams": [
    {
      "id": 1,
      "name": "İzmir Sabah Koşucuları",
      "sport": "Koşu",
      "owner_name": "Ahmet Yılmaz",
      "member_count": 1,
      ...
    }
  ]
}

---

### 2.3 Get All Teams (with filters)
GET {{BASE_URL}}/api/teams?sport=Koşu&search=İzmir
Authorization: Bearer {{token}}

---

### 2.4 Get Team by ID
GET {{BASE_URL}}/api/teams/{{teamId}}
Authorization: Bearer {{token}}

Expected Response (200):
{
  "team": {
    "id": 1,
    "name": "İzmir Sabah Koşucuları",
    "members": [
      {
        "id": 1,
        "name": "Ahmet Yılmaz",
        "role": "owner"
      }
    ],
    ...
  }
}

---

### 2.5 Join Team
POST {{BASE_URL}}/api/teams/{{teamId}}/join
Authorization: Bearer {{token}}

Expected Response (200):
{
  "message": "Successfully joined the team"
}

---

## 3. Trainings Tests

### 3.1 Create Training
POST {{BASE_URL}}/api/trainings
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "team_id": {{teamId}},
  "title": "Sabah Tempolu Koşu",
  "description": "10 km tempo koşusu. Islak hava için hazırlıklı gelin.",
  "training_date": "2024-12-15",
  "training_time": "06:30",
  "duration_minutes": 60,
  "location_name": "Kordon Boyu",
  "location_lat": 38.4192,
  "location_lng": 27.1287,
  "location_address": "Kordon, Alsancak, İzmir",
  "capacity": 20,
  "is_public": true,
  "difficulty": "Orta"
}

Expected Response (201):
{
  "message": "Training created successfully",
  "training": {
    "id": 1,
    ...
  }
}

@trainingId = {{response.body.training.id}}

---

### 3.2 Get All Trainings
GET {{BASE_URL}}/api/trainings
Authorization: Bearer {{token}}

Expected Response (200):
{
  "trainings": [
    {
      "id": 1,
      "title": "Sabah Tempolu Koşu",
      "team_name": "İzmir Sabah Koşucuları",
      "attendee_count": 0,
      ...
    }
  ]
}

---

### 3.3 Get Trainings (with filters)
GET {{BASE_URL}}/api/trainings?team_id={{teamId}}&is_public=true
Authorization: Bearer {{token}}

---

### 3.4 Get Training by ID
GET {{BASE_URL}}/api/trainings/{{trainingId}}
Authorization: Bearer {{token}}

Expected Response (200):
{
  "training": {
    "id": 1,
    "title": "Sabah Tempolu Koşu",
    "attendees": [],
    ...
  }
}

---

### 3.5 Join Training
POST {{BASE_URL}}/api/trainings/{{trainingId}}/join
Authorization: Bearer {{token}}

Expected Response (200):
{
  "message": "Successfully joined the training"
}

---

### 3.6 Search Nearby Trainings
GET {{BASE_URL}}/api/trainings/nearby?lat=38.4192&lng=27.1287&radius=10
Authorization: Bearer {{token}}

Expected Response (200):
{
  "trainings": [
    {
      "id": 1,
      "title": "Sabah Tempolu Koşu",
      "distance": 0.5,  // km cinsinden
      ...
    }
  ]
}

---

## 4. Notifications Tests

### 4.1 Get User Notifications
GET {{BASE_URL}}/api/notifications
Authorization: Bearer {{token}}

Expected Response (200):
{
  "notifications": [
    {
      "id": 1,
      "title": "Yeni Üye!",
      "message": "test@test.com takımınıza katıldı!",
      "is_read": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}

---

### 4.2 Mark Notification as Read
PUT {{BASE_URL}}/api/notifications/1/read
Authorization: Bearer {{token}}

Expected Response (200):
{
  "message": "Notification marked as read"
}

---

## 5. Subscriptions Tests

### 5.1 Create Subscription (Simulated Payment)
POST {{BASE_URL}}/api/subscriptions
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "team_id": {{teamId}},
  "subscription_type": "team_owner",
  "amount": 49.00,
  "payment_method": "credit_card"
}

Expected Response (201):
{
  "message": "Subscription created successfully",
  "subscription": {
    "id": 1,
    "user_id": 1,
    "team_id": 1,
    "amount": 49.00,
    "payment_status": "completed",
    "expires_at": "2024-02-15T10:30:00Z",
    ...
  }
}

---

## 6. Error Cases

### 6.1 Unauthorized Request
GET {{BASE_URL}}/api/auth/me

Expected Response (401):
{
  "error": "Authentication required"
}

---

### 6.2 Invalid Credentials
POST {{BASE_URL}}/api/auth/login
Content-Type: application/json

{
  "email": "wrong@email.com",
  "password": "wrongpassword"
}

Expected Response (401):
{
  "error": "Invalid credentials"
}

---

### 6.3 Duplicate Email Registration
POST {{BASE_URL}}/api/auth/register
Content-Type: application/json

{
  "name": "Test User",
  "email": "ahmet@test.com",  # Zaten kayıtlı
  "password": "test123"
}

Expected Response (409):
{
  "error": "Email already registered"
}

---

### 6.4 Join Already Joined Team
POST {{BASE_URL}}/api/teams/{{teamId}}/join
Authorization: Bearer {{token}}

Expected Response (409):
{
  "error": "Already a member of this team"
}

---

### 6.5 Training at Full Capacity
POST {{BASE_URL}}/api/trainings/{{trainingId}}/join
Authorization: Bearer {{token}}

Expected Response (409):
{
  "error": "Training is at full capacity"
}

---

## 7. Health Check

### 7.1 Health Check Endpoint
GET {{BASE_URL}}/health

Expected Response (200):
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z"
}

---

## Test Senaryoları

### Senaryo 1: Tam Kullanıcı Akışı
1. Register (1.1)
2. Login (1.2)
3. Create Team (2.1)
4. Create Training (3.1)
5. Get Notifications (4.1)

### Senaryo 2: İkinci Kullanıcı Katılımı
1. Register (farklı email)
2. Login
3. Get Teams (2.2)
4. Join Team (2.5)
5. Join Training (3.5)

### Senaryo 3: Arama ve Keşfet
1. Login
2. Search Teams (2.3)
3. Get Trainings (3.2)
4. Search Nearby (3.6)

---

## Notlar

- Tüm istekler için `Content-Type: application/json` header'ı gerekli
- Authentication gerektiren istekler için `Authorization: Bearer <token>` header'ı zorunlu
- Token süreleri: 30 gün (production'da daha kısa tutulabilir)
- Rate limiting: IP başına 15 dakikada 100 istek

## cURL Örnekleri

### Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"test123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

### Get Teams (with auth)
```bash
TOKEN="your-jwt-token-here"
curl http://localhost:3000/api/teams \
  -H "Authorization: Bearer $TOKEN"
```
