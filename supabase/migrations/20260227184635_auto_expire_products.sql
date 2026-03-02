-- Function to mark expired products as unavailable based on extra->expire
CREATE OR REPLACE FUNCTION update_expired_products()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET availability = false
  WHERE extra->>'expire' IS NOT NULL 
    AND (extra->>'expire')::DATE < CURRENT_DATE
    AND availability = true;
END;
$$;

-- Trigger function to check expiry on insert/update
CREATE OR REPLACE FUNCTION check_product_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.extra->>'expire' IS NOT NULL 
     AND (NEW.extra->>'expire')::DATE < CURRENT_DATE THEN
    NEW.availability = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_check_product_expiry
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION check_product_expiry();

-- Enable pg_cron and schedule daily check at midnight
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'update-expired-products',
  '0 0 * * *',
  'SELECT update_expired_products();'
);
