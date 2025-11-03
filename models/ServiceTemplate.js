'use strict';

const mongoose = require('mongoose');

/**
 * ServiceTemplate: Keitaro service presets (ID + labelPattern).
 * Used when issuing offers to buyers under a specific service.
 */
const ServiceTemplateSchema = new mongoose.Schema({
  keitaroTemplateId: { type: Number, required: true }, // e.g. 5786, 5787, ...
  labelPattern: { type: String, required: true },      // e.g. "app[PWASkak] {offerName} [{geo}]"
  isActive: { type: Boolean, default: true },
  sort: { type: Number, default: 0 },
}, { timestamps: true });

// Indexes
ServiceTemplateSchema.index({ keitaroTemplateId: 1 }, { unique: true });
ServiceTemplateSchema.index({ isActive: 1, sort: 1 });

module.exports = mongoose.model('ServiceTemplate', ServiceTemplateSchema);
