// controllers/offersController.js
'use strict';

// EN-only comments per project rules
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const Country = require('../models/Country');
const TrafficSource = require('../models/TrafficSource');
const OfferModel = require('../models/OfferModel');
const TargetConversion = require('../models/TargetConversion');

const Offer = require('../models/Offer');
const ServiceTemplate = require('../models/ServiceTemplate');
const OfferAssignment = require('../models/OfferAssignment');

const offersService = require('../services/offersService');
const offerAssignmentsService = require('../services/offerAssignmentsService');

const { buildFlags } = require('../helpers/acl');
const { getActor } = require('../helpers/appHelper'); // make sure this exists

// ----------------------- small utils -----------------------
function buildSortUrls(basePath, query, fields) {
  const urls = {};
  const clone = (o) => JSON.parse(JSON.stringify(o || {}));
  fields.forEach((key) => {
    urls[key] = {};
    ['asc', 'desc'].forEach((dir) => {
      const q = clone(query);
      q.sortBy = key;
      q.sortDir = dir;
      const params = new URLSearchParams(q);
      urls[key][dir] = `${basePath}?${params.toString()}`;
    });
  });
  return urls;
}

function buildPagination(basePath, query, total, page, limit) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pages = [];
  const pushPage = (n) => {
    const q = new URLSearchParams({ ...query, page: String(n), limit: String(limit) });
    pages.push({ n, url: `${basePath}?${q.toString()}`, active: n === page });
  };
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  if (start > 1) pushPage(1);
  if (start > 2) pages.push({ n: '…', url: null, active: false });
  for (let n = start; n <= end; n++) pushPage(n);
  if (end < totalPages - 1) pages.push({ n: '…', url: null, active: false });
  if (end < totalPages) pushPage(totalPages);

  const prevUrl = (() => {
    const q = new URLSearchParams({ ...query, page: String(Math.max(1, page - 1)), limit: String(limit) });
    return `${basePath}?${q.toString()}`;
  })();
  const nextUrl = (() => {
    const q = new URLSearchParams({ ...query, page: String(Math.min(totalPages, page + 1)), limit: String(limit) });
    return `${basePath}?${q.toString()}`;
  })();

  return { page, limit, totalPages, pages, prevUrl, nextUrl };
}

function parseListQuery(reqQuery) {
  return {
    q: reqQuery.q || '',
    country: reqQuery.country || '',
    source: reqQuery.source || '',
    model: reqQuery.model || '',
    target: reqQuery.target || '',
    test: reqQuery.test || '',
    active: reqQuery.active || '',
    postclick: reqQuery.postclick || '',
    sortBy: reqQuery.sortBy || 'createdAt',
    sortDir: reqQuery.sortDir || 'desc',
    page: reqQuery.page || '1',
    limit: reqQuery.limit || '20'
  };
}

function mapSort(sortBy, sortDir) {
  const dir = (String(sortDir).toLowerCase() === 'asc') ? 1 : -1;
  switch (String(sortBy)) {
    case 'name': return { offerName: dir };
    case 'bonus': return { bonus: dir };
    case 'rate': return { activeRate: dir };
    case 'cap': return { cap: dir };
    case 'postclick': return { postclick: dir };
    case 'active': return { isActive: dir };
    case 'createdAt':
    default: return { createdAt: dir };
  }
}

function buildOfferFilter(query) {
  const f = {};
  if (query.q && query.q.trim()) {
    const re = new RegExp(query.q.trim(), 'i');
    f.$or = [
      { offerName: re },
      { bonus: re }
    ];
  }
  if (query.country && mongoose.isValidObjectId(query.country)) f.country = new mongoose.Types.ObjectId(query.country);
  if (query.source && mongoose.isValidObjectId(query.source)) f.source = new mongoose.Types.ObjectId(query.source);
  if (query.model && mongoose.isValidObjectId(query.model)) f.model = new mongoose.Types.ObjectId(query.model);
  if (query.target && mongoose.isValidObjectId(query.target)) f.targetConversion = new mongoose.Types.ObjectId(query.target);

  if (query.postclick !== '') {
    const n = Number(query.postclick);
    if (Number.isFinite(n)) f.postclick = n;
  }
  if (query.test === 'true') f.isTest = true;
  if (query.test === 'false') f.isTest = false;
  if (query.active === 'true') f.isActive = true;
  if (query.active === 'false') f.isActive = false;

  return f;
}

