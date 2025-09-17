'use strict';

module.exports = function (req, res, next) {
  res.locals.isAuth = req.session.isAuthenticated;

  res.locals.myID = req.session.user?._id;
  res.locals.webID = req.session.user?.webID;
  res.locals.userFirstname = req.session.user?.firstname;
  res.locals.userLastname = req.session.user?.lastname;

  res.locals.role = req.session.user?.role || req.session.user?.orgRole;  // TODO: to be refactored after migration
  res.locals.position = req.session.user?.position;
  res.locals.isUser = req.session.user?.role === 'user';
  res.locals.isManager = req.session.user?.role === 'maneger';
  res.locals.isAdmin = req.session.user?.role === 'admin';

  next();
}
