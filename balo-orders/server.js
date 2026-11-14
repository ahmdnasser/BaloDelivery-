'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
const { createOrderStore } = require('./lib/orders');

const app = express();
const port = Number(process.env.PORT || 3000);
const adminUser = process.env.ADMIN_USER || 'balo';
const adminPassword = process.env.ADMIN_PASSWORD;
const adminConfigured = Boolean(adminPassword && adminPassword !== 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD' && adminPassword.length >= 12);
let store;
try { store = createOrderStore(); } catch { console.error('Order storage is not configured.'); }

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1' || process.env.VERCEL) app.set('trust proxy', 1);
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
  message: { error: 'طلبات كتير في وقت قليل. استنى شوية وجرب تاني.' } });

app.post('/api/orders', orderLimiter, async (req, res) => {
  const { name, phone, orderInfo } = req.body || {};
  if (typeof name !== 'string' || typeof phone !== 'string' || typeof orderInfo !== 'string') {
    return res.status(400).json({ error: 'كمّل اسمك ورقمك وتفاصيل طلبك يا باشا.' });
  }
  const n = name.trim(), p = phone.trim(), o = orderInfo.trim();
  if (n.length < 2 || n.length > 100 || p.length < 6 || p.length > 25 || o.length < 3 || o.length > 2000 || !/^[+\d\s()\-]+$/.test(p)) {
    return res.status(400).json({ error: 'راجع اسمك ورقم تليفونك وتفاصيل الطلب.' });
  }
  try {
    if (!store || !adminConfigured) return res.status(503).json({ error: 'استقبال الطلبات مش جاهز دلوقتي. جرب بعد شوية.' });
    const orderId = await store.insert(n, p, o, req.ip || 'unknown');
    return res.status(201).json({ success: true, orderId });
  } catch (e) {
    console.error('Unable to save order.');
    return res.status(e.status === 429 ? 429 : 503).json({ error: e.status === 429 ? 'طلبات كتير في وقت قليل. استنى شوية وجرب تاني.' : 'مش قادرين نحفظ طلبك دلوقتي. جرب بعد شوية.' });
  }
});

function safeCompare(a, b) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function adminOnly(req, res, next) {
  if (!adminConfigured) return res.status(503).set('Cache-Control', 'no-store').send('دخول الأدمن مش متاح دلوقتي.');
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
  return res.status(401).set('WWW-Authenticate', 'Basic realm="Balo Orders", charset="UTF-8"').set('Cache-Control', 'no-store').send('الصفحة دي لبالو بس. ادخل ببيانات الأدمن.');
}

app.get('/admin', adminOnly, (_req, res) => res.sendFile(path.join(__dirname, 'private', 'admin.html')));
app.get('/api/admin/orders', adminOnly, async (req, res) => {
  const before = req.query.before;
  if (before !== undefined && (typeof before !== 'string' || !/^\d{1,19}$/.test(before))) return res.status(400).json({ error: 'رقم الصفحة مش صحيح.' });
  try {
    if (!store) throw new Error('unavailable');
    const orders = await store.page(before, 100);
    return res.json({ orders, nextCursor: orders.length === 100 ? String(orders.at(-1).id) : null });
  } catch { return res.status(503).json({ error: 'مش قادرين نحمّل الطلبات. جرب تاني بعد شوية.' }); }
});
app.get('/api/admin/orders.csv', adminOnly, async (_req, res) => {
  const esc = value => '"' + String(value).replace(/"/g, '""').replace(/^[=+@\-\t\r]/, "'$&") + '"';
  try {
    if (!store) throw new Error('unavailable');
    // Capture the first page before sending headers; failures must not look like a complete export.
    let rows = await store.page(null, 500);
    res.type('text/csv').attachment('balo-orders.csv');
    res.write('\ufeff' + ['رقم الطلب','الاسم','التليفون','تفاصيل الطلب','وقت الوصول'].map(esc).join(',') + '\r\n');
    while (rows.length) {
      for (const row of rows) res.write([row.id,row.name,row.phone,row.orderInfo,row.createdAt].map(esc).join(',') + '\r\n');
      if (rows.length < 500 || res.destroyed) break;
      rows = await store.page(String(rows.at(-1).id), 500);
    }
    res.end();
  } catch {
    if (res.headersSent) res.destroy();
    else res.status(503).json({ error: 'مش قادرين نصدّر الطلبات. جرب تاني بعد شوية.' });
  }
});

app.use((req, res) => res.status(404).json({ error: 'الصفحة مش موجودة.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: 'الطلب مش واضح. راجع البيانات وجرب تاني.' });
});
module.exports = app;
if (require.main === module) app.listen(port, () => console.log(`Balo Orders running at http://localhost:${port}`));
