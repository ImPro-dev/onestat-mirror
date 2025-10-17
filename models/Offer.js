'use strict';

const mongoose = require('mongoose');

// Rate period subdocument (with default _id enabled)
const RateSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  validFrom: { type: Date, required: true },
  validTo: { type: Date, default: null },
}); // keep _id for addressing specific periods if needed

const OfferSchema = new mongoose.Schema({
  offerName: { type: String, required: true, trim: true },
  offerId: { type: String, required: true, trim: true },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'TrafficSource', required: true },
  model: { type: mongoose.Schema.Types.ObjectId, ref: 'OfferModel', required: true },
  targetConversion: { type: mongoose.Schema.Types.ObjectId, ref: 'TargetConversion', required: true },

  // history; active rate has validTo = null
  rates: { type: [RateSchema], default: [] },

  // denormalized current active rate (kept in sync in service)
  activeRate: { type: Number, default: null },

  bonus: { type: String, required: true, trim: true },
  cap: { type: Number, default: null },

  // postclick window in days; null means not used
  postclick: { type: Number, default: null },

  kpi: { type: String, default: '' },
  link: { type: String, default: '' },
  isTest: { type: Boolean, default: false },
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Indexes
OfferSchema.index({ offerName: 1 });
OfferSchema.index({ offerId: 1 }, { unique: true }); // unique business id
OfferSchema.index({ country: 1 });
OfferSchema.index({ source: 1 });
OfferSchema.index({ model: 1 });
OfferSchema.index({ targetConversion: 1 });
OfferSchema.index({ isTest: 1 });
OfferSchema.index({ isActive: 1 });
OfferSchema.index({ createdAt: -1 });
OfferSchema.index({ activeRate: 1 }); // for sorting/filtering by current rate
OfferSchema.index({ postclick: 1 });  // for sorting/filtering by postclick
OfferSchema.index({ offerName: 'text', notes: 'text' });

// Guard: only one open rate (validTo=null)
OfferSchema.path('rates').validate(function (arr) {
  if (!Array.isArray(arr)) return true;
  const open = arr.filter(r => r && r.validTo === null).length;
  return open <= 1;
}, 'Only one active rate period (validTo=null) is allowed.');

// Optional: help queries over history
OfferSchema.index({ 'rates.validFrom': 1 });
OfferSchema.index({ 'rates.validTo': 1 });

module.exports = mongoose.model('Offer', OfferSchema);
