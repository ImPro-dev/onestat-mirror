'use strict';

const mongoose = require('mongoose');

const CountrySchema = new mongoose.Schema(
  {
    // ISO 3166-1 alpha-2
    code: { type: String, required: true, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    nameUk: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    emoji: { type: String, required: true },
  },
  { timestamps: true }
);

// Indexes: declare ONLY via schema.index(...)
CountrySchema.index({ code: 1 }, { unique: true });
CountrySchema.index({ nameUk: 1 });

module.exports = mongoose.model('Country', CountrySchema);
