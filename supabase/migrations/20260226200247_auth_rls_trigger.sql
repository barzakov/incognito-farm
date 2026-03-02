-- =============================================================
-- 1. Trigger: auto-create users row when a new auth user signs up
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (name, second_name, lastname, supa_user_uuid, boss)
  VALUES (
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'second_name',
    new.raw_user_meta_data ->> 'lastname',
    new.id,
    FALSE
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================
-- 2. Helper: check if the current auth user is a boss
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_boss()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE supa_user_uuid = auth.uid()
      AND boss = TRUE
      AND deleted_on IS NULL
  );
$$;

-- =============================================================
-- 3. Enable RLS on all tables
-- =============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_group ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 4. RLS policies for USERS
-- =============================================================

-- Users can read their own row
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (supa_user_uuid = auth.uid());

-- Boss can read all users
CREATE POLICY "users_select_boss" ON users
  FOR SELECT USING (public.is_boss());

-- Users can update their own row (but not boss field)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (supa_user_uuid = auth.uid())
  WITH CHECK (supa_user_uuid = auth.uid());

-- Boss can update any user
CREATE POLICY "users_update_boss" ON users
  FOR UPDATE USING (public.is_boss());

-- Boss can soft-delete (update deleted_on) - covered by update policies
-- No direct DELETE policy (soft delete only)

-- =============================================================
-- 5. RLS policies for ADDRESSES
-- =============================================================

-- Users can CRUD their own addresses
CREATE POLICY "addresses_select_own" ON addresses
  FOR SELECT USING (
    user_id IN (SELECT user_id FROM public.users WHERE supa_user_uuid = auth.uid())
  );

CREATE POLICY "addresses_insert_own" ON addresses
  FOR INSERT WITH CHECK (
    user_id IN (SELECT user_id FROM public.users WHERE supa_user_uuid = auth.uid())
  );

CREATE POLICY "addresses_update_own" ON addresses
  FOR UPDATE USING (
    user_id IN (SELECT user_id FROM public.users WHERE supa_user_uuid = auth.uid())
  );

CREATE POLICY "addresses_delete_own" ON addresses
  FOR DELETE USING (
    user_id IN (SELECT user_id FROM public.users WHERE supa_user_uuid = auth.uid())
  );

-- Boss can see all addresses
CREATE POLICY "addresses_select_boss" ON addresses
  FOR SELECT USING (public.is_boss());

-- =============================================================
-- 6. RLS policies for PRODUCTS (public read, boss write)
-- =============================================================

-- Anyone (even anon) can read available products
CREATE POLICY "products_select_all" ON products
  FOR SELECT USING (true);

-- Boss can insert products
CREATE POLICY "products_insert_boss" ON products
  FOR INSERT WITH CHECK (public.is_boss());

-- Boss can update products
CREATE POLICY "products_update_boss" ON products
  FOR UPDATE USING (public.is_boss());

-- Boss can delete products
CREATE POLICY "products_delete_boss" ON products
  FOR DELETE USING (public.is_boss());

-- =============================================================
-- 7. RLS policies for ORDERS
-- =============================================================

-- Users can read their own orders
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (
    user_id IN (SELECT user_id FROM public.users WHERE supa_user_uuid = auth.uid())
  );

-- Users can create their own orders
CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT WITH CHECK (
    user_id IN (SELECT user_id FROM public.users WHERE supa_user_uuid = auth.uid())
  );

-- Users can update their own orders (e.g. order_user_delete)
CREATE POLICY "orders_update_own" ON orders
  FOR UPDATE USING (
    user_id IN (SELECT user_id FROM public.users WHERE supa_user_uuid = auth.uid())
  );

-- Boss can see all orders
CREATE POLICY "orders_select_boss" ON orders
  FOR SELECT USING (public.is_boss());

-- Boss can update any order (e.g. status changes)
CREATE POLICY "orders_update_boss" ON orders
  FOR UPDATE USING (public.is_boss());

-- =============================================================
-- 8. RLS policies for DISCOUNT (public read, boss write)
-- =============================================================

CREATE POLICY "discount_select_all" ON discount
  FOR SELECT USING (true);

CREATE POLICY "discount_insert_boss" ON discount
  FOR INSERT WITH CHECK (public.is_boss());

CREATE POLICY "discount_update_boss" ON discount
  FOR UPDATE USING (public.is_boss());

CREATE POLICY "discount_delete_boss" ON discount
  FOR DELETE USING (public.is_boss());

-- =============================================================
-- 9. RLS policies for PRODUCT_GROUP (public read, boss write)
-- =============================================================

CREATE POLICY "product_group_select_all" ON product_group
  FOR SELECT USING (true);

CREATE POLICY "product_group_insert_boss" ON product_group
  FOR INSERT WITH CHECK (public.is_boss());

CREATE POLICY "product_group_update_boss" ON product_group
  FOR UPDATE USING (public.is_boss());

CREATE POLICY "product_group_delete_boss" ON product_group
  FOR DELETE USING (public.is_boss());
