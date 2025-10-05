'use strict';

const OrgRole = require('../models/OrgRole');
const TeamRole = require('../models/TeamRole');
const DeptRole = require('../models/DeptRole');
const Department = require('../models/Department');

// ----- Simple in-memory cache -----
let cache = {
  orgRoles: null,     // [{value,label,order,isActive}]
  teamRoles: null,    // [{value,label,department?,order,isActive}]
  deptRoles: null,    // [{value,label,department?,order,isActive}]
  departments: null,  // [{value,label,order,isActive}]
};
let lastLoadAt = 0;
const TTL_MS = 60 * 1000; // 1 хвилина

function mapOptions(rows) {
  return rows.map(r => ({ value: r.value, label: r.label }));
}

async function loadAll(force = false) {
  const now = Date.now();
  const fresh = (cache.orgRoles && now - lastLoadAt < TTL_MS);
  if (!force && fresh) return cache;

  const [orgRoles, teamRoles, deptRoles, departments] = await Promise.all([
    OrgRole.find({ isActive: true }).sort({ order: 1, value: 1 }).lean(),
    TeamRole.find({ isActive: true }).sort({ department: 1, order: 1, value: 1 }).lean(),
    DeptRole.find({ isActive: true }).sort({ department: 1, order: 1, value: 1 }).lean(),
    Department.find({ isActive: true }).sort({ order: 1, value: 1 }).lean(),
  ]);

  cache = { orgRoles, teamRoles, deptRoles, departments };
  lastLoadAt = now;
  return cache;
}

// ----- Public API -----

// Відділи
async function getDepartmentOptions() {
  const { departments } = await loadAll();
  return mapOptions(departments);
}

// Org roles
async function getOrgRoleOptions() {
  const { orgRoles } = await loadAll();
  return mapOptions(orgRoles);
}

// Team roles: усі департаменти (для глобального фільтра)
async function getTeamRoleOptionsAll() {
  const { teamRoles } = await loadAll();
  return mapOptions(teamRoles);
}

// Team roles: лише для конкретного департаменту
async function getTeamRoleOptionsByDept(department) {
  const { teamRoles } = await loadAll();
  return mapOptions(teamRoles.filter(r => r.department === department));
}

// Dept roles: лише для конкретного департаменту
async function getDeptRoleOptionsByDept(department) {
  const { deptRoles } = await loadAll();
  return mapOptions(deptRoles.filter(r => r.department === department));
}

// Отримати все «як є» (для адмін-UI довідників)
async function getAllEnumsRaw() {
  return await loadAll();
}

// Скинути кеш вручну (після сидів/CRUD)
function invalidateEnumsCache() {
  cache = { orgRoles: null, teamRoles: null, deptRoles: null, departments: null };
  lastLoadAt = 0;
}

module.exports = {
  getDepartmentOptions,
  getOrgRoleOptions,
  getTeamRoleOptionsAll,
  getTeamRoleOptionsByDept,
  getDeptRoleOptionsByDept,
  getAllEnumsRaw,
  invalidateEnumsCache,
};
