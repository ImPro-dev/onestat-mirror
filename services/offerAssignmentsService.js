// services/offerAssignmentsService.js
'use strict';

// EN-only comments
const mongoose = require('mongoose');
const { Types } = mongoose;
const Offer = require('../models/Offer');
const OfferAssignment = require('../models/OfferAssignment');
const ServiceTemplate = require('../models/ServiceTemplate');
const User = require('../models/User');
const { getUserScopes, SCOPES } = require('../scripts/permissions/scopes');
const keitaroService = require('./keitaroService');

// --- helpers ---
function toId(v) { return (v && String(v)) || null; }
function isObjectIdHex(s) { return typeof s === 'string' && /^[a-f\d]{24}$/i.test(s); }
function sameId(a, b) { return toId(a) && toId(b) && String(a) === String(b); }

async function ensureOfferIsActive(offerId) {
  const o = await Offer.findById(offerId).select('_id isActive').lean();
  if (!o) throw new Error('Offer not found');
  if (!o.isActive) {
    const err = new Error('inactiveOffer');
    err.code = 'inactiveOffer';
    throw err;
  }
}

/**
 * Normalize actor capabilities and scope boundaries.
 */
function getActorBounds(actor) {
  const scopes = new Set(getUserScopes(actor || {}));
  const actorDept = actor?.department || null;

  const isAdmin = scopes.has(SCOPES.OFFERS_WRITE_ANY) && (actor?.orgRole === 'admin' || scopes.has(SCOPES.INTEGRATIONS_ADMIN));
  const isHead = scopes.has(SCOPES.TEAMS_MANAGE_DEPT) || scopes.has(SCOPES.OFFERS_WRITE_ANY);
  const isLead = actor?.teamRole === 'lead';

  return { scopes, actorDept, isAdmin, isHead, isLead, actorTeam: toId(actor?.team), actorId: toId(actor?._id || actor?.id) };
}

/**
 * Policy: whether actor can assign an offer to target.
 */
function canAssignOffer(actorBounds, target) {
  const { isAdmin, isHead, isLead, actorDept, actorTeam, actorId } = actorBounds;
  const tDept = target?.department || null;
  const tTeam = toId(target?.team) || null;
  const tOrgRole = target?.orgRole || null;
  const tDeptRole = target?.deptRole || 'none';
  const tTeamRole = target?.teamRole || null;
  const tAssistantOf = toId(target?.assistantOf);

  const isTargetAdmin = (tOrgRole === 'admin');
  const isTargetHead = (tDeptRole === 'head');
  const isTargetAssistant = !!tAssistantOf || tTeamRole === 'assistant';
  if (isTargetAdmin || isTargetHead || isTargetAssistant) return false;

  const isLeadOrMember = (tTeamRole === 'lead' || tTeamRole === 'member');
  if (!isLeadOrMember) return false;

  if (isAdmin) return true;

  if (isHead) {
    if (!actorDept || !tDept) return false;
    return actorDept === tDept;
  }

  if (isLead) {
    if (sameId(actorId, target?._id)) return true;
    if (!actorTeam || !tTeam) return false;
    return actorTeam === tTeam;
  }

  return false;
}

/**
 * Find eligible users for assignment checkbox list.
 */
async function findEligibleUsers({ actor, limit = 500 }) {
  const { isAdmin, isHead, isLead, actorDept, actorTeam, actorId } = getActorBounds(actor);

  const base = { isActive: true, teamRole: { $in: ['lead', 'member'] } };

  if (isAdmin) {
    // global
  } else if (isHead) {
    if (!actorDept) return [];
    base.department = actorDept;
  } else if (isLead) {
    if (!actorTeam) {
      return (actorId ? [{ id: actorId, text: `${actor.firstName || ''} ${actor.lastName || ''}`.trim() }] : []);
    }
    base.$or = [
      { _id: new Types.ObjectId(actorId) },
      { team: new Types.ObjectId(actorTeam) }
    ];
  } else {
    return [];
  }

  const rows = await User.find(base)
    .select('_id firstName lastName webId team teamRole department')
    .sort({ webId: 1 })
    .limit(limit)
    .lean();

  return rows.map(u => ({
    id: String(u._id),
    text: `#${u.webId || ''} ${u.firstName || ''} ${u.lastName || ''}`.trim() || String(u._id)
  }));
}

/**
 * Bulk assignment.
 */
async function assignBulk(offerId, templateId, campaignNameRaw, targetUserIds, assignedById) {
  await ensureOfferIsActive(offerId);

  const targets = Array.from(new Set((targetUserIds || []).map(String).filter(isObjectIdHex)));
  if (!targets.length) return { created: [], skipped: [{ userId: null, reason: 'noUsers' }] };

  const [offer, template, actor, users] = await Promise.all([
    Offer.findById(offerId).select('_id isActive offerName country keitaroNames').lean(),
    ServiceTemplate.findOne({ keitaroTemplateId: Number(templateId), isActive: true }).lean(),
    User.findById(assignedById).lean(),
    User.find({ _id: { $in: targets } })
      .select('_id firstName lastName email department orgRole deptRole teamRole team assistantOf isActive')
      .lean()
  ]);

  if (!offer || !template) throw new Error('Invalid offer/template');
  const bounds = getActorBounds(actor);

  const campaignName = (campaignNameRaw || '').trim();
  const defaultLabel = (template.labelPattern || '')
    .replace('{offerName}', offer.offerName || '')
    .replace('{geo}', (offer.country && offer.country.code) || '');
  const finalCampaignName = campaignName || defaultLabel || `Offer ${offer.offerName}`;

  const created = [];
  const skipped = [];

  const existing = await OfferAssignment.find({
    offer: offer._id,
    user: { $in: users.map(u => u._id) },
    serviceTemplateId: Number(templateId)
  }).select('user serviceTemplateId').lean();
  const existingSet = new Set(existing.map(e => `${String(e.user)}::${e.serviceTemplateId}`));

  for (const u of users) {
    if (!u.isActive) { skipped.push({ userId: String(u._id), reason: 'inactiveUser' }); continue; }
    if (!canAssignOffer(bounds, u)) { skipped.push({ userId: String(u._id), reason: 'policyDenied' }); continue; }

    const dupKey = `${String(u._id)}::${Number(templateId)}`;
    if (existingSet.has(dupKey)) {
      skipped.push({ userId: String(u._id), reason: 'duplicate' });
      continue;
    }

    const base = {
      offer: offer._id,
      user: u._id,
      serviceTemplateId: Number(templateId),
      campaignName: finalCampaignName,
      keitaroLink: null,
      assignedBy: actor?._id || assignedById,
      assignedAt: new Date()
    };

    try {
      const kres = await keitaroService.createCampaignRefLink({
        templateId: Number(templateId),
        campaignName: finalCampaignName,
        offer: { _id: offer._id, offerName: offer.offerName },
        user: { _id: u._id, firstName: u.firstName, lastName: u.lastName },
      });
      if (kres && kres.success && kres.refLink) {
        base.keitaroLink = kres.refLink;
      }
    } catch (e) {
      console.error('[offerAssignmentsService.assignBulk] keitaro mock failed:', e);
    }

    created.push(base);
  }

  if (created.length) {
    await OfferAssignment.insertMany(created, { ordered: false });
    await Offer.updateOne(
      { _id: offer._id },
      { $set: { [`keitaroNames.${Number(templateId)}`]: finalCampaignName } }
    );
  }

  return { created, skipped };
}

/**
 * List assignees for offer (for the details admin block).
 */
async function listAssigneesForOffer(offerId) {
  const rows = await OfferAssignment.find({ offer: offerId })
    .sort({ assignedAt: -1 })
    .populate('user', 'webId firstName lastName email fullName teamRole')
    .populate('assignedBy', 'firstName lastName email fullName')
    .lean();

  return rows.map(r => ({
    user: r.user || null,
    serviceTemplateId: r.serviceTemplateId,
    campaignName: r.campaignName,
    assignedBy: r.assignedBy || null,
    assignedAt: r.assignedAt,
    keitaroLink: r.keitaroLink || null,
  }));
}

/**
 * List assignments for a specific user and offer (for "My links" block).
 */
async function getUserAssignmentsForOffer(offerId, userId) {
  if (!offerId || !userId) return [];
  const rows = await OfferAssignment.find({
    offer: offerId,
    user: userId
  })
    .sort({ assignedAt: -1 })
    .select('serviceTemplateId campaignName keitaroLink assignedAt')
    .lean();

  return rows.map(r => ({
    serviceTemplateId: r.serviceTemplateId,
    campaignName: r.campaignName || null,
    keitaroLink: r.keitaroLink || null,
    assignedAt: r.assignedAt || null,
  }));
}

module.exports = {
  assignBulk,
  listAssigneesForOffer,
  findEligibleUsers,
  getUserAssignmentsForOffer,
};
