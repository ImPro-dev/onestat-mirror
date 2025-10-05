// public/js/teams-tree.js
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || null;
  const ROOT_DEPARTMENT =
    document.getElementById('teamsTree')?.dataset.department || 'Media Buying';

  const API = {
    tree: (department) => `/teams/tree?department=${encodeURIComponent(department)}`,
    management: (department) => `/admin/users/management?department=${encodeURIComponent(department)}`,
    patchUser: (id) => `/admin/users/${id}/roles`,
    patchTeam: (id) => `/teams/${id}`,
  };

  const HEAD_ICONS = {
    rename: '✏️',
    archive: '🗄️',
    addAssistant: '➕ Асистента',
    remove: '✖',
    move: '⇄',
  };

  let STATE = {
    department: 'Media Buying',
    tree: null,             // { department, teams: [...] }
    users: [],              // users of department (from management endpoint)
    teamsOptions: [],       // [{_id,name}]
    departments: [],        // [{value,label}]
    isMediaBuying: true,
  };

  // ---- helpers ----
  function fetchJSON(url, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, csrf ? { 'X-CSRF-Token': csrf } : {});
    return fetch(url, Object.assign({ headers, credentials: 'include' }, opts)).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function toast(msg, type = 'info') {
    // TODO: інтегрувати з вашим flash/toast
    console.log(`[${type}]`, msg);
  }
  function optionElems(options, valueKey = 'value', labelKey = 'label') {
    const frag = document.createDocumentFragment();
    options.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o[valueKey];
      opt.textContent = o[labelKey];
      frag.appendChild(opt);
    });
    return frag;
  }
  function teamOptions(teams) {
    const frag = document.createDocumentFragment();
    teams.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t._id;
      opt.textContent = t.name;
      frag.appendChild(opt);
    });
    return frag;
  }
  const fullNameOf = (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || String(u._id);

  function usersOptionsByDept(users, dept) {
    const frag = document.createDocumentFragment();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— оберіть користувача —';
    frag.appendChild(empty);

    users
      .filter(u => u.department === dept)
      // не пропонуємо лідерів як асистентів
      .filter(u => u.teamRole !== 'lead')
      .sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b)))
      .forEach(u => {
        const role = u.teamRole || '';
        const opt = document.createElement('option');
        opt.value = u._id;
        opt.textContent = `${fullNameOf(u)}${role ? ` — ${role}` : ''}`;
        frag.appendChild(opt);
      });

    return frag;
  }
  function personRow(label, user, actions = []) {
    const row = document.createElement('div');
    row.className = 'd-flex align-items-start gap-2 py-1';

    const badge = document.createElement('span');
    badge.className = 'badge bg-secondary';
    badge.textContent = label;

    const name = document.createElement('div');
    name.className = 'flex-grow-1';
    const fullName = user ? fullNameOf(user) : '—';
    const webId = user?.webId || '';
    const showWeb = STATE.isMediaBuying && (label === 'Тімлід' || label === 'Баєр') && !!webId;
    name.innerHTML = `<div class="fw-semibold">${fullName}</div>` + (showWeb ? `<div class="text-muted small">WebID: ${webId}</div>` : '');

    const btns = document.createElement('div');
    btns.className = 'd-flex gap-2';
    actions.forEach(a => btns.appendChild(a));

    row.appendChild(badge);
    row.appendChild(name);
    row.appendChild(btns);
    return row;
  }
  function actionBtn(text, variant = 'outline-secondary') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn btn-sm btn-${variant}`;
    b.textContent = text;
    return b;
  }
  function smallMuted(text) {
    const el = document.createElement('div');
    el.className = 'text-muted small';
    el.textContent = text;
    return el;
  }

  // ---- render team card ----
  function renderTeamCard(bucket) {
    const card = document.createElement('div');
    card.className = 'card shadow-sm';
    const body = document.createElement('div');
    body.className = 'card-body';
    card.appendChild(body);

    // header: team name + actions
    const head = document.createElement('div');
    head.className = 'd-flex justify-content-between align-items-center mb-2';
    const title = document.createElement('div');
    title.innerHTML = `<span class="h5 mb-0">${bucket.team.name}</span>`;
    const headBtns = document.createElement('div');
    headBtns.className = 'd-flex gap-2';

    // rename
    const btnRename = actionBtn(HEAD_ICONS.rename, 'outline-primary');
    btnRename.addEventListener('click', () => openRenameTeamModal(bucket.team._id, bucket.team.name));

    // archive
    const btnArchive = actionBtn(HEAD_ICONS.archive, 'outline-danger');
    btnArchive.addEventListener('click', () => archiveTeam(bucket.team._id));

    headBtns.appendChild(btnRename);
    headBtns.appendChild(btnArchive);
    head.appendChild(title);
    head.appendChild(headBtns);
    body.appendChild(head);

    // lead row + add assistant to lead
    const leadActions = [];
    const btnAddAsstLead = actionBtn(HEAD_ICONS.addAssistant, 'outline-success');
    btnAddAsstLead.addEventListener('click', () => openAddAssistantModal((bucket.lead?._id) || bucket.team.lead));
    leadActions.push(btnAddAsstLead);

    body.appendChild(personRow('Тімлід', bucket.lead || null, leadActions));
    body.appendChild(smallMuted('Асистенти тімліда:'));
    // assistants of lead
    const leadAsstList = document.createElement('div');
    leadAsstList.className = 'ms-4';
    (bucket.assistantsOfLead || []).forEach(a => {
      const btnRemove = actionBtn(HEAD_ICONS.remove, 'outline-danger');
      btnRemove.addEventListener('click', () => removeAssistant(a._id));
      leadAsstList.appendChild(personRow('Асистент', a, [btnRemove]));
    });
    if (!bucket.assistantsOfLead?.length) {
      leadAsstList.appendChild(smallMuted('— немає —'));
    }
    body.appendChild(leadAsstList);

    // buyers + assistants
    const buyersWrap = document.createElement('div');
    buyersWrap.className = 'mt-3';
    buyersWrap.appendChild(smallMuted('Баєри команди:'));
    (bucket.buyers || []).forEach(({ buyer, assistants }) => {
      // actions: move buyer, add assistant for buyer
      const act = [];

      const moveWrap = document.createElement('div');
      moveWrap.className = 'd-flex align-items-center gap-2';
      const sel = document.createElement('select');
      sel.className = 'form-select form-select-sm';
      sel.style.minWidth = '180px';
      sel.appendChild(teamOptions(STATE.teamsOptions));
      sel.value = String(bucket.team._id);
      const btnMove = actionBtn(HEAD_ICONS.move, 'outline-primary');
      btnMove.addEventListener('click', () => {
        const target = sel.value;
        if (!target || target === String(bucket.team._id)) {
          return toast('Оберіть іншу команду', 'warning');
        }
        moveBuyer(buyer._id, target);
      });
      moveWrap.appendChild(sel);
      moveWrap.appendChild(btnMove);
      act.push(moveWrap);

      const btnAddAsstBuyer = actionBtn(HEAD_ICONS.addAssistant, 'outline-success');
      btnAddAsstBuyer.addEventListener('click', () => openAddAssistantModal(buyer._id));
      act.push(btnAddAsstBuyer);

      buyersWrap.appendChild(personRow('Баєр', buyer, act));

      const asstList = document.createElement('div');
      asstList.className = 'ms-4';
      (assistants || []).forEach(a => {
        const btnRemove = actionBtn(HEAD_ICONS.remove, 'outline-danger');
        btnRemove.addEventListener('click', () => removeAssistant(a._id));
        asstList.appendChild(personRow('Асистент', a, [btnRemove]));
      });
      if (!assistants?.length) {
        asstList.appendChild(smallMuted('— немає —'));
      }
      buyersWrap.appendChild(asstList);
    });
    if (!(bucket.buyers || []).length) {
      buyersWrap.appendChild(smallMuted('— немає баєрів у команді —'));
    }
    body.appendChild(buyersWrap);

    return card;
  }

  // ---- API calls ----
  function setBusy(el, busy = true) {
    if (!el) return;
    el.disabled = busy;
    el.classList.toggle('disabled', busy);
  }
  async function patchUser(userId, patchObj) {
    // приймаємо лише канонічні ключі: team, assistantOf, teamRole, ...
    const headers = Object.assign({ 'Content-Type': 'application/json' }, csrf ? { 'X-CSRF-Token': csrf } : {});
    const r = await fetch(API.patchUser(userId), { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify(patchObj) });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status} ${txt || ''}`);
    }
    return r.json();
  }
  async function patchTeam(teamId, patchObj) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, csrf ? { 'X-CSRF-Token': csrf } : {});
    const r = await fetch(API.patchTeam(teamId), { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify(patchObj) });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status} ${txt || ''}`);
    }
    return r.json();
  }

  // ---- actions ----
  async function renameTeam(teamId, newName) {
    await patchTeam(teamId, { name: newName });
    toast('Назву змінено', 'success');
    await load(STATE.department);
  }
  async function archiveTeam(teamId) {
    await patchTeam(teamId, { isActive: false });
    toast('Команду архівовано', 'success');
    await load(STATE.department);
  }
  async function moveBuyer(userId, targetTeamId) {
    // buyer має бути member та мати team
    await patchUser(userId, { teamRole: 'member', team: targetTeamId });
    toast('Баєра перенесено', 'success');
    await load(STATE.department);
  }
  async function addAssistant(supervisorId, userId) {
    // assistant наслідує команду керівника
    await patchUser(userId, { teamRole: 'assistant', assistantOf: supervisorId });
    toast('Асистента призначено', 'success');
    await load(STATE.department);
  }
  async function removeAssistant(userId) {
    // прибираємо роль — бек очистить assistantOf/team
    await patchUser(userId, { teamRole: null });
    toast('Асистента знято', 'success');
    await load(STATE.department);
  }

  // ---- modals ----
  function openRenameTeamModal(teamId, currentName) {
    $('#renameTeamId').value = teamId;
    $('#renameTeamName').value = currentName || '';
    const modal = new bootstrap.Modal($('#renameTeamModal'));
    modal.show();
  }
  function openAddAssistantModal(supervisorId) {
    $('#assistantSupervisorId').value = supervisorId;
    // populate candidates
    const sel = $('#assistantCandidate');
    sel.innerHTML = '';
    sel.appendChild(usersOptionsByDept(STATE.users, STATE.department));
    const modal = new bootstrap.Modal($('#addAssistantModal'));
    modal.show();
  }

  // ---- page rendering ----
  function renderTree() {
    const el = $('#teamsTree');
    el.innerHTML = '';
    if (!STATE.tree?.teams?.length) {
      el.appendChild(smallMuted('У цьому департаменті ще немає активних команд.'));
      return;
    }
    STATE.tree.teams.forEach(bucket => {
      el.appendChild(renderTeamCard(bucket));
    });
  }

  // ---- data loading ----
  async function load(dept) {
    // дерево
    const tree = await fetchJSON(API.tree(dept));
    STATE.tree = tree;
    STATE.department = tree.department;
    STATE.isMediaBuying = (STATE.department === 'Media Buying');

    // опції/кандидати
    const mgmt = await fetchJSON(API.management(dept));
    STATE.users = mgmt.users || [];
    STATE.teamsOptions = (mgmt.options?.teams || []).map(t => ({ _id: t._id, name: t.name }));
    STATE.departments = mgmt.options?.departments || [];

    renderTree();
  }

  // ---- init ----
  document.addEventListener('DOMContentLoaded', () => {
    // підключи bootstrap у layout
    window.bootstrap = window.bootstrap || {};

    $('#renameTeamSaveBtn')?.addEventListener('click', async () => {
      const id = $('#renameTeamId').value;
      const name = $('#renameTeamName').value.trim();
      if (!id || !name) return toast('Вкажіть назву', 'warning');
      try {
        setBusy($('#renameTeamSaveBtn'), true);
        await renameTeam(id, name);
        bootstrap.Modal.getInstance($('#renameTeamModal')).hide();
      } catch (e) {
        console.error(e); toast('Помилка перейменування', 'error');
      } finally { setBusy($('#renameTeamSaveBtn'), false); }
    });

    $('#addAssistantSaveBtn')?.addEventListener('click', async () => {
      const sup = $('#assistantSupervisorId').value;
      const userId = $('#assistantCandidate').value;
      if (!sup || !userId) return toast('Оберіть користувача', 'warning');
      try {
        setBusy($('#addAssistantSaveBtn'), true);
        await addAssistant(sup, userId);
        bootstrap.Modal.getInstance($('#addAssistantModal')).hide();
      } catch (e) {
        console.error(e); toast('Помилка призначення', 'error');
      } finally { setBusy($('#addAssistantSaveBtn'), false); }
    });

    load(ROOT_DEPARTMENT).catch(err => {
      console.error(err);
      toast('Помилка завантаження даних', 'error');
    });
  });
})();
