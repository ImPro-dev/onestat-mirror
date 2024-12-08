'use strict';

const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');

/**
 * GET users listing.
 */
router.get('/',
  auth,
  role('admin', 'manager'),
  userController.UserList
);

/**
 * Rendering form to create new user
 */
router.get('/add',
  auth,
  role('admin', 'manager'),
  userController.AddUserPage
);

/**
 * Create new user
 */
router.post('/add',
  auth,
  role('admin', 'manager'),
  userController.AddUser
);

/**
 * Rendering form to edit existinf user
 */
router.get('/edit/:id',
  auth,
  role('admin', 'manager'),
  userController.EditUserPage
);

/**
 * Edit user data
 */
router.post('/edit',
  auth,
  role('admin', 'manager'),
  userController.EditUser
);

/**
 * User profile page (access for all)
 */
router.get('/:id',
  auth,
  role('admin', 'manager', 'user'),
  userController.ProfilePage
);

/**
 * Remove user
 */
router.get('/remove/:id',
  auth,
  role('admin', 'manager'),
  userController.RemoveUser
);

module.exports = router;
