// SporlaConnect Backend API - FULL VERSION
require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

app.use(cors());
app.use(express.json());

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
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

async function uploadToSupabase(bucket, fileName, buffer, mimetype) {
  if (!supabase) throw new Error('Supabase yapılandırılmadı.');
  const { error } = await supabase.storage.from(bucket).upload(fileName, buffer, {
    contentType: mimetype, upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
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
});

// Mail gönder – hata olursa konsola yaz, uygulamayı patlatma
async function sendEmail({ to, subject, html }) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS || process.env.MAIL_PASS === 'your-gmail-app-password-here') {
    console.log(`[EMAIL - MOCK] To: ${to} | Subject: ${subject}`);
    return { mocked: true };
  }
  try {
    const info = await mailTransporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || 'SporlaConnect'}" <${process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[EMAIL ERROR] Failed to send to ${to}:`, err.message);
    return null;
  }
}

// ─── HTML Şablonları ──────────────────────────────────

function emailWrapper(content) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SporlaConnect</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🏃‍♂️</div>
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">SporlaConnect</h1>
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
            <p style="margin:0;color:#94a3b8;font-size:13px;">Bu maili SporlaConnect üzerinden aldınız.</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">© 2026 SporlaConnect. Tüm hakları saklıdır.</p>
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
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Takıma Davet Edildiniz! 🎉</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      <strong>${inviterName}</strong> sizi <strong>${teamName}</strong> takımına davet etti.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;text-align:center;line-height:56px;">${avatar || '🏃'}</div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#1e293b;">${teamName}</div>
          <div style="font-size:14px;color:#6366f1;margin-top:2px;">🏅 ${teamSport}</div>
        </div>
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/teams/${teamId}"
         style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;
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
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">SporlaConnect'e Davet Edildiniz! 🎉</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
      <strong>${inviterName}</strong> sizi <strong>${teamName}</strong> takımına davet etti.
      Katılmak için ücretsiz hesap oluşturun.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="font-size:32px;text-align:center;margin-bottom:12px;">${avatar || '🏃'}</div>
      <div style="text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#1e293b;">${teamName}</div>
        <div style="font-size:14px;color:#6366f1;margin-top:4px;">🏅 ${teamSport}</div>
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/register"
         style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;
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
function wallPostEmail({ teamName, teamId, posterName, posterAvatar, message, postDate }) {
  const truncated = message.length > 300 ? message.slice(0, 300) + '...' : message;
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${teamName} Duvarında Yeni Gönderi 💬</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:15px;">
      <strong>${posterName}</strong> takım duvarına bir şey yazdı.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;
                    display:flex;align-items:center;justify-content:center;font-size:18px;text-align:center;line-height:40px;color:white;font-weight:700;">
          ${posterAvatar || posterName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-weight:600;color:#1e293b;font-size:15px;">${posterName}</div>
          <div style="color:#94a3b8;font-size:13px;">${postDate}</div>
        </div>
      </div>
      <div style="color:#334155;font-size:15px;line-height:1.7;white-space:pre-wrap;border-left:3px solid #6366f1;padding-left:16px;">
        ${truncated}
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/teams/${teamId}"
         style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
        Duvara Git →
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
              title: 'Yeni Rozet! 🏆',
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

app.post('/api/auth/register', async (req, res) => {
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

    res.status(201).json({ message: 'User registered successfully', user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
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

    res.status(201).json({ message: 'Team created successfully', team });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const { sport, search, member_only } = req.query;

    let whereClause;
    if (member_only === 'true') {
      // Sadece kullanıcının üye olduğu takımlar (profil sayfası için)
      whereClause = `t.id IN (SELECT team_id FROM team_members WHERE user_id = $1)`;
    } else {
      // Tüm takımları göster (gizli olanlar da listede görünür, ama içine giremezler)
      whereClause = `1=1`;
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

    await createNotif(team.owner_id, {
      title: 'Yeni Üye!',
      message: `${req.user.email} takımınıza katıldı!`,
      type: 'team',
      refId: teamId,
    });

    await updateUserStats(req.user.id);

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
        title: 'Takım Daveti! 🎉',
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
      subject: `${team.inviter_name} sizi "${team.name}" takımına davet etti! 🏃‍♂️`,
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
        title: `${team.name} Duvarı 💬`,
        message: `${poster.user_name}: ${message.trim().slice(0, 80)}${message.length > 80 ? '...' : ''}`,
        type: 'team_post',
        refId: teamId,
        url: `/teams/${teamId}`,
      });

      // Mail
      sendEmail({
        to: member.email,
        subject: `${team.name} takımında yeni gönderi var 💬`,
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

    if (memberCheck.rows.length === 0 || !['owner', 'coach'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Antrenman oluşturmak için sahip veya antrenör olmanız gerekiyor.' });
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

    const members = await pool.query(
      'SELECT user_id FROM team_members WHERE team_id = $1 AND user_id != $2',
      [team_id, req.user.id]
    );

    for (const member of members.rows) {
      await createNotif(member.user_id, {
        title: 'Yeni Antrenman!',
        message: `${title} antrenmanı eklendi.`,
        type: 'training',
        refId: result.rows[0].id,
        url: `/trainings/${result.rows[0].id}`,
      });
    }

    res.status(201).json({ message: 'Training created successfully', training: result.rows[0] });
  } catch (error) {
    console.error('Create training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/trainings', authenticateToken, async (req, res) => {
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
      WHERE (t.is_public = true OR teams.id IN (
  SELECT team_id FROM team_members WHERE user_id = $1
))
AND (
  t.training_date > CURRENT_DATE 
  OR (t.training_date = CURRENT_DATE AND t.training_time >= CURRENT_TIME)
)
    `;

    const params = [req.user.id];
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

app.get('/api/trainings/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat ve lng gerekli' });

    // Token varsa kullanıcıyı tanımla (opsiyonel auth)
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = require('jsonwebtoken').verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch { /* geçersiz token, misafir olarak devam et */ }
    }

    // Gizlilik: giriş yapmamış → sadece public; giriş yapmış → public + kendi takımları
    const privacyFilter = userId
      ? `(t.is_public = true OR teams.id IN (SELECT team_id FROM team_members WHERE user_id = ${parseInt(userId)}))`
      : `t.is_public = true`;

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
           AND t.training_date >= CURRENT_DATE
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

app.get('/api/trainings/:id', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;

    const trainingResult = await pool.query(
      `SELECT t.*,
              teams.name as team_name,
              teams.sport as team_sport,
              teams.avatar as team_avatar,
              teams.owner_id as team_owner_id,
              COUNT(DISTINCT ta.user_id) as attendee_count
       FROM trainings t
       JOIN teams ON t.team_id = teams.id
       LEFT JOIN training_attendees ta ON t.id = ta.training_id
       WHERE t.id = $1
       GROUP BY t.id, teams.name, teams.sport, teams.avatar, teams.owner_id`,
      [trainingId]
    );

    if (trainingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const training = trainingResult.rows[0];

    // Gizlilik kontrolü: public değilse sadece takım üyesi görebilir
    if (!training.is_public) {
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

    res.json({ message: 'Successfully joined the training' });
  } catch (error) {
    console.error('Join training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/trainings/:id/comments', authenticateToken, async (req, res) => {
  try {
    const trainingId = req.params.id;
    const { comment } = req.body;

    const result = await pool.query(
      `INSERT INTO training_comments (training_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [trainingId, req.user.id, comment]
    );

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

    res.json({ training: result.rows[0] });
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

    // Son 7 günün verisi
    const result = await pool.query(
      `SELECT 
         DATE(t.training_date) as date,
         COUNT(DISTINCT ta.training_id) as count
       FROM training_attendees ta
       JOIN trainings t ON ta.training_id = t.id
       WHERE ta.user_id = $1 
         AND t.training_date >= CURRENT_DATE - INTERVAL '7 days'
         AND t.training_date <= CURRENT_DATE
       GROUP BY DATE(t.training_date)
       ORDER BY date ASC`,
      [userId]
    );

    // Son 7 günü doldur (boş günler için 0)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayData = result.rows.find(r => r.date.toISOString().split('T')[0] === dateStr);
      
      last7Days.push({
        date: dateStr,
        day: ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'][date.getDay()],
        count: dayData ? parseInt(dayData.count) : 0,
      });
    }

    res.json({ activity: last7Days });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
        u.id, u.name, u.email, u.is_admin, u.created_at,
        COUNT(DISTINCT tm.team_id) as team_count,
        COUNT(DISTINCT ta.training_id) as training_count
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id
      LEFT JOIN training_attendees ta ON u.id = ta.user_id
      GROUP BY u.id, u.name, u.email, u.is_admin, u.created_at
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
          <div style="background:#f8fafc;border-left:3px solid #6366f1;border-radius:8px;padding:20px;">
            <p style="margin:0;color:#334155;line-height:1.7;white-space:pre-wrap;">${message}</p>
          </div>
          <div style="margin-top:24px;text-align:center;">
            <a href="${APP_URL}?page=admin&tab=contact"
               style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">
              Panelde Görüntüle →
            </a>
          </div>
        `),
      });
    }

    // Gönderene teşekkür maili
    sendEmail({
      to: email,
      subject: 'Mesajınız alındı — SporlaConnect',
      html: emailWrapper(`
        <h2 style="margin:0 0 12px;color:#1e293b;">Mesajınız için teşekkürler, ${name}! 🎉</h2>
        <p style="color:#64748b;line-height:1.7;margin:0 0 20px;">
          Mesajınız başarıyla alındı. En kısa sürede size dönüş yapacağız.
        </p>
        <div style="background:#f8fafc;border-left:3px solid #6366f1;border-radius:8px;padding:20px;">
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
    // mottos kolonunu ekle (yoksa)
    await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS mottos JSONB DEFAULT '[]'`);
    const { title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
            cta_primary_url, cta_secondary_url,
            gradient_from, gradient_via, gradient_to, order_index, is_active, mottos } = req.body;
    const result = await pool.query(
      `INSERT INTO banners (title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
        cta_primary_url, cta_secondary_url,
        gradient_from, gradient_via, gradient_to, order_index, is_active, mottos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
       cta_primary_url || '', cta_secondary_url || '',
       gradient_from || '#0D0B26', gradient_via || '#1a1040', gradient_to || '#0f2044',
       order_index || 0, is_active !== false,
       JSON.stringify(Array.isArray(mottos) && mottos.length ? mottos : [])]
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
    const { title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
            cta_primary_url, cta_secondary_url,
            gradient_from, gradient_via, gradient_to, order_index, is_active, mottos } = req.body;
    const result = await pool.query(
      `UPDATE banners SET title=$1, subtitle=$2, badge_text=$3,
        cta_primary_text=$4, cta_secondary_text=$5,
        cta_primary_url=$6, cta_secondary_url=$7,
        gradient_from=$8, gradient_via=$9, gradient_to=$10,
        order_index=$11, is_active=$12, mottos=$13
       WHERE id=$14 RETURNING *`,
      [title, subtitle, badge_text, cta_primary_text, cta_secondary_text,
       cta_primary_url || '', cta_secondary_url || '',
       gradient_from, gradient_via, gradient_to, order_index, is_active,
       JSON.stringify(Array.isArray(mottos) && mottos.length ? mottos : []),
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
// HEALTH CHECK
// =====================================================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// =====================================================
// START SERVER
// =====================================================

// DB migrations
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS mottos JSONB DEFAULT '[]'`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_primary_url TEXT DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_secondary_url TEXT DEFAULT ''`).catch(() => {});
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
app.post('/api/auth/forgot-password', async (req, res) => {
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
      subject: 'SporlaConnect — Şifre Sıfırlama',
      html: emailWrapper(`
        <h2 style="color:#6366f1;margin:0 0 16px">Şifre Sıfırlama</h2>
        <p style="color:#334155;margin:0 0 12px">Merhaba <strong>${user.name}</strong>,</p>
        <p style="color:#334155;margin:0 0 24px">Şifrenizi sıfırlamak için aşağıdaki butona tıklayın. Link <strong>1 saat</strong> geçerlidir.</p>
        <a href="${resetLink}"
           style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
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

// Production'da Vite build çıktısını servis et
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath, { maxAge: '1d' }));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`
  ⚡ SporlaConnect Backend API - FULL VERSION
  🚀 Server running on port ${PORT}
  📡 Environment: ${process.env.NODE_ENV || 'development'}
  💾 Database: PostgreSQL
  
  📚 API Endpoints: 60+ routes
  ✅ Auth, Teams, Trainings, Stats, Badges, Notifications, Search, Admin
  `);
});

module.exports = app;