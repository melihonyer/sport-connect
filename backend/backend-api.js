// Muuvlink Backend API - FULL VERSION
require('dotenv').config();
// Render'da IPv6 üzerinden SMTP bağlantısı çalışmıyor — IPv4 öncelikli yap
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Kritik env var kontrolü — eksikse başlatma
if (!process.env.JWT_SECRET) {
  console.error('HATA: JWT_SECRET env var tanımlı değil.');
  process.exit(1);
}
// DB: PGHOST, DATABASE_URL veya DB_PASSWORD'dan biri olmalı
if (!process.env.PGHOST && !process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
  console.error('HATA: PGHOST, DATABASE_URL veya DB_PASSWORD env var tanımlı değil.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// CORS — sadece muuvlink.app'e izin ver
app.use(cors({
  origin: [
    'https://muuvlink.app',
    'https://www.muuvlink.app',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3000'] : []),
  ],
  credentials: true,
}));

// Helmet — güvenlik HTTP header'ları
app.use(helmet({
  contentSecurityPolicy: false, // SPA için devre dışı, nginx seviyesinde yönetilecek
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 20,                   // 15 dk'da max 20 deneme
  message: { error: 'Çok fazla istek. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 dakika
  max: 120,             // dakikada 120 istek
  message: { error: 'Çok fazla istek. Lütfen bir süre bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/uploads'), // statik dosyaları atla
});

app.use(generalLimiter);
app.use(express.json({ limit: '2mb' }));

// Statik dosyalar (upload edilen görseller)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer: banner görselleri için
// Multer: memory storage — dosyalar Supabase Storage'a yüklenir, diske yazılmaz
const uploadBanner = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|gif|webp|svg)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Sadece görsel dosyaları yüklenebilir.'));
  },
});
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Sadece PNG/JPEG/GIF/WEBP yüklenebilir.'));
  },
});

// Supabase Storage client (avatar & banner upload için)
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const ws = require('ws');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      realtime: { transport: ws },
    });
  }
} catch (e) {
  console.warn('Supabase client başlatılamadı:', e.message);
}

// Supabase Storage REST API — native fetch ile (Node 18+)
async function uploadToSupabase(bucket, fileName, buffer, mimetype) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase yapılandırılmadı.');
  }
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeType = (mimetype || 'application/octet-stream').split(';')[0].trim();
  const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${safeName}`;
  process.stdout.write(`[Supabase] POST ${uploadUrl} type=${safeType} size=${buffer.length} keyLen=${process.env.SUPABASE_SERVICE_KEY.length}\n`);
  const resp = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': safeType,
      'x-upsert': 'true',
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  });
  const text = await resp.text();
  process.stdout.write(`[Supabase] status=${resp.status} body=${text}\n`);
  if (!resp.ok) {
    let msg = text;
    try { msg = JSON.parse(text)?.message || JSON.parse(text)?.error || text; } catch {}
    throw new Error(msg);
  }
  const publicUrl = `${baseUrl}/storage/v1/object/public/${bucket}/${safeName}`;
  process.stdout.write(`[Supabase] publicUrl=${publicUrl}\n`);
  return publicUrl;
}

// DB bağlantısı: ayrı env var'lar öncelikli (şifredeki özel karakterler sorun çıkarmaz)
// Render/Supabase için: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD set edin
const pool = process.env.PGHOST
  ? new Pool({
      host:     process.env.PGHOST,
      port:     parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE || 'postgres',
      user:     process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl:      { rejectUnauthorized: false },
    })
  : process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({
        user:     process.env.DB_USER     || 'postgres',
        host:     process.env.DB_HOST     || 'localhost',
        database: process.env.DB_NAME     || 'sporlaconnect',
        password: process.env.DB_PASSWORD,
        port:     parseInt(process.env.DB_PORT || '5432'),
      });

// Her yeni bağlantıda timezone'u Europe/Istanbul olarak sabitle.
// Uygulama Türkiye saatinde çalışıyor: training_time girişleri yerel saat,
// CURRENT_TIME/CURRENT_DATE karşılaştırmaları da İstanbul saatiyle tutarlı olmalı.
pool.on('connect', async client => {
  await client.query("SET search_path TO public").catch(() => {});
  await client.query("SET timezone = 'Europe/Istanbul'").catch(() => {});
});

// =====================================================
// REAL-TIME: SSE (Server-Sent Events)
// =====================================================

// userId → Set<Response> — aktif SSE bağlantıları
const sseClients = new Map();

function pushToUser(userId, payload) {
  const conns = sseClients.get(userId);
  if (!conns || conns.size === 0) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  conns.forEach(res => { try { res.write(line); } catch {} });
}

// Bildirim oluştur ve anlık ilet
async function createNotif(userId, { title, message, type, refId = null, url = null }) {
  try {
    const r = await pool.query(
      `INSERT INTO notifications (user_id, title, message, notification_type, reference_id, action_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, title, message, type, refId, url]
    );
    pushToUser(userId, { event: 'notification', data: r.rows[0] });
    return r.rows[0];
  } catch (e) {
    console.error('createNotif error:', e.message);
  }
}

// =====================================================
// EMAIL / NODEMAILER SETUP
// =====================================================

const mailTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587'),
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  family: 4, // IPv4 zorla — Render IPv6 üzerinden SMTP'ye ulaşamıyor
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// Mail gönder — Resend HTTP API (Render SMTP portlarını engelliyor)
async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL - MOCK] To: ${to} | Subject: ${subject}`);
    return { mocked: true };
  }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Muuvlink <noreply@muuvlink.app>',
        to,
        subject,
        html,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error(`[EMAIL ERROR] Resend:`, JSON.stringify(data));
      return null;
    }
    console.log(`[EMAIL] Resend ile gönderildi: ${data.id}`);
    return data;
  } catch (err) {
    console.error(`[EMAIL ERROR] Resend istek hatası:`, err.message);
    return null;
  }
}

// ─── HTML Şablonları ──────────────────────────────────

// Tarihi Türkçe uzun formata çevirir: "1 Haziran 2026 Pazartesi"
function formatTrDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('tr-TR', {
    timeZone: 'UTC',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function emailWrapper(content) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Muuvlink</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#00b7ba,#009295);padding:32px 40px;text-align:center;">
            <img src="https://muuvlink.app/icons/favicon.png" width="56" height="56" alt="Muuvlink" style="border-radius:14px;margin-bottom:14px;display:inline-block;box-shadow:0 4px 16px rgba(0,0,0,0.15);" />
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Muuvlink</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Spor topluluğun seni bekliyor</p>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:40px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:13px;">Bu maili Muuvlink üzerinden aldınız.</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">© 2026 Muuvlink. Tüm hakları saklıdır.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Şablon 1: Takım daveti (kayıtlı kullanıcı)
function inviteEmailExisting({ teamName, teamSport, inviterName, teamId, avatar }) {
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Takıma Davet Edildiniz!</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      <strong>${inviterName}</strong> sizi <strong>${teamName}</strong> takımına davet etti.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#00b7ba,#009295);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;text-align:center;line-height:56px;">${avatar || teamName.charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#1e293b;">${teamName}</div>
          <div style="font-size:14px;color:#00b7ba;margin-top:2px;">${teamSport}</div>
        </div>
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}?accept_invite=${teamId}"
         style="display:inline-block;background:linear-gradient(135deg,#00b7ba,#009295);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;letter-spacing:0.2px;">
        Takıma Katıl →
      </a>
    </div>
    <p style="text-align:center;margin:16px 0 0;color:#94a3b8;font-size:13px;">
      Uygulamaya giriş yaparak daveti kabul edebilirsiniz.
    </p>
  `);
}

// Şablon 2: Takım daveti (yeni kullanıcı)
function inviteEmailNew({ teamName, teamSport, inviterName, avatar }) {
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Muuvlink'e Davet Edildiniz!</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      <strong>${inviterName}</strong> sizi <strong>${teamName}</strong> takımına davet etti.
      Katılmak için ücretsiz hesap oluşturun.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="width:56px;height:56px;background:linear-gradient(135deg,#00b7ba,#009295);border-radius:12px;font-size:22px;font-weight:800;color:#fff;text-align:center;line-height:56px;margin:0 auto 12px;">${avatar || teamName.charAt(0).toUpperCase()}</div>
      <div style="text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#1e293b;">${teamName}</div>
        <div style="font-size:14px;color:#00b7ba;margin-top:4px;">${teamSport}</div>
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}?auth=register"
         style="display:inline-block;background:linear-gradient(135deg,#00b7ba,#009295);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        Hesap Oluştur →
      </a>
    </div>
    <p style="text-align:center;margin:16px 0 0;color:#94a3b8;font-size:13px;">
      Kayıt olduktan sonra takıma katılma daveti sizi bekliyor olacak.
    </p>
  `);
}

// Şablon 3: Duvar gönderisi bildirimi
// Avatar URL'sini <img> tag'ine, değilse baş harfe çevirir
function avatarHtml(avatarValue, name, size = 40, gradient = 'linear-gradient(135deg,#00b7ba,#009295)') {
  const isUrl = avatarValue && (avatarValue.startsWith('http') || avatarValue.startsWith('/uploads/'));
  const src = isUrl ? (avatarValue.startsWith('/uploads/') ? `${APP_URL}${avatarValue}` : avatarValue) : null;
  if (src) {
    return `<img src="${src}" width="${size}" height="${size}"
              style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;" />`;
  }
  return `<div style="width:${size}px;height:${size}px;background:${gradient};border-radius:50%;
                display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.45)}px;
                text-align:center;line-height:${size}px;color:white;font-weight:700;">
            ${name.charAt(0).toUpperCase()}
          </div>`;
}

function wallPostEmail({ teamName, teamId, posterName, posterAvatar, message, postDate }) {
  const truncated = message.length > 300 ? message.slice(0, 300) + '...' : message;
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${teamName} Duvarında Yeni Gönderi</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;">
      <strong>${posterName}</strong> takım duvarına bir şey yazdı.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        ${avatarHtml(posterAvatar, posterName, 40, 'linear-gradient(135deg,#00b7ba,#009295)')}
        <div>
          <div style="font-weight:600;color:#1e293b;font-size:15px;">${posterName}</div>
          <div style="color:#94a3b8;font-size:13px;">${postDate}</div>
        </div>
      </div>
      <div style="color:#334155;font-size:15px;line-height:1.7;white-space:pre-wrap;border-left:3px solid #00b7ba;padding-left:16px;">
        ${truncated}
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/teams/${teamId}"
         style="display:inline-block;background:linear-gradient(135deg,#00b7ba,#009295);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        Duvara Git →
      </a>
    </div>
  `);
}

// Şablon: Antrenman yorumu bildirimi
function trainingCommentEmail({ commenterName, commenterAvatar, trainingTitle, trainingDate, comment, trainingId }) {
  const truncated = comment.length > 300 ? comment.slice(0, 300) + '...' : comment;
  const postDate = new Date().toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Antrenmana Yorum Yapıldı</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;">
      <strong>${commenterName}</strong>, <strong>${trainingTitle}</strong> antrenmanına yorum yaptı.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:13px;color:#009295;font-weight:600;">${trainingTitle}</div>
      <div style="font-size:13px;color:#64748b;margin-top:2px;">${trainingDate}</div>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        ${avatarHtml(commenterAvatar, commenterName, 36, 'linear-gradient(135deg,#00b7ba,#009295)')}
        <div>
          <div style="font-weight:600;color:#1e293b;font-size:15px;">${commenterName}</div>
          <div style="color:#94a3b8;font-size:13px;">${postDate}</div>
        </div>
      </div>
      <div style="color:#334155;font-size:15px;line-height:1.7;white-space:pre-wrap;border-left:3px solid #00b7ba;padding-left:16px;">
        ${truncated}
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/antrenmanlar"
         style="display:inline-block;background:linear-gradient(135deg,#00b7ba,#009295);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        Antrenmanı Gör →
      </a>
    </div>
  `);
}

