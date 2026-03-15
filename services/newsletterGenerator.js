const axios = require('axios');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const db = require('../db/utils/connection');
require('dotenv').config();

// Initialize AWS SES Client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Normalize a title for matching by removing subtitles and special characters
 * Handles cases like "The Women: A Novel" vs "The Women"
 * and "James (Oprah's Book Club)" vs "James"
 */
function normalizeTitle(title) {
  // First, strip everything after colon or opening parenthesis
  let normalized = title
    .split(':')[0]  // Remove subtitle after colon
    .split('(')[0]  // Remove parenthetical content
    .toLowerCase()
    .trim();

  // Then remove remaining special characters and normalize whitespace
  normalized = normalized
    .replace(/[^\w\s]/g, '')  // Remove special chars
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();

  return normalized;
}

/**
 * Fetch NYT bestseller lists
 */
async function fetchNYTBestsellers() {
  const lists = [
    'hardcover-fiction',
    'hardcover-nonfiction',
    'paperback-trade-fiction',
    'advice-how-to-and-miscellaneous',
  ];

  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) {
    console.error('NYT_API_KEY not configured');
    return [];
  }

  const allBooks = [];

  for (const listName of lists) {
    try {
      const response = await axios.get(
        `https://api.nytimes.com/svc/books/v3/lists/current/${listName}.json`,
        { params: { 'api-key': apiKey } }
      );

      if (response.data?.results?.books) {
        response.data.results.books.forEach((book) => {
          allBooks.push({
            title: book.title,
            author: book.author,
            isbn: book.primary_isbn13 || book.primary_isbn10,
            listName: response.data.results.display_name,
            rank: book.rank,
          });
        });
      }
    } catch (error) {
      console.error(`Error fetching NYT list ${listName}:`, error.message);
    }
  }

  return allBooks;
}

/**
 * Fetch Square catalog inventory
 */
