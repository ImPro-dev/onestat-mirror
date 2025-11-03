'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const ServiceTemplate = require('../models/ServiceTemplate');

const TEMPLATES = [
  { keitaroTemplateId: 5786, labelPattern: 'app[PWASkak] {offerName} [{geo}]', sort: 10 },
  { keitaroTemplateId: 5787, labelPattern: 'app[ZM_IOS] {offerName} [{geo}]', sort: 20 },
  { keitaroTemplateId: 5788, labelPattern: 'app[WWApps-IOS] {offerName} [{geo}]', sort: 30 },
  { keitaroTemplateId: 5789, labelPattern: 'app[PWAGroup] {offerName} [{geo}]', sort: 40 },
  { keitaroTemplateId: 5790, labelPattern: 'Mini[APP] {offerName} [{geo}]', sort: 50 },
  { keitaroTemplateId: 6185, labelPattern: 'app[Linki.group] {offerName} [{geo}]', sort: 60 },
  { keitaroTemplateId: 6376, labelPattern: 'app[WWA_IOS] {offerName} [{geo}]', sort: 70 },
  { keitaroTemplateId: 6289, labelPattern: 'app[WWA_WebView] {offerName} [{geo}]', sort: 80 },
  { keitaroTemplateId: 7749, labelPattern: 'loader[web] {offerName} [{geo}]', sort: 90 },
];

async function upsertTemplates() {
  for (const t of TEMPLATES) {
    await ServiceTemplate.updateOne(
      { keitaroTemplateId: t.keitaroTemplateId },
      { $set: t, $setOnInsert: { isActive: true } },
      { upsert: true }
    );
  }
}

async function run(connectionString) {
  await mongoose.connect(connectionString, {});
  await upsertTemplates();
  await mongoose.disconnect();
  // eslint-disable-next-line no-console
  console.log('Service templates seed completed.');
}

if (require.main === module) {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    // eslint-disable-next-line no-console
    console.error('Please set MONGODB_URI env');
    process.exit(1);
  }
  run(uri).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { upsertTemplates };
