'use strict';

const express = require('express');
const buyingController = require('../controllers/buyingController');
const router = express.Router();
const auth = require('../middlewares/auth');
const role = require('../middlewares/role');

/**
 * GET users listing.
 */
router.get('/',
  auth,
  role('admin', 'manager'),
  buyingController.Team
);

module.exports = router;
