const { Router } = require('express');
const router = Router();
const jwt = require('jsonwebtoken');
const dbHelper = require('../helpers/dbHelper');
const User = require('../models/user');

router.get('/', async (req, res, next) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.render('pages/login', {
    title: 'Авторизація',
    isLogin: true,
    error: req.flash('error')
  });
});

router.post('/login', async (req, res) => {
  try {
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
