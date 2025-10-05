// controllers/teamsController.js
'use strict';

const mongoose = require('mongoose');
const Team = require('../models/Team');
const User = require('../models/User');
const enumsService = require('../services/enumsService');
const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');

// ---- helpers ----
function getActor(req) {
  const raw = req.session?.user || req.user || null;
  if (!raw) return null;
  return {
    ...raw,
    orgrole: raw.orgrole ?? raw.orgRole ?? null,
    teamrole: raw.teamrole ?? raw.teamRole ?? null,
    deptrole: raw.deptrole ?? raw.deptRole ?? null,
    department: raw.department ?? raw.dept ?? null,
  };
}

function assertHeadDepartment(actor, department) {
  if (!actor) return;
  if ((actor.deptrole === 'head') && actor.department && department && actor.department !== department) {
    const err = new Error('Forbidden: head can manage only own department');
    err.status = 403;
    throw err;
  }
}

function getActorFlags(req, res) {
  // 1) пріоритетно беремо з res.locals (твій існуючий middleware)
  if (res?.locals) {
    const isAdmin = !!res.locals.isAdmin;
    const isManager = !!res.locals.isManager && !isAdmin;
    return { isAdmin, isManager };
  }
  // 2) фолбек по scopes (раптом локалі не виставлені)
  const user = req.session?.user || req.user || null;
  const set = new Set(getUserScopes(user));
  const isAdmin = set.has(SCOPES.INTEGRATIONS_ADMIN);       // у вашому мапінгу адмін має всі скоупи
  const isManager = !isAdmin && set.has(SCOPES.TEAMS_WRITE_ANY);
  return { isAdmin, isManager };
}

// =======================================================
// POST /teams
// body: { name: string, department: string, lead: ObjectId }
// =======================================================
async function createTeam(req, res, next) {
  try {
    const { name, department, lead } = req.body || {};
    if (!name || !department || !lead) {
      return res.status(400).json({ error: 'name, department, lead are required' });
    }
    if (!mongoose.isValidObjectId(lead)) {
      return res.status(400).json({ error: 'Invalid lead id' });
    }

    const actor = getActor(req);
    assertHeadDepartment(actor, String(department).trim());

    const leadUser = await User.findById(lead).select('_id department').lean();
    if (!leadUser) return res.status(400).json({ error: 'Lead user not found' });
    if (leadUser.department !== String(department).trim()) {
      return res.status(400).json({ error: 'Lead department mismatch' });
    }

    const team = await Team.create({
      name: String(name).trim(),
      department: String(department).trim(),
      lead,
      members: [],
      isActive: true,
    });

    return res.json(team);
  } catch (e) { next(e); }
}

// =======================================================
// PATCH /teams/:id
// body: { name?, isActive?, lead? }
// =======================================================
async function updateTeam(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

    const team = await Team.findById(id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const actor = getActor(req);
    assertHeadDepartment(actor, team.department);

    const { name, isActive, lead } = req.body || {};

    if (name !== undefined) team.name = String(name).trim();
    if (isActive !== undefined) team.isActive = Boolean(isActive);

    if (lead !== undefined) {
      if (lead === null) {
        team.lead = null;
      } else {
        if (!mongoose.isValidObjectId(lead)) {
          return res.status(400).json({ error: 'Invalid lead id' });
        }
        const leadUser = await User.findById(lead).select('_id department').lean();
        if (!leadUser) return res.status(400).json({ error: 'Lead user not found' });
        if (leadUser.department !== team.department) {
          return res.status(400).json({ error: 'Lead department mismatch' });
        }
        team.lead = leadUser._id;
      }
    }

    await team.save();
    return res.json(team);
  } catch (e) { next(e); }
}

