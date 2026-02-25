# Requirements

- These instructions define coding standards and architecture rules.  
  Follow them whenever generating or modifying code — do not treat them as a one-time setup task.

## Technologies

- **Frontend:** HTML, CSS, JavaScript and Bootstrap.  
  Plain JavaScript only — no TypeScript, React, or Vue.
- **Backend:** Supabase for database, authentication, and storage.
- **Build tools:** Node.js, npm, Vite

## Architecture

- The app must use modular components and be mobile-friendly/responsive.
- **Multi-page navigation:** each page lives at its own URL, e.g.  
  `site_name/user/1`, `site_name/product/1`, `site_name/admin/`, `site_name/home/`
  - Each page has its own directory containing its own `html`, `css`, and `javascript` files.
  - Keep files small; avoid duplicating functions across files.
- Implement routing and navigation between pages.
- Split layout into reusable components: header, page content, footer.
- Pages are rendered dynamically via JavaScript.

## Language

- All visible site text must be in **Bulgarian**.
- All code (variables, functions, comments, file names) must be in **English**.

## Supabase

### Authentication and Authorization

- Use Supabase Auth with JWT tokens.
- Enforce access control through Row-Level Security (RLS) policies on all tables.

### Database changes

- **Never edit existing migration files.**
- For every schema change, create a new migration file in `supabase/migrations_applyed/` and apply it (or delete it) only after approval.
- After each approved migration: query `supabase_migrations.schema_migrations` to get the migration history, then save each new migration file to `supabase/migrations/` and mark it as read-only.

### Database schema

- **users** table:
  - `user_id` — primary key, bigint, auto-increment
  - `name`, `second_name`, `lastname` — text columns
  - `supa_user_uuid` — uuid, stores the UUID from `auth.users`; if the auth user is deleted, this value is kept (not nulled or deleted)
  - `created_on` — timestamp
  - `deleted_on` — timestamp, nullable (soft delete)
  - `boss` — boolean; indicates whether the user has admin/boss privileges
  - See [Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data) for the relationship pattern between `users` and `auth.users`
  - Always use `user_id` (not `supa_user_uuid`) as the identifier inside the app

- **Retrieving auth data:**  
  When data from `auth.users` is needed (e.g. email), look up the user by `user_id` in the `users` table first, then use `supa_user_uuid` to query `auth.users`. Never expose `auth.users` directly to the frontend.

- **addresses** table:
  - `address_id` — primary key, bigint, auto-increment
  - `user_id` — bigint, foreign key → `users.user_id`, cascade delete
  - `address` — jsonb (street, city, postal code, etc.)
  - `order_extra` — jsonb (extra delivery/order info tied to this address)

- **products** table:
  - `product_id` — primary key, bigint, auto-increment
  - `images_location` — text (Supabase Storage path)
  - `description` — jsonb (fields: `name`, `brief_info`, `info`, etc.)
  - `extra` — jsonb (any additional product metadata)
  - `group_id` — bigint, foreign key → `product_group.group_id`
  - `price` — numeric
  - `discount` — numeric, nullable
  - `availability` — boolean
  - `created_on` — timestamp

- **orders** table:
  - `order_id` — primary key, bigint, auto-increment
  - `user_id` — bigint, foreign key → `users.user_id`
  - `product_id` — bigint, **no foreign key** (product details may change after the order is placed)
  - `price` — numeric (price at time of order)
  - `discount` — numeric, nullable (discount at time of order)
  - `short_description` — jsonb (snapshot of product: `name`, `brief_info`)
  - `order_status` — jsonb (status history/current status)
  - `order_done` — boolean
  - `order_date` — timestamp
  - `order_extra` — jsonb (extra order info, e.g. notes, delivery preferences)
  - `order_archived` — boolean
  - `order_user_delete` — boolean (user has requested deletion/hiding of this order)

- **discount** table:
  - `discount_id` — primary key, bigint, auto-increment
  - `start_date` — date/timestamp
  - `end_date` — date/timestamp

- **product_group** table:
  - `group_id` — primary key, bigint, auto-increment
  - `name` — text
  - `group_discount` — bigint, foreign key → `discount.discount_id`, nullable

## UI: Interface and Design Rules

- **Buttons:** rounded corners
- **Color scheme:** green gamma (shades of green as primary palette)
- **Font:** "Little Gothic" (apply via CSS font-family; fall back to a sans-serif)
- **Layout:** responsive grid/flexbox, mobile-first
- **Forms:** styled inputs with clear labels and validation feedback
- **Navigation bars:** responsive, collapsible on mobile
- **Cards:** rounded, with subtle shadow
- **Icons:** use a consistent icon library (e.g. Bootstrap Icons)
- **Spacing:** consistent padding/margin scale
- **Animations:** subtle transitions (hover, open/close)
- **Visual cues:** loading states, disabled states, active states
- **Toast notifications:** non-blocking, auto-dismiss, positioned top-right
- **General:** modern, clean, and user-friendly UI
