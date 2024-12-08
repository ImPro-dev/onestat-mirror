'use strict';

module.exports = function (req, res, next) {
  let isAuthenticated = req.session.isAuthenticated;
  let token = req.session.token;

  if (!isAuthenticated) {
    return res.redirect('/auth');
  }
  next();
}
