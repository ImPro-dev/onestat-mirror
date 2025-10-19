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

  // 3) Effective scopes and convenience flags for views.
  //    IMPORTANT: Do NOT rely on flags for security; routes must still guard with requireAny/requireAll.
  const scopesArr = Array.isArray(u) ? [] : Array.from(getUserScopes(u || {}));
  const scopes = new Set(scopesArr);

  // Offer-related flags
  const canSeeAllOffers = scopes.has(SCOPES.OFFERS_READ_ANY);
  const canWriteOffers = scopes.has(SCOPES.OFFERS_WRITE_ANY);
  const canAssignOffers = scopes.has(SCOPES.OFFERS_ASSIGN_TEAM) || canWriteOffers;
  const canSeeAssignedOffersOnly = scopes.has(SCOPES.OFFERS_READ_ASSIGNED) && !canSeeAllOffers;

  // Teams flags
  const canManageDept = scopes.has(SCOPES.TEAMS_MANAGE_DEPT);
  const canTeamsWriteAny = scopes.has(SCOPES.TEAMS_WRITE_ANY);
  const canTeamsWriteOwn = scopes.has(SCOPES.TEAMS_WRITE_OWN);

  // Analytics flags
  const canStatsAny = scopes.has(SCOPES.ANALYTICS_READ_ALL);
  const canStatsDept = scopes.has(SCOPES.ANALYTICS_READ_DEPT);
  const canStatsTeam = scopes.has(SCOPES.ANALYTICS_READ_TEAM);
  const canStatsSelf = scopes.has(SCOPES.ANALYTICS_READ_SELF);

  // Expose raw scopes and grouped flags
  res.locals.scopes = scopesArr;
  res.locals.flags = {
    canSeeAllOffers,
    canWriteOffers,
    canAssignOffers,
    canSeeAssignedOffersOnly,

    canManageDept,
    canTeamsWriteAny,
    canTeamsWriteOwn,

    canStatsAny,
    canStatsDept,
    canStatsTeam,
    canStatsSelf,
  };

  // 4) Legacy booleans (for templates only; keep behavior stable)
  const legacyRole = res.locals.role;
  const legacyIsAdmin = legacyRole === 'admin' || scopes.has(SCOPES.INTEGRATIONS_ADMIN);
  const legacyIsManager = (!legacyIsAdmin && legacyRole === 'manager') || canTeamsWriteAny;
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
