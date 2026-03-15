-- Create enum type for newsletter status
CREATE TYPE newsletter_status AS ENUM ('draft', 'sent', 'failed', 'skipped');

-- Create newsletter_log table
CREATE TABLE newsletter_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    send_date DATE NOT NULL,
    status newsletter_status NOT NULL DEFAULT 'draft',
    subscriber_count INTEGER DEFAULT 0,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_newsletter_log_send_date ON newsletter_log(send_date);
CREATE INDEX idx_newsletter_log_status ON newsletter_log(status);
CREATE INDEX idx_newsletter_log_sent_at ON newsletter_log(sent_at DESC) WHERE sent_at IS NOT NULL;