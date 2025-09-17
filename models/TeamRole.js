'use strict';

const { Schema, model } = require('mongoose');

const teamRoleSchema = new Schema({
  value: { type: String, required: true, unique: true },   // 'lead' | 'member' | 'assistant'
  label: { type: String, required: true },                // 'Team Lead' | 'Media Buyer' | 'Assistant'
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

module.exports = model('TeamRole', teamRoleSchema);
