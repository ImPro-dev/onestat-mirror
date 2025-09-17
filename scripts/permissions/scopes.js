// permissions/scopes.js
'use strict';

// ❶ Опис дій системи (гранти)
const SCOPES = {
  // Users
  ORG_USERS_READ_ANY: 'org:users:read:any',
  ORG_USERS_WRITE_ANY: 'org:users:write:any',

  // Teams
  TEAMS_READ_ANY: 'teams:read:any',
  TEAMS_WRITE_ANY: 'teams:write:any',     // створення/редагування/закріплення
  TEAMS_WRITE_OWN: 'teams:write:own',     // керування лише своєю командою (лід)

  // Offers
  OFFERS_CREATE_ANY: 'offers:create:any',
  OFFERS_ASSIGN_ANY: 'offers:assign:any',   // департаментне/глобальне призначення
  OFFERS_ASSIGN_OWN: 'offers:assign:own',   // лід → своїм членам команди

  // Analytics
  ANALYTICS_READ_ALL: 'analytics:read:all',
  ANALYTICS_READ_DEPT: 'analytics:read:dept',
  ANALYTICS_READ_SELF: 'analytics:read:self',

  // Integrations
  INTEGRATIONS_ADMIN: 'integrations:admin',
};

// ❷ Базова мапа прав за orgRole (додається до user.grants)
const ROLE_TO_SCOPES = {
  admin: [
    ...Object.values(SCOPES)
  ],
  manager: [
    SCOPES.ORG_USERS_READ_ANY,

    SCOPES.TEAMS_READ_ANY,
    SCOPES.TEAMS_WRITE_ANY,

    SCOPES.OFFERS_CREATE_ANY,
    SCOPES.OFFERS_ASSIGN_ANY,

    SCOPES.ANALYTICS_READ_DEPT,
    SCOPES.ANALYTICS_READ_SELF,
    // без INTEGRATIONS_ADMIN за замовчуванням
  ],
  user: [
    SCOPES.ANALYTICS_READ_SELF,
    // інші дії — через локальні ролі/передані grants
  ],
};

// ❸ Додаткові “локальні” можливості за teamRole (лідери)
const TEAMROLE_TO_SCOPES = {
  lead: [SCOPES.TEAMS_WRITE_OWN, SCOPES.OFFERS_ASSIGN_OWN],
  member: [],
  assistant: [],
};

// ❹ Підсумкові скоупи користувача: orgRole → базові, teamRole → локальні, + явні grants з БД
function getUserScopes(user) {
  const base = ROLE_TO_SCOPES[user?.orgRole] || [];
  const team = TEAMROLE_TO_SCOPES[user?.teamRole] || [];
  const extra = Array.isArray(user?.grants) ? user.grants : [];
  return [...new Set([...base, ...team, ...extra])];
}

module.exports = { SCOPES, ROLE_TO_SCOPES, TEAMROLE_TO_SCOPES, getUserScopes };
