'use strict';

const mongoose = require('mongoose');

/**
 * OfferAssignment: immutable record that an offer was issued to a user under a given service.
 * No revoke/remove by design (historical record).
 */
const OfferAssignmentSchema = new mongoose.Schema({
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceTemplateId: { type: Number, required: true }, // references ServiceTemplate.keitaroTemplateId

  // Final campaign name used in Keitaro (user-editable before submit via UI)
  campaignName: { type: String, required: true, trim: true },

  // Personal ref link returned by Keitaro for this assignment
  keitaroLink: { type: String, required: false, default: '' },

  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedAt: { type: Date, default: () => new Date() },
}, { timestamps: true });

// Prevent duplicates per (offer, user, serviceTemplateId)
OfferAssignmentSchema.index({ offer: 1, user: 1, serviceTemplateId: 1 }, { unique: true });

// Common queries
OfferAssignmentSchema.index({ user: 1, assignedAt: -1 });
OfferAssignmentSchema.index({ offer: 1, serviceTemplateId: 1 });

module.exports = mongoose.model('OfferAssignment', OfferAssignmentSchema);
