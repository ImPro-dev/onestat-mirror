// scripts/permissions/scopes.js
'use strict';

const SCOPES = {
  // Users
  ORG_USERS_READ_ANY: 'org:users:read:any',
  ORG_USERS_WRITE_ANY: 'org:users:write:any',
  ORG_USERS_CREATE_BASIC: 'org:users:create:basic',
  ORG_USERS_EDIT_BASIC: 'org:users:edit:basic',

  // Teams
  TEAMS_READ_ANY: 'teams:read:any',
  TEAMS_WRITE_ANY: 'teams:write:any',
  TEAMS_WRITE_OWN: 'teams:write:own',

  // Head керує своїм департаментом
  TEAMS_MANAGE_DEPT: 'teams:manage:dept',

  // Offers
  OFFERS_CREATE_ANY: 'offers:create:any',
  OFFERS_ASSIGN_ANY: 'offers:assign:any',
  OFFERS_ASSIGN_OWN: 'offers:assign:own',

  // Analytics
  ANALYTICS_READ_ALL: 'analytics:read:all',
  ANALYTICS_READ_DEPT: 'analytics:read:dept',
  ANALYTICS_READ_SELF: 'analytics:read:self',

  // Integrations
  INTEGRATIONS_ADMIN: 'integrations:admin',
};

const ROLE_TO_SCOPES = {
  admin: [...Object.values(SCOPES)],
  manager: [
    SCOPES.ORG_USERS_READ_ANY,
    SCOPES.ORG_USERS_WRITE_ANY,
    SCOPES.TEAMS_READ_ANY,
    SCOPES.TEAMS_WRITE_ANY,
    SCOPES.OFFERS_CREATE_ANY,
    SCOPES.OFFERS_ASSIGN_ANY,
    SCOPES.ANALYTICS_READ_DEPT,
    SCOPES.ANALYTICS_READ_SELF,
  ],
  user: [
    SCOPES.ANALYTICS_READ_SELF,
  ],
};

const TEAMROLE_TO_SCOPES = {
  lead: [
    SCOPES.ORG_USERS_READ_ANY,
    SCOPES.ORG_USERS_CREATE_BASIC,
    SCOPES.ORG_USERS_EDIT_BASIC,
    SCOPES.TEAMS_WRITE_OWN,
    SCOPES.OFFERS_ASSIGN_OWN,
  ],
  member: [],
  assistant: [],
};

const DEPTROLE_TO_SCOPES = {
  head: [
    SCOPES.TEAMS_MANAGE_DEPT,
    SCOPES.TEAMS_READ_ANY,
  ],
};

// ——— Нормалізація ключів і значень ролей (щоб не ламалось від orgrole/deptrole/teamrole) ———
function norm(v) { return typeof v === 'string' ? v.toLowerCase() : v; }
function pickRole(user, camel, snake) {
  return norm(user?.[camel] ?? user?.[snake] ?? null);
}

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
