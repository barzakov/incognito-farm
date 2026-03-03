-- Add discount_percentage column to discount table
ALTER TABLE discount
ADD COLUMN discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN discount.discount_percentage IS 'Discount percentage (0-100)';
