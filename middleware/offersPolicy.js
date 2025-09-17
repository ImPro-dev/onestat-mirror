'use strict';

const { SCOPES, getUserScopes, getTeamCaps } = require('../scripts/permissions/scopes');
const { inSameTeam, sameDepartment } = require('./accessHelpers');

/**
 * Хто може призначати офер баєру?
 * - admin → будь-кому
 * - manager → у своєму департаменті
 * - team lead → тільки своїм членам команди
 */
function canAssignOffer(assigner, targetUser) {
  const scopes = new Set(getUserScopes(assigner));
  if (scopes.has(SCOPES.OFFERS_ASSIGN_ANY)) {
    // як правило, це manager + admin
    if (assigner.orgRole === 'admin') return true; // глобально
    // manager — лише у своєму департаменті
    return sameDepartment(assigner, targetUser);
  }

  // локально для ліда
  const caps = getTeamCaps(assigner);
  if (caps.has(SCOPES.OFFERS_ASSIGN_OWN)) {
    return inSameTeam(assigner, targetUser);
  }

  return false;
}

/**
 * Мідлвар із завантаженням targetUser
 * getTargetUser: async (req) => user
 */
function requireCanAssignOffer(getTargetUser) {
  return async (req, res, next) => {
    try {
      const targetUser = await getTargetUser(req);
      if (!targetUser) return res.status(404).render('pages/errors/404', { message: 'User not found' });
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
