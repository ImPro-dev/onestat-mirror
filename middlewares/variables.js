// middlewares/variables.js
'use strict';

const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');

module.exports = function variablesMiddleware(req, res, next) {
  // 1) Auth/session
  const u = req.session?.user || null;
  res.locals.user = u ? { ...u, id: u.id || (u._id ? String(u._id) : undefined) } : null;
  res.locals.isAuth = !!req.session.isAuthenticated;

  // 2) Canonical helpers (backward-compatible names)
  const myId = u?.id || (u?._id ? String(u._id) : null);
  res.locals.myID = myId;
  res.locals.webID = u?.webId || null;
  res.locals.userFirstname = u?.firstName || u?.firstname || null;
  res.locals.userLastname = u?.lastName || u?.lastname || null;
  res.locals.role = u?.orgRole || u?.role || null;
  res.locals.position = u?.position || null;

  // 3) Scopes and capability flags (do NOT rely on flags for security;
  //    route guards must still use requireAny/requireAll)
  const scopesArr = Array.isArray(u) ? [] : getUserScopes(u || {});
  const scopes = new Set(scopesArr);

  const isAdminByScope = scopes.has(SCOPES.INTEGRATIONS_ADMIN);
  const isManagerByScope = !isAdminByScope && scopes.has(SCOPES.TEAMS_WRITE_ANY);
  const canManageDept = scopes.has(SCOPES.TEAMS_MANAGE_DEPT);
  const canTeamsWriteAny = scopes.has(SCOPES.TEAMS_WRITE_ANY);
  const canTeamsWriteOwn = scopes.has(SCOPES.TEAMS_WRITE_OWN);

  // Expose raw scopes and grouped flags for templating convenience
  res.locals.scopes = scopesArr;
  res.locals.flags = {
    isAdmin: isAdminByScope,
    isManager: isManagerByScope,
    canManageDept,
    canTeamsWriteAny,
    canTeamsWriteOwn,
  };

  // 4) Legacy booleans (kept for backward-compat in views only).
  //    These mirror scope-based flags and should NOT be used as auth gates.
  const legacyRole = res.locals.role;
  const legacyIsAdmin = (legacyRole === 'admin') || isAdminByScope;
  const legacyIsManager = (!legacyIsAdmin && (legacyRole === 'manager')) || isManagerByScope;
  res.locals.isAdmin = legacyIsAdmin;
  res.locals.isManager = legacyIsManager;
  res.locals.isUser = legacyRole === 'user' && !legacyIsAdmin && !legacyIsManager;

  // 5) Flash
  res.locals.userError = req.flash('userError');
  res.locals.userSuccess = req.flash('userSuccess');
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');

  // 6) CSRF token (present only if csurf is mounted on the route)
  res.locals.csrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : undefined;

  next();
};
