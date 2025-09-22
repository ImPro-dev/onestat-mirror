'use strict';

const SCOPES = {
  // Users
  ORG_USERS_READ_ANY: 'org:users:read:any',
  ORG_USERS_WRITE_ANY: 'org:users:write:any',     // повний CRUD + структурні поля
  ORG_USERS_CREATE_BASIC: 'org:users:create:basic', // створення базового user
  ORG_USERS_EDIT_BASIC: 'org:users:edit:basic',     // редагування базових полів

  // Teams
  TEAMS_READ_ANY: 'teams:read:any',
  TEAMS_WRITE_ANY: 'teams:write:any',
  TEAMS_WRITE_OWN: 'teams:write:own',

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
    SCOPES.ORG_USERS_WRITE_ANY,       // менеджеру лишаємо повні права на юзерів
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
  // даємо тімліду базові можливості по юзерам
  lead: [
    SCOPES.ORG_USERS_READ_ANY,        // бачить список / профілі
    SCOPES.ORG_USERS_CREATE_BASIC,    // може створювати базових user
    SCOPES.ORG_USERS_EDIT_BASIC,      // може редагувати базові поля
    SCOPES.TEAMS_WRITE_OWN,           // для майбутнього модуля “Команди”
    SCOPES.OFFERS_ASSIGN_OWN
  ],
  member: [],
  assistant: [],
};

function getUserScopes(user) {
  const base = ROLE_TO_SCOPES[user?.orgRole] || [];
  const team = TEAMROLE_TO_SCOPES[user?.teamRole] || [];
  const extra = Array.isArray(user?.grants) ? user.grants : [];
  return [...new Set([...base, ...team, ...extra])];
}

module.exports = { SCOPES, ROLE_TO_SCOPES, TEAMROLE_TO_SCOPES, getUserScopes };