async function fetchSquareCatalog() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('SQUARE_ACCESS_TOKEN not configured');
    return [];
  }

  try {
    const response = await axios.post(
      'https://connect.squareup.com/v2/catalog/search',
      {
        object_types: ['ITEM'],
        include_related_objects: true,
      },
      {
        headers: {
          'Square-Version': '2024-01-18',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data?.objects || [];
  } catch (error) {
    console.error('Error fetching Square catalog:', error.message);
    return [];
  }
}

/**
 * Match NYT bestsellers with Square inventory
 */
function matchBestsellersWithInventory(nytBooks, squareItems) {
  const matches = [];

  for (const nytBook of nytBooks) {
    for (const item of squareItems) {
      const itemData = item.item_data;
      if (!itemData) continue;

      // Check ISBN match first (if available in Square custom attributes)
      const customAttributes = itemData.custom_attribute_values || {};
      const squareIsbn = customAttributes.isbn?.string_value;

      if (nytBook.isbn && squareIsbn && nytBook.isbn === squareIsbn) {
        matches.push({
          title: nytBook.title,
          author: nytBook.author,
          listName: nytBook.listName,
          rank: nytBook.rank,
          price: getPriceFromItem(itemData),
        });
        break;
      }

      // Fall back to normalized title matching
      const normalizedNYTTitle = normalizeTitle(nytBook.title);
      const normalizedSquareTitle = normalizeTitle(itemData.name || '');

      if (normalizedNYTTitle === normalizedSquareTitle) {
        matches.push({
          title: nytBook.title,
          author: nytBook.author,
          listName: nytBook.listName,
          rank: nytBook.rank,
          price: getPriceFromItem(itemData),
        });
        break;
      }
    }

    if (matches.length >= 6) break;
  }

  return matches;
}

/**
 * Extract price from Square item data
 */
function getPriceFromItem(itemData) {
  if (itemData.variations && itemData.variations.length > 0) {
    const variation = itemData.variations[0];
    if (variation.item_variation_data?.price_money) {
      const amount = variation.item_variation_data.price_money.amount;
      return `$${(amount / 100).toFixed(2)}`;
    }
  }
  return null;
}

/**
 * Fetch new items from Square catalog (created in last 7 days)
 */
async function fetchNewSquareItems() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('SQUARE_ACCESS_TOKEN not configured');
    return [];
  }

  const categoriesString = process.env.PAPER_STREET_CATEGORIES || '';
  const categories = categoriesString.split(',').map((c) => c.trim().toLowerCase());

  if (categories.length === 0) {
    console.error('PAPER_STREET_CATEGORIES not configured');
    return [];
  }

  try {
    const response = await axios.post(
      'https://connect.squareup.com/v2/catalog/search',
      {
        object_types: ['ITEM'],
        include_related_objects: true,
      },
      {
        headers: {
          'Square-Version': '2024-01-18',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const items = response.data?.objects || [];
    const relatedObjects = response.data?.related_objects || [];

    // Create a map of category IDs to category names
    const categoryMap = {};
    relatedObjects.forEach((obj) => {
      if (obj.type === 'CATEGORY' && obj.category_data) {
        categoryMap[obj.id] = obj.category_data.name;
      }
    });

    // Filter items created in the last 7 days and matching categories
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const newItems = items
      .filter((item) => {
        if (!item.item_data) return false;

        // Check creation date
        const createdAt = new Date(item.created_at);
        if (createdAt < sevenDaysAgo) return false;

        // Check category
        const categoryId = item.item_data.category_id;
        if (!categoryId) return false;

        const categoryName = categoryMap[categoryId];
        return categoryName && categories.includes(categoryName.toLowerCase());
      })
      .slice(0, 8)
      .map((item) => ({
        name: item.item_data.name,
        price: getPriceFromItem(item.item_data),
        description: item.item_data.description || '',
      }));

    return newItems;
  } catch (error) {
    console.error('Error fetching new Square items:', error.message);
    return [];
  }
}

/**
 * Fetch upcoming events from database
 */
async function fetchUpcomingEvents() {
  try {
    const result = await db.query(
      `SELECT
        title,
        event_date,
        event_time,
        category,
        admission,
        notes
       FROM events
       WHERE event_date >= CURRENT_DATE
         AND event_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY event_date, event_time`,
      []
    );

    return result.rows;
  } catch (error) {
    console.error('Error fetching events:', error.message);
    return [];
  }
}

/**
 * Group events by category type
 */
function groupEventsByCategory(events) {
  const groups = {
    swap: [],
    thursday: [],
    special: [],
  };

  events.forEach((event) => {
    if (event.category.startsWith('swap_')) {
      groups.swap.push(event);
    } else if (event.category.startsWith('thursday_')) {
      groups.thursday.push(event);
    } else if (event.category === 'special') {
      groups.special.push(event);
    }
  });

  return groups;
}

/**
 * Format event date and time
 */
function formatEventDateTime(date, time) {
  const dateObj = new Date(date);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const dayName = dayNames[dateObj.getDay()];
  const monthName = monthNames[dateObj.getMonth()];
  const day = dateObj.getDate();

  // Format time (assuming time is in HH:MM:SS format)
  const timeParts = time.split(':');
  let hours = parseInt(timeParts[0], 10);
  const minutes = timeParts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const formattedTime = `${hours}:${minutes} ${ampm}`;

  return {
    date: `${dayName}, ${monthName} ${day}`,
    time: formattedTime,
  };
}

/**
 * Generate HTML for NYT bestsellers section
 */
function generateNYTSection(matches) {
  if (matches.length === 0) return '';

  let html = `
    <div style="margin-bottom: 40px;">
      <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
        On the NYT list — and on our shelves
      </h2>
      <div style="display: grid; gap: 20px;">
  `;

  matches.forEach((match) => {
    html += `
      <div style="padding: 15px; background: #f8f9fa; border-left: 4px solid #3498db;">
        <div style="font-weight: bold; font-size: 18px; color: #2c3e50; margin-bottom: 5px;">
          ${match.title}
        </div>
        <div style="color: #7f8c8d; margin-bottom: 5px;">
          by ${match.author}
        </div>
        <div style="color: #95a5a6; font-size: 14px; margin-bottom: 5px;">
          ${match.listName} - #${match.rank}
        </div>
        ${match.price ? `<div style="font-weight: bold; color: #27ae60; font-size: 16px;">${match.price}</div>` : ''}
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

/**
 * Generate HTML for new items section
 */
function generateNewItemsSection(items) {
  if (items.length === 0) return '';

  let html = `
    <div style="margin-bottom: 40px;">
      <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">
        New this week
      </h2>
      <div style="display: grid; gap: 20px;">
  `;

  items.forEach((item) => {
    html += `
      <div style="padding: 15px; background: #fef5e7; border-left: 4px solid #e67e22;">
        <div style="font-weight: bold; font-size: 18px; color: #2c3e50; margin-bottom: 5px;">
          ${item.name}
        </div>
        ${item.price ? `<div style="font-weight: bold; color: #27ae60; font-size: 16px; margin-bottom: 5px;">${item.price}</div>` : ''}
        ${item.description ? `<div style="color: #7f8c8d; font-size: 14px;">${item.description}</div>` : ''}
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

/**
 * Generate HTML for events section
 */
function generateEventsSection(events) {
  if (events.length === 0) return '';

  const groups = groupEventsByCategory(events);
  let html = `
    <div style="margin-bottom: 40px;">
      <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #9b59b6; padding-bottom: 10px;">
        This week at Paper Street
      </h2>
  `;

  // Swap events
  if (groups.swap.length > 0) {
    html += '<h3 style="color: #8e44ad; font-size: 20px; margin-bottom: 15px;">Swap Events</h3>';
    groups.swap.forEach((event) => {
      const { date, time } = formatEventDateTime(event.event_date, event.event_time);
      html += `
        <div style="padding: 15px; background: #f4ecf7; border-left: 4px solid #9b59b6; margin-bottom: 15px;">
          <div style="font-weight: bold; font-size: 18px; color: #2c3e50; margin-bottom: 5px;">
            ${event.title}
          </div>
          <div style="color: #7f8c8d; font-size: 14px; margin-bottom: 3px;">
            ${date} at ${time}
          </div>
          ${event.admission ? `<div style="color: #27ae60; font-size: 14px; margin-bottom: 3px;">Admission: ${event.admission}</div>` : ''}
          ${event.notes ? `<div style="color: #7f8c8d; font-size: 14px; margin-top: 8px;">${event.notes}</div>` : ''}
        </div>
      `;
    });
  }

  // Thursday events
  if (groups.thursday.length > 0) {
    html += '<h3 style="color: #8e44ad; font-size: 20px; margin-bottom: 15px; margin-top: 20px;">Thursday Events</h3>';
    groups.thursday.forEach((event) => {
      const { date, time } = formatEventDateTime(event.event_date, event.event_time);
      html += `
        <div style="padding: 15px; background: #f4ecf7; border-left: 4px solid #9b59b6; margin-bottom: 15px;">
          <div style="font-weight: bold; font-size: 18px; color: #2c3e50; margin-bottom: 5px;">
            ${event.title}
          </div>
          <div style="color: #7f8c8d; font-size: 14px; margin-bottom: 3px;">
            ${date} at ${time}
          </div>
          ${event.admission ? `<div style="color: #27ae60; font-size: 14px; margin-bottom: 3px;">Admission: ${event.admission}</div>` : ''}
          ${event.notes ? `<div style="color: #7f8c8d; font-size: 14px; margin-top: 8px;">${event.notes}</div>` : ''}
        </div>
      `;
    });
  }

  // Special events
  if (groups.special.length > 0) {
    html += '<h3 style="color: #8e44ad; font-size: 20px; margin-bottom: 15px; margin-top: 20px;">Special Events</h3>';
    groups.special.forEach((event) => {
      const { date, time } = formatEventDateTime(event.event_date, event.event_time);
      html += `
        <div style="padding: 15px; background: #f4ecf7; border-left: 4px solid #9b59b6; margin-bottom: 15px;">
          <div style="font-weight: bold; font-size: 18px; color: #2c3e50; margin-bottom: 5px;">
            ${event.title}
          </div>
          <div style="color: #7f8c8d; font-size: 14px; margin-bottom: 3px;">
            ${date} at ${time}
          </div>
          ${event.admission ? `<div style="color: #27ae60; font-size: 14px; margin-bottom: 3px;">Admission: ${event.admission}</div>` : ''}
          ${event.notes ? `<div style="color: #7f8c8d; font-size: 14px; margin-top: 8px;">${event.notes}</div>` : ''}
        </div>
      `;
    });
  }

  html += '</div>';

  return html;
}

/**
 * Generate complete newsletter HTML
 */
function generateNewsletterHTML(nytMatches, newItems, events) {
  const nytSection = generateNYTSection(nytMatches);
  const newItemsSection = generateNewItemsSection(newItems);
  const eventsSection = generateEventsSection(events);

  const unsubscribeLink = 'https://sinclairinlet.com/unsubscribe?token={{NUDGE_TOKEN}}';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>This week at Sinclair Inlet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ecf0f1;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #3498db;">
      <h1 style="color: #2c3e50; margin: 0; font-size: 28px;">
        Sinclair Inlet Book Co.
      </h1>
      <p style="color: #7f8c8d; margin: 10px 0 0 0; font-size: 14px;">
        Your weekly update from Bremerton's bookshop
      </p>
    </div>

    <!-- Content Sections -->
    ${nytSection}
    ${newItemsSection}
    ${eventsSection}

    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ecf0f1; text-align: center; color: #95a5a6; font-size: 12px;">
      <p style="margin: 0 0 10px 0;">
        Sinclair Inlet Book Co.<br>
        Bremerton, WA
      </p>
      <p style="margin: 0;">
        <a href="${unsubscribeLink}" style="color: #3498db; text-decoration: none;">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Get newsletter subject line
 */
function getNewsletterSubject() {
  const now = new Date();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const month = monthNames[now.getMonth()];
  const day = now.getDate();

  return `This week at Sinclair Inlet · ${month} ${day}`;
}

/**
 * Fetch active subscribers
 */
async function fetchActiveSubscribers() {
  try {
    const result = await db.query(
      `SELECT email, nudge_token FROM subscribers WHERE status = 'subscribed'`,
      []
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching subscribers:', error.message);
    return [];
  }
}

/**
 * Send email via AWS SES
 */
async function sendEmail(toEmail, subject, htmlBody, nudgeToken) {
  // Replace the nudge token placeholder
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
    return true;
  } catch (error) {
    console.error(`Error sending email to ${toEmail}:`, error.message);
    return false;
  }
}

/**
 * Log newsletter to database
 */
async function logNewsletter(status, subject, htmlBody, subscriberCount) {
  try {
    await db.query(
      `INSERT INTO newsletter_log (send_date, status, subscriber_count, subject, html_body, sent_at)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, $5)`,
      [status, subscriberCount, subject, htmlBody, status === 'sent' ? new Date() : null]
    );
  } catch (error) {
    console.error('Error logging newsletter:', error.message);
  }
}

/**
 * Write content to cache for website consumption
 */
async function writeToContentCache(cacheKey, data) {
  try {
    await db.query(
      `INSERT INTO content_cache (cache_key, data, generated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (cache_key) DO UPDATE
         SET data = EXCLUDED.data,
             generated_at = EXCLUDED.generated_at`,
      [cacheKey, JSON.stringify(data)]
    );
    console.log(`✓ Cached ${cacheKey} with ${Array.isArray(data) ? data.length : 0} items`);
  } catch (error) {
    console.error(`Error writing to cache for ${cacheKey}:`, error.message);
  }
}

/**
 * Main newsletter generator function
 */
async function runNewsletterGenerator() {
  console.log('Starting newsletter generation...');

  try {
    // Fetch all data
    console.log('Fetching NYT bestsellers...');
    const nytBooks = await fetchNYTBestsellers();

    console.log('Fetching Square catalog...');
    const squareCatalog = await fetchSquareCatalog();

    console.log('Matching NYT bestsellers with inventory...');
    const nytMatches = matchBestsellersWithInventory(nytBooks, squareCatalog);

    console.log('Fetching new Square items...');
    const newItems = await fetchNewSquareItems();

    console.log('Fetching upcoming events...');
    const events = await fetchUpcomingEvents();

    // Write all content to cache (even if empty) for website consumption
    console.log('Writing content to cache for website...');

    // Cache NYT books in stock
    const nytCacheData = nytMatches.map(match => ({
      title: match.title,
      author: match.author,
      nyt_list: match.listName,
      nyt_rank: match.rank,
      price: match.price,
      isbn: nytBooks.find(b => b.title === match.title)?.isbn || null
    }));
    await writeToContentCache('nyt_in_stock', nytCacheData);

    // Cache new inventory
    const inventoryCacheData = newItems.map((item, index) => ({
      name: item.name,
      category: 'General', // Will be enhanced when Square provides category data
      price: item.price,
      description: item.description,
      square_item_id: `item_${index}` // Placeholder until we have actual Square IDs
    }));
    await writeToContentCache('new_inventory', inventoryCacheData);

    // Cache upcoming events
    const eventsCacheData = events.map(event => ({
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time,
      category: event.category,
      admission: event.admission,
      notes: event.notes
    }));
    await writeToContentCache('upcoming_events', eventsCacheData);

    // Check if we have any content
    const hasContent = nytMatches.length > 0 || newItems.length > 0 || events.length > 0;

    if (!hasContent) {
      console.log('No content available for newsletter. Skipping send.');
      await logNewsletter('skipped', getNewsletterSubject(), '', 0);
      return {
        success: true,
        skipped: true,
        message: 'Newsletter skipped - no content available',
      };
    }

    // Generate newsletter HTML
    console.log('Generating newsletter HTML...');
    const htmlBody = generateNewsletterHTML(nytMatches, newItems, events);
    const subject = getNewsletterSubject();

    // Fetch subscribers
    console.log('Fetching active subscribers...');
    const subscribers = await fetchActiveSubscribers();

    if (subscribers.length === 0) {
      console.log('No active subscribers. Skipping send.');
      await logNewsletter('skipped', subject, htmlBody, 0);
      return {
        success: true,
        skipped: true,
        message: 'Newsletter skipped - no active subscribers',
      };
    }

    // Send emails
    console.log(`Sending newsletter to ${subscribers.length} subscribers...`);
    let successCount = 0;
    let failCount = 0;

    for (const subscriber of subscribers) {
      const sent = await sendEmail(subscriber.email, subject, htmlBody, subscriber.nudge_token);
      if (sent) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // Log the newsletter
    const status = failCount === 0 ? 'sent' : failCount === subscribers.length ? 'failed' : 'sent';
    await logNewsletter(status, subject, htmlBody, successCount);

    console.log(`Newsletter sent successfully to ${successCount}/${subscribers.length} subscribers`);

    return {
      success: true,
      sent: successCount,
      failed: failCount,
      total: subscribers.length,
      message: `Newsletter sent to ${successCount} subscribers`,
    };
  } catch (error) {
    console.error('Error running newsletter generator:', error);
    await logNewsletter('failed', getNewsletterSubject(), '', 0);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Support preview mode when run directly
if (require.main === module) {
  const fs = require('fs');
  const args = process.argv.slice(2);
  const isPreview = args.includes('--preview');

  if (isPreview) {
    console.log('🔍 Running newsletter generator in PREVIEW mode...');
    console.log('📧 No emails will be sent.\n');

    // Run preview
    (async () => {
      try {
        // Fetch all data
        console.log('Fetching NYT bestsellers...');
        const nytBooks = await fetchNYTBestsellers();
        console.log(`✓ Found ${nytBooks.length} NYT bestseller entries`);

        console.log('Fetching Square catalog...');
        const squareCatalog = await fetchSquareCatalog();
        console.log(`✓ Found ${squareCatalog.length} Square catalog items`);

        console.log('Matching NYT bestsellers with inventory...');
        const nytMatches = matchBestsellersWithInventory(nytBooks, squareCatalog);
        console.log(`✓ Matched ${nytMatches.length} NYT books in stock`);

        console.log('Fetching new Square items...');
        const newItems = await fetchNewSquareItems();
        console.log(`✓ Found ${newItems.length} new inventory items`);

        console.log('Fetching upcoming events...');
        const events = await fetchUpcomingEvents();
        console.log(`✓ Found ${events.length} upcoming events\n`);

        // Generate HTML
        const htmlBody = generateNewsletterHTML(nytMatches, newItems, events);

        // Write preview file
        fs.writeFileSync('newsletter_preview.html', htmlBody);
        console.log('📄 Preview written to newsletter_preview.html');

        // Print summary
        console.log('\n=== CONTENT SUMMARY ===');
        console.log(`NYT Books in Stock: ${nytMatches.length}`);
        if (nytMatches.length > 0) {
          nytMatches.slice(0, 3).forEach(book => {
            console.log(`  - "${book.title}" by ${book.author}`);
          });
          if (nytMatches.length > 3) console.log(`  ... and ${nytMatches.length - 3} more`);
        }

        console.log(`\nNew Inventory: ${newItems.length}`);
        if (newItems.length > 0) {
          newItems.slice(0, 3).forEach(item => {
            console.log(`  - ${item.name} (${item.price || 'No price'})`);
          });
          if (newItems.length > 3) console.log(`  ... and ${newItems.length - 3} more`);
        }

        console.log(`\nUpcoming Events: ${events.length}`);
        if (events.length > 0) {
          events.slice(0, 3).forEach(event => {
            console.log(`  - ${event.title} on ${event.event_date}`);
          });
          if (events.length > 3) console.log(`  ... and ${events.length - 3} more`);
        }

        if (nytMatches.length === 0 && newItems.length === 0 && events.length === 0) {
          console.log('\n⚠️ Newsletter would be SKIPPED - no content available');
        } else {
          console.log('\n✅ Newsletter would be SENT with content');
        }

        process.exit(0);
      } catch (error) {
        console.error('Preview failed:', error.message);
        process.exit(1);
      }
    })();
  } else {
    console.log('Usage: node newsletterGenerator.js --preview');
    console.log('This will generate a preview without sending emails.');
    process.exit(0);
  }
}

module.exports = {
  runNewsletterGenerator,
};
