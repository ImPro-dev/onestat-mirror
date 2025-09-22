'use strict';

module.exports = function variables(req, res, next) {
  const user = req.session?.user || null;

  // Чи авторизований
  res.locals.isAuth = !!req.session?.isAuthenticated;

  // Базові ідентифікатори
  res.locals.myID = user ? String(user._id || user.id || '') : null;
  res.locals.webID = user?.webId || null;

  // Імʼя/прізвище
  res.locals.userFirstname = user?.firstName || '';
  res.locals.userLastname = user?.lastName || '';

  // Ролі
  const orgRole = user?.orgRole || null;
  res.locals.role = orgRole;
  res.locals.isUser = orgRole === 'user';
  res.locals.isManager = orgRole === 'manager';
  res.locals.isAdmin = orgRole === 'admin';

  // Додаткові зручності
  res.locals.position = user?.position || '';
  res.locals.department = user?.department || '';
  res.locals.teamRole = user?.teamRole || null;
  res.locals.fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

  next();
};
