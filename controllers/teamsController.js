// controllers/teamsController.js
'use strict';

const mongoose = require('mongoose');
const Team = require('../models/Team');
const User = require('../models/User');
const enumsService = require('../services/enumsService');
const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');
const { getTeamLeads, getSupervisors } = require('../helpers/appHelper');

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
  // 1) prefer res.locals flags
  if (res?.locals) {
    const isAdmin = !!res.locals.isAdmin;
    const isManager = !!res.locals.isManager && !isAdmin;
    return { isAdmin, isManager };
  }
  // 2) fallback to scopes
  const user = req.session?.user || req.user || null;
  const set = new Set(getUserScopes(user));
  const isAdmin = set.has(SCOPES.INTEGRATIONS_ADMIN);
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
// Returns team structure for a department (canonical: team, assistantOf).
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

    // canonical fields: team, assistantOf, teamRole (+ names for UI)
    const users = await User.find({ department, team: { $in: teamIds } })
      .select('_id firstName lastName teamRole team assistantOf webId')
      .lean();

    const byTeam = new Map(
      teams.map(t => [String(t._id), { team: t, lead: null, buyers: [], assistantsOfLead: [] }])
    );
    const byId = new Map(users.map(u => [String(u._id), u]));

    // lead from users
    for (const u of users) {
      if (u.teamRole === 'lead' && u.team) {
        const bucket = byTeam.get(String(u.team));
        if (bucket) bucket.lead = u;
      }
    }

    // fallback via team.lead
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
// SSR: teams page (server-side tree rendering)
// =======================================================
async function renderDeptTeamsPage(req, res, next, { department }) {
  try {
    const dept = String(department || 'Media Buying').trim();

    // 1) Активні команди департаменту
    const teams = await Team.find({ department: dept, isActive: true })
      .select('_id name department lead')
      .sort({ name: 1 })
      .lean();

    const teamIds = teams.map(t => t._id);

    // 2) Користувачі департаменту, що входять до цих команд (канонічні поля)
    const users = await User.find({ department: dept, team: { $in: teamIds } })
      .select('_id firstName lastName email webId team teamRole assistantOf')
      .lean();

    // 3) Побудова buckets: { team, lead, buyers:[{buyer, assistants:[] }], assistantsOfLead:[] }
    const byTeam = new Map(
      teams.map(t => [String(t._id), { team: t, lead: null, buyers: [], assistantsOfLead: [] }])
    );
    const byId = new Map(users.map(u => [String(u._id), u]));

    // lead з users
    for (const u of users) {
      if (u.team && u.teamRole === 'lead') {
        const bucket = byTeam.get(String(u.team));
        if (bucket) bucket.lead = u;
      }
    }
    // fallback: якщо не знайшли серед users, глянемо team.lead
    const missing = [];
    for (const bucket of byTeam.values()) {
      if (!bucket.lead && bucket.team.lead) missing.push(bucket.team.lead);
    }
    if (missing.length) {
      const lf = await User.find({ _id: { $in: missing } })
        .select('_id firstName lastName email webId team teamRole assistantOf')
        .lean();
      const fb = new Map(lf.map(x => [String(x._id), x]));
      for (const bucket of byTeam.values()) {
        if (!bucket.lead && bucket.team.lead) {
          const cand = fb.get(String(bucket.team.lead));
          if (cand) bucket.lead = cand;
        }
      }
    }

    // buyers
    for (const u of users) {
      if (u.team && u.teamRole === 'member') {
        const bucket = byTeam.get(String(u.team));
        if (bucket) bucket.buyers.push({ buyer: u, assistants: [] });
      }
    }

    // assistants: до баєра або до ліда
    for (const u of users) {
      if (!u.team || u.teamRole !== 'assistant') continue;
      const bucket = byTeam.get(String(u.team));
      if (!bucket) continue;

      const sup = u.assistantOf ? byId.get(String(u.assistantOf)) : null;
      if (!sup) continue;

      if (sup.teamRole === 'member') {
        const cell = bucket.buyers.find(b => String(b.buyer._id) === String(sup._id));
        if (cell) cell.assistants.push(u);
      } else if (sup.teamRole === 'lead') {
        bucket.assistantsOfLead.push(u);
      }
    }

    const buckets = Array.from(byTeam.values());

    // 4) Локалізовані лейбли ролей (для бейджів)
    const teamRolesByDept = await enumsService.getTeamRoleOptionsByDept(dept);
    const roleLabel = {};
    for (const r of (teamRolesByDept || [])) roleLabel[r.value] = r.label || r.value;

    // 5) Кандидати тімлідів для модалки створення команди (SSR!)
    const leadsRaw = await getTeamLeads(dept, { onlyActive: true, withTeamOnly: false });
    const teamLeads = (leadsRaw || [])
      .map(u => ({
        _id: String(u._id),
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || ''
      }))
      .sort((a, b) => {
        const an = (`${a.firstName} ${a.lastName}`).trim() || a.email || '';
        const bn = (`${b.firstName} ${b.lastName}`).trim() || b.email || '';
        return an.localeCompare(bn);
      });

    // 6) Рендер
    res.render('pages/teams/teams', {
      title: `${dept}`,
      department: dept,
      isMediaBuying: (dept === 'Media Buying'),
      buckets,
      roleLabel,
      options: { teamLeads },    // ← важливо для заповнення селекту
    });
  } catch (e) { next(e); }
}

