const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { runMigrations } = require('./migrations');

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'swarashtra.db');
const db = new sqlite3.Database(dbPath);

// Helper function to run queries with promises
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

async function initDatabase() {
  console.log('Initializing database at:', dbPath);

  // Enable foreign keys
  await dbRun('PRAGMA foreign_keys = ON;');
  
  // Performance optimizations for production/Render
  await dbRun('PRAGMA journal_mode = WAL;');
  await dbRun('PRAGMA synchronous = NORMAL;');
  await dbRun('PRAGMA cache_size = -64000;'); // 64MB cache

  // Create Users Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'editor',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create RSS Feeds Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS rss_feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      state TEXT DEFAULT 'National',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create Articles Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT NOT NULL,
      title_hi TEXT,
      summary_en TEXT,
      summary_hi TEXT,
      content_en TEXT,
      content_hi TEXT,
      image_url TEXT,
      category TEXT NOT NULL,
      state TEXT DEFAULT 'National',
      source_name TEXT DEFAULT '',
      source_url TEXT,
      author TEXT DEFAULT '',
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_hero INTEGER DEFAULT 0,
      is_breaking INTEGER DEFAULT 0,
      is_video INTEGER DEFAULT 0,
      video_url TEXT,
      views_count INTEGER DEFAULT 0,
      ai_summary_en TEXT,
      ai_summary_hi TEXT,
      is_manual INTEGER DEFAULT 1,
      unique_hash TEXT UNIQUE
    );
  `);

  // Create Newsletter Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create Analytics Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER,
      device_type TEXT,
      state TEXT,
      country TEXT,
      visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration_seconds INTEGER DEFAULT 0,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );
  `);

  // Create Settings Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed Default Admin User
  const adminCheck = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminCheck) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'swarashtra123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(adminPassword, salt);
    await dbRun('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
    console.log(`Seeded default admin user: admin / ${process.env.ADMIN_PASSWORD ? '********' : 'swarashtra123'}`);
  }

  // Seed Default Settings
  const settingsCount = await dbAll('SELECT * FROM settings');
  if (settingsCount.length === 0) {
    await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['news_api_key', '']);
    await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['gnews_api_key', '']);
    await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['ai_summarization_enabled', '1']);
    await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['ticker_custom_message', '']);
    await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['mediastack_api_key', '']);
    await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['thenewsapi_key', '']);
    await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['gemini_api_key', '']);
    console.log('Seeded default settings');
  }

  // Seed Default RSS Feeds
  const defaultFeeds = [
    { name: 'PIB India', url: 'https://pib.gov.in/RssMain.aspx', category: 'National', state: 'National' },
    { name: 'The Hindu - National', url: 'https://www.thehindu.com/news/national/feeder/default.rss', category: 'National', state: 'National' },
    { name: 'Indian Express', url: 'https://indianexpress.com/section/india/feed/', category: 'National', state: 'National' },
    { name: 'BBC India', url: 'http://feeds.bbci.co.uk/news/world/asia/india/rss.xml', category: 'National', state: 'National' },
    { name: 'Reuters India', url: 'https://www.reutersagency.com/feed/?taxonomy=best-regions&post_type=best', category: 'World', state: 'National' },
    { name: 'DW News Asia', url: 'https://rss.dw.com/rdf/rss-en-asia', category: 'World', state: 'National' },
    { name: 'NDTV Profit', url: 'https://feeds.feedburner.com/ndtvprofit-latest', category: 'Business', state: 'National' },
    { name: 'Economic Times', url: 'https://economictimes.indiatimes.com/rssfeedsdefault.cms', category: 'Business', state: 'National' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'Technology', state: 'National' },
    { name: 'ESPN Cricinfo', url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml', category: 'Sports', state: 'National' },
    { name: 'ANI News', url: 'https://www.aninews.in/rss/feed/category/national.xml', category: 'National', state: 'National' },
    { name: 'PTI News', url: 'https://www.ptinews.com/rss.aspx', category: 'National', state: 'National' },
    { name: 'Hindustan Times - Delhi', url: 'https://www.hindustantimes.com/feeds/rss/cities/delhi-news/rssfeed.xml', category: 'National', state: 'Delhi NCR' },
    { name: 'Times of India - UP', url: 'https://timesofindia.indiatimes.com/rssfeeds/2886704.cms', category: 'National', state: 'Uttar Pradesh' },
    { name: 'Tribune India - Punjab', url: 'https://www.tribuneindia.com/rss/feed', category: 'National', state: 'Punjab' }
  ];
  for (const feed of defaultFeeds) {
    await dbRun('INSERT OR IGNORE INTO rss_feeds (name, url, category, state) VALUES (?, ?, ?, ?)', [
      feed.name, feed.url, feed.category, feed.state
    ]);
  }
  console.log('Seeded default RSS feeds');

  // Run database migrations for new tables, columns, and indexes
  await runMigrations(dbRun, dbGet, dbAll);
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDatabase
};
