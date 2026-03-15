const db = require('../utils/connection');

/**
 * Get all subscribers with optional filtering and pagination
 * @param {Object} filters - Filter criteria { status: 'subscribed' }
 * @param {number} offset - Number of records to skip
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<Array>} Array of subscriber records
 */
async function getAllSubscribers(filters = {}, offset = 0, limit = 100) {
  try {
    let query = `
      SELECT
        id,
        email,
        first_name,
        last_name,
        source,
        status,
        nudge_count,
        subscribed_at,
        unsubscribed_at,
        dormant_at,
        square_customer_id,
        created_at,
        updated_at
      FROM subscribers
    `;

    const params = [];
    const conditions = [];

    // Apply status filter if provided
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    // Apply source filter if provided
    if (filters.source) {
      params.push(filters.source);
      conditions.push(`source = $${params.length}`);
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ordering and pagination
    query += ` ORDER BY created_at DESC`;

    params.push(limit);
    query += ` LIMIT $${params.length}`;

    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting subscribers:', error);
    throw error;
  }
}

/**
 * Get a single subscriber by ID
 * @param {string} id - Subscriber UUID
 * @returns {Promise<Object|null>} Subscriber record or null if not found
 */
async function getSubscriberById(id) {
  try {
    const query = `
      SELECT
        id,
        email,
        first_name,
        last_name,
        source,
        status,
        nudge_count,
        nudge_token,
        subscribed_at,
        unsubscribed_at,
        dormant_at,
        square_customer_id,
        created_at,
        updated_at
      FROM subscribers
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting subscriber by ID:', error);
    throw error;
  }
}

/**
 * Get subscriber activity history with nudge log entries
 * @param {string} id - Subscriber UUID
 * @returns {Promise<Array>} Array of activity records
 */
async function getSubscriberHistory(id) {
  try {
    const query = `
      SELECT
        nl.id,
        nl.nudge_number,
        nl.sent_at,
        nl.opted_in_at,
        'nudge' as activity_type
      FROM nudge_log nl
      WHERE nl.subscriber_id = $1
      ORDER BY nl.sent_at DESC
    `;

    const result = await db.query(query, [id]);
    return result.rows;
  } catch (error) {
    console.error('Error getting subscriber history:', error);
    throw error;
  }
}

/**
 * Update subscriber status with appropriate timestamp
 * @param {string} id - Subscriber UUID
 * @param {string} status - New status ('pending', 'subscribed', 'unsubscribed', 'dormant', 'bounced')
 * @returns {Promise<Object|null>} Updated subscriber record or null if not found
 */
async function updateSubscriberStatus(id, status) {
  try {
    // Build the update query with conditional timestamp updates
    let timestampColumn = null;

    switch (status) {
      case 'subscribed':
        timestampColumn = 'subscribed_at';
        break;
      case 'unsubscribed':
        timestampColumn = 'unsubscribed_at';
        break;
      case 'dormant':
        timestampColumn = 'dormant_at';
        break;
    }

    let query = `
      UPDATE subscribers
      SET
        status = $1,
        ${timestampColumn ? `${timestampColumn} = NOW(),` : ''}
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [status, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating subscriber status:', error);
    throw error;
  }
}

/**
 * Bulk update status for multiple subscribers in a transaction
 * @param {Array<string>} ids - Array of subscriber UUIDs
 * @param {string} status - New status to apply
 * @returns {Promise<number>} Number of records updated
 */
async function bulkUpdateStatus(ids, status) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Determine timestamp column based on status
    let timestampColumn = null;

    switch (status) {
      case 'subscribed':
        timestampColumn = 'subscribed_at';
        break;
      case 'unsubscribed':
        timestampColumn = 'unsubscribed_at';
        break;
      case 'dormant':
        timestampColumn = 'dormant_at';
        break;
    }

    const query = `
      UPDATE subscribers
      SET
        status = $1,
        ${timestampColumn ? `${timestampColumn} = NOW(),` : ''}
        updated_at = NOW()
      WHERE id = ANY($2::uuid[])
    `;

    const result = await client.query(query, [status, ids]);

    await client.query('COMMIT');
    return result.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error bulk updating subscriber status:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Search subscribers by email or name
 * @param {string} query - Search query string
 * @returns {Promise<Array>} Array of matching subscriber records
 */
async function searchByEmailOrName(searchQuery) {
  try {
    const query = `
      SELECT
        id,
        email,
        first_name,
        last_name,
        source,
        status,
        nudge_count,
        subscribed_at,
        created_at
      FROM subscribers
      WHERE
        email ILIKE $1
        OR first_name ILIKE $1
        OR last_name ILIKE $1
        OR CONCAT(first_name, ' ', last_name) ILIKE $1
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const searchPattern = `%${searchQuery}%`;
    const result = await db.query(query, [searchPattern]);
    return result.rows;
  } catch (error) {
    console.error('Error searching subscribers:', error);
    throw error;
  }
}

/**
 * Get subscriber statistics by status
 * @returns {Promise<Object>} Object with counts by status
 */
async function getSubscriberStats() {
  try {
    const query = `
      SELECT
        status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE source = 'square') as square_count,
        COUNT(*) FILTER (WHERE source = 'website') as website_count,
        COUNT(*) FILTER (WHERE source = 'manual') as manual_count
      FROM subscribers
      GROUP BY status
    `;

    const result = await db.query(query);

    // Transform results into a more usable object
    const stats = {
      total: 0,
      by_status: {},
      by_source: {
        square: 0,
        website: 0,
        manual: 0
      }
    };

    result.rows.forEach(row => {
      stats.total += parseInt(row.count);
      stats.by_status[row.status] = parseInt(row.count);
      stats.by_source.square += parseInt(row.square_count);
      stats.by_source.website += parseInt(row.website_count);
      stats.by_source.manual += parseInt(row.manual_count);
    });

    return stats;
  } catch (error) {
    console.error('Error getting subscriber stats:', error);
    throw error;
  }
}

module.exports = {
  getAllSubscribers,
  getSubscriberById,
  getSubscriberHistory,
  updateSubscriberStatus,
  bulkUpdateStatus,
  searchByEmailOrName,
  getSubscriberStats
};
