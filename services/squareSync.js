const axios = require('axios');
const db = require('../db/utils/connection');
require('dotenv').config();

/**
 * Square Sync Service
 * Syncs customer data from Square to the newsletter subscribers table
 * Scheduled to run at 11 PM PT on Sundays via cron
 */

const SQUARE_API_URL = 'https://connect.squareup.com/v2';
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;

/**
 * Fetch all customers from Square who have email addresses
 * @returns {Promise<Array>} Array of customer objects with email, first_name, last_name, and id
 */
async function fetchSquareCustomers() {
  const customers = [];
  let cursor = null;

  try {
    do {
      const params = {
        limit: 100 // Square API max is 100 per request
      };

      if (cursor) {
        params.cursor = cursor;
      }

      const response = await axios.get(`${SQUARE_API_URL}/customers`, {
        headers: {
          'Square-Version': '2024-12-18',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        params
      });

      if (response.data.customers) {
        // Filter customers who have email addresses
        const customersWithEmail = response.data.customers
          .filter(customer => customer.email_address)
          .map(customer => ({
            square_customer_id: customer.id,
            email: customer.email_address.toLowerCase().trim(),
            first_name: customer.given_name || null,
            last_name: customer.family_name || null
          }));

        customers.push(...customersWithEmail);
      }

      cursor = response.data.cursor || null;
    } while (cursor);

    return customers;
  } catch (error) {
    console.error('Error fetching Square customers:', error.response?.data || error.message);
    throw new Error(`Failed to fetch Square customers: ${error.message}`);
  }
}

/**
 * Check if a subscriber exists by square_customer_id and get their current status
 * @param {string} squareCustomerId - The Square customer ID
 * @returns {Promise<Object|null>} Subscriber object or null if not found
 */
async function getSubscriberBySquareId(squareCustomerId) {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, status, square_customer_id FROM subscribers WHERE square_customer_id = $1',
      [squareCustomerId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error querying subscriber:', error.message);
    throw error;
  }
}

/**
 * Insert a new subscriber from Square
 * @param {Object} customer - Customer data from Square
 * @returns {Promise<Object>} Inserted subscriber
 */
async function insertSubscriber(customer) {
  try {
    const result = await db.query(
      `INSERT INTO subscribers (email, first_name, last_name, source, status, nudge_count, square_customer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, first_name, last_name, status, square_customer_id`,
      [
        customer.email,
        customer.first_name,
        customer.last_name,
        'square',
        'pending',
        0,
        customer.square_customer_id
      ]
    );
    return result.rows[0];
  } catch (error) {
    // Handle duplicate email (unique constraint violation)
    if (error.code === '23505') {
      console.warn(`Duplicate email detected: ${customer.email}`);
      return null;
    }
    console.error('Error inserting subscriber:', error.message);
    throw error;
  }
}

/**
 * Update an existing subscriber's name if it has changed
 * @param {string} subscriberId - The subscriber's database ID
 * @param {Object} customer - Customer data from Square
 * @returns {Promise<Object>} Updated subscriber
 */
async function updateSubscriberName(subscriberId, customer) {
  try {
    const result = await db.query(
      `UPDATE subscribers
       SET first_name = $1, last_name = $2
       WHERE id = $3
       RETURNING id, email, first_name, last_name, status, square_customer_id`,
      [customer.first_name, customer.last_name, subscriberId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating subscriber:', error.message);
    throw error;
  }
}

/**
 * Main sync function - syncs Square customers to subscribers table
 * @returns {Promise<Object>} Summary of sync results
 */
async function runSquareSync() {
  console.log('Starting Square customer sync...');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const summary = {
    total_customers: 0,
    new_added: 0,
    updated: 0,
    skipped_unsubscribed: 0,
    skipped_dormant: 0,
    skipped_bounced: 0,
    already_current: 0,
    errors: 0
  };

  try {
    // Validate environment variable
    if (!SQUARE_ACCESS_TOKEN) {
      throw new Error('SQUARE_ACCESS_TOKEN environment variable is not set');
    }

    // Fetch all customers from Square
    console.log('Fetching customers from Square API...');
    const customers = await fetchSquareCustomers();
    summary.total_customers = customers.length;
    console.log(`Found ${customers.length} Square customers with email addresses`);

    // Process each customer
    for (const customer of customers) {
      try {
        // Check if subscriber already exists
        const existingSubscriber = await getSubscriberBySquareId(customer.square_customer_id);

        if (!existingSubscriber) {
          // New customer - insert as pending
          const inserted = await insertSubscriber(customer);
          if (inserted) {
            summary.new_added++;
            console.log(`Added new subscriber: ${customer.email}`);
          } else {
            // Email already exists with different square_customer_id
            summary.errors++;
          }
        } else {
          // Existing customer - check status
          const status = existingSubscriber.status;

          if (status === 'unsubscribed') {
            summary.skipped_unsubscribed++;
          } else if (status === 'dormant') {
            summary.skipped_dormant++;
          } else if (status === 'bounced') {
            summary.skipped_bounced++;
          } else if (status === 'subscribed' || status === 'pending') {
            // Check if name needs updating
            const nameChanged =
              existingSubscriber.first_name !== customer.first_name ||
              existingSubscriber.last_name !== customer.last_name;

            if (nameChanged) {
              await updateSubscriberName(existingSubscriber.id, customer);
              summary.updated++;
              console.log(`Updated name for: ${customer.email}`);
            } else {
              summary.already_current++;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing customer ${customer.email}:`, error.message);
        summary.errors++;
      }
    }

    // Log summary
    console.log('\n=== Square Sync Summary ===');
    console.log(`Total customers processed: ${summary.total_customers}`);
    console.log(`New subscribers added: ${summary.new_added}`);
    console.log(`Existing subscribers updated: ${summary.updated}`);
    console.log(`Skipped (unsubscribed): ${summary.skipped_unsubscribed}`);
    console.log(`Skipped (dormant): ${summary.skipped_dormant}`);
    console.log(`Skipped (bounced): ${summary.skipped_bounced}`);
    console.log(`Already current: ${summary.already_current}`);
    console.log(`Errors: ${summary.errors}`);
    console.log('===========================\n');

    return summary;
  } catch (error) {
    console.error('Fatal error during Square sync:', error.message);
    throw error;
  }
}

module.exports = {
  runSquareSync
};
