const { Router } = require('express');
const router = Router();
const jwt = require('jsonwebtoken');
const dbHelper = require('../helpers/dbHelper');
const User = require('../models/user');
const Recaptcha = require('express-recaptcha').RecaptchaV2

const { RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY } = process.env;

const recaptcha = new Recaptcha(RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY)

router.get('/', recaptcha.middleware.render, async (req, res, next) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.render('pages/login', {
    title: 'Авторизація',
    isLogin: true,
    captcha: res.recaptcha,
    error: req.flash('error')
  });
});

router.post('/login', recaptcha.middleware.verify, async (req, res) => {
  try {
    if (!req.recaptcha.error) {
      const { email, password } = req.body;
      const candidate = await User.findOne({ email });

      if (candidate) {
        const isMatch = await dbHelper.comparePassword(password, candidate.password);
        if (isMatch) {
          // const token = jwt.sign({ id: candidate._id, role: candidate.role },
          //   process.env.JWT_SECRET,
          //   { expiresIn: '1h' }
          // );
          // req.session.token = token;

          req.session.user = candidate;
          req.session.isAuthenticated = true;
          req.session.save(err => {
            if (err) {
              throw err
            }

            res.redirect('/dashboard');
          })
        } else {
          req.flash('error', 'Неправильний пароль');
          // res 400 invalid credentiols
          res.redirect('/auth');
        }

      } else {
        // 404 user not found
        // res.redirect('/auth', 404);
        req.flash('error', 'Користувача не знайдено');
        res.redirect('/auth');
      }
    } else {
      req.flash('error', 'Підтвердіть, що ви не робот');
      // res 400 invalid credentiols
      res.redirect('/auth');
    }

  } catch (error) {
    // res 500 server error
    req.flash('error', 'Помилка сервера');
    console.log(error);
  }
})

router.get('/logout', async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Помилка видалення сесії:', err);
      return res.status(500).send('Помилка при виході');
    }
    res.redirect('/');
  });
})

module.exports = router;
