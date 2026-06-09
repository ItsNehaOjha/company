/**
 * Swarashtra.in Admin Portal Orchestrator
 * Fully upgraded for authors, comment moderation, media catalog upload, and campaigns.
 */

let loggedInUser = null;
let currentTab = 'dashboard';
let editingArticleId = null;
let editingFeedId = null;
let editingAuthorId = null;

// Helper to read cookie values
function getCsrfToken() {
  const name = 'csrfToken=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return '';
}

// Wrapper for fetch that automatically injects CSRF headers for non-GET methods
async function adminFetch(url, options = {}) {
  options.headers = options.headers || {};
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    options.headers['x-csrf-token'] = getCsrfToken();
  }
  return fetch(url, options);
}

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  
  // Bind Login
  const loginForm = document.getElementById('adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Bind Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Bind Tabs
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  // Bind Article Form Submit
  const articleForm = document.getElementById('articleForm');
  if (articleForm) {
    articleForm.addEventListener('submit', saveArticle);
  }

  // Bind Author Form Submit
  const authorForm = document.getElementById('authorForm');
  if (authorForm) {
    authorForm.addEventListener('submit', saveAuthor);
  }

  // Bind Media Upload Form Submit
  const mediaUploadForm = document.getElementById('mediaUploadForm');
  if (mediaUploadForm) {
    mediaUploadForm.addEventListener('submit', uploadMedia);
  }

  // Bind Newsletter Campaign Submit
  const campaignForm = document.getElementById('newsletterCampaignForm');
  if (campaignForm) {
    campaignForm.addEventListener('submit', sendNewsletterCampaign);
  }

  // Bind Feed Form Submit
  const feedForm = document.getElementById('feedForm');
  if (feedForm) {
    feedForm.addEventListener('submit', saveFeed);
  }

  // Bind Feed Sync Trigger
  const syncBtn = document.getElementById('syncTriggerBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', triggerRssSync);
  }
});

// ==========================================
// SESSION CHECKING & AUTHENTICATION
// ==========================================
async function checkSession() {
  try {
    const res = await adminFetch('/api/admin/check-session');
    const data = await res.json();
    
    if (data.loggedIn) {
      loggedInUser = data.user;
      showDashboardLayout();
    } else {
      showLoginLayout();
    }
  } catch (err) {
    console.error('Session check error:', err);
    showLoginLayout();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const userEl = document.getElementById('usernameInput');
  const passEl = document.getElementById('passwordInput');
  const errEl = document.getElementById('loginErrorMsg');

  if (!userEl.value || !passEl.value) return;

  try {
    const res = await adminFetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userEl.value.trim(), password: passEl.value })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      loggedInUser = data.user;
      errEl.style.display = 'none';
      showDashboardLayout();
    } else {
      errEl.textContent = data.error || 'Invalid credentials.';
      errEl.style.display = 'block';
    }
  } catch (err) {
    console.error('Login error:', err);
    errEl.textContent = 'Server connection failed.';
    errEl.style.display = 'block';
  }
}

async function handleLogout() {
  try {
    await adminFetch('/api/admin/logout', { method: 'POST' });
    loggedInUser = null;
    showLoginLayout();
  } catch (err) {
    console.error('Logout error:', err);
  }
}

function showLoginLayout() {
  document.getElementById('adminLoginPortal').style.display = 'flex';
  document.getElementById('adminDashboardContainer').style.display = 'none';
}

function showDashboardLayout() {
  document.getElementById('adminLoginPortal').style.display = 'none';
  document.getElementById('adminDashboardContainer').style.display = 'grid';
  
  const welcomeEl = document.getElementById('welcomeUserLabel');
  if (welcomeEl && loggedInUser) {
    welcomeEl.textContent = loggedInUser.username;
  }
  
  switchTab('dashboard');
}

// ==========================================
// NAVIGATION TAB CONTROLS
// ==========================================
function switchTab(tabName) {
  currentTab = tabName;
  
  // Toggle Active Classes
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-tab') === tabName) {
      link.classList.add('active');
    }
  });

  // Toggle Section Views
  document.querySelectorAll('.admin-section').forEach(sec => {
    sec.style.display = 'none';
  });
  
  const targetSec = document.getElementById(`section-${tabName}`);
  if (targetSec) targetSec.style.display = 'block';

  // Load section-specific data
  if (tabName === 'dashboard') {
    loadDashboardStats();
  } else if (tabName === 'articles') {
    loadArticles();
  } else if (tabName === 'authors') {
    loadAuthors();
  } else if (tabName === 'comments') {
    loadComments();
  } else if (tabName === 'media') {
    loadMediaCatalog();
  } else if (tabName === 'feeds') {
    loadFeeds();
  } else if (tabName === 'subscribers') {
    loadSubscribers();
    loadCampaignArticles();
  }
}

