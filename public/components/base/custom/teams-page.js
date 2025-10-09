// public/components/base/custom/teams-page.js
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || null;

  // --- helpers ---
  function toast(msg, type = 'info') { console.log(`[${type}]`, msg); }
  function apiHeaders(json = true) {
    const base = {};
    if (csrf) base['X-CSRF-Token'] = csrf;
    if (json) base['Content-Type'] = 'application/json';
    return base;
  }
  function setBusy(el, on = true) {
    if (!el) return;
    el.disabled = on;
    el.classList.toggle('disabled', on);
  }
  function ensureBootstrap() {
    window.bootstrap = window.bootstrap || {};
    return window.bootstrap;
  }

  async function patchTeam(teamId, patchObj) {
    const r = await fetch(`/teams/${teamId}`, {
      method: 'PATCH',
      headers: apiHeaders(true),
      credentials: 'include',
      body: JSON.stringify(patchObj)
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status} ${txt || ''}`);
    }
    return r.json();
  }

  // --- modals open ---
  function openRenameModal(teamId, teamName) {
    $('#renameTeamId').value = teamId;
    $('#renameTeamName').value = teamName || '';
    const m = new (ensureBootstrap().Modal)($('#renameTeamModal'));
    m.show();
  }

  function openArchiveModal(teamId, teamName) {
    $('#archiveTeamId').value = teamId;
    $('#archiveTeamName').textContent = teamName || '';
    const m = new (ensureBootstrap().Modal)($('#archiveTeamModal'));
    m.show();
  }

  function openCreateTeamModal() {
    // Поля заповнюємо, опції тімлідів — вже SSR
    $('#teamName').value = '';
    const dept = $('#teamDept');
    if (dept && !dept.value) dept.value = dept.options?.[0]?.value || '';
    const m = new (ensureBootstrap().Modal)($('#teamModal'));
    m.show();
  }

  // --- actions ---
  async function createTeam() {
    const name = $('#teamName')?.value?.trim();
    const department = $('#teamDept')?.value;
    const lead = $('#teamLead')?.value;

    if (!name || !department || !lead) {
      toast('Заповніть назву, департамент і тімліда', 'warning');
      return;
    }

    try {
      setBusy($('#teamCreateBtn'), true);
      const r = await fetch('/teams', {
        method: 'POST',
        headers: apiHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ name, department, lead })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // перезавантажимо сторінку, щоб побачити нову команду
      location.reload();
    } catch (e) {
      console.error(e);
      toast('Не вдалося створити команду', 'error');
    } finally {
      setBusy($('#teamCreateBtn'), false);
    }
  }

  async function submitRename() {
    const id = $('#renameTeamId')?.value;
    const name = $('#renameTeamName')?.value?.trim();
    if (!id || !name) return toast('Вкажіть назву', 'warning');
    try {
      setBusy($('#renameTeamSaveBtn'), true);
      await patchTeam(id, { name });
      location.reload();
    } catch (e) {
      console.error(e);
      toast('Помилка перейменування', 'error');
    } finally {
      setBusy($('#renameTeamSaveBtn'), false);
    }
  }

  async function submitArchive() {
    const id = $('#archiveTeamId')?.value;
    if (!id) return;
    try {
      setBusy($('#archiveTeamConfirm'), true);
      await patchTeam(id, { isActive: false });
      location.reload();
    } catch (e) {
      console.error(e);
      toast('Не вдалося архівувати команду', 'error');
    } finally {
      setBusy($('#archiveTeamConfirm'), false);
    }
  }

  // --- init ---
  document.addEventListener('DOMContentLoaded', () => {
    // кнопки в карточках
    $$('.js-team-rename').forEach(btn => {
      btn.addEventListener('click', () => openRenameModal(btn.dataset.teamId, btn.dataset.teamName));
    });
    $$('.js-team-archive').forEach(btn => {
      btn.addEventListener('click', () => openArchiveModal(btn.dataset.teamId, btn.dataset.teamName));
    });

    // створення команди (кнопка в хедері)
    $('#newTeamBtn')?.addEventListener('click', openCreateTeamModal);
    $('#teamCreateBtn')?.addEventListener('click', createTeam);

    // сабміти модалок редагування/архівації
    $('#renameTeamSaveBtn')?.addEventListener('click', submitRename);
    $('#archiveTeamConfirm')?.addEventListener('click', submitArchive);
  });
})();
