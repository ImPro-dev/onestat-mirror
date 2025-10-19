// middlewares/offersPolicy.js
'use strict';

const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');
const { inSameTeam, sameDepartment } = require('./accessHelpers');

/**
 * Who can assign an offer to a buyer?
 * - Admin / Head (OFFERS_WRITE_ANY or TEAMS_MANAGE_DEPT) → can assign broadly (policy can be tightened to dept)
 * - Team lead → can assign to members of own team (OFFERS_ASSIGN_TEAM)
 */
function canAssignOffer(assigner, targetUser) {
  const scopes = new Set(getUserScopes(assigner));

  // Broad write rights imply assign (admin/head/managers)
  if (scopes.has(SCOPES.OFFERS_WRITE_ANY)) {
    // You can restrict to same department if needed:
    // return sameDepartment(assigner, targetUser);
    return true;
  }
  if (scopes.has(SCOPES.TEAMS_MANAGE_DEPT)) {
    return sameDepartment(assigner, targetUser);
  }

  // Team lead can assign to their own team members
  if (scopes.has(SCOPES.OFFERS_ASSIGN_TEAM)) {
    return inSameTeam(assigner, targetUser);
  }

  return false;
}

/**
 * Middleware with target user loader.
 * getTargetUser: async (req) => user
 */
function requireCanAssignOffer(getTargetUser) {
  return async (req, res, next) => {
    try {
      const targetUser = await getTargetUser(req);
      if (!targetUser) {
        return res.status(404).render('pages/errors/404', { message: 'User not found' });
      }
      if (!canAssignOffer(req.user, targetUser)) {
        return res.status(403).render('pages/errors/403', { message: 'Forbidden' });
      }
      next();
    } catch (e) { next(e); }
  };
}

module.exports = {
  canAssignOffer,
  requireCanAssignOffer
};