// Şablon: Antrenman güncelleme bildirimi
function trainingUpdateEmail({ teamName, trainingTitle, trainingDate, trainingTime, location, description, updaterName }) {
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Antrenman Güncellendi</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      <strong>${teamName}</strong> takımının <strong>${trainingTitle}</strong> antrenmanında değişiklik yapıldı.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="font-size:18px;font-weight:700;color:#009295;margin-bottom:16px;">Güncel Bilgiler</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:80px;">Tarih</td><td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingDate}</td></tr>
        ${trainingTime ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Saat</td><td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingTime.slice(0,5)}</td></tr>` : ''}
        ${location ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Konum</td><td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${location}</td></tr>` : ''}
        ${description ? `<tr><td colspan="2" style="padding:12px 0 4px;color:#334155;font-size:14px;line-height:1.6;border-top:1px solid #e5f9f9;margin-top:8px;">${description}</td></tr>` : ''}
      </table>
    </div>

    ${updaterName ? `<p style="color:#94a3b8;font-size:13px;margin:0 0 24px;">Güncelleyen: <strong style="color:#64748b;">${updaterName}</strong></p>` : ''}

    <div style="text-align:center;">
      <a href="${APP_URL}/antrenmanlar"
         style="display:inline-block;background:linear-gradient(135deg,#00b7ba,#009295);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        Antrenmanı Gör →
      </a>
    </div>
  `);
}

// Şablon 4: Yeni antrenman bildirimi
function newTrainingEmail({ teamName, trainingTitle, trainingDate, trainingTime, location, description, upcomingTrainings }) {
  const upcoming = (upcomingTrainings || []).slice(0, 3).map(t => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-weight:600;color:#1e293b;font-size:14px;">${t.title}</div>
        <div style="color:#64748b;font-size:13px;margin-top:2px;">${formatTrDate(t.training_date)} ${t.training_time ? '• ' + t.training_time.slice(0,5) : ''} ${t.location_name ? '• ' + t.location_name : ''}</div>
      </td>
    </tr>
  `).join('');

  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Yeni Antrenman Eklendi!</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      <strong>${teamName}</strong> takımına yeni bir antrenman eklendi.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="font-size:20px;font-weight:700;color:#009295;margin-bottom:12px;">${trainingTitle}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Tarih</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingDate}</td></tr>
        ${trainingTime ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Saat</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingTime.slice(0,5)}</td></tr>` : ''}
        ${location ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Konum</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${location}</td></tr>` : ''}
        ${description ? `<tr><td colspan="2" style="padding:12px 0 4px;color:#334155;font-size:14px;line-height:1.6;">${description}</td></tr>` : ''}
      </table>
    </div>

    ${upcoming ? `
    <div style="margin-bottom:28px;">
      <div style="font-weight:700;color:#1e293b;font-size:15px;margin-bottom:12px;">Yaklaşan Diğer Antrenmanlar</div>
      <table style="width:100%;border-collapse:collapse;">${upcoming}</table>
    </div>` : ''}

    <div style="text-align:center;">
      <a href="${process.env.APP_URL || 'https://muuvlink.app'}/antrenmanlar"
         style="display:inline-block;background:linear-gradient(135deg,#00b7ba,#009295);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        Antrenmanları Gör →
      </a>
    </div>
  `);
}

// Şablon 5: Antrenman hatırlatma
function trainingReminderEmail({ teamName, trainingTitle, trainingDate, trainingTime, location, daysLeft }) {
  const urgency = daysLeft === 1 ? 'Yarın!' : `${daysLeft} gün kaldı`;
  const color   = daysLeft === 1 ? '#dc2626' : '#d97706';
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Antrenmanınız Yaklaşıyor</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      <strong>${teamName}</strong> takımınızın antrenmanına az kaldı.
    </p>

    <div style="background:#fffbeb;border:2px solid ${color};border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${urgency}</div>
      <div style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:12px;">${trainingTitle}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Tarih</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingDate}</td></tr>
        ${trainingTime ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Saat</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${trainingTime.slice(0,5)}</td></tr>` : ''}
        ${location ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Konum</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${location}</td></tr>` : ''}
      </table>
    </div>

    <div style="text-align:center;">
      <a href="${process.env.APP_URL || 'https://muuvlink.app'}/antrenmanlar"
         style="display:inline-block;background:linear-gradient(135deg,#00b7ba,#009295);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        Antrenmanı Görüntüle →
      </a>
    </div>
  `);
}

// =====================================================
// MIDDLEWARE
// =====================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Token varsa decode eder, yoksa anonim olarak devam eder
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) req.user = user;
    next();
  });
};

const isAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Admin authentication required' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    try {
      const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [decoded.id]);
      if (!result.rows[0]?.is_admin) return res.status(403).json({ error: 'Admin access required' });
      req.user = decoded;
      next();
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const checkAndAwardBadges = async (userId) => {
  try {
    // Get user stats
    const statsResult = await pool.query(
      'SELECT * FROM user_stats WHERE user_id = $1',
      [userId]
    );

    if (statsResult.rows.length === 0) return;

    const stats = statsResult.rows[0];

    // Get all badges
    const badgesResult = await pool.query('SELECT * FROM badges');
    const badges = badgesResult.rows;

    // Check each badge requirement
    for (const badge of badges) {
      let qualified = false;

      if (badge.requirement_type === 'training_count') {
        qualified = stats.total_trainings >= badge.requirement_value;
      } else if (badge.requirement_type === 'distance') {
        qualified = stats.total_distance >= badge.requirement_value;
      } else if (badge.requirement_type === 'team_count') {
        const teamCount = await pool.query(
          'SELECT COUNT(*) FROM team_members WHERE user_id = $1',
          [userId]
        );
        qualified = parseInt(teamCount.rows[0].count) >= badge.requirement_value;
      }

      if (qualified) {
        // Award badge if not already awarded
        await pool.query(
          `INSERT INTO user_badges (user_id, badge_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, badge_id) DO NOTHING
           RETURNING *`,
          [userId, badge.id]
        ).then(async (result) => {
          if (result.rows.length > 0) {
            await createNotif(userId, {
              title: 'Yeni Rozet!',
              message: `"${badge.name}" rozetini kazandın!`,
              type: 'badge',
              refId: badge.id,
            });
          }
        });
      }
    }
  } catch (error) {
    console.error('Badge check error:', error);
  }
};

