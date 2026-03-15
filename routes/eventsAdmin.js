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

// Login endpoint
router.post('/admin/login', handleLogin);

// Logout endpoint
router.post('/admin/logout', handleLogout);

// Check auth status
router.get('/admin/check-auth', checkAuth);

// GET /admin/events/login - Render login page
router.get('/admin/events/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/eventsLogin.html'));
});

// GET /admin/events - Render admin page (password protected)
router.get('/admin/events', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/eventsAdmin.html'));
});

// GET /api/events - JSON endpoint with query params
router.get('/api/events', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = 'SELECT * FROM events';
    const params = [];

    // Build query based on date filters
    if (from || to) {
      query += ' WHERE';
      if (from) {
        params.push(from);
        query += ` event_date >= $${params.length}`;
      }
      if (to) {
        if (from) query += ' AND';
        params.push(to);
        query += ` event_date <= $${params.length}`;
      }
    }

    query += ' ORDER BY event_date ASC, event_time ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /admin/events - Create new event (password protected)
router.post('/admin/events', requireAuth, async (req, res) => {
  try {
    const {
      title,
      event_date,
      event_time,
      description,
      category,
      is_recurring,
      admission,
      notes
    } = req.body;

    // Validate required fields
    if (!title || !event_date || !event_time || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
      INSERT INTO events (
        title, event_date, event_time, description, category,
        is_recurring, admission, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const params = [
      title,
      event_date,
      event_time,
      description || null,
      category,
      is_recurring || false,
      admission || null,
      notes || null
    ];

    const result = await db.query(query, params);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /admin/events/:id - Update event (password protected)
router.put('/admin/events/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      event_date,
      event_time,
      description,
      category,
      is_recurring,
      admission,
      notes
    } = req.body;

    // Validate required fields
    if (!title || !event_date || !event_time || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
      UPDATE events
      SET
        title = $1,
        event_date = $2,
        event_time = $3,
        description = $4,
        category = $5,
        is_recurring = $6,
        admission = $7,
        notes = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `;

    const params = [
      title,
      event_date,
      event_time,
      description || null,
      category,
      is_recurring || false,
      admission || null,
      notes || null,
      id
    ];

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /admin/events/:id - Delete event (password protected)
router.delete('/admin/events/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM events WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
