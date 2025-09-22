'use strict';

module.exports = function auth(req, res, next) {
  const user = req.session?.user || null;

  // Якщо не авторизований
  if (!req.session?.isAuthenticated || !user) {
    return res.redirect('/auth');
  }

  // Якщо юзер деактивований — дропаємо сесію
  if (user.isActive === false) {
    req.session.destroy(() => {
      res.redirect('/auth');
    });
    return;
  }

  next();
};
