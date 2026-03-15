const express = require('express');
const router = express.Router();
const db = require('../db/utils/connection');
const { getJobStatus } = require('../scheduler');

// Health check endpoint
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      server: { status: 'up' },
      database: { status: 'checking' },
      scheduler: { status: 'checking' }
    },
    lastSync: {
      square: null,
      newsletter: null
    },
    errors: []
  };

  try {
    // Check database connection
    const dbResult = await db.query('SELECT NOW() as current_time');
    health.services.database.status = 'up';
    health.services.database.currentTime = dbResult.rows[0].current_time;

    // Get last Square sync time
    try {
      const squareSyncResult = await db.query(`
        SELECT MAX(created_at) as last_sync
        FROM subscribers
        WHERE source = 'square'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      health.lastSync.square = squareSyncResult.rows[0]?.last_sync || null;
    } catch (error) {
      health.errors.push({ service: 'square_sync_check', message: error.message });
    }

    // Get last newsletter send date
    try {
      const newsletterResult = await db.query(`
        SELECT send_date, sent_at, status, subscriber_count
        FROM newsletter_log
        WHERE status = 'sent'
        ORDER BY sent_at DESC
        LIMIT 1
      `);
      if (newsletterResult.rows[0]) {
        health.lastSync.newsletter = {
          date: newsletterResult.rows[0].send_date,
          sentAt: newsletterResult.rows[0].sent_at,
          subscriberCount: newsletterResult.rows[0].subscriber_count
        };
      }
    } catch (error) {
      health.errors.push({ service: 'newsletter_check', message: error.message });
    }

    // Get subscriber statistics
    try {
      const statsResult = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'subscribed') as subscribed,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed,
          COUNT(*) FILTER (WHERE status = 'dormant') as dormant,
          COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
          COUNT(*) as total
        FROM subscribers
      `);
      health.subscribers = statsResult.rows[0];
    } catch (error) {
      health.errors.push({ service: 'subscriber_stats', message: error.message });
    }

    // Get upcoming events count
    try {
      const eventsResult = await db.query(`
        SELECT COUNT(*) as count
        FROM events
        WHERE event_date >= CURRENT_DATE
        AND event_date <= CURRENT_DATE + INTERVAL '7 days'
      `);
      health.upcomingEvents = {
        nextWeek: parseInt(eventsResult.rows[0].count)
      };
    } catch (error) {
      health.errors.push({ service: 'events_check', message: error.message });
    }

    // Get content cache status
    try {
      const cacheResult = await db.query(`
        SELECT
          cache_key,
          generated_at,
          jsonb_array_length(CASE WHEN jsonb_typeof(data) = 'array' THEN data ELSE '[]'::jsonb END) as item_count
        FROM content_cache
        WHERE cache_key IN ('nyt_in_stock', 'new_inventory', 'upcoming_events')
      `);

      const mostRecentUpdate = await db.query(`
        SELECT MAX(generated_at) as last_updated
        FROM content_cache
        WHERE cache_key IN ('nyt_in_stock', 'new_inventory', 'upcoming_events')
      `);

      health.contentCache = {
        lastUpdated: mostRecentUpdate.rows[0]?.last_updated || null,
        caches: {}
      };

      cacheResult.rows.forEach(row => {
        health.contentCache.caches[row.cache_key] = {
          generatedAt: row.generated_at,
          itemCount: parseInt(row.item_count)
        };
      });

      // Add a note if cache is stale (older than 24 hours)
      if (health.contentCache.lastUpdated) {
        const lastUpdate = new Date(health.contentCache.lastUpdated);
        const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 24) {
          health.contentCache.stale = true;
          health.contentCache.hoursSinceUpdate = Math.round(hoursSinceUpdate);
        }
      }
    } catch (error) {
      health.errors.push({ service: 'content_cache_check', message: error.message });
    }

  } catch (dbError) {
    health.services.database.status = 'down';
    health.services.database.error = dbError.message;
    health.status = 'degraded';
    health.errors.push({ service: 'database', message: dbError.message });
  }

  // Get scheduler status
  try {
    const schedulerStatus = getJobStatus();
    health.services.scheduler = {
      status: 'up',
      jobs: schedulerStatus.jobs
    };
  } catch (schedulerError) {
    health.services.scheduler.status = 'down';
    health.services.scheduler.error = schedulerError.message;
    health.errors.push({ service: 'scheduler', message: schedulerError.message });
  }

  // Check required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'SQUARE_ACCESS_TOKEN',
    'NYT_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'SES_FROM_EMAIL',
    'ADMIN_PASSWORD',
    'PAPER_STREET_CATEGORIES'
  ];

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingEnvVars.length > 0) {
    health.status = 'degraded';
    health.errors.push({
      service: 'environment',
      message: `Missing environment variables: ${missingEnvVars.join(', ')}`
    });
  }

  // Set overall health status
  if (health.errors.length > 0 && health.status !== 'degraded') {
    health.status = 'degraded';
  }

  // Set appropriate HTTP status code
  const httpStatus = health.status === 'healthy' ? 200 : 503;

  res.status(httpStatus).json(health);
});

// Simple ping endpoint
router.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

module.exports = router;