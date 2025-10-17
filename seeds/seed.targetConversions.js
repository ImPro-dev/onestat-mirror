const TargetConversion = require('../models/TargetConversion');

const TYPES = [
  { key: 'dep', label: 'DEP' },
  { key: 'qua', label: 'QUA' },
];

module.exports = async function seedTargetConversions() {
  for (const t of TYPES) {
    await TargetConversion.updateOne({ key: t.key }, t, { upsert: true });
  }
};
