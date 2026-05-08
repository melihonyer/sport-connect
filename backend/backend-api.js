// SporlaConnect Backend API - FULL VERSION
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sporlaconnect-secret-key-2024';

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'sporlaconnect',
  password: 'postgres123',
  port: 5432,
});

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

const isAdmin = (req, res, next) => {
  const adminToken = req.headers.authorization;
  if (!adminToken) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
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
            // Create notification for new badge
            await pool.query(
              `INSERT INTO notifications (user_id, title, message, notification_type, reference_id)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                userId,
                'Yeni Rozet! 🏆',
                `"${badge.name}" rozetini kazandın!`,
                'badge',
                badge.id,
              ]
            );
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
       WHERE ta.user_id = $1 AND t.training_date < CURRENT_DATE`,
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
      'SELECT id, name, email, phone, avatar, created_at FROM users WHERE id = $1',
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
    const { sport, search } = req.query;

    let query = `
      SELECT t.*, 
             u.name as owner_name,
             COUNT(DISTINCT tm.user_id) as member_count
      FROM teams t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE (t.is_private = false OR t.id IN (
        SELECT team_id FROM team_members WHERE user_id = $1
      ))
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

    query += ' GROUP BY t.id, u.name ORDER BY t.created_at DESC';

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

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, notification_type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [team.owner_id, 'Yeni Üye!', `${req.user.email} takımınıza katıldı!`, 'team', teamId]
    );

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

    const memberCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, req.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Only team owners/admins can invite members' });
    }

    const result = await pool.query(
      `INSERT INTO team_invitations (team_id, inviter_id, invitee_email)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [teamId, req.user.id, email]
    );

    // Check if invited user exists
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, notification_type, reference_id, action_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userResult.rows[0].id,
          'Takım Daveti!',
          `Bir takıma davet edildiniz!`,
          'invitation',
          teamId,
          `/teams/${teamId}`,
        ]
      );
    }

    res.json({ message: 'Invitation sent', invitation: result.rows[0] });
  } catch (error) {
    console.error('Invite error:', error);
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

    if (ownerCheck.rows[0].owner_id !== req.user.id && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Only team owner can remove members' });
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

    const memberCheck = await pool.query(
      'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only team members can post' });
    }

    const result = await pool.query(
      `INSERT INTO team_posts (team_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [teamId, req.user.id, message]
    );

    res.json({ post: result.rows[0] });
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

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Only team owners/admins can create trainings' });
    }

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
        is_public !== undefined ? is_public : true,
        difficulty || 'Orta',
      ]
    );

    const members = await pool.query(
      'SELECT user_id FROM team_members WHERE team_id = $1 AND user_id != $2',
      [team_id, req.user.id]
    );

    for (const member of members.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, notification_type, reference_id, action_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          member.user_id,
          'Yeni Antrenman!',
          `${title} antrenmanı eklendi.`,
          'training',
          result.rows[0].id,
          `/trainings/${result.rows[0].id}`,
        ]
      );
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
    const { title, description, training_date, training_time, location_name, capacity, difficulty } = req.body;

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
           location_name = $5, capacity = $6, difficulty = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [title, description, training_date, training_time, location_name, capacity, difficulty, trainingId]
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

app.get('/api/admin/stats', isAdmin, async (req, res) => {
  try {
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const trainingCount = await pool.query('SELECT COUNT(*) FROM trainings');
    const teamCount = await pool.query('SELECT COUNT(*) FROM teams');
    const completedTrainings = await pool.query(
      "SELECT COUNT(*) FROM trainings WHERE training_date < CURRENT_DATE"
    );

    res.json({
      users: parseInt(userCount.rows[0].count),
      trainings: parseInt(trainingCount.rows[0].count),
      teams: parseInt(teamCount.rows[0].count),
      completedTrainings: parseInt(completedTrainings.rows[0].count),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.created_at,
        COUNT(DISTINCT tm.team_id) as team_count,
        COUNT(DISTINCT ta.training_id) as training_count
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id
      LEFT JOIN training_attendees ta ON u.id = ta.user_id
      GROUP BY u.id, u.name, u.email, u.created_at
      ORDER BY u.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('/api/admin/trainings', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        COUNT(ta.user_id) as participant_count
      FROM trainings t
      LEFT JOIN training_attendees ta ON t.id = ta.training_id
      GROUP BY t.id
      ORDER BY t.training_date DESC, t.training_time DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Admin trainings error:', error);
    res.status(500).json({ error: 'Failed to fetch trainings' });
  }
});

app.get('/api/admin/teams', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        COUNT(tm.user_id) as member_count
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Admin teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
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