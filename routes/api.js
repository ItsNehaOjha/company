const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { dbAll, dbRun, dbGet } = require('../db/database');
const { runFullAggregation } = require('../services/aggregator');

// --- Helper Auth Middleware ---
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Admin access required.' });
  }
}

const STATE_NORMALIZE_MAP = {
  'delhi': 'Delhi NCR',
  'delhi ncr': 'Delhi NCR',
  'delhi-ncr': 'Delhi NCR',
  'delhi_ncr': 'Delhi NCR',
  'uttar pradesh': 'Uttar Pradesh',
  'uttar-pradesh': 'Uttar Pradesh',
  'uttar_pradesh': 'Uttar Pradesh',
  'haryana': 'Haryana',
  'punjab': 'Punjab',
  'uttarakhand': 'Uttarakhand',
  'himachal pradesh': 'Himachal Pradesh',
  'himachal-pradesh': 'Himachal Pradesh',
  'himachal_pradesh': 'Himachal Pradesh',
  'jammu & kashmir': 'Jammu & Kashmir',
  'jammu kashmir': 'Jammu & Kashmir',
  'jammu-kashmir': 'Jammu & Kashmir'
};

const CATEGORY_NORMALIZE_MAP = {
  'business': 'Business',
  'technology': 'Technology',
  'tech': 'Technology',
  'sports': 'Sports',
  'opinion': 'Opinion',
  'education': 'Education',
  'national': 'National',
  'world': 'World',
  'videos': 'Videos',
  'politics': 'National',
  'general news': 'General News'
};

function normalizeState(val) {
  if (!val) return '';
  const normalized = val.trim().toLowerCase();
  return STATE_NORMALIZE_MAP[normalized] || val.trim();
}

function normalizeCategory(val) {
  if (!val) return '';
  const normalized = val.trim().toLowerCase();
  return CATEGORY_NORMALIZE_MAP[normalized] || val.trim();
}

// Health check endpoint for Render
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get Latest News (supports limit, offset, category, state)
router.get('/news/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const category = normalizeCategory(req.query.category || '');
    const state = normalizeState(req.query.state || '');
    const search = req.query.search || '';
    const source = req.query.source || '';
    const dateFrom = req.query.dateFrom || '';
    const dateTo = req.query.dateTo || '';

    let query = 'SELECT * FROM articles WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (state) {
      query += ' AND state = ?';
      params.push(state);
    }
    if (source) {
      query += ' AND source_name LIKE ?';
      params.push(`%${source}%`);
    }
    if (dateFrom) {
      try {
        const dateFromIso = new Date(dateFrom).toISOString();
        query += ' AND published_at >= ?';
        params.push(dateFromIso);
      } catch (err) {
        console.warn('Invalid dateFrom:', dateFrom);
      }
    }
    if (dateTo) {
      try {
        const dateToIso = new Date(dateTo).toISOString();
        query += ' AND published_at <= ?';
        params.push(dateToIso);
      } catch (err) {
        console.warn('Invalid dateTo:', dateTo);
      }
    }
    if (search) {
      query += ' AND (title_en LIKE ? OR title_hi LIKE ? OR summary_en LIKE ? OR summary_hi LIKE ?)';
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    let articles = await dbAll(query, params);
    
    // If filtering by state and we have fewer articles than requested, pull fallbacks
    if (state && articles.length < limit) {
      const fallbackLimit = limit - articles.length;
      // Try to find regional or national fallback articles
      const fallbackQuery = `
        SELECT * FROM articles 
        WHERE id NOT IN (${articles.map(a => a.id).join(',') || 0}) 
        AND (state = 'National' OR category = 'National' OR category = 'General News')
        ORDER BY published_at DESC 
        LIMIT ?
      `;
      const fallbackArticles = await dbAll(fallbackQuery, [fallbackLimit]);
      articles = articles.concat(fallbackArticles);
    }
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM articles WHERE 1=1';
    const countParams = [];
    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }
    if (state) {
      countQuery += ' AND state = ?';
      countParams.push(state);
    }
    if (source) {
      countQuery += ' AND source_name LIKE ?';
      countParams.push(`%${source}%`);
    }
    if (dateFrom) {
      try {
        const dateFromIso = new Date(dateFrom).toISOString();
        countQuery += ' AND published_at >= ?';
        countParams.push(dateFromIso);
      } catch (err) {
        console.warn('Invalid dateFrom in count:', dateFrom);
      }
    }
    if (dateTo) {
      try {
        const dateToIso = new Date(dateTo).toISOString();
        countQuery += ' AND published_at <= ?';
        countParams.push(dateToIso);
      } catch (err) {
        console.warn('Invalid dateTo in count:', dateTo);
      }
    }
    if (search) {
      countQuery += ' AND (title_en LIKE ? OR title_hi LIKE ? OR summary_en LIKE ? OR summary_hi LIKE ?)';
      const pattern = `%${search}%`;
      countParams.push(pattern, pattern, pattern, pattern);
    }
    
    const countResult = await dbGet(countQuery, countParams);

    res.json({
      articles,
      total: countResult ? countResult.total : 0,
      limit,
      offset
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Hero Story
router.get('/news/hero', async (req, res) => {
  try {
    // Attempt to find flagged hero story
    let hero = await dbGet('SELECT * FROM articles WHERE is_hero = 1 ORDER BY published_at DESC LIMIT 1');
    if (!hero) {
      // Fallback to latest article
      hero = await dbGet('SELECT * FROM articles ORDER BY published_at DESC LIMIT 1');
    }
    res.json(hero || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Breaking News Ticker Content
router.get('/news/breaking', async (req, res) => {
  try {
    const tickerSetting = await dbGet('SELECT value FROM settings WHERE key = ?', ['ticker_custom_message']);
    const customMessage = tickerSetting ? tickerSetting.value : '';

    // Fetch up to 3 recent breaking news
    const breakingArticles = await dbAll('SELECT id, title_en, title_hi FROM articles WHERE is_breaking = 1 ORDER BY published_at DESC LIMIT 3');
    
    res.json({
      customMessage,
      breaking: breakingArticles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Top Stories (3-6 featured stories)
router.get('/news/top-stories', async (req, res) => {
  try {
    const stories = await dbAll('SELECT * FROM articles WHERE is_hero = 0 AND is_breaking = 0 ORDER BY published_at DESC LIMIT 6');
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Video Stories
router.get('/news/videos', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;
    const videos = await dbAll('SELECT * FROM articles WHERE is_video = 1 ORDER BY published_at DESC LIMIT ?', [limit]);
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get trending topics derived from recent articles
router.get('/news/topics', async (req, res) => {
  try {
    const articles = await dbAll(`
      SELECT category, state FROM articles
      ORDER BY published_at DESC LIMIT 100
    `);

    const topicCounts = {};
    articles.forEach(a => {
      if (a.state && a.state !== 'National') {
        const tag = a.state.replace(/\s+/g, '');
        topicCounts[tag] = (topicCounts[tag] || 0) + 1;
      }
      if (a.category) {
        const tag = a.category.replace(/\s+/g, '');
        topicCounts[tag] = (topicCounts[tag] || 0) + 1;
      }
    });

    const topics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);

    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get available news sources for filter
router.get('/news/sources', async (req, res) => {
  try {
    const sources = await dbAll(`
      SELECT DISTINCT source_name FROM articles
      WHERE source_name IS NOT NULL AND source_name != ''
      ORDER BY source_name ASC
    `);
    res.json(sources.map(s => s.source_name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Trending Stories
router.get('/news/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const trending = await dbAll('SELECT id, title_en, title_hi, category, state, published_at, views_count FROM articles ORDER BY views_count DESC, published_at DESC LIMIT ?', [limit]);
    res.json(trending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Article by ID
router.get('/news/:id', async (req, res) => {
  try {
    const article = await dbGet('SELECT * FROM articles WHERE id = ?', [req.params.id]);
    if (article) {
      res.json(article);
    } else {
      res.status(404).json({ error: 'Article not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log/Increment Article View
router.post('/news/:id/view', async (req, res) => {
  try {
    await dbRun('UPDATE articles SET views_count = views_count + 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to resolve client IP geolocation
async function resolveIpGeo(ip) {
  let cleanIp = ip.trim();
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.substring(7);
  }

  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost' || cleanIp === '') {
    return {
      country: 'India',
      state: 'Delhi NCR',
      city: 'New Delhi'
    };
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${cleanIp}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        return {
          country: data.country || 'India',
          state: data.regionName || 'National',
          city: data.city || 'Unknown'
        };
      }
    }
  } catch (err) {
    console.error('[Analytics] IP Geolocation lookup failed:', err.message);
  }

  return {
    country: 'India',
    state: 'National',
    city: 'Unknown'
  };
}

// Post Analytics Log
router.post('/analytics/log', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const geo = await resolveIpGeo(ip);

    const ua = req.headers['user-agent'] || '';
    let browser = 'Other';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome') && !ua.includes('Safari')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edge') || ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'IE';

    let device = req.body.deviceType || 'Desktop';
    if (ua.includes('Mobi') || ua.includes('Android') || ua.includes('iPhone')) {
      device = 'Mobile';
    } else if (ua.includes('iPad') || ua.includes('Tablet')) {
      device = 'Tablet';
    }

    await dbRun(`
      INSERT INTO analytics (article_id, device_type, state, country, city, browser, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      req.body.articleId || null,
      device,
      geo.state,
      geo.country,
      geo.city,
      browser,
      req.body.duration || 0
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Newsletter Subscription
router.post('/newsletter/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    await dbRun('INSERT INTO newsletter_subscribers (email) VALUES (?)', [email.trim()]);
    res.json({ success: true, message: 'Successfully subscribed to the newsletter.' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.json({ success: true, message: 'You are already subscribed.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});


// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Initialize session
    req.session.isAdmin = true;
    req.session.username = username;
    req.session.role = user.role;

    res.json({ success: true, user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    res.clearCookie('sid');
    res.json({ success: true });
  });
});

router.get('/admin/check-session', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.json({ loggedIn: true, user: { username: req.session.username, role: req.session.role } });
  } else {
    res.json({ loggedIn: false });
  }
});


// ==========================================
// ADMIN PROTECTED ENDPOINTS
// ==========================================

// Get Analytics Summary & Counts
router.get('/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const totalArticles = await dbGet('SELECT COUNT(*) as count FROM articles');
    const totalSubscribers = await dbGet('SELECT COUNT(*) as count FROM newsletter_subscribers');
    const totalViews = await dbGet('SELECT SUM(views_count) as count FROM articles');
    const rssFeeds = await dbAll('SELECT * FROM rss_feeds');
    
    // Graph Stats: Page views per state (Delhi, UP, Haryana, etc.)
    const stateViews = await dbAll(`
      SELECT state, COUNT(*) as count 
      FROM analytics 
      WHERE state IS NOT NULL AND state != 'Unknown'
      GROUP BY state 
      ORDER BY count DESC
    `);

    // Device distribution
    const deviceStats = await dbAll(`
      SELECT device_type as device, COUNT(*) as count 
      FROM analytics 
      GROUP BY device_type
    `);

    // Top read articles
    const topArticles = await dbAll(`
      SELECT id, title_en, views_count 
      FROM articles 
      ORDER BY views_count DESC 
      LIMIT 5
    `);

    res.json({
      counts: {
        articles: totalArticles.count,
        subscribers: totalSubscribers.count,
        views: totalViews.count || 0,
        feeds: rssFeeds.length
      },
      stateViews,
      deviceStats,
      topArticles,
      rssFeeds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Articles CMS CRUD
router.post('/admin/articles', requireAdmin, async (req, res) => {
  try {
    const {
      title_en, title_hi, summary_en, summary_hi, content_en, content_hi,
      image_url, category, state, author, is_hero, is_breaking, is_video, video_url
    } = req.body;

    if (!title_en || !category) {
      return res.status(400).json({ error: 'Title (English) and Category are required.' });
    }

    const unique_hash = 'manual_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    // If hero story is being created, clear other hero flags in same category/state
    if (parseInt(is_hero) === 1) {
      await dbRun('UPDATE articles SET is_hero = 0');
    }

    await dbRun(`
      INSERT INTO articles (
        title_en, title_hi, summary_en, summary_hi, content_en, content_hi,
        image_url, category, state, author, is_hero, is_breaking, is_video, video_url,
        published_at, unique_hash, is_manual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      title_en, title_hi || '', summary_en || '', summary_hi || '', content_en || '', content_hi || '',
      image_url || '',
      category, state || 'National', author || '',
      parseInt(is_hero) || 0, parseInt(is_breaking) || 0, parseInt(is_video) || 0, video_url || '',
      new Date().toISOString(), unique_hash
    ]);

    res.json({ success: true, message: 'Article created successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/articles/:id', requireAdmin, async (req, res) => {
  try {
    const {
      title_en, title_hi, summary_en, summary_hi, content_en, content_hi,
      image_url, category, state, author, is_hero, is_breaking, is_video, video_url
    } = req.body;

    if (!title_en || !category) {
      return res.status(400).json({ error: 'Title (English) and Category are required.' });
    }

    if (parseInt(is_hero) === 1) {
      await dbRun('UPDATE articles SET is_hero = 0 WHERE id != ?', [req.params.id]);
    }

    await dbRun(`
      UPDATE articles SET
        title_en = ?, title_hi = ?, summary_en = ?, summary_hi = ?, content_en = ?, content_hi = ?,
        image_url = ?, category = ?, state = ?, author = ?, is_hero = ?, is_breaking = ?,
        is_video = ?, video_url = ?
      WHERE id = ?
    `, [
      title_en, title_hi, summary_en, summary_hi, content_en, content_hi,
      image_url, category, state, author, parseInt(is_hero) || 0, parseInt(is_breaking) || 0,
      parseInt(is_video) || 0, video_url, req.params.id
    ]);

    res.json({ success: true, message: 'Article updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/articles/:id', requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM articles WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Article deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RSS Feeds CRUD
router.get('/admin/feeds', requireAdmin, async (req, res) => {
  try {
    const feeds = await dbAll('SELECT * FROM rss_feeds ORDER BY name ASC');
    res.json(feeds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/feeds', requireAdmin, async (req, res) => {
  try {
    const { name, url, category, state, is_active } = req.body;
    if (!name || !url || !category) {
      return res.status(400).json({ error: 'Name, URL, and Category are required.' });
    }
    await dbRun(`
      INSERT INTO rss_feeds (name, url, category, state, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [name, url, category, state || 'National', parseInt(is_active) === 0 ? 0 : 1]);
    res.json({ success: true, message: 'RSS Feed added successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/feeds/:id', requireAdmin, async (req, res) => {
  try {
    const { name, url, category, state, is_active } = req.body;
    await dbRun(`
      UPDATE rss_feeds SET
        name = ?, url = ?, category = ?, state = ?, is_active = ?
      WHERE id = ?
    `, [name, url, category, state, parseInt(is_active) === 0 ? 0 : 1, req.params.id]);
    res.json({ success: true, message: 'RSS Feed updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/feeds/:id', requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM rss_feeds WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'RSS Feed deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Manual News Aggregation Sync
router.post('/admin/feeds/trigger', requireAdmin, async (req, res) => {
  try {
    // Run fetch in background
    runFullAggregation();
    res.json({ success: true, message: 'News aggregation sync triggered in background.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await dbAll('SELECT * FROM settings');
    const config = {};
    settings.forEach(s => {
      config[s.key] = s.value;
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/settings', requireAdmin, async (req, res) => {
  try {
    const { ticker_custom_message, news_api_key, gnews_api_key, gemini_api_key, ai_summarization_enabled } = req.body;
    
    if (ticker_custom_message !== undefined) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['ticker_custom_message', ticker_custom_message]);
    }
    if (news_api_key !== undefined) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['news_api_key', news_api_key]);
    }
    if (gnews_api_key !== undefined) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['gnews_api_key', gnews_api_key]);
    }
    if (req.body.mediastack_api_key !== undefined) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['mediastack_api_key', req.body.mediastack_api_key]);
    }
    if (req.body.thenewsapi_key !== undefined) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['thenewsapi_key', req.body.thenewsapi_key]);
    }
    if (gemini_api_key !== undefined) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['gemini_api_key', gemini_api_key]);
    }
    if (ai_summarization_enabled !== undefined) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['ai_summarization_enabled', String(ai_summarization_enabled)]);
    }

    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Multer Configuration for Media Upload Library ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ==========================================
// NEW CMS & PLATFORM API ENDPOINTS
// ==========================================

// --- Authors API ---

// Get all authors (Public)
router.get('/authors', async (req, res) => {
  try {
    const authors = await dbAll('SELECT * FROM authors ORDER BY name ASC');
    res.json(authors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin CRUD: Create Author
router.post('/admin/authors', requireAdmin, async (req, res) => {
  try {
    const { name, bio, photo_url, social_twitter, social_facebook, designation } = req.body;
    if (!name) return res.status(400).json({ error: 'Author name is required.' });

    await dbRun(`
      INSERT INTO authors (name, bio, photo_url, social_twitter, social_facebook, designation)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, bio || '', photo_url || '', social_twitter || '', social_facebook || '', designation || 'Contributor']);
    res.json({ success: true, message: 'Author registered successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin CRUD: Update Author
router.put('/admin/authors/:id', requireAdmin, async (req, res) => {
  try {
    const { name, bio, photo_url, social_twitter, social_facebook, designation } = req.body;
    await dbRun(`
      UPDATE authors SET name = ?, bio = ?, photo_url = ?, social_twitter = ?, social_facebook = ?, designation = ?
      WHERE id = ?
    `, [name, bio, photo_url, social_twitter, social_facebook, designation, req.params.id]);
    res.json({ success: true, message: 'Author updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin CRUD: Delete Author
router.delete('/admin/authors/:id', requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM authors WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Author deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- Comments API ---

// Get approved comments for an article (Public)
router.get('/articles/:id/comments', async (req, res) => {
  try {
    const comments = await dbAll(`
      SELECT * FROM comments 
      WHERE article_id = ? AND is_approved = 1 
      ORDER BY created_at ASC
    `, [req.params.id]);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a new comment (Public, requires validation)
router.post('/articles/:id/comments', async (req, res) => {
  try {
    const { name, email, content, parentId } = req.body;
    if (!name || !email || !content) {
      return res.status(400).json({ error: 'Name, email, and comment body are required.' });
    }
    await dbRun(`
      INSERT INTO comments (article_id, parent_id, author_name, author_email, content, is_approved)
      VALUES (?, ?, ?, ?, ?, 0)
    `, [req.params.id, parentId || null, name.trim(), email.trim(), content.trim()]);
    res.json({ success: true, message: 'Comment submitted successfully and is awaiting moderation.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Retrieve all comments (Admin-only)
router.get('/admin/comments', requireAdmin, async (req, res) => {
  try {
    const comments = await dbAll(`
      SELECT c.*, a.title_en as article_title 
      FROM comments c
      LEFT JOIN articles a ON c.article_id = a.id
      ORDER BY c.created_at DESC
    `);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Approve comment
router.post('/admin/comments/:id/approve', requireAdmin, async (req, res) => {
  try {
    await dbRun('UPDATE comments SET is_approved = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Comment approved.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reply to comment
router.post('/admin/comments/:id/reply', requireAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Reply content required.' });
    
    // Retrieve parent comment to link to article
    const parentComment = await dbGet('SELECT article_id FROM comments WHERE id = ?', [req.params.id]);
    if (!parentComment) return res.status(404).json({ error: 'Parent comment not found.' });

    await dbRun(`
      INSERT INTO comments (article_id, parent_id, author_name, author_email, content, is_approved)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [parentComment.article_id, req.params.id, 'Swarashtra Editor', 'editorial@swarashtra.in', content.trim()]);
    res.json({ success: true, message: 'Administrative reply posted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Delete comment
router.delete('/admin/comments/:id', requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Comment deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- Media Upload & Catalog Library ---

// Upload & process image (WebP + sharp)
router.post('/admin/media/upload', requireAdmin, upload.single('imageFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `img_${Date.now()}.webp`;
    const filepath = path.join(uploadsDir, filename);

    // Compress with Sharp and convert to WebP
    await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    const relativePath = `/uploads/${filename}`;
    const stats = fs.statSync(filepath);

    await dbRun(`
      INSERT INTO media_library (filename, filepath, mime_type, size)
      VALUES (?, ?, ?, ?)
    `, [filename, relativePath, 'image/webp', stats.size]);

    res.json({
      success: true,
      message: 'Image processed and uploaded successfully.',
      url: relativePath
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get media library catalog
router.get('/admin/media', requireAdmin, async (req, res) => {
  try {
    const catalog = await dbAll('SELECT * FROM media_library ORDER BY uploaded_at DESC');
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete media item
router.delete('/admin/media/:id', requireAdmin, async (req, res) => {
  try {
    const media = await dbGet('SELECT * FROM media_library WHERE id = ?', [req.params.id]);
    if (!media) return res.status(404).json({ error: 'Media not found.' });

    const fullPath = path.join(__dirname, '..', 'public', media.filepath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await dbRun('DELETE FROM media_library WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Media permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- Newsletter Delivery Campaigns ---

// Admin SMTP Campaign Delivery
router.post('/admin/newsletter/send', requireAdmin, async (req, res) => {
  const nodemailer = require('nodemailer');
  try {
    const { subject, htmlContent, articleIds } = req.body;
    if (!subject) return res.status(400).json({ error: 'Campaign subject is required.' });

    // Retrieve active subscribers
    const subscribers = await dbAll('SELECT email FROM newsletter_subscribers');
    if (subscribers.length === 0) {
      return res.status(400).json({ error: 'No subscribers registered.' });
    }

    // Build html template
    let bodyHtml = htmlContent || '';
    if (articleIds && articleIds.length > 0) {
      const placeholders = articleIds.map(() => '?').join(',');
      const articles = await dbAll(`SELECT * FROM articles WHERE id IN (${placeholders})`, articleIds);
      
      let digestHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #001F5B; border-bottom: 2px solid #001F5B; padding-bottom: 10px; margin-top: 0;">Swarashtra Daily Digest</h2>
        <p style="color: #555;">Here are the top headlines handpicked for you:</p>`;

      for (const article of articles) {
        digestHtml += `<div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #f0f0f0;">
          <h3 style="margin: 0 0 8px 0;"><a href="https://swarashtra.in/article/${article.id}" style="color: #001F5B; text-decoration: none;">${article.title_en}</a></h3>
          <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">${article.summary_en}</p>
          <a href="https://swarashtra.in/article/${article.id}" style="background-color: #001F5B; color: white; padding: 6px 12px; font-size: 12px; text-decoration: none; border-radius: 4px; display: inline-block;">Read More</a>
        </div>`;
      }

      digestHtml += `<div style="font-size: 11px; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 15px;">
        You are receiving this because you subscribed to Swarashtra.in. <br>
        <a href="#" style="color: #001F5B;">Unsubscribe</a>
      </div></div>`;

      bodyHtml = digestHtml;
    }

    if (!bodyHtml) {
      return res.status(400).json({ error: 'Email content is required (provide htmlContent or check articleIds).' });
    }

    // Create transport
    const host = process.env.SMTP_HOST || 'smtp.mailtrap.io';
    const port = parseInt(process.env.SMTP_PORT) || 2525;
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const from = process.env.SMTP_FROM || '"Swarashtra Newsroom" <news@swarashtra.in>';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined
    });

    const recipientList = subscribers.map(s => s.email).join(', ');

    await transporter.sendMail({
      from,
      to: recipientList,
      subject,
      html: bodyHtml
    });

    res.json({
      success: true,
      message: `Newsletter campaign successfully dispatched to ${subscribers.length} subscribers.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
