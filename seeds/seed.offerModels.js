const OfferModel = require('../models/OfferModel');

const MODELS = [
  { key: 'CPA', label: 'CPA' },
  { key: 'REVSHARE', label: 'RevShare' },
  { key: 'SPEND', label: 'Spend' },
];

module.exports = async function seedOfferModels() {
  for (const m of MODELS) {
    await OfferModel.updateOne({ key: m.key }, m, { upsert: true });
  }
};
