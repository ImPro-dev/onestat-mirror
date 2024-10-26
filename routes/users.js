const express = require('express');
const router = express.Router();
const User = require('../models/user');
const dbHelper = require('../helpers/dbHelper');
const auth = require('../middleware/auth');
const role = require('../middleware/role')

/**
 * GET users listing.
 */
router.get('/',
  auth,
  role('admin', 'manager'),
  async (req, res, next) => {
    const users = await User.find();
    res.render('users/list', {
      title: 'OneStat',
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
    res.render('users/add', {
      title: 'OneStat',
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
      const { name, email, password, webID, role } = req.body;
      const candidate = await User.findOne({ email });

      if (candidate) {
        res.redirect('/users/add');
      } else {
        const hashedPassword = await dbHelper.hashPassword(password);
        const newUser = new User({ name, email, password: hashedPassword, webID, role });
        await newUser.save();
        res.redirect('/users')
      }
    } catch (error) {
      console.log(error);
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

    res.render('users/edit', {
      title: 'OneStat',
      user
    });
  }
);

router.post('/edit',
  auth,
  role('admin', 'manager'),
  async (req, res) => {
    const userData = req.body;
    const { id } = req.body;
    userData.password = await dbHelper.hashPassword(req.body.password);
    delete req.body.id;
    await User.findByIdAndUpdate(id, userData);

    res.redirect('/users');
  }
);


router.get('/:id',
  auth,
  role('admin', 'manager'),
  async (req, res) => {
    const user = await User.findById(req.params.id);

    res.render('users/profile', {
      title: 'OneStat',
      user
    });
  }
);

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
