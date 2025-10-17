'use strict';

const mongoose = require('mongoose');

const TrafficSourceSchema = new mongoose.Schema(
  {
    // e.g. bot, pwa, botpwa
    key: { type: String, required: true, lowercase: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Indexes
TrafficSourceSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model('TrafficSource', TrafficSourceSchema);
