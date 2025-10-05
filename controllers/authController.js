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
      deptRole: candidate.deptRole,
      teamRole: candidate.teamRole,
      department: candidate.department,
      assistantOf: candidate.assistantOf,
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

// GET: форма зміни пароля
const ChangePasswordPage = async (req, res) => {
  try {
    return res.render('pages/auth/change-password', {
      title: 'Зміна пароля',
    });
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Помилка при завантаженні сторінки зміни пароля.');
    return res.redirect('/dashboard');
  }
};

// POST: зміна пароля
const ChangePassword = async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.session?.user?._id;
    if (!userId) {
      req.flash('userError', 'Будь ласка, увійди в систему.');
      return res.redirect('/auth');
    }

    // підтримуємо обидва імені поля
    const currentPassword = req.body.currentPassword;
    const { newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash('userError', 'Заповни всі поля форми.');
      return res.redirect('/auth/change-password');
    }
    if (newPassword !== confirmPassword) {
      req.flash('userError', 'Новий пароль і підтвердження не співпадають.');
      return res.redirect('/auth/change-password');
    }
    if (String(newPassword).length < 8) {
      req.flash('userError', 'Новий пароль має містити щонайменше 8 символів.');
      return res.redirect('/auth/change-password');
    }

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      req.flash('userError', 'Користувача не знайдено.');
      return res.redirect('/auth');
    }

    const match = await dbHelper.comparePassword(currentPassword, user.passwordHash);
    if (!match) {
      req.flash('userError', 'Поточний пароль невірний.');
      return res.redirect('/auth/change-password');
    }

    const isSame = await dbHelper.comparePassword(newPassword, user.passwordHash);
    if (isSame) {
      req.flash('userError', 'Новий пароль не може збігатися з поточним.');
      return res.redirect('/auth/change-password');
    }

    const newHash = await dbHelper.hashPassword(newPassword);
    await User.updateOne(
      { _id: userId },
      { $set: { passwordHash: newHash, lastPasswordChangeAt: new Date() } }
    );

    // прибиваємо всі сесії користувача
    // try {
    //   const col = mongoose.connection.collection('sessions');
    //   await col.deleteMany({ session: { $regex: `"id":"${String(userId)}"` } });
    // } catch (e) {
    //   console.error('Failed to revoke sessions after password change:', e);
    // }

    req.flash('userSuccess', 'Пароль успішно змінено.');
    // return res.redirect('/auth');
    return res.redirect('/users/' + userId);
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Сталася помилка при зміні пароля.');
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
