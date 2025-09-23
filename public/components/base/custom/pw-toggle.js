// public/js/pw-toggle.js
(function () {
  // Делегування подій: працює на всіх сторінках без дублю коду
  function toggle(btn) {
    var sel = btn.getAttribute('data-target');
    var input = sel ? document.querySelector(sel) : null;

    // fallback: якщо data-target не заданий, шукаємо input у межах .input-group
    if (!input) {
      var group = btn.closest('.input-group');
      if (group) input = group.querySelector('input[type="password"], input[type="text"]');
    }
    if (!input) return;

    var toPassword = input.type === 'text';
    input.type = toPassword ? 'password' : 'text';

    // міняємо іконку, якщо є
    var icon = btn.querySelector('span');
    if (icon) {
      icon.classList.toggle('linearicons-eye', toPassword);
      icon.classList.toggle('linearicons-eye-crossed', !toPassword);
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-toggle="pw"]');
    if (!btn) return;
    e.preventDefault();
    toggle(btn);
  }, false);
})();
