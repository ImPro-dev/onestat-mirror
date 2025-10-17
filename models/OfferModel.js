'use strict';

const mongoose = require('mongoose');

const OfferModelSchema = new mongoose.Schema(
  {
    // CPA, REVSHARE, SPEND
    key: { type: String, required: true, uppercase: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Indexes
OfferModelSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model('OfferModel', OfferModelSchema);
