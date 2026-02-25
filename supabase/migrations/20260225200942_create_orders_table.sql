CREATE TABLE IF NOT EXISTS orders (
  order_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  product_id BIGINT,
  price NUMERIC,
  discount NUMERIC,
  short_description JSONB,
  order_status JSONB,
  order_done BOOLEAN DEFAULT FALSE,
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  order_extra JSONB,
  order_archived BOOLEAN DEFAULT FALSE,
  order_user_delete BOOLEAN DEFAULT FALSE
);
