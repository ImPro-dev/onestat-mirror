const express = require('express');
const router = express.Router();
const User = require('../models/user');
const dbHelper = require('../helpers/dbHelper');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

/**
 * GET users listing.
 */
router.get('/',
  auth,
  role('admin', 'manager'),
  async (req, res, next) => {
    const users = await User.find();
    res.render('pages/users/list', {
      title: 'Користувачі',
      userError: req.flash('userError'),
      users
    });
  });

/**
 * Rendering form to create new user
 */
router.get('/add',
  auth,
  role('admin', 'manager'),
  function (req, res) {
    res.render('pages/users/add', {
      title: 'Новий користувач',
      userError: req.flash('userError')
    });
  }
);

/**
 * Create new user
 */
router.post('/add',
  auth,
  role('admin', 'manager'),
  async (req, res) => {
    try {
      const { firstname, lastname, email, password, telegram, position, webID, role } = req.body;
      const candidate = await User.findOne({ email });

      if (candidate) {
        res.redirect('/users/add');
      } else {
        const hashedPassword = await dbHelper.hashPassword(password);
        const newUser = new User({ firstname, lastname, email, password: hashedPassword, telegram, position, webID, role });
        await newUser.save();
        res.redirect('/users')
      }
    } catch (error) {
      console.log(error);
      req.flash('userError', 'Сталася помилка, звернись до Ігоря. ' + error.message);
      res.redirect('/users/add')
    }
  }
);

/**
 * Rendering form to edit existinf user
 */
router.get('/edit/:id',
  auth,
  role('admin', 'manager'),
  async (req, res) => {
    if (!req.query.allow) {
      return res.redirect('/users');
    }

    const user = await User.findById(req.params.id);

    res.render('pages/users/edit', {
      title: 'Редагувати дані користувача',
      user
    });
  }
);

/**
 * Edit user data
 */
router.post('/edit',
  auth,
  role('admin', 'manager'),
  async (req, res) => {
    try {
      const userData = req.body;
      const { id } = req.body;
      userData.password = await dbHelper.hashPassword(req.body.password);
      delete req.body.id;
      await User.findByIdAndUpdate(id, userData);

      res.redirect('/users');
    } catch (error) {
      console.log(error);
      req.flash('userError', 'Сталася помилка, звернись до Ігоря. ' + error.message);
      res.redirect('/users')
    }
  }
);

/**
 * User profile page (access for all)
 */
router.get('/:id',
  auth,
  role('admin', 'manager', 'user'),
  async (req, res) => {
    let _id = req.params.id;
    let myID = res.locals.myID;
    let isUser = res.locals.isUser;

    if (isUser && _id != myID) {
      return res.redirect('/');
    }
    const user = await User.findById(_id);

    res.render('pages/users/profile', {
      title: 'Профіль',
      user
    });
  }
);

/**
 * User profile page (access for user)
 */
// router.get('/profile/:id',
//   auth,
//   role('admin', 'manager', 'user'),
//   async (req, res) => {

//     if (req.params.id) {
//       const user = await User.findById(req.params.id);

//       res.render('pages/users/profile', {
//         title: 'Профіль',
//         user
//       });
//     } else {
//       return res.redirect('/');
//     }
//   }
// );

/**
 * Remove user
 */
router.get('/remove/:id',
  auth,
  role('admin', 'manager'),
  async (req, res) => {
    try {
      await User.deleteOne({ _id: req.params.id });
      res.redirect('/users');
    } catch (error) {
      console.log(error);
    }
  }
);

module.exports = router;
