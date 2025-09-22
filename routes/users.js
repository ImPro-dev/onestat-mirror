'use strict';

const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const { requireAny /*, requireAll */ } = require('../middleware/requireScopes');
const { SCOPES } = require('../scripts/permissions/scopes');

// Обмеження для ObjectId (24 hex-символи)
const OID = '([a-fA-F0-9]{24})';

/**
 * GET users listing.
 */
router.get('/',
  auth,
  requireAny(SCOPES.ORG_USERS_READ_ANY),
  userController.UserList
);

/**
 * Rendering form to create new user
 * Дозволити: admin/manager (WRITE_ANY) та team lead (CREATE_BASIC)
 */
router.get('/add',
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY, SCOPES.ORG_USERS_CREATE_BASIC),
  userController.AddUserPage
);

/**
 * Create new user
 * Дозволити: admin/manager (WRITE_ANY) та team lead (CREATE_BASIC)
 */
router.post('/add',
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY, SCOPES.ORG_USERS_CREATE_BASIC),
  userController.AddUser
);

/**
 * Rendering form to edit existing user
 * Дозволити: admin/manager (WRITE_ANY) або team lead (EDIT_BASIC)
 */
router.get(`/edit/:id(${OID})`,
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY, SCOPES.ORG_USERS_EDIT_BASIC),
  userController.EditUserPage
);

/**
 * Edit user data
 * Дозволити: admin/manager (WRITE_ANY) або team lead (EDIT_BASIC)
 */
router.post('/edit',
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY, SCOPES.ORG_USERS_EDIT_BASIC),
  userController.EditUser
);

/**
 * Remove user (краще POST/DELETE ніж GET)
 * Дозволити тільки повні права
 */
router.post(`/remove/:id(${OID})`,
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY),
  userController.RemoveUser
);

/**
 * User profile page
 * Доступ: у контролері дозволяємо власнику без скоупів, інакше вимагаємо ORG_USERS_READ_ANY
 */
router.get(`/:id(${OID})`,
  auth,
  userController.ProfilePage
);

/**
 * Deactivate user
 * Дозволити тільки повні права
 */
router.post(`/:id(${OID})/deactivate`,
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY),
  userController.DeactivateUser
);

/**
 * Activate user
 * Дозволити тільки повні права
 */
router.post(`/:id(${OID})/activate`,
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY),
  userController.ActivateUser
);

module.exports = router;
