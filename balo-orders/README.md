# Balo — Delivery Order Website

A responsive, minimal website for one delivery person, **Balo**. Customers submit **only three fields**:

1. Name
2. Phone number
3. Order information

Orders are saved in a private SQLite database. Balo can log into a private dashboard to read them and export a CSV.

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

## Publish online

Deploy this Node.js app to a hosting provider that supports a **persistent disk** and Node.js 20+. Set environment variables `ADMIN_PASSWORD` (required), `ADMIN_USER` (optional), `DB_PATH` (path on your persistent disk), and `NODE_ENV=production`. Set `TRUST_PROXY=1` only if your host uses a trusted reverse proxy. Enable HTTPS. Make sure the host keeps the database file across redeployments/restarts; otherwise orders may disappear. Set up backups and a privacy/retention policy for customer phone numbers.

Do not use a static-only host: the `/api/orders` backend and database are required for submissions. There is no automatic SMS or WhatsApp notification in this version; Balo reads requests at `/admin`.

## Notes

- Orders appear newest first; dashboard/CSV show the latest 5,000 orders.
- Public submissions are rate-limited to reduce spam.
- No customer accounts or extra checkout fields.
- Do not publish your `.env` file or database file.
- Basic authentication must be used over HTTPS on a public website.
