// scripts/seedEnums.js
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const dbHelper = require('../helpers/dbHelper');

const OrgRole = require('../models/OrgRole');
const TeamRole = require('../models/TeamRole');
const Department = require('../models/Department');

// Базові значення (можеш редагувати тут або читати з JSON/ENV)
const ORG_ROLES = [
  { value: 'admin', label: 'Admin', order: 1, isActive: true },
  { value: 'manager', label: 'Manager', order: 2, isActive: true },
  { value: 'user', label: 'User', order: 3, isActive: true },
];

const TEAM_ROLES = [
  { value: 'lead', label: 'Lead', order: 1, isActive: true },
  { value: 'member', label: 'Member', order: 2, isActive: true }, // у MB це buyer (лейбл у UI)
  { value: 'assistant', label: 'Assistant', order: 3, isActive: true },
];

const DEPARTMENTS = [
  { value: 'Media Buying', label: 'Media Buying', order: 1, isActive: true },
  { value: 'Marketing', label: 'Marketing', order: 2, isActive: true },
  // додаси 'Marketing' коли потрібно
];

async function upsertMany(Model, items, kind) {
  for (const item of items) {
    const { value, label, order = 0, isActive = true } = item;

    // знайдемо поточний стан для дифа (для інформативного логування)
    const before = await Model.findOne({ value }).lean();

    await Model.updateOne(
      { value },
      { $set: { value, label, order, isActive } },
      { upsert: true }
    );

    const after = await Model.findOne({ value }).lean();

    // короткий диф у лог
    if (!before) {
      console.log(`[${kind}] + created:`, { value, label, order, isActive });
    } else {
      const changes = {};
      for (const k of ['label', 'order', 'isActive']) {
        if (String(before[k]) !== String(after[k])) changes[k] = { from: before[k], to: after[k] };
      }
      if (Object.keys(changes).length) {
        console.log(`[${kind}] ~ updated ${value}:`, changes);
      } else {
        console.log(`[${kind}] = unchanged:`, value);
      }
    }
  }
}

async function main() {
  // DB Connection
  const { MONGODB_URI, SESSION_SECRET, COOKIE_AGE } = process.env;
  dbHelper.dbConnect(MONGODB_URI);
  console.log('Connecting to', MONGODB_URI);

  // гарантуємо наявність індексів (ок, якщо викликається не вперше)
  await Promise.all([
    OrgRole.syncIndexes(),
    TeamRole.syncIndexes(),
    Department.syncIndexes(),
  ]);

  await upsertMany(OrgRole, ORG_ROLES, 'OrgRole');
  await upsertMany(TeamRole, TEAM_ROLES, 'TeamRole');
  await upsertMany(Department, DEPARTMENTS, 'Department');

  console.log('Enums seeded ✅');
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error('Seed failed ❌', err);
    try { await mongoose.disconnect(); } catch { }
    process.exit(1);
  });
