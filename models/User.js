const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9]{10}$/, "Please enter a valid 10-digit phone number"],
    },

    // Address Information
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      landmark: { type: String, default: "" },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },

    // Account Details
    role: {
      type: String,
      enum: ["customer", "vendor", "delivery", "admin"],
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Profile Information
    profileImage: {
      type: String,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },

    // Preferences (for customers)
    preferences: {
      cuisinePreferences: [String],
      dietaryRestrictions: [String], // vegetarian, vegan, gluten-free, etc.
      spiceLevel: {
        type: String,
        enum: ["mild", "medium", "hot", "extra-hot", ""],
        default: "",
      },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
      },
    },

    // Security & Verification
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    // Activity Tracking
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    loginHistory: [
      {
        timestamp: { type: Date, default: Date.now },
        ipAddress: String,
        userAgent: String,
        location: String,
      },
    ],

    // Social Login
    socialLogins: {
      google: {
        id: String,
        email: String,
      },
      facebook: {
        id: String,
        email: String,
      },
    },

    // Loyalty & Rewards (for customers)
    loyaltyPoints: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    membershipTier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      default: "bronze",
    },

    // Referral System
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    referralCount: {
      type: Number,
      default: 0,
    },

    // Account Status
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "banned", "pending"],
      default: "active",
    },
    suspensionReason: String,
    suspensionExpires: Date,

    // Metadata
    deviceInfo: {
      platform: String, // ios, android, web
      version: String,
      deviceId: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for performance
userSchema.index({ email: 1, role: 1 })
userSchema.index({ phone: 1 })
userSchema.index({ referralCode: 1 })
userSchema.index({ "address.coordinates": "2dsphere" })
userSchema.index({ createdAt: -1 })

// Virtual for full name
userSchema.virtual("fullAddress").get(function () {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} - ${this.address.pincode}`
})

// Pre-save middleware
userSchema.pre("save", function (next) {
  if (this.isNew && !this.referralCode) {
    this.referralCode = this.name.replace(/\s+/g, "").toLowerCase() + Math.random().toString(36).substr(2, 6)
  }
  next()
})

module.exports = mongoose.model("User", userSchema)
