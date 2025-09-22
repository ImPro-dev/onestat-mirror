'use strict';

const dbHelper = require('../helpers/dbHelper');
const User = require('../models/User');
const { killOtherSessions } = require('../services/sessionsService');

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
    // await User.updateOne({ _id: candidate._id }, { $set: { lastLoginAt: new Date() } });

    // Кладемо в сесію мінімум без чутливих полів
    req.session.user = {
      id: String(candidate._id),
      email: candidate.email,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      telegramUsername: candidate.telegramUsername,
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
const ChangePasswordPage = async (req, res) => {
  try {
    return res.render('pages/auth/change-password', {
      title: 'Змінити пароль',
      // userError/userSuccess вже доступні в res.locals з app.js
    });
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Помилка при завантаженні сторінки зміни пароля.');
    return res.redirect('/dashboard');
  }
};

const ChangePassword = async (req, res) => {
  try {
    const userId = req.session?.user?._id;
    if (!userId) {
      req.flash('userError', 'Сесія завершена. Увійдіть знову.');
      return res.redirect('/auth');
    }

    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      req.flash('userError', 'Користувача не знайдено.');
      return res.redirect('/auth');
    }

    const ok = await dbHelper.comparePassword(oldPassword, user.passwordHash);
    if (!ok) {
      req.flash('userError', 'Поточний пароль невірний.');
      return res.redirect('/auth/change-password');
    }

    const same = await dbHelper.comparePassword(newPassword, user.passwordHash);
    if (same) {
      req.flash('userError', 'Новий пароль не може збігатися з поточним.');
      return res.redirect('/auth/change-password');
    }

    user.passwordHash = await dbHelper.hashPassword(newPassword);
    user.lastPasswordChangeAt = new Date();
    await user.save();

    const currentSid = req.session.id;

    req.session.regenerate(async err => {
      if (err) {
        console.error('Session regenerate error:', err);
      }

      // поновлюємо дані у новій сесії
      req.session.user = {
        _id: user._id,
        email: user.email,
        orgRole: user.orgRole,
        grants: user.grants || [],
        department: user.department,
        team: user.team,
        teamRole: user.teamRole,
        firstName: user.firstName,
        lastName: user.lastName,
      };
      req.session.isAuthenticated = true;

      try {
        const resKill = await killOtherSessions(user._id, currentSid);
        if (resKill.deletedCount) {
          console.log(`Killed ${resKill.deletedCount} other sessions for user ${user._id}`);
        }
      } catch (e) {
        console.error('Failed to kill other sessions:', e);
      }

      req.flash('userSuccess', 'Пароль змінено. Вас виведено з інших пристроїв.');
      return res.redirect('/users/' + user._id);
    });
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Не вдалося змінити пароль. Спробуйте пізніше.');
    return res.redirect('/auth/change-password');
  }
};


module.exports = {
  Auth,
  Login,
  Logout,
  ChangePasswordPage,
  ChangePassword,
}
