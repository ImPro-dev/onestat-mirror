// middleware/requireScopes.js
'use strict';

const { getUserScopes } = require('../scripts/permissions/scopes');

function requireAll(scopes) {
  return (req, res, next) => {
    const u = req.session?.user;
    if (!u) { req.flash('error', 'Будь ласка, увійдіть'); return res.redirect('/auth'); }

    const have = new Set(getUserScopes(u));
    const ok = scopes.every(s => have.has(s));
    if (!ok) { req.flash('error', 'Недостатньо прав'); return res.redirect('/dashboard'); }
    next();
  };
}

function requireAny(scopes) {
  return (req, res, next) => {
    const u = req.session?.user;
    if (!u) { req.flash('error', 'Будь ласка, увійдіть'); return res.redirect('/auth'); }

    const have = new Set(getUserScopes(u));
    const ok = scopes.some(s => have.has(s));
    if (!ok) { req.flash('error', 'Недостатньо прав'); return res.redirect('/dashboard'); }
    next();
  };
}

module.exports = { requireAll, requireAny };
