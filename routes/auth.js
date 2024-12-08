'use strict';

const { Router } = require('express');
const authController = require('../controllers/authController');
const Recaptcha = require('express-recaptcha').RecaptchaV2;
const router = Router();

const { RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY } = process.env;
const recaptcha = new Recaptcha(RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY);

router.get('/',
  recaptcha.middleware.render,
  authController.Auth
);

router.post('/login',
  recaptcha.middleware.verify,
  authController.Login
);

router.get('/logout',
  authController.Logout
);

module.exports = router;
