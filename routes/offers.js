// routes/offers.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { requireAny } = require('../middlewares/requireScopes');
const { SCOPES } = require('../scripts/permissions/scopes');
const offersController = require('../controllers/offersController');
const v = require('../validators/offersValidator');

// Listing: currently open to any authenticated user (your controller may filter by scopes).
router.get('/', auth, offersController.getList);
router.get('/my', offersController.getMyList);

// Create
router.get(
  '/create',
  auth,
  requireAny(SCOPES.OFFERS_WRITE_ANY),
  offersController.getCreate
);

router.post(
  '/create',
  auth,
  requireAny(SCOPES.OFFERS_WRITE_ANY),
  v.create,
  offersController.postCreate
);

// Edit (read/update)
router.get(
  '/:id/edit',
  auth,
  requireAny(SCOPES.OFFERS_WRITE_ANY),
  offersController.getEdit
);

router.post(
  '/:id/edit',
  auth,
  requireAny(SCOPES.OFFERS_WRITE_ANY),
  v.update,
  offersController.postEdit
);

// Toggle isActive via POST (page reload)
router.post(
  '/:id/active',
  auth,
  requireAny(SCOPES.OFFERS_WRITE_ANY),
  offersController.toggleActive
);

// Update rate (details page inline form)
router.post(
  '/:id/rates/update',
  auth,
  requireAny(SCOPES.OFFERS_WRITE_ANY),
  offersController.postUpdateRate
);

// Cancel a future scheduled rate
router.post(
  '/:id/rates/cancel',
  auth,
  requireAny(SCOPES.OFFERS_WRITE_ANY),
  offersController.postCancelRate
);

// ---- Offer Assignment ----
router.post(
  '/:id/assignment',
  auth,
  requireAny(
    SCOPES.OFFERS_ASSIGN_ANY,
    SCOPES.OFFERS_ASSIGN_OWN,
    SCOPES.OFFERS_ASSIGN_TEAM
  ),
  offersController.postAssign
);

router.get(
  '/:id/assignees',
  auth,
  offersController.getAssignees
);

// Details
router.get('/:id', auth, offersController.getDetails);

module.exports = router;
