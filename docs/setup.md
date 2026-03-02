# Setup Guide

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Supabase account | — |

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Both values are found in **Supabase → Project Settings → API**.

---

## 3. Apply database migrations

Migrations live in `supabase/migrations/`. Apply them in chronological order via the Supabase SQL editor or CLI:

```
20260225200853_create_users_table.sql
20260225200910_create_addresses_table.sql
20260225200915_create_discount_table.sql
20260225200919_create_product_group_table.sql
20260225200925_create_products_table.sql
20260225200942_create_orders_table.sql
20260226200247_auth_rls_trigger.sql
20260226211314_create_products_storage_bucket.sql
20260227184635_auto_expire_products.sql
```

> **Rule:** never edit existing migration files. Add new migrations to `supabase/migrations_applyed/`, apply them, then move to `supabase/migrations/` and mark read-only.

---

## 4. Seed (optional)

```bash
# Seed via psql / Supabase SQL editor
supabase/seed/seed.sql
```

Individual seed scripts are also available:

```bash
node scripts/seed-products.js
node scripts/seed-addresses.js
node scripts/seed-orders.js
```

---

## 5. Run the dev server

```bash
npm run dev
```

Opens at `http://localhost:5173`.

---

## 6. Build for production

```bash
npm run build   # outputs to dist/
npm run preview # preview the build locally
```
