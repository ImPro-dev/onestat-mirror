'use strict';

const OrgRole = require('../models/OrgRole');
const TeamRole = require('../models/TeamRole');
const Department = require('../models/Department');

let cache = { orgRoles: null, teamRoles: null, departments: null };
let lastLoadAt = 0;
const TTL_MS = 60 * 1000; // 1min

async function loadAll(force = false) {
  const now = Date.now();
  if (!force && cache.orgRoles && now - lastLoadAt < TTL_MS) return cache;

  const [orgRoles, teamRoles, departments] = await Promise.all([
    OrgRole.find({ isActive: true }).sort({ order: 1 }).lean(),
    TeamRole.find({ isActive: true }).sort({ order: 1 }).lean(),
    Department.find({ isActive: true }).sort({ order: 1 }).lean(),
  ]);

  cache = { orgRoles, teamRoles, departments };
  lastLoadAt = now;
  return cache;
}

function mapOptions(rows) {
  return rows.map(r => ({ value: r.value, label: r.label }));
}

async function getOrgRoleOptions() {
  const { orgRoles } = await loadAll();
  return mapOptions(orgRoles);
}
async function getTeamRoleOptions() {
  const { teamRoles } = await loadAll();
  return mapOptions(teamRoles);
}
async function getDepartmentOptions() {
  const { departments } = await loadAll();
  return mapOptions(departments);
}

module.exports = {
  loadAll,
  getOrgRoleOptions,
  getTeamRoleOptions,
  getDepartmentOptions,
  _forceReload: () => loadAll(true),
};
