'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { requireAny } = require('../middlewares/requireScopes');
const { SCOPES } = require('../scripts/permissions/scopes');
const offersController = require('../controllers/offersController');
const v = require('../validators/offersValidator');

router.get('/', auth, offersController.getList);

router.get(
  '/create',
  auth,
  requireAny(SCOPES.OFFERS_CREATE_ANY),
  offersController.getCreate
);

router.post(
  '/create',
  auth,
  requireAny(SCOPES.OFFERS_CREATE_ANY),
  v.create,
  offersController.postCreate
);

// Edit offer (read/update)
router.get(
  '/:id/edit',
  auth,
  requireAny(
    SCOPES.OFFERS_ASSIGN_ANY,
    SCOPES.OFFERS_CREATE_ANY,
    SCOPES.TEAMS_MANAGE_DEPT
  ),
  offersController.getEdit
);

router.post(
  '/:id/edit',
  auth,
  requireAny(
    SCOPES.OFFERS_ASSIGN_ANY,
    SCOPES.OFFERS_CREATE_ANY,
    SCOPES.TEAMS_MANAGE_DEPT
  ),
  v.update,
  offersController.postEdit
);

// Toggle isActive via POST (page reload)
router.post(
  '/:id/active',
  auth,
  requireAny(
    SCOPES.OFFERS_ASSIGN_ANY,
    SCOPES.OFFERS_CREATE_ANY,
    SCOPES.TEAMS_MANAGE_DEPT
  ),
  offersController.toggleActive
);

// Update rate (details page inline form)
router.post(
  '/:id/rates/update',
  auth,
  requireAny(
    SCOPES.OFFERS_ASSIGN_ANY,
    SCOPES.OFFERS_CREATE_ANY,
    SCOPES.TEAMS_MANAGE_DEPT
  ),
  offersController.postUpdateRate
);

// Cancel a future scheduled rate
router.post(
  '/:id/rates/cancel',
  auth,
  requireAny(
    SCOPES.OFFERS_ASSIGN_ANY,
    SCOPES.OFFERS_CREATE_ANY,
    SCOPES.TEAMS_MANAGE_DEPT
  ),
  offersController.postCancelRate
);

// Offer details
router.get('/:id', auth, offersController.getDetails);

module.exports = router;
