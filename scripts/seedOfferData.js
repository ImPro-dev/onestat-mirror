// EN-only comments per project rules
// Seeds enum-like dictionaries used by Offers (countries, traffic sources, offer models, target conversions)

require('dotenv').config();

const mongoose = require('mongoose');

const seedCountries = require('../seeds/seed.countries.full.js');
const seedTrafficSources = require('../seeds/seed.trafficSources.js');
const seedOfferModels = require('../seeds/seed.offerModels.js');
const seedTargetConversions = require('../seeds/seed.targetConversions.js');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Please provide a valid Mongo connection string in env.');
    process.exit(1);
  }

  // Connect
  await mongoose.connect(uri, {
    // keep defaults simple/compatible
    autoIndex: true
  });
  console.log('✓ Mongo connected');

  try {
    // Run seeds sequentially to keep logs readable
    console.log('→ Seeding countries (full ISO-2, EN/UK + emoji)…');
    await seedCountries();
    console.log('✓ Countries seeded');

    console.log('→ Seeding traffic sources (bot/pwa/botpwa)…');
    await seedTrafficSources();
    console.log('✓ Traffic sources seeded');

    console.log('→ Seeding offer models (CPA/RevShare/Spend)…');
    await seedOfferModels();
    console.log('✓ Offer models seeded');

    console.log('→ Seeding target conversions (dep/qua)…');
    await seedTargetConversions();
    console.log('✓ Target conversions seeded');

    console.log('✅ All enums seeded successfully');
  } catch (err) {
    console.error('❌ Seed failed:', err && err.stack || err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('↩ Mongo disconnected');
  }
}

run();
