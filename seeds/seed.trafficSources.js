const TrafficSource = require('../models/TrafficSource');

const SOURCES = [
  { key: 'bot', label: 'Bot' },
  { key: 'pwa', label: 'PWA' },
  { key: 'botpwa', label: 'Bot+PWA' },
];

module.exports = async function seedTrafficSources() {
  for (const s of SOURCES) {
    await TrafficSource.updateOne({ key: s.key }, s, { upsert: true });
  }
};