function resolveBasePath(req, defaultPath = '/offers') {
  // Prefer explicit query marker from list links (add ?from=my in /my/offers list).
  if (String(req.query?.from || '') === 'my') return '/my/offers';
  // Fallback: check referer.
  const ref = String(req.headers?.referer || '');
  if (ref.includes('/my/offers')) return '/my/offers';
  return defaultPath;
}

// ----------------------- create/edit/list -----------------------
async function getCreate(req, res, next) {
  try {
    const [countries, sources, models, tconv] = await Promise.all([
      Country.find().collation({ locale: 'uk', strength: 1 }).sort({ nameUk: 1, code: 1 }),
      TrafficSource.find().sort({ label: 1 }),
      OfferModel.find().sort({ label: 1 }),
      TargetConversion.find().sort({ label: 1 }),
    ]);

    res.render('pages/offers/create', {
      title: 'Створити офер',
      countries,
      sources,
      models,
      tconv,
    });
  } catch (e) {
    next(e);
  }
}

async function postCreate(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Будь ласка, виправте помилки у формі.');
      res.redirect('/offers/create');
      return next();
    }

    await offersService.createOffer(req.body);
    req.flash('success', 'Офер створено.');
    res.redirect('/offers');
  } catch (e) {
    next(e);
  }
}

