const express = require('express');
const router = express.Router();
const db = require('../db/utils/connection');

/**
 * GET /newsletter/optin?token=xxx
 * Handles opt-in confirmation for pending subscribers
 */
router.get('/optin', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).render('newsletter-error', {
      message: 'Invalid request. No token provided.'
    });
  }

  try {
    // Look up subscriber by nudge_token
    const subscriberResult = await db.query(
      'SELECT id, email, first_name, status FROM subscribers WHERE nudge_token = $1',
      [token]
    );

    if (subscriberResult.rows.length === 0) {
      return res.status(404).render('newsletter-error', {
        message: 'We couldn\'t find your subscription. Please contact us if you need assistance.'
      });
    }

    const subscriber = subscriberResult.rows[0];

    // Check if already subscribed
    if (subscriber.status === 'subscribed') {
      return res.render('newsletter-already-subscribed', {
        firstName: subscriber.first_name
      });
    }

    // Update subscriber status to subscribed if currently pending
    if (subscriber.status === 'pending') {
      const client = await db.getClient();

      try {
        await client.query('BEGIN');

        // Update subscriber status
        await client.query(
          `UPDATE subscribers
           SET status = 'subscribed', subscribed_at = NOW()
           WHERE id = $1`,
          [subscriber.id]
        );

        // Update nudge_log if there's a pending nudge entry
        await client.query(
          `UPDATE nudge_log
           SET opted_in_at = NOW()
           WHERE subscriber_id = $1 AND opted_in_at IS NULL`,
          [subscriber.id]
        );

        await client.query('COMMIT');

        return res.render('newsletter-optin-success', {
          firstName: subscriber.first_name,
          email: subscriber.email
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    // Handle other statuses (unsubscribed, dormant, bounced)
    return res.render('newsletter-error', {
      message: 'Unable to complete your subscription. Please contact us for assistance.'
    });

  } catch (error) {
    console.error('Error in opt-in route:', error);
    return res.status(500).render('newsletter-error', {
      message: 'An error occurred. Please try again later or contact us for assistance.'
    });
  }
});

/**
 * GET /newsletter/unsubscribe?token=xxx
 * Handles unsubscribe requests
 */
router.get('/unsubscribe', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).render('newsletter-error', {
      message: 'Invalid request. No token provided.'
    });
  }

  try {
    // Look up subscriber by nudge_token
    const subscriberResult = await db.query(
      'SELECT id, email, first_name FROM subscribers WHERE nudge_token = $1',
      [token]
    );

    if (subscriberResult.rows.length === 0) {
      return res.status(404).render('newsletter-error', {
        message: 'We couldn\'t find your subscription.'
      });
    }

    const subscriber = subscriberResult.rows[0];

    // Update subscriber status to unsubscribed
    await db.query(
      `UPDATE subscribers
       SET status = 'unsubscribed', unsubscribed_at = NOW()
       WHERE id = $1`,
      [subscriber.id]
    );

    return res.render('newsletter-unsubscribe-success', {
      firstName: subscriber.first_name,
      token: token
    });

  } catch (error) {
    console.error('Error in unsubscribe route:', error);
    return res.status(500).render('newsletter-error', {
      message: 'An error occurred. Please try again later.'
    });
  }
});

/**
 * POST /newsletter/unsubscribe
 * Handles one-click unsubscribe (SES compliance)
 */
router.post('/unsubscribe', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).render('newsletter-error', {
      message: 'Invalid request. No token provided.'
    });
  }

  try {
    // Look up subscriber by nudge_token
    const subscriberResult = await db.query(
      'SELECT id, email, first_name FROM subscribers WHERE nudge_token = $1',
      [token]
    );

    if (subscriberResult.rows.length === 0) {
      return res.status(404).render('newsletter-error', {
        message: 'We couldn\'t find your subscription.'
      });
    }

    const subscriber = subscriberResult.rows[0];

    // Update subscriber status to unsubscribed
    await db.query(
      `UPDATE subscribers
       SET status = 'unsubscribed', unsubscribed_at = NOW()
       WHERE id = $1`,
      [subscriber.id]
    );

    return res.render('newsletter-unsubscribe-success', {
      firstName: subscriber.first_name,
      token: token
    });

  } catch (error) {
    console.error('Error in POST unsubscribe route:', error);
    return res.status(500).render('newsletter-error', {
      message: 'An error occurred. Please try again later.'
    });
  }
});

module.exports = router;
