const subscriberQueries = require('../db/queries/subscribers');

/**
 * Subscriber Service Layer
 * Business logic for subscriber management and admin operations
 */

/**
 * Get subscribers with filtering and pagination
 * @param {Object} filters - { status, source, searchTerm }
 * @param {Object} pagination - { page, limit }
 * @returns {Promise<Object>} { subscribers, pagination, stats }
 */
async function getSubscribers(filters = {}, pagination = {}) {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  // Get subscribers and total count
  const [subscribers, stats] = await Promise.all([
    subscriberQueries.getAllSubscribers(filters, offset, limit),
    subscriberQueries.getSubscriberStats()
  ]);

  // Calculate total pages
  const totalSubscribers = stats.total;
  const totalPages = Math.ceil(totalSubscribers / limit);

  return {
    subscribers,
    pagination: {
      page,
      limit,
      totalPages,
      totalSubscribers,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    stats
  };
}

/**
 * Get single subscriber with full details
 * @param {String} subscriberId - UUID of subscriber
 * @returns {Promise<Object>} Subscriber record
 */
async function getSubscriber(subscriberId) {
  const subscriber = await subscriberQueries.getSubscriberById(subscriberId);

  if (!subscriber) {
    throw new Error('Subscriber not found');
  }

  return subscriber;
}

/**
 * Get complete subscriber history
 * Compiles nudge history and other activity
 * @param {String} subscriberId - UUID of subscriber
 * @returns {Promise<Object>} History object with timeline
 */
async function getSubscriberHistory(subscriberId) {
  const [subscriber, nudgeHistory] = await Promise.all([
    subscriberQueries.getSubscriberById(subscriberId),
    subscriberQueries.getSubscriberHistory(subscriberId)
  ]);

  if (!subscriber) {
    throw new Error('Subscriber not found');
  }

  // Build complete timeline
  const timeline = [];

  // Add creation event
  timeline.push({
    type: 'created',
    date: subscriber.created_at,
    description: `Subscriber created via ${subscriber.source}`,
    metadata: {
      source: subscriber.source
    }
  });

  // Add status change events
  if (subscriber.subscribed_at) {
    timeline.push({
      type: 'subscribed',
      date: subscriber.subscribed_at,
      description: 'Subscribed to newsletter'
    });
  }

  if (subscriber.unsubscribed_at) {
    timeline.push({
      type: 'unsubscribed',
      date: subscriber.unsubscribed_at,
      description: 'Unsubscribed from newsletter'
    });
  }

  if (subscriber.dormant_at) {
    timeline.push({
      type: 'dormant',
      date: subscriber.dormant_at,
      description: 'Marked as dormant'
    });
  }

  // Add nudge events
  nudgeHistory.forEach(nudge => {
    timeline.push({
      type: 'nudge_sent',
      date: nudge.sent_at,
      description: `Nudge ${nudge.nudge_number} sent`,
      metadata: {
        nudge_number: nudge.nudge_number,
        opted_in: !!nudge.opted_in_at
      }
    });

    if (nudge.opted_in_at) {
      timeline.push({
        type: 'nudge_response',
        date: nudge.opted_in_at,
        description: `Opted in via nudge ${nudge.nudge_number}`
      });
    }
  });

  // Sort timeline by date descending (newest first)
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    subscriber,
    timeline,
    nudge_history: nudgeHistory
  };
}

/**
 * Update subscriber status with timestamp logging
 * @param {String} subscriberId - UUID of subscriber
 * @param {String} newStatus - New status value
 * @returns {Promise<Object>} Updated subscriber record
 */
async function updateSubscriberStatus(subscriberId, newStatus) {
  const validStatuses = ['pending', 'subscribed', 'unsubscribed', 'dormant', 'bounced'];

  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Verify subscriber exists
  const subscriber = await subscriberQueries.getSubscriberById(subscriberId);

  if (!subscriber) {
    throw new Error('Subscriber not found');
  }

  // Update status
  const updated = await subscriberQueries.updateSubscriberStatus(subscriberId, newStatus);

  return updated;
}

/**
 * Bulk update subscriber statuses (transaction-based)
 * @param {Array<String>} subscriberIds - Array of subscriber UUIDs
 * @param {String} newStatus - New status value
 * @returns {Promise<Object>} Result object with count
 */
async function bulkUpdateStatus(subscriberIds, newStatus) {
  const validStatuses = ['pending', 'subscribed', 'unsubscribed', 'dormant', 'bounced'];

  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`);
  }

  if (!Array.isArray(subscriberIds) || subscriberIds.length === 0) {
    throw new Error('subscriberIds must be a non-empty array');
  }

  // Perform bulk update
  const count = await subscriberQueries.bulkUpdateStatus(subscriberIds, newStatus);

  return {
    updated: count,
    status: newStatus,
    subscriberIds
  };
}

/**
 * Search subscribers by email or name
 * @param {String} query - Search query
 * @returns {Promise<Array>} Array of matching subscribers
 */
async function searchSubscribers(query) {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  const results = await subscriberQueries.searchByEmailOrName(query.trim());

  return results;
}

/**
 * Export subscribers as CSV data
 * @param {Object} filters - { status, source, searchTerm }
 * @returns {Promise<String>} CSV formatted string
 */
async function exportSubscribersCSV(filters = {}) {
  // Get all subscribers matching filters (no pagination for export)
  const subscribers = await subscriberQueries.getAllSubscribers(filters, 0, 10000);

  // Build CSV header
  const headers = [
    'Email',
    'First Name',
    'Last Name',
    'Status',
    'Source',
    'Nudge Count',
    'Subscribed At',
    'Unsubscribed At',
    'Dormant At',
    'Created At'
  ];

  // Build CSV rows
  const rows = subscribers.map(sub => {
    return [
      sub.email || '',
      sub.first_name || '',
      sub.last_name || '',
      sub.status || '',
      sub.source || '',
      sub.nudge_count || '0',
      sub.subscribed_at ? new Date(sub.subscribed_at).toISOString() : '',
      sub.unsubscribed_at ? new Date(sub.unsubscribed_at).toISOString() : '',
      sub.dormant_at ? new Date(sub.dormant_at).toISOString() : '',
      sub.created_at ? new Date(sub.created_at).toISOString() : ''
    ].map(escapeCSVValue);
  });

  // Combine header and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csv;
}

/**
 * Escape CSV values (handle commas, quotes, newlines)
 * @param {String} value - Value to escape
 * @returns {String} Escaped value
 */
function escapeCSVValue(value) {
  if (value == null) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Get subscriber statistics
 * @returns {Promise<Object>} Statistics object
 */
async function getStats() {
  const stats = await subscriberQueries.getSubscriberStats();
  return stats;
}

module.exports = {
  getSubscribers,
  getSubscriber,
  getSubscriberHistory,
  updateSubscriberStatus,
  bulkUpdateStatus,
  searchSubscribers,
  exportSubscribersCSV,
  getStats
};
