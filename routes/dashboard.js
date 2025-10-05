const { Router } = require('express');
const router = Router();
const auth = require('../middlewares/auth');
const role = require('../middlewares/role');

/* GET home page. */
router.get('/',
  auth,
  // role('admin', 'manager', 'user'),
  function (req, res, next) {
    res.render('pages/dashboard', { title: 'Дашборд' });
  });

module.exports = router;
