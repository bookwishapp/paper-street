-- Create nudge_log table
CREATE TABLE nudge_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    nudge_number INTEGER NOT NULL CHECK (nudge_number >= 1 AND nudge_number <= 3),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    opted_in_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_nudge_log_subscriber_id ON nudge_log(subscriber_id);
CREATE INDEX idx_nudge_log_sent_at ON nudge_log(sent_at);
CREATE INDEX idx_nudge_log_opted_in ON nudge_log(opted_in_at) WHERE opted_in_at IS NOT NULL;

-- Ensure unique nudge numbers per subscriber
CREATE UNIQUE INDEX idx_nudge_log_unique_nudge ON nudge_log(subscriber_id, nudge_number);