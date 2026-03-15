# Sinclair Inlet Book Co. Newsletter System

## ✅ System Complete

A comprehensive newsletter and content management system for Sinclair Inlet Book Co. / Paper Street Thrift has been successfully implemented.

## 🎯 What Was Built

### Phase 0 - Database Infrastructure (COMPLETED)
- ✅ PostgreSQL database schema with 5 tables:
  - `subscribers` - Customer email list management
  - `events` - Store events calendar
  - `newsletter_log` - Newsletter send history
  - `nudge_log` - Engagement email tracking
  - `content_cache` - Website content caching
- ✅ Migration system at `db/migrate.js`
- ✅ All migrations created in `db/migrations/`

### Agent A - Square Sync Service (COMPLETED)
- ✅ `services/squareSync.js` - Syncs Square customers to subscriber list
- Scheduled: Sundays 11 PM PT
- Imports customers with emails, respects unsubscribe preferences

### Agent B - Nudge Email Service (COMPLETED)
- ✅ `services/nudgeMailer.js` - Sends opt-in nudge emails
- ✅ `services/emailTemplate.js` - Beautiful HTML email templates
- Scheduled: Mondays 9 AM PT
- 3 nudges before marking dormant

### Agent C - Newsletter Generator (COMPLETED + ENHANCED)
- ✅ `services/newsletterGenerator.js` - Generates and sends weekly newsletter
- Scheduled: Tuesdays 9 AM PT
- **NEW**: Writes content to cache for website consumption
- Sections:
  - NYT bestsellers in stock
  - New Paper Street inventory
  - Upcoming events

### Agent D - Events Admin (COMPLETED)
- ✅ `routes/eventsAdmin.js` - Password-protected admin interface
- ✅ `views/eventsAdmin.html` - Beautiful admin dashboard
- ✅ `views/eventsLogin.html` - Login page
- Full CRUD for events management
- Public API endpoint at `/api/events`

### Agent E - Newsletter Endpoints (COMPLETED)
- ✅ `routes/newsletter.js` - Opt-in/unsubscribe handling
- ✅ Beautiful EJS templates in `views/`
- SES one-click unsubscribe compliant

### Additional Features (COMPLETED)
- ✅ `routes/contentApi.js` - Public API for website content
  - `/api/content/nyt-in-stock`
  - `/api/content/new-inventory`
  - `/api/content/upcoming-events`
  - `/api/content/all`
- ✅ `routes/health.js` - Comprehensive health check endpoint
- ✅ `scheduler.js` - Centralized cron job management
- ✅ Content caching for website integration

## 📦 Dependencies Installed

```json
{
  "dependencies": {
    "pg": "^latest",
    "dotenv": "^latest",
    "uuid": "^latest",
    "node-cron": "^latest",
    "nodemailer": "^latest",
    "@aws-sdk/client-ses": "^latest",
    "axios": "^latest",
    "juice": "^latest",
    "bcryptjs": "^latest",
    "express-session": "^latest",
    "ejs": "^latest"
  }
}
```

## 🚀 Deployment Steps

### 1. Set Environment Variables on Railway

Add these to your Railway project environment:

```bash
# Database (Railway provides automatically)
DATABASE_URL=<auto-provided>

# Square API
SQUARE_ACCESS_TOKEN=<your-square-token>

# NYT Books API
NYT_API_KEY=<your-nyt-api-key>

# AWS SES Configuration
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
AWS_REGION=us-east-1
SES_FROM_EMAIL=hello@sinclairinlet.com

# Admin
ADMIN_PASSWORD=<secure-password>

# Paper Street Categories (customize as needed)
PAPER_STREET_CATEGORIES=Games,Puzzles,Art Supplies,Stationery,Paper Goods

# Environment
NODE_ENV=production
```

### 2. Run Database Migrations

After deploying to Railway, run migrations:

```bash
node db/migrate.js
```

Or add to your start script in package.json:
```json
"scripts": {
  "start": "node db/migrate.js && node server.js"
}
```

### 3. Verify Deployment

Check these endpoints:
- `/health` - System health check
- `/admin/events/login` - Events admin (use ADMIN_PASSWORD)
- `/api/content/all` - Content API (should return empty arrays initially)
- `/newsletter/optin?token=test` - Should show error (invalid token)

