-- SporlaConnect — Supabase Schema
-- Supabase Dashboard > SQL Editor'de çalıştırın

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT,
  avatar        TEXT,
  is_admin      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  sport            TEXT NOT NULL,
  description      TEXT,
  location         TEXT,
  is_private       BOOLEAN DEFAULT false,
  owner_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  avatar           TEXT,
  subscription_end TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id         SERIAL PRIMARY KEY,
  team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member',
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_posts (
  id         SERIAL PRIMARY KEY,
  team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_invitations (
  id            SERIAL PRIMARY KEY,
  team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  inviter_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainings (
  id                SERIAL PRIMARY KEY,
  team_id           INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  training_date     DATE NOT NULL,
  training_time     TIME NOT NULL,
  duration_minutes  INTEGER DEFAULT 60,
  location_name     TEXT,
  location_lat      NUMERIC(10,7),
  location_lng      NUMERIC(10,7),
  location_address  TEXT,
  capacity          INTEGER DEFAULT 20,
  is_public         BOOLEAN DEFAULT true,
  difficulty        TEXT DEFAULT 'orta',
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_attendees (
  id          SERIAL PRIMARY KEY,
  training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'joined',
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(training_id, user_id)
);

CREATE TABLE IF NOT EXISTS training_comments (
  id          SERIAL PRIMARY KEY,
  training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  message           TEXT,
  notification_type TEXT DEFAULT 'info',
  reference_id      INTEGER,
  action_url        TEXT,
  is_read           BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS badges (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  icon              TEXT,
  requirement_type  TEXT NOT NULL,
  requirement_value INTEGER NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id   INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS user_stats (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_trainings INTEGER DEFAULT 0,
  total_distance  NUMERIC(10,2) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banners (
  id                  SERIAL PRIMARY KEY,
  title               TEXT NOT NULL,
  subtitle            TEXT,
  badge_text          TEXT,
  cta_primary_text    TEXT,
  cta_secondary_text  TEXT,
  cta_primary_url     TEXT DEFAULT '',
  cta_secondary_url   TEXT DEFAULT '',
  image_url           TEXT,
  gradient_from       TEXT DEFAULT '#0D0B26',
  gradient_via        TEXT DEFAULT '#1a1040',
  gradient_to         TEXT DEFAULT '#0f2044',
  order_index         INTEGER DEFAULT 0,
  is_active           BOOLEAN DEFAULT true,
  mottos              JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Varsayılan rozetler
INSERT INTO badges (name, description, icon, requirement_type, requirement_value) VALUES
  ('Başlangıç',    '1 antrenman tamamla',    '🏅', 'training_count', 1),
  ('Düzenli',      '5 antrenman tamamla',    '⭐', 'training_count', 5),
  ('Azimli',       '10 antrenman tamamla',   '🔥', 'training_count', 10),
  ('Sporcu',       '25 antrenman tamamla',   '💪', 'training_count', 25),
  ('Efsane',       '50 antrenman tamamla',   '🏆', 'training_count', 50),
  ('Takım Oyuncusu','1 takıma katıl',        '🤝', 'team_count',     1),
  ('Lider',        '3 takıma katıl',         '👑', 'team_count',     3)
ON CONFLICT DO NOTHING;
