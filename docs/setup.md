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
20260301190727_add_images_jsonb_to_products.sql
20260303132938_add_discount_percentage.sql
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

---

## 7. Deploy to Netlify

### Initial setup

1. **Push to GitHub** (or GitLab/Bitbucket)
2. **Create Netlify site:**
   - Netlify Dashboard → Add new site → Import from Git
   - Select your repo and branch
   - Build settings (auto-detected from `netlify.toml`):
     - Build command: `npm run build`
     - Publish directory: `dist`
3. **Add environment variables:**
   - Site settings → Environment variables → Add:
     - `VITE_SUPABASE_URL` = your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY` = your anon key
4. **Deploy site**

### Post-deployment: Configure Supabase Auth

**Important:** Update Supabase Auth URLs to allow authentication on your Netlify domain.

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Set:
   - **Site URL**: `https://yoursite.netlify.app`
   - **Redirect URLs**: Add `https://yoursite.netlify.app/**`

### Optional: Control auto-deploys

To avoid consuming your free tier build minutes on every git push:

1. **Site settings → Build & deploy → Continuous deployment**
2. Click **"Stop auto publishing"**
3. Manually trigger deploys: **Deploys tab → Trigger deploy**

### Routing

The `netlify.toml` file handles clean URL rewrites:
- `/products/` → `/pages/products/index.html`
- `/auth/login/` → `/pages/auth/login.html`
- etc.

All routes defined in `vite.config.js` are mirrored in `netlify.toml`.
