module.exports = function (req, res, next) {
  res.locals.isAuth = req.session.isAuthenticated;

  res.locals.webID = req.session.user?.webID;
  res.locals.username = req.session.user?.name;
  res.locals.isUser = req.session.user?.role === 'user';
  res.locals.isManager = req.session.user?.role === 'maneger';
  res.locals.isAdmin = req.session.user?.role === 'admin';


  next();
}
