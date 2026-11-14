'use strict';
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Neither credentials nor database access are sent to the browser.
function createOrderStore() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url || key || process.env.VERCEL) {
    if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
      throw new Error('Supabase server environment is missing or invalid');
    }
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    // New sb_secret keys are not JWTs and must only use the apikey header.
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    async function request(resource, options = {}) {
      const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${resource}`, {
        ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error('Database request failed');
        error.status = data.message === 'balo_rate_limited' ? 429 : 503;
        throw error;
      }
      return response.json();
    }
    return {
      kind: 'supabase',
      async insert(name, phone, orderInfo, ip) {
        const bucket = crypto.createHmac('sha256', process.env.RATE_LIMIT_SECRET || key).update(ip).digest('hex');
        const result = await request('rpc/submit_balo_order', { method: 'POST', body: JSON.stringify({
          p_name: name, p_phone: phone, p_order_info: orderInfo, p_bucket: bucket
        }) });
        if (!result?.orderId) throw new Error('Database did not confirm order');
        return String(result.orderId);
      },
      async page(before, limit = 100) {
        const query = new URLSearchParams({ select: 'id,name:customer_name,phone,orderInfo:order_info,createdAt:created_at', order: 'id.desc', limit: String(limit) });
        if (before) query.set('id', `lt.${before}`);
        return request(`orders?${query}`);
      }
    };
  }
  // Retain existing local SQLite files. Production never silently falls back to disk.
  const Database = require('better-sqlite3');
  const dbPath = path.resolve(process.env.DB_PATH || './data/orders.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL, phone TEXT NOT NULL, order_info TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  const insert = db.prepare('INSERT INTO orders (customer_name, phone, order_info) VALUES (?, ?, ?)');
  const select = 'SELECT id, customer_name AS name, phone, order_info AS orderInfo, created_at AS createdAt FROM orders';
  return {
    kind: 'sqlite',
    async insert(name, phone, orderInfo) { return String(insert.run(name, phone, orderInfo).lastInsertRowid); },
    async page(before, limit = 100) {
      return before ? db.prepare(`${select} WHERE id < ? ORDER BY id DESC LIMIT ?`).all(before, limit)
        : db.prepare(`${select} ORDER BY id DESC LIMIT ?`).all(limit);
    }
  };
}
module.exports = { createOrderStore };
