CREATE TABLE IF NOT EXISTS products (
  product_id BIGSERIAL PRIMARY KEY,
  images_location TEXT,
  description JSONB,
  extra JSONB,
  group_id BIGINT REFERENCES product_group(group_id),
  price NUMERIC,
  discount NUMERIC,
  availability BOOLEAN,
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
