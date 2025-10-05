'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth'); // твій існуючий
const authController = require('../controllers/authController');
const Recaptcha = require('express-recaptcha').RecaptchaV2;
const router = Router();
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

const { validate } = require('../middlewares/validate');
const { changePasswordRules } = require('../validators/authValidators');

const { RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY } = process.env;
const recaptcha = new Recaptcha(RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY);

router.get('/',
  recaptcha.middleware.render,
  csrfProtection,
  authController.Auth
);

// Change password (UI)
router.get('/change-password',
  auth,
  csrfProtection,
  authController.ChangePasswordPage);

// Change password (submit)
router.post('/change-password',
  auth,
  csrfProtection,
  validate(changePasswordRules),
  authController.ChangePassword
);

router.post('/login',
  recaptcha.middleware.verify,
  csrfProtection,
  authController.Login
);

router.get('/logout',
  csrfProtection,
  authController.Logout
);

module.exports = router;
