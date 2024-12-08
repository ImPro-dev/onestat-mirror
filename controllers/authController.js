'use strict';

const dbHelper = require('../helpers/dbHelper');
const User = require('../models/user');

/**
 *
 * @param {Request} req
 * @param {Response} res
 * @returns
 */
const Auth = async (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.render('pages/login', {
    title: 'Авторизація',
    isLogin: true,
    captcha: res.recaptcha,
    error: req.flash('error')
  });
}

/**
 * Login customer
 * @param {Request} req
 * @param {Response} res
 */
const Login = async (req, res) => {
  try {
    if (!req.recaptcha.error) {
      const { email, password } = req.body;
      const candidate = await User.findOne({ email });

      if (candidate) {
        const isMatch = await dbHelper.comparePassword(password, candidate.password);
        if (isMatch) {
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
}

/**
 * Logout customer
 * @param {Request} req
 * @param {Response} res
 */
const Logout = async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Помилка видалення сесії:', err);
      return res.status(500).send('Помилка при виході');
    }
    res.redirect('/');
  });
}


module.exports = {
  Auth,
  Login,
  Logout
}
