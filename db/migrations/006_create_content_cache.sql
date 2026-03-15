-- Create content_cache table for website content
CREATE TABLE content_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(50) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_content_cache_key ON content_cache(cache_key);
CREATE INDEX idx_content_cache_generated_at ON content_cache(generated_at DESC);

-- Insert initial empty cache entries
INSERT INTO content_cache (cache_key, data, generated_at) VALUES
    ('nyt_in_stock', '[]'::jsonb, NOW()),
    ('new_inventory', '[]'::jsonb, NOW()),
    ('upcoming_events', '[]'::jsonb, NOW())
ON CONFLICT (cache_key) DO NOTHING;