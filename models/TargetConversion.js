'use strict';

const mongoose = require('mongoose');

const TargetConversionSchema = new mongoose.Schema(
  {
    // dep, qua
    key: { type: String, required: true, lowercase: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Indexes
TargetConversionSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model('TargetConversion', TargetConversionSchema);
