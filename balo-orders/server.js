'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const port = Number(process.env.PORT || 3000);
const adminUser = process.env.ADMIN_USER || 'balo';
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword || adminPassword === 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD' || adminPassword.length < 12) {
  console.error('Set ADMIN_PASSWORD to a unique password of at least 12 characters in .env');
  process.exit(1);
}

const dbPath = path.resolve(process.env.DB_PATH || './data/orders.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  order_info TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`);
const insertOrder = db.prepare('INSERT INTO orders (customer_name, phone, order_info) VALUES (?, ?, ?)');
const listOrders = db.prepare('SELECT id, customer_name AS name, phone, order_info AS orderInfo, created_at AS createdAt FROM orders ORDER BY id DESC LIMIT 5000');

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
  }
}}));
app.use(express.json({ limit: '12kb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' } });

app.post('/api/orders', orderLimiter, (req, res) => {
  const { name, phone, orderInfo } = req.body || {};
  if (typeof name !== 'string' || typeof phone !== 'string' || typeof orderInfo !== 'string') {
    return res.status(400).json({ error: 'Please complete all three fields.' });
  }
  const n = name.trim(), p = phone.trim(), o = orderInfo.trim();
  if (n.length < 2 || n.length > 100 || p.length < 6 || p.length > 25 || o.length < 3 || o.length > 2000 || !/^[+\d\s()\-]+$/.test(p)) {
    return res.status(400).json({ error: 'Please enter a valid name, phone number, and order.' });
  }
  try {
    const result = insertOrder.run(n, p, o);
    return res.status(201).json({ success: true, orderId: result.lastInsertRowid.toString() });
  } catch (e) {
    console.error('Unable to save order:', e.message);
    return res.status(500).json({ error: 'Could not send your request. Please try again.' });
  }
});

function safeCompare(a, b) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function adminOnly(req, res, next) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Basic ')) return challenge(res);
  let decoded;
  try { decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8'); } catch { return challenge(res); }
  const sep = decoded.indexOf(':');
  if (sep === -1) return challenge(res);
  if (!safeCompare(decoded.slice(0, sep), adminUser) || !safeCompare(decoded.slice(sep + 1), adminPassword)) return challenge(res);
  res.set('Cache-Control', 'no-store');
  next();
}
function challenge(res) {
  return res.status(401).set('WWW-Authenticate', 'Basic realm="Balo Orders"').set('Cache-Control', 'no-store').send('Balo admin login required.');
}

app.get('/admin', adminOnly, (_req, res) => res.sendFile(path.join(__dirname, 'private', 'admin.html')));
app.get('/api/admin/orders', adminOnly, (_req, res) => res.json({ orders: listOrders.all() }));
app.get('/api/admin/orders.csv', adminOnly, (_req, res) => {
  const rows = listOrders.all();
  const esc = value => '"' + String(value).replace(/"/g, '""').replace(/^[=+@\-\t\r]/, "'$&") + '"';
  const lines = [['ID','Name','Phone','Order Info','Submitted At'].map(esc).join(',')];
  for (const row of rows) lines.push([row.id,row.name,row.phone,row.orderInfo,row.createdAt].map(esc).join(','));
  res.type('text/csv').attachment('balo-orders.csv').send('\ufeff' + lines.join('\r\n'));
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.listen(port, () => console.log(`Balo Orders running at http://localhost:${port}`));
