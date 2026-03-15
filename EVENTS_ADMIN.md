# Events Admin Documentation

## Overview

The Events Admin system provides a web-based interface for managing events for Paper Street Thrift. It includes authentication, CRUD operations, and a public API endpoint for retrieving events.

## Files Created

1. **routes/eventsAdmin.js** - Express router with all admin routes and API endpoints
2. **views/eventsAdmin.html** - Admin interface for managing events
3. **views/eventsLogin.html** - Login page for authentication

## Setup

### Environment Variables

Add the following to your `.env` file:

```
ADMIN_PASSWORD=your_secure_admin_password_here
SESSION_SECRET=your_session_secret_key_here (optional, defaults to built-in key)
```

### Database

The events admin uses the existing `events` table created by the migration `003_create_events.sql`.

## Routes

### Public Routes

- **GET /api/events** - Public JSON endpoint for retrieving events
  - Query parameters:
    - `from` - Filter events from this date (YYYY-MM-DD)
    - `to` - Filter events to this date (YYYY-MM-DD)
  - Example: `/api/events?from=2026-03-15&to=2026-12-31`

### Admin Routes (Password Protected)

- **GET /admin/events/login** - Login page
- **POST /admin/login** - Authenticate with admin password
- **POST /admin/logout** - Logout
- **GET /admin/check-auth** - Check authentication status
- **GET /admin/events** - Admin interface (requires authentication)
- **POST /admin/events** - Create new event (requires authentication)
- **PUT /admin/events/:id** - Update event (requires authentication)
- **DELETE /admin/events/:id** - Delete event (requires authentication)

## Using the Admin Interface

### 1. Login

Navigate to `/admin/events/login` and enter the admin password (set in ADMIN_PASSWORD env variable).

### 2. Add Event

Fill out the form at the top of the admin page:

**Required fields:**
- Event Title
- Category (select from dropdown)
- Date
- Time

**Optional fields:**
- Admission (e.g., "Free", "$5", "Donation")
- Recurring Event (checkbox)
- Description
- Internal Notes

Click "Add Event" to create.

### 3. Edit Event

Click the "Edit" button on any event card. The form will populate with the event data. Make changes and click "Update Event".

### 4. Delete Event

Click the "Delete" button on any event card. Confirm the deletion in the popup dialog.

## Event Categories

The following categories are available:

**Swap Events:**
- `swap_paper` - Swap: Paper
- `swap_books` - Swap: Books
- `swap_puzzles_games` - Swap: Puzzles & Games
- `swap_art` - Swap: Art

**Thursday Events:**
- `thursday_reading` - Thursday: Reading
- `thursday_art` - Thursday: Art
- `thursday_games` - Thursday: Games
- `thursday_writing` - Thursday: Writing
- `thursday_workshop` - Thursday: Workshop

**Other:**
- `special` - Special Event

## Design System

The admin interface uses Paper Street's visual identity:

- Background: #F8F3EA
- Surface: #FDF9F3
- Teal: #5AACAA
- Rose: #E07E6A
- Butter: #EAC45A
- Sage: #84AE88
- Ink: #1B2B38
- Muted text: #7A8C96
- Border: #E2D9CC

## API Usage Example

### Fetch all upcoming events

```javascript
fetch('/api/events?from=2026-03-15')
  .then(response => response.json())
  .then(events => {
    console.log(events);
  });
```

### Response format

```json
[
  {
    "id": "uuid",
    "title": "Paper Swap",
    "event_date": "2026-03-20",
    "event_time": "14:00:00",
    "description": "Bring your unused paper goods to swap!",
    "category": "swap_paper",
    "is_recurring": false,
    "admission": "Free",
    "notes": "Setup at 1:30 PM",
    "created_at": "2026-03-15T12:00:00.000Z",
    "updated_at": "2026-03-15T12:00:00.000Z"
  }
]
```

## Security

- Sessions are stored server-side using express-session
- Admin password is compared directly (consider bcrypt for production)
- Session cookies are HTTP-only
- Session cookies are secure in production (HTTPS)
- Sessions expire after 24 hours
- Unauthorized access redirects to login page

## Notes

- The admin interface only shows upcoming events (events from today onwards)
- Events are sorted by date and time in ascending order
- The public API can retrieve all events or filter by date range
- Sessions are destroyed on logout
- Edit mode populates the form and scrolls to it for convenience
