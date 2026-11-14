const tbody = document.getElementById('orders');
const count = document.getElementById('count');
const status = document.getElementById('status');
async function loadOrders() {
  status.textContent = 'بنحمّل الطلبات…';
  try {
    const response = await fetch('/api/admin/orders', { cache: 'no-store' });
    if (!response.ok) throw new Error('مش قادرين نحمّل الطلبات. اتأكد من الاتصال وصلاحية دخولك.');
    const data = await response.json();
    const orders = data.orders || [];
    count.textContent = new Intl.NumberFormat('ar-EG').format(orders.length);
    tbody.replaceChildren();
    if (!orders.length) {
      const tr = document.createElement('tr'); const td = document.createElement('td');
      td.colSpan = 5; td.textContent = 'لسه مفيش طلبات. أول طلب هتلاقيه هنا.'; tr.append(td); tbody.append(tr);
    }
    for (const order of orders) {
      const tr = document.createElement('tr');
      for (const value of [order.id, order.name, order.phone, order.orderInfo, new Date(order.createdAt).toLocaleString('ar-EG')]) {
        const td = document.createElement('td'); td.textContent = String(value); tr.append(td);
      }
      tbody.append(tr);
    }
    status.textContent = 'الطلبات اتحدثت دلوقتي.';
  } catch (error) { status.textContent = 'مش قادرين نحمّل الطلبات. اتأكد من الاتصال وجرب التحديث تاني.'; }
}
document.getElementById('refresh').addEventListener('click', loadOrders);
loadOrders();
