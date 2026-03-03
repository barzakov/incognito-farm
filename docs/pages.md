# Pages

Each page lives in its own directory under `src/pages/` and consists of an HTML file, a CSS file, and a JavaScript file.

---

## Home — `/home/`

**Files:** `home.html`, `home.css`, `home.js`

- Displays a carousel of discounted / featured products.
- Shows product cards with add-to-cart functionality.
- Cart state is read from and written to `localStorage`.

---

## Products — `/products/`

**Files:** `index.html`, `products.css`, `products.js`

- Lists all available products with filter by product group.
- Calculates and shows the best discount per product:
	- individual product discount (`products.discount`, %)
	- group discount (`discount.discount_percentage`, %)
	- applies whichever gives lower final price.
- Supports add-to-cart per product.
- Date formatting uses Bulgarian locale (`bg-BG`).

---

## Cart — `/cart/`

**Files:** `index.html`, `cart.css`, `cart.js`

- Reads cart from `localStorage`, fetches product details from Supabase.
- Uses the same best-discount logic as the products page (individual % vs group %).
- Authenticated users can select a saved address and place an order.
- On checkout: creates a row in `orders` with a snapshot of the product (`short_description`) and the price at time of order.
- Clears cart after successful order.

---

## Auth — `/auth/login` and `/auth/register`

**Files:** `login.html` / `login.js`, `register.html` / `register.js`

- **Login:** validates email + password, calls `authenticateUser()`, redirects boss users to `/admin/`, others to `/`.
- **Register:** collects name fields and passes them as `user_metadata` to Supabase `signUp`. The DB trigger creates the `users` row automatically.
- Both pages redirect already-authenticated users away.

---

## User — `/user/`

**Files:** `index.html`, `user.css`, `user.js`

Requires authentication. Sections:

| Section | Functionality |
|---------|--------------|
| Personal info | Display and edit name fields |
| Addresses | Add, edit, delete saved addresses (stored as jsonb) |
| Orders | List own orders with status history |
| Settings | Change password, soft-delete account, logout |

Email is fetched from `auth.users` via `supa_user_uuid`.

---

## Admin — `/admin/`

**Files:** `index.html`, `admin.css`, `admin.js`

Requires `boss = true`. Frontend access guard redirects non-boss users.

| Section | Functionality |
|---------|--------------|
| Dashboard | Count of pending orders, products expiring within 5 days |
| Products | Full CRUD — create, edit, delete products; set expiry date in `extra.expire`; manage availability; set individual product discount in **%** |
| Product groups | Create and delete groups |
| Discounts | Create, edit, delete discount periods with date range and percentage; assign to product groups |
| Orders | View all orders, update status |
| Users | View all users, toggle boss flag, soft-delete |

---

## About — `/about/`

**Files:** `index.html`, `about.css`, `about.js`

Static informational page about the farm.

---

## Contact — `/contact/`

**Files:** `index.html`, `contact.css`, `contact.js`

Contact form and farm location information.
