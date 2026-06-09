async function runMigrations(dbRun, dbGet, dbAll) {
  console.log('[Migrations] Checking and running database migrations...');

  try {
    // 1. Create Authors Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS authors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        bio TEXT,
        photo_url TEXT,
        social_twitter TEXT,
        social_facebook TEXT,
        designation TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Migrations] Checked authors table.');

    // 2. Create Comments Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        parent_id INTEGER DEFAULT NULL,
        author_name TEXT NOT NULL,
        author_email TEXT NOT NULL,
        content TEXT NOT NULL,
        is_approved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
      );
    `);
    console.log('[Migrations] Checked comments table.');

    // 3. Create Media Library Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS media_library (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Migrations] Checked media_library table.');

    // 4. Check & Update Analytics Columns
    const tableInfo = await dbAll('PRAGMA table_info(analytics)');
    const columns = tableInfo.map(c => c.name);

    if (!columns.includes('city')) {
      await dbRun("ALTER TABLE analytics ADD COLUMN city TEXT DEFAULT 'Unknown'");
      console.log('[Migrations] Added city column to analytics table.');
    }
    if (!columns.includes('browser')) {
      await dbRun("ALTER TABLE analytics ADD COLUMN browser TEXT DEFAULT 'Unknown'");
      console.log('[Migrations] Added browser column to analytics table.');
    }

    // 5. Create Performance Indexes
    await dbRun('CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_articles_state ON articles(state);');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_analytics_article ON analytics(article_id);');
    console.log('[Migrations] Performance indexes checked.');

    // 6. Remove legacy placeholder/demo content from earlier builds
    await dbRun("DELETE FROM articles WHERE unique_hash LIKE 'initial_%'");
    await dbRun("DELETE FROM articles WHERE image_url LIKE '%unsplash.com%'");
    await dbRun("DELETE FROM authors WHERE photo_url LIKE '%unsplash.com%'");
    console.log('[Migrations] Cleaned legacy placeholder content.');

    console.log('[Migrations] Database migrations completed successfully.');
  } catch (err) {
    console.error('[Migrations] Failed to run database migrations:', err);
    throw err;
  }
}

module.exports = { runMigrations };
