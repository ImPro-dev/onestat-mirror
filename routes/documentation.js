const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');

/* GET home page. */
router.get('/',
  auth,
  role('admin', 'manager', 'user'),
  function (req, res, next) {
    res.render('pages/documentation', { title: 'Інструкція' });
  });

module.exports = router;
