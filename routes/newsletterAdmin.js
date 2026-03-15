const express = require('express');
const router = express.Router();
const path = require('path');
const newsletterService = require('../services/newsletterService');
const { generatePreview } = require('../services/newsletterGenerator');
const {
  sessionMiddleware,
  requireAuth,
  handleLogin,
  handleLogout,
  checkAuth
} = require('../middleware/adminAuth');

// Apply session middleware to all routes
router.use(sessionMiddleware);

// GET /admin/newsletter/login - Redirect to unified login
router.get('/admin/newsletter/login', (req, res) => {
  res.redirect('/admin/login');
});

// POST /admin/newsletter/login - Redirect to unified login handler
router.post('/admin/newsletter/login', (req, res) => {
  res.redirect(307, '/admin/login');
});

// POST /admin/newsletter/logout - Redirect to unified logout
router.post('/admin/newsletter/logout', (req, res) => {
  res.redirect(307, '/admin/logout');
});

// GET /admin/newsletter/check-auth - Use unified auth check
router.get('/admin/newsletter/check-auth', checkAuth);

// GET /admin/newsletter - Main admin interface (requires auth)
router.get('/admin/newsletter', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/newsletterAdmin.html'));
});

// GET /api/admin/newsletter/log - Get newsletter history with pagination
router.get('/api/admin/newsletter/log', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await newsletterService.getNewsletterHistory(page, limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching newsletter log:', error);
    res.status(500).json({ error: 'Failed to fetch newsletter history' });
  }
});

// GET /api/admin/newsletter/log/:id - Get single newsletter by ID
router.get('/api/admin/newsletter/log/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const newsletter = await newsletterService.getNewsletterById(id);

    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    res.json(newsletter);
  } catch (error) {
    console.error('Error fetching newsletter:', error);
    res.status(500).json({ error: 'Failed to fetch newsletter' });
  }
});

// GET /api/admin/newsletter/preview - Generate preview of next newsletter
router.get('/api/admin/newsletter/preview', requireAuth, async (req, res) => {
  try {
    const preview = await generatePreview();
    res.json(preview);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// POST /api/admin/newsletter/send-test - Send test newsletter
router.post('/api/admin/newsletter/send-test', requireAuth, async (req, res) => {
  try {
    const { email, previewData } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    if (!previewData || !previewData.subject || !previewData.htmlBody) {
      return res.status(400).json({ error: 'Preview data is required' });
    }

    const result = await newsletterService.sendTestNewsletter(email, previewData);
    res.json(result);
  } catch (error) {
    console.error('Error sending test newsletter:', error);
    res.status(500).json({ error: error.message || 'Failed to send test newsletter' });
  }
});

// POST /api/admin/newsletter/send - Send newsletter manually
router.post('/api/admin/newsletter/send', requireAuth, async (req, res) => {
  try {
    const { force, newsletterData } = req.body;

    if (!newsletterData || !newsletterData.subject || !newsletterData.htmlBody) {
      return res.status(400).json({ error: 'Newsletter data is required' });
    }

    const result = await newsletterService.sendManualNewsletter(force === true, newsletterData);

    if (result.blocked) {
      return res.status(409).json(result); // 409 Conflict
    }

    res.json(result);
  } catch (error) {
    console.error('Error sending newsletter:', error);
    res.status(500).json({ error: error.message || 'Failed to send newsletter' });
  }
});

// POST /api/admin/newsletter/custom - Create and send custom newsletter
router.post('/api/admin/newsletter/custom', requireAuth, async (req, res) => {
  try {
    const { subject, htmlBody, recipients } = req.body;

    if (!subject || !htmlBody) {
      return res.status(400).json({ error: 'Subject and HTML body are required' });
    }

    const result = await newsletterService.createCustomNewsletter(
      subject,
      htmlBody,
      recipients || null
    );

    res.json(result);
  } catch (error) {
    console.error('Error sending custom newsletter:', error);
    res.status(500).json({ error: error.message || 'Failed to send custom newsletter' });
  }
});

// GET /api/admin/newsletter/stats - Get newsletter statistics
router.get('/api/admin/newsletter/stats', requireAuth, async (req, res) => {
  try {
    const stats = await newsletterService.getNewsletterStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching newsletter stats:', error);
    res.status(500).json({ error: 'Failed to fetch newsletter statistics' });
  }
});

module.exports = router;
