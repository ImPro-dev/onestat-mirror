'use strict';

const { Schema, model } = require('mongoose');

const deptRoleSchema = new Schema({
  department: { type: String, required: true, index: true }, // 'Media Buying' | 'Marketing'
  value: { type: String, required: true },               // 'head' | ... (технічний ключ)
  label: { type: String, required: true },               // UI label per dept
  isActive: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 100 }
}, { timestamps: true, versionKey: false });

// унікальність в межах департаменту
deptRoleSchema.index({ department: 1, value: 1 }, { unique: true, name: 'uniq_deptrole_dept_value' });

module.exports = model('DeptRole', deptRoleSchema);
