CREATE TABLE IF NOT EXISTS users (
  user_id BIGSERIAL PRIMARY KEY,
  name TEXT,
  second_name TEXT,
  lastname TEXT,
  supa_user_uuid UUID,
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_on TIMESTAMP,
  boss BOOLEAN DEFAULT FALSE
);
