'use strict';

const { Router } = require('express');
const auth = require('../middleware/auth'); // твій існуючий
const authController = require('../controllers/authController');
const Recaptcha = require('express-recaptcha').RecaptchaV2;
const router = Router();

const { validate } = require('../middleware/validate');
const { changePasswordRules } = require('../validators/authValidators');

const { RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY } = process.env;
const recaptcha = new Recaptcha(RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY);

router.get('/',
  recaptcha.middleware.render,
  authController.Auth
);

// Change password (UI)
router.get('/change-password',
  auth,
  authController.ChangePasswordPage);

// Change password (submit)
router.post('/change-password',
  auth,
  validate(changePasswordRules),
  authController.ChangePassword
);

router.post('/login',
  recaptcha.middleware.verify,
  authController.Login
);

router.get('/logout',
  authController.Logout
);

module.exports = router;
