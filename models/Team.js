'use strict';

const { Schema, model, Types } = require('mongoose');

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 128 },
    department: { type: String, required: true, trim: true, maxlength: 128, index: true },
    lead: { type: Types.ObjectId, ref: 'User', required: true },
    members: [{ type: Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes
teamSchema.index({ department: 1 });
teamSchema.index({ lead: 1 });
teamSchema.index({ isActive: 1 });

module.exports = model('Team', teamSchema);
