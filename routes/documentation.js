const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth');

/* GET home page. */
router.get('/', auth, function (req, res, next) {
  res.render('documentation', { title: 'OneStat' });
});

module.exports = router;
