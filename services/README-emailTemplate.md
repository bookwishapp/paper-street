# Email Template Service

Reusable HTML email template system for Paper Street Thrift newsletters and automated nudge emails.

## Features

- Responsive HTML email templates with inline CSS (email-safe)
- Automated nudge sequence (4 progressive emails)
- Custom newsletter generation with flexible sections
- Both HTML and plain text versions
- Brand design tokens built-in
- Automatic unsubscribe link handling

## Design

- **Colors**: Warm cream background (#F8F3EA), teal/rose/butter/sage accents
- **Typography**: Georgia serif for headlines, Arial/Helvetica for body
- **Layout**: 600px max-width, centered, sections separated by dashed rules
- **Accessibility**: Proper semantic HTML, preheader text for preview

## Usage

### Nudge Emails

Automated engagement emails sent to inactive subscribers:

```javascript
const { generateNudgeEmail } = require('./services/emailTemplate');

const subscriber = {
  email: 'customer@example.com',
  name: 'Jane Doe' // optional
};

// Generate nudge #1 (welcome)
const email = generateNudgeEmail(subscriber, 1);

// Returns:
// {
//   subject: 'Welcome to Paper Street Thrift',
//   html: '<html>...</html>',
//   text: 'Plain text version...'
// }
```

**Nudge Sequence:**
1. Welcome email - introduces the newsletter and store
2. "Have you visited?" - encourages in-person visit
3. "Still interested?" - checks if subscriber wants to stay on list
4. "Last call" - final nudge before potential removal

### Newsletter Emails

Custom newsletters with flexible content sections:

```javascript
const { generateNewsletterEmail } = require('./services/emailTemplate');

const subscriber = {
  email: 'customer@example.com',
  name: 'Jane Doe'
};

const sections = [
  {
    eyebrow: 'New Arrivals',
    eyebrowColor: 'teal', // teal, rose, butter, or sage
    heading: 'Fresh Vintage Finds',
    body: '<p>Check out our latest collection...</p>',
    cta: {
      text: 'Visit the Store',
      url: 'https://sinclairinlet.com'
    }
  },
  {
    eyebrow: 'Event',
    eyebrowColor: 'rose',
    heading: 'Spring Sale This Weekend',
    body: '<p>Join us for special discounts...</p>'
    // cta is optional
  }
];

const email = generateNewsletterEmail(subscriber, sections, {
  subject: 'Spring Newsletter from Paper Street Thrift',
  preheader: 'New arrivals and upcoming events'
});
```

**Section Properties:**
- `eyebrow` (optional): Small label above heading
- `eyebrowColor` (optional): teal, rose, butter, or sage (auto-cycles if omitted)
- `heading` (optional): Section title
- `body`: Main content (HTML allowed: `<p>`, `<strong>`, `<em>`, `<br>`)
- `cta` (optional): Call-to-action button with `text` and `url`

## Design Tokens

Available as exports if needed for other services:

```javascript
const { COLORS, FONTS } = require('./services/emailTemplate');

console.log(COLORS.teal); // #5AACAA
console.log(FONTS.headline); // Georgia, serif
```

## Testing

View sample emails by opening the generated HTML files in a browser:
- `sample-nudge-email.html` - Example nudge #1
- `sample-newsletter-email.html` - Example multi-section newsletter

## Dependencies

- `juice` - Inlines CSS for email client compatibility
- Built-in Node.js modules only

## Notes

- Unsubscribe URLs are automatically generated: `https://sinclairinlet.com/unsubscribe?email=...`
- All CSS is inlined using the juice library for maximum email client compatibility
- Plain text versions are automatically generated from HTML
- Greeting personalizes with subscriber name if available
- Email is responsive and tested for common email clients
