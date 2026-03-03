-- Add images JSONB column to products table
-- This stores an array of image objects with: { "path": "...", "active": true/false }
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
