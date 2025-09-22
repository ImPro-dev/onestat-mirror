'use strict';

const { Schema, model } = require('mongoose');

const orgRoleSchema = new Schema({
  value: { type: String, required: true, unique: true }, // 'admin'|'manager'|'user'
  label: { type: String, required: true },
  isActive: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 100 }
}, { timestamps: true, versionKey: false });

module.exports = model('OrgRole', orgRoleSchema);
