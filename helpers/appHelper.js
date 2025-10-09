// helpers/appHelper.js
'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const enumsService = require('../services/enumsService');

const { Types } = mongoose;

const DEFAULT_PROJECTION =
  '_id firstName lastName email department orgRole deptRole teamRole team assistantOf webId isActive position';
const DEFAULT_SORT = { lastName: 1, firstName: 1 };

/**
 * Resolve canonical team role values for a given department via enumsService.
 * Avoids hardcoding 'lead' | 'member' | 'assistant'.
 */
async function getTeamRoleValues(department) {
  const teamRolesByDept = await enumsService.getTeamRoleOptionsByDept(department);
  return {
    LEAD: teamRolesByDept.find(r => r.value === 'lead')?.value,
    MEMBER: teamRolesByDept.find(r => r.value === 'member')?.value,
    ASSISTANT: teamRolesByDept.find(r => r.value === 'assistant')?.value,
    _all: teamRolesByDept.map(r => r.value),
  };
}

/* -------------------------------------------------------------------------- */
/*  Role label lookup (for writing User.position)                             */
/* -------------------------------------------------------------------------- */

/**
 * In-memory cache for team role labels per department.
 * Key: `${department}::${roleValue}` → { label, ts }
 */
const _roleLabelCache = new Map();
const ROLE_LABEL_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ROLE_LABEL_MAX = 500;

