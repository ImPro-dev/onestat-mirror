// middleware/variables.js
'use strict';

module.exports = function (req, res, next) {
  // auth/session info
  const u = req.session?.user || null;
  res.locals.user = u;
  res.locals.isAuth = !!req.session.isAuthenticated;

  // id може бути _id або id (toString())
  res.locals.myID = u?.id || (u?._id ? String(u._id) : null);

  // кілька зручних полів (не обов’язкові — будуть undefined/null)
  res.locals.webID = u?.webId || null;
  res.locals.userFirstname = u?.firstName || u?.firstname || null;
  res.locals.userLastname = u?.lastName || u?.lastname || null;
  res.locals.role = u?.orgRole || u?.role || null;
  res.locals.position = u?.position || null;

  // швидкі прапорці (історичні; не покладайся на них для безпеки)
  res.locals.isUser = res.locals.role === 'user';
  res.locals.isManager = res.locals.role === 'manager';
  res.locals.isAdmin = res.locals.role === 'admin';

  // flash (уніфіковано)
  res.locals.userError = req.flash('userError');
  res.locals.userSuccess = req.flash('userSuccess');
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');

  // csrfToken: якщо на маршруті підключений csurf — метод існує
  res.locals.csrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : undefined;

  next();
};
