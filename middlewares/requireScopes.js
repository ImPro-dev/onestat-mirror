// middlewares/requireScopes.js
'use strict';

const { getUserScopes } = require('../scripts/permissions/scopes');

function pickUser(req, res) {
  // Пріоритет: varMiddleware -> passport -> session
  return (res?.locals?.user)
    || (res?.locals?.currentUser)
    || req.user
    || req.session?.user
    || null;
}

function requireAny(...needed) {
  return (req, res, next) => {
    const user = pickUser(req, res);
    const scopes = new Set(getUserScopes(user));
    const ok = needed.some(s => scopes.has(s));
    if (!ok) {
      req.flash('error', 'Недостатньо прав для цієї дії.');
      return res.redirect('/dashboard');
    }
    next();
  };
}

function requireAll(...needed) {
  return (req, res, next) => {
    const user = pickUser(req, res);
    const scopes = new Set(getUserScopes(user));
    const ok = needed.every(s => scopes.has(s));
    if (!ok) {
      req.flash('error', 'Недостатньо прав для цієї дії.');
      return res.redirect('/dashboard');
    }
    next();
  };
}

module.exports = { requireAny, requireAll };
