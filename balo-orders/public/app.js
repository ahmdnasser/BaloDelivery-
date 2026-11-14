'use strict';
(() => {
  const form = document.getElementById('order-form');
  const app = document.querySelector('.app');
  const screens = [...document.querySelectorAll('[data-screen]')];
  const steps = [...document.querySelectorAll('.progress li')];
  const fields = ['name', 'phone', 'orderInfo'].map(id => document.getElementById(id));
  const submitError = document.getElementById('submit-error');
  const submitLabel = document.getElementById('submit-label');
  const numbers = new Intl.NumberFormat('ar-EG', { useGrouping: false });
  let current = 0;
  let sending = false;
  document.getElementById('year').textContent = numbers.format(new Date().getFullYear());

  // Controls stay mounted so going back never loses entered values.
  function showStep(next) {
    if (sending) return;
    const reverse = next < current;
    screens.forEach((screen, index) => {
      screen.hidden = index !== next;
      screen.classList.toggle('reverse', reverse && index === next);
    });
    steps.forEach((step, index) => {
      step.classList.toggle('done', index < next);
      if (index === next) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    current = next;
    app.dataset.step = String(next);
    const heading = screens[next].querySelector('h1');
    heading.focus({ preventScroll: true });
    if (heading.getBoundingClientRect().top < 0) app.scrollIntoView({ block: 'start' });
    const titles = ['يلا بينا يا باشا!', 'اسمك إيه يا نجم؟', 'رقمك كام؟', 'عايز بالو يجيبلك إيه؟', 'طلبك وصل يا معلم!'];
    document.title = `${titles[next]} — بالو`;
  }
  function normalisePhone(value) {
    return value.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).trim();
  }
  function validationMessage(field) {
    const value = field.id === 'phone' ? normalisePhone(field.value) : field.value.trim();
    if (field.id === 'name' && (value.length < 2 || value.length > 100)) return 'اكتب اسمك من حرفين لـ ١٠٠ حرف يا نجم.';
    if (field.id === 'phone' && (value.length < 6 || value.length > 25 || !/^[+\d\s()\-]+$/.test(value) || value.replace(/\D/g, '').length < 6)) return 'اكتب رقم تليفون صحيح يا باشا، زي ٠١٠١٢٣٤٥٦٧٨.';
    if (field.id === 'orderInfo' && (value.length < 3 || value.length > 2000)) return 'قول لبالو محتاج إيه في ٣ حروف على الأقل، ولحد ٢٠٠٠ حرف.';
    return '';
  }
  function validate(field, focus = true) {
    const message = validationMessage(field);
    document.getElementById(`${field.id}-error`).textContent = message;
    field.setAttribute('aria-invalid', String(Boolean(message)));
    if (message && focus) field.focus();
    return !message;
  }
  fields.forEach(field => {
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') validate(field, false);
      submitError.hidden = true;
      if (field.id === 'orderInfo') document.getElementById('character-count').textContent = `${numbers.format(field.value.length)} / ٢٠٠٠`;
    });
    field.addEventListener('blur', () => { if (field.value.trim()) validate(field, false); });
  });
  document.getElementById('start-btn').addEventListener('click', () => showStep(1));
  document.querySelectorAll('.back').forEach(button => button.addEventListener('click', () => showStep(Math.max(0, current - 1))));
  document.getElementById('again-btn').addEventListener('click', () => {
    form.reset();
    fields.forEach(field => {
      field.removeAttribute('aria-invalid');
      document.getElementById(`${field.id}-error`).textContent = '';
    });
    document.getElementById('character-count').textContent = '٠ / ٢٠٠٠';
    submitError.hidden = true;
    showStep(1);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || current < 1 || current > 3) return;
    if (!validate(fields[current - 1])) return;
    if (current < 3) return showStep(current + 1);
    const invalid = fields.find(field => Boolean(validationMessage(field)));
    if (invalid) { showStep(fields.indexOf(invalid) + 1); validate(invalid); return; }
    const payload = { name: fields[0].value.trim(), phone: normalisePhone(fields[1].value), orderInfo: fields[2].value.trim() };
    sending = true;
    form.setAttribute('aria-busy', 'true');
    submitError.hidden = true;
    submitLabel.textContent = 'بنبعت طلبك…';
    form.querySelectorAll('button, input, textarea').forEach(control => { control.disabled = true; });
    let confirmed = false;
    let orderId;
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      let data;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok) {
        const messages = { 400: 'راجع بياناتك يا باشا، فيه حاجة محتاجة تتظبط.', 413: 'تفاصيل الطلب طويلة شوية. اختصرها وجرب تاني.', 429: 'طلبات كتير في وقت قليل يا نجم. استنى شوية وجرب تاني.' };
        throw new Error(messages[response.status] || 'فيه مشكلة في إرسال الطلب. جرب تاني بعد شوية.');
      }
      if (data?.success !== true) throw new Error('مش قادرين نأكد وصول طلبك دلوقتي. جرب تاني بعد شوية.');
      confirmed = true;
      orderId = data.orderId;
    } catch (error) {
      submitError.textContent = error instanceof TypeError ? 'الاتصال اتقطع ومش قادرين نأكد وصول طلبك. اتأكد من النت قبل ما تحاول تاني.' : error.message;
      submitError.hidden = false;
    } finally {
      sending = false;
      form.removeAttribute('aria-busy');
      form.querySelectorAll('button, input, textarea').forEach(control => { control.disabled = false; });
      submitLabel.textContent = 'ابعت لبالو';
    }
    if (confirmed) {
      const receipt = document.getElementById('receipt');
      const safeId = String(orderId ?? '');
      receipt.hidden = !/^\d{1,20}$/.test(safeId);
      receipt.textContent = receipt.hidden ? '' : `رقم طلبك: ${safeId.replace(/\d/g, digit => numbers.format(Number(digit)))}`;
      showStep(4);
    }
  });
})();
