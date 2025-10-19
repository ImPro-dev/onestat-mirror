// routes/teams.js
'use strict';

const router = require('express').Router();
const {
  createTeam,
  updateTeam,
  getDeptTeamsTree,
  renderDeptTeamsPage,
  renderDeptManagementPage,
} = require('../controllers/teamsController');

const { requireAny } = require('../middlewares/requireScopes');
const { SCOPES } = require('../scripts/permissions/scopes');

// ---------- SSR pages ----------
// Teams → Media Buying (tree view)
router.get('/mediabuying', requireAny(SCOPES.TEAMS_READ_ANY), (req, res, next) =>
  renderDeptTeamsPage(req, res, next, { department: 'Media Buying' })
);

// Teams → Media Buying → Management (table)
// Allow INTEGRATIONS_ADMIN (admin) or dept Head (TEAMS_MANAGE_DEPT)
router.get('/mediabuying/management',
  requireAny(SCOPES.INTEGRATIONS_ADMIN, SCOPES.TEAMS_MANAGE_DEPT),
  (req, res, next) => renderDeptManagementPage(req, res, next, { department: 'Media Buying' })
);

// ---------- API ----------
router.get('/tree', requireAny(SCOPES.TEAMS_READ_ANY), getDeptTeamsTree);
router.post('/', requireAny(SCOPES.TEAMS_WRITE_ANY), createTeam);
router.patch('/:id', requireAny(SCOPES.TEAMS_WRITE_ANY), updateTeam);

module.exports = router;
