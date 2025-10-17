'use strict';

/* EN-only comments per project rules
 * AJAX submit for offer isActive toggles confirmed via dynamic-modal.
 * Works with forms: form.js-offer-toggle[action="/offers/:id/active"]
 */
(function () {
  const csrf = window.csrfToken || null;

  function handleSubmit(form, evt) {
    if (!form || !form.classList.contains('js-offer-toggle')) return;
    if (evt) { evt.preventDefault(); evt.stopPropagation(); }

    const action = form.getAttribute('action') || '';
    const m = action.match(/\/offers\/([^/]+)\/active$/);
    if (!m) return;

    const checkbox = form.querySelector('input.custom-control-input');
    const hidden = form.querySelector('input[name="isActive"]');
    const nextValue = checkbox ? !checkbox.checked : (hidden && hidden.value === 'true');
    const payload = { isActive: !!nextValue };

    fetch(action, {
      method: 'POST',
      headers: Object.assign(
        { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        csrf ? { 'X-CSRF-Token': csrf } : {}
      ),
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(data => {
        if (!data || !data.success) throw new Error((data && data.message) || 'Update failed');
        if (checkbox) checkbox.checked = payload.isActive;
        const row = form.closest('tr');
        if (row) row.style.opacity = payload.isActive ? '1' : '0.3';
      })
      .catch(err => {
        console.error(err);
        alert('Не вдалося оновити статус. Спробуйте ще раз.');
      });
  }

  // Native submit (non-jQuery) — fallback path
  document.addEventListener('submit', function (e) {
    const form = e.target;
    handleSubmit(form, e);
  }, true);

  // jQuery-triggered submit (dynamic-modal uses $form.trigger('submit')) — fallback path
  if (window.jQuery) {
    window.jQuery(document).on('submit', 'form.js-offer-toggle', function (e) {
      handleSubmit(this, e);
    });

    // Primary path: intercept modal "Так" and do AJAX directly, cancel default modal handler
    window.jQuery(document).on('click', '[data-modal-confirm]', function (e) {
      try {
        const $modal = window.jQuery('#modal-dynamic');
        const $trigger = $modal.data('confirm-trigger'); // set by dynamic-modal init
        if (!$trigger || !$trigger.length) return;

        const $form = $trigger.closest('form');
        if (!$form || !$form.length || !$form.hasClass('js-offer-toggle')) return;

        // Block modal's default confirm handler (navigation or $form.trigger('submit'))
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();

        // Do AJAX directly
        handleSubmit($form.get(0), e);

        // Close modal
        if ($modal.modal) $modal.modal('hide');
        return false;
      } catch (_) { /* ignore */ }
    });
  }
})();
