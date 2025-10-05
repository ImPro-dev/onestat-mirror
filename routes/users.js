// routes/users.js
'use strict';

const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');
const { requireAny } = require('../middlewares/requireScopes');
const { avatarUploadGuard } = require('../middlewares/uploadAvatar');
const { SCOPES } = require('../scripts/permissions/scopes');

const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });
const ensureCsrfLocal = (req, res, next) => { res.locals.csrfToken = req.csrfToken(); next(); };

const OID = '([a-fA-F0-9]{24})';

// LIST
router.get('/',
  auth,
  requireAny(SCOPES.ORG_USERS_READ_ANY),
  csrfProtection, ensureCsrfLocal,
  userController.UserList
);

// ADD
router.get('/add',
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY, SCOPES.ORG_USERS_CREATE_BASIC),
  csrfProtection, ensureCsrfLocal,
  userController.AddUserPage
);
router.post('/add',
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY, SCOPES.ORG_USERS_CREATE_BASIC),
  csrfProtection,
  userController.AddUser
);

// EDIT
router.get(`/edit/:id(${OID})`,
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY, SCOPES.ORG_USERS_EDIT_BASIC),
  csrfProtection, ensureCsrfLocal,
  userController.EditUserPage
);
router.post('/edit',
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY, SCOPES.ORG_USERS_EDIT_BASIC),
  csrfProtection,
  userController.EditUser
);

// AVATAR: serve
router.get(`/:id(${OID})/avatar`,
  auth,
  userController.ServeAvatar
);

// AVATAR: upload (GET form + POST)
router.get(`/:id(${OID})/avatar/upload`,
  auth,
  csrfProtection, ensureCsrfLocal,
  userController.UploadAvatarPage
);
router.post(`/:id(${OID})/avatar/upload`,
  auth,
  avatarUploadGuard('avatar'),
  csrfProtection,
  userController.UploadAvatar
);

// AVATAR: delete (NEW)
router.post(`/:id(${OID})/avatar/delete`,
  auth,
  csrfProtection,
  userController.DeleteAvatar
);

// REMOVE (POST)
router.post(`/remove/:id(${OID})`,
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY),
  csrfProtection,
  userController.RemoveUser
);

// PROFILE (додали CSRF, щоб у шаблоні був токен для кнопок/форм)
router.get(`/:id(${OID})`,
  auth,
  csrfProtection, ensureCsrfLocal,
  userController.ProfilePage
);

// (De)Activate
router.post(`/:id(${OID})/deactivate`,
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY),
  csrfProtection,
  userController.DeactivateUser
);
router.post(`/:id(${OID})/activate`,
  auth,
  requireAny(SCOPES.ORG_USERS_WRITE_ANY),
  csrfProtection,
  userController.ActivateUser
);

module.exports = router;
