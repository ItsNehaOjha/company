/**
 * Swarashtra.in Frontend Core Application Script
 */

const STATE_SLUGS = {
  'uttar-pradesh': 'Uttar Pradesh',
  'delhi': 'Delhi NCR',
  'delhi-ncr': 'Delhi NCR',
  'haryana': 'Haryana',
  'punjab': 'Punjab',
  'uttarakhand': 'Uttarakhand',
  'himachal-pradesh': 'Himachal Pradesh',
  'jammu-kashmir': 'Jammu & Kashmir'
};

const CATEGORY_SLUGS = {
  'national': 'National',
  'business': 'Business',
  'technology': 'Technology',
  'sports': 'Sports',
  'opinion': 'Opinion',
  'education': 'Education',
  'videos': 'Videos'
};

function isStateSlugRoute(path) {
  const slug = path.replace(/^\//, '').split('/')[0];
  return Object.prototype.hasOwnProperty.call(STATE_SLUGS, slug);
}

function resolveStateFromPath(path) {
  if (path.startsWith('/state/')) {
    const param = decodeURIComponent(path.split('/').pop());
    return STATE_SLUGS[param.toLowerCase()] || param;
  }
  const slug = path.replace(/^\//, '').split('/')[0];
  return STATE_SLUGS[slug] || slug;
}

function isCategorySlugRoute(path) {
  const slug = path.replace(/^\//, '').split('/')[0];
  return Object.prototype.hasOwnProperty.call(CATEGORY_SLUGS, slug);
}

function resolveCategoryFromPath(path) {
  const slug = path.replace(/^\//, '').split('/')[0];
  return CATEGORY_SLUGS[slug] || slug;
}

// Inject pulse animation for skeleton loaders
const pulseStyle = document.createElement('style');
pulseStyle.textContent = `
  @keyframes pulse {
    0% { background-color: var(--color-border); opacity: 0.6; }
    50% { background-color: var(--color-bg-inset); opacity: 0.9; }
    100% { background-color: var(--color-border); opacity: 0.6; }
  }
  .skeleton-pulse {
    animation: pulse 1.5s infinite ease-in-out;
  }
`;
document.head.appendChild(pulseStyle);

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initHeaderSearch();
  initNewsletter();

  // Detect current page view
  const path = window.location.pathname;
  if (path === '/' || path === '/index.html') {
    loadHomepage();
  } else if (path.startsWith('/article/')) {
    const articleId = path.split('/').pop();
    loadArticlePage(articleId);
  } else if (path.startsWith('/state/') || isStateSlugRoute(path)) {
    const stateName = resolveStateFromPath(path);
    loadStatePage(stateName);
  } else if (isCategorySlugRoute(path)) {
    const categoryName = resolveCategoryFromPath(path);
    loadCategoryPage(categoryName);
  } else if (path === '/search' || path === '/search.html') {
    loadSearchPage();
  }

  // Reload data when language switches
  window.addEventListener('langChanged', () => {
    if (path === '/' || path === '/index.html') {
      loadHomepage();
    } else if (path.startsWith('/article/')) {
      const articleId = path.split('/').pop();
      loadArticlePage(articleId);
    } else if (path.startsWith('/state/') || isStateSlugRoute(path)) {
      const stateName = resolveStateFromPath(path);
      loadStatePage(stateName);
    } else if (isCategorySlugRoute(path)) {
      const categoryName = resolveCategoryFromPath(path);
      loadCategoryPage(categoryName);
    } else if (path === '/search' || path === '/search.html') {
      loadSearchPage();
    }
  });
});

// ==========================================
// THEME MANAGEMENT (DARK MODE)
// ==========================================
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const storedTheme = localStorage.getItem('swarashtra_theme') || 'light';

  // Set initial theme
  document.documentElement.setAttribute('data-theme', storedTheme);
  updateThemeIcon(storedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('swarashtra_theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }
}

function updateThemeIcon(theme) {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  if (theme === 'dark') {
    toggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  } else {
    toggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}

// ==========================================
// SEARCH TRIGGER (HEADER)
// ==========================================
function initHeaderSearch() {
  const searchBtn = document.getElementById('headerSearchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      window.location.href = '/search';
    });
  }
}

// ==========================================
// NEWSLETTER SUBSCRIPTION Form
// ==========================================
function initNewsletter() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('.newsletter-input');
    const msgDiv = document.getElementById('newsletterMsg');

    if (!emailInput || !emailInput.value) return;

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.value })
      });

      const data = await res.json();
      if (data.success) {
        emailInput.value = '';
        msgDiv.style.color = '#10B981'; // green
        msgDiv.textContent = data.message;
        msgDiv.style.display = 'block';
      } else {
        msgDiv.style.color = '#FF6B6B'; // red
        msgDiv.textContent = data.error;
        msgDiv.style.display = 'block';
      }
    } catch (err) {
      console.error('Newsletter error:', err);
    }
  });
}

