CREATE TABLE IF NOT EXISTS discount (
  discount_id BIGSERIAL PRIMARY KEY,
  start_date TIMESTAMP,
  end_date TIMESTAMP
);