// ==========================================
// DASHBOARD & ANALYTICS INGESTION
// ==========================================
async function loadDashboardStats() {
  try {
    const res = await adminFetch('/api/admin/dashboard');
    const data = await res.json();

    // Set Counters
    document.getElementById('statArticlesCount').textContent = data.counts.articles;
    document.getElementById('statViewsCount').textContent = data.counts.views;
    document.getElementById('statSubscribersCount').textContent = data.counts.subscribers;
    document.getElementById('statFeedsCount').textContent = data.counts.feeds;

    // Render State Views distribution
    const stateWrapper = document.getElementById('dashboardStateGrid');
    if (stateWrapper) {
      if (data.stateViews.length === 0) {
        stateWrapper.innerHTML = `<p>No visitor logs recorded.</p>`;
      } else {
        stateWrapper.innerHTML = `
          <table class="data-table">
            <thead>
              <tr><th>State / Territory</th><th>Visits / Read Events</th></tr>
            </thead>
            <tbody>
              ${data.stateViews.map(row => `<tr><td><strong>${row.state}</strong></td><td>${row.count} reads</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
    }

    // Render Device distribution
    const deviceWrapper = document.getElementById('dashboardDeviceGrid');
    if (deviceWrapper) {
      if (data.deviceStats.length === 0) {
        deviceWrapper.innerHTML = `<p>No device metrics recorded.</p>`;
      } else {
        deviceWrapper.innerHTML = `
          <table class="data-table">
            <thead>
              <tr><th>Device Platform</th><th>Visits Count</th></tr>
            </thead>
            <tbody>
              ${data.deviceStats.map(row => `<tr><td><strong>${row.device}</strong></td><td>${row.count} clicks</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
    }

    // Render Top Articles
    const topArticlesWrapper = document.getElementById('dashboardTopArticles');
    if (topArticlesWrapper) {
      if (data.topArticles.length === 0) {
        topArticlesWrapper.innerHTML = `<p>No views logged.</p>`;
      } else {
        topArticlesWrapper.innerHTML = `
          <table class="data-table">
            <thead>
              <tr><th>Headline</th><th>Views</th></tr>
            </thead>
            <tbody>
              ${data.topArticles.map(art => `<tr><td><a href="/article/${art.id}" target="_blank">${art.title_en}</a></td><td><strong>${art.views_count}</strong></td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
    }

  } catch (err) {
    console.error('Error loading admin dashboard stats:', err);
  }
}

// ==========================================
// ARTICLES CMS MANAGEMENT (CRUD)
// ==========================================
async function loadArticles() {
  try {
    const res = await adminFetch('/api/news/latest?limit=100');
    const data = await res.json();
    const tableBody = document.getElementById('articlesTableBody');
    
    if (tableBody) {
      tableBody.innerHTML = data.articles.map(art => `
        <tr>
          <td><strong>${art.id}</strong></td>
          <td>${art.title_en}</td>
          <td><span class="badge badge-navy" style="font-size:0.7rem;">${art.category}</span></td>
          <td>${art.state}</td>
          <td>${art.author}</td>
          <td>${new Date(art.published_at).toLocaleDateString()}</td>
          <td>${art.views_count}</td>
          <td>
            <button class="btn-action btn-edit" onclick="editArticle(${art.id})">Edit</button>
            <button class="btn-action btn-delete" onclick="deleteArticle(${art.id})">Delete</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading articles:', err);
  }
}

window.editArticle = async function(id) {
  editingArticleId = id;
  try {
    const res = await adminFetch(`/api/news/${id}`);
    const art = await res.json();

    document.getElementById('artTitleEn').value = art.title_en;
    document.getElementById('artTitleHi').value = art.title_hi || '';
    document.getElementById('artSummaryEn').value = art.summary_en || '';
    document.getElementById('artSummaryHi').value = art.summary_hi || '';
    document.getElementById('artContentEn').value = art.content_en || '';
    document.getElementById('artContentHi').value = art.content_hi || '';
    document.getElementById('artImageUrl').value = art.image_url || '';
    document.getElementById('artCategory').value = art.category;
    document.getElementById('artState').value = art.state;
    document.getElementById('artAuthor').value = art.author || '';
    document.getElementById('artIsHero').checked = art.is_hero === 1;
    document.getElementById('artIsBreaking').checked = art.is_breaking === 1;
    document.getElementById('artIsVideo').checked = art.is_video === 1;
    document.getElementById('artVideoUrl').value = art.video_url || '';

    document.getElementById('articleFormTitle').textContent = 'Modify Article';
    document.getElementById('artFormSubmitBtn').textContent = 'Update Article';
    
    // Smooth scroll to form
    document.getElementById('articleFormCard').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error('Edit error:', err);
  }
};

window.deleteArticle = async function(id) {
  if (!confirm('Are you sure you want to permanently delete this article?')) return;
  try {
    const res = await adminFetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadArticles();
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
};

async function saveArticle(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    title_en: form.artTitleEn.value.trim(),
    title_hi: form.artTitleHi.value.trim(),
    summary_en: form.artSummaryEn.value.trim(),
    summary_hi: form.artSummaryHi.value.trim(),
    content_en: form.artContentEn.value.trim(),
    content_hi: form.artContentHi.value.trim(),
    image_url: form.artImageUrl.value.trim(),
    category: form.artCategory.value,
    state: form.artState.value,
    author: form.artAuthor.value.trim(),
    is_hero: form.artIsHero.checked ? 1 : 0,
    is_breaking: form.artIsBreaking.checked ? 1 : 0,
    is_video: form.artIsVideo.checked ? 1 : 0,
    video_url: form.artVideoUrl.value.trim()
  };

  const url = editingArticleId ? `/api/admin/articles/${editingArticleId}` : '/api/admin/articles';
  const method = editingArticleId ? 'PUT' : 'POST';

  try {
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(data.message);
      form.reset();
      editingArticleId = null;
      document.getElementById('articleFormTitle').textContent = 'Write New Article';
      document.getElementById('artFormSubmitBtn').textContent = 'Publish Article';
      loadArticles();
    } else {
      alert(data.error || 'Failed to save article.');
    }
  } catch (err) {
    console.error('Save error:', err);
  }
}

// ==========================================
// AUTHORS CMS MODULE
// ==========================================
async function loadAuthors() {
  try {
    const res = await adminFetch('/api/authors');
    const authors = await res.json();
    const tableBody = document.getElementById('authorsTableBody');
    if (tableBody) {
      if (authors.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No authors registered yet.</td></tr>`;
      } else {
        tableBody.innerHTML = authors.map(auth => `
          <tr>
            <td><strong>${auth.id}</strong></td>
            <td>${auth.photo_url ? `<img src="${auth.photo_url}" alt="${auth.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : '<span style="font-size:0.75rem;color:#999;">No photo</span>'}</td>
            <td><strong>${auth.name}</strong></td>
            <td><span class="badge badge-navy" style="font-size:0.7rem;">${auth.designation}</span></td>
            <td><p style="font-size: 0.85rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0;">${auth.bio || ''}</p></td>
            <td>
              <button class="btn-action btn-edit" onclick="editAuthor(${auth.id})">Edit</button>
              <button class="btn-action btn-delete" onclick="deleteAuthor(${auth.id})">Delete</button>
            </td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading authors:', err);
  }
}

window.editAuthor = async function(id) {
  editingAuthorId = id;
  try {
    const res = await adminFetch('/api/authors');
    const authors = await res.json();
    const auth = authors.find(a => a.id === id);
    if (!auth) return;

    document.getElementById('authName').value = auth.name;
    document.getElementById('authDesignation').value = auth.designation;
    document.getElementById('authBio').value = auth.bio || '';
    document.getElementById('authPhotoUrl').value = auth.photo_url || '';
    document.getElementById('authTwitter').value = auth.social_twitter || '';

    document.getElementById('authorFormTitle').textContent = 'Modify Author Profile';
    document.getElementById('authFormSubmitBtn').textContent = 'Update Author';
    document.getElementById('authorFormCard').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Edit author error:', err);
  }
};

window.deleteAuthor = async function(id) {
  if (!confirm('Are you sure you want to delete this author?')) return;
  try {
    const res = await adminFetch(`/api/admin/authors/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadAuthors();
    }
  } catch (err) {
    console.error('Delete author error:', err);
  }
};

async function saveAuthor(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.authName.value.trim(),
    designation: form.authDesignation.value.trim(),
    bio: form.authBio.value.trim(),
    photo_url: form.authPhotoUrl.value.trim(),
    social_twitter: form.authTwitter.value.trim(),
    social_facebook: '#'
  };

  const url = editingAuthorId ? `/api/admin/authors/${editingAuthorId}` : '/api/admin/authors';
  const method = editingAuthorId ? 'PUT' : 'POST';

  try {
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert(data.message);
      form.reset();
      editingAuthorId = null;
      document.getElementById('authorFormTitle').textContent = 'Register New Author';
      document.getElementById('authFormSubmitBtn').textContent = 'Register Author';
      loadAuthors();
    } else {
      alert(data.error || 'Failed to save author.');
    }
  } catch (err) {
    console.error('Save author error:', err);
  }
}

// ==========================================
// COMMENTS INBOX MODERATION MODULE
// ==========================================
async function loadComments() {
  try {
    const res = await adminFetch('/api/admin/comments');
    const comments = await res.json();
    const tableBody = document.getElementById('commentsTableBody');
    if (tableBody) {
      if (comments.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No reader comments logged yet.</td></tr>`;
      } else {
        tableBody.innerHTML = comments.map(comm => `
          <tr>
            <td><a href="/article/${comm.article_id}" target="_blank" style="font-size: 0.85rem; font-weight:600;">${comm.article_title || 'Article #' + comm.article_id}</a></td>
            <td>
              <div style="font-size:0.85rem; font-weight:600;">${comm.author_name}</div>
              <div style="font-size:0.75rem; color:var(--color-text-muted);">${comm.author_email}</div>
            </td>
            <td><p style="font-size: 0.85rem; max-width: 300px; margin: 0; word-wrap: break-word; white-space: pre-line;">${comm.content}</p></td>
            <td>
              <span class="badge-status ${comm.is_approved === 1 ? 'badge-active' : 'badge-inactive'}">
                ${comm.is_approved === 1 ? 'Approved' : 'Pending'}
              </span>
            </td>
            <td style="font-size:0.8rem;">${new Date(comm.created_at).toLocaleString()}</td>
            <td style="display: flex; gap: 5px;">
              ${comm.is_approved === 0 ? `<button class="btn-action btn-edit" onclick="approveComment(${comm.id})">Approve</button>` : ''}
              <button class="btn-action btn-edit" style="background-color: var(--color-primary-light);" onclick="replyComment(${comm.id})">Reply</button>
              <button class="btn-action btn-delete" onclick="deleteComment(${comm.id})">Delete</button>
            </td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading comments:', err);
  }
}

window.approveComment = async function(id) {
  try {
    const res = await adminFetch(`/api/admin/comments/${id}/approve`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      loadComments();
    }
  } catch (err) {
    console.error('Approve comment error:', err);
  }
};

window.replyComment = async function(id) {
  const content = prompt('Enter editorial response/reply to this reader:');
  if (!content) return;
  try {
    const res = await adminFetch(`/api/admin/comments/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (data.success) {
      alert('Reply posted successfully.');
      loadComments();
    }
  } catch (err) {
    console.error('Reply comment error:', err);
  }
};

window.deleteComment = async function(id) {
  if (!confirm('Are you sure you want to permanently delete this comment?')) return;
  try {
    const res = await adminFetch(`/api/admin/comments/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadComments();
    }
  } catch (err) {
    console.error('Delete comment error:', err);
  }
};

// ==========================================
// PROCESSED MEDIA LIBRARY MODULE
// ==========================================
async function loadMediaCatalog() {
  try {
    const res = await adminFetch('/api/admin/media');
    const catalog = await res.json();
    const grid = document.getElementById('mediaLibraryGrid');
    if (grid) {
      if (catalog.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted);">No uploaded media items found.</p>`;
      } else {
        grid.innerHTML = catalog.map(media => `
          <div class="news-card" style="margin: 0; overflow: hidden; display: flex; flex-direction: column; border: 1px solid var(--color-border);">
            <div class="card-img-wrapper" style="height: 120px;">
              <img src="${media.filepath}" alt="${media.filename}" style="height: 100%; object-fit: cover;">
            </div>
            <div class="card-body" style="padding: 10px; display: flex; flex-direction: column; gap: 8px;">
              <div style="font-size: 0.75rem; word-break: break-all; font-weight: 600; color: var(--color-text-muted);">${media.filename}</div>
              <div style="font-size: 0.7rem; color: var(--color-text-light);">Size: ${(media.size / 1024).toFixed(1)} KB</div>
              <div style="display: flex; gap: 5px; margin-top: auto;">
                <button class="btn-action btn-edit" style="font-size:0.75rem; padding:5px 8px; flex: 1;" onclick="copyMediaLink('${media.filepath}')">Copy Path</button>
                <button class="btn-action btn-delete" style="font-size:0.75rem; padding:5px 8px;" onclick="deleteMedia(${media.id})">Delete</button>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading media catalog:', err);
  }
}

window.copyMediaLink = function(path) {
  navigator.clipboard.writeText(path);
  alert('Relative media path copied to clipboard: ' + path);
};

window.deleteMedia = async function(id) {
  if (!confirm('Are you sure you want to permanently delete this media file?')) return;
  try {
    const res = await adminFetch(`/api/admin/media/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadMediaCatalog();
    }
  } catch (err) {
    console.error('Delete media error:', err);
  }
};

async function uploadMedia(e) {
  e.preventDefault();
  const fileInput = document.getElementById('mediaFileInput');
  const msgEl = document.getElementById('mediaUploadMessage');
  if (!fileInput.files || fileInput.files.length === 0) return;

  const formData = new FormData();
  formData.append('imageFile', fileInput.files[0]);

  msgEl.style.color = 'var(--color-primary)';
  msgEl.textContent = 'Processing and compressing image...';
  msgEl.style.display = 'block';

  try {
    const res = await fetch('/api/admin/media/upload', {
      method: 'POST',
      headers: {
        'x-csrf-token': getCsrfToken()
      },
      body: formData
    });

    const data = await res.json();
    if (res.ok && data.success) {
      msgEl.style.color = 'var(--color-success)';
      msgEl.textContent = 'Image successfully uploaded as WebP!';
      fileInput.value = '';
      loadMediaCatalog();
    } else {
      msgEl.style.color = 'var(--color-accent)';
      msgEl.textContent = data.error || 'Failed to upload image.';
    }
  } catch (err) {
    console.error('Upload media error:', err);
    msgEl.style.color = 'var(--color-accent)';
    msgEl.textContent = 'Network error during upload.';
  }
}

// ==========================================
// NEWSLETTER CAMPAIGN DISPATCH
// ==========================================
async function loadCampaignArticles() {
  try {
    const res = await adminFetch('/api/news/latest?limit=15');
    const data = await res.json();
    const selector = document.getElementById('campaignArticlesSelector');
    if (selector) {
      if (data.articles.length === 0) {
        selector.innerHTML = '<span>No recent articles available to embed.</span>';
      } else {
        selector.innerHTML = data.articles.map(art => `
          <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
            <input type="checkbox" name="campaignArticleIds" value="${art.id}">
            <span>[${art.category}] ${art.title_en}</span>
          </label>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading articles for campaign list:', err);
  }
}

async function sendNewsletterCampaign(e) {
  e.preventDefault();
  const form = e.target;
  const statusMsg = document.getElementById('campaignStatusMsg');
  
  const selectedArticles = Array.from(document.querySelectorAll('input[name="campaignArticleIds"]:checked'))
    .map(cb => parseInt(cb.value));

  const payload = {
    subject: document.getElementById('campaignSubject').value.trim(),
    htmlContent: document.getElementById('campaignCustomHtml').value.trim(),
    articleIds: selectedArticles
  };

  statusMsg.style.color = 'var(--color-primary)';
  statusMsg.textContent = 'Sending newsletter to subscribers...';
  statusMsg.style.display = 'block';

  try {
    const res = await adminFetch('/api/admin/newsletter/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      statusMsg.style.color = 'var(--color-success)';
      statusMsg.textContent = data.message;
      form.reset();
      loadCampaignArticles();
    } else {
      statusMsg.style.color = 'var(--color-accent)';
      statusMsg.textContent = data.error || 'Failed to dispatch email newsletter.';
    }
  } catch (err) {
    console.error('Send campaign error:', err);
    statusMsg.style.color = 'var(--color-accent)';
    statusMsg.textContent = 'Server communication error.';
  }
}

// ==========================================
// RSS FEEDS MANAGEMENT
// ==========================================
async function loadFeeds() {
  try {
    const res = await adminFetch('/api/admin/feeds');
    const feeds = await res.json();
    const tableBody = document.getElementById('feedsTableBody');
    if (tableBody) {
      tableBody.innerHTML = feeds.map(feed => `
        <tr>
          <td><strong>${feed.id}</strong></td>
          <td>${feed.name}</td>
          <td><code style="font-size:0.8rem;color:var(--color-primary-dark);">${feed.url}</code></td>
          <td>${feed.category}</td>
          <td>${feed.state}</td>
          <td>
            <span class="badge-status ${feed.is_active === 1 ? 'badge-active' : 'badge-inactive'}">
              ${feed.is_active === 1 ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td>
            <button class="btn-action btn-edit" onclick="editFeed(${feed.id})">Edit</button>
            <button class="btn-action btn-delete" onclick="deleteFeed(${feed.id})">Delete</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading feeds:', err);
  }
}

window.editFeed = async function(id) {
  editingFeedId = id;
  try {
    const res = await adminFetch('/api/admin/feeds');
    const feeds = await res.json();
    const feed = feeds.find(f => f.id === id);

    document.getElementById('feedName').value = feed.name;
    document.getElementById('feedUrl').value = feed.url;
    document.getElementById('feedCategory').value = feed.category;
    document.getElementById('feedState').value = feed.state;
    document.getElementById('feedActive').value = feed.is_active;

    document.getElementById('feedFormTitle').textContent = 'Modify RSS Source';
    document.getElementById('feedFormSubmitBtn').textContent = 'Update Feed';

    document.getElementById('feedFormCard').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error('Edit feed error:', err);
  }
};

window.deleteFeed = async function(id) {
  if (!confirm('Are you sure you want to delete this RSS source?')) return;
  try {
    const res = await adminFetch(`/api/admin/feeds/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadFeeds();
    }
  } catch (err) {
    console.error('Delete feed error:', err);
  }
};

async function saveFeed(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.feedName.value.trim(),
    url: form.feedUrl.value.trim(),
    category: form.feedCategory.value,
    state: form.feedState.value,
    is_active: parseInt(form.feedActive.value)
  };

  const url = editingFeedId ? `/api/admin/feeds/${editingFeedId}` : '/api/admin/feeds';
  const method = editingFeedId ? 'PUT' : 'POST';

  try {
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(data.message);
      form.reset();
      editingFeedId = null;
      document.getElementById('feedFormTitle').textContent = 'Register New RSS Feed Source';
      document.getElementById('feedFormSubmitBtn').textContent = 'Add RSS Source';
      loadFeeds();
    } else {
      alert(data.error || 'Failed to save feed.');
    }
  } catch (err) {
    console.error('Save feed error:', err);
  }
}

async function triggerRssSync() {
  const btn = document.getElementById('syncTriggerBtn');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  
  try {
    const res = await adminFetch('/api/admin/feeds/trigger', { method: 'POST' });
    const data = await res.json();
    alert('Aggregation sync triggered in background! Articles will populate within 30 seconds.');
  } catch (err) {
    console.error('Sync trigger error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Trigger Live RSS Sync';
    setTimeout(loadArticles, 5000); // Reload list after 5s
  }
}

// ==========================================
// NEWSLETTER SUBSCRIBERS
// ==========================================
async function loadSubscribers() {
  try {
    const res = await adminFetch('/api/admin/subscribers');
    const subscribers = await res.json();
    const tableBody = document.getElementById('subscribersTableBody');
    if (tableBody) {
      if (subscribers.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No subscribers yet.</td></tr>`;
      } else {
        tableBody.innerHTML = subscribers.map(sub => `
          <tr>
            <td><strong>${sub.id}</strong></td>
            <td>${sub.email}</td>
            <td>${new Date(sub.subscribed_at).toLocaleString()}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading subscribers:', err);
  }
}
