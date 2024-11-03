const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  if (req.session.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/auth');
  // res.render('index', { title: 'OneStat' });
});

module.exports = router;
