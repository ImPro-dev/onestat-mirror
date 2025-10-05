// public/components/base/custom/teams-management.js
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || null;
  const DEPT = document.getElementById('usersTable')?.dataset.department || 'Media Buying';

  const API = {
    management: (department) => `/admin/users/management?department=${encodeURIComponent(department)}`,
    patchUser: (id) => `/admin/users/${id}/roles`,
    createTeam: `/teams`,
  };

  const STATE = { users: [], teams: [] };

  function toast(msg, type = 'info') { console.log(`[${type}]`, msg); }

  function fetchJSON(url, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, csrf ? { 'X-CSRF-Token': csrf } : {});
    return fetch(url, Object.assign({ headers, credentials: 'include' }, opts)).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function getField(row, name) { return row.querySelector(`[data-field="${name}"]`); }

  function setStatus($status, text, cls) {
    if (!$status) return;
    $status.textContent = text;
    $status.classList.remove('text-success', 'text-danger', 'text-info', 'text-muted');
    if (cls) $status.classList.add(cls);
  }

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

  // будуємо список супервізорів: усі ліди/баєри; ті, хто без команди — disabled
  function buildSupervisorOptions(selectedValue) {
    const frag = document.createDocumentFragment();

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— не вибрано —';
    frag.appendChild(empty);

    const people = STATE.users
      .filter(u => u.teamRole === 'lead' || u.teamRole === 'member')
      .map(u => ({
        id: u._id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u._id,
        team: u.team || null
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    people.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + (p.team ? '' : ' (без команди)');
      opt.dataset.team = p.team ? String(p.team) : '';
      if (!p.team) opt.disabled = true;               // без команди — не дозволяємо вибір
      if (selectedValue && String(selectedValue) === String(p.id)) opt.selected = true;
      frag.appendChild(opt);
    });

    return frag;
  }

  function refreshAllSupervisorSelects() {
    $$('#usersTable tbody tr').forEach(row => {
      const selSup = getField(row, 'assistantOf');
      if (!selSup) return;
      const current = selSup.value || '';
      selSup.innerHTML = '';
      selSup.appendChild(buildSupervisorOptions(current));
    });
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
    const headers = Object.assign({ 'Content-Type': 'application/json' }, csrf ? { 'X-CSRF-Token': csrf } : {});
    try {
      setStatus($status, 'Збереження…', 'text-info');
      const r = await fetch(API.patchUser(userId), {
        method: 'PATCH',
        headers,
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

  // зберігаємо "попереднє значення" для селектів, щоб відкотити у разі помилки
  document.addEventListener('focusin', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('js-field')) return;
    el.dataset.prev = el.value || '';
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (!el.classList.contains('js-field')) return;

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
        // повернемо попереднє значення
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
      // якщо вибраний супервізор без команди — не відправляємо на бек
      const opt = el.selectedOptions && el.selectedOptions[0];
      const supTeam = opt ? (opt.dataset.team || '') : '';
      if (value && !supTeam) {
        setStatus($status, 'Спочатку призначте команду супервізору', 'text-danger');
        // відкотити вибір
        el.value = el.dataset.prev || '';
        return;
      }
      payload.assistantOf = value || null;
    }

    const revert = () => { if (el) el.value = el.dataset.prev || ''; };
    patchUser(userId, payload, $status, field, revert);
  });

  function openCreateTeamModal() {
    $('#teamName').value = '';
    $('#teamDept').value = DEPT;
    const leadSel = $('#teamLead');
    if (leadSel) {
      leadSel.innerHTML = '';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '— оберіть тімліда —';
      leadSel.appendChild(empty);

      const candidates = STATE.users.slice().sort((a, b) => {
        const an = (`${a.firstName || ''} ${a.lastName || ''}`).trim();
        const bn = (`${b.firstName || ''} ${b.lastName || ''}`).trim();
        return an.localeCompare(bn);
      });
      candidates.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u._id;
        const name = (`${u.firstName || ''} ${u.lastName || ''}`).trim() || u.email || u._id;
        opt.textContent = name;
        leadSel.appendChild(opt);
      });
    }
    const modal = new bootstrap.Modal($('#teamModal'));
    modal.show();
  }

  async function createTeam() {
    const name = $('#teamName').value.trim();
    const dept = $('#teamDept').value;
    const lead = $('#teamLead').value;
    if (!name || !dept || !lead) return toast('Заповніть назву, департамент і тімліда', 'warning');

    const headers = Object.assign({ 'Content-Type': 'application/json' }, csrf ? { 'X-CSRF-Token': csrf } : {});
    try {
      const r = await fetch(API.createTeam, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ name, department: dept, lead })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      location.reload();
    } catch (e) {
      console.error(e);
      toast('Не вдалося створити команду', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const data = await fetchJSON(API.management(DEPT));
      STATE.users = data.users || [];
      STATE.teams = data.options?.teams || [];
      refreshAllSupervisorSelects();
    } catch (e) {
      console.warn('Management preload failed:', e);
    }

    $$('#usersTable tbody tr').forEach(applyUiRules);

    const btnCreate = $('#newTeamBtn');
    if (btnCreate) btnCreate.addEventListener('click', openCreateTeamModal);
    const btnCreateSubmit = $('#teamCreateBtn');
    if (btnCreateSubmit) btnCreateSubmit.addEventListener('click', createTeam);
  });
})();
