'use strict';

const express = require('express');
const buyingController = require('../controllers/buyingController');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');

/**
 * GET users listing.
 */
router.get('/',
  auth,
  role('admin', 'manager'),
  buyingController.Team
);

module.exports = router;
