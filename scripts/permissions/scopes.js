// scripts/permissions/scopes.js
'use strict';

/**
 * Canonical scopes. Keep legacy constants for backward compatibility,
 * but prefer the new read/write model below.
 */
const SCOPES = {
  // Users
  ORG_USERS_READ_ANY: 'org:users:read:any',
  ORG_USERS_WRITE_ANY: 'org:users:write:any',
  ORG_USERS_CREATE_BASIC: 'org:users:create:basic',
  ORG_USERS_EDIT_BASIC: 'org:users:edit:basic',

  // Teams
  TEAMS_READ_ANY: 'teams:read:any',
  TEAMS_WRITE_ANY: 'teams:write:any',
  TEAMS_WRITE_OWN: 'teams:write:own',      // legacy/optional
  TEAMS_MANAGE_DEPT: 'teams:manage:dept',  // Head manages own department

  // Offers (clean read/write split)
  OFFERS_READ_ANY: 'offers:read:any',
  OFFERS_WRITE_ANY: 'offers:write:any',    // create, edit, stop/start, change rate

  // Offers assignment (teamlead issues offers to their team)
  OFFERS_ASSIGN_TEAM: 'offers:assign:team',

  // Offers "assigned-only" read for buyer/assistant
  OFFERS_READ_ASSIGNED: 'offers:read:assigned',

  // Legacy/compat (kept; avoid in new code)
  OFFERS_CREATE_ANY: 'offers:create:any',
  OFFERS_ASSIGN_ANY: 'offers:assign:any',
  OFFERS_ASSIGN_OWN: 'offers:assign:own',

  // Analytics / Statistics
  ANALYTICS_READ_ALL: 'analytics:read:all',
  ANALYTICS_READ_DEPT: 'analytics:read:dept',
  ANALYTICS_READ_TEAM: 'analytics:read:team', // NEW: team-level stats
  ANALYTICS_READ_SELF: 'analytics:read:self',

  // Integrations
  INTEGRATIONS_ADMIN: 'integrations:admin',
};

/**
 * Role -> scopes mapping.
 * Combine org-level role with team/department roles (see TEAMROLE_TO_SCOPES / DEPTROLE_TO_SCOPES).
 */
const ROLE_TO_SCOPES = {
  admin: [...Object.values(SCOPES)],

  // Manager preserved as a broad role (if used in your org):
  manager: [
    SCOPES.OFFERS_READ_ANY,        // тільки читання оферів (за потреби)
    SCOPES.ANALYTICS_READ_DEPT,
  ],

  user: [
    SCOPES.ANALYTICS_READ_SELF,
  ],
};

/**
 * Team role -> scopes.
 * Teamlead: read all offers, assign to own team, can create/edit basic users.
 */
const TEAMROLE_TO_SCOPES = {
  lead: [
    SCOPES.TEAMS_READ_ANY,
    SCOPES.OFFERS_READ_ANY,
    SCOPES.OFFERS_ASSIGN_TEAM,
    SCOPES.ORG_USERS_READ_ANY,
    SCOPES.ORG_USERS_CREATE_BASIC,
    SCOPES.ORG_USERS_EDIT_BASIC,
    SCOPES.ANALYTICS_READ_TEAM,
    SCOPES.ANALYTICS_READ_SELF,
  ],
  member: [
    SCOPES.OFFERS_READ_ASSIGNED,
    SCOPES.ANALYTICS_READ_SELF,
  ],
  assistant: [
    SCOPES.OFFERS_READ_ASSIGNED,
    SCOPES.ANALYTICS_READ_SELF, // consider adding explicit "read:mentor" if needed later
  ],
};

/**
 * Department role -> scopes.
 * Head: manages own department, full offers write, can read any offers, broad analytics.
 */
const DEPTROLE_TO_SCOPES = {
  head: [
    SCOPES.TEAMS_MANAGE_DEPT,
    SCOPES.TEAMS_READ_ANY,
    SCOPES.OFFERS_READ_ANY,
    SCOPES.OFFERS_WRITE_ANY,
    SCOPES.OFFERS_ASSIGN_TEAM, // Head can assign within department/team structures
    SCOPES.ANALYTICS_READ_ALL,
  ],
};

// ——— Normalization helpers ———
function norm(v) { return typeof v === 'string' ? v.toLowerCase() : v; }
function pickRole(user, camel, snake) {
  return norm(user?.[camel] ?? user?.[snake] ?? null);
}

/**
 * Build an effective scope set from org/team/dept roles and extra grants.
 */
function getUserScopes(user) {
  const orgRole = pickRole(user, 'orgRole', 'orgrole');
  const teamRole = pickRole(user, 'teamRole', 'teamrole');
  const deptRole = pickRole(user, 'deptRole', 'deptrole');

  const base = ROLE_TO_SCOPES[orgRole] || [];
  const team = TEAMROLE_TO_SCOPES[teamRole] || [];
  const dept = DEPTROLE_TO_SCOPES[deptRole] || [];
  const extra = Array.isArray(user?.grants) ? user.grants : [];

  return new Set([...base, ...team, ...dept, ...extra]);
}

module.exports = {
  SCOPES,
  ROLE_TO_SCOPES,
  TEAMROLE_TO_SCOPES,
  DEPTROLE_TO_SCOPES,
  getUserScopes,
};
