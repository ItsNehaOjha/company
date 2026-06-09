const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const xmlbuilder = require('xmlbuilder');
const { dbAll, dbGet } = require('../db/database');

const viewsDir = path.join(__dirname, '..', 'views');

// Helper to inject SEO metadata, OpenGraph, Twitter Cards, hreflang, canonicals and schema.org markup
function injectSEO(html, options = {}) {
  const {
    title = 'Swarashtra.in | Voice of North India',
    description = 'Swarashtra is a premium independent digital media newsroom for North India.',
    imageUrl = 'https://swarashtra.in/logo.png',
    canonicalUrl = 'https://swarashtra.in/',
    hreflangs = [
      { lang: 'en', url: 'https://swarashtra.in/?lang=en' },
      { lang: 'hi', url: 'https://swarashtra.in/?lang=hi' }
    ],
    schemas = []
  } = options;

  // 1. Remove any existing title tags in HTML
  let processedHtml = html.replace(/<title>.*?<\/title>/gi, '');

  // 2. Build metadata block
  let metaTags = `
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="Swarashtra">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">

  <!-- SEO Crawling -->
  <link rel="canonical" href="${canonicalUrl}">
  `;

  // Alternate Language Mappings (Hreflang)
  hreflangs.forEach(h => {
    metaTags += `<link rel="alternate" hreflang="${h.lang}" href="${h.url}">\n  `;
  });

  // Inject Schemas
  schemas.forEach((schema, idx) => {
    metaTags += `\n  <script type="application/ld+json" id="seoSchema-${idx}">\n  ${JSON.stringify(schema, null, 2)}\n  </script>`;
  });

  // Insert inside head tag
  processedHtml = processedHtml.replace('</head>', `${metaTags}\n</head>`);
  return processedHtml;
}

// Global Organization Schema
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Swarashtra",
  "url": "https://swarashtra.in",
  "logo": "https://swarashtra.in/logo.png",
  "sameAs": [
    "https://twitter.com/swarashtra",
    "https://www.facebook.com/swarashtra"
  ]
};

// Route: Homepage
router.get('/', async (req, res) => {
  try {
    const filePath = path.join(viewsDir, 'index.html');
    let html = fs.readFileSync(filePath, 'utf8');

    const homepageSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Swarashtra",
      "url": "https://swarashtra.in",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://swarashtra.in/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    };

    const seoHtml = injectSEO(html, {
      title: 'Swarashtra.in | Voice of North India',
      description: 'Independent, premium news platform for North India. Read trusted investigations, political analyses, technology breakdowns, and regional updates.',
      imageUrl: 'https://swarashtra.in/logo.png',
      canonicalUrl: 'https://swarashtra.in/',
      hreflangs: [
        { lang: 'en', url: 'https://swarashtra.in/' },
        { lang: 'hi', url: 'https://swarashtra.in/?lang=hi' }
      ],
      schemas: [homepageSchema, orgSchema]
    });

    res.send(seoHtml);
  } catch (err) {
    res.status(500).send('Error rendering page');
  }
});

// Route: Article Detail Page
router.get('/article/:id', async (req, res) => {
  try {
    const article = await dbGet('SELECT * FROM articles WHERE id = ?', [req.params.id]);
    const filePath = path.join(viewsDir, 'article.html');
    let html = fs.readFileSync(filePath, 'utf8');

    if (!article) {
      return res.status(404).send('Article not found');
    }

    const title = `${article.title_en} | Swarashtra.in`;
    const description = article.summary_en || article.content_en.substring(0, 150);
    const canonicalUrl = `https://swarashtra.in/article/${article.id}`;
    
    // Construct NewsArticle Schema
    const newsArticleSchema = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": article.title_en,
      "image": [article.image_url],
      "datePublished": article.published_at,
      "dateModified": article.published_at,
      "author": [{
        "@type": "Person",
        "name": article.author || article.source_name || "Source Staff",
        "url": "https://swarashtra.in"
      }],
      "publisher": {
        "@type": "Organization",
        "name": "Swarashtra",
        "logo": {
          "@type": "ImageObject",
          "url": "https://swarashtra.in/logo.png"
        }
      },
      "description": description
    };

    // Construct Breadcrumb Schema
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://swarashtra.in"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": article.category,
          "item": `https://swarashtra.in/search?category=${encodeURIComponent(article.category)}`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": article.title_en,
          "item": canonicalUrl
        }
      ]
    };

    const seoHtml = injectSEO(html, {
      title,
      description,
      imageUrl: article.image_url,
      canonicalUrl,
      hreflangs: [
        { lang: 'en', url: `https://swarashtra.in/article/${article.id}` },
        { lang: 'hi', url: `https://swarashtra.in/article/${article.id}?lang=hi` }
      ],
      schemas: [newsArticleSchema, breadcrumbSchema]
    });

    res.send(seoHtml);
  } catch (err) {
    res.status(500).send('Error rendering page');
  }
});

const STATE_SLUG_MAP = {
  'uttar-pradesh': 'Uttar Pradesh',
  'delhi': 'Delhi NCR',
  'delhi-ncr': 'Delhi NCR',
  'haryana': 'Haryana',
  'punjab': 'Punjab',
  'uttarakhand': 'Uttarakhand',
  'himachal-pradesh': 'Himachal Pradesh',
  'jammu-kashmir': 'Jammu & Kashmir'
};

function resolveStateName(param) {
  const slug = decodeURIComponent(param).toLowerCase();
  return STATE_SLUG_MAP[slug] || decodeURIComponent(param);
}

function renderStatePage(stateName, res) {
  const filePath = path.join(viewsDir, 'state.html');
  let html = fs.readFileSync(filePath, 'utf8');
  const canonicalSlug = Object.entries(STATE_SLUG_MAP).find(([, v]) => v === stateName)?.[0] || encodeURIComponent(stateName);
  const canonicalUrl = `https://swarashtra.in/${canonicalSlug}`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://swarashtra.in" },
      { "@type": "ListItem", "position": 2, "name": stateName, "item": canonicalUrl }
    ]
  };

  const seoHtml = injectSEO(html, {
    title: `${stateName} News & Ground Reports | Swarashtra.in`,
    description: `Latest news, policy updates, and regional reporting from ${stateName}. Aggregated from trusted Indian and international sources.`,
    canonicalUrl,
    hreflangs: [{ lang: 'en', url: canonicalUrl }],
    schemas: [breadcrumbSchema]
  });

  res.send(seoHtml);
}

// SEO-friendly state slug routes
Object.entries(STATE_SLUG_MAP).forEach(([slug, stateName]) => {
  router.get(`/${slug}`, (req, res) => {
    try {
      renderStatePage(stateName, res);
    } catch (err) {
      res.status(500).send('Error rendering page');
    }
  });
});

const CATEGORY_SLUG_MAP = {
  'national': 'National',
  'business': 'Business',
  'technology': 'Technology',
  'sports': 'Sports',
  'opinion': 'Opinion',
  'education': 'Education',
  'videos': 'Videos'
};

function renderCategoryPage(categoryName, res) {
  const filePath = path.join(viewsDir, 'state.html');
  let html = fs.readFileSync(filePath, 'utf8');
  const canonicalUrl = `https://swarashtra.in/${categoryName.toLowerCase()}`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://swarashtra.in" },
      { "@type": "ListItem", "position": 2, "name": categoryName, "item": canonicalUrl }
    ]
  };

  const seoHtml = injectSEO(html, {
    title: `${categoryName} News & Coverage | Swarashtra.in`,
    description: `Latest news, article updates, and analyses from the field of ${categoryName}.`,
    canonicalUrl,
    hreflangs: [{ lang: 'en', url: canonicalUrl }],
    schemas: [breadcrumbSchema]
  });

  res.send(seoHtml);
}

// SEO-friendly category slug routes
Object.entries(CATEGORY_SLUG_MAP).forEach(([slug, categoryName]) => {
  router.get(`/${slug}`, (req, res) => {
    try {
      renderCategoryPage(categoryName, res);
    } catch (err) {
      res.status(500).send('Error rendering page');
    }
  });
});

// Route: State Focus Page (legacy /state/:state support)
router.get('/state/:state', async (req, res) => {
  try {
    const stateName = resolveStateName(req.params.state);
    renderStatePage(stateName, res);
  } catch (err) {
    res.status(500).send('Error rendering page');
  }
});

// Route: Search Archive Page
router.get('/search', async (req, res) => {
  try {
    const filePath = path.join(viewsDir, 'search.html');
    let html = fs.readFileSync(filePath, 'utf8');

    const seoHtml = injectSEO(html, {
      title: 'Search Digital Archives | Swarashtra.in',
      description: 'Search regional and national news headlines, articles, agriculture studies, and video report archives.',
      canonicalUrl: 'https://swarashtra.in/search',
      hreflangs: [
        { lang: 'en', url: 'https://swarashtra.in/search' }
      ]
    });

    res.send(seoHtml);
  } catch (err) {
    res.status(500).send('Error rendering page');
  }
});

// Route: Admin Page (no SEO needed)
router.get('/admin', (req, res) => {
  res.sendFile(path.join(viewsDir, 'admin.html'));
});

// robots.txt Route
router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin

Sitemap: https://swarashtra.in/sitemap.xml
`);
});

// Dynamic XML Sitemap for SEO & Google News Compatibility
router.get('/sitemap.xml', async (req, res) => {
  try {
    const articles = await dbAll('SELECT id, published_at FROM articles ORDER BY published_at DESC LIMIT 500');
    
    const urlset = xmlbuilder.create('urlset', { encoding: 'UTF-8' })
      .att('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
      .att('xmlns:news', 'http://www.google.com/schemas/sitemap-news/0.9');

    // Add Home URL
    urlset.ele('url')
      .ele('loc', 'https://swarashtra.in/').up()
      .ele('changefreq', 'always').up()
      .ele('priority', '1.0').up();

    // Add state pages
    const states = ['uttar-pradesh', 'delhi', 'haryana', 'punjab', 'uttarakhand', 'himachal-pradesh', 'jammu-kashmir'];
    for (const state of states) {
      urlset.ele('url')
        .ele('loc', `https://swarashtra.in/${state}`).up()
        .ele('changefreq', 'hourly').up()
        .ele('priority', '0.8').up();
    }

    // Add category pages
    const categories = ['national', 'business', 'technology', 'sports', 'opinion', 'education', 'videos'];
    for (const category of categories) {
      urlset.ele('url')
        .ele('loc', `https://swarashtra.in/${category}`).up()
        .ele('changefreq', 'hourly').up()
        .ele('priority', '0.8').up();
    }

    // Add individual articles
    for (const article of articles) {
      const pubDate = article.published_at ? new Date(article.published_at).toISOString() : new Date().toISOString();
      urlset.ele('url')
        .ele('loc', `https://swarashtra.in/article/${article.id}`).up()
        .ele('lastmod', pubDate).up()
        .ele('changefreq', 'monthly').up()
        .ele('priority', '0.6').up();
    }

    const xmlString = urlset.end({ pretty: true });
    res.type('application/xml');
    res.send(xmlString);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
