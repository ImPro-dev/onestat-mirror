// helpers/acl.js
'use strict';

/**
 * Access Control Layer (single source of truth):
 * - user normalization (id/department/team)
 * - scopes → flags for UI
 * - policies (offer assignment, read/edit user, etc.)
 */

const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');

/* =========================
 * Normalize
 * ========================= */

function uid(user) {
  return user ? String(user._id || user.id || '') : '';
}
function getDepartment(user) {
  return user?.department ? String(user.department) : null;
}
function getTeamId(user) {
  return user?.team ? String(user.team) : null;
}
function getOrgRole(user) {
  return user?.orgRole ? String(user.orgRole).toLowerCase() : null;
}
function getDeptRole(user) {
  return user?.deptRole ? String(user.deptRole).toLowerCase() : null;
}
function getTeamRole(user) {
  return user?.teamRole ? String(user.teamRole).toLowerCase() : null;
}

function isActiveUser(user) {
  return user?.isActive !== false;
}
function isAssistant(user) {
  return !!user?.assistantOf;
}
function isAdminUser(user) {
  return getOrgRole(user) === 'admin';
}
function isHeadUser(user) {
  return getDeptRole(user) === 'head';
}

/* =========================
 * Scopes & Flags
 * ========================= */

/**
 * Thin wrapper in case we ever want to inject a precomputed Set.
 */
function buildScopes(user, precomputed) {
  return (precomputed instanceof Set) ? precomputed : getUserScopes(user || {});
}

/**
 * Flags builder: accepts optional precomputed scopes Set to avoid duplicate work.
 */
function buildFlags(user, scopesArg) {
  const scopes = buildScopes(user, scopesArg);

  // Offers
  const canSeeAllOffers = scopes.has(SCOPES.OFFERS_READ_ANY);
  const canWriteOffers = scopes.has(SCOPES.OFFERS_WRITE_ANY);
  const canAssignOffers =
    scopes.has(SCOPES.OFFERS_ASSIGN_TEAM) ||
    scopes.has(SCOPES.OFFERS_ASSIGN_ANY) ||
    scopes.has(SCOPES.OFFERS_ASSIGN_OWN); // legacy compat
  const canSeeAssignedOffersOnly = scopes.has(SCOPES.OFFERS_READ_ASSIGNED) && !canSeeAllOffers;

  // Teams
  const canManageDept = scopes.has(SCOPES.TEAMS_MANAGE_DEPT);
  const canTeamsWriteAny = scopes.has(SCOPES.TEAMS_WRITE_ANY);
  const canTeamsWriteOwn = scopes.has(SCOPES.TEAMS_WRITE_OWN);

  // Analytics
  const canStatsAny = scopes.has(SCOPES.ANALYTICS_READ_ALL);
  const canStatsDept = scopes.has(SCOPES.ANALYTICS_READ_DEPT);
  const canStatsTeam = scopes.has(SCOPES.ANALYTICS_READ_TEAM);
  const canStatsSelf = scopes.has(SCOPES.ANALYTICS_READ_SELF);

  // Users
  const canUsersReadAny = scopes.has(SCOPES.ORG_USERS_READ_ANY);
  const canUsersWriteAny = scopes.has(SCOPES.ORG_USERS_WRITE_ANY);
  const canUsersCreateBasic = scopes.has(SCOPES.ORG_USERS_CREATE_BASIC);
  const canUsersEditBasic = scopes.has(SCOPES.ORG_USERS_EDIT_BASIC);

  // Admin/Head markers
  const isIntegrationsAdmin = scopes.has(SCOPES.INTEGRATIONS_ADMIN);
  const isHead = canManageDept;

  return {
    scopes, // keep Set here; middleware can spread to arrays for templates
    // offers
    canSeeAllOffers,
    canWriteOffers,
    canAssignOffers,
    canSeeAssignedOffersOnly,
    // teams
    canManageDept,
    canTeamsWriteAny,
    canTeamsWriteOwn,
    // analytics
    canStatsAny,
    canStatsDept,
    canStatsTeam,
    canStatsSelf,
    // users
    canUsersReadAny,
    canUsersWriteAny,
    canUsersCreateBasic,
    canUsersEditBasic,
    // roles
    isIntegrationsAdmin,
    isHead
  };
}

