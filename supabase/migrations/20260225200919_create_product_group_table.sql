CREATE TABLE IF NOT EXISTS product_group (
  group_id BIGSERIAL PRIMARY KEY,
  name TEXT,
  group_discount BIGINT REFERENCES discount(discount_id)
);
