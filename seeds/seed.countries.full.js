// Seeds full ISO 3166-1 alpha-2 list using i18n-iso-countries
const Country = require('../models/Country');
const countries = require('i18n-iso-countries');

countries.registerLocale(require('i18n-iso-countries/langs/en.json'));
countries.registerLocale(require('i18n-iso-countries/langs/uk.json'));

function flagEmojiFromISO2(code) {
  return code.replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt()));
}

module.exports = async function seedCountriesFull() {
  const codes = countries.getAlpha2Codes(); // { UA: 'Ukraine', ... }
  for (const code of Object.keys(codes)) {
    const nameEn = countries.getName(code, 'en');
    const nameUk = countries.getName(code, 'uk') || nameEn;
    await Country.updateOne(
      { code },
      { code, nameEn, nameUk, emoji: flagEmojiFromISO2(code) },
      { upsert: true }
    );
  }
};
