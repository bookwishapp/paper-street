-- Create enum type for event categories
CREATE TYPE event_category AS ENUM (
    'swap_paper',
    'swap_books',
    'swap_puzzles_games',
    'swap_art',
    'thursday_reading',
    'thursday_art',
    'thursday_games',
    'thursday_writing',
    'thursday_workshop',
    'special'
);

-- Create events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    description TEXT,
    category event_category NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    admission VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_category ON events(category);
-- Note: Removed partial index with CURRENT_DATE as it's not immutable
-- Applications should filter by date in queries instead

-- Add trigger for updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();