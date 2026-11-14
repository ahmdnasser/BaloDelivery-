const tbody = document.getElementById('orders');
const count = document.getElementById('count');
const status = document.getElementById('status');
async function loadOrders() {
  status.textContent = 'Loading orders…';
  try {
    const response = await fetch('/api/admin/orders', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load orders.');
    const data = await response.json();
    const orders = data.orders || [];
    count.textContent = orders.length;
    tbody.replaceChildren();
    if (!orders.length) {
      const tr = document.createElement('tr'); const td = document.createElement('td');
      td.colSpan = 5; td.textContent = 'No requests yet.'; tr.append(td); tbody.append(tr);
    }
    for (const order of orders) {
      const tr = document.createElement('tr');
      for (const value of [order.id, order.name, order.phone, order.orderInfo, new Date(order.createdAt).toLocaleString()]) {
        const td = document.createElement('td'); td.textContent = String(value); tr.append(td);
      }
      tbody.append(tr);
    }
    status.textContent = 'Updated just now.';
  } catch (error) { status.textContent = error.message; }
}
document.getElementById('refresh').addEventListener('click', loadOrders);
loadOrders();
