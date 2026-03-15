const express = require('express');
const router = express.Router();
const db = require('../db/utils/connection');
const path = require('path');
const {
  sessionMiddleware,
  requireAuth,
  handleLogin,
  handleLogout,
  checkAuth
} = require('../middleware/adminAuth');

// Apply session middleware to all routes
router.use(sessionMiddleware);

// GET /admin/login - Render unified login page
router.get('/admin/login', (req, res) => {
  // Redirect if already authenticated
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, '../views/adminLogin.html'));
});

// POST /admin/login - Handle authentication
router.post('/admin/login', handleLogin);

// GET /admin/logout - Logout and redirect to login
router.get('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/admin/login');
  });
});

// POST /admin/logout - Logout (API endpoint)
router.post('/admin/logout', handleLogout);

// GET /admin - Show unified dashboard (requires auth)
router.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/adminDashboard.html'));
});

// GET /api/admin/dashboard/stats - Return statistics for dashboard cards
router.get('/api/admin/dashboard/stats', requireAuth, async (req, res) => {
  try {
    // Get upcoming events count
    const today = new Date().toISOString().split('T')[0];
    const eventsResult = await db.query(
      'SELECT COUNT(*) as count FROM events WHERE event_date >= $1',
      [today]
    );
    const upcomingEvents = parseInt(eventsResult.rows[0].count) || 0;

    // Get subscribers count
    const subscribersResult = await db.query(
      "SELECT COUNT(*) as count FROM subscribers WHERE status = 'subscribed'"
    );
    const subscribersCount = parseInt(subscribersResult.rows[0].count) || 0;

    // Get newsletters sent count
    const newslettersResult = await db.query(
      'SELECT COUNT(*) as count FROM newsletter_log'
    );
    const newslettersSent = parseInt(newslettersResult.rows[0].count) || 0;

    // Get last newsletter sent date
    const lastNewsletterResult = await db.query(
      'SELECT sent_at FROM newsletter_log ORDER BY sent_at DESC LIMIT 1'
    );
    const lastNewsletterDate = lastNewsletterResult.rows.length > 0
      ? lastNewsletterResult.rows[0].sent_at
      : null;

    res.json({
      upcomingEvents,
      subscribersCount,
      newslettersSent,
      lastNewsletterDate
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

module.exports = router;
