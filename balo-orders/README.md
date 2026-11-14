# Balo — Delivery Order Website

A responsive, minimal website for one delivery person, **Balo**. Customers submit **only three fields**:

1. Name
2. Phone number
3. Order information

The customer site is an Egyptian Arabic, RTL five-screen mini-app. Customers do not need an account. Orders use the unchanged `POST /api/orders` payload `{name, phone, orderInfo}`. Success appears only after a confirmed API response.

Production orders are saved privately in Supabase Postgres. Local development can still use the original SQLite database. Balo's password-protected `/admin` dashboard loads orders in pages and exports all orders as CSV without the previous 5,000-order cutoff.

## Start locally

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env
```

Edit `.env` and set `ADMIN_PASSWORD` to a long, unique password (12+ characters). Then:

```bash
npm start
```

- Customer website: http://localhost:3000
- Balo's private orders dashboard: http://localhost:3000/admin
- Admin username: `balo` (unless changed in `.env`)
- Admin password: the value you configured in `.env`

The browser prompts for Balo's username/password when opening `/admin`.

## Publish on Vercel with Supabase

1. Create a dedicated Supabase project. Enable Data API, disable automatic table exposure, and enable automatic row-level security.
2. Run `supabase/migrations/202611140001_orders.sql` in that project's SQL editor. It creates private orders and hashed rate-limit buckets. Anonymous and authenticated clients have no direct access. Only the server's secret key can submit through the atomic, rate-limited function or read orders.
3. In the Vercel **balooo** project, retain the repository root directory `balo-orders`. The included `vercel.json` routes the customer site, `/api/orders`, and `/admin` through the Express function. Do not deploy only the `public` folder.
4. Add server-only production variables: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (recommended modern `sb_secret_…` key), and `ADMIN_PASSWORD` (12+ characters). `ADMIN_USER` defaults to `balo`. Optional `RATE_LIMIT_SECRET` should be a stable random server secret. Never prefix keys with `NEXT_PUBLIC_`, place them in `public/`, or commit `.env`.
5. Deploy the current Git commit after variables are configured. Verify an actual test order appears in `/admin` and CSV. Supabase credentials and SQL must be provisioned before considering production orders operational.

Vercel never falls back to ephemeral SQLite storage. Missing configuration returns an Arabic 503 response and never shows a false success. The Supabase function enforces 10 requests per 15-minute window across server instances; stored rate-limit identifiers are HMAC hashes, not raw IP addresses. Existing Helmet, request limits, input checks, timing-safe admin authentication, private admin documents, and CSV formula escaping remain in place.

### Existing local SQLite data

Existing SQLite files are not modified or removed. Without Supabase variables, local `npm start` uses `DB_PATH` as before. If there are historical orders in an existing database, back it up and import them into Supabase with their IDs and timestamps before switching the live service, then advance the identity sequence. Do not overwrite a populated Supabase table or publish a database file. There was no database file in the supplied source archive.

## Alternative persistent Node hosting

Deploy this Node.js app to a hosting provider that supports a **persistent disk** and Node.js 20+. Set environment variables `ADMIN_PASSWORD` (required), `ADMIN_USER` (optional), `DB_PATH` (path on your persistent disk), and `NODE_ENV=production`. Set `TRUST_PROXY=1` only if your host uses a trusted reverse proxy. Enable HTTPS. Make sure the host keeps the database file across redeployments/restarts; otherwise orders may disappear. Set up backups and a privacy/retention policy for customer phone numbers.

Do not use a static-only host: the `/api/orders` backend and database are required for submissions. There is no automatic SMS or WhatsApp notification in this version; Balo reads requests at `/admin`.

## Notes

- Orders appear newest first. The dashboard loads 100 at a time; “load older orders” retrieves further pages. CSV exports the complete order history.
- Public submissions are rate-limited to reduce spam.
- No customer accounts or extra checkout fields.
- Do not publish your `.env` file or database file.
- Basic authentication must be used over HTTPS on a public website.
