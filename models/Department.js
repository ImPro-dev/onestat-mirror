'use strict';

const { Schema, model } = require('mongoose');

const departmentSchema = new Schema({
  value: { type: String, required: true, unique: true },   // 'Media Buying', 'Marketing', ...
  label: { type: String, required: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

module.exports = model('Department', departmentSchema);