async function getList(req, res, next) {
  try {
    const basePath = '/offers';
    const query = parseListQuery(req.query);

    const [{ items, total, page, limit, sortBy, sortDir }, countries, sources, models, tconv] = await Promise.all([
      offersService.listOffers(query),
      Country.find().collation({ locale: 'uk', strength: 1 }).sort({ nameUk: 1, code: 1 }),
      TrafficSource.find().sort({ label: 1 }),
      OfferModel.find().sort({ label: 1 }),
      TargetConversion.find().sort({ label: 1 }),
    ]);

    const sortUrls = buildSortUrls(basePath, req.query, [
      'name', 'bonus', 'rate', 'cap', 'postclick', 'createdAt', 'active'
    ]);
    const pagination = buildPagination(basePath, req.query, total, page, limit);

    const actor = getActor(req, res);
    const flags = buildFlags(actor);

    res.render('pages/offers/list', {
      title: 'Офери',
      basePath,
      formAction: basePath,
      offers: items,
      countries,
      sources,
      models,
      tconv,
      query,
      sortBy,
      sortDir,
      sortUrls,
      pagination,
      csrfToken: res.locals.csrfToken,
      canWriteOffers: !!flags.canWriteOffers,
      canCreateOffers: !!flags.canWriteOffers
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /my/offers — list of offers assigned to current user (buyer/assistant)
 * Uses the same template `pages/offers/list`.
 */
async function getMyList(req, res, next) {
  try {
    const me = getActor(req, res);
    if (!me || !me.id) {
      req.flash('error', 'Ви не авторизовані.');
      return res.redirect('/login');
    }

    const basePath = '/my/offers';

    const query = parseListQuery(req.query);
    const filter = buildOfferFilter(query);
    const sort = mapSort(query.sortBy, query.sortDir);
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, parseInt(query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    // Find assigned offer IDs for the current user
    const assigned = await OfferAssignment.find({ user: me.id }).select('offer').lean();
    const offerIds = assigned.map(a => a.offer).filter(Boolean);
    const [countries, sources, models, tconv] = await Promise.all([
      Country.find().collation({ locale: 'uk', strength: 1 }).sort({ nameUk: 1, code: 1 }),
      TrafficSource.find().sort({ label: 1 }),
      OfferModel.find().sort({ label: 1 }),
      TargetConversion.find().sort({ label: 1 }),
    ]);
    const sortUrls = buildSortUrls(basePath, { ...req.query, from: 'my' }, [
      'name', 'bonus', 'rate', 'cap', 'postclick', 'createdAt', 'active'
    ]);

    if (!offerIds.length) {
      const pagination = buildPagination(basePath, { ...req.query, from: 'my' }, 0, page, limit);
      return res.render('pages/offers/list', {
        title: 'Мої офери',
        basePath,
        formAction: basePath,
        offers: [],
        countries,
        sources,
        models,
        tconv,
        query: { ...query, from: 'my' },
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        sortUrls,
        pagination,
        csrfToken: res.locals.csrfToken,
        canWriteOffers: false,
        canCreateOffers: false
      });
    }

    // Apply filters inside assigned set
    filter._id = { $in: offerIds };

    const [total, rows] = await Promise.all([
      Offer.countDocuments(filter),
      Offer.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('country', 'code nameUk emoji')
        .populate('source', 'label')
        .populate('model', 'label')
        .populate('targetConversion', 'label')
        .lean(),
    ]);

    const pagination = buildPagination(basePath, { ...req.query, from: 'my' }, total, page, limit);

    res.render('pages/offers/list', {
      title: 'Мої офери',
      basePath,
      formAction: basePath,
      offers: rows,
      countries,
      sources,
      models,
      tconv,
      query: { ...query, from: 'my' },
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      sortUrls,
      pagination,
      csrfToken: res.locals.csrfToken,
      canWriteOffers: false,
      canCreateOffers: false
    });
  } catch (e) {
    next(e);
  }
}

async function toggleActive(req, res, next) {
  try {
    const id = req.params.id;
    const isActive =
      req.body && (req.body.isActive === true || String(req.body.isActive) === 'true');

    await offersService.setActive(id, isActive);
    req.flash('success', 'Статус оферу оновлено.');
    return res.redirect('back');
  } catch (e) {
    req.flash('error', e.message || 'Не вдалося оновити статус оферу.');
    return res.redirect('back');
  }
}

// ----------------------- details/edit/rate/assign -----------------------
async function getDetails(req, res, next) {
  try {
    const id = req.params.id;
    const offer = await offersService.getOfferById(id);
    if (!offer) {
      req.flash('error', 'Офер не знайдено.');
      return res.redirect('/offers');
    }

    const actor = getActor(req, res);
    const flags = buildFlags(actor);

    const basePath = resolveBasePath(req, '/offers');

    const [serviceTemplates, assignees] = await Promise.all([
      ServiceTemplate.find({ isActive: true }).sort({ sort: 1, keitaroTemplateId: 1 }).lean(),
      offerAssignmentsService.listAssigneesForOffer(id),
    ]);

    // Personal assignments for this actor (for "My links" block)
    let myAssignments = [];
    if (actor && actor.id) {
      const mine = await OfferAssignment.find({ offer: id, user: actor.id })
        .select('serviceTemplateId campaignName keitaroLink')
        .sort({ assignedAt: 1 })
        .lean();
      myAssignments = (mine || []).map(r => ({
        serviceTemplateId: r.serviceTemplateId,
        campaignName: r.campaignName,
        keitaroLink: r.keitaroLink || null,
      }));
    }

    // SSR list of eligible users (no ajax)
    const eligibleUsers = flags.canAssignOffers
      ? await offerAssignmentsService.findEligibleUsers({ offerId: id, actor, limit: 500 })
      : [];

    res.render('pages/offers/details', {
      title: `Офер: ${offer.offerName}`,
      basePath,
      offer,
      serviceTemplates,
      eligibleUsers,
      assignees,
      myAssignments, // used by details.pug to render "My links"
      canWriteOffers: !!flags.canWriteOffers,
      canAssignOffers: !!flags.canAssignOffers,
      canCreateOffers: !!flags.canWriteOffers
    });
  } catch (e) {
    next(e);
  }
}

async function getEdit(req, res, next) {
  try {
    const id = req.params.id;
    const [offer, countries, sources, models, tconv] = await Promise.all([
      offersService.getOfferById(id),
      Country.find().collation({ locale: 'uk', strength: 1 }).sort({ nameUk: 1, code: 1 }),
      TrafficSource.find().sort({ label: 1 }),
      OfferModel.find().sort({ label: 1 }),
      TargetConversion.find().sort({ label: 1 }),
    ]);
    if (!offer) {
      req.flash('error', 'Офер не знайдено.');
      return res.redirect('/offers');
    }

    const actor = getActor(req, res);
    const flags = buildFlags(actor);

    res.render('pages/offers/edit', {
      title: 'Редагувати офер',
      offer,
      countries,
      sources,
      models,
      tconv,
      canWriteOffers: !!flags.canWriteOffers,
      canCreateOffers: !!flags.canWriteOffers,
      csrfToken: res.locals.csrfToken
    });
  } catch (e) {
    next(e);
  }
}

async function postEdit(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors || !errors.isEmpty()) {
      req.flash('error', 'Будь ласка, виправте помилки у формі.');
      return res.redirect('back');
    }
    const id = req.params.id;
    await offersService.updateOfferBasic(id, req.body);
    req.flash('success', 'Офер оновлено.');
    return res.redirect(`/offers/${id}`);
  } catch (e) {
    next(e);
  }
}

async function postUpdateRate(req, res, next) {
  'use strict';
  try {
    const id = req.params.id;
    const amountRaw = req.body && req.body.newRateAmount;
    const dateRaw = req.body && req.body.newRateValidFrom; // 'YYYY-MM-DD'

    if (amountRaw === undefined || amountRaw === null || amountRaw === '') {
      req.flash('error', 'Вкажіть нову ставку.');
      return res.redirect(`/offers/${id}`);
    }
    const amount = Number(amountRaw);
    if (Number.isNaN(amount) || amount < 0) {
      req.flash('error', 'Ставка має бути числом ≥ 0.');
      return res.redirect(`/offers/${id}`);
    }

    let validFrom = new Date();
    if (dateRaw && typeof dateRaw === 'string') {
      validFrom = new Date(`${dateRaw}T00:00:00`);
    }
    validFrom.setHours(0, 0, 0, 0);

    await offersService.updateRateAt(id, amount, validFrom);
    req.flash('success', 'Ставку оновлено.');
    return res.redirect(`/offers/${id}`);
  } catch (e) {
    req.flash('error', e.message || 'Не вдалося оновити ставку.');
    return res.redirect('back');
  }
}

async function postCancelRate(req, res, next) {
  'use strict';
  try {
    const id = req.params.id;
    const dateRaw = req.body && req.body.validFrom; // 'YYYY-MM-DD'
    if (!dateRaw) {
      req.flash('error', 'Не передано дату початку ставки.');
      return res.redirect(`/offers/${id}`);
    }
    const validFrom = new Date(`${dateRaw}T00:00:00`);
    validFrom.setHours(0, 0, 0, 0);

    await offersService.cancelFutureRate(id, validFrom);
    req.flash('success', 'Майбутню ставку скасовано.');
    return res.redirect(`/offers/${id}`);
  } catch (e) {
    req.flash('error', e.message || 'Не вдалося скасувати ставку.');
    return res.redirect('back');
  }
}

async function postAssign(req, res, next) {
  try {
    const offerId = req.params.id;
    const templateIdRaw = req.body?.templateId;
    const campaignName = (req.body?.campaignName || '').trim();

    // Robust extraction for checkboxes named 'users'
    let targetUserIds = [];
    if (Array.isArray(req.body?.users)) {
      targetUserIds = req.body.users.map(String);
    } else if (typeof req.body?.users === 'string') {
      const s = req.body.users.trim();
      if (s) targetUserIds = s.split(/[\s,;]+/g).map(x => x.trim()).filter(Boolean);
    } else if (Array.isArray(req.body?.['users[]'])) {
      targetUserIds = req.body['users[]'].map(String);
    }

    if (!templateIdRaw) {
      req.flash('error', 'Оберіть сервіс (Service Template).');
      return res.redirect(`/offers/${offerId}`);
    }
    if (!targetUserIds.length) {
      req.flash('error', 'Оберіть хоча б одного баєра.');
      return res.redirect(`/offers/${offerId}`);
    }

    const actor = getActor(req, res);

    const report = await offerAssignmentsService.assignBulk(
      offerId,
      Number(templateIdRaw),
      campaignName,
      targetUserIds,
      actor && (actor._id || actor.id)
    );

    const msgs = [];
    if (report.created && report.created.length) msgs.push(`Створено: ${report.created.length}`);
    if (report.skipped && report.skipped.length) {
      const byReason = report.skipped.reduce((acc, s) => {
        acc[s.reason] = (acc[s.reason] || 0) + 1;
        return acc;
      }, {});
      msgs.push('Пропущено: ' + Object.entries(byReason).map(([k, v]) => `${k}: ${v}`).join(', '));
    }
    if (!msgs.length) msgs.push('Без змін.');

    req.flash('success', msgs);
    return res.redirect(`/offers/${offerId}`);
  } catch (e) {
    req.flash('error', e.message || 'Не вдалося видати офер.');
    return res.redirect('back');
  }
}

async function getAssignees(req, res, next) {
  try {
    const offerId = req.params.id;
    const rows = await offerAssignmentsService.listAssigneesForOffer(offerId);
    return res.json({ items: rows || [] });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getCreate,
  postCreate,
  getList,
  getMyList,
  toggleActive,
  getDetails,
  getEdit,
  postEdit,
  postUpdateRate,
  postCancelRate,
  postAssign,
  getAssignees
};
