'use strict';

const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireAny, requireAll } = require('../middleware/requireScopes');
const { SCOPES } = require('../scripts/permissions/scopes');
const role = require('../middleware/role');

/**
 * GET users listing.
 */
router.get('/',
  auth,
  requireAny([SCOPES.ORG_USERS_READ_ANY]),
  userController.UserList
);

/**
 * Rendering form to create new user
 */
router.get('/add',
  auth,
  requireAny([SCOPES.ORG_USERS_WRITE_ANY]),
  userController.AddUserPage
);

/**
 * Create new user
 */
router.post('/add',
  auth,
  requireAny([SCOPES.ORG_USERS_WRITE_ANY]),
  userController.AddUser
);

/**
 * Rendering form to edit existinf user
 */
router.get('/edit/:id',
  auth,
  requireAny([SCOPES.ORG_USERS_WRITE_ANY]),
  userController.EditUserPage
);

/**
 * Edit user data
 */
router.post('/edit',
  auth,
  requireAny([SCOPES.ORG_USERS_WRITE_ANY]),
  userController.EditUser
);

/**
 * User profile page (access for all)
 */
router.get('/:id',
  auth,
  requireAny([SCOPES.ORG_USERS_READ_ANY]),
  userController.ProfilePage
);

/**
 * Remove user
 */
router.get('/remove/:id',
  auth,
  requireAny([SCOPES.ORG_USERS_WRITE_ANY]),
  userController.RemoveUser
);

module.exports = router;
