'use strict';

// EN-only comments. No external date-fns.
function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const Offer = require('../models/Offer');

async function listOffers(query = {}) {
  const {
    q, country, source, model, target, test, active, postclick,
    sortBy = 'createdAt', sortDir = 'desc',
    page: qPage, limit: qLimit
  } = query;

  const page = Math.max(1, parseInt(qPage, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(qLimit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (country) filter.country = country;
  if (source) filter.source = source;
  if (model) filter.model = model;
  if (target) filter.targetConversion = target;
  if (test === 'true' || test === 'false') filter.isTest = (test === 'true');
  if (active === 'true' || active === 'false') filter.isActive = (active === 'true');
  if (postclick !== undefined && postclick !== null && String(postclick).trim() !== '') {
    const n = Number(postclick);
    if (!Number.isNaN(n)) filter.postclick = n;
  }

  if (q && q.trim()) {
    const or = [
      { offerName: { $regex: q.trim(), $options: 'i' } },
      { bonus: { $regex: q.trim(), $options: 'i' } },
    ];
    const qNum = Number(q);
    if (!Number.isNaN(qNum)) {
      // exact match for current rate via denormalized field
      or.push({ activeRate: qNum });
    }
    filter.$or = or;
  }

  const sortMap = {
    createdAt: 'createdAt',
    name: 'offerName',
    bonus: 'bonus',
    cap: 'cap',
    postclick: 'postclick',
    active: 'isActive',
    rate: 'activeRate'
  };
  const sortField = sortMap[sortBy] || 'createdAt';
  const dir = (String(sortDir).toLowerCase() === 'asc') ? 1 : -1;

  const [items, total] = await Promise.all([
    Offer.find(filter)
      .populate('country source model targetConversion')
      .sort({ [sortField]: dir, _id: dir })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    Offer.countDocuments(filter)
  ]);

  return { items, total, page, limit, sortBy, sortDir };
}

async function createOffer(payload) {
  const now = startOfDay(new Date());
  const {
    offerName, offerId, country, source, bonus, model, targetConversion,
    rateAmount, cap, kpi, link, isTest, notes, postclick
  } = payload;

  const rateNum = Number(rateAmount);

  const doc = new Offer({
    offerName,
    offerId,
    country,
    source,
    bonus,
    model,
    targetConversion,
    cap: (cap === null || cap === undefined || cap === '') ? null : Number(cap),
    kpi: kpi || '',
    link: link || '',
    isTest: !!isTest,
    notes: notes || '',
    postclick: (postclick === null || postclick === undefined || postclick === '') ? null : Number(postclick),
    isActive: true,
    activeRate: rateNum,
    rates: [{ amount: rateNum, validFrom: now, validTo: null }]
  });

  return doc.save();
}

async function updateRate(offerId, amount) {
  const offer = await Offer.findById(offerId);
  if (!offer) throw new Error('Offer not found');
  const now = startOfDay(new Date());
  const val = Number(amount);

  const active = offer.rates.find(r => r.validTo === null);
  if (active) active.validTo = now;

  offer.rates.push({ amount: val, validFrom: now, validTo: null });
  offer.activeRate = val;
  return offer.save();
}

// Update rate with explicit validFrom date (details page).
// Policy:
// - If validFrom <= today: close current active at validFrom, add new open period, update activeRate now.
// - If validFrom  > today: close current active at that future date, add new open period, keep activeRate unchanged.
async function updateRateAt(offerId, amount, validFrom) {
  const offer = await Offer.findById(offerId);
  if (!offer) throw new Error('Offer not found');
  const val = Number(amount);
  if (Number.isNaN(val) || val < 0) throw new Error('Invalid rate amount');

  const vf = new Date(validFrom);
  vf.setHours(0, 0, 0, 0);
  const today = startOfDay(new Date());

  const active = offer.rates.find(r => r.validTo === null);
  if (active) {
    // Close current active exactly at the new start (may be past/today/future)
    active.validTo = vf;
  }

  offer.rates.push({ amount: val, validFrom: vf, validTo: null });

  if (vf.getTime() <= today.getTime()) {
    offer.activeRate = val;
  }

  await offer.save();
  return offer;
}

// Cancel a not-yet-effective rate and reopen the previous period (validTo -> null).
async function cancelFutureRate(offerId, validFrom) {
  const vf = new Date(validFrom);
  vf.setHours(0, 0, 0, 0);
  const today = startOfDay(new Date());

  if (vf.getTime() <= today.getTime()) {
    throw new Error('Можна скасувати лише майбутню ставку.');
  }

  const offer = await Offer.findById(offerId);
  if (!offer) throw new Error('Offer not found');

  // Find the future open period that starts at vf (validTo === null)
  const idx = offer.rates.findIndex(r => {
    if (!r || r.validTo !== null || !r.validFrom) return false;
    const d = new Date(r.validFrom); d.setHours(0, 0, 0, 0);
    return d.getTime() === vf.getTime();
  });
  if (idx === -1) {
    throw new Error('Не знайдено майбутню ставку для скасування.');
  }

  // Remove the future open period
  offer.rates.splice(idx, 1);

  // Reopen the previous period that was closed exactly at vf
  const prev = offer.rates.find(r => {
    if (!r || !r.validTo) return false;
    const d = new Date(r.validTo); d.setHours(0, 0, 0, 0);
    return d.getTime() === vf.getTime();
  });
  if (prev) prev.validTo = null;

  // activeRate remains correct (future scheduling/cancellation does not affect today's active)
  await offer.save();
  return true;
}

async function setActive(offerId, isActive) {
  const updated = await Offer.findByIdAndUpdate(
    offerId,
    { $set: { isActive: !!isActive } },
    { new: true }
  ).lean();
  if (!updated) throw new Error('Offer not found');
  return updated;
}

// Read single offer with populations + derived rateHistory
async function getOfferById(id) {
  const offer = await Offer.findById(id)
    .populate('country source model targetConversion')
    .lean();
  if (!offer) return null;
  const rateHistory = Array.isArray(offer.rates) ? offer.rates.map(r => ({
    amount: r.amount,
    validFrom: r.validFrom,
    validTo: r.validTo
  })) : [];
  return { ...offer, rateHistory };
}

// Update non-rate fields (rate editing is separate)
async function updateOfferBasic(id, payload) {
  const fields = {
    offerName: payload.offerName,
    offerId: payload.offerId,
    country: payload.country,
    source: payload.source,
    model: payload.model,
    targetConversion: payload.targetConversion,
    bonus: payload.bonus || '',
    cap: (payload.cap === '' || payload.cap === null || typeof payload.cap === 'undefined')
      ? null
      : Number(payload.cap),
    kpi: payload.kpi || '',
    link: payload.link || '',
    isTest: !!payload.isTest,
    notes: payload.notes || '',
    postclick: (payload.postclick === '' || payload.postclick === null || typeof payload.postclick === 'undefined')
      ? null
      : Number(payload.postclick)
  };

  const updated = await Offer.findByIdAndUpdate(
    id,
    { $set: fields },
    { new: true }
  );
  if (!updated) throw new Error('Offer not found');
  return updated;
}

module.exports = {
  listOffers,
  createOffer,
  updateRate,
  setActive,
  getOfferById,
  updateOfferBasic,
  updateRateAt,
  cancelFutureRate
};