function _roleKey(dept, value) { return `${dept}::${value}`; }
function _pruneRoleCache(keep = 400) {
  if (_roleLabelCache.size <= keep) return;
  const items = [..._roleLabelCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
  for (let i = 0; i < items.length - keep; i++) _roleLabelCache.delete(items[i][0]);
}

/**
 * Return readable label for a given teamRole value in a department.
 * Source of truth = enumsService (TeamRole collection under the hood).
 */
async function getTeamRoleLabel(department, roleValue) {
  if (!department || !roleValue) return null;

  const key = _roleKey(department, roleValue);
  const now = Date.now();
  const hit = _roleLabelCache.get(key);
  if (hit && (now - hit.ts) < ROLE_LABEL_TTL_MS) return hit.label;

  try {
    const options = await enumsService.getTeamRoleOptionsByDept(department);
    const label = (options || []).find(o => o.value === roleValue)?.label || null;
    _roleLabelCache.set(key, { label, ts: now });
    if (_roleLabelCache.size > ROLE_LABEL_MAX) _pruneRoleCache();
    return label;
  } catch (err) {
    console.error('[appHelper.getTeamRoleLabel] failed:', err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  User queries by role                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Build base query for users by department/role with optional constraints.
 * Centralizes filtering logic; other helpers remain concise.
 */
async function findUsersByRoles({
  department,
  roles = [],
  onlyActive = true,
  withTeamOnly = false,
  teamId,
  supervisorId,
  projection = DEFAULT_PROJECTION,
  sort = DEFAULT_SORT,
}) {
  const q = {};
  if (department) q.department = String(department).trim();
  if (Array.isArray(roles) && roles.length) q.teamRole = { $in: roles };
  if (onlyActive) q.isActive = true;
  if (withTeamOnly) q.team = { $ne: null };
  if (teamId) q.team = Types.ObjectId.isValid(teamId) ? new Types.ObjectId(teamId) : null;
  if (supervisorId) {
    q.assistantOf = Types.ObjectId.isValid(supervisorId)
      ? new Types.ObjectId(supervisorId)
      : supervisorId;
  }

  try {
    return await User.find(q).select(projection).sort(sort).lean();
  } catch (err) {
    console.error('[appHelper.findUsersByRoles] query failed:', err);
    return [];
  }
}

/**
 * Get team leads of a department.
 */
async function getTeamLeads(department, opts = {}) {
  const { onlyActive = true, withTeamOnly = false } = opts;
  try {
    const ROLES = await getTeamRoleValues(department);
    return await findUsersByRoles({
      department,
      roles: ROLES.LEAD ? [ROLES.LEAD] : [],
      onlyActive,
      withTeamOnly,
    });
  } catch (err) {
    console.error('[appHelper.getTeamLeads] failed:', err);
    return [];
  }
}

/**
 * Get buyers (team members) of a department.
 */
async function getBuyers(department, opts = {}) {
  const { onlyActive = true, withTeamOnly = false, teamId } = opts;
  try {
    const ROLES = await getTeamRoleValues(department);
    return await findUsersByRoles({
      department,
      roles: ROLES.MEMBER ? [ROLES.MEMBER] : [],
      onlyActive,
      withTeamOnly,
      teamId,
    });
  } catch (err) {
    console.error('[appHelper.getBuyers] failed:', err);
    return [];
  }
}

/**
 * Get assistants of a department (optional: by supervisor or team).
 */
async function getAssistants(department, opts = {}) {
  const { onlyActive = true, withTeamOnly = false, teamId, supervisorId } = opts;
  try {
    const ROLES = await getTeamRoleValues(department);
    return await findUsersByRoles({
      department,
      roles: ROLES.ASSISTANT ? [ROLES.ASSISTANT] : [],
      onlyActive,
      withTeamOnly,
      teamId,
      supervisorId,
    });
  } catch (err) {
    console.error('[appHelper.getAssistants] failed:', err);
    return [];
  }
}

/**
 * Get all possible supervisors for assistants: leads and members.
 * Useful for building supervisor dropdowns.
 */
async function getSupervisors(department, opts = {}) {
  const { onlyActive = true, withTeamOnly = false } = opts;
  try {
    const ROLES = await getTeamRoleValues(department);
    const roles = [ROLES.LEAD, ROLES.MEMBER].filter(Boolean);
    return await findUsersByRoles({
      department,
      roles,
      onlyActive,
      withTeamOnly,
    });
  } catch (err) {
    console.error('[appHelper.getSupervisors] failed:', err);
    return [];
  }
}

/**
 * Get users by a list of webId values.
 */
async function getUsersByWebIds(webIds = [], opts = {}) {
  const { department, onlyActive = true } = opts;
  if (!Array.isArray(webIds) || webIds.length === 0) return [];
  const q = { webId: { $in: webIds.map(String) } };
  if (department) q.department = String(department).trim();
  if (onlyActive) q.isActive = true;

  try {
    return await User.find(q)
      .select('_id firstName lastName email department teamRole team webId isActive')
      .sort(DEFAULT_SORT)
      .lean();
  } catch (err) {
    console.error('[appHelper.getUsersByWebIds] failed:', err);
    return [];
  }
}

/**
 * Convenience: get a team roster by teamId.
 * Returns { lead, members, assistants } arrays for a single team.
 */
async function getTeamRoster(teamId) {
  if (!Types.ObjectId.isValid(teamId)) return { lead: [], members: [], assistants: [] };
  const _teamId = new Types.ObjectId(teamId);

  try {
    // Cheap way to infer department for the team
    const anyUser = await User.findOne({ team: _teamId }).select('department').lean();
    const department = anyUser?.department || null;
    if (!department) return { lead: [], members: [], assistants: [] };

    const ROLES = await getTeamRoleValues(department);

    const [lead, members, assistants] = await Promise.all([
      User.find({ department, team: _teamId, teamRole: ROLES.LEAD })
        .select(DEFAULT_PROJECTION)
        .sort(DEFAULT_SORT)
        .lean(),
      User.find({ department, team: _teamId, teamRole: ROLES.MEMBER })
        .select(DEFAULT_PROJECTION)
        .sort(DEFAULT_SORT)
        .lean(),
      User.find({ department, team: _teamId, teamRole: ROLES.ASSISTANT })
        .select(DEFAULT_PROJECTION)
        .sort(DEFAULT_SORT)
        .lean(),
    ]);

    return { lead, members, assistants };
  } catch (err) {
    console.error('[appHelper.getTeamRoster] failed:', err);
    return { lead: [], members: [], assistants: [] };
  }
}

module.exports = {
  // Labels
  getTeamRoleLabel,

  // Role-based helpers
  getTeamLeads,
  getBuyers,
  getAssistants,
  getSupervisors,

  // Utility helpers
  getUsersByWebIds,
  getTeamRoster,
};
