'use strict';

// EN-only comments per project rules
const { validationResult } = require('express-validator');
const Country = require('../models/Country');
const TrafficSource = require('../models/TrafficSource');
const OfferModel = require('../models/OfferModel');
const TargetConversion = require('../models/TargetConversion');
const offersService = require('../services/offersService');
const { getUserScopes, SCOPES } = require('../scripts/permissions/scopes');

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

// Normalize user and build offer permissions (robust to populated roles)
function computeOfferPermissions(req, res) {
  const user =
    (res && res.locals && (res.locals.user || res.locals.currentUser)) ||
    req.user ||
    (req.session && req.session.user) ||
    null;

  const base = getUserScopes(user);
  const scopes = base instanceof Set ? new Set(base) : new Set(base || []);

  const rawOrgRole =
    (user && (user.orgRole?.value || user.orgRole || user.orgrole?.value || user.orgrole)) || '';
  const orgRole = String(rawOrgRole).toLowerCase();

  if (orgRole === 'admin') {
    Object.values(SCOPES).forEach((s) => scopes.add(s));
  }

  const canWriteOffers =
    scopes.has(SCOPES.OFFERS_ASSIGN_ANY) ||
    scopes.has(SCOPES.OFFERS_CREATE_ANY) ||
    scopes.has(SCOPES.TEAMS_MANAGE_DEPT);
  const canCreateOffers = scopes.has(SCOPES.OFFERS_CREATE_ANY);

  return { canWriteOffers, canCreateOffers, scopes };
}

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
    const query = {
      q: req.query.q || '',
      country: req.query.country || '',
      source: req.query.source || '',
      model: req.query.model || '',
      target: req.query.target || '',
      test: req.query.test || '',
      active: req.query.active || '',
      postclick: req.query.postclick || '',
      sortBy: req.query.sortBy || 'createdAt',
      sortDir: req.query.sortDir || 'desc',
      page: req.query.page || '1',
      limit: req.query.limit || '20'
    };

    const [{ items, total, page, limit, sortBy, sortDir }, countries, sources, models, tconv] = await Promise.all([
      offersService.listOffers(query),
      Country.find().collation({ locale: 'uk', strength: 1 }).sort({ nameUk: 1, code: 1 }),
      TrafficSource.find().sort({ label: 1 }),
      OfferModel.find().sort({ label: 1 }),
      TargetConversion.find().sort({ label: 1 }),
    ]);

    const sortUrls = buildSortUrls('/offers', req.query, [
      'name', 'bonus', 'rate', 'cap', 'postclick', 'createdAt', 'active'
    ]);
    const pagination = buildPagination('/offers', req.query, total, page, limit);
    const { canWriteOffers, canCreateOffers } = computeOfferPermissions(req, res);

    res.render('pages/offers/list', {
      title: 'Офери',
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
      canWriteOffers,
      canCreateOffers
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

// Details page
async function getDetails(req, res, next) {
  try {
    const id = req.params.id;
    const offer = await offersService.getOfferById(id);
    if (!offer) {
      req.flash('error', 'Офер не знайдено.');
      return res.redirect('/offers');
    }
    const { canWriteOffers, canCreateOffers } = computeOfferPermissions(req, res);

    res.render('pages/offers/details', {
      title: `Офер: ${offer.offerName}`,
      offer,
      canWriteOffers,
      canCreateOffers
    });
  } catch (e) {
    next(e);
  }
}

// Edit page
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

    const { canWriteOffers, canCreateOffers } = computeOfferPermissions(req, res);
    res.render('pages/offers/edit', {
      title: `Редагувати офер`,
      offer,
      countries,
      sources,
      models,
      tconv,
      canWriteOffers,
      canCreateOffers,
      csrfToken: res.locals.csrfToken
    });
  } catch (e) {
    next(e);
  }
}

// Edit submit (basic fields; rate is managed in step 3)
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

// Update rate from details page
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

// Cancel a future rate period (validFrom > today, validTo must be null)
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

module.exports = {
  getCreate,
  postCreate,
  getList,
  toggleActive,
  getDetails,
  getEdit,
  postEdit,
  postUpdateRate,
  postCancelRate
};
