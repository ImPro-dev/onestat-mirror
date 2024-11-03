const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');

/* GET Instruction setup. */
router.get('/setup',
  auth,
  role('admin', 'manager', 'user'),
  function (req, res, next) {
    res.render('pages/doc-setup', { title: 'Налаштування' });
  });

/* GET Instruction usage. */
router.get('/usage',
  auth,
  role('admin', 'manager', 'user'),
  function (req, res, next) {
    res.render('pages/doc-usage', { title: 'Використання' });
  });

module.exports = router;
