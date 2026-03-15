const db = require('../utils/connection');

/**
 * Get newsletter log with pagination
 * @param {number} offset - Number of records to skip
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<Array>} Array of newsletter log records
 */
async function getNewsletterLog(offset = 0, limit = 50) {
  try {
    const query = `
      SELECT
        id,
        send_date,
        status,
        subscriber_count,
        subject,
        sent_at,
        created_at
      FROM newsletter_log
      ORDER BY send_date DESC, created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error getting newsletter log:', error);
    throw error;
  }
}

/**
 * Get a single newsletter by ID
 * @param {string} id - Newsletter UUID
 * @returns {Promise<Object|null>} Newsletter record or null if not found
 */
async function getNewsletterById(id) {
  try {
    const query = `
      SELECT
        id,
        send_date,
        status,
        subscriber_count,
        subject,
        html_body,
        sent_at,
        created_at
      FROM newsletter_log
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting newsletter by ID:', error);
    throw error;
  }
}

/**
 * Get aggregate newsletter statistics
 * @returns {Promise<Object>} Statistics object
 */
async function getNewsletterStats() {
  try {
    const query = `
      SELECT
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE status = 'skipped') as skipped_count,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        SUM(subscriber_count) FILTER (WHERE status = 'sent') as total_emails_sent,
        AVG(subscriber_count) FILTER (WHERE status = 'sent') as avg_subscriber_count,
        MAX(sent_at) as last_sent_at,
        MIN(sent_at) FILTER (WHERE status = 'sent') as first_sent_at
      FROM newsletter_log
    `;

    const result = await db.query(query);
    const stats = result.rows[0];

    // Convert numeric strings to numbers
    return {
      total_sent: parseInt(stats.total_sent) || 0,
      sent_count: parseInt(stats.sent_count) || 0,
      failed_count: parseInt(stats.failed_count) || 0,
      skipped_count: parseInt(stats.skipped_count) || 0,
      draft_count: parseInt(stats.draft_count) || 0,
      total_emails_sent: parseInt(stats.total_emails_sent) || 0,
      avg_subscriber_count: parseFloat(stats.avg_subscriber_count) || 0,
      last_sent_at: stats.last_sent_at,
      first_sent_at: stats.first_sent_at
    };
  } catch (error) {
    console.error('Error getting newsletter stats:', error);
    throw error;
  }
}

/**
 * Create a new newsletter log entry
 * @param {Object} data - Newsletter data
 * @param {Date|string} data.send_date - Date the newsletter was/will be sent
 * @param {string} data.subject - Newsletter subject line
 * @param {string} data.html_body - HTML content of the newsletter
 * @param {number} data.subscriber_count - Number of subscribers
 * @param {string} data.status - Newsletter status (default: 'draft')
 * @returns {Promise<Object>} Created newsletter record
 */
async function createNewsletterEntry(data) {
  try {
    const {
      send_date,
      subject,
      html_body = null,
      subscriber_count = 0,
      status = 'draft'
    } = data;

    // Validate required fields
    if (!send_date || !subject) {
      throw new Error('send_date and subject are required');
    }

    const query = `
      INSERT INTO newsletter_log (
        send_date,
        subject,
        html_body,
        subscriber_count,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const params = [send_date, subject, html_body, subscriber_count, status];
    const result = await db.query(query, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating newsletter entry:', error);
    throw error;
  }
}

/**
 * Update newsletter status and sent_at timestamp
 * @param {string} id - Newsletter UUID
 * @param {string} status - New status ('draft', 'sent', 'failed', 'skipped')
 * @param {Date|string|null} sentAt - Timestamp when newsletter was sent (optional)
 * @returns {Promise<Object|null>} Updated newsletter record or null if not found
 */
async function updateNewsletterStatus(id, status, sentAt = null) {
  try {
    let query;
    let params;

    if (sentAt !== null) {
      query = `
        UPDATE newsletter_log
        SET
          status = $1,
          sent_at = $2
        WHERE id = $3
        RETURNING *
      `;
      params = [status, sentAt, id];
    } else {
      // If status is 'sent' and no sentAt provided, use NOW()
      if (status === 'sent') {
        query = `
          UPDATE newsletter_log
          SET
            status = $1,
            sent_at = NOW()
          WHERE id = $2
          RETURNING *
        `;
        params = [status, id];
      } else {
        query = `
          UPDATE newsletter_log
          SET status = $1
          WHERE id = $2
          RETURNING *
        `;
        params = [status, id];
      }
    }

    const result = await db.query(query, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating newsletter status:', error);
    throw error;
  }
}

/**
 * Update newsletter subscriber count
 * @param {string} id - Newsletter UUID
 * @param {number} count - New subscriber count
 * @returns {Promise<Object|null>} Updated newsletter record or null if not found
 */
async function updateSubscriberCount(id, count) {
  try {
    const query = `
      UPDATE newsletter_log
      SET subscriber_count = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [count, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating subscriber count:', error);
    throw error;
  }
}

/**
 * Get recent newsletters (last N entries)
 * @param {number} limit - Number of recent newsletters to retrieve
 * @returns {Promise<Array>} Array of recent newsletter records
 */
async function getRecentNewsletters(limit = 10) {
  try {
    const query = `
      SELECT
        id,
        send_date,
        status,
        subscriber_count,
        subject,
        sent_at,
        created_at
      FROM newsletter_log
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting recent newsletters:', error);
    throw error;
  }
}

/**
 * Get newsletters by date range
 * @param {Date|string} startDate - Start date (inclusive)
 * @param {Date|string} endDate - End date (inclusive)
 * @returns {Promise<Array>} Array of newsletter records in date range
 */
async function getNewslettersByDateRange(startDate, endDate) {
  try {
    const query = `
      SELECT
        id,
        send_date,
        status,
        subscriber_count,
        subject,
        sent_at,
        created_at
      FROM newsletter_log
      WHERE send_date >= $1 AND send_date <= $2
      ORDER BY send_date DESC
    `;

    const result = await db.query(query, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('Error getting newsletters by date range:', error);
    throw error;
  }
}

module.exports = {
  getNewsletterLog,
  getNewsletterById,
  getNewsletterStats,
  createNewsletterEntry,
  updateNewsletterStatus,
  updateSubscriberCount,
  getRecentNewsletters,
  getNewslettersByDateRange
};
