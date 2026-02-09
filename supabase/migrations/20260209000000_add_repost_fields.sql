-- Add repost support to posts table

ALTER TABLE posts 
ADD COLUMN original_post_id UUID REFERENCES posts(id),
ADD COLUMN post_type TEXT DEFAULT 'original';

-- Index for performance
CREATE INDEX idx_posts_original_post_id ON posts(original_post_id);

-- Add comment on columns
COMMENT ON COLUMN posts.original_post_id IS 'Reference to the original post if this is a repost';
COMMENT ON COLUMN posts.post_type IS 'Type of post: original or repost';
