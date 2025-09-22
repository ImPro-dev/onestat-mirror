const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireScopes } = require('../middleware/requireScopes');
const { SCOPES } = require('../scripts/permissions/scopes');
const teamController = require('../controllers/teamController');

// Сторінка створення — для admin/manager (глобальні)
router.get('/create',
  auth,
  requireScopes([SCOPES.TEAMS_WRITE_ANY]),
  teamController.CreateTeamPage
);

router.post('/create',
  auth,
  requireScopes([SCOPES.TEAMS_WRITE_ANY]),
  teamController.CreateTeam
);

module.exports = router;
