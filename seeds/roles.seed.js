// seeds/roles.seed.js
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const dbHelper = require('../helpers/dbHelper');

const Department = require('../models/Department');
const OrgRole = require('../models/OrgRole');
const DeptRole = require('../models/DeptRole');
const TeamRole = require('../models/TeamRole');

// --- Базові значення з початкового файлу (Media Buying + Marketing) ---

// Відділи
const DEPARTMENTS = [
  { value: 'Media Buying', label: 'Media Buying', order: 1, isActive: true },
  { value: 'Marketing', label: 'Marketing', order: 2, isActive: true },
];

// OrgRoles (глобальні)
const ORG_ROLES = [
  { value: 'admin', label: 'Administrator', order: 1, isActive: true },
  { value: 'manager', label: 'Manager', order: 2, isActive: true },
  { value: 'user', label: 'User', order: 3, isActive: true },
];

// DeptRoles (per-department labels для 'head')
const DEPT_ROLES = [
  // Media Buying
  { department: 'Media Buying', value: 'head', label: 'Head of Media Buying', order: 10, isActive: true },

  // Marketing
  { department: 'Marketing', value: 'head', label: 'Head of Marketing', order: 10, isActive: true },
];

// TeamRoles (per-department labels)
const TEAM_ROLES = [
  // Media Buying
  { department: 'Media Buying', value: 'lead', label: 'Team Lead of Media Buyers', order: 20, isActive: true },
  { department: 'Media Buying', value: 'member', label: 'Media Buyer', order: 30, isActive: true },
  { department: 'Media Buying', value: 'assistant', label: 'Assistant of Media Buyer', order: 40, isActive: true },

  // Marketing
  { department: 'Marketing', value: 'lead', label: 'Team Lead of Marketers', order: 20, isActive: true },
  { department: 'Marketing', value: 'member', label: 'Marketer', order: 30, isActive: true },
  { department: 'Marketing', value: 'assistant', label: 'Assistant of Marketer', order: 40, isActive: true },
];

// --- Хелпери upsert (без дублікатів) ---

async function upsertByValue(Model, items, kind) {
  for (const item of items) {
    const { value } = item;
    const before = await Model.findOne({ value }).lean();
    await Model.updateOne({ value }, { $set: item }, { upsert: true });
    const after = await Model.findOne({ value }).lean();

    logDiff(kind, before, after, { key: value });
  }
}

async function upsertByDeptAndValue(Model, items, kind) {
  for (const item of items) {
    const { department, value } = item;
    const filter = { department, value };

    const before = await Model.findOne(filter).lean();
    await Model.updateOne(filter, { $set: item }, { upsert: true });
    const after = await Model.findOne(filter).lean();

    logDiff(kind, before, after, { key: `${department}:${value}` });
  }
}

function logDiff(kind, before, after, meta = {}) {
  if (!before && after) {
    console.log(`[${kind}] + created:`, meta, '=>', { label: after.label, order: after.order, isActive: after.isActive });
    return;
  }
  if (before && after) {
    const changes = {};
    for (const k of ['label', 'order', 'isActive']) {
      if (String(before[k]) !== String(after[k])) {
        changes[k] = { from: before[k], to: after[k] };
      }
    }
    if (Object.keys(changes).length) {
      console.log(`[${kind}] ~ updated:`, meta, changes);
    } else {
      console.log(`[${kind}] = unchanged:`, meta);
    }
  }
}

// --- Main ---

async function main() {
  const { MONGODB_URI } = process.env;
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not defined in .env');

  dbHelper.dbConnect(MONGODB_URI);
  console.log('Connecting to', MONGODB_URI);

  // гарантуємо індекси
  await Promise.all([
    Department.syncIndexes(),
    OrgRole.syncIndexes(),
    DeptRole.syncIndexes(),
    TeamRole.syncIndexes(),
  ]);

  // upsert-и
  await upsertByValue(Department, DEPARTMENTS, 'Department');
  await upsertByValue(OrgRole, ORG_ROLES, 'OrgRole');

  await upsertByDeptAndValue(DeptRole, DEPT_ROLES, 'DeptRole');
  await upsertByDeptAndValue(TeamRole, TEAM_ROLES, 'TeamRole');

  console.log('✅ Departments, OrgRoles, DeptRoles, TeamRoles seeded');
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error('Seed failed ❌', err);
    try { await mongoose.disconnect(); } catch { }
    process.exit(1);
  });
