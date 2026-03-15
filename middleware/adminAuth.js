const session = require('express-session');

/**
 * Session configuration for admin routes
 */
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'paper-street-events-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
};

/**
 * Session middleware instance
 */
const sessionMiddleware = session(sessionConfig);

/**
 * Authentication middleware
 * Checks if user is authenticated via session
 * Redirects to login page or returns 401 for API requests
 */
const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    // Check if it's an HTML request or API request
    const isApiRequest = req.headers.accept && req.headers.accept.includes('application/json');
    if (isApiRequest) {
      res.status(401).json({ error: 'Unauthorized' });
    } else {
      res.redirect('/admin/login');
    }
  }
};

/**
 * Login handler
 * Validates password and creates authenticated session
 */
const handleLogin = async (req, res) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return res.status(500).json({ error: 'Admin password not configured' });
    }

    if (password === adminPassword) {
      req.session.isAdmin = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Logout handler
 * Destroys the session
 */
const handleLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
};

/**
 * Check authentication status
 * Returns current auth state
 */
const checkAuth = (req, res) => {
  res.json({ authenticated: !!req.session.isAdmin });
};

module.exports = {
  sessionMiddleware,
  sessionConfig,
  requireAuth,
  handleLogin,
  handleLogout,
  checkAuth
};
