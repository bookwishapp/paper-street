const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const db = require('../db/utils/connection');
require('dotenv').config();

// Configure AWS SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Email configuration
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'hello@sinclairinlet.com';
const FROM_NAME = 'Sinclair Inlet Book Co.';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://sinclairinlet.com';

// Nudge email configurations
const NUDGE_CONFIGS = {
  1: {
    subject: 'A weekly note from Sinclair Inlet',
    getBody: (firstName, optInUrl, unsubscribeUrl) => `
Hi${firstName ? ` ${firstName}` : ''},

You recently signed up to receive our weekly note, but we haven't heard back from you yet. We wanted to make sure you're still interested.

Each week, we share a brief update about new arrivals, book recommendations, and what's happening at Sinclair Inlet Book Co. It's our way of staying connected with readers who care about independent bookstores.

If you'd like to receive our weekly note, just click here to confirm:
${optInUrl}

If you'd rather not hear from us, no problem—you can unsubscribe here:
${unsubscribeUrl}

Thanks for considering us,
The team at Sinclair Inlet Book Co.
    `.trim(),
  },
  2: {
    subject: 'Still want to hear from us?',
    getBody: (firstName, optInUrl, unsubscribeUrl) => `
Hi${firstName ? ` ${firstName}` : ''},

We're still holding a spot for you on our weekly note list, but we haven't heard back yet.

If you'd like to receive our weekly updates about new books, recommendations, and bookstore news, please confirm here:
${optInUrl}

If you're not interested, that's completely fine—just let us know:
${unsubscribeUrl}

Best,
Sinclair Inlet Book Co.
    `.trim(),
  },
  3: {
    subject: 'Last chance — our weekly note',
    getBody: (firstName, optInUrl, unsubscribeUrl) => `
Hi${firstName ? ` ${firstName}` : ''},

This is our final note to check if you'd like to receive our weekly updates.

If you'd still like to hear from us, please confirm now:
${optInUrl}

Otherwise, we'll remove you from our list. No hard feelings—you can always resubscribe later if you change your mind.

Or, if you prefer, you can unsubscribe here:
${unsubscribeUrl}

All the best,
Sinclair Inlet Book Co.
    `.trim(),
  },
};

/**
 * Send a nudge email via AWS SES
 */
async function sendNudgeEmail(email, firstName, nudgeNumber, nudgeToken) {
  const config = NUDGE_CONFIGS[nudgeNumber];
  if (!config) {
    throw new Error(`Invalid nudge number: ${nudgeNumber}`);
  }

  const optInUrl = `${WEBSITE_URL}/newsletter/optin?token=${nudgeToken}`;
  const unsubscribeUrl = `${WEBSITE_URL}/newsletter/unsubscribe?token=${nudgeToken}`;

  const params = {
    Source: `${FROM_NAME} <${FROM_EMAIL}>`,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: config.subject,
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: config.getBody(firstName, optInUrl, unsubscribeUrl),
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log(`Nudge ${nudgeNumber} sent to ${email}:`, response.MessageId);
    return response;
  } catch (error) {
    console.error(`Error sending nudge ${nudgeNumber} to ${email}:`, error);
    throw error;
  }
}

/**
 * Process a single subscriber for nudge emails
 */
async function processSubscriber(subscriber) {
  const { id, email, first_name, nudge_count, nudge_token } = subscriber;
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    if (nudge_count >= 0 && nudge_count <= 2) {
      const nudgeNumber = nudge_count + 1;

      // Send the nudge email
      await sendNudgeEmail(email, first_name, nudgeNumber, nudge_token);

      // Update subscriber: increment nudge_count
      await client.query(
        `UPDATE subscribers
         SET nudge_count = nudge_count + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      // Log to nudge_log
      await client.query(
        `INSERT INTO nudge_log (subscriber_id, nudge_number, sent_at)
         VALUES ($1, $2, NOW())`,
        [id, nudgeNumber]
      );

      console.log(`Processed nudge ${nudgeNumber} for subscriber ${email}`);
    } else if (nudge_count === 3) {
      // Set status to dormant
      await client.query(
        `UPDATE subscribers
         SET status = 'dormant',
             dormant_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      console.log(`Set subscriber ${email} to dormant status`);
    } else {
      console.warn(`Unexpected nudge_count ${nudge_count} for subscriber ${email}`);
    }

    await client.query('COMMIT');
    return { success: true, email };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error processing subscriber ${email}:`, error);
    return { success: false, email, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Run the nudge mailer process
 * Queries all pending subscribers and processes them
 */
async function runNudgeMailer() {
  console.log('Starting nudge mailer process...');
  const startTime = Date.now();

  try {
    // Query all pending subscribers
    const result = await db.query(
      `SELECT id, email, first_name, last_name, nudge_count, nudge_token
       FROM subscribers
       WHERE status = $1
       ORDER BY created_at ASC`,
      ['pending']
    );

    const subscribers = result.rows;
    console.log(`Found ${subscribers.length} pending subscribers`);

    if (subscribers.length === 0) {
      console.log('No pending subscribers to process');
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    // Process each subscriber
    const results = [];
    for (const subscriber of subscribers) {
      const result = await processSubscriber(subscriber);
      results.push(result);

      // Add a small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Nudge mailer completed in ${duration}s`);
    console.log(`Total: ${subscribers.length}, Successful: ${successful}, Failed: ${failed}`);

    return {
      total: subscribers.length,
      successful,
      failed,
      results,
      duration,
    };
  } catch (error) {
    console.error('Error in nudge mailer process:', error);
    throw error;
  }
}

module.exports = {
  runNudgeMailer,
  sendNudgeEmail, // Exported for testing purposes
};
