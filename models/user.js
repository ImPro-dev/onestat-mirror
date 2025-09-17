'use strict';

const { Schema, model, Types } = require('mongoose');

// --- Access consts (V1) ---
const ORG_ROLES = ['admin', 'manager', 'user'];
const TEAM_ROLES = ['lead', 'member', 'assistant'];
const DEPTARTMENTS = ['Media Buying'];

/**
 * Grants
 */
// const ALL_GRANTS = [
//   'analytics:read:dept',
//   'analytics:read:buyers:all',
// ];

const userSchema = new Schema(
  {
    // Identification
    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 64 },
    lastName: { type: String, required: true, trim: true, minlength: 2, maxlength: 64 },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Invalid email format',
      },
    },

    // Security
    // password: {
    //   type: String,
    //   required: [true, 'Please enter password']
    // },
    passwordHash: { type: String, required: true, select: false },
    lastPasswordChangeAt: { type: Date },

    // Contacts
    telegramUsername: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: (v) => v == null || /^@?[a-zA-Z0-9_]{2,32}$/.test(v),
        message: 'Invalid Telegram username',
      },
    },
    position: { type: String, trim: true, default: null, maxlength: 128 }, // label (Team Lead / Media Buyer / ...)

    // Org attributes
    orgRole: { type: String, enum: ORG_ROLES, required: true, index: true }, // admin|manager|user
    department: { type: String, enum: DEPTARTMENTS, required: true, trim: true, index: true }, // "Media Buying"|"Marketing"

    // One user - one team
    team: { type: Types.ObjectId, ref: 'Team', default: null, index: true },
    teamRole: { type: String, enum: TEAM_ROLES, default: null, index: true },
    webId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: null,
      validate: {
        validator: (v) => v == null || /^w\d{3,}$/i.test(v),
        message: 'Invalid webId format (use wNNN, e.g., w043)',
      },
    },

    // Point additional permissions (scopes)
    grants: [{ type: String }], // e.g.: 'analytics:read:buyers:all'

    // Service fields
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
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

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ webId: 1 }, { unique: true, sparse: true });
userSchema.index({ department: 1 });
userSchema.index({ orgRole: 1 });
userSchema.index({ team: 1 });
userSchema.index({ isActive: 1 });

module.exports = model('User', userSchema);
module.exports.ORG_ROLES = ORG_ROLES;
module.exports.TEAM_ROLES = TEAM_ROLES;
module.exports.DEPTARTMENTS = DEPTARTMENTS;
// module.exports.ALL_GRANTS = ALL_GRANTS; // розкоментуй, якщо тримаєш довідник тут
