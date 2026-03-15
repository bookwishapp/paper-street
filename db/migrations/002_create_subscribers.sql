-- Create enum types for subscribers
CREATE TYPE subscriber_source AS ENUM ('square', 'website', 'manual');
CREATE TYPE subscriber_status AS ENUM ('pending', 'subscribed', 'unsubscribed', 'dormant', 'bounced');

-- Create subscribers table
CREATE TABLE subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    source subscriber_source NOT NULL,
    status subscriber_status NOT NULL DEFAULT 'pending',
    nudge_count INTEGER DEFAULT 0 CHECK (nudge_count >= 0 AND nudge_count <= 3),
    nudge_token UUID UNIQUE DEFAULT uuid_generate_v4(),
    subscribed_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    dormant_at TIMESTAMPTZ,
    square_customer_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_subscribers_status ON subscribers(status);
CREATE INDEX idx_subscribers_source ON subscribers(source);
CREATE INDEX idx_subscribers_email ON subscribers(email);
CREATE INDEX idx_subscribers_square_customer_id ON subscribers(square_customer_id) WHERE square_customer_id IS NOT NULL;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscribers_updated_at BEFORE UPDATE ON subscribers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();