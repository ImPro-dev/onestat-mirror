'use strict';

const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');

function canReadBuyerStats(currentUser, targetBuyerUser) {
  const scopes = new Set(getUserScopes(currentUser));

  if (scopes.has(SCOPES.ANALYTICS_READ_ALL)) return true;
  if (scopes.has(SCOPES.ANALYTICS_READ_DEPT)) {
    return currentUser.department === targetBuyerUser.department;
  }
  // buyer бачить своє
  return String(currentUser._id) === String(targetBuyerUser._id);
}

function requireBuyerAnalyticsAccess(loadBuyerBy) {
  // loadBuyerBy: async (req) => User (має повернути користувача-баєра за buyerId/slug тощо)
  return async (req, res, next) => {
    try {
      const targetBuyer = await loadBuyerBy(req);
      if (!targetBuyer) return res.status(404).render('pages/errors/404', { message: 'Buyer not found' });

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
