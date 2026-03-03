# Database

## ER Diagram

```mermaid
erDiagram
    users {
        bigint  user_id       PK
        text    name
        text    second_name
        text    lastname
        uuid    supa_user_uuid
        timestamp created_on
        timestamp deleted_on
        boolean boss
    }

    addresses {
        bigint  address_id    PK
        bigint  user_id       FK
        jsonb   address
        jsonb   order_extra
    }

    orders {
        bigint    order_id        PK
        bigint    user_id         FK
        bigint    product_id
        numeric   price
        numeric   discount
        jsonb     short_description
        jsonb     order_status
        boolean   order_done
        timestamp order_date
        jsonb     order_extra
        boolean   order_archived
        boolean   order_user_delete
    }

    products {
        bigint    product_id       PK
        text      images_location
        jsonb     description
        jsonb     extra
        bigint    group_id         FK
        numeric   price
        numeric   discount
        boolean   availability
        timestamp created_on
    }

    product_group {
        bigint group_id        PK
        text   name
        bigint group_discount  FK
    }

    discount {
        bigint    discount_id  PK
        timestamp start_date
        timestamp end_date
        numeric   discount_percentage
    }

    users        ||--o{ addresses     : "has"
    users        ||--o{ orders        : "places"
    product_group }o--o| discount      : "applies"
    products     }o--|| product_group  : "belongs to"
```

> `orders.product_id` has **no foreign key** by design — product details can change after an order is placed. Order item snapshots are stored in `orders.order_extra.items`.

---

## Tables

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | bigint PK | App-level identifier — always use this, not the UUID |
| `name` | text | |
| `second_name` | text | |
| `lastname` | text | |
| `supa_user_uuid` | uuid | Links to `auth.users.id`; kept on auth user deletion |
| `created_on` | timestamp | Default `now()` |
| `deleted_on` | timestamp | Nullable — soft delete |
| `boss` | boolean | Admin flag; default `false` |

