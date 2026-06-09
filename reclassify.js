const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { dbAll, dbRun } = require('./db/database');
const { autoCategorize } = require('./services/ai_pipeline');
const { fetchRssFeeds } = require('./services/aggregator');

async function main() {
  try {
    console.log('Fetching all articles from the database...');
    const articles = await dbAll('SELECT id, title_en, content_en, summary_en FROM articles');
    console.log(`Found ${articles.length} articles to re-classify.`);

    let updatedCount = 0;

    for (const article of articles) {
      const title = article.title_en || '';
      const content = article.content_en || article.summary_en || '';
      
      const { category, state } = autoCategorize(title, content);

      await dbRun('UPDATE articles SET category = ?, state = ? WHERE id = ?', [category, state, article.id]);
      updatedCount++;
      
      if (updatedCount % 50 === 0) {
        console.log(`Updated ${updatedCount}/${articles.length} articles...`);
      }
    }

    console.log(`\nRe-classification complete! Updated ${updatedCount} articles.`);
    
    console.log('\nFetching new RSS feeds to populate regional data...');
    const newArticles = await fetchRssFeeds();
    console.log(`\nRSS Feed Fetch complete! Added ${newArticles} new articles.`);

    console.log('\nAll database updates finished successfully.');
    process.exit(0);

  } catch (err) {
    console.error('Error during database update:', err);
    process.exit(1);
  }
}

main();
