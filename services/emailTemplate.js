const juice = require('juice');

// Design tokens
const COLORS = {
  background: '#F8F3EA',
  surface: '#FDF9F3',
  teal: '#5AACAA',
  rose: '#E07E6A',
  butter: '#EAC45A',
  sage: '#84AE88',
  ink: '#1B2B38',
  muted: '#7A8C96',
  rule: '#E2D9CC'
};

const FONTS = {
  headline: 'Georgia, serif',
  body: 'Arial, Helvetica, sans-serif'
};

/**
 * Base HTML email template
 * @param {string} content - The main content HTML
 * @param {string} preheader - Preview text shown in email clients
 * @returns {string} Complete HTML email
 */
function createBaseTemplate(content, preheader = '') {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Paper Street Thrift</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${COLORS.background};
      font-family: ${FONTS.body};
      color: ${COLORS.ink};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${COLORS.surface};
    }
    .header {
      padding: 40px 30px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-family: ${FONTS.headline};
      font-size: 32px;
      color: ${COLORS.ink};
      font-weight: normal;
    }
    .header p {
      margin: 8px 0 0;
      font-size: 14px;
      color: ${COLORS.muted};
    }
    .content {
      padding: 0 30px;
    }
    .section {
      padding: 30px 0;
      border-top: 2px dashed ${COLORS.rule};
    }
    .section:first-child {
      border-top: none;
    }
    .eyebrow {
      display: block;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .eyebrow-teal {
      color: ${COLORS.teal};
    }
    .eyebrow-rose {
      color: ${COLORS.rose};
    }
    .eyebrow-butter {
      color: ${COLORS.butter};
    }
    .eyebrow-sage {
      color: ${COLORS.sage};
    }
    .section h2 {
      margin: 0 0 16px;
      font-family: ${FONTS.headline};
      font-size: 24px;
      color: ${COLORS.ink};
      font-weight: normal;
    }
    .section p {
      margin: 0 0 16px;
      font-size: 16px;
      line-height: 1.6;
      color: ${COLORS.ink};
    }
    .section p:last-child {
      margin-bottom: 0;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      margin-top: 8px;
      background-color: ${COLORS.teal};
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      font-size: 16px;
    }
    .footer {
      padding: 30px;
      border-top: 2px dashed ${COLORS.rule};
      text-align: center;
      font-size: 13px;
      color: ${COLORS.muted};
      line-height: 1.6;
    }
    .footer a {
      color: ${COLORS.teal};
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    .preheader {
      display: none;
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      font-size: 1px;
      line-height: 1px;
      color: ${COLORS.surface};
    }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <div class="email-container">
          <div class="header">
            <h1>Paper Street Thrift</h1>
            <p>Sinclair Inlet Edition</p>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>
              <strong>Paper Street Thrift</strong><br>
              821 Bay Street, Port Orchard, WA 98366<br>
              <a href="https://sinclairinlet.com">sinclairinlet.com</a>
            </p>
            <p>
              <a href="{{unsubscribe_url}}">Unsubscribe</a> from these emails
            </p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  // Inline CSS using juice
  return juice(html);
}

/**
 * Nudge content by number
 */
const NUDGE_CONTENT = {
  1: {
    eyebrow: 'First Nudge',
    color: 'teal',
    subject: 'Welcome to Paper Street Thrift',
    preheader: 'Thanks for signing up! Here\'s what to expect.',
    heading: 'Welcome to the Sinclair Inlet Edition',
    body: `
      <p>Thanks for subscribing! We're thrilled to have you as part of our community of thrift enthusiasts and treasure hunters.</p>
      <p>We'll be sending you occasional newsletters featuring new arrivals, special events, and the stories behind some of our most interesting finds. No spam, no daily deals—just thoughtful updates when we have something worth sharing.</p>
      <p>Our store is located at 821 Bay Street in Port Orchard, and we're open Tuesday through Saturday. Stop by soon to explore our ever-changing collection of vintage clothing, home goods, books, and curiosities.</p>
      <p>Happy thrifting!</p>
    `
  },
  2: {
    eyebrow: 'Second Nudge',
    color: 'rose',
    subject: 'Have you visited us yet?',
    preheader: 'We\'d love to see you at the store!',
    heading: 'We\'d Love to See You',
    body: `
      <p>It's been a little while since you signed up for our newsletter, and we wanted to check in. Have you had a chance to visit us at the store yet?</p>
      <p>If not, we'd love to welcome you in person! Our collection changes constantly as we receive new donations and discover new treasures. Whether you're looking for vintage fashion, unique home decor, or just enjoy the thrill of the hunt, there's always something new to explore.</p>
      <p>We're open Tuesday through Saturday at 821 Bay Street in Port Orchard. Stop by and say hello—we're always happy to help you find exactly what you're looking for (or help you discover something you didn't know you needed).</p>
    `
  },
  3: {
    eyebrow: 'Third Nudge',
    color: 'butter',
    subject: 'Still interested in thrifting?',
    preheader: 'Let us know if you\'d like to keep hearing from us.',
    heading: 'Are We Still a Good Match?',
    body: `
      <p>We haven't seen you on our email list in a while, and we understand—inboxes can get crowded, and interests change. We just wanted to make sure you still want to hear from us.</p>
      <p>If you're still interested in vintage finds, sustainable shopping, and the occasional story from our shop floor, we'd love to keep you on our list. But if not, no hard feelings! You can unsubscribe using the link at the bottom of this email.</p>
      <p>Either way, our door at 821 Bay Street is always open if you'd like to stop by for a browse. We'll be here, hunting for treasures and saving them for people who appreciate them.</p>
    `
  },
  4: {
    eyebrow: 'Final Nudge',
    color: 'sage',
    subject: 'One last hello from Paper Street',
    preheader: 'We\'re cleaning up our list—let us know if you want to stay.',
    heading: 'Last Call',
    body: `
      <p>This is our final nudge. We haven't heard from you in quite some time, and we want to respect your inbox and only send emails to people who genuinely want them.</p>
      <p>If you'd still like to receive occasional updates from Paper Street Thrift—new arrivals, special events, and stories from the shop—you don't need to do anything. We'll keep you on our list.</p>
      <p>But if you'd prefer to unsubscribe, now's a good time. Just click the link at the bottom of this email.</p>
      <p>Thanks for being part of our community, even if just for a little while. If you ever find yourself in Port Orchard, we're at 821 Bay Street, and we'd love to see you.</p>
    `
  }
};

/**
 * Generate a nudge email
 * @param {Object} subscriber - Subscriber object with email, name, etc.
 * @param {number} nudgeNumber - Which nudge (1-4)
 * @returns {Object} Email object with subject, html, and text
 */
function generateNudgeEmail(subscriber, nudgeNumber) {
  const nudge = NUDGE_CONTENT[nudgeNumber];

  if (!nudge) {
    throw new Error(`Invalid nudge number: ${nudgeNumber}. Must be 1-4.`);
  }

  const greeting = subscriber.name ? `Hi ${subscriber.name},` : 'Hello,';

  const content = `
    <div class="section">
      <span class="eyebrow eyebrow-${nudge.color}">${nudge.eyebrow}</span>
      <h2>${nudge.heading}</h2>
      <p>${greeting}</p>
      ${nudge.body}
    </div>
  `;

  const html = createBaseTemplate(content, nudge.preheader);

  // Replace unsubscribe URL placeholder
  const finalHtml = html.replace(
    '{{unsubscribe_url}}',
    `https://sinclairinlet.com/unsubscribe?email=${encodeURIComponent(subscriber.email)}`
  );

  return {
    subject: nudge.subject,
    html: finalHtml,
    text: generatePlainText(nudge.heading, nudge.body, subscriber)
  };
}

/**
 * Generate a newsletter email
 * @param {Object} subscriber - Subscriber object with email, name, etc.
 * @param {Array} sections - Array of section objects {eyebrow, eyebrowColor, heading, body, cta}
 * @param {Object} options - Newsletter options {subject, preheader}
 * @returns {Object} Email object with subject, html, and text
 */
function generateNewsletterEmail(subscriber, sections, options = {}) {
  const { subject = 'Newsletter from Paper Street Thrift', preheader = '' } = options;

  const greeting = subscriber.name ? `Hi ${subscriber.name},` : 'Hello,';

  const sectionsHtml = sections.map((section, index) => {
    const eyebrowColor = section.eyebrowColor || getColorForIndex(index);
    const ctaHtml = section.cta ? `
      <p><a href="${section.cta.url}" class="button">${section.cta.text}</a></p>
    ` : '';

    return `
      <div class="section">
        ${section.eyebrow ? `<span class="eyebrow eyebrow-${eyebrowColor}">${section.eyebrow}</span>` : ''}
        ${section.heading ? `<h2>${section.heading}</h2>` : ''}
        ${index === 0 ? `<p>${greeting}</p>` : ''}
        ${section.body}
        ${ctaHtml}
      </div>
    `;
  }).join('');

  const html = createBaseTemplate(sectionsHtml, preheader);

  // Replace unsubscribe URL placeholder
  const finalHtml = html.replace(
    '{{unsubscribe_url}}',
    `https://sinclairinlet.com/unsubscribe?email=${encodeURIComponent(subscriber.email)}`
  );

  return {
    subject,
    html: finalHtml,
    text: generatePlainTextNewsletter(sections, subscriber)
  };
}

/**
 * Get color for section index (cycles through colors)
 */
function getColorForIndex(index) {
  const colors = ['teal', 'rose', 'butter', 'sage'];
  return colors[index % colors.length];
}

/**
 * Generate plain text version of nudge email
 */
function generatePlainText(heading, bodyHtml, subscriber) {
  const greeting = subscriber.name ? `Hi ${subscriber.name},` : 'Hello,';

  // Strip HTML tags and decode entities
  const plainBody = bodyHtml
    .replace(/<p>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return `
${heading}

${greeting}

${plainBody}

---

Paper Street Thrift
821 Bay Street, Port Orchard, WA 98366
sinclairinlet.com

Unsubscribe: https://sinclairinlet.com/unsubscribe?email=${encodeURIComponent(subscriber.email)}
  `.trim();
}

/**
 * Generate plain text version of newsletter
 */
function generatePlainTextNewsletter(sections, subscriber) {
  const greeting = subscriber.name ? `Hi ${subscriber.name},` : 'Hello,';

  const sectionsText = sections.map((section, index) => {
    const eyebrow = section.eyebrow ? `[${section.eyebrow.toUpperCase()}]\n` : '';
    const heading = section.heading ? `${section.heading}\n` : '';
    const greetingText = index === 0 ? `${greeting}\n\n` : '';

    const plainBody = section.body
      .replace(/<p>/g, '\n')
      .replace(/<\/p>/g, '\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    const cta = section.cta ? `\n\n${section.cta.text}: ${section.cta.url}` : '';

    return `${eyebrow}${heading}${greetingText}${plainBody}${cta}`;
  }).join('\n\n---\n\n');

  return `
${sectionsText}

---

Paper Street Thrift
821 Bay Street, Port Orchard, WA 98366
sinclairinlet.com

Unsubscribe: https://sinclairinlet.com/unsubscribe?email=${encodeURIComponent(subscriber.email)}
  `.trim();
}

module.exports = {
  generateNudgeEmail,
  generateNewsletterEmail,
  COLORS,
  FONTS
};
