# Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| UI framework | Bootstrap 5 + Bootstrap Icons |
| Build tool | Vite 5 (MPA mode) |
| Backend / DB | Supabase (PostgreSQL, Auth, Storage) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage (`products` bucket) |

---

## Project Layout

```
src/
├── index.html              # Root redirect / landing
├── components/             # Component source templates
│   ├── Header.html
│   └── Footer.html
├── lib/                    # Shared utilities (imported by all pages)
│   ├── supabaseClient.js   # Supabase client + auth/user helpers
│   ├── components.js       # Header/footer loader + nav logic
│   ├── formValidation.js   # Email, password, field validators
│   └── toast.js            # Toast notification utility
├── pages/                  # One directory per page
│   ├── home/
│   ├── products/
│   ├── cart/
│   ├── auth/               # login.html + register.html
│   ├── user/
│   ├── admin/
│   ├── about/
│   └── contact/
├── public/
│   └── components/         # Static copies served by Vite
└── styles/
    ├── global.css
    ├── header.css
    └── footer.css

supabase/
├── migrations/             # Applied migrations (read-only)
├── migrations_applyed/     # Staging area for new migrations
├── seed/
└── functions/
```

---

## Routing

Vite is configured as a **Multi-Page Application (MPA)**. Each page is its own HTML entry point.

| URL | HTML entry |
|-----|-----------|
| `/` | `src/index.html` |
| `/home/` | `src/pages/home/home.html` |
| `/products/` | `src/pages/products/index.html` |
| `/cart/` | `src/pages/cart/index.html` |
| `/auth/login` | `src/pages/auth/login.html` |
| `/auth/register` | `src/pages/auth/register.html` |
| `/user/` | `src/pages/user/index.html` |
| `/admin/` | `src/pages/admin/index.html` |
| `/about/` | `src/pages/about/index.html` |
| `/contact/` | `src/pages/contact/index.html` |

A custom Vite middleware (`vite.config.js`) rewrites clean URLs to the matching HTML file during development.

---

## Shared Libraries (`src/lib/`)

### `supabaseClient.js`
Single Supabase client instance. Exports auth helpers used everywhere:

| Export | Purpose |
|--------|---------|
| `supabase` | Raw Supabase client |
| `registerUser(email, password, meta)` | Sign up via Supabase Auth |
| `authenticateUser(email, password)` | Sign in |
| `logoutUser()` | Sign out |
| `fetchAuthUser()` | Get current JWT-verified auth user |
| `getSession()` | Get current session |
| `fetchUserData(userId)` | Fetch `users` row by `user_id` |
| `fetchCurrentUserProfile()` | Fetch profile for the current auth user |
| `isBoss()` | Check admin privileges |
| `onAuthStateChange(callback)` | Subscribe to auth state |
| `fetchAllDiscounts()` / `fetchDiscountById()` | Discount reads for admin panel |
| `createDiscount()` / `updateDiscount()` / `deleteDiscount()` | Discount CRUD for admin panel |
| `calculateBestDiscount(price, productDiscount, groupDiscount)` | Applies better discount between product % and group % |

### `components.js`
Dynamically injects `Header.html` and `Footer.html` into every page, then:
- Activates the current nav link
- Shows/hides guest vs. authenticated nav items
- Displays the admin link for boss users
- Updates the cart item badge
- Wires up the logout button

### `formValidation.js`

| Export | Purpose |
|--------|---------|
| `isValidEmail(email)` | Regex email check |
| `validatePassword(password)` | Strength check (length, uppercase, digit) |
| `setInputFeedback(input, isValid, msg)` | Bootstrap valid/invalid feedback |
| `validateForm(form)` | Validates all required fields in a form |
| `clearFormFeedback(form)` | Removes all validation UI |

### `toast.js`
Auto-dismiss toast notifications, top-right corner.  
`toast.success(msg)` / `toast.error(msg)` / `toast.warning(msg)` / `toast.info(msg)`

---

## Cart

The cart is stored in `localStorage` under the key `incognito_farm_cart`.

```json
[{ "productId": 1, "quantity": 2 }, { "productId": 5, "quantity": 1 }]
```

On checkout (`/cart/`), product details are fetched from Supabase, the order is written to the `orders` table, and the cart is cleared.

Product and cart pricing both use `calculateBestDiscount()` so users always receive the best available discount from:
- product-level discount (`products.discount`, %)
- group-level discount (`discount.discount_percentage`, %)

---

## Access Control

- **Guest** – read public products, product groups, discounts.
- **Authenticated user** – manage own addresses, place orders, view own orders and profile.
- **Boss (admin)** – full CRUD on products, product groups, discounts; read/update all orders and users.

Access is enforced at two levels:
1. **RLS policies** on every table (see [database.md](database.md)).
2. **Frontend guard** in `admin.js` — redirects non-boss users before rendering the page.

---

## Design Conventions

- **Language:** all UI text in Bulgarian; all code (variables, functions, files) in English.
- **Colors:** green palette as primary.
- **Font:** "Little Gothic", fallback sans-serif.
- **Components:** mobile-first, Bootstrap grid, rounded corners, subtle shadows, hover transitions.
