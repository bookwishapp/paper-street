const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

// Import routes
const newsletterRoutes = require('./routes/newsletter');
const adminDashboard = require('./routes/adminDashboard');
const newsletterAdmin = require('./routes/newsletterAdmin');
const eventsAdmin = require('./routes/eventsAdmin');
const subscribersAdmin = require('./routes/subscribersAdmin');
const healthRoutes = require('./routes/health');
const contentApiRoutes = require('./routes/contentApi');

// Import and initialize scheduler
const { initializeScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up view engine for EJS templates
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parse URL-encoded bodies (for POST requests)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware for admin authentication
app.use(session({
  secret: process.env.ADMIN_PASSWORD || 'default-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Health and API routes
app.use(healthRoutes);

// Apply CORS to public API endpoints only
app.use('/api/content', cors({
  origin: true, // Allow all origins
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  optionsSuccessStatus: 200
}), contentApiRoutes);

// Apply CORS to public events API
app.use('/api/events', cors({
  origin: true,
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  optionsSuccessStatus: 200
}));

// Newsletter routes
app.use('/newsletter', newsletterRoutes);

// Unified admin dashboard (must be first to handle /admin and /admin/login)
app.use('/', adminDashboard);

// Newsletter admin routes
app.use('/', newsletterAdmin);

// Events admin routes
app.use('/', eventsAdmin);

// Subscribers admin routes
app.use('/', subscribersAdmin);

// Middleware to serve different content based on domain
app.use((req, res, next) => {
  const host = req.get('host');

  // Determine which site to serve based on the domain
  if (host && (host.includes('paperstreet.') || host.includes('paper-street.'))) {
    // Serve Paper Street Thrift site for subdomain
    req.siteFolder = 'paper-street';
  } else {
    // Serve main Sinclair Inlet Book Co. site for main domain
    req.siteFolder = 'sinclair-inlet';
  }

  next();
});

// Serve static files based on domain
app.use((req, res, next) => {
  if (req.siteFolder) {
    express.static(path.join(__dirname, req.siteFolder))(req, res, next);
  } else {
    next();
  }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  const siteFolder = req.siteFolder || 'sinclair-inlet';
  res.sendFile(path.join(__dirname, siteFolder, 'index.html'));
});

// Fallback for any other static assets
app.use('/sinclair-inlet', express.static(path.join(__dirname, 'sinclair-inlet')));
app.use('/paper-street', express.static(path.join(__dirname, 'paper-street')));

// Start the server
app.listen(PORT, () => {
  console.log(`Multi-site server is running on port ${PORT}`);
  console.log(`Main site: sinclair-inlet/`);
  console.log(`Paper Street site: paper-street/`);

  // Initialize cron scheduler
  console.log('Initializing newsletter system scheduler...');
  initializeScheduler();
});