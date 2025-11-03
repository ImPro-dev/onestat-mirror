// middlewares/variables.js
'use strict';

const { buildFlags, isAdminUser } = require('../helpers/acl');
const { getUserScopes } = require('../scripts/permissions/scopes');

module.exports = function variablesMiddleware(req, res, next) {
  // 1) Auth/session
  const u = req.session?.user || null;
  res.locals.user = u ? { ...u, id: u.id || (u._id ? String(u._id) : undefined) } : null;
  res.locals.isAuth = !!req.session.isAuthenticated;

  // 2) Canonical helpers (legacy-compatible names)
  const myId = u?.id || (u?._id ? String(u._id) : null);
  res.locals.myID = myId;
  res.locals.webID = u?.webId || null;
  res.locals.userFirstname = u?.firstName || u?.firstname || null;
  res.locals.userLastname = u?.lastName || u?.lastname || null;
  res.locals.role = u?.orgRole || u?.role || null;
  res.locals.position = u?.position || null;

  // 3) Unified scopes & flags (computed ONCE per request)
  // Memoize on req to reuse from other middleware if needed.
  let scopes = req._aclScopes;
  let flags = req._aclFlags;
  if (!(scopes instanceof Set)) {
    scopes = getUserScopes(u || {});
    req._aclScopes = scopes;
  }
  if (!flags) {
    flags = buildFlags(u || {}, scopes);
    req._aclFlags = flags;
  }

  // Expose both Set and array (templates need arrays)
  res.locals.acl = Object.freeze({
    scopes,
    flags,
  });
  res.locals.scopes = Array.from(scopes);
  res.locals.flags = {
    // offers
    canSeeAllOffers: flags.canSeeAllOffers,
    canWriteOffers: flags.canWriteOffers,
    canAssignOffers: flags.canAssignOffers,
    canSeeAssignedOffersOnly: flags.canSeeAssignedOffersOnly,
    // teams
    canManageDept: flags.canManageDept,
    canTeamsWriteAny: flags.canTeamsWriteAny,
    canTeamsWriteOwn: flags.canTeamsWriteOwn,
    // analytics
    canStatsAny: flags.canStatsAny,
    canStatsDept: flags.canStatsDept,
    canStatsTeam: flags.canStatsTeam,
    canStatsSelf: flags.canStatsSelf,
    // users
    canUsersReadAny: flags.canUsersReadAny,
    canUsersWriteAny: flags.canUsersWriteAny,
    canUsersCreateBasic: flags.canUsersCreateBasic,
    canUsersEditBasic: flags.canUsersEditBasic,
  };

  // 4) Legacy booleans (templates only)
  const legacyIsAdmin = isAdminUser(u || {});
  const legacyIsManager = (!legacyIsAdmin && (u?.orgRole === 'manager' || flags.canTeamsWriteAny));
  res.locals.isAdmin = legacyIsAdmin;
  res.locals.isManager = legacyIsManager;
  res.locals.isUser = !legacyIsAdmin && !legacyIsManager;

  // 5) Flash
  res.locals.userError = req.flash('userError');
  res.locals.userSuccess = req.flash('userSuccess');
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');

  // 6) CSRF token (only if csurf is mounted)
  res.locals.csrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : undefined;

  next();
};
