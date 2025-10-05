// models/User.js
'use strict';

const { Schema, model, Types } = require('mongoose');

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 64 },
    lastName: { type: String, required: true, trim: true, minlength: 2, maxlength: 64 },

    email: {
      type: String, required: true, lowercase: true, trim: true,
      validate: { validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'Invalid email format' },
    },

    passwordHash: { type: String, required: true, select: false },
    lastPasswordChangeAt: { type: Date },

    telegramUsername: {
      type: String, trim: true, default: null,
      validate: { validator: v => v == null || /^@?[a-zA-Z0-9_]{5,32}$/.test(v), message: 'Invalid Telegram username' },
    },

    position: { type: String, trim: true, default: null, maxlength: 128 },

    // Org-level
    orgRole: { type: String, required: true },   // валідуємо по БД-довіднику
    department: { type: String, required: true, trim: true },

    // Dept-level
    deptRole: { type: String, default: 'none', trim: true }, // 'head'|'deputy'|'coordinator'|'none' (валідуємо по БД)

    // Team-level
    team: { type: Types.ObjectId, ref: 'Team', default: null },
    teamRole: { type: String, default: null }, // 'lead'|'member'|'assistant'|null

    // Наставництво
    assistantOf: { type: Types.ObjectId, ref: 'User', default: null },

    // Media Buying специфіка
    webId: {
      type: String, trim: true, default: null,
      validate: { validator: v => v == null || /^\d{3}$/.test(v), message: 'Invalid webId format' }
    },

    grants: [{ type: String }],

    avatarUpdatedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

// Virtuals
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Hooks
userSchema.pre('save', function (next) {
  if (this.isModified('email') && typeof this.email === 'string') {
    this.email = this.email.trim().toLowerCase();
  }
  next();
});

// Indexes (без дублювань)
userSchema.index({ email: 1 }, { unique: true, name: 'uniq_user_email' });
userSchema.index({ webId: 1 }, { unique: true, sparse: true, name: 'uniq_user_webId_sparse' });

userSchema.index({ department: 1 }, { name: 'idx_user_department' });
userSchema.index({ orgRole: 1 }, { name: 'idx_user_orgRole' });
userSchema.index({ deptRole: 1 }, { name: 'idx_user_deptRole' });
userSchema.index({ team: 1 }, { name: 'idx_user_team' });
userSchema.index({ teamRole: 1 }, { name: 'idx_user_teamRole' });
userSchema.index({ assistantOf: 1 }, { name: 'idx_user_assistantOf' });
userSchema.index({ isActive: 1 }, { name: 'idx_user_isActive' });

module.exports = model('User', userSchema);
