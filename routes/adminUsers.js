// routes/adminUsers.js
'use strict';

const router = require('express').Router();
const { getManagementData, patchRoles } = require('../controllers/adminUsersController');
const { requireAny } = require('../middlewares/requireScopes');
const { SCOPES } = require('../scripts/permissions/scopes');

// Доступ до менеджмент-даних:
//  - Manager: ORG_USERS_READ_ANY
//  - Head:    TEAMS_MANAGE_DEPT
//  - Admin:   INTEGRATIONS_ADMIN
router.get(
  '/management',
  requireAny(
    SCOPES.ORG_USERS_READ_ANY,
    SCOPES.TEAMS_MANAGE_DEPT,
    SCOPES.INTEGRATIONS_ADMIN
  ),
  getManagementData
);

// Оновлення ролей користувачів:
//  - Manager: ORG_USERS_WRITE_ANY
//  - Head:    TEAMS_MANAGE_DEPT
//  - Admin:   INTEGRATIONS_ADMIN
router.patch(
  '/:id/roles',
  requireAny(
    SCOPES.ORG_USERS_WRITE_ANY,
    SCOPES.TEAMS_MANAGE_DEPT,
    SCOPES.INTEGRATIONS_ADMIN
  ),
  patchRoles
);

module.exports = router;
