// public/components/base/custom/teams-management.js
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || null;
  const DEPT = document.getElementById('usersTable')?.dataset.department || 'Media Buying';

  const API = {
    patchUser: (id) => `/admin/users/${id}/roles`,
  };

  function toast(msg, type = 'info') { console.log(`[${type}]`, msg); }
  function apiHeaders(json = true) {
    const base = {};
    if (csrf) base['X-CSRF-Token'] = csrf;
    if (json) base['Content-Type'] = 'application/json';
    return base;
  }

  function getField(row, name) { return row.querySelector(`[data-field="${name}"]`); }

  function setStatus($status, text, cls) {
    if (!$status) return;
    $status.textContent = text;
    $status.classList.remove('text-success', 'text-danger', 'text-info', 'text-muted');
    if (cls) $status.classList.add(cls);
  }

  // Керує дизейблом полів залежно від ролей
  function applyUiRules(row) {
    const orgRole = getField(row, 'orgRole')?.value || null;
    const deptRole = getField(row, 'deptRole')?.value || null;
    const teamRole = getField(row, 'teamRole')?.value || null;

    const selDeptRole = getField(row, 'deptRole');
    const selTeamRole = getField(row, 'teamRole');
    const selTeam = getField(row, 'team');
    const selSup = getField(row, 'assistantOf');
    const inputWeb = getField(row, 'webId');

    const isAdmin = (orgRole === 'admin');
    const isHead = (!isAdmin && deptRole === 'head');

    if (selDeptRole) selDeptRole.disabled = isAdmin;
    if (selTeamRole) selTeamRole.disabled = isAdmin || isHead;
    if (selTeam) selTeam.disabled = isAdmin || isHead || !(teamRole === 'lead' || teamRole === 'member');
    if (selSup) selSup.disabled = isAdmin || isHead || !(teamRole === 'assistant');

    const canWeb = (DEPT === 'Media Buying') && (teamRole === 'lead' || teamRole === 'member') && !isAdmin && !isHead;
    if (inputWeb) inputWeb.disabled = !canWeb;
  }

  function applyPatchResultToRow(row, user, touchedField) {
    const setVal = (name, v) => {
      const el = getField(row, name);
      if (el) el.value = (v == null ? '' : String(v));
    };

    switch (touchedField) {
      case 'orgRole':
        setVal('orgRole', user.orgRole);
        if (user.orgRole === 'admin') {
          ['deptRole', 'teamRole', 'team', 'assistantOf', 'webId'].forEach(f => setVal(f, null));
        }
        break;

      case 'deptRole':
        setVal('deptRole', user.deptRole);
        if (user.deptRole === 'head') {
          ['teamRole', 'team', 'assistantOf', 'webId'].forEach(f => setVal(f, null));
        }
        break;

      case 'teamRole':
        setVal('teamRole', user.teamRole);
        if (user.teamRole === 'lead' || user.teamRole === 'member') {
          setVal('assistantOf', null);
          if ('team' in user) setVal('team', user.team);
        } else if (user.teamRole === 'assistant') {
          if ('assistantOf' in user) setVal('assistantOf', user.assistantOf);
          if ('team' in user) setVal('team', user.team);
          setVal('webId', null);
        } else {
          ['team', 'assistantOf', 'webId'].forEach(f => setVal(f, null));
        }
        break;

      case 'team':
        setVal('team', user.team);
        if (user.teamRole === 'lead') setVal('assistantOf', null);
        break;

      case 'assistantOf':
        setVal('assistantOf', user.assistantOf);
        if ('team' in user) setVal('team', user.team);
        break;

      case 'webId':
        setVal('webId', user.webId);
        break;
    }

    applyUiRules(row);
  }

  function applyOptimistic(row, field, value) {
    const el = getField(row, field);
    if (!el) return;
    el.value = (value == null ? '' : String(value));
    applyUiRules(row);
  }

  async function patchUser(userId, payload, $status, touchedField, onErrorRevert) {
    try {
      setStatus($status, 'Збереження…', 'text-info');
      const r = await fetch(API.patchUser(userId), {
        method: 'PATCH',
        headers: apiHeaders(true),
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok || data.ok === false) {
        const msg = data?.message || data?.error || `HTTP ${r.status}`;
        throw new Error(msg);
      }
      const row = document.querySelector(`tr[data-user-id="${userId}"]`);
      if (row) applyPatchResultToRow(row, data.user || {}, touchedField);
      setStatus($status, 'Збережено', 'text-success');
    } catch (e) {
      console.error(e);
      if (typeof onErrorRevert === 'function') onErrorRevert();
      setStatus($status, e.message || 'Помилка', 'text-danger');
      toast('Помилка збереження. Перевірте дані.', 'error');
    }
  }

  // Зберігаємо попереднє значення для простого rollback
  document.addEventListener('focusin', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('js-field')) return;
    el.dataset.prev = el.value || '';
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('js-field')) return;

    const row = el.closest('tr[data-user-id]');
    if (!row) return;
    const userId = row.getAttribute('data-user-id');
    const field = el.getAttribute('data-field');
    const $status = row.querySelector('.js-status');

    let value = el.value;
    const payload = {};

    if (field === 'webId') {
      const digits = String(value || '').replace(/\D/g, '');
      if (digits.length === 0) {
        value = null;
      } else if (digits.length !== 3) {
        setStatus($status, 'WebID: рівно 3 цифри', 'text-danger');
        el.value = el.dataset.prev || '';
        return;
      } else {
        value = digits;
      }
      payload.webId = value;

    } else if (field === 'orgRole') {
      payload.orgRole = value || null;

    } else if (field === 'deptRole') {
      value = value || null;
      payload.deptRole = value;
      applyOptimistic(row, 'deptRole', value);

    } else if (field === 'teamRole') {
      payload.teamRole = value || null;

    } else if (field === 'team') {
      payload.team = value || null;

    } else if (field === 'assistantOf') {
      // Клієнтська перевірка на наявність команди у наставника забрана — бек валідатор усе перевірить
      payload.assistantOf = value || null;
    }

    const revert = () => { if (el) el.value = el.dataset.prev || ''; };
    patchUser(userId, payload, $status, field, revert);
  });

  document.addEventListener('DOMContentLoaded', () => {
    // Ініціалізуємо правила доступності інпутів
    $$('#usersTable tbody tr').forEach(applyUiRules);
  });
})();
