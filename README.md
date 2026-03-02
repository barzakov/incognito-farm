# Incognito Farm

Bulgarian agricultural e-commerce app. Built with Vanilla JS, Vite, Bootstrap 5, and Supabase.

## Quick start

```bash
npm install
# create .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

See [docs/setup.md](docs/setup.md) for the full setup guide.

## Documentation

| Doc | Contents |
|-----|---------|
| [docs/architecture.md](docs/architecture.md) | Tech stack, project layout, routing, shared libraries, cart, access control |
| [docs/database.md](docs/database.md) | ER diagram, table definitions, RLS policies, triggers, migrations |
| [docs/pages.md](docs/pages.md) | Page-by-page feature description |
| [docs/setup.md](docs/setup.md) | Prerequisites, env vars, migrations, seed, build |

## Scripts

```bash
npm run dev      # start dev server on :5173
npm run build    # production build → dist/
npm run preview  # preview the build
```