/**
 * Convenience flags for admin-users area.
 */
function getActorFlags(user, scopesArg) {
  const flags = buildFlags(user, scopesArg);
  return {
    isAdmin: !!flags.isIntegrationsAdmin,
    isHead: !!flags.isHead,
    isManagerAny: !!flags.canTeamsWriteAny,
  };
}

/* =========================
 * Policies
 * ========================= */

/** Valid assignment target: active, not assistant, not admin, not head. */
function isAssignmentTargetAllowed(target) {
  if (!isActiveUser(target)) return false;
  if (isAssistant(target)) return false;
  if (isAdminUser(target)) return false;
  if (isHeadUser(target)) return false;
  return true;
}

/**
 * Offer assignment policy:
 * - OFFERS_ASSIGN_ANY → global (still respects target rules)
 * - Head (TEAMS_MANAGE_DEPT) → within their department
 * - Teamlead (OFFERS_ASSIGN_TEAM/OWN) → self, same team, or direct supervisee
 */
function canAssignOffer(actor, target, scopesArg) {
  if (!actor || !target) return false;
  if (!isAssignmentTargetAllowed(target)) return false;

  const flags = buildFlags(actor, scopesArg);

  if (flags.scopes.has(SCOPES.OFFERS_ASSIGN_ANY)) return true;

  const aDept = getDepartment(actor);
  const tDept = getDepartment(target);
  const aTeam = getTeamId(actor);
  const tTeam = getTeamId(target);
  const actorId = uid(actor);
  const targetId = uid(target);

  // Head → same department
  if (flags.canManageDept && aDept && tDept && aDept === tDept) {
    return true;
  }

  // Teamlead-family
  if (flags.canAssignOffers) {
    if (actorId && actorId === targetId) return true;               // self
    if (aTeam && tTeam && aTeam === tTeam) return true;             // same team
    if (String(target.supervisorId || '') === actorId) return true; // supervised by actor
  }

  return false;
}

/** Profile read: self or ORG_USERS_READ_ANY. */
function canReadUserProfile(actor, targetUserId, scopesArg) {
  const aId = uid(actor);
  if (aId && aId === String(targetUserId)) return true;
  const flags = buildFlags(actor, scopesArg);
  return flags.canUsersReadAny;
}

/** Basic user edit: self or ORG_USERS_WRITE_ANY. */
function canEditUserBasic(actor, targetUserId, scopesArg) {
  const aId = uid(actor);
  if (aId && aId === String(targetUserId)) return true;
  const flags = buildFlags(actor, scopesArg);
  return flags.canUsersWriteAny;
}

/**
 * Coarse filter for SSR candidate list (pre-filter only; per-user policy still enforced).
 * Centralizes base query logic.
 */
function buildEligibleUsersBaseFilter(actor, scopesArg) {
  const f = {
    $and: [
      { $or: [{ assistantOf: { $exists: false } }, { assistantOf: null }] },
      { $or: [{ isActive: { $exists: false } }, { isActive: { $ne: false } }] },
    ]
  };

  const flags = buildFlags(actor, scopesArg);
  if (flags.scopes.has(SCOPES.OFFERS_ASSIGN_ANY)) return f;

  const or = [];
  const aDept = getDepartment(actor);
  const aTeam = getTeamId(actor);
  const aId = uid(actor);

  if (aDept) or.push({ department: aDept });
  if (aTeam) or.push({ team: actor.team });
  if (aId) or.push({ supervisorId: actor._id || actor.id });

  return or.length ? { $and: [f, { $or: or }] } : f;
}

module.exports = {
  // normalize
  uid, getDepartment, getTeamId, getOrgRole, getDeptRole, getTeamRole,
  isActiveUser, isAssistant, isAdminUser, isHeadUser,

  // scopes & flags
  buildScopes,
  buildFlags,
  getActorFlags,

  // policies
  isAssignmentTargetAllowed,
  canAssignOffer,
  canReadUserProfile,
  canEditUserBasic,
  buildEligibleUsersBaseFilter,

  // re-export SCOPES for rare direct checks
  SCOPES,
};