## 🧪 Testing

### Manual Testing Commands

```bash
# Test database connection
node -e "require('./db/utils/connection').query('SELECT NOW()').then(console.log)"

# Test Square sync (dry run)
node -e "require('./services/squareSync').runSquareSync().then(console.log)"

# Test nudge mailer (be careful - this sends real emails!)
node -e "require('./services/nudgeMailer').runNudgeMailer().then(console.log)"

# Test newsletter generator (be careful - this sends real emails!)
node -e "require('./services/newsletterGenerator').runNewsletterGenerator().then(console.log)"
```

### Preview Newsletter HTML

To preview newsletter HTML without sending:
1. Temporarily comment out the email sending loop in `newsletterGenerator.js`
2. Add `require('fs').writeFileSync('preview.html', htmlBody);`
3. Run the generator
4. Open `preview.html` in browser

## 📅 Cron Schedule

All times in Pacific Time:
- **Sunday 11 PM**: Square customer sync
- **Monday 9 AM**: Nudge emails to pending subscribers
- **Tuesday 9 AM**: Weekly newsletter generation and send

## 🔍 Monitoring

### Health Check
```bash
curl https://your-app.railway.app/health
```

Returns:
- Server status
- Database connection
- Last Square sync
- Last newsletter send
- Subscriber statistics
- Content cache status
- Scheduler status

### Logs
Monitor Railway logs for:
- `[Square Sync]` - Customer import activity
- `[Nudge Mailer]` - Engagement email sends
- `[Newsletter]` - Weekly newsletter generation
- Error messages

## 🌐 Website Integration

The Sinclair Inlet and Paper Street websites can fetch content from:

```javascript
// Fetch all content
fetch('https://your-app.railway.app/api/content/all')
  .then(res => res.json())
  .then(data => {
    // data.nyt_in_stock.data - Array of books
    // data.new_inventory.data - Array of new items
    // data.upcoming_events.data - Array of events
  });

// Or fetch individually
fetch('https://your-app.railway.app/api/content/nyt-in-stock')
fetch('https://your-app.railway.app/api/content/new-inventory')
fetch('https://your-app.railway.app/api/content/upcoming-events')
```

## 🔒 Security Notes

1. **Admin Password**: Change default password immediately
2. **API Keys**: Keep all API keys secure in Railway environment
3. **Database**: Railway handles SSL/TLS automatically
4. **Session Secret**: Uses ADMIN_PASSWORD as secret (consider separate secret in production)
5. **Content API**: Intentionally public (no auth required)

## 📝 Common Tasks

### Add a Subscriber Manually
```sql
INSERT INTO subscribers (email, first_name, last_name, source, status)
VALUES ('email@example.com', 'First', 'Last', 'manual', 'subscribed');
```

### Check Newsletter Queue
```sql
SELECT status, COUNT(*) FROM subscribers GROUP BY status;
```

### View Recent Newsletters
```sql
SELECT * FROM newsletter_log ORDER BY sent_at DESC LIMIT 5;
```

### Force Content Cache Refresh
```bash
curl -X POST https://your-app.railway.app/api/content/refresh \
  -H "Content-Type: application/json" \
  -d '{"password":"your-admin-password"}'
```

## 🆘 Troubleshooting

### Emails Not Sending
1. Check AWS SES is in production mode (not sandbox)
2. Verify sender email is verified in SES
3. Check `/health` endpoint for missing environment variables

### Square Sync Not Working
1. Verify SQUARE_ACCESS_TOKEN is valid
2. Check Square API version compatibility (currently using 2024-01-18)
3. Review logs for specific error messages

### Newsletter Content Empty
1. Check NYT_API_KEY is valid
2. Verify Square catalog has items
3. Ensure events are created for the upcoming week

### Content Cache Stale
1. Check if newsletter generator ran successfully
2. Manually refresh: POST to `/api/content/refresh`
3. Check database connectivity

## 🎉 Success!

Your newsletter system is complete and ready for deployment. The system will:
- Automatically sync Square customers weekly
- Send engagement emails to new subscribers
- Generate and send beautiful newsletters every Tuesday
- Provide content APIs for your websites
- Give you full control over events and subscriber management

For questions or issues, check the logs and health endpoint first. All components are designed to fail gracefully and log errors comprehensively.