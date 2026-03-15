const db = require('../db/utils/connection');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// Initialize AWS SES Client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Get newsletter history with pagination
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @returns {Object} - { newsletters, total, page, totalPages }
 */
async function getNewsletterHistory(page = 1, limit = 20) {
  try {
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM newsletter_log',
      []
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated newsletters
    const result = await db.query(
      `SELECT id, send_date, status, subscriber_count, subject, sent_at, created_at
       FROM newsletter_log
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      newsletters: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('Error fetching newsletter history:', error);
    throw error;
  }
}

/**
 * Get a single newsletter by ID
 * @param {string} id - Newsletter ID
 * @returns {Object|null} - Newsletter or null if not found
 */
async function getNewsletterById(id) {
  try {
    const result = await db.query(
      `SELECT * FROM newsletter_log WHERE id = $1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error fetching newsletter by ID:', error);
    throw error;
  }
}

/**
 * Get newsletter statistics
 * @returns {Object} - Statistics object
 */
async function getNewsletterStats() {
  try {
    const [totalResult, sentResult, subscriberResult, lastSentResult] = await Promise.all([
      // Total newsletters
      db.query(`SELECT COUNT(*) as count FROM newsletter_log`, []),

      // Successfully sent newsletters
      db.query(`SELECT COUNT(*) as count FROM newsletter_log WHERE status = 'sent'`, []),

      // Current subscriber count
      db.query(`SELECT COUNT(*) as count FROM subscribers WHERE status = 'subscribed'`, []),

      // Last sent newsletter
      db.query(
        `SELECT send_date, subscriber_count FROM newsletter_log
         WHERE status = 'sent'
         ORDER BY sent_at DESC
         LIMIT 1`,
        []
      ),
    ]);

    return {
      totalNewsletters: parseInt(totalResult.rows[0].count, 10),
      sentNewsletters: parseInt(sentResult.rows[0].count, 10),
      currentSubscribers: parseInt(subscriberResult.rows[0].count, 10),
      lastSent: lastSentResult.rows.length > 0 ? lastSentResult.rows[0] : null,
    };
  } catch (error) {
    console.error('Error fetching newsletter stats:', error);
    throw error;
  }
}

/**
 * Check if a newsletter was already sent today
 * @returns {boolean} - True if already sent today
 */
async function wasNewsletterSentToday() {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM newsletter_log
       WHERE send_date = CURRENT_DATE AND status = 'sent'`,
      []
    );

    return parseInt(result.rows[0].count, 10) > 0;
  } catch (error) {
    console.error('Error checking if newsletter was sent today:', error);
    throw error;
  }
}

/**
 * Send email via AWS SES
 * @param {string} toEmail - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML email body
 * @param {string} nudgeToken - Personalization token
 * @returns {boolean} - True if sent successfully
 */
async function sendEmail(toEmail, subject, htmlBody, nudgeToken = 'default') {
  const personalizedHtml = htmlBody.replace(/{{NUDGE_TOKEN}}/g, nudgeToken);

  const params = {
    Source: process.env.SES_FROM_EMAIL || 'hello@sinclairinlet.com',
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: personalizedHtml,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    await sesClient.send(command);
    console.log(`Successfully sent email to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${toEmail}:`, error.message);
    console.error('Full error:', error);
    return false;
  }
}

/**
 * Send test newsletter to a single email address
 * @param {string} recipientEmail - Test recipient email
 * @param {Object} previewData - Newsletter preview data
 * @returns {Object} - Result object
 */
async function sendTestNewsletter(recipientEmail, previewData) {
  try {
    console.log('sendTestNewsletter called with:', { recipientEmail, hasPreviewData: !!previewData });

    if (!recipientEmail || !recipientEmail.includes('@')) {
      throw new Error('Invalid email address');
    }

    const { subject, htmlBody } = previewData;
    console.log('Preview data extracted:', { hasSubject: !!subject, htmlBodyLength: htmlBody?.length });

    if (!subject || !htmlBody) {
      throw new Error('Missing newsletter content');
    }

    // Send test email (no token needed for test)
    const sent = await sendEmail(recipientEmail, `[TEST] ${subject}`, htmlBody, 'test-token');

    if (!sent) {
      throw new Error('Failed to send test email');
    }

    return {
      success: true,
      message: `Test newsletter sent to ${recipientEmail}`,
    };
  } catch (error) {
    console.error('Error sending test newsletter:', error);
    throw error;
  }
}

/**
 * Send newsletter manually (with safety checks)
 * @param {boolean} force - Force send even if already sent today
 * @param {Object} newsletterData - Newsletter data to send
 * @returns {Object} - Result object
 */
async function sendManualNewsletter(force = false, newsletterData) {
  try {
    // Safety check: don't send twice in one day unless forced
    if (!force) {
      const alreadySent = await wasNewsletterSentToday();
      if (alreadySent) {
        return {
          success: false,
          blocked: true,
          message: 'Newsletter already sent today. Use force=true to override.',
        };
      }
    }

    const { subject, htmlBody } = newsletterData;

    if (!subject || !htmlBody) {
      throw new Error('Missing newsletter content');
    }

    // Get active subscribers
    const subscriberResult = await db.query(
      `SELECT email, nudge_token FROM subscribers WHERE status = 'subscribed'`,
      []
    );

    const subscribers = subscriberResult.rows;

    if (subscribers.length === 0) {
      return {
        success: false,
        message: 'No active subscribers to send to',
      };
    }

    // Send to all subscribers
    let successCount = 0;
    let failCount = 0;

    for (const subscriber of subscribers) {
      const sent = await sendEmail(subscriber.email, subject, htmlBody, subscriber.nudge_token);
      if (sent) {
        successCount++;
      } else {
        failCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Log the newsletter
    const status = failCount === 0 ? 'sent' : failCount === subscribers.length ? 'failed' : 'sent';
    await db.query(
      `INSERT INTO newsletter_log (send_date, status, subscriber_count, subject, html_body, sent_at)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, NOW())`,
      [status, successCount, subject, htmlBody]
    );

    return {
      success: true,
      sent: successCount,
      failed: failCount,
      total: subscribers.length,
      message: `Newsletter sent to ${successCount}/${subscribers.length} subscribers`,
    };
  } catch (error) {
    console.error('Error sending manual newsletter:', error);
    throw error;
  }
}

/**
 * Create and send custom newsletter
 * @param {string} subject - Custom subject line
 * @param {string} htmlBody - Custom HTML body
 * @param {Array<string>} recipients - Array of recipient emails (optional, defaults to all subscribers)
 * @returns {Object} - Result object
 */
async function createCustomNewsletter(subject, htmlBody, recipients = null) {
  try {
    if (!subject || !htmlBody) {
      throw new Error('Subject and HTML body are required');
    }

    let targetEmails = [];

    if (recipients && recipients.length > 0) {
      // Custom recipient list
      targetEmails = recipients.map(email => ({
        email,
        nudge_token: 'custom-send',
      }));
    } else {
      // All active subscribers
      const subscriberResult = await db.query(
        `SELECT email, nudge_token FROM subscribers WHERE status = 'subscribed'`,
        []
      );
      targetEmails = subscriberResult.rows;
    }

    if (targetEmails.length === 0) {
      return {
        success: false,
        message: 'No recipients to send to',
      };
    }

    // Send to all targets
    let successCount = 0;
    let failCount = 0;

    for (const target of targetEmails) {
      const sent = await sendEmail(target.email, subject, htmlBody, target.nudge_token);
      if (sent) {
        successCount++;
      } else {
        failCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Log the custom newsletter
    const status = failCount === 0 ? 'sent' : failCount === targetEmails.length ? 'failed' : 'sent';
    await db.query(
      `INSERT INTO newsletter_log (send_date, status, subscriber_count, subject, html_body, sent_at)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, NOW())`,
      [status, successCount, `[CUSTOM] ${subject}`, htmlBody]
    );

    return {
      success: true,
      sent: successCount,
      failed: failCount,
      total: targetEmails.length,
      message: `Custom newsletter sent to ${successCount}/${targetEmails.length} recipients`,
    };
  } catch (error) {
    console.error('Error creating custom newsletter:', error);
    throw error;
  }
}

module.exports = {
  getNewsletterHistory,
  getNewsletterById,
  getNewsletterStats,
  wasNewsletterSentToday,
  sendTestNewsletter,
  sendManualNewsletter,
  createCustomNewsletter,
};
