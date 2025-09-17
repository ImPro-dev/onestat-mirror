'use strict';

const { Schema, model } = require('mongoose');

const orgRoleSchema = new Schema({
  value: { type: String, required: true, unique: true },   // 'admin' | 'manager' | 'user'
  label: { type: String, required: true },                 // 'Admin' | 'Manager' | 'User'
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

module.exports = model('OrgRole', orgRoleSchema);
