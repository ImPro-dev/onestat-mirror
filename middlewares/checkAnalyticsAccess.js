// middlewares/checkAnalyticsAccess.js
'use strict';

const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');

/**
 * Decide if currentUser can read stats for targetBuyerUser.
 * - analytics:read:all → yes
 * - analytics:read:dept → if same department
 * - analytics:read:team → if same team
 * - analytics:read:self → if same user
 */
function canReadBuyerStats(currentUser, targetBuyerUser) {
  const scopes = new Set(getUserScopes(currentUser));

  if (scopes.has(SCOPES.ANALYTICS_READ_ALL)) return true;
  if (scopes.has(SCOPES.ANALYTICS_READ_DEPT)) {
    return currentUser.department === targetBuyerUser.department;
  }
  if (scopes.has(SCOPES.ANALYTICS_READ_TEAM)) {
    return String(currentUser.teamId || currentUser.team || '') === String(targetBuyerUser.teamId || targetBuyerUser.team || '');
  }
  // buyer sees self
  return String(currentUser._id) === String(targetBuyerUser._id);
}

/**
 * loadBuyerBy: async (req) => User (resolve buyer by id/slug/etc.)
 */
function requireBuyerAnalyticsAccess(loadBuyerBy) {
  return async (req, res, next) => {
    try {
      const targetBuyer = await loadBuyerBy(req);
      if (!targetBuyer) {
        return res.status(404).render('pages/errors/404', { message: 'Buyer not found' });
      }

      if (!canReadBuyerStats(req.user, targetBuyer)) {
        return res.status(403).render('pages/errors/403', { message: 'Forbidden' });
      }
      next();
    } catch (e) { next(e); }
  };
}

module.exports = {
  canReadBuyerStats,
  requireBuyerAnalyticsAccess
};
