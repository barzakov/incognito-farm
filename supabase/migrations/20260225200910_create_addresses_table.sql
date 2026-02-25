CREATE TABLE IF NOT EXISTS addresses (
  address_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  address JSONB,
  order_extra JSONB
);
