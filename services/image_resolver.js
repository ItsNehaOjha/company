/**
 * Image resolution for aggregated articles.
 * Priority: RSS media > enclosure > OpenGraph og:image > no image (empty string)
 */

const OG_CACHE = new Map();
const OG_CACHE_TTL = 24 * 60 * 60 * 1000;

function extractRssImage(item) {
  if (!item) return '';

  if (item.enclosure && item.enclosure.url && /^https?:\/\//i.test(item.enclosure.url)) {
    const type = (item.enclosure.type || '').toLowerCase();
    if (!type || type.startsWith('image/')) return item.enclosure.url;
  }

  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }

  if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
    return item['media:thumbnail'].$.url;
  }

  const content = item.content || item['content:encoded'] || item.summary || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1] && /^https?:\/\//i.test(imgMatch[1])) {
    return imgMatch[1];
  }

  return '';
}

function parseOgImage(html) {
  if (!html) return '';

  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1] && /^https?:\/\//i.test(match[1])) {
      return match[1];
    }
  }

  return '';
}

async function fetchOpenGraphImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';

  const cached = OG_CACHE.get(url);
  if (cached && Date.now() - cached.ts < OG_CACHE_TTL) {
    return cached.image;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SwarashtraNewsAggregator/1.0',
        Accept: 'text/html,application/xhtml+xml'
      },
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (!res.ok) return '';

    const html = await res.text();
    const image = parseOgImage(html.slice(0, 120000));
    OG_CACHE.set(url, { image, ts: Date.now() });
    return image;
  } catch (err) {
    OG_CACHE.set(url, { image: '', ts: Date.now() });
    return '';
  }
}

async function resolveArticleImage({ rssItem, articleUrl, apiImage }) {
  if (apiImage && /^https?:\/\//i.test(apiImage)) return apiImage;

  const rssImage = extractRssImage(rssItem);
  if (rssImage) return rssImage;

  const ogImage = await fetchOpenGraphImage(articleUrl);
  if (ogImage) return ogImage;

  return '';
}

module.exports = {
  extractRssImage,
  fetchOpenGraphImage,
  resolveArticleImage
};
