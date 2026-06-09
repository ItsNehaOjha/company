/**
 * External news API fetchers: NewsAPI, GNews, Mediastack, TheNewsAPI
 * Returns normalized article objects for the aggregator pipeline.
 */

const { dbGet } = require('../db/database');

async function getSetting(key) {
  try {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : '';
  } catch {
    return '';
  }
}

async function getApiKey(envKey, settingKey) {
  if (process.env[envKey]) return process.env[envKey];
  return getSetting(settingKey);
}

function normalizeApiArticle(raw, sourceLabel) {
  return {
    title: raw.title || '',
    description: raw.description || raw.summary || raw.content || '',
    url: raw.url || raw.link || '',
    image: raw.urlToImage || raw.image || raw.thumbnail || '',
    publishedAt: raw.publishedAt || raw.published_at || raw.pubDate || new Date().toISOString(),
    sourceName: raw.source?.name || raw.source_name || sourceLabel,
    author: raw.author || ''
  };
}

async function fetchNewsApi() {
  const apiKey = await getApiKey('NEWS_API_KEY', 'news_api_key');
  if (!apiKey) return [];

  const queries = [
    { q: 'India Uttar Pradesh Delhi Punjab Haryana', category: 'general' },
    { q: 'India business economy', category: 'business' },
    { q: 'India technology', category: 'technology' },
    { q: 'India cricket sports', category: 'sports' }
  ];

  const articles = [];

  for (const query of queries) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query.q)}&language=en&sortBy=publishedAt&pageSize=15&apiKey=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.articles) {
        data.articles.forEach(a => articles.push(normalizeApiArticle(a, 'NewsAPI')));
      }
    } catch (err) {
      console.warn('[NewsAPI] Fetch error:', err.message);
    }
  }

  return articles;
}

async function fetchGNews() {
  const apiKey = await getApiKey('GNEWS_API_KEY', 'gnews_api_key');
  if (!apiKey) return [];

  const topics = [
    'India north',
    'Uttar Pradesh',
    'Delhi NCR',
    'Punjab India',
    'India business',
    'India technology',
    'India sports'
  ];

  const articles = [];

  for (const topic of topics) {
    try {
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(topic)}&lang=en&max=10&apikey=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.articles) {
        data.articles.forEach(a => articles.push(normalizeApiArticle(a, 'GNews')));
      }
    } catch (err) {
      console.warn('[GNews] Fetch error:', err.message);
    }
  }

  return articles;
}

async function fetchMediastack() {
  const apiKey = await getApiKey('MEDIASTACK_API_KEY', 'mediastack_api_key');
  if (!apiKey) return [];

  try {
    const url = `http://api.mediastack.com/v1/news?access_key=${apiKey}&countries=in&languages=en&limit=50&sort=published_desc`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data) return [];
    return data.data.map(a => normalizeApiArticle(a, a.source || 'Mediastack'));
  } catch (err) {
    console.warn('[Mediastack] Fetch error:', err.message);
    return [];
  }
}

async function fetchTheNewsApi() {
  const apiKey = await getApiKey('THENEWSAPI_KEY', 'thenewsapi_key');
  if (!apiKey) return [];

  try {
    const url = `https://api.thenewsapi.com/v1/news/all?api_token=${apiKey}&language=en&categories=general,business,tech,sports&search=india&limit=50`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data) return [];
    return data.data.map(a => normalizeApiArticle({
      title: a.title,
      description: a.description,
      url: a.url,
      image: a.image_url,
      publishedAt: a.published_at,
      source: { name: a.source },
      author: a.author
    }, a.source || 'TheNewsAPI'));
  } catch (err) {
    console.warn('[TheNewsAPI] Fetch error:', err.message);
    return [];
  }
}

async function fetchAllApiSources() {
  const results = await Promise.allSettled([
    fetchNewsApi(),
    fetchGNews(),
    fetchMediastack(),
    fetchTheNewsApi()
  ]);

  const merged = [];
  results.forEach(r => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      merged.push(...r.value);
    }
  });

  return merged;
}

module.exports = {
  fetchNewsApi,
  fetchGNews,
  fetchMediastack,
  fetchTheNewsApi,
  fetchAllApiSources,
  normalizeApiArticle
};
