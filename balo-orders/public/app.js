const form = document.getElementById('order-form');
const button = document.getElementById('submit-btn');
const message = document.getElementById('form-message');
document.getElementById('year').textContent = new Date().getFullYear();
form.addEventListener('submit', async event => {
  event.preventDefault();
  const name = form.elements.name.value.trim();
  const phone = form.elements.phone.value.trim();
  const orderInfo = form.elements.orderInfo.value.trim();
  message.textContent = '';
  message.className = 'form-message';
  if (name.length < 2 || phone.length < 6 || !/^[+\d\s()\-]+$/.test(phone) || orderInfo.length < 3) {
    message.textContent = 'Please fill in your name, a valid phone number, and your order details.';
    message.classList.add('error');
    return;
  }
  button.disabled = true;
  button.querySelector('span').textContent = 'Sending request…';
  try {
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, orderInfo }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    message.textContent = `Request #${data.orderId} received! Balo can now see your order.`;
    message.classList.add('success');
    form.reset();
  } catch (error) {
    message.textContent = error.message || 'Could not send request. Please try again.';
    message.classList.add('error');
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Send request to Balo';
  }
});