const updateUserStats = async (userId) => {
  try {
    const trainingsResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM training_attendees ta
       JOIN trainings t ON ta.training_id = t.id
       WHERE ta.user_id = $1 AND (t.training_date < CURRENT_DATE OR (t.training_date = CURRENT_DATE AND t.training_time < CURRENT_TIME))`,
      [userId]
    );

    const trainingCount = parseInt(trainingsResult.rows[0].count);

    await pool.query(
      `INSERT INTO user_stats (user_id, total_trainings, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET total_trainings = $2, updated_at = CURRENT_TIMESTAMP`,
      [userId, trainingCount]
    );

    await checkAndAwardBadges(userId);
  } catch (error) {
    console.error('Update stats error:', error);
  }
};

// ============================================
// PUBLIC TRAININGS (AUTH GEREKMİYOR)
// ============================================
app.get('/api/trainings/public', async (req, res) => {
  try {
    const { team_id, date_from, date_to, sport } = req.query;

    let query = `
      SELECT t.*, 
             teams.name as team_name,
             teams.sport as team_sport,
             teams.avatar as team_avatar,
             COUNT(DISTINCT ta.user_id) as attendee_count
      FROM trainings t
      JOIN teams ON t.team_id = teams.id
      LEFT JOIN training_attendees ta ON t.id = ta.training_id
      WHERE t.is_public = true
  AND t.training_date >= CURRENT_DATE
    `;

    const params = [];
    let paramCount = 0;

    if (team_id) {
      paramCount++;
      query += ` AND t.team_id = $${paramCount}`;
      params.push(team_id);
    }

    if (date_from) {
      paramCount++;
      query += ` AND t.training_date >= $${paramCount}`;
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND t.training_date <= $${paramCount}`;
      params.push(date_to);
    }

    if (sport) {
      paramCount++;
      query += ` AND teams.sport = $${paramCount}`;
      params.push(sport);
    }

    query += `
      GROUP BY t.id, teams.name, teams.sport, teams.avatar
      ORDER BY t.training_date ASC, t.training_time ASC
    `;

    const result = await pool.query(query, params);

    res.json({
      trainings: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get public trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// AUTH ROUTES
// =====================================================

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, avatar, created_at',
      [name, email, passwordHash, phone]
    );

    const user = result.rows[0];

    // Initialize user stats
    await pool.query(
      'INSERT INTO user_stats (user_id) VALUES ($1)',
      [user.id]
    );

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '30d',
    });

    // Bekleyen takım davetlerini otomatik kabul et
    const invites = await pool.query(
      'SELECT * FROM team_invitations WHERE invitee_email = $1',
      [email]
    );
    for (const inv of invites.rows) {
      await pool.query(
        'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [inv.team_id, user.id, 'member']
      );
      await pool.query('DELETE FROM team_invitations WHERE id = $1', [inv.id]);
    }

    logActivity('user_register', user.id, user.name, { email });
    res.status(201).json({ message: 'User registered successfully', user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, name, email, password_hash, avatar FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '30d',
    });

    delete user.password_hash;

    res.json({ message: 'Login successful', user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, avatar, is_admin, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    const result = await pool.query(
      `UPDATE users SET name = $1, phone = $2, avatar = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, name, email, phone, avatar`,
      [name, phone, avatar, req.user.id]
    );

    res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Avatar fotoğrafı yükleme
app.post('/api/auth/avatar', authenticateToken, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi.' });
    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `avatar-${req.user.id}-${Date.now()}${ext}`;
    const avatarUrl = await uploadToSupabase('avatars', fileName, req.file.buffer, req.file.mimetype);
    const result = await pool.query(
      `UPDATE users SET avatar = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
       RETURNING id, name, email, phone, avatar`,
      [avatarUrl, req.user.id]
    );
    res.json({ message: 'Avatar güncellendi', user: result.rows[0] });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/teams/:id/avatar', authenticateToken, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const teamId = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi.' });

    const ownerCheck = await pool.query(
      'SELECT owner_id FROM teams WHERE id = $1',
      [teamId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Takım bulunamadı.' });
    if (ownerCheck.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Sadece takım sahibi fotoğraf yükleyebilir.' });

    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `team-${teamId}-${Date.now()}${ext}`;
    const avatarUrl = await uploadToSupabase('avatars', fileName, req.file.buffer, req.file.mimetype);

    const result = await pool.query(
      'UPDATE teams SET avatar = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [avatarUrl, teamId]
    );
    res.json({ message: 'Takım fotoğrafı güncellendi', avatar: avatarUrl, team: result.rows[0] });
  } catch (error) {
    console.error('Team avatar upload error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const validPassword = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// TEAMS ROUTES
// =====================================================

app.post('/api/teams', authenticateToken, async (req, res) => {
  try {
    const { name, sport, description, location, is_private, avatar } = req.body;

    if (!name || !sport) {
      return res.status(400).json({ error: 'Name and sport are required' });
    }

    const teamResult = await pool.query(
      `INSERT INTO teams (name, sport, description, location, is_private, owner_id, avatar, subscription_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        sport,
        description,
        location,
        is_private || false,
        req.user.id,
        avatar || '⚽',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ]
    );

    const team = teamResult.rows[0];

    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [team.id, req.user.id, 'owner']
    );

    await updateUserStats(req.user.id);

    logActivity('team_create', req.user.id, null, { team_name: name, sport });
    res.status(201).json({ message: 'Team created successfully', team });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/teams', optionalAuth, async (req, res) => {
  try {
    const { sport, search, member_only, can_create_training } = req.query;

    let whereClause;
    if (can_create_training === 'true') {
      // Sadece antrenman oluşturabildiği takımlar (sahip/antrenör/kaptan)
      whereClause = `t.id IN (SELECT team_id FROM team_members WHERE user_id = $1 AND role IN ('owner','coach','captain'))`;
    } else if (member_only === 'true') {
      // Sadece kullanıcının üye olduğu takımlar (profil sayfası için)
      whereClause = `t.id IN (SELECT team_id FROM team_members WHERE user_id = $1)`;
    } else if (!req.user) {
      // Giriş yapmamış kullanıcılar sadece herkese açık takımları görebilir
      whereClause = `t.is_private = false`;
    } else {
      // Giriş yapmış kullanıcılar: herkese açık + üye oldukları gizli takımlar
      whereClause = `(t.is_private = false OR t.id IN (SELECT team_id FROM team_members WHERE user_id = $1))`;
    }

    let query = `
      SELECT t.*,
             u.name as owner_name,
             COUNT(DISTINCT tm.user_id) as member_count,
             my_role.role as my_role
      FROM teams t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN team_members my_role ON my_role.team_id = t.id AND my_role.user_id = $1
      WHERE ${whereClause}
    `;

    const params = [req.user?.id || null];
    let paramCount = 1;

    if (sport) {
      paramCount++;
      query += ` AND t.sport = $${paramCount}`;
      params.push(sport);
    }

    if (search) {
      paramCount++;
      query += ` AND (t.name ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' GROUP BY t.id, u.name, my_role.role ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);

    res.json({ teams: result.rows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;

    const teamResult = await pool.query(
      `SELECT t.*, 
              u.name as owner_name,
              COUNT(DISTINCT tm.user_id) as member_count
       FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       LEFT JOIN team_members tm ON t.id = tm.team_id
       WHERE t.id = $1
       GROUP BY t.id, u.name`,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];

    if (team.is_private) {
      const memberCheck = await pool.query(
        'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
        [teamId, req.user.id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to private team' });
      }
    }

    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.avatar, tm.role, tm.joined_at
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [teamId]
    );

    team.members = membersResult.rows;

    // Get team posts
    const postsResult = await pool.query(
      `SELECT tp.*, u.name as user_name, u.avatar as user_avatar
       FROM team_posts tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.team_id = $1
       ORDER BY tp.created_at DESC
       LIMIT 10`,
      [teamId]
    );

    team.posts = postsResult.rows;

    res.json({ team });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/teams/:id/join', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;

    const teamResult = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];

    const memberCheck = await pool.query(
      'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Already a member of this team' });
    }

    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [teamId, req.user.id, 'member']
    );

    // Katılan kullanıcının adını al
    const joinerRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
    const joinerName = joinerRes.rows[0]?.name || req.user.email;

    // Sahip, antrenör ve kaptan rolündeki üyeleri bul
    const leadersRes = await pool.query(
      `SELECT tm.user_id, u.email, u.name FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.role IN ('owner', 'coach', 'captain')`,
      [teamId]
    );

    for (const leader of leadersRes.rows) {
      await createNotif(leader.user_id, {
        title: 'Yeni Üye Katıldı!',
        message: `${joinerName}, ${team.name} takımına katıldı.`,
        type: 'team',
        refId: teamId,
        url: `/takimlar`,
      });

      sendEmail({
        to: leader.email,
        subject: `${team.name} — Yeni Üye: ${joinerName}`,
        html: emailWrapper(`
          <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Takımınıza Yeni Üye Katıldı!</h2>
          <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
            <strong>${joinerName}</strong>, <strong>${team.name}</strong> takımına yeni üye olarak katıldı.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:28px;text-align:center;">
            <div style="width:56px;height:56px;background:linear-gradient(135deg,#00b7ba,#009295);border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;line-height:56px;text-align:center;">U</div>
            <div style="font-size:18px;font-weight:700;color:#009295;">${joinerName}</div>
          </div>
          <div style="text-align:center;">
            <a href="${process.env.APP_URL || 'https://muuvlink.app'}/takimlar"
               style="display:inline-block;background:linear-gradient(135deg,#00b7ba,#009295);color:#ffffff;text-decoration:none;
                      padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
              Takımı Görüntüle →
            </a>
          </div>
        `),
      }).catch(e => console.error('Join email error:', e.message));
    }

    await updateUserStats(req.user.id);

    logActivity('team_join', req.user.id, joinerName, { team_name: team.name });
    res.json({ message: 'Successfully joined the team' });
  } catch (error) {
    console.error('Join team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/teams/:id/invite', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Rol kontrolü: owner veya coach davet edebilir
    const memberCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, req.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'coach'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Only team owners/coaches can invite members' });
    }

    // Takım bilgilerini çek
    const teamResult = await pool.query(
      `SELECT t.name, t.sport, t.avatar, u.name as inviter_name
       FROM teams t
       JOIN users u ON u.id = $2
       WHERE t.id = $1`,
      [teamId, req.user.id]
    );
    const team = teamResult.rows[0];

    // Daha önce davet var mı?
    const existingInvite = await pool.query(
      `SELECT id FROM team_invitations WHERE team_id = $1 AND invitee_email = $2`,
      [teamId, email]
    );
    if (existingInvite.rows.length > 0) {
      return res.status(409).json({ error: 'Bu e-posta adresi zaten davet edildi.' });
    }

    // Zaten üye mi?
    const alreadyMember = await pool.query(
      `SELECT tm.id FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND u.email = $2`,
      [teamId, email]
    );
    if (alreadyMember.rows.length > 0) {
      return res.status(409).json({ error: 'Bu kullanıcı zaten takım üyesi.' });
    }

    // Daveti kaydet
    const result = await pool.query(
      `INSERT INTO team_invitations (team_id, inviter_id, invitee_email)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [teamId, req.user.id, email]
    );

    // Kullanıcı kayıtlı mı kontrol et
    const userResult = await pool.query(
      'SELECT id, name FROM users WHERE email = $1',
      [email]
    );

    const isRegistered = userResult.rows.length > 0;

    // Kayıtlı kullanıcıya in-app bildirim
    if (isRegistered) {
      await createNotif(userResult.rows[0].id, {
        title: 'Takım Daveti!',
        message: `${team.inviter_name} sizi "${team.name}" takımına davet etti.`,
        type: 'invitation',
        refId: teamId,
        url: `/teams/${teamId}`,
      });
    }

    // Her iki durumda da mail gönder
    const emailHtml = isRegistered
      ? inviteEmailExisting({
          teamName: team.name,
          teamSport: team.sport,
          inviterName: team.inviter_name,
          teamId,
          avatar: team.avatar,
        })
      : inviteEmailNew({
          teamName: team.name,
          teamSport: team.sport,
          inviterName: team.inviter_name,
          avatar: team.avatar,
        });

    await sendEmail({
      to: email,
      subject: `${team.inviter_name} sizi "${team.name}" takımına davet etti!`,
      html: emailHtml,
    });

    res.json({
      message: isRegistered
        ? 'Davet gönderildi. Kullanıcıya bildirim ve e-posta iletildi.'
        : 'Davet gönderildi. Kullanıcı kayıtlı değil — kayıt daveti e-postası iletildi.',
      invitation: result.rows[0],
      is_registered: isRegistered,
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Takımın bekleyen davetlerini getir (owner/coach görebilir)
app.get('/api/teams/:id/invitations', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const memberCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length || !['owner', 'coach'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Yetki yok.' });
    }
    const result = await pool.query(
      `SELECT ti.id, ti.invitee_email, ti.created_at,
              u.name as inviter_name
       FROM team_invitations ti
       JOIN users u ON u.id = ti.inviter_id
       WHERE ti.team_id = $1
       ORDER BY ti.created_at DESC`,
      [teamId]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Daveti iptal et (owner/coach yapabilir)
app.delete('/api/teams/:id/invitations/:inviteId', authenticateToken, async (req, res) => {
  try {
    const { id: teamId, inviteId } = req.params;
    const memberCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length || !['owner', 'coach'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Yetki yok.' });
    }
    await pool.query(
      `DELETE FROM team_invitations WHERE id = $1 AND team_id = $2`,
      [inviteId, teamId]
    );
    res.json({ message: 'Davet iptal edildi.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Daveti kabul et (kayıtlı kullanıcı mail linkinden gelir)
app.post('/api/teams/:id/accept-invite', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const userEmail = req.user.email;

    const invite = await pool.query(
      'SELECT id FROM team_invitations WHERE team_id = $1 AND invitee_email = $2',
      [teamId, userEmail]
    );
    if (!invite.rows.length) {
      return res.status(404).json({ error: 'Bekleyen davet bulunamadı.' });
    }

    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [teamId, req.user.id, 'member']
    );
    await pool.query('DELETE FROM team_invitations WHERE id = $1', [invite.rows[0].id]);

    res.json({ message: 'Takıma başarıyla katıldınız!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { name, sport, description, location, is_private, avatar } = req.body;

    const ownerCheck = await pool.query('SELECT owner_id FROM teams WHERE id = $1', [teamId]);
    if (!ownerCheck.rows.length) return res.status(404).json({ error: 'Team not found' });
    if (ownerCheck.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only team owner can edit the team' });
    }

    // Takım gizli yapılırsa tüm antrenmanları da gizle
    if (is_private === true) {
      await pool.query('UPDATE trainings SET is_public = false WHERE team_id = $1', [teamId]);
    }

    const result = await pool.query(
      `UPDATE teams SET name=$1, sport=$2, description=$3, location=$4, is_private=$5, avatar=$6, updated_at=CURRENT_TIMESTAMP
       WHERE id=$7 RETURNING *`,
      [name, sport, description, location, is_private, avatar, teamId]
    );

    res.json({ message: 'Team updated', team: result.rows[0] });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;

    const ownerCheck = await pool.query('SELECT owner_id FROM teams WHERE id = $1', [teamId]);
    if (!ownerCheck.rows.length) return res.status(404).json({ error: 'Team not found' });
    if (ownerCheck.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only team owner can delete the team' });
    }

    await pool.query('DELETE FROM teams WHERE id = $1', [teamId]);
    res.json({ message: 'Team deleted' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/teams/:teamId/members/:userId/role', authenticateToken, async (req, res) => {
  try {
    const { teamId, userId } = req.params;
    const { role } = req.body;

    const ownerCheck = await pool.query(
      'SELECT owner_id FROM teams WHERE id = $1',
      [teamId]
    );

    if (ownerCheck.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only team owner can change roles' });
    }

    await pool.query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
      [role, teamId, userId]
    );

    res.json({ message: 'Role updated' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/teams/:teamId/members/:userId', authenticateToken, async (req, res) => {
  try {
    const { teamId, userId } = req.params;

    const ownerCheck = await pool.query(
      'SELECT owner_id FROM teams WHERE id = $1',
      [teamId]
    );

    // Sahip, antrenör veya kendisi çıkabilir
    const myRole = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );
    const isOwner = ownerCheck.rows[0].owner_id === req.user.id;
    const isCoach = myRole.rows[0]?.role === 'coach';
    const isSelf = req.user.id === parseInt(userId);

    // Sahip çıkarılamaz
    if (parseInt(userId) === ownerCheck.rows[0].owner_id) {
      return res.status(403).json({ error: 'Takım sahibi çıkarılamaz.' });
    }

    if (!isOwner && !isCoach && !isSelf) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }

    await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/teams/:id/posts', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mesaj boş olamaz.' });
    }

    // Üyelik kontrolü + göndericinin bilgilerini çek
    const memberCheck = await pool.query(
      `SELECT tm.id, u.name as user_name, u.avatar as user_avatar
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.user_id = $2`,
      [teamId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only team members can post' });
    }

    const poster = memberCheck.rows[0];

    // Takım bilgisini çek
    const teamResult = await pool.query(
      'SELECT id, name, sport FROM teams WHERE id = $1',
      [teamId]
    );
    const team = teamResult.rows[0];

    // Gönderiyi kaydet
    const result = await pool.query(
      `INSERT INTO team_posts (team_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [teamId, req.user.id, message.trim()]
    );

    const post = result.rows[0];

    // Diğer tüm üyeleri çek (göndericinin kendisi hariç)
    const otherMembers = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.user_id != $2`,
      [teamId, req.user.id]
    );

    const postDate = new Date().toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // Her üye için bildirim + mail (paralel, hata durumunda durmaz)
    const notifAndMailPromises = otherMembers.rows.map(async (member) => {
      // In-app bildirim
      await createNotif(member.id, {
        title: `${team.name} Duvarı`,
        message: `${poster.user_name}: ${message.trim().slice(0, 80)}${message.length > 80 ? '...' : ''}`,
        type: 'team_post',
        refId: teamId,
        url: `/teams/${teamId}`,
      });

      // Mail
      sendEmail({
        to: member.email,
        subject: `${team.name} takımında yeni gönderi var`,
        html: wallPostEmail({
          teamName: team.name,
          teamId,
          posterName: poster.user_name,
          posterAvatar: poster.user_avatar,
          message: message.trim(),
          postDate,
        }),
      });
    });

    // Bildirimleri bekle ama mail'i background'da çalıştır
    await Promise.allSettled(notifAndMailPromises);

    res.json({ post: { ...post, user_name: poster.user_name, user_avatar: poster.user_avatar } });
  } catch (error) {
    console.error('Post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// TRAININGS ROUTES
// =====================================================

app.post('/api/trainings', authenticateToken, async (req, res) => {
  try {
    const {
      team_id,
      title,
      description,
      training_date,
      training_time,
      duration_minutes,
      location_name,
      location_lat,
      location_lng,
      location_address,
      capacity,
      is_public,
      difficulty,
    } = req.body;

    if (!team_id || !title || !training_date || !training_time || !location_name) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [team_id, req.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'coach', 'captain'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Antrenman oluşturmak için takımın sahibi, antrenörü veya kaptanı olmanız gerekiyor.' });
    }

    // Gizli takımın antrenmanı asla public olamaz
    const teamCheck = await pool.query('SELECT is_private FROM teams WHERE id = $1', [team_id]);
    const teamIsPrivate = teamCheck.rows[0]?.is_private || false;
    const finalIsPublic = teamIsPrivate ? false : (is_public !== undefined ? is_public : true);

    const result = await pool.query(
      `INSERT INTO trainings (
        team_id, title, description, training_date, training_time, duration_minutes,
        location_name, location_lat, location_lng, location_address, capacity, is_public, difficulty
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        team_id,
        title,
        description,
        training_date,
        training_time,
        duration_minutes || 60,
        location_name,
        location_lat,
        location_lng,
        location_address,
        capacity || 20,
        finalIsPublic,
        difficulty || 'Orta',
      ]
    );

    const training = result.rows[0];

    // Takım adını al
    const teamRow = await pool.query('SELECT name FROM teams WHERE id = $1', [team_id]);
    const teamName = teamRow.rows[0]?.name || 'Takımınız';

    // Yaklaşan diğer antrenmanları al (yeni oluşturulan hariç)
    const upcomingRes = await pool.query(
      `SELECT title, training_date, training_time, location_name FROM trainings
       WHERE team_id = $1 AND id != $2 AND training_date >= CURRENT_DATE
       ORDER BY training_date, training_time LIMIT 3`,
      [team_id, training.id]
    );

    const members = await pool.query(
      'SELECT tm.user_id, u.email, u.name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = $1 AND tm.user_id != $2',
      [team_id, req.user.id]
    );

    for (const member of members.rows) {
      // In-app bildirim
      await createNotif(member.user_id, {
        title: 'Yeni Antrenman!',
        message: `${teamName}: ${title} antrenmanı eklendi.`,
        type: 'training',
        refId: training.id,
        url: `/antrenmanlar`,
      });
      // E-posta
      sendEmail({
        to: member.email,
        subject: `${teamName} — Yeni Antrenman: ${title}`,
        html: newTrainingEmail({
          teamName,
          trainingTitle: title,
          trainingDate: formatTrDate(training.training_date),
          trainingTime: training.training_time,
          location: location_name,
          description,
          upcomingTrainings: upcomingRes.rows,
        }),
      }).catch(e => console.error('Training email error:', e.message));
    }

    // Oluşturan kişiyi otomatik katılımcı yap
    await pool.query(
      'INSERT INTO training_attendees (training_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [training.id, req.user.id, 'confirmed']
    );

    logActivity('training_create', req.user.id, null, { training_title: title, team_name: teamName });
    res.status(201).json({ message: 'Training created successfully', training });
  } catch (error) {
    console.error('Create training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/trainings', optionalAuth, async (req, res) => {
  try {
    const { team_id, date_from, date_to, is_public, sport } = req.query;

    let query = `
      SELECT t.*, 
             teams.name as team_name,
             teams.sport as team_sport,
             teams.avatar as team_avatar,
             COUNT(DISTINCT ta.user_id) as attendee_count
      FROM trainings t
      JOIN teams ON t.team_id = teams.id
      LEFT JOIN training_attendees ta ON t.id = ta.training_id
      WHERE (
        teams.is_private = false
        OR t.is_public = true
        OR ($1::int IS NOT NULL AND teams.id IN (
          SELECT team_id FROM team_members WHERE user_id = $1
        ))
      )
      AND (
        t.training_date > CURRENT_DATE
        OR (t.training_date = CURRENT_DATE AND t.training_time >= CURRENT_TIME)
      )
    `;

    const params = [req.user?.id || null];
    let paramCount = 1;

    if (team_id) {
      paramCount++;
      query += ` AND t.team_id = $${paramCount}`;
      params.push(team_id);
    }

    if (date_from) {
      paramCount++;
      query += ` AND t.training_date >= $${paramCount}`;
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND t.training_date <= $${paramCount}`;
      params.push(date_to);
    }

    if (is_public !== undefined) {
      paramCount++;
      query += ` AND t.is_public = $${paramCount}`;
      params.push(is_public === 'true');
    }

    if (sport) {
      paramCount++;
      query += ` AND teams.sport = $${paramCount}`;
      params.push(sport);
    }

    query += ' GROUP BY t.id, teams.name, teams.sport, teams.avatar ORDER BY t.training_date ASC, t.training_time ASC';

    const result = await pool.query(query, params);

    res.json({ trainings: result.rows });
  } catch (error) {
    console.error('Get trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Kullanıcının kayıt olduğu yaklaşan antrenmanlar
app.get('/api/trainings/my-joined', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
             teams.name as team_name,
             teams.sport as team_sport,
             teams.avatar as team_avatar,
             COUNT(DISTINCT ta2.user_id) as attendee_count
      FROM trainings t
      JOIN teams ON t.team_id = teams.id
      JOIN training_attendees ta ON t.id = ta.training_id AND ta.user_id = $1
      LEFT JOIN training_attendees ta2 ON t.id = ta2.training_id
      WHERE (
        t.training_date > CURRENT_DATE
        OR (t.training_date = CURRENT_DATE AND t.training_time >= CURRENT_TIME)
      )
      GROUP BY t.id, teams.name, teams.sport, teams.avatar
      ORDER BY t.training_date ASC, t.training_time ASC
    `, [req.user.id]);
    res.json({ trainings: result.rows });
  } catch (error) {
    console.error('my-joined trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Kullanıcının üye olduğu takımların yaklaşan antrenmanları (katılmadıkları)
app.get('/api/trainings/my-team-trainings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
             teams.name as team_name,
             teams.sport as team_sport,
             teams.avatar as team_avatar,
             COUNT(DISTINCT ta.user_id) as attendee_count
      FROM trainings t
      JOIN teams ON t.team_id = teams.id
      LEFT JOIN training_attendees ta ON t.id = ta.training_id
      WHERE teams.id IN (
        SELECT team_id FROM team_members WHERE user_id = $1
      )
      AND NOT EXISTS (
        SELECT 1 FROM training_attendees WHERE training_id = t.id AND user_id = $1
      )
      AND (
        t.training_date > CURRENT_DATE
        OR (t.training_date = CURRENT_DATE AND t.training_time >= CURRENT_TIME)
      )
      GROUP BY t.id, teams.name, teams.sport, teams.avatar
      ORDER BY t.training_date ASC, t.training_time ASC
    `, [req.user.id]);
    res.json({ trainings: result.rows });
  } catch (error) {
    console.error('my-team-trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/trainings/nearby', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat ve lng gerekli' });

    const userId = req.user?.id || null;

    // Gizlilik: giriş yapmamış → herkese açık takımlar veya public; giriş yapmış → + kendi takımları
    const privacyFilter = userId
      ? `(teams.is_private = false OR t.is_public = true OR teams.id IN (SELECT team_id FROM team_members WHERE user_id = ${parseInt(userId)}))`
      : `(teams.is_private = false OR t.is_public = true)`;

    const result = await pool.query(
      `SELECT * FROM (
         SELECT t.*,
           teams.name  AS team_name,
           teams.sport AS team_sport,
           teams.avatar AS team_avatar,
           COALESCE(
             (SELECT COUNT(*) FROM training_attendees ta WHERE ta.training_id = t.id),
             0
           ) AS attendee_count,
           (6371 * acos(LEAST(1.0,
             cos(radians($1)) * cos(radians(t.location_lat)) * cos(radians(t.location_lng) - radians($2))
             + sin(radians($1)) * sin(radians(t.location_lat))
           ))) AS distance
         FROM trainings t
         JOIN teams ON t.team_id = teams.id
         WHERE t.location_lat IS NOT NULL
           AND t.location_lng IS NOT NULL
           AND (
             t.training_date > CURRENT_DATE
             OR (t.training_date = CURRENT_DATE AND t.training_time >= CURRENT_TIME)
           )
           AND ${privacyFilter}
       ) sub
       WHERE distance <= $3
       ORDER BY distance ASC`,
      [parseFloat(lat), parseFloat(lng), parseFloat(radius)]
    );

    res.json({ trainings: result.rows });
  } catch (error) {
    console.error('Nearby trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/trainings/:id', optionalAuth, async (req, res) => {
  try {
    const trainingId = req.params.id;

    const trainingResult = await pool.query(
      `SELECT t.*,
              teams.name as team_name,
              teams.sport as team_sport,
              teams.avatar as team_avatar,
              teams.owner_id as team_owner_id,
              teams.is_private as team_is_private,
              COUNT(DISTINCT ta.user_id) as attendee_count
       FROM trainings t
       JOIN teams ON t.team_id = teams.id
       LEFT JOIN training_attendees ta ON t.id = ta.training_id
       WHERE t.id = $1
       GROUP BY t.id, teams.name, teams.sport, teams.avatar, teams.owner_id, teams.is_private`,
      [trainingId]
    );

    if (trainingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const training = trainingResult.rows[0];

    // Gizlilik kontrolü: takım herkese açıksa veya antrenman public ise herkes görebilir
    const isPubliclyVisible = !training.team_is_private || training.is_public;
    if (!isPubliclyVisible) {
      if (!req.user) {
        return res.status(401).json({ error: 'Bu antrenmanı görmek için giriş yapmanız gerekiyor.', requiresAuth: true });
      }
      const memberCheck = await pool.query(
        'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
        [training.team_id, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Bu antrenman gizli bir takıma ait. Erişim yetkiniz yok.' });
      }
    }

    const attendeesResult = await pool.query(
      `SELECT u.id, u.name, u.avatar, ta.status, ta.joined_at
       FROM training_attendees ta
       JOIN users u ON ta.user_id = u.id
       WHERE ta.training_id = $1
       ORDER BY ta.joined_at ASC`,
      [trainingId]
    );

    training.attendees = attendeesResult.rows;

    // Get comments
    const commentsResult = await pool.query(
      `SELECT tc.*, u.name as user_name, u.avatar as user_avatar
       FROM training_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.training_id = $1
       ORDER BY tc.created_at DESC`,
      [trainingId]
    );

    training.comments = commentsResult.rows;

    res.json({ training });
  } catch (error) {
    console.error('Get training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/trainings/:id/join', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;

    const trainingResult = await pool.query('SELECT * FROM trainings WHERE id = $1', [trainingId]);

    if (trainingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const training = trainingResult.rows[0];

    // Gizlilik kontrolü: public değilse sadece takım üyesi katılabilir
    if (!training.is_public) {
      const memberCheck = await pool.query(
        'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
        [training.team_id, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Bu antrenman gizli bir takıma ait. Sadece takım üyeleri katılabilir.' });
      }
    }

    const attendeeCount = await pool.query(
      'SELECT COUNT(*) FROM training_attendees WHERE training_id = $1',
      [trainingId]
    );

    if (parseInt(attendeeCount.rows[0].count) >= training.capacity) {
      return res.status(409).json({ error: 'Training is at full capacity' });
    }

    const attendeeCheck = await pool.query(
      'SELECT id FROM training_attendees WHERE training_id = $1 AND user_id = $2',
      [trainingId, req.user.id]
    );

    if (attendeeCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Already joined this training' });
    }

    await pool.query(
      'INSERT INTO training_attendees (training_id, user_id, status) VALUES ($1, $2, $3)',
      [trainingId, req.user.id, 'confirmed']
    );

    await updateUserStats(req.user.id);

    logActivity('training_join', req.user.id, null, { training_title: training.title });
    res.json({ message: 'Successfully joined the training' });
  } catch (error) {
    console.error('Join training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Antrenman ayrıl
app.delete('/api/trainings/:id/leave', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;
    const trainingRow = await pool.query('SELECT title FROM trainings WHERE id = $1', [trainingId]);
    const trainingTitle = trainingRow.rows[0]?.title || '';
    const result = await pool.query(
      'DELETE FROM training_attendees WHERE training_id = $1 AND user_id = $2 RETURNING id',
      [trainingId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bu antrenmana zaten kayıtlı değilsiniz.' });
    }
    await updateUserStats(req.user.id);
    logActivity('training_leave', req.user.id, null, { training_title: trainingTitle });
    res.json({ message: 'Antrenman kaydınız silindi.' });
  } catch (error) {
    console.error('Leave training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/trainings/:id/comments', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Yorum boş olamaz.' });
    }

    // Yorumu kaydet
    const result = await pool.query(
      `INSERT INTO training_comments (training_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [trainingId, req.user.id, comment.trim()]
    );

    // Yorumu yapanın bilgilerini çek
    const commenterResult = await pool.query(
      'SELECT name, avatar FROM users WHERE id = $1',
      [req.user.id]
    );
    const commenter = commenterResult.rows[0];

    // Antrenman + takım bilgilerini çek
    const trainingResult = await pool.query(
      `SELECT t.title, t.training_date, t.team_id, teams.name as team_name
       FROM trainings t
       JOIN teams ON t.team_id = teams.id
       WHERE t.id = $1`,
      [trainingId]
    );
    const training = trainingResult.rows[0];

    if (training && commenter) {
      const trainingDate = formatTrDate(training.training_date);

      // Katılımcılar + takım sahibi (yorumcu hariç, tekrarsız)
      const recipientsResult = await pool.query(
        `SELECT DISTINCT u.id, u.name, u.email
         FROM users u
         WHERE u.id IN (
           -- Antrenmana kayıtlı kişiler
           SELECT user_id FROM training_attendees WHERE training_id = $1
           UNION
           -- Takım sahibi / adminler
           SELECT user_id FROM team_members WHERE team_id = $2 AND role IN ('owner','admin')
         )
         AND u.id != $3`,
        [trainingId, training.team_id, req.user.id]
      );

      // Bildirim + mail (paralel, hata durumunda ana akışı kesmez)
      recipientsResult.rows.forEach(async (recipient) => {
        try {
          await createNotif(recipient.id, {
            title: `${training.title} — Yeni Yorum`,
            message: `${commenter.name}: ${comment.trim().slice(0, 80)}${comment.length > 80 ? '...' : ''}`,
            type: 'training_comment',
            refId: trainingId,
            url: `/antrenmanlar`,
          });

          sendEmail({
            to: recipient.email,
            subject: `${training.title} antrenmanına yorum yapıldı`,
            html: trainingCommentEmail({
              commenterName: commenter.name,
              commenterAvatar: commenter.avatar,
              trainingTitle: training.title,
              trainingDate,
              comment: comment.trim(),
              trainingId,
            }),
          });
        } catch (notifErr) {
          console.error('Training comment notif error for', recipient.email, notifErr);
        }
      });
    }

    res.json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/trainings/:id', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;
    const { title, description, training_date, training_time, location_name, location_lat, location_lng, capacity, difficulty } = req.body;

    const trainingResult = await pool.query(
      'SELECT team_id FROM trainings WHERE id = $1',
      [trainingId]
    );

    if (trainingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [trainingResult.rows[0].team_id, req.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Only team owners/admins can edit trainings' });
    }

    const result = await pool.query(
      `UPDATE trainings
       SET title = $1, description = $2, training_date = $3, training_time = $4,
           location_name = $5, location_lat = $6, location_lng = $7,
           capacity = $8, difficulty = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [title, description, training_date, training_time, location_name, location_lat || null, location_lng || null, capacity, difficulty, trainingId]
    );

    const updated = result.rows[0];

    // Güncelleyenin adını çek
    const updaterResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const updaterName = updaterResult.rows[0]?.name;

    // Takım adını çek
    const teamNameResult = await pool.query('SELECT name FROM teams WHERE id = $1', [trainingResult.rows[0].team_id]);
    const teamName = teamNameResult.rows[0]?.name;

    // Katılımcılar (güncelleyen hariç)
    const attendeesResult = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM training_attendees ta
       JOIN users u ON u.id = ta.user_id
       WHERE ta.training_id = $1 AND ta.user_id != $2`,
      [trainingId, req.user.id]
    );

    const trainingDate = formatTrDate(training_date);

    attendeesResult.rows.forEach(async (attendee) => {
      try {
        await createNotif(attendee.id, {
          title: `${updated.title} güncellendi`,
          message: `${updaterName || 'Antrenör'} antrenman bilgilerini güncelledi.`,
          type: 'training_update',
          refId: trainingId,
          url: `/antrenmanlar`,
        });
        sendEmail({
          to: attendee.email,
          subject: `${updated.title} antrenmanında değişiklik var`,
          html: trainingUpdateEmail({
            teamName: teamName || '',
            trainingTitle: updated.title,
            trainingDate,
            trainingTime: training_time,
            location: location_name,
            description,
            updaterName,
          }),
        });
      } catch (notifErr) {
        console.error('Training update notif error for', attendee.email, notifErr);
      }
    });

    res.json({ training: updated });
  } catch (error) {
    console.error('Update training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/trainings/:id', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;

    const trainingResult = await pool.query(
      'SELECT team_id FROM trainings WHERE id = $1',
      [trainingId]
    );

    if (trainingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [trainingResult.rows[0].team_id, req.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Only team owners/admins can delete trainings' });
    }

    await pool.query('DELETE FROM trainings WHERE id = $1', [trainingId]);

    res.json({ message: 'Training deleted' });
  } catch (error) {
    console.error('Delete training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// USER STATS & BADGES
// =====================================================

app.get('/api/users/:id/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    const statsResult = await pool.query(
      'SELECT * FROM user_stats WHERE user_id = $1',
      [userId]
    );

    const badgesResult = await pool.query(
      `SELECT b.*, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [userId]
    );

    const stats = statsResult.rows[0] || {
      total_trainings: 0,
      total_distance: 0,
      total_duration: 0,
    };

    stats.badges = badgesResult.rows;

    res.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/badges', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM badges ORDER BY requirement_value ASC');
    res.json({ badges: result.rows });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/:id/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // İstanbul timezone'unda bugünün tarih string'ini üret (YYYY-MM-DD)
    // Node.js UTC'de çalışıyor, DB session 'Europe/Istanbul' — ikisini senkronize etmek için
    // her iki tarafta da İstanbul tarihini explicit olarak kullanıyoruz.
    const istFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' });
    const todayIST = istFmt.format(new Date()); // 'YYYY-MM-DD'

    // İstanbul tarihine gün ekle/çıkar (UTC öğlen saatinden yapılır — DST güvenli)
    const addDays = (dateStr, days) => {
      const d = new Date(dateStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().split('T')[0];
    };

    const sixDaysAgo = addDays(todayIST, -6);

    // Son 7 günün tamamlanmış antrenmanları
    // Tarih parametreleri Node'dan geliyor → DB ve JS tarihleri her zaman uyumlu
    const result = await pool.query(
      `SELECT
         t.training_date::date as date,
         COUNT(DISTINCT ta.training_id) as count,
         json_agg(json_build_object('title', t.title) ORDER BY t.training_time) as trainings
       FROM training_attendees ta
       JOIN trainings t ON ta.training_id = t.id
       WHERE ta.user_id = $1
         AND t.training_date::date >= $2::date
         AND t.training_date::date <= $3::date
         AND (
           t.training_date::date < $3::date
           OR (t.training_date::date = $3::date AND t.training_time <= CURRENT_TIME)
         )
       GROUP BY t.training_date::date
       ORDER BY date ASC`,
      [userId, sixDaysAgo, todayIST]
    );

    // DB'den dönen date: PostgreSQL DATE → JS Date objesi (UTC gece yarısı)
    // Güvenli karşılaştırma için .toISOString() yerine direkt format
    const rowDateStr = (row) => {
      const d = row.date;
      if (typeof d === 'string') return d.slice(0, 10);
      // Date object → YYYY-MM-DD UTC (DATE kolonu UTC gece yarısında gelir)
      return d.toISOString().split('T')[0];
    };

    // Streak hesabı — 30 gün geriye git (İstanbul tarihleri ile)
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const ds = addDays(todayIST, -i);
      const found = result.rows.find(r => rowDateStr(r) === ds);
      if (found && parseInt(found.count) > 0) { streak++; } else if (i > 0) { break; }
    }

    // Son 7 günü doldur (boş günler için 0)
    const DAY_NAMES = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = addDays(todayIST, -i);
      const dayData = result.rows.find(r => rowDateStr(r) === dateStr);
      // Hücre gün adı: UTC öğlen saatinden hesaplanır → DST güvenli
      const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay();
      last7Days.push({
        date: dateStr,
        day: DAY_NAMES[dayOfWeek],
        count: dayData ? parseInt(dayData.count) : 0,
        trainings: dayData ? dayData.trainings : [],
        isToday: i === 0,
      });
    }

    const weekTotal = last7Days.reduce((s, d) => s + d.count, 0);
    res.json({ activity: last7Days, streak, weekTotal });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// =====================================================
// NOTIFICATIONS
// =====================================================

// SSE stream — token query param üzerinden auth (EventSource header desteklemez)
app.get('/api/notifications/stream', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  let userId;
  try {
    userId = require('jsonwebtoken').verify(token, JWT_SECRET).id;
  } catch {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
  res.write(`data: ${JSON.stringify({ event: 'connected' })}\n\n`);

  const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 25000);
  req.on('close', () => {
    clearInterval(hb);
    sseClients.get(userId)?.delete(res);
  });
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// SEARCH
// =====================================================

app.get('/api/search', authenticateToken, async (req, res) => {
  try {
    const { q, type } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results = {};

    if (!type || type === 'trainings') {
      const trainingsResult = await pool.query(
        `SELECT t.*, teams.name as team_name, teams.sport as team_sport
         FROM trainings t
         JOIN teams ON t.team_id = teams.id
         WHERE (t.title ILIKE $1 OR t.description ILIKE $1 OR teams.sport ILIKE $1)
           AND (t.is_public = true OR teams.id IN (
             SELECT team_id FROM team_members WHERE user_id = $2
           ))
         LIMIT 10`,
        [`%${q}%`, req.user.id]
      );
      results.trainings = trainingsResult.rows;
    }

    if (!type || type === 'teams') {
      const teamsResult = await pool.query(
        `SELECT t.*
         FROM teams t
         WHERE (t.name ILIKE $1 OR t.description ILIKE $1 OR t.sport ILIKE $1)
           AND (t.is_private = false OR t.id IN (
             SELECT team_id FROM team_members WHERE user_id = $2
           ))
         LIMIT 10`,
        [`%${q}%`, req.user.id]
      );
      results.teams = teamsResult.rows;
    }

    if (!type || type === 'users') {
      const usersResult = await pool.query(
        `SELECT id, name, email, avatar
         FROM users
         WHERE name ILIKE $1 OR email ILIKE $1
         LIMIT 10`,
        [`%${q}%`]
      );
      results.users = usersResult.rows;
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// ADMIN ROUTES
// =====================================================

// ─── ADMIN STATS ─────────────────────────────────────
app.get('/api/admin/stats', isAdmin, async (req, res) => {
  try {
    const [userCount, trainingCount, teamCount, completedTrainings, contactCount, recentUsers] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM trainings'),
      pool.query('SELECT COUNT(*) FROM teams'),
      pool.query(`SELECT COUNT(*) FROM trainings WHERE training_date < CURRENT_DATE OR (training_date = CURRENT_DATE AND training_time < CURRENT_TIME)`),
      pool.query("SELECT COUNT(*) FROM contact_messages WHERE is_read = false"),
      pool.query("SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5"),
    ]);

    res.json({
      users: parseInt(userCount.rows[0].count),
      trainings: parseInt(trainingCount.rows[0].count),
      teams: parseInt(teamCount.rows[0].count),
      completedTrainings: parseInt(completedTrainings.rows[0].count),
      unreadContact: parseInt(contactCount.rows[0].count),
      recentUsers: recentUsers.rows,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── ADMIN USERS ─────────────────────────────────────
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.avatar, u.is_admin, u.created_at,
        COUNT(DISTINCT tm.team_id) as team_count,
        COUNT(DISTINCT ta.training_id) as training_count
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id
      LEFT JOIN training_attendees ta ON u.id = ta.user_id
      GROUP BY u.id, u.name, u.email, u.avatar, u.is_admin, u.created_at
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Kullanıcı silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.put('/api/admin/users/:id/toggle-admin', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE users SET is_admin = NOT is_admin WHERE id = $1 RETURNING id, name, is_admin',
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle admin' });
  }
});

// ─── ADMIN TRAININGS ────────────────────────────────
app.get('/api/admin/trainings', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, teams.name as team_name,
        COUNT(ta.user_id) as participant_count
      FROM trainings t
      LEFT JOIN teams ON t.team_id = teams.id
      LEFT JOIN training_attendees ta ON t.id = ta.training_id
      GROUP BY t.id, teams.name
      ORDER BY t.training_date DESC, t.training_time DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trainings' });
  }
});

app.delete('/api/admin/trainings/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM trainings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Antrenman silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete training' });
  }
});

// ─── ADMIN TEAMS ────────────────────────────────────
app.get('/api/admin/teams', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.name as owner_name,
        COUNT(tm.user_id) as member_count
      FROM teams t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      GROUP BY t.id, u.name
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.delete('/api/admin/teams/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM teams WHERE id = $1', [req.params.id]);
    res.json({ message: 'Takım silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ─── ADMIN CONTACT MESSAGES ─────────────────────────
app.get('/api/admin/contact', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contact_messages ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.put('/api/admin/contact/:id/read', isAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE contact_messages SET is_read = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Okundu.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

app.delete('/api/admin/contact/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM contact_messages WHERE id = $1', [req.params.id]);
    res.json({ message: 'Mesaj silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ─── PUBLIC: İLETİŞİM FORMU ────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
    }

    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, subject, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), email.trim(), subject.trim(), message.trim()]
    );

    // Admin'e mail gönder
    const adminResult = await pool.query('SELECT email FROM users WHERE is_admin = true LIMIT 1');
    if (adminResult.rows[0]) {
      sendEmail({
        to: adminResult.rows[0].email,
        subject: `📬 Yeni İletişim Mesajı: ${subject}`,
        html: emailWrapper(`
          <h2 style="margin:0 0 16px;color:#1e293b;">Yeni İletişim Formu Mesajı</h2>
          <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;">
            <p style="margin:0 0 8px;"><strong>Ad:</strong> ${name}</p>
            <p style="margin:0 0 8px;"><strong>E-posta:</strong> ${email}</p>
            <p style="margin:0 0 8px;"><strong>Konu:</strong> ${subject}</p>
          </div>
          <div style="background:#f8fafc;border-left:3px solid #00b7ba;border-radius:8px;padding:20px;">
            <p style="margin:0;color:#334155;line-height:1.7;white-space:pre-wrap;">${message}</p>
          </div>
          <div style="margin-top:24px;text-align:center;">
            <a href="${APP_URL}?page=admin&tab=contact"
               style="display:inline-block;background:linear-gradient(135deg,#00b7ba,#009295);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">
              Panelde Görüntüle →
            </a>
          </div>
        `),
      });
    }

    // Gönderene teşekkür maili
    sendEmail({
      to: email,
      subject: 'Mesajınız alındı — Muuvlink',
      html: emailWrapper(`
        <h2 style="margin:0 0 12px;color:#1e293b;">Mesajınız için teşekkürler, ${name}!</h2>
        <p style="color:#64748b;line-height:1.7;margin:0 0 20px;">
          Mesajınız başarıyla alındı. En kısa sürede size dönüş yapacağız.
        </p>
        <div style="background:#f8fafc;border-left:3px solid #00b7ba;border-radius:8px;padding:20px;">
          <p style="margin:0 0 8px;font-weight:600;color:#1e293b;">Konu: ${subject}</p>
          <p style="margin:0;color:#64748b;font-size:14px;white-space:pre-wrap;">${message.slice(0, 200)}${message.length > 200 ? '...' : ''}</p>
        </div>
      `),
    });

    res.json({ message: 'Mesajınız başarıyla gönderildi.', id: result.rows[0].id });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ error: 'Mesaj gönderilemedi.' });
  }
});

// =====================================================
// HEALTH CHECK
// =====================================================

// =====================================================
// BANNER ROUTES
// =====================================================

// Public: aktif bannerları getir
// ─── Platform İstatistikleri (public) ──────────────────────────────────────
app.get('/api/platform-stats', async (req, res) => {
  try {
    const [users, trainings, teams, badges] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users`),
      pool.query(`SELECT COUNT(*) FROM trainings`),
      pool.query(`SELECT COUNT(*) FROM teams`),
      pool.query(`SELECT COUNT(*) FROM user_badges`),
    ]);
    res.json({
      users:     parseInt(users.rows[0].count),
      trainings: parseInt(trainings.rows[0].count),
      teams:     parseInt(teams.rows[0].count),
      badges:    parseInt(badges.rows[0].count),
    });
  } catch (e) {
    res.status(500).json({ error: 'İstatistikler alınamadı.' });
  }
});


app.get('/api/banners', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM banners WHERE is_active = true ORDER BY order_index ASC, created_at ASC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Bannerlar alınamadı.' });
  }
});

// Admin: tüm bannerları getir
app.get('/api/admin/banners', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM banners ORDER BY order_index ASC, created_at ASC`);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Bannerlar alınamadı.' });
  }
});

// Admin: banner oluştur
app.post('/api/admin/banners', isAdmin, async (req, res) => {
  try {
    // mottos ve renk kolonlarını ekle (yoksa)
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS mottos JSONB DEFAULT '[]'`);
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_1 TEXT DEFAULT '#00b7ba'`);
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_2 TEXT DEFAULT '#981dd8'`);
    const { title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
            cta_primary_url, cta_secondary_url,
            gradient_from, gradient_via, gradient_to, order_index, is_active, mottos,
            motto_color_1, motto_color_2, title_color, subtitle_color } = req.body;
    const result = await pool.query(
      `INSERT INTO banners (title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
        cta_primary_url, cta_secondary_url,
        gradient_from, gradient_via, gradient_to, order_index, is_active, mottos,
        motto_color_1, motto_color_2, title_color, subtitle_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
       cta_primary_url || '', cta_secondary_url || '',
       gradient_from || '#0D0B26', gradient_via || '#1a1040', gradient_to || '#0f2044',
       order_index || 0, is_active !== false,
       JSON.stringify(Array.isArray(mottos) && mottos.length ? mottos : []),
       motto_color_1 || '#00b7ba', motto_color_2 || '#981dd8',
       title_color || '#ffffff', subtitle_color || 'rgba(186,230,253,0.75)']
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: banner güncelle
app.put('/api/admin/banners/:id', isAdmin, async (req, res) => {
  try {
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS mottos JSONB DEFAULT '[]'`);
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_1 TEXT DEFAULT '#00b7ba'`);
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_2 TEXT DEFAULT '#981dd8'`);
    const { title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
            cta_primary_url, cta_secondary_url,
            gradient_from, gradient_via, gradient_to, order_index, is_active, mottos,
            motto_color_1, motto_color_2, title_color, subtitle_color } = req.body;
    const result = await pool.query(
      `UPDATE banners SET title=$1, subtitle=$2, badge_text=$3,
        cta_primary_text=$4, cta_secondary_text=$5,
        cta_primary_url=$6, cta_secondary_url=$7,
        gradient_from=$8, gradient_via=$9, gradient_to=$10,
        order_index=$11, is_active=$12, mottos=$13,
        motto_color_1=$14, motto_color_2=$15,
        title_color=$16, subtitle_color=$17
       WHERE id=$18 RETURNING *`,
      [title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
       cta_primary_url || '', cta_secondary_url || '',
       gradient_from, gradient_via, gradient_to, order_index, is_active,
       JSON.stringify(Array.isArray(mottos) && mottos.length ? mottos : []),
       motto_color_1 || '#00b7ba', motto_color_2 || '#981dd8',
       title_color || '#ffffff', subtitle_color || 'rgba(186,230,253,0.75)',
       req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: banner görseli yükle
app.post('/api/admin/banners/:id/image', isAdmin, uploadBanner.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi.' });
    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `banner-${req.params.id}-${Date.now()}${ext}`;
    const imageUrl = await uploadToSupabase('banners', fileName, req.file.buffer, req.file.mimetype);

    const result = await pool.query(
      'UPDATE banners SET image_url=$1 WHERE id=$2 RETURNING *',
      [imageUrl, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: banner sil
app.delete('/api/admin/banners/:id', isAdmin, async (req, res) => {
  try {
    const old = await pool.query('SELECT image_url FROM banners WHERE id=$1', [req.params.id]);
    if (old.rows[0]?.image_url) {
      const oldPath = path.join(__dirname, old.rows[0].image_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await pool.query('DELETE FROM banners WHERE id=$1', [req.params.id]);
    res.json({ message: 'Banner silindi.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =====================================================
// HOME NEWS
// =====================================================

app.get('/api/home-news', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM home_news WHERE is_active=true ORDER BY order_index ASC, created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/home-news', isAdmin, async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM home_news ORDER BY order_index ASC, created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/home-news', isAdmin, async (req, res) => {
  const { title, description, date_label, icon, bg, views, comments, is_active, order_index } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO home_news (title, description, date_label, icon, bg, views, comments, is_active, order_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, description||'', date_label||'', icon||'', bg||'linear-gradient(160deg,#0f2a1a,#1a4a2d)',
       views||0, comments||0, is_active!==false, order_index||0]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/home-news/:id', isAdmin, async (req, res) => {
  const { title, description, date_label, icon, bg, views, comments, is_active, order_index } = req.body;
  try {
    const r = await pool.query(
      `UPDATE home_news SET title=$1, description=$2, date_label=$3, icon=$4, bg=$5, views=$6, comments=$7,
       is_active=$8, order_index=$9 WHERE id=$10 RETURNING *`,
      [title, description||'', date_label||'', icon||'', bg, views||0, comments||0, is_active!==false, order_index||0, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/home-news/:id/image', isAdmin, uploadBanner.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yok.' });
    const fileName = `home-news-${req.params.id}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
    const imageUrl = await uploadToSupabase('banners', fileName, req.file.buffer, req.file.mimetype);
    const r = await pool.query('UPDATE home_news SET image_url=$1 WHERE id=$2 RETURNING *', [imageUrl, req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/home-news/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM home_news WHERE id=$1', [req.params.id]);
    res.json({ message: 'Silindi.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================
// HOME GALLERY
// =====================================================

app.get('/api/home-gallery', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM home_gallery WHERE is_active=true ORDER BY order_index ASC, created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/home-gallery', isAdmin, async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM home_gallery ORDER BY order_index ASC, created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/home-gallery', isAdmin, async (req, res) => {
  const { icon, bg, is_active, order_index } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO home_gallery (icon, bg, is_active, order_index)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [icon||'', bg||'linear-gradient(160deg,#0f2a1a,#1a4a2d)', is_active!==false, order_index||0]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/home-gallery/:id', isAdmin, async (req, res) => {
  const { icon, bg, is_active, order_index } = req.body;
  try {
    const r = await pool.query(
      `UPDATE home_gallery SET icon=$1, bg=$2, is_active=$3, order_index=$4 WHERE id=$5 RETURNING *`,
      [icon||'', bg, is_active!==false, order_index||0, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/home-gallery/:id/image', isAdmin, uploadBanner.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yok.' });
    const fileName = `home-gallery-${req.params.id}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
    const imageUrl = await uploadToSupabase('banners', fileName, req.file.buffer, req.file.mimetype);
    const r = await pool.query('UPDATE home_gallery SET image_url=$1 WHERE id=$2 RETURNING *', [imageUrl, req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/home-gallery/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM home_gallery WHERE id=$1', [req.params.id]);
    res.json({ message: 'Silindi.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================
// ADMIN: LOGS & ANALYTICS
// =====================================================

app.get('/api/admin/logs', isAdmin, async (req, res) => {
  try {
    const { event_type, limit: limitParam } = req.query;
    const limit = Math.min(parseInt(limitParam) || 200, 500);
    let query = `
      SELECT al.*, u.email as user_email
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
    `;
    const params = [];
    if (event_type && event_type !== 'all') {
      params.push(event_type);
      query += ` WHERE al.event_type = $${params.length}`;
    }
    params.push(limit);
    query += ` ORDER BY al.created_at DESC LIMIT $${params.length}`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error('admin logs error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/analytics', isAdmin, async (req, res) => {
  try {
    const [usersDaily, teamsDaily, teamJoinsDaily, trainingsDaily, joinsDaily,
           usersWeekly, teamsWeekly, teamJoinsWeekly, trainingsWeekly, joinsWeekly,
           usersMonthly, teamsMonthly, teamJoinsMonthly, trainingsMonthly, joinsMonthly,
           totals] = await Promise.all([
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM teams WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM activity_logs WHERE event_type = 'team_join' AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM trainings WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE(COALESCE(created_at, NOW()) AT TIME ZONE 'Europe/Istanbul') as day, COUNT(*) as count
        FROM training_attendees WHERE COALESCE(created_at, NOW()) >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM users WHERE created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM teams WHERE created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM activity_logs WHERE event_type = 'team_join' AND created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM trainings WHERE created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('week', COALESCE(created_at, NOW()) AT TIME ZONE 'Europe/Istanbul') as week, COUNT(*) as count
        FROM training_attendees WHERE COALESCE(created_at, NOW()) >= NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM users WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM teams WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM activity_logs WHERE event_type = 'team_join' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM trainings WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', COALESCE(created_at, NOW()) AT TIME ZONE 'Europe/Istanbul') as month, COUNT(*) as count
        FROM training_attendees WHERE COALESCE(created_at, NOW()) >= NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month ASC
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users     WHERE created_at >= CURRENT_DATE) as today_users,
          (SELECT COUNT(*) FROM teams     WHERE created_at >= CURRENT_DATE) as today_teams,
          (SELECT COUNT(*) FROM activity_logs WHERE event_type='team_join' AND created_at >= CURRENT_DATE) as today_team_joins,
          (SELECT COUNT(*) FROM trainings WHERE created_at >= CURRENT_DATE) as today_trainings,
          (SELECT COUNT(*) FROM users     WHERE created_at >= DATE_TRUNC('week',  NOW())) as week_users,
          (SELECT COUNT(*) FROM teams     WHERE created_at >= DATE_TRUNC('week',  NOW())) as week_teams,
          (SELECT COUNT(*) FROM activity_logs WHERE event_type='team_join' AND created_at >= DATE_TRUNC('week',NOW())) as week_team_joins,
          (SELECT COUNT(*) FROM trainings WHERE created_at >= DATE_TRUNC('week',  NOW())) as week_trainings,
          (SELECT COUNT(*) FROM users     WHERE created_at >= DATE_TRUNC('month', NOW())) as month_users,
          (SELECT COUNT(*) FROM teams     WHERE created_at >= DATE_TRUNC('month', NOW())) as month_teams,
          (SELECT COUNT(*) FROM activity_logs WHERE event_type='team_join' AND created_at >= DATE_TRUNC('month',NOW())) as month_team_joins,
          (SELECT COUNT(*) FROM trainings WHERE created_at >= DATE_TRUNC('month', NOW())) as month_trainings,
          (SELECT COUNT(*) FROM training_attendees WHERE COALESCE(created_at,NOW()) >= CURRENT_DATE) as today_joins,
          (SELECT COUNT(*) FROM training_attendees WHERE COALESCE(created_at,NOW()) >= DATE_TRUNC('week',NOW())) as week_joins,
          (SELECT COUNT(*) FROM training_attendees WHERE COALESCE(created_at,NOW()) >= DATE_TRUNC('month',NOW())) as month_joins
      `),
    ]);

    // Build daily array (last 30 days)
    const dailyMap = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, users: 0, teams: 0, teamJoins: 0, trainings: 0, joins: 0 };
    }
    const toKey = (val) => val?.toISOString?.()?.slice(0,10) || String(val).slice(0,10);
    usersDaily.rows.forEach(r      => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].users     = parseInt(r.count); });
    teamsDaily.rows.forEach(r      => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].teams     = parseInt(r.count); });
    teamJoinsDaily.rows.forEach(r  => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].teamJoins = parseInt(r.count); });
    trainingsDaily.rows.forEach(r  => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].trainings = parseInt(r.count); });
    joinsDaily.rows.forEach(r      => { const k = toKey(r.day);  if (dailyMap[k]) dailyMap[k].joins     = parseInt(r.count); });

    // Weekly map
    const weeklyMap = {};
    const toWeekKey = (val) => val?.toISOString?.()?.slice(0,10) || String(val).slice(0,10);
    const ensureWeek  = (k) => { weeklyMap[k]  = weeklyMap[k]  || { date: k, users: 0, teams: 0, teamJoins: 0, trainings: 0, joins: 0 }; };
    usersWeekly.rows.forEach(r      => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].users     = parseInt(r.count); });
    teamsWeekly.rows.forEach(r      => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].teams     = parseInt(r.count); });
    teamJoinsWeekly.rows.forEach(r  => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].teamJoins = parseInt(r.count); });
    trainingsWeekly.rows.forEach(r  => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].trainings = parseInt(r.count); });
    joinsWeekly.rows.forEach(r      => { const k = toWeekKey(r.week); ensureWeek(k); weeklyMap[k].joins     = parseInt(r.count); });

    // Monthly map
    const monthlyMap = {};
    const toMonthKey = (val) => val?.toISOString?.()?.slice(0,7) || String(val).slice(0,7);
    const ensureMonth = (k) => { monthlyMap[k] = monthlyMap[k] || { date: k, users: 0, teams: 0, teamJoins: 0, trainings: 0, joins: 0 }; };
    usersMonthly.rows.forEach(r      => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].users     = parseInt(r.count); });
    teamsMonthly.rows.forEach(r      => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].teams     = parseInt(r.count); });
    teamJoinsMonthly.rows.forEach(r  => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].teamJoins = parseInt(r.count); });
    trainingsMonthly.rows.forEach(r  => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].trainings = parseInt(r.count); });
    joinsMonthly.rows.forEach(r      => { const k = toMonthKey(r.month); ensureMonth(k); monthlyMap[k].joins     = parseInt(r.count); });

    const t = totals.rows[0];
    res.json({
      daily:   Object.values(dailyMap),
      weekly:  Object.values(weeklyMap).sort((a,b)  => a.date.localeCompare(b.date)),
      monthly: Object.values(monthlyMap).sort((a,b) => a.date.localeCompare(b.date)),
      totals: {
        today: { users: parseInt(t.today_users), teams: parseInt(t.today_teams), teamJoins: parseInt(t.today_team_joins), trainings: parseInt(t.today_trainings), joins: parseInt(t.today_joins) },
        week:  { users: parseInt(t.week_users),  teams: parseInt(t.week_teams),  teamJoins: parseInt(t.week_team_joins),  trainings: parseInt(t.week_trainings),  joins: parseInt(t.week_joins)  },
        month: { users: parseInt(t.month_users), teams: parseInt(t.month_teams), teamJoins: parseInt(t.month_team_joins), trainings: parseInt(t.month_trainings), joins: parseInt(t.month_joins) },
      },
    });
  } catch (e) {
    console.error('admin analytics error:', e);
    res.status(500).json({ error: e.message });
  }
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Resim URL'sinden baskın rengi çıkar (frontend CORS sorununu bypass eder)
app.get('/api/color-extract', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'Geçersiz URL' });
  try {
    const sharp = require('sharp');
    const https = require('https');
    const http  = require('http');
    const fetch = (u) => new Promise((resolve, reject) => {
      const mod = u.startsWith('https') ? https : http;
      mod.get(u, r => {
        const chunks = [];
        r.on('data', d => chunks.push(d));
        r.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    const buf = await fetch(url);
    // 16x16'ya küçült, ham piksel olarak al
    const { data, info } = await sharp(buf)
      .resize(16, 16, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 3) {
      const pr = data[i], pg = data[i+1], pb = data[i+2];
      if (Math.max(pr,pg,pb) > 245 && Math.min(pr,pg,pb) > 220) continue; // beyaz
      if (Math.max(pr,pg,pb) < 15) continue;                               // siyah
      r += pr; g += pg; b += pb; n++;
    }

    if (n < 4) return res.json({ color: null });

    // Ham ortalama — boost yok (parlak renkleri karartma)
    const ar = Math.round(r/n), ag = Math.round(g/n), ab = Math.round(b/n);
    const hex = `#${[ar,ag,ab].map(c => c.toString(16).padStart(2,'0')).join('')}`;
    res.set('Cache-Control', 'public, max-age=86400');
    res.json({ color: hex });
  } catch (err) {
    console.error('color-extract error:', err.message);
    res.json({ color: null });
  }
});

// =====================================================
// START SERVER
// =====================================================

// DB migrations
pool.query(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id         SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name  TEXT,
    meta       JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    source_ref TEXT UNIQUE  -- backfill kayıtları için benzersiz ref (örn: 'user_1'), canlı kayıtlar NULL
  )
`).catch(() => {});

// source_ref sütunu yoksa ekle (eski kurulumlar için)
pool.query(`ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS source_ref TEXT`).catch(() => {});
pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS activity_logs_source_ref_idx ON activity_logs(source_ref) WHERE source_ref IS NOT NULL`).catch(() => {});
// training_attendees ve team_members tablolarına created_at ekle (yoksa)
pool.query(`ALTER TABLE training_attendees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`).catch(() => {});
pool.query(`ALTER TABLE team_members      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`).catch(() => {});

async function logActivity(event_type, user_id, user_name, meta = {}) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (event_type, user_id, user_name, meta) VALUES ($1, $2, $3, $4)',
      [event_type, user_id || null, user_name || null, JSON.stringify(meta)]
    );
  } catch (e) { /* sessiz */ }
}

// ── Geçmiş verilerini activity_logs'a yükle (idempotent) ──────────────────
async function backfillActivityLogs() {
  try {
    // Unique index'in hazır olmasını bekle
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS activity_logs_source_ref_idx ON activity_logs(source_ref) WHERE source_ref IS NOT NULL`).catch(() => {});

    // Kullanıcı kayıtları
    await pool.query(`
      INSERT INTO activity_logs (event_type, user_id, user_name, meta, created_at, source_ref)
      SELECT 'user_register', u.id, u.name,
             json_build_object('email', u.email),
             u.created_at,
             'user_register_' || u.id
      FROM users u
      WHERE NOT EXISTS (SELECT 1 FROM activity_logs al WHERE al.source_ref = 'user_register_' || u.id::text)
    `);

    // Takım oluşturma (owner)
    await pool.query(`
      INSERT INTO activity_logs (event_type, user_id, user_name, meta, created_at, source_ref)
      SELECT 'team_create', tm.user_id, u.name,
             json_build_object('team_name', t.name, 'sport', t.sport),
             t.created_at,
             'team_create_' || t.id
      FROM teams t
      JOIN team_members tm ON tm.team_id = t.id AND tm.role = 'owner'
      JOIN users u ON u.id = tm.user_id
      WHERE NOT EXISTS (SELECT 1 FROM activity_logs al WHERE al.source_ref = 'team_create_' || t.id::text)
    `);

    // Takıma katılma: team_members.created_at güvenilir değil (ALTER TABLE sırasında atandı)
    // Bu yüzden backfill yapılmıyor; gerçek zamanlı logActivity() kayıtları kullanılıyor.
    // Yanlış timestamp'li eski backfill kayıtlarını temizle:
    await pool.query(`DELETE FROM activity_logs WHERE source_ref LIKE 'team_join_%'`).catch(() => {});

    // Antrenman oluşturma
    await pool.query(`
      INSERT INTO activity_logs (event_type, user_id, user_name, meta, created_at, source_ref)
      SELECT 'training_create', tm.user_id, u.name,
             json_build_object('training_title', tr.title, 'team_name', t.name),
             tr.created_at,
             'training_create_' || tr.id
      FROM trainings tr
      JOIN teams t ON t.id = tr.team_id
      JOIN team_members tm ON tm.team_id = t.id AND tm.role = 'owner'
      JOIN users u ON u.id = tm.user_id
      WHERE NOT EXISTS (SELECT 1 FROM activity_logs al WHERE al.source_ref = 'training_create_' || tr.id::text)
    `);

    // Antrenmana katılma
    await pool.query(`
      INSERT INTO activity_logs (event_type, user_id, user_name, meta, created_at, source_ref)
      SELECT 'training_join', ta.user_id, u.name,
             json_build_object('training_title', tr.title),
             COALESCE(ta.created_at, NOW()),
             'training_join_' || ta.id
      FROM training_attendees ta
      JOIN users u ON u.id = ta.user_id
      JOIN trainings tr ON tr.id = ta.training_id
      WHERE NOT EXISTS (SELECT 1 FROM activity_logs al WHERE al.source_ref = 'training_join_' || ta.id::text)
    `);

    console.log('[backfill] activity_logs güncellendi.');
  } catch (e) {
    console.error('[backfill] Hata:', e.message);
  }
}

// Server hazır olduktan sonra backfill çalıştır
setTimeout(backfillActivityLogs, 3000);

pool.query(`
  CREATE TABLE IF NOT EXISTS home_news (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    date_label  TEXT DEFAULT '',
    icon        TEXT DEFAULT '',
    bg          TEXT DEFAULT 'linear-gradient(160deg,#1a3a2a 0%,#2d6a4f 100%)',
    views       INTEGER DEFAULT 0,
    comments    INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});
pool.query(`
  CREATE TABLE IF NOT EXISTS home_gallery (
    id          SERIAL PRIMARY KEY,
    icon        TEXT DEFAULT '',
    bg          TEXT DEFAULT 'linear-gradient(160deg,#0f2a1a,#1a4a2d)',
    is_active   BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});
pool.query(`ALTER TABLE home_news     ADD COLUMN IF NOT EXISTS image_url    TEXT DEFAULT NULL`).catch(() => {});
pool.query(`ALTER TABLE home_news     ADD COLUMN IF NOT EXISTS description  TEXT DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE home_gallery  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS mottos JSONB DEFAULT '[]'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_primary_url TEXT DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_secondary_url TEXT DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_1 TEXT DEFAULT '#00b7ba'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS motto_color_2 TEXT DEFAULT '#981dd8'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS title_color TEXT DEFAULT '#ffffff'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle_color TEXT DEFAULT 'rgba(186,230,253,0.75)'`).catch(() => {});
pool.query(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

// =====================================================
// ŞİFRE SIFIRLAMA
// =====================================================

// Şifremi unuttum — token üret, e-posta gönder
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-posta gerekli.' });
  try {
    const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
    // Güvenlik: kullanıcı bulunsun ya da bulunmasın aynı yanıtı dön
    if (result.rows.length === 0) return res.json({ message: 'E-posta gönderildi.' });

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

    // Önceki tokenları geçersiz kıl
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const resetLink = `${APP_URL}?reset_token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Muuvlink — Şifre Sıfırlama',
      html: emailWrapper(`
        <h2 style="color:#00b7ba;margin:0 0 16px">Şifre Sıfırlama</h2>
        <p style="color:#334155;margin:0 0 12px">Merhaba <strong>${user.name}</strong>,</p>
        <p style="color:#334155;margin:0 0 24px">Şifrenizi sıfırlamak için aşağıdaki butona tıklayın. Link <strong>1 saat</strong> geçerlidir.</p>
        <a href="${resetLink}"
           style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#00b7ba,#009295);color:#fff;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
          Şifremi Sıfırla
        </a>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
      `),
    });
    res.json({ message: 'E-posta gönderildi.' });
  } catch (err) {
    console.error('forgot-password error:', err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Şifre sıfırla — token doğrula, şifreyi güncelle
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token ve şifre gerekli.' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  try {
    const result = await pool.query(
      `SELECT prt.user_id, prt.expires_at, prt.used
       FROM password_reset_tokens prt
       WHERE prt.token = $1`,
      [token]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Geçersiz link.' });

    const { user_id, expires_at, used } = result.rows[0];
    if (used) return res.status(400).json({ error: 'Bu link daha önce kullanıldı.' });
    if (new Date() > new Date(expires_at)) return res.status(400).json({ error: 'Linkin süresi doldu.' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]);

    res.json({ message: 'Şifre başarıyla güncellendi.' });
  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// =====================================================
// ANTRENMAN HATIRLATMA CRON JOB (her gün 09:00'da çalışır)
// =====================================================

async function sendTrainingReminders() {
  try {
    const today = new Date();

    for (const daysLeft of [3, 1]) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysLeft);
      const dateStr = targetDate.toISOString().slice(0, 10);

      const trainings = await pool.query(
        `SELECT t.*, teams.name as team_name
         FROM trainings t
         JOIN teams ON teams.id = t.team_id
         WHERE t.training_date = $1`,
        [dateStr]
      );

      for (const training of trainings.rows) {
        const members = await pool.query(
          'SELECT tm.user_id, u.email, u.name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = $1',
          [training.team_id]
        );

        for (const member of members.rows) {
          const notifTitle = daysLeft === 1 ? 'Yarın Antrenman Var!' : '3 Gün Sonra Antrenman!';
          const notifMsg = `${training.team_name}: ${training.title} — ${training.training_date}`;

          // Aynı bildirim daha önce gönderildi mi kontrol et
          const exists = await pool.query(
            `SELECT id FROM notifications WHERE user_id = $1 AND reference_id = $2 AND title = $3`,
            [member.user_id, training.id, notifTitle]
          );
          if (exists.rows.length > 0) continue;

          await createNotif(member.user_id, {
            title: notifTitle,
            message: notifMsg,
            type: 'training_reminder',
            refId: training.id,
            url: `/antrenmanlar`,
          });

          sendEmail({
            to: member.email,
            subject: `${training.team_name} — ${daysLeft === 1 ? 'Yarın' : '3 Gün Sonra'}: ${training.title}`,
            html: trainingReminderEmail({
              teamName: training.team_name,
              trainingTitle: training.title,
              trainingDate: formatTrDate(training.training_date),
              trainingTime: training.training_time,
              location: training.location_name,
              daysLeft,
            }),
          }).catch(e => console.error('Reminder email error:', e.message));
        }
      }
    }
    console.log('[REMINDER] Antrenman hatırlatmaları gönderildi.');
  } catch (err) {
    console.error('[REMINDER] Hata:', err.message);
  }
}

// Her gün 09:00'da çalıştır
function scheduleDailyReminders() {
  const now = new Date();
  const next9am = new Date(now);
  next9am.setHours(9, 0, 0, 0);
  if (next9am <= now) next9am.setDate(next9am.getDate() + 1);
  const msUntil9am = next9am - now;
  setTimeout(() => {
    sendTrainingReminders();
    setInterval(sendTrainingReminders, 24 * 60 * 60 * 1000);
  }, msUntil9am);
  console.log(`[REMINDER] İlk çalışma: ${next9am.toLocaleString('tr-TR')} (${Math.round(msUntil9am/60000)} dk sonra)`);
}
scheduleDailyReminders();

// Production'da Vite build çıktısını servis et
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath, { maxAge: '1d', extensions: ['html'] }));
  app.get('/admin', (req, res) => res.sendFile(path.join(distPath, 'admin.html')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`
  Muuvlink Backend API - FULL VERSION
  Server running on port ${PORT}
  📡 Environment: ${process.env.NODE_ENV || 'development'}
  💾 Database: PostgreSQL
  
  📚 API Endpoints: 60+ routes
  Routes: Auth, Teams, Trainings, Stats, Badges, Notifications, Search, Admin
  `);
});

module.exports = app;