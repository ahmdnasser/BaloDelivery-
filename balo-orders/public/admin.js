'use strict';
const tbody = document.getElementById('orders');
const count = document.getElementById('count');
const status = document.getElementById('status');
const refresh = document.getElementById('refresh');
const more = document.getElementById('load-more');
const formatter = new Intl.NumberFormat('ar-EG');
let cursor = null;
let loaded = 0;
let loading = false;
async function loadOrders(append = false) {
  if (loading) return;
  loading = true;
  refresh.disabled = true;
  more.disabled = true;
  tbody.setAttribute('aria-busy', 'true');
  status.textContent = 'بنحمّل الطلبات…';
  try {
    const response = await fetch(`/api/admin/orders${append && cursor ? `?before=${encodeURIComponent(cursor)}` : ''}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('unavailable');
    const data = await response.json();
    if (!Array.isArray(data.orders)) throw new Error('invalid response');
    if (!append) { tbody.replaceChildren(); loaded = 0; }
    const fragment = document.createDocumentFragment();
    for (const order of data.orders) {
      const tr = document.createElement('tr');
      for (const value of [order.id, order.name, order.phone, order.orderInfo, new Date(order.createdAt).toLocaleString('ar-EG')]) {
        const td = document.createElement('td'); td.textContent = String(value); tr.append(td);
      }
      fragment.append(tr);
    }
    tbody.append(fragment);
    loaded += data.orders.length;
    if (!loaded) {
      const tr = document.createElement('tr'); const td = document.createElement('td');
      td.colSpan = 5; td.textContent = 'لسه مفيش طلبات. أول طلب هتلاقيه هنا.'; tr.append(td); tbody.append(tr);
    }
    cursor = data.nextCursor || null;
    more.hidden = !cursor;
    count.textContent = formatter.format(loaded);
    status.textContent = cursor ? 'دي أحدث الطلبات. تقدر تحمّل الأقدم أو تصدّر كل الطلبات.' : 'دي كل الطلبات. اتحدثت دلوقتي.';
  } catch {
    status.textContent = 'مش قادرين نحمّل الطلبات. اتأكد من الاتصال وصلاحية دخولك وجرب تاني.';
  } finally {
    loading = false;
    refresh.disabled = false;
    more.disabled = false;
    tbody.removeAttribute('aria-busy');
  }
}
refresh.addEventListener('click', () => loadOrders(false));
more.addEventListener('click', () => loadOrders(true));
loadOrders();