Populated automatically by the `on_auth_user_created` trigger (see [Triggers](#triggers)).

---

### `addresses`

| Column | Type | Notes |
|--------|------|-------|
| `address_id` | bigint PK | |
| `user_id` | bigint FK → `users` | Cascade delete |
| `address` | jsonb | `{ street, city, postal_code }` |
| `order_extra` | jsonb | Extra delivery notes for this address |

---

### `products`

| Column | Type | Notes |
|--------|------|-------|
| `product_id` | bigint PK | |
| `images_location` | text | Supabase Storage path (deprecated — use `images`) |
| `images` | jsonb | Array: `[{ path, active }]` |
| `description` | jsonb | `{ name, brief_info, info }` |
| `extra` | jsonb | `{ expire: "YYYY-MM-DD", … }` |
| `group_id` | bigint FK → `product_group` | |
| `price` | numeric | |
| `discount` | numeric | Nullable, **percentage** (0–100), individual product discount |
| `availability` | boolean | Set to `false` automatically when expired |
| `created_on` | timestamp | Default `now()` |

---

### `orders`

| Column | Type | Notes |
|--------|------|-------|
| `order_id` | bigint PK | |
| `user_id` | bigint FK → `users` | |
| `product_id` | bigint | No FK — intentional snapshot pattern |
| `price` | numeric | Price at time of order |
| `discount` | numeric | Discount at time of order |
| `short_description` | jsonb | Optional short note/summary (currently text or `null` in app flows) |
| `order_status` | jsonb | `{ current_status: "…" }` |
| `order_done` | boolean | Default `false` |
| `order_date` | timestamp | Default `now()` |
| `order_extra` | jsonb | Notes, delivery preferences |
| `order_archived` | boolean | Default `false` |
| `order_user_delete` | boolean | User has requested hiding this order |

### JSONB field contracts (current usage)

The database allows flexible JSONB values. The app currently uses these shapes:

| Column | Current JSON shape |
|--------|---------------------|
| `addresses.address` | `{ street, city, postal_code, phone, email, extra_info, is_default }` |
| `addresses.order_extra` | `null` or custom object |
| `products.description` | `{ name, brief_info, info }` |
| `products.extra` | `{ country, size: { грамове, килограми, бройки, active }, expire }` |
| `orders.short_description` | `string` note or `null` |
| `orders.order_status` | `{ current_status, history: [{ status, date, note }] }` |
| `orders.order_extra` | `{ items: [{ product_id, name, brief_info, quantity, unit_price, unit_discount, line_total }], address, address_id, notes }` |

> Recommendation: keep these payload shapes stable across frontend and seed scripts to avoid runtime parsing mismatches.

**Order status values** (Bulgarian UI strings):

| Value | Meaning |
|-------|---------|
| `Чакаща` | Pending |
| `Потвърдена` | Confirmed |
| `В обработка` | Processing |
| `Изпратена` | Shipped |
| `Доставена` | Delivered |
| `Отказана` | Cancelled |
| `Върната` | Returned |

---

### `product_group`

| Column | Type | Notes |
|--------|------|-------|
| `group_id` | bigint PK | |
| `name` | text | |
| `group_discount` | bigint FK → `discount` | Nullable |

---

### `discount`

| Column | Type | Notes |
|--------|------|-------|
| `discount_id` | bigint PK | |
| `start_date` | timestamp | |
| `end_date` | timestamp | |
| `discount_percentage` | numeric | Percentage value (0–100) |

> Discount selection rule in UI (`products` / `cart`):
> - product-level discount = `products.discount` (%)
> - group-level discount = `discount.discount_percentage` (%) via `product_group.group_discount`
> - the system applies the **better discount** (lower final price) automatically.

---

## Triggers

### `on_auth_user_created`
Fires **after insert on `auth.users`**. Calls `public.handle_new_user()`, which inserts a row into `public.users` using `raw_user_meta_data` fields (`name`, `second_name`, `lastname`) passed during `signUp`.

### `trigger_check_product_expiry`
Fires **before insert or update on `products`**. If `extra->>'expire'` is a past date, sets `availability = false` immediately.

### Scheduled job (`pg_cron`)
Runs `update_expired_products()` daily at midnight — marks any product whose `extra->>'expire'` has passed as unavailable.

---

## Row-Level Security (RLS)

RLS is enabled on all tables. Access is checked via the helper `public.is_boss()`, which returns `true` when the current auth user has `boss = true` and is not soft-deleted.

### Summary

| Table | Anon | Auth user | Boss |
|-------|------|-----------|------|
| `users` | — | Own row (select, update) | All rows |
| `addresses` | — | Own rows (CRUD) | All rows (select) |
| `products` | Read all | Read all | Full CRUD |
| `orders` | — | Own rows (select, insert, update) | All rows (select, update) |
| `discount` | Read all | Read all | Full CRUD |
| `product_group` | Read all | Read all | Full CRUD |

### Storage (`products` bucket)

| Operation | Who |
|-----------|-----|
| SELECT | Public (anon) |
| INSERT / UPDATE / DELETE | Authenticated users |

---

## Migrations

| File | Description |
|------|-------------|
| `20260225200853_create_users_table.sql` | `users` table |
| `20260225200910_create_addresses_table.sql` | `addresses` table |
| `20260225200915_create_discount_table.sql` | `discount` table |
| `20260225200919_create_product_group_table.sql` | `product_group` table |
| `20260225200925_create_products_table.sql` | `products` table |
| `20260225200942_create_orders_table.sql` | `orders` table |
| `20260226200247_auth_rls_trigger.sql` | Auth trigger, `is_boss()`, all RLS policies |
| `20260226211314_create_products_storage_bucket.sql` | Storage bucket + policies |
| `20260227184635_auto_expire_products.sql` | Expiry trigger + pg_cron job |
| `20260301190727_add_images_jsonb_to_products.sql` | Adds `products.images` jsonb column for multi-image support |
| `20260303132938_add_discount_percentage.sql` | Adds `discount.discount_percentage` (0–100) |