// =======================================================
// GET /teams/tree?department=Media%20Buying
// Повертає дерево команд департаменту (canonical: team, assistantOf).
// =======================================================
async function getDeptTeamsTree(req, res, next) {
  try {
    const department = (req.query.department || 'Media Buying').trim();
    const actor = getActor(req);
    assertHeadDepartment(actor, department);

    const teams = await Team.find({ department, isActive: true })
      .select('_id name department lead')
      .lean();

    const teamIds = teams.map(t => t._id);

    // беремо канонічні поля: team, assistantOf, teamRole (+ ПІБ для відмальовки)
    const users = await User.find({ department, team: { $in: teamIds } })
      .select('_id firstName lastName teamRole team assistantOf webId')
      .lean();

    const byTeam = new Map(
      teams.map(t => [String(t._id), { team: t, lead: null, buyers: [], assistantsOfLead: [] }])
    );
    const byId = new Map(users.map(u => [String(u._id), u]));

    // lead із users
    for (const u of users) {
      if (u.teamRole === 'lead' && u.team) {
        const bucket = byTeam.get(String(u.team));
        if (bucket) bucket.lead = u;
      }
    }

    // фолбек по team.lead (якщо у юзера ще не оновили role)
    const needFallback = [];
    for (const bucket of byTeam.values()) {
      if (!bucket.lead && bucket.team.lead) needFallback.push(bucket.team.lead);
    }
    if (needFallback.length) {
      const fallbacks = await User.find({ _id: { $in: needFallback } })
        .select('_id firstName lastName teamRole team assistantOf webId')
        .lean();
      const mapFb = new Map(fallbacks.map(x => [String(x._id), x]));
      for (const bucket of byTeam.values()) {
        if (!bucket.lead && bucket.team.lead) {
          const lf = mapFb.get(String(bucket.team.lead));
          if (lf) bucket.lead = lf;
        }
      }
    }

    // buyers
    for (const u of users) {
      if (u.teamRole === 'member' && u.team) {
        const bucket = byTeam.get(String(u.team));
        if (bucket) bucket.buyers.push({ buyer: u, assistants: [] });
      }
    }

    // assistants
    for (const u of users) {
      if (u.teamRole !== 'assistant' || !u.team) continue;
      const bucket = byTeam.get(String(u.team));
      if (!bucket) continue;

      const sup = u.assistantOf ? byId.get(String(u.assistantOf)) : null;
      if (!sup) continue;

      if (sup.teamRole === 'member') {
        const cell = bucket.buyers.find(bx => String(bx.buyer._id) === String(sup._id));
        if (cell) cell.assistants.push(u);
      } else if (sup.teamRole === 'lead') {
        bucket.assistantsOfLead.push(u);
      }
    }

    return res.json({ department, teams: Array.from(byTeam.values()) });
  } catch (e) { next(e); }
}

// =======================================================
// SSR-рендер командної сторінки департаменту
// =======================================================
function renderDeptTeamsPage(req, res, next, { department }) {
  try {
    res.render('pages/teams/teams', {
      title: `${department}`,
      department,
    });
  } catch (e) { next(e); }
}

// =======================================================
// SSR-рендер сторінки "Управління" департаменту
// (таблиця відразу заповнена, canonical: team, assistantOf)
// =======================================================
async function renderDeptManagementPage(req, res, next, { department }) {
  try {
    const { isAdmin, isManager } = getActorFlags(req, res);

    // 1) Users: менеджеру не показуємо адмінів
    const usersQuery = { department };
    if (!isAdmin && isManager) {
      usersQuery.orgRole = { $ne: 'admin' }; // фільтруємо саме за значенням запису в БД (це ок)
    }

    const rawUsers = await User.find(usersQuery)
      .select('_id firstName lastName email telegramUsername department orgRole deptRole teamRole team assistantOf webId isActive position')
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const users = rawUsers.map(u => ({
      ...u,
      deptRole: (u.deptRole && u.deptRole !== 'none') ? u.deptRole : null,
    }));

    // 2) Опції
    const [orgRolesAll, deptRolesByDept, teamRolesByDept] = await Promise.all([
      enumsService.getOrgRoleOptions(),
      enumsService.getDeptRoleOptionsByDept(department),
      enumsService.getTeamRoleOptionsByDept(department),
    ]);

    // менеджеру не показуємо опцію 'admin' у селекті доступів
    const orgRoles = isAdmin ? orgRolesAll : orgRolesAll.filter(r => r.value !== 'admin');

    const teams = await Team.find({ department, isActive: true })
      .select('_id name')
      .sort({ name: 1 })
      .lean();

    res.render('pages/teams/management', {
      title: `${department} → Управління`,
      department,
      users,
      options: { orgRoles, deptRolesByDept, teamRolesByDept, teams },
    });
  } catch (e) {
    next(e);
  }
}


module.exports = {
  createTeam,
  updateTeam,
  getDeptTeamsTree,
  renderDeptTeamsPage,
  renderDeptManagementPage
};