// =======================================================
// SSR: management page (table is prefilled; canonical: team, assistantOf)
// =======================================================
async function renderDeptManagementPage(req, res, next, { department }) {
  try {
    const { isAdmin, isManager } = getActorFlags(req, res);

    // query params (filters + pagination)
    const {
      q = '',
      orgRole = '',
      deptRole = '',
      teamRole = '',
      team = '',
      assistantOf = '',
      page: pageRaw = '1',
      limit: limitRaw = '20',
    } = req.query || {};

    const toInt = (v, def) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : def;
    };
    const buildUrl = (base, params) => {
      const qs = new URLSearchParams(params);
      return `${base}?${qs.toString()}`;
    };

    const page = toInt(pageRaw, 1);
    const limit = toInt(limitRaw, 20);

    // base query (respect manager visibility)
    const find = { department };
    if (!isAdmin && isManager) {
      find.orgRole = { $ne: 'admin' };
    }

    // search: by name or webId
    if (q && q.trim()) {
      const re = new RegExp(q.trim(), 'i');
      find.$or = [{ firstName: re }, { lastName: re }, { webId: re }];
    }

    // filters
    if (orgRole) find.orgRole = orgRole;
    if (deptRole) find.deptRole = deptRole;
    if (teamRole) find.teamRole = teamRole;
    if (team && mongoose.isValidObjectId(team)) {
      find.team = new mongoose.Types.ObjectId(team);
    }
    if (assistantOf && mongoose.isValidObjectId(assistantOf)) {
      find.assistantOf = new mongoose.Types.ObjectId(assistantOf);
    }

    // counts & page
    const total = await User.countDocuments(find);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const skip = (safePage - 1) * limit;

    const rawUsers = await User.find(find)
      .select('_id firstName lastName email telegramUsername department orgRole deptRole teamRole team assistantOf webId isActive position')
      .sort({ lastName: 1, firstName: 1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const users = rawUsers.map(u => ({
      ...u,
      deptRole: (u.deptRole && u.deptRole !== 'none') ? u.deptRole : null,
    }));

    // options for selects
    const [orgRolesAll, deptRolesByDept, teamRolesByDept] = await Promise.all([
      enumsService.getOrgRoleOptions(),
      enumsService.getDeptRoleOptionsByDept(department),
      enumsService.getTeamRoleOptionsByDept(department),
    ]);
    const orgRoles = isAdmin ? orgRolesAll : orgRolesAll.filter(r => r.value !== 'admin');

    const teams = await Team.find({ department, isActive: true })
      .select('_id name')
      .sort({ name: 1 })
      .lean();

    // supervisors (leads + members) for filter dropdown
    const supervisorsRaw = await getSupervisors(department, { onlyActive: true, withTeamOnly: false });
    const supervisors = (supervisorsRaw || []).map(u => ({
      _id: String(u._id),
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
    })).sort((a, b) => {
      const an = (`${a.firstName} ${a.lastName}`).trim() || a.email || '';
      const bn = (`${b.firstName} ${b.lastName}`).trim() || b.email || '';
      return an.localeCompare(bn);
    });

    // team leads for "Create team" modal
    const teamLeadsRaw = await getTeamLeads(department);
    const teamLeads = (teamLeadsRaw || []).map(u => ({
      _id: String(u._id),
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
    })).sort((a, b) => {
      const an = (`${a.firstName} ${a.lastName}`).trim() || a.email || '';
      const bn = (`${b.firstName} ${b.lastName}`).trim() || b.email || '';
      return an.localeCompare(bn);
    });

    // pagination links
    const baseQuery = { q, orgRole, deptRole, teamRole, team, assistantOf, limit: String(limit) };
    const pages = Array.from({ length: totalPages }, (_, i) => {
      const n = i + 1;
      return { n, url: buildUrl('/teams/mediabuying/management', { ...baseQuery, page: String(n) }), active: n === safePage };
    });
    const prevUrl = buildUrl('/teams/mediabuying/management', { ...baseQuery, page: String(Math.max(1, safePage - 1)) });
    const nextUrl = buildUrl('/teams/mediabuying/management', { ...baseQuery, page: String(Math.min(totalPages, safePage + 1)) });

    res.render('pages/teams/management', {
      title: `${department} → Управління`,
      department,
      users,
      options: { orgRoles, deptRolesByDept, teamRolesByDept, teams, teamLeads, supervisors },
      query: { q, orgRole, deptRole, teamRole, team, assistantOf },
      pagination: { page: safePage, limit, total, totalPages, pages, prevUrl, nextUrl },
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
