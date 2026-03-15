const express = require('express');
const router = express.Router();
const session = require('express-session');
const path = require('path');
const subscriberService = require('../services/subscriberService');

// Session middleware - only for subscriber admin routes
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'paper-street-subscribers-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.subscribersAuthenticated) {
    next();
  } else {
    // Check if it's an HTML request or API request
    const isApiRequest = req.path.startsWith('/api/') ||
                        (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isApiRequest) {
      res.status(401).json({ error: 'Unauthorized' });
    } else {
      res.redirect('/admin/subscribers/login');
    }
  }
};

// Apply session middleware to all routes
router.use(sessionMiddleware);

// ============================================================================
// Authentication Routes
// ============================================================================

// GET /admin/subscribers/login - Render login page
router.get('/admin/subscribers/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/subscribersLogin.html'));
});

// POST /admin/subscribers/login - Handle login
router.post('/admin/subscribers/login', async (req, res) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return res.status(500).json({ error: 'Admin password not configured' });
    }

    if (password === adminPassword) {
      req.session.subscribersAuthenticated = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /admin/subscribers/logout - Handle logout
router.post('/admin/subscribers/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// GET /admin/subscribers/check-auth - Check authentication status
router.get('/admin/subscribers/check-auth', (req, res) => {
  res.json({ authenticated: !!req.session.subscribersAuthenticated });
});

// ============================================================================
// Admin Page Routes (HTML)
// ============================================================================

// GET /admin/subscribers - Main admin interface (password protected)
router.get('/admin/subscribers', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/subscribersAdmin.html'));
});

// ============================================================================
// API Routes (JSON) - All require authentication
// ============================================================================

// GET /api/admin/subscribers - Get subscribers with filtering and pagination
router.get('/api/admin/subscribers', requireAuth, async (req, res) => {
  try {
    const { status, source, searchTerm, page, limit } = req.query;

    // Build filters object
    const filters = {};
    if (status) filters.status = status;
    if (source) filters.source = source;
    if (searchTerm) filters.searchTerm = searchTerm;

    // Build pagination object
    const pagination = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    };

    const result = await subscriberService.getSubscribers(filters, pagination);
    res.json(result);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// GET /api/admin/subscribers/stats - Get subscriber statistics
router.get('/api/admin/subscribers/stats', requireAuth, async (req, res) => {
  try {
    const stats = await subscriberService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/admin/subscribers/:id - Get single subscriber details
router.get('/api/admin/subscribers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const subscriber = await subscriberService.getSubscriber(id);
    res.json(subscriber);
  } catch (error) {
    console.error('Error fetching subscriber:', error);
    if (error.message === 'Subscriber not found') {
      res.status(404).json({ error: 'Subscriber not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch subscriber' });
    }
  }
});

// GET /api/admin/subscribers/:id/history - Get subscriber activity history
router.get('/api/admin/subscribers/:id/history', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const history = await subscriberService.getSubscriberHistory(id);
    res.json(history);
  } catch (error) {
    console.error('Error fetching subscriber history:', error);
    if (error.message === 'Subscriber not found') {
      res.status(404).json({ error: 'Subscriber not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch subscriber history' });
    }
  }
});

// PATCH /api/admin/subscribers/:id/status - Update subscriber status
router.patch('/api/admin/subscribers/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updated = await subscriberService.updateSubscriberStatus(id, status);
    res.json(updated);
  } catch (error) {
    console.error('Error updating subscriber status:', error);
    if (error.message === 'Subscriber not found') {
      res.status(404).json({ error: 'Subscriber not found' });
    } else if (error.message.includes('Invalid status')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update subscriber status' });
    }
  }
});

// POST /api/admin/subscribers/bulk-update - Bulk update subscriber statuses
router.post('/api/admin/subscribers/bulk-update', requireAuth, async (req, res) => {
  try {
    const { subscriberIds, status } = req.body;

    if (!subscriberIds || !Array.isArray(subscriberIds)) {
      return res.status(400).json({ error: 'subscriberIds must be an array' });
    }

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (subscriberIds.length === 0) {
      return res.status(400).json({ error: 'subscriberIds array cannot be empty' });
    }

    const result = await subscriberService.bulkUpdateStatus(subscriberIds, status);
    res.json(result);
  } catch (error) {
    console.error('Error bulk updating subscribers:', error);
    if (error.message.includes('Invalid status')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to bulk update subscribers' });
    }
  }
});

// POST /api/admin/subscribers/search - Search subscribers
router.post('/api/admin/subscribers/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await subscriberService.searchSubscribers(query);
    res.json(results);
  } catch (error) {
    console.error('Error searching subscribers:', error);
    res.status(500).json({ error: 'Failed to search subscribers' });
  }
});

// GET /api/admin/subscribers/export - Export subscribers as CSV
router.get('/api/admin/subscribers/export', requireAuth, async (req, res) => {
  try {
    const { status, source, searchTerm } = req.query;

    // Build filters object
    const filters = {};
    if (status) filters.status = status;
    if (source) filters.source = source;
    if (searchTerm) filters.searchTerm = searchTerm;

    const csv = await subscriberService.exportSubscribersCSV(filters);

    // Set headers for CSV download
    const filename = `subscribers_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting subscribers:', error);
    res.status(500).json({ error: 'Failed to export subscribers' });
  }
});

module.exports = router;