// ==========================================
// HELPER: DATE FORMATTING & MULTILINGUAL FIELDS
// ==========================================
function formatCardDate(isoString, lang) {
  const date = new Date(isoString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', options);
}

function getLocalizedField(article, fieldPrefix) {
  const lang = getCurrentLanguage();
  const fieldName = `${fieldPrefix}_${lang}`;
  return article[fieldName] || article[`${fieldPrefix}_en`] || '';
}

// Render Skeletons Utility
function renderSkeletons(count = 3) {
  let skeletonsHtml = '';
  for (let i = 0; i < count; i++) {
    skeletonsHtml += `
      <div class="news-card" style="opacity: 0.65;">
        <div class="card-img-wrapper skeleton-pulse" style="background: var(--color-border); height: 200px; border-radius: var(--border-radius-md);"></div>
        <div class="card-body" style="padding-top: 15px;">
          <div class="skeleton-pulse" style="background: var(--color-border); height: 12px; width: 30%; margin-bottom: 10px; border-radius: 4px;"></div>
          <div class="skeleton-pulse" style="background: var(--color-border); height: 22px; width: 90%; margin-bottom: 10px; border-radius: 4px;"></div>
          <div class="skeleton-pulse" style="background: var(--color-border); height: 12px; width: 100%; margin-bottom: 8px; border-radius: 4px;"></div>
          <div class="skeleton-pulse" style="background: var(--color-border); height: 12px; width: 70%; border-radius: 4px;"></div>
        </div>
      </div>
    `;
  }
  return skeletonsHtml;
}

function getDisplayAuthor(article) {
  if (article.author && !/^(swarashtra|admin|bureau|staff writer)$/i.test(article.author)) {
    return article.author;
  }
  return article.source_name || 'Source Staff';
}

function estimateReadMinutes(text) {
  const words = (text || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function renderImageBlock(article, title, variant = 'card') {
  if (!article.image_url) {
    const label = article.category || 'News';
    return `<div class="card-no-image card-no-image--${variant}" aria-hidden="true"><span class="card-no-image-label">${label}</span></div>`;
  }
  return `
    <img src="${article.image_url}" alt="${title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-no-image card-no-image--${variant}\\'><span class=\\'card-no-image-label\\'>${article.category || 'News'}</span></div>'">
    ${article.is_video ? `<div class="video-play-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>` : ''}
  `;
}

// Render Article Cards
function renderArticleCard(article) {
  const lang = getCurrentLanguage();
  const title = getLocalizedField(article, 'title');
  const summary = getLocalizedField(article, 'summary');
  const formattedDate = formatCardDate(article.published_at, lang);
  const readTimeLabel = lang === 'hi' ? 'मिनट पठन' : 'Min Read';
  const readMins = estimateReadMinutes(summary);
  const sourceLabel = article.source_name || '';
  const textOnlyClass = article.image_url ? '' : ' news-card--text-only';

  return `
    <article class="news-card${textOnlyClass}">
      <div class="card-img-wrapper">
        ${renderImageBlock(article, title, 'card')}
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="text-accent">${article.category}</span>
          <span>•</span>
          <span>${article.state}</span>
          ${sourceLabel ? `<span>•</span><span class="card-source">${sourceLabel}</span>` : ''}
        </div>
        <h3 class="card-title">
          <a href="/article/${article.id}">${title}</a>
        </h3>
        <p class="card-summary">${summary}</p>
        <div class="card-footer">
          <span>${getDisplayAuthor(article)}</span>
          <span>${formattedDate} • ${readMins} ${readTimeLabel}</span>
        </div>
      </div>
    </article>
  `;
}

// ==========================================
// HOMEPAGE INGESTION
// ==========================================
async function loadHomepage() {
  const lang = getCurrentLanguage();
  console.log('[App] Loading homepage in:', lang);

  const topGrid = document.getElementById('topStoriesGrid');
  if (topGrid) topGrid.innerHTML = renderSkeletons(3);

  // 1. Fetch Ticker
  try {
    const res = await fetch('/api/news/breaking');
    const data = await res.json();
    const wrapper = document.getElementById('tickerWrapper');
    if (wrapper) {
      let html = '';
      if (data.customMessage) {
        html += `<span class="ticker-item">${data.customMessage}</span>`;
      }
      if (data.breaking && data.breaking.length > 0) {
        data.breaking.forEach(item => {
          const title = lang === 'hi' ? (item.title_hi || item.title_en) : item.title_en;
          html += `<a href="/article/${item.id}" class="ticker-item">🔴 ${title}</a>`;
        });
      } else if (!data.customMessage) {
        html = `<span class="ticker-item skeleton-pulse" style="display:inline-block;width:60%;height:14px;border-radius:4px;"></span>`;
      }
      wrapper.innerHTML = html;
    }
  } catch (err) {
    console.error('Error loading ticker:', err);
  }

  // 2. Fetch Hero Story
  try {
    const res = await fetch('/api/news/hero');
    const hero = await res.json();
    const container = document.getElementById('heroContainer');
    if (container && hero) {
      const title = getLocalizedField(hero, 'title');
      const summary = getLocalizedField(hero, 'summary');
      const btnText = getTranslation('read_more');
      const readMins = estimateReadMinutes(summary);
      const readLabel = lang === 'hi' ? 'मिनट पठन' : 'min read';
      const heroImageHtml = hero.image_url
        ? `<img src="${hero.image_url}" alt="${title}" onerror="this.parentElement.classList.add('hero-image-container--no-image')">`
        : '';
      const heroClass = hero.image_url ? '' : ' hero-section--text-only';

      container.className = `hero-section${heroClass}`;
      container.innerHTML = `
        <div class="hero-image-container${hero.image_url ? '' : ' hero-image-container--no-image'}">
          ${heroImageHtml}
        </div>
        <div class="hero-overlay">
          <div class="container">
            <div class="hero-content">
              <div class="hero-meta">
                <span class="badge badge-accent">${hero.category}</span>
                <span class="badge badge-navy">${hero.state}</span>
                <span>•</span>
                <span>${formatCardDate(hero.published_at, lang)}</span>
              </div>
              <h1 class="hero-title">${title}</h1>
              <p class="hero-summary">${summary}</p>
              <a href="/article/${hero.id}" class="btn-primary">
                ${btnText}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </a>
            </div>
          </div>
        </div>
      `;
    } else if (container) {
      container.className = 'hero-section hero-section--empty';
      container.innerHTML = `<div class="hero-skeleton skeleton-pulse"></div>`;
    }
  } catch (err) {
    console.error('Error loading hero:', err);
  }

  // 3. Fetch Top Stories (Featured stories)
  try {
    const res = await fetch('/api/news/top-stories');
    const stories = await res.json();
    if (topGrid) {
      if (stories.length === 0) {
        topGrid.innerHTML = `<p>${getTranslation('no_results')}</p>`;
      } else {
        topGrid.innerHTML = stories.map(story => renderArticleCard(story)).join('');
      }
    }
  } catch (err) {
    console.error('Error loading top stories:', err);
  }

  // 4. Fetch State Focus
  try {
    const states = ['Delhi NCR', 'Uttar Pradesh', 'Punjab', 'Haryana', 'Uttarakhand'];

    // Fetch state focus sections independently to guarantee population if stories exist
    await Promise.all(states.map(async (st) => {
      try {
        const colId = `state-col-${st.toLowerCase().replace(' ncr', '-ncr').replace(/ /g, '-')}`;
        const el = document.getElementById(colId);
        if (el) {
          const res = await fetch(`/api/news/latest?state=${encodeURIComponent(st)}&limit=3`);
          const data = await res.json();
          const stateStories = data.articles || [];

          let html = `<div class="state-col-name">${st}</div>`;
          if (stateStories.length === 0) {
            html += `<p style="font-size:0.85rem;color:var(--color-text-light);">No recent stories.</p>`;
          } else {
            stateStories.forEach(story => {
              const title = getLocalizedField(story, 'title');
              html += `
                <div class="list-card">
                  <div class="list-card-body">
                    <h4 class="list-card-title"><a href="/article/${story.id}">${title}</a></h4>
                    <div class="list-card-meta">${formatCardDate(story.published_at, lang)}</div>
                  </div>
                </div>
              `;
            });
          }
          el.innerHTML = html;
        }
      } catch (e) {
        console.error('Error fetching state focus for', st, e);
      }
    }));
  } catch (err) {
    console.error('Error loading state focus:', err);
  }

  // 5. Fetch Videos
  try {
    const res = await fetch('/api/news/videos?limit=4');
    const videos = await res.json();
    const grid = document.getElementById('videosGrid');
    if (grid) {
      if (videos.length === 0) {
        grid.innerHTML = `<p style="grid-column: span 4; text-align: center; color: var(--color-text-light);">No videos available.</p>`;
      } else {
        grid.innerHTML = videos.map(v => `
          <div class="video-card">
            <div class="card-img-wrapper">
              ${renderImageBlock(v, getLocalizedField(v, 'title'), 'video')}
              <a href="/article/${v.id}"><div class="video-play-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div></a>
            </div>
            <div class="card-body">
              <h4 class="card-title"><a href="/article/${v.id}">${getLocalizedField(v, 'title')}</a></h4>
              <div class="card-footer" style="padding-top:10px;margin-top:10px;">
                <span>${v.source_name || v.state}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading videos:', err);
  }

  // 6. Load Opinion List
  loadCategorySection('opinionList', 'Opinion', 3, 'opinion');

  // 7. Load National, Business, Technology, Sports sections
  loadCategorySection('nationalGrid', 'National', 4);
  loadCategorySection('businessGrid', 'Business', 4);
  loadCategorySection('technologyGrid', 'Technology', 4);
  loadCategorySection('sportsGrid', 'Sports', 4);

  // 8. Load Trending Widget
  try {
    const res = await fetch('/api/news/trending?limit=5');
    const trending = await res.json();
    const list = document.getElementById('trendingList');
    if (list) {
      if (trending.length === 0) {
        list.innerHTML = renderSkeletons(3);
      } else {
        list.innerHTML = trending.map((art, index) => {
          const title = getLocalizedField(art, 'title');
          return `
            <li class="trending-item">
              <span class="trending-num">0${index + 1}</span>
              <div class="trending-item-body">
                <h4 class="trending-item-title"><a href="/article/${art.id}">${title}</a></h4>
                <div class="list-card-meta">${art.category} • ${art.views_count} ${getTranslation('views')}</div>
              </div>
            </li>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error loading trending:', err);
  }

  // 9. Load Trending Topics
  try {
    const res = await fetch('/api/news/topics');
    const topics = await res.json();
    const container = document.getElementById('trendingTopics');
    if (container) {
      if (topics.length === 0) {
        container.innerHTML = '';
      } else {
        container.innerHTML = topics.map(tag => {
          const searchParam = tag.includes('Pradesh') || tag.includes('NCR') || tag.includes('Punjab') || tag.includes('Haryana') || tag.includes('Uttarakhand')
            ? `state=${encodeURIComponent(tag.replace(/([A-Z])/g, ' $1').trim())}`
            : `category=${encodeURIComponent(tag)}`;
          return `<a href="/search?${searchParam}" class="topic-tag">#${tag}</a>`;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error loading topics:', err);
  }
}

async function loadCategorySection(elementId, category, limit, layout = 'grid') {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.innerHTML = layout === 'grid' ? renderSkeletons(Math.min(limit, 3)) : '';

  try {
    const res = await fetch(`/api/news/latest?category=${encodeURIComponent(category)}&limit=${limit}`);
    const data = await res.json();

    if (data.articles.length === 0) {
      el.innerHTML = `<p class="section-empty">${getTranslation('no_results')}</p>`;
      return;
    }

    if (layout === 'opinion') {
      el.innerHTML = data.articles.map(art => {
        const title = getLocalizedField(art, 'title');
        const source = art.source_name || getDisplayAuthor(art);
        return `
          <div class="opinion-card">
            <div class="opinion-source-label">${source}</div>
            <h4 class="opinion-title"><a href="/article/${art.id}">${title}</a></h4>
            <div class="list-card-meta">${formatCardDate(art.published_at, getCurrentLanguage())}</div>
          </div>
        `;
      }).join('');
    } else {
      el.innerHTML = data.articles.map(art => renderArticleCard(art)).join('');
    }
  } catch (err) {
    console.error(`Error loading ${category} section:`, err);
  }
}

// ==========================================
// ARTICLE DETAIL PAGE
// ==========================================
async function loadArticlePage(articleId) {
  const lang = getCurrentLanguage();
  console.log('[App] Loading article ID:', articleId);

  try {
    // 1. Fetch details
    const res = await fetch(`/api/news/${articleId}`);
    if (!res.ok) {
      document.getElementById('articleMainWrapper').innerHTML = `<h2>Article not found.</h2>`;
      return;
    }
    const article = await res.json();

    // 2. Increment view count
    fetch(`/api/news/${articleId}/view`, { method: 'POST' });

    // 3. Render content
    const title = getLocalizedField(article, 'title');
    const summary = getLocalizedField(article, 'summary');
    const content = getLocalizedField(article, 'content');
    const aiSummary = lang === 'hi' ? article.ai_summary_hi : article.ai_summary_en;
    const readMins = estimateReadMinutes(summary || content);
    const readLabel = lang === 'hi' ? 'मिनट पठन' : 'min read';
    const isAggregated = !article.is_manual;
    const sourceAttribution = article.source_name || 'Original Source';
    const authorLabel = getDisplayAuthor(article);
    const readAtSourceLabel = lang === 'hi' ? 'मूल स्रोत पर पढ़ें' : 'Read at Original Source';
    const attributionNote = lang === 'hi'
      ? 'यह सारांश स्रोत प्रकाशन से एकत्रित किया गया है। पूर्ण लेख के लिए मूल स्रोत पर जाएं।'
      : 'This summary is aggregated from the source publication. Visit the original source for the full article.';

    const imageHtml = article.image_url
      ? `<div class="article-main-image"><img src="${article.image_url}" alt="${title}" onerror="this.parentElement.remove()"></div>`
      : '';

    const bodyContent = isAggregated
      ? `<p>${summary}</p>`
      : content.split('\n\n').filter(Boolean).map(para => `<p>${para}</p>`).join('');

    const sourceCta = article.source_url
      ? `<a href="${article.source_url}" class="btn-primary source-cta-btn" target="_blank" rel="noopener noreferrer">${readAtSourceLabel} — ${sourceAttribution}</a>`
      : '';

    const wrapper = document.getElementById('articleMainWrapper');
    if (wrapper) {
      wrapper.innerHTML = `
        <div class="article-header-meta">
          <span class="badge badge-accent">${article.category}</span>
          <span class="badge badge-navy">${article.state}</span>
          <span>•</span>
          <span>${formatCardDate(article.published_at, lang)}</span>
          <span>•</span>
          <span>${readMins} ${readLabel}</span>
        </div>
        <h1 class="article-title">${title}</h1>
        
        <div class="article-author-meta">
          <div class="article-author-info">
            <span class="article-author-name">${authorLabel}</span>
            <span>${lang === 'hi' ? 'स्रोत' : 'Source'}: <strong>${sourceAttribution}</strong></span>
          </div>
          <div class="share-buttons">
            <button class="btn-share" onclick="shareArticle('twitter')" title="Share on Twitter"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg></button>
            <button class="btn-share" onclick="shareArticle('facebook')" title="Share on Facebook"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg></button>
            <button class="btn-share" onclick="copyUrl()" title="Copy Link"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></button>
          </div>
        </div>

        ${aiSummary ? `
          <div class="ai-summary-box">
            <h4><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg> ${lang === 'hi' ? 'एआई सारांश' : 'AI Summary'}</h4>
            <div class="ai-summary-text">${aiSummary}</div>
          </div>
        ` : ''}

        ${imageHtml}

        <div class="article-body">
          ${article.is_video && article.video_url ? `
            <div class="article-video-embed">
              <iframe src="${article.video_url}" allowfullscreen></iframe>
            </div>
          ` : ''}
          ${bodyContent}
        </div>

        ${isAggregated ? `
          <div class="source-attribution-box">
            <p>${attributionNote}</p>
            ${sourceCta}
          </div>
        ` : sourceCta}
      `;
    }

    // 4. Track Analytics (duration, browser, location resolved backend-side)
    initArticleAnalytics(articleId, article.state);

    // 5. Load sidebar elements
    loadTrendingSidebar();
    loadRelatedArticles(article.category, article.id);

    // 6. Comments Engine
    loadArticleComments(articleId);
    initCommentsForm(articleId);

  } catch (err) {
    console.error('Error rendering article page:', err);
  }
}

// Fetch author profile box in article reading
async function loadAuthorDetailInfo(authorName) {
  try {
    const res = await fetch('/api/authors');
    const authors = await res.json();
    const author = authors.find(a => a.name.toLowerCase() === authorName.toLowerCase());

    if (author) {
      const box = document.getElementById('authorDetailBox');
      if (box) {
        box.innerHTML = `
          <img src="${author.photo_url}" alt="${author.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-primary);">
          <div>
            <h4 style="margin: 0 0 5px 0; font-size: 1.1rem; color: var(--color-primary-dark);">${author.name}</h4>
            <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 10px;">${author.designation}</div>
            <p style="margin: 0; font-size: 0.88rem; line-height: 1.4; color: var(--color-text);">${author.bio}</p>
          </div>
        `;
        box.style.display = 'flex';
      }
    }
  } catch (err) {
    console.error('Error loading author details box:', err);
  }
}

// ==========================================
// COMMENTS RENDERING & SUBMISSIONS (ARTICLE)
// ==========================================
async function loadArticleComments(articleId) {
  try {
    const res = await fetch(`/api/articles/${articleId}/comments`);
    const comments = await res.json();
    const list = document.getElementById('commentsList');

    if (list) {
      if (comments.length === 0) {
        list.innerHTML = `<p style="color:var(--color-text-muted); font-style:italic;">No comments yet. Be the first to share your thoughts!</p>`;
      } else {
        const parentComments = comments.filter(c => !c.parent_id);

        list.innerHTML = parentComments.map(c => {
          const replies = comments.filter(r => r.parent_id === c.id);
          const formattedDate = new Date(c.created_at).toLocaleString();

          let commentHtml = `
            <div class="comment-item" style="background:var(--color-bg-card); border: 1px solid var(--color-border); padding: 20px; border-radius: var(--border-radius-md); display: flex; flex-direction: column; gap: 8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:var(--color-primary);">${c.author_name}</strong>
                <span style="font-size:0.75rem; color:var(--color-text-light);">${formattedDate}</span>
              </div>
              <p style="margin:0; font-size:0.95rem; line-height:1.5; color:var(--color-text);">${c.content}</p>
              <button class="btn-share" style="background:none; border:none; color:var(--color-primary-light); font-size:0.8rem; cursor:pointer; padding:5px 0; margin-top:5px; text-align: left; width: fit-content;" onclick="triggerReplyForm(${c.id}, '${c.author_name}')">Reply</button>
              
              <!-- Reply Form Container -->
              <div id="replyForm-${c.id}" style="display:none; margin-top:15px; padding-left:20px; border-left:2px solid var(--color-border);"></div>
          `;

          if (replies.length > 0) {
            commentHtml += `<div class="replies-list" style="margin-top:15px; padding-left:20px; display:flex; flex-direction:column; gap:15px; border-left:2px solid var(--color-border);">`;
            replies.forEach(r => {
              const replyDate = new Date(r.created_at).toLocaleString();
              commentHtml += `
                <div class="reply-item" style="background:var(--color-bg-inset); padding:15px; border-radius: var(--border-radius-sm); display: flex; flex-direction: column; gap: 5px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--color-primary-dark); font-size:0.85rem;">${r.author_name}</strong>
                    <span style="font-size:0.7rem; color:var(--color-text-light);">${replyDate}</span>
                  </div>
                  <p style="margin:0; font-size:0.9rem; line-height:1.4; color:var(--color-text);">${r.content}</p>
                </div>
              `;
            });
            commentHtml += `</div>`;
          }

          commentHtml += `</div>`;
          return commentHtml;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error loading comments:', err);
  }
}

// Global hooks to support nested reply triggers in DOM
window.triggerReplyForm = function (parentId, authorName) {
  const container = document.getElementById(`replyForm-${parentId}`);
  if (!container) return;

  if (container.style.display === 'block') {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <h5 style="margin: 0 0 10px 0; font-size:0.85rem; color:var(--color-text-muted);">Replying to ${authorName}</h5>
    <form onsubmit="event.preventDefault(); submitReplyComment(${parentId});">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
        <input type="text" id="replyName-${parentId}" placeholder="Name" class="form-control" style="padding:6px; font-size:0.8rem; border:1px solid var(--color-border); border-radius:4px;" required>
        <input type="email" id="replyEmail-${parentId}" placeholder="Email" class="form-control" style="padding:6px; font-size:0.8rem; border:1px solid var(--color-border); border-radius:4px;" required>
      </div>
      <textarea id="replyContent-${parentId}" placeholder="Write your reply..." class="form-control" style="height:60px; padding:8px; font-size:0.85rem; resize:vertical; margin-bottom:10px; border:1px solid var(--color-border); border-radius:4px; width: 100%;" required></textarea>
      <button type="submit" class="btn-primary" style="padding:6px 12px; font-size:0.8rem;">Submit Reply</button>
    </form>
  `;
  container.style.display = 'block';
};

window.submitReplyComment = async function (parentId) {
  const path = window.location.pathname;
  const articleId = path.split('/').pop();

  const name = document.getElementById(`replyName-${parentId}`).value.trim();
  const email = document.getElementById(`replyEmail-${parentId}`).value.trim();
  const content = document.getElementById(`replyContent-${parentId}`).value.trim();

  try {
    const res = await fetch(`/api/articles/${articleId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, content, parentId })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Reply submitted successfully and is awaiting moderation.');
      const container = document.getElementById(`replyForm-${parentId}`);
      container.style.display = 'none';
      container.innerHTML = '';
    } else {
      alert(data.error || 'Failed to submit reply.');
    }
  } catch (err) {
    console.error('Error submitting reply comment:', err);
  }
};

function initCommentsForm(articleId) {
  const form = document.getElementById('articleCommentForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('commentName');
    const emailInput = document.getElementById('commentEmail');
    const contentInput = document.getElementById('commentContent');
    const alertMsg = document.getElementById('commentAlertMsg');

    try {
      const res = await fetch(`/api/articles/${articleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          email: emailInput.value.trim(),
          content: contentInput.value.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alertMsg.style.color = 'var(--color-success)';
        alertMsg.textContent = data.message;
        alertMsg.style.display = 'block';
        form.reset();
      } else {
        alertMsg.style.color = 'var(--color-accent)';
        alertMsg.textContent = data.error || 'Failed to post comment.';
        alertMsg.style.display = 'block';
      }
    } catch (err) {
      console.error('Comment submission error:', err);
      alertMsg.style.color = 'var(--color-accent)';
      alertMsg.textContent = 'Server communication error.';
      alertMsg.style.display = 'block';
    }
  });
}

// ==========================================
// STATE LANDING PAGE
// ==========================================
async function loadStatePage(stateName) {
  const lang = getCurrentLanguage();
  const titleEl = document.getElementById('statePageTitle');
  if (titleEl) titleEl.textContent = stateName;

  const grid = document.getElementById('stateArticlesGrid');
  if (grid) grid.innerHTML = renderSkeletons(3);

  try {
    const res = await fetch(`/api/news/latest?state=${encodeURIComponent(stateName)}&limit=15`);
    const data = await res.json();

    if (grid) {
      if (data.articles.length === 0) {
        grid.innerHTML = `<p style="grid-column: span 3; text-align: center;">${getTranslation('no_results')}</p>`;
      } else {
        grid.innerHTML = data.articles.map(art => renderArticleCard(art)).join('');
      }
    }
  } catch (err) {
    console.error('Error loading state page articles:', err);
  }
}

// ==========================================
// CATEGORY LANDING PAGE
// ==========================================
async function loadCategoryPage(categoryName) {
  const titleEl = document.getElementById('statePageTitle');
  if (titleEl) titleEl.textContent = categoryName;

  const grid = document.getElementById('stateArticlesGrid');
  if (grid) grid.innerHTML = renderSkeletons(3);

  try {
    const res = await fetch(`/api/news/latest?category=${encodeURIComponent(categoryName)}&limit=15`);
    const data = await res.json();

    if (grid) {
      if (data.articles.length === 0) {
        grid.innerHTML = `<p style="grid-column: span 3; text-align: center;">${getTranslation('no_results')}</p>`;
      } else {
        grid.innerHTML = data.articles.map(art => renderArticleCard(art)).join('');
      }
    }
  } catch (err) {
    console.error('Error loading category page articles:', err);
  }
}

// ==========================================
// SEARCH PAGE WITH LOAD MORE PAGINATION
// ==========================================
async function loadSearchPage() {
  const queryInput = document.getElementById('searchInput');
  const stateSelect = document.getElementById('stateFilter');
  const dateSelect = document.getElementById('dateFilter');
  const sourceSelect = document.getElementById('sourceFilter');
  const triggerBtn = document.getElementById('searchTriggerBtn');
  const resultsGrid = document.getElementById('searchResultsGrid');
  const countLabel = document.getElementById('searchCountLabel');

  if (!queryInput) return;

  // Populate source filter from API
  if (sourceSelect) {
    fetch('/api/news/sources').then(r => r.json()).then(sources => {
      sources.forEach(src => {
        const opt = document.createElement('option');
        opt.value = src;
        opt.textContent = src;
        sourceSelect.appendChild(opt);
      });
    }).catch(() => { });
  }

  let searchOffset = 0;
  const searchLimit = 9;

  // Insert "Load More" button container if not present
  let loadMoreBtn = document.getElementById('searchLoadMoreBtn');
  if (!loadMoreBtn) {
    const btnContainer = document.createElement('div');
    btnContainer.style.textAlign = 'center';
    btnContainer.style.marginTop = '40px';
    btnContainer.innerHTML = `<button id="searchLoadMoreBtn" class="btn-primary" style="display:none; padding:12px 30px; font-weight:700;">Load More Stories</button>`;
    resultsGrid.parentNode.appendChild(btnContainer);
    loadMoreBtn = document.getElementById('searchLoadMoreBtn');
  }

  const runSearch = async (append = false) => {
    if (!append) {
      searchOffset = 0;
      resultsGrid.innerHTML = renderSkeletons(6);
      loadMoreBtn.style.display = 'none';
    }

    const keyword = queryInput.value.trim();
    const state = stateSelect.value;
    const source = sourceSelect ? sourceSelect.value : '';
    const dateRange = dateSelect ? dateSelect.value : '';

    let dateFrom = '';
    const now = new Date();
    if (dateRange === 'today') {
      dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    } else if (dateRange === 'week') {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (dateRange === 'month') {
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    let url = `/api/news/latest?limit=${searchLimit}&offset=${searchOffset}`;
    if (keyword) url += `&search=${encodeURIComponent(keyword)}`;
    if (state) url += `&state=${encodeURIComponent(state)}`;
    if (source) url += `&source=${encodeURIComponent(source)}`;
    if (dateFrom) url += `&dateFrom=${encodeURIComponent(dateFrom)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!append) {
        resultsGrid.innerHTML = '';
      }

      if (data.articles.length === 0 && !append) {
        resultsGrid.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 40px 0;"><h3>${getTranslation('no_results')}</h3></div>`;
        if (countLabel) countLabel.textContent = '0';
        loadMoreBtn.style.display = 'none';
      } else {
        const html = data.articles.map(art => renderArticleCard(art)).join('');
        if (append) {
          resultsGrid.insertAdjacentHTML('beforeend', html);
        } else {
          resultsGrid.innerHTML = html;
        }

        // Update counts
        const count = resultsGrid.querySelectorAll('article.news-card').length;
        if (countLabel) countLabel.textContent = data.total || count;

        // Toggle load more button
        if (data.articles.length < searchLimit || count >= data.total) {
          loadMoreBtn.style.display = 'none';
        } else {
          loadMoreBtn.style.display = 'inline-block';
        }
      }
    } catch (err) {
      console.error('Error fetching search results:', err);
    }
  };

  // Bind Listeners
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => runSearch(false));
  }
  queryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') runSearch(false);
  });
  stateSelect.addEventListener('change', () => runSearch(false));
  if (dateSelect) dateSelect.addEventListener('change', () => runSearch(false));
  if (sourceSelect) sourceSelect.addEventListener('change', () => runSearch(false));

  loadMoreBtn.addEventListener('click', () => {
    searchOffset += searchLimit;
    runSearch(true);
  });

  // Trigger initial search
  runSearch(false);
}

// ==========================================
// SIDEBAR ELEMENTS (FOR DETAILS)
// ==========================================
async function loadTrendingSidebar() {
  try {
    const res = await fetch('/api/news/trending?limit=5');
    const trending = await res.json();
    const wrapper = document.getElementById('articleTrendingWrapper');
    if (wrapper) {
      wrapper.innerHTML = trending.map((art, idx) => `
        <div class="trending-item">
          <span class="trending-num">0${idx + 1}</span>
          <div class="trending-item-body">
            <h4 class="trending-item-title"><a href="/article/${art.id}">${getLocalizedField(art, 'title')}</a></h4>
            <div class="list-card-meta">${art.category} • ${art.views_count} views</div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading trending sidebar:', err);
  }
}

async function loadRelatedArticles(category, currentId) {
  try {
    const res = await fetch(`/api/news/latest?category=${category}&limit=4`);
    const data = await res.json();
    const wrapper = document.getElementById('relatedStoriesGrid');
    if (wrapper) {
      const related = data.articles.filter(a => a.id !== parseInt(currentId)).slice(0, 3);
      if (related.length === 0) {
        wrapper.innerHTML = `<p>No related articles.</p>`;
      } else {
        wrapper.innerHTML = related.map(art => renderArticleCard(art)).join('');
      }
    }
  } catch (err) {
    console.error('Error loading related articles:', err);
  }
}

// ==========================================
// ANALYTICS & VISITOR DURATION LOGS
// ==========================================
function initArticleAnalytics(articleId, state) {
  const startTime = Date.now();

  // Detect Device Type
  let device = 'Desktop';
  const width = window.innerWidth;
  if (width < 600) device = 'Mobile';
  else if (width < 992) device = 'Tablet';

  // Flush analytics log when visitor leaves the page
  window.addEventListener('beforeunload', () => {
    const duration = Math.round((Date.now() - startTime) / 1000);

    // Check navigator.sendBeacon support for reliable logs on exit
    const payload = JSON.stringify({
      articleId,
      deviceType: device,
      state,
      country: 'India',
      duration
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/log', payload);
    } else {
      fetch('/api/analytics/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      });
    }
  });
}

// ==========================================
// SHARE BUTTON ACTIONS
// ==========================================
window.shareArticle = function (platform) {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(document.title);

  if (platform === 'twitter') {
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  } else if (platform === 'facebook') {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  }
};

window.copyUrl = function () {
  navigator.clipboard.writeText(window.location.href);
  alert('Article link copied to clipboard!');
};
