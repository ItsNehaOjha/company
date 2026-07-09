require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const compression = require('compression');

const { initDatabase } = require('./db/database');
const { startAggregator } = require('./services/aggregator');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(cors());

// Compression Middleware (gzip/brotli)
app.use(compression({
  level: 6,
  threshold: 0,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Configure Helmet with CSP to allow Unsplash images and video embeds
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com"
        ],

        fontSrc: [
          "'self'",
          "data:",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com"
        ],
        imgSrc: ["'self'", "data:", "https://*.google.com", "https://*.googleusercontent.com", "https://*.dw.com", "https://*.bbci.co.uk", "https://*.thehindu.com", "https://*.indianexpress.com", "https://*.reuters.com", "https://*.ani.in", "http://localhost:*", "https://*"],
        frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
        connectSrc: ["'self'"]
      }
    }
  })
);

// Rate Limiting (Prevent API abuse)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(
  session({
    store: new SQLiteStore({
      db: 'swarashtra_sessions.db',
      dir: path.join(__dirname, 'db')
    }),
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'swarashtra_super_secure_key_123!',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Set to true if running behind HTTPS/SSL
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  })
);

// CSRF Generation Middleware
app.use((req, res, next) => {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    }
    // Save to cookie so client side JS can read and send it in headers
    res.cookie('csrfToken', req.session.csrfToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: false // accessible client side
    });
  }
  next();
});

// CSRF Protection Middleware for Administrative Mutation APIs
app.use('/api/admin', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const clientToken = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session ? req.session.csrfToken : null;

  if (!clientToken || !sessionToken || clientToken !== sessionToken) {
    console.warn('[Security] CSRF verification failed on:', req.path);
    return res.status(403).json({ error: 'CSRF token mismatch or missing.' });
  }
  next();
});

// Serve Static Files with Cache-Control headers
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true
}));

// Mount Routes
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke in the server!' });
});

// Initialize System
async function startServer() {
  try {
    // 1. Initialize SQLite tables and seeds
    await initDatabase();

    // 2. Start RSS Aggregator Pipeline (Updates every 15 mins)
    startAggregator(15 * 60 * 1000);

    // 3. Listen
    app.listen(PORT, () => {
      console.log(`===================================================`);
      console.log(` SWARASHTRA DIGITAL NEWSPLATFORM RUNNING`);
      console.log(` Port:    http://localhost:${PORT}`);
      console.log(` Mode:    Production Ready`);
      console.log(` OS:      Windows Local Environment`);
      console.log(`===================================================`);
    });
  } catch (err) {
    console.error('Failed to start Swarashtra news server:', err);
    process.exit(1);
  }
}

startServer();
