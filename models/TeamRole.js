'use strict';

const { Schema, model } = require('mongoose');

const teamRoleSchema = new Schema({
  department: { type: String, required: true, index: true }, // 'Media Buying' | 'Marketing'
  value: { type: String, required: true },               // 'lead' | 'member' | 'assistant'
  label: { type: String, required: true },               // UI label per dept
  isActive: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 100 }
}, { timestamps: true, versionKey: false });

teamRoleSchema.index({ department: 1, value: 1 }, { unique: true, name: 'uniq_teamrole_dept_value' });

module.exports = model('TeamRole', teamRoleSchema);
