'use strict';

const dbHelper = require('../helpers/dbHelper');
const User = require('../models/User');

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
    if (req.recaptcha && req.recaptcha.error) {
      req.flash('error', 'Підтвердіть, що ви не робот');
      return res.redirect('/auth');
    }

    const { email, password } = req.body;
    const emailNorm = String(email || '').trim().toLowerCase();
    if (!emailNorm || !password) {
      req.flash('error', 'Вкажіть емейл і пароль');
      return res.redirect('/auth');
    }

    // ВАЖЛИВО: явно підтягуємо passwordHash
    const candidate = await User.findOne({ email: emailNorm, isActive: true })
      .select('+passwordHash'); // <—

    if (!candidate) {
      req.flash('error', 'Користувача не знайдено');
      return res.redirect('/auth');
    }

    const isMatch = await dbHelper.comparePassword(password, candidate.passwordHash);
    if (!isMatch) {
      req.flash('error', 'Неправильний пароль');
      return res.redirect('/auth');
    }

    // Успіх: оновлюємо lastLoginAt (не тримаємо hash у сесії)
    candidate.lastLoginAt = new Date();
    await candidate.save();

    // Кладемо в сесію мінімум без чутливих полів
    req.session.user = {
      id: String(candidate._id),
      email: candidate.email,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      orgRole: candidate.orgRole,
      teamRole: candidate.teamRole,
      department: candidate.department,
      team: candidate.team,
      webId: candidate.webId,
      grants: candidate.grants || [],     // додаткові кастомні скоупи з БД
    };
    req.session.isAuthenticated = true;

    req.session.save((err) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Помилка сесії');
        return res.redirect('/auth');
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Помилка сервера');
    res.redirect('/auth');
  }
};

/**
 * Logout customer
 * @param {Request} req
 * @param {Response} res
 */
const Logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Помилка при виході');
      return res.redirect('/dashboard');
    }
    res.clearCookie('connect.sid'); // очищаємо cookie сесії
    res.redirect('/auth');
  });
};


module.exports = {
  Auth,
  Login,
  Logout
}
