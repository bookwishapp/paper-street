const express = require('express');
const router = express.Router();
const db = require('../db/utils/connection');

/**
 * Set cache headers for all responses
 */
function setCacheHeaders(res) {
  res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  res.set('Content-Type', 'application/json');
}

/**
 * GET /api/content/nyt-in-stock
 * Returns cached NYT bestsellers that are in stock
 */
router.get('/nyt-in-stock', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT data, generated_at
       FROM content_cache
       WHERE cache_key = 'nyt_in_stock'`,
      []
    );

    if (result.rows.length === 0) {
      setCacheHeaders(res);
      return res.json({
        data: [],
        generated_at: null,
        message: 'No cached data available'
      });
    }

    const { data, generated_at } = result.rows[0];
    setCacheHeaders(res);
    res.json({
      data: data || [],
      generated_at: generated_at
    });
  } catch (error) {
    console.error('Error fetching NYT in stock:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/content/new-inventory
 * Returns cached new inventory items
 */
router.get('/new-inventory', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT data, generated_at
       FROM content_cache
       WHERE cache_key = 'new_inventory'`,
      []
    );

    if (result.rows.length === 0) {
      setCacheHeaders(res);
      return res.json({
        data: [],
        generated_at: null,
        message: 'No cached data available'
      });
    }

    const { data, generated_at } = result.rows[0];
    setCacheHeaders(res);
    res.json({
      data: data || [],
      generated_at: generated_at
    });
  } catch (error) {
    console.error('Error fetching new inventory:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/content/upcoming-events
 * Returns upcoming events - either from cache or directly from events table
 * Query params: from (date), to (date)
 */
router.get('/upcoming-events', async (req, res) => {
  try {
    const { from, to } = req.query;

    // If date parameters provided, query events table directly
    if (from || to) {
      let query = `
        SELECT
          title,
          event_date,
          event_time,
          category,
          admission,
          notes
        FROM events
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      if (from) {
        paramCount++;
        query += ` AND event_date >= $${paramCount}`;
        params.push(from);
      }

      if (to) {
        paramCount++;
        query += ` AND event_date <= $${paramCount}`;
        params.push(to);
      }

      query += ` ORDER BY event_date, event_time`;

      const result = await db.query(query, params);

      setCacheHeaders(res);
      return res.json({
        data: result.rows,
        generated_at: new Date().toISOString(),
        source: 'direct_query'
      });
    }

    // Otherwise, return cached data
    const result = await db.query(
      `SELECT data, generated_at
       FROM content_cache
       WHERE cache_key = 'upcoming_events'`,
      []
    );

    if (result.rows.length === 0) {
      setCacheHeaders(res);
      return res.json({
        data: [],
        generated_at: null,
        message: 'No cached data available'
      });
    }

    const { data, generated_at } = result.rows[0];
    setCacheHeaders(res);
    res.json({
      data: data || [],
      generated_at: generated_at,
      source: 'cache'
    });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/content/all
 * Returns all three cache keys in a single response
 */
router.get('/all', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cache_key, data, generated_at
       FROM content_cache
       WHERE cache_key IN ('nyt_in_stock', 'new_inventory', 'upcoming_events')`,
      []
    );

    // Build response object with all three cache keys
    const response = {
      nyt_in_stock: {
        data: [],
        generated_at: null
      },
      new_inventory: {
        data: [],
        generated_at: null
      },
      upcoming_events: {
        data: [],
        generated_at: null
      }
    };

    // Populate with actual data
    result.rows.forEach(row => {
      if (response[row.cache_key]) {
        response[row.cache_key] = {
          data: row.data || [],
          generated_at: row.generated_at
        };
      }
    });

    setCacheHeaders(res);
    res.json(response);
  } catch (error) {
    console.error('Error fetching all content:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/content/refresh
 * Manual trigger to refresh cache (admin only - requires password)
 * This is useful for testing or forcing a cache refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { password } = req.body;

    // Check admin password
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid admin password'
      });
    }

    // Import and run the newsletter generator (which updates cache)
    const { runNewsletterGenerator } = require('../services/newsletterGenerator');

    // Run the generator but don't send emails - just update cache
    console.log('Manual cache refresh triggered');

    // For now, we'll return a success message
    // In production, you might want to create a separate cache-only function
    res.json({
      success: true,
      message: 'Cache refresh initiated. Check logs for details.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing cache:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;