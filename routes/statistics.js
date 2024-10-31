const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth');

/* GET home page. */
router.get('/', auth, function (req, res, next) {
  res.render('pages/manual_statistics/statistics', {
    title: 'Статистика',
    csvError: req.flash('csvError')
  });
});

module.exports = router;
