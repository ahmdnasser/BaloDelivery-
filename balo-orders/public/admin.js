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
      const card = document.createElement('article');
      card.className = 'order-card';
      const heading = document.createElement('div'); heading.className = 'order-heading';
      const id = document.createElement('span'); id.className = 'order-id'; id.textContent = `طلب #${order.id}`;
      const date = document.createElement('time'); date.className = 'order-date';
      date.textContent = new Date(order.createdAt).toLocaleString('ar-EG');
      heading.append(id, date);
      const name = document.createElement('h2'); name.textContent = order.name;
      const phone = document.createElement('a'); phone.className = 'phone'; phone.textContent = order.phone;
      phone.href = `tel:${String(order.phone).replace(/[^+0-9]/g, '')}`;
      const details = document.createElement('div'); details.className = 'order-details';
      const label = document.createElement('h3'); label.textContent = 'تفاصيل الطلب';
      const info = document.createElement('p'); info.textContent = order.orderInfo;
      details.append(label, info); card.append(heading, name, phone, details); fragment.append(card);
    }
    tbody.append(fragment);
    loaded += data.orders.length;
    if (!loaded) {
      const empty = document.createElement('p'); empty.className = 'empty';
      empty.textContent = 'لسه مفيش طلبات. أول مشوار هيظهر هنا.'; tbody.append(empty);
    }
    cursor = data.nextCursor || null;
    more.hidden = !cursor;
    count.textContent = formatter.format(loaded);
    status.textContent = cursor ? 'أحدث الطلبات الأول. فيه طلبات أقدم تحت.' : 'كل الطلبات قدامك. اتحدثت دلوقتي.';
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
