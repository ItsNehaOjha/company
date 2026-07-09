# Swarashtra.in - Premium Digital News Portal

### live on: <https://swarashtra.onrender.com>

Swarashtra is a production-grade, high-performance digital news and media platform dedicated to independent, ground-level journalism covering North India (Delhi NCR, Uttar Pradesh, Punjab, Haryana, Uttarakhand).

The system integrates an automated RSS crawler pipeline, a secure SQLite-backed database, a client-side multilingual localization engine, and a custom content management system (CMS) dashboard.

---

## Key Features

1. **Automated RSS Aggregator Pipeline**: Periodically fetches and aggregates regional ground updates, deduplicates articles, and parses media feeds.
2. **Responsive Design System**: Custom Vanilla CSS layouts with dark/light themes that load instantaneously on slow rural network connections.
3. **Multilingual Support (i18n)**: Instantaneous English and Hindi dictionary translations utilizing localized data attributes without database queries.
4. **Administrative CMS Portal**: Secure write-access dashboard for news creation, editing, category updates, and deletion.
5. **Advanced SEO Injection Engine**: Dynamically injects title tags, description metas, canonicals, hreflangs, and structured JSON-LD schemas (NewsArticle, BreadcrumbList, WebSite, Organization) on page requests.
6. **Production Security**: Connect-SQLite3 persistent session store, CSRF mitigation for administrative mutations, rate limiters, Helmet HTTP headers, and Brotli/Gzip compression.

---

## Technology Stack

- **Runtime & Framework**: Node.js, Express
- **Database**: SQLite3 (relational local file database)
- **Templating & Hydration**: Plain HTML5 (Served via Express static & custom inject engine)
- **Styling**: Modern CSS3 (Variables, Flexbox, Grids, media queries)
- **Libraries**:
  - `compression` for Gzip/Brotli payloads.
  - `express-rate-limit` to prevent denial-of-service on API surfaces.
  - `helmet` for Content Security Policy (CSP) and clickjacking protection.
  - `xmlbuilder` for automated dynamic XML sitemap generation.

---

## Folder Structure

```
SwarashtraCompanyInternshipMERN/
├── company-assets/             # Brand identity, signatures, and stamps
│   ├── logos/
│   ├── stamps/
│   ├── signatures/             # HTML email signatures (email_signature.html)
│   ├── letterheads/
│   ├── favicons/
│   ├── social/
│   └── documents/
├── db/                         # Database schema definition and data scripts
│   ├── database.js             # SQLite initialization and utility queries
│   └── swarashtra.db           # SQLite database file
├── public/                     # Static files directory
│   ├── css/
│   │   ├── variables.css       # Global design system tokens
│   │   ├── style.css           # Core styling sheets and footer classes
│   │   ├── dark.css            # Dark mode overrides
│   │   └── admin.css           # Admin control panel stylesheet
│   └── js/
│       ├── i18n.js             # Multilingual client-side dictionary script
│       ├── app.js              # Hydration loader and event controllers
│       └── admin.js            # CMS operations and database calls
├── routes/                     # Router modules
│   ├── api.js                  # CMS actions and newsletter submissions API
│   └── web.js                  # Frontend routes and dynamic SEO injector
├── services/                   # Background operations
│   └── aggregator.js           # RSS aggregator ingestion pipeline
├── views/                      # HTML page templates
│   ├── index.html              # Main homepage
│   ├── article.html            # Article detail page
│   ├── search.html             # Advanced archive search
│   ├── state.html              # State and Category news feed
│   ├── admin.html              # CMS control center
│   ├── about.html              # About Us policy page
│   ├── contact.html            # Contact Us & office coordinates page
│   ├── privacy.html            # Privacy Policy
│   ├── editorial.html          # Journalistic guidelines & corrections policy
│   └── terms.html              # Terms of Service & usage terms
├── Dockerfile                  # Container configurations
├── docker-compose.yml          # Local container composition
├── server.js                   # Application entry point
├── package.json                # Project dependencies
└── README.md                   # System documentation
```

---

## Installation & Local Development

### Prerequisites
- Node.js (version 16 or higher)
- npm (Node Package Manager)

### Step 1: Clone and Install
```bash
git clone https://github.com/your-org/swarashtra.git
cd swarashtra
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the root directory by copying the example:
```bash
cp .env.example .env
```
Ensure the variables are set correctly:
```env
PORT=3000
SESSION_SECRET=swarashtra_super_secure_key_123!
NODE_ENV=development
```

### Step 3: Run the Application
Start the local server:
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser. The system will automatically initialize the SQLite database tables and start the background RSS aggregator.

---

## Deployment Guidelines

### Render Deployment
This repository is configured for easy deployment on Render:

1. **Web Service**: Create a new Web Service on Render and connect your repository.
2. **Build Command**: Set the build command to:
   ```bash
   npm install
   ```
3. **Start Command**: Set the start command to:
   ```bash
   node server.js
   ```
4. **Environment Variables**: Add your production variables in the Render dashboard:
   - `NODE_ENV=production`
   - `SESSION_SECRET=your_long_random_string_secret`
5. **Disk Storage**: Since SQLite is serverless and writes to a local file, attach a **Persistent Disk** to your Render Web Service (e.g. Mount Path `/data`). Update your environment or database path to save `swarashtra.db` and `swarashtra_sessions.db` to `/data/` to prevent database wipes on restarts.

---

## Future Roadmap

- **Progressive Web App (PWA)**: Support offline article reading and push notifications for breaking updates.
- **Search Optimization**: Implement full-text indexing inside SQLite for faster query responses across archives.
- **Aggregated Video Streams**: Embed custom regional video reports directly on the homepage feeds.

---

## Contribution & License

Contributions are welcome! Please submit a pull request or open an issue on the repository to discuss proposed changes.

This project is licensed under the **MIT License**.

**Author**: Swarashtra Media Engineering Desk  
**Contact**: info@swarashtra.in
