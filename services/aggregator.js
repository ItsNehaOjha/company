const Parser = require('rss-parser');
const crypto = require('crypto');
const { dbAll, dbRun, dbGet } = require('../db/database');
const aiPipeline = require('./ai_pipeline');
const { resolveArticleImage } = require('./image_resolver');
const { fetchAllApiSources } = require('./news_apis');

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: false }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: false }]
    ]
  },
  headers: { 'User-Agent': 'SwarashtraNewsAggregator/1.0' }
});

function generateHash(source) {
  return crypto.createHash('md5').update(source).digest('hex');
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function resolveAuthor(item, feedName) {
  const raw = item.creator || item.author || item['dc:creator'] || '';
  const cleaned = stripHtml(String(raw)).trim();
  if (cleaned && !/^(admin|bureau|staff writer|demo author)$/i.test(cleaned)) {
    return cleaned;
  }
  return feedName || 'Source Staff';
}

function estimateReadTime(text) {
  const words = (text || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function insertArticle({
  title,
  summary,
  imageUrl,
  category,
  state,
  sourceName,
  sourceUrl,
  author,
  publishedAt,
  hash,
  aiSummaryEn,
  aiSummaryHi,
  titleHi,
  summaryHi
}) {
  await dbRun(`
    INSERT INTO articles (
      title_en, title_hi, summary_en, summary_hi, content_en, content_hi,
      image_url, category, state, source_name, source_url, author,
      published_at, unique_hash, is_hero, is_breaking, is_video,
      ai_summary_en, ai_summary_hi, is_manual
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 0)
  `, [
    title,
    titleHi || title,
    summary,
    summaryHi || summary,
    summary,
    summaryHi || summary,
    imageUrl || '',
    category,
    state,
    sourceName,
    sourceUrl,
    author,
    publishedAt,
    hash,
    aiSummaryEn || '',
    aiSummaryHi || ''
  ]);
}

async function processRssItem(item, feed, existingTitles) {
  const hash = generateHash(item.link || item.guid || item.title || '');
  const exists = await dbGet('SELECT id FROM articles WHERE unique_hash = ?', [hash]);
  if (exists) return false;

  const title = stripHtml(item.title);
  if (!title) return false;

  if (await aiPipeline.isDuplicate(title, existingTitles)) return false;

  const fullContent = stripHtml(item.content || item['content:encoded'] || item.contentSnippet || item.summary || '');
  const summary = fullContent.substring(0, 400) || title;
  const sourceUrl = item.link || item.guid || '';

  const { category, state } = aiPipeline.autoCategorize(title, fullContent);
  const finalCategory = feed.category !== 'National' ? feed.category : category;
  const finalState = feed.state !== 'National' ? feed.state : state;

  const imageUrl = await resolveArticleImage({ rssItem: item, articleUrl: sourceUrl });
  const author = resolveAuthor(item, feed.name);
  const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

  const aiEnabled = await aiPipeline.isAiEnabled();
  let aiSummaryEn = '';
  let aiSummaryHi = '';
  let titleHi = title;
  let summaryHi = summary;

  if (aiEnabled && fullContent.length > 50) {
    aiSummaryEn = await aiPipeline.generateSummary(fullContent, title, 'en');
    aiSummaryHi = await aiPipeline.generateSummary(fullContent, title, 'hi');
    titleHi = await aiPipeline.translateText(title, 'hi');
    summaryHi = await aiPipeline.translateText(summary, 'hi');
  }

  await insertArticle({
    title,
    summary,
    imageUrl,
    category: finalCategory,
    state: finalState,
    sourceName: feed.name,
    sourceUrl,
    author,
    publishedAt,
    hash,
    aiSummaryEn,
    aiSummaryHi,
    titleHi,
    summaryHi
  });

  existingTitles.push(title);
  return true;
}

async function processApiArticle(article, existingTitles) {
  if (!article.title || !article.url) return false;

  const hash = generateHash(article.url);
  const exists = await dbGet('SELECT id FROM articles WHERE unique_hash = ?', [hash]);
  if (exists) return false;

  const title = stripHtml(article.title);
  if (await aiPipeline.isDuplicate(title, existingTitles)) return false;

  const summary = stripHtml(article.description).substring(0, 400) || title;
  const { category, state } = aiPipeline.autoCategorize(title, summary);
  const imageUrl = await resolveArticleImage({ articleUrl: article.url, apiImage: article.image });
  const author = article.author ? stripHtml(article.author) : (article.sourceName || 'Source Staff');
  const publishedAt = article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString();

  const aiEnabled = await aiPipeline.isAiEnabled();
  let aiSummaryEn = '';
  let aiSummaryHi = '';
  let titleHi = title;
  let summaryHi = summary;

  if (aiEnabled && summary.length > 50) {
    aiSummaryEn = await aiPipeline.generateSummary(summary, title, 'en');
    aiSummaryHi = await aiPipeline.generateSummary(summary, title, 'hi');
    titleHi = await aiPipeline.translateText(title, 'hi');
    summaryHi = await aiPipeline.translateText(summary, 'hi');
  }

  await insertArticle({
    title,
    summary,
    imageUrl,
    category,
    state,
    sourceName: article.sourceName,
    sourceUrl: article.url,
    author,
    publishedAt,
    hash,
    aiSummaryEn,
    aiSummaryHi,
    titleHi,
    summaryHi
  });

  existingTitles.push(title);
  return true;
}

async function fetchRssFeeds() {
  console.log('[Aggregator] Starting RSS feed update at:', new Date().toISOString());

  try {
    const feeds = await dbAll('SELECT * FROM rss_feeds WHERE is_active = 1');
    if (feeds.length === 0) {
      console.log('[Aggregator] No active RSS feeds configured.');
      return 0;
    }

    const existingArticles = await dbAll('SELECT title_en FROM articles ORDER BY published_at DESC LIMIT 500');
    const existingTitles = existingArticles.map(a => a.title_en);
    let totalNew = 0;

    for (const feed of feeds) {
      console.log(`[Aggregator] Fetching: ${feed.name} (${feed.url})`);
      try {
        const parsedFeed = await parser.parseURL(feed.url);
        let newCount = 0;

        for (const item of parsedFeed.items.slice(0, 30)) {
          const added = await processRssItem(item, feed, existingTitles);
          if (added) newCount++;
        }

        totalNew += newCount;
        console.log(`[Aggregator] Finished feed ${feed.name}: Added ${newCount} new articles.`);
      } catch (err) {
        console.error(`[Aggregator] Error processing feed ${feed.name}:`, err.message);
      }
    }

    return totalNew;
  } catch (err) {
    console.error('[Aggregator] General aggregator error:', err);
    return 0;
  }
}

async function fetchApiNews() {
  console.log('[Aggregator] Fetching external news APIs...');

  try {
    const apiArticles = await fetchAllApiSources();
    if (apiArticles.length === 0) {
      console.log('[Aggregator] No API articles returned (check API keys in .env or admin settings).');
      return 0;
    }

    const existingArticles = await dbAll('SELECT title_en FROM articles ORDER BY published_at DESC LIMIT 500');
    const existingTitles = existingArticles.map(a => a.title_en);
    let newCount = 0;

    for (const article of apiArticles) {
      const added = await processApiArticle(article, existingTitles);
      if (added) newCount++;
    }

    console.log(`[Aggregator] API sources added ${newCount} new articles.`);
    return newCount;
  } catch (err) {
    console.error('[Aggregator] API fetch error:', err);
    return 0;
  }
}

async function runFullAggregation() {
  const rssCount = await fetchRssFeeds();
  const apiCount = await fetchApiNews();

  await autoPromoteHero();
  await autoFlagBreaking();

  console.log(`[Aggregator] Sync complete. RSS: ${rssCount}, API: ${apiCount}`);
  return rssCount + apiCount;
}

async function autoPromoteHero() {
  const hero = await dbGet('SELECT id FROM articles WHERE is_hero = 1 LIMIT 1');
  if (hero) return;

  const latest = await dbGet('SELECT id FROM articles ORDER BY published_at DESC LIMIT 1');
  if (latest) {
    await dbRun('UPDATE articles SET is_hero = 1 WHERE id = ?', [latest.id]);
  }
}

async function autoFlagBreaking() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await dbRun(`
    UPDATE articles SET is_breaking = 1
    WHERE published_at >= ? AND is_breaking = 0
    AND id IN (SELECT id FROM articles ORDER BY published_at DESC LIMIT 3)
  `, [twoHoursAgo]);
}

let aggregatorInterval = null;

function startAggregator(intervalMs = 15 * 60 * 1000) {
  if (aggregatorInterval) clearInterval(aggregatorInterval);

  runFullAggregation();

  aggregatorInterval = setInterval(runFullAggregation, intervalMs);
  console.log(`[Aggregator] Background news scheduler started. Interval: ${intervalMs / 60000} mins.`);
}

function stopAggregator() {
  if (aggregatorInterval) {
    clearInterval(aggregatorInterval);
    aggregatorInterval = null;
    console.log('[Aggregator] Background news scheduler stopped.');
  }
}

module.exports = {
  fetchRssFeeds,
  fetchApiNews,
  runFullAggregation,
  startAggregator,
  stopAggregator,
  estimateReadTime
};
