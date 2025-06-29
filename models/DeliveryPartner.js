const mongoose = require("mongoose")

const deliveryPartnerSchema = new mongoose.Schema(
  {
    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Personal Information
    personalDetails: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
      alternatePhone: String,
      dateOfBirth: Date,
      gender: {
        type: String,
        enum: ["male", "female", "other"],
      },
      bloodGroup: String,
      emergencyContact: {
        name: String,
        phone: String,
        relation: String,
      },
      address: {
        current: {
          street: String,
          city: String,
          state: String,
          pincode: String,
          coordinates: [Number],
        },
        permanent: {
          street: String,
          city: String,
          state: String,
          pincode: String,
        },
      },
    },

    // Vehicle Information
    vehicleDetails: {
      type: {
        type: String,
        enum: ["bike", "scooter", "bicycle", "car", "electric_bike", "electric_scooter"],
        required: true,
      },
      brand: String,
      model: String,
      number: { type: String, required: true },
      color: String,
      year: Number,
      fuelType: {
        type: String,
        enum: ["petrol", "diesel", "electric", "cng"],
      },
      insurance: {
        provider: String,
        policyNumber: String,
        validTill: Date,
        documentUrl: String,
      },
      pollution: {
        certificateNumber: String,
        validTill: Date,
        documentUrl: String,
      },
    },

    // Documents & Verification
    documents: {
      licenseNumber: String,
      aadharNumber: String,
      profilePhoto: String,
      // Changed these from objects to String to store single URLs
      aadharCard: String,
      panCard: String,
      drivingLicense: String,
      vehicleRC: String,
      vehicleInsurance: String,
      policeVerification: String,
      medicalCertificate: String,
      bankPassbook: String,
    },

    // Bank & Payment Details
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String,
      branchName: String,
      upiId: String,
      paytmNumber: String,
    },

    // Work Preferences & Availability
    availability: {
      workingHours: [
        // This is an array of objects
        {
          day: {
            type: String,
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            default: "monday", // Default day if not specified
          },
          startTime: { type: String, default: "09:00" },
          endTime: { type: String, default: "18:00" },
          isAvailable: { type: Boolean, default: true },
        },
      ],
      preferredAreas: [String],
      maxDeliveryRadius: { type: Number, default: 10 },
      isOnline: { type: Boolean, default: false },
      lastOnline: Date,
      breakTime: {
        isOnBreak: { type: Boolean, default: false },
        breakStart: Date,
        breakEnd: Date,
        reason: String,
      },
      vacationMode: {
        isOnVacation: { type: Boolean, default: false },
        startDate: Date,
        endDate: Date,
        reason: String,
      },
    },

    // Location & Tracking
    currentLocation: {
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
      address: String,
      lastUpdated: { type: Date, default: Date.now },
      accuracy: Number,
      speed: Number,
      heading: Number,
    },
    locationHistory: [
      {
        coordinates: [Number],
        timestamp: Date,
        accuracy: Number,
      },
    ],

    // Performance Statistics
    stats: {
      totalDeliveries: { type: Number, default: 0 },
      completedDeliveries: { type: Number, default: 0 },
      cancelledDeliveries: { type: Number, default: 0 },
      totalDistance: { type: Number, default: 0 }, // in km
      totalEarnings: { type: Number, default: 0 },
      monthlyEarnings: { type: Number, default: 0 },
      weeklyEarnings: { type: Number, default: 0 },
      dailyEarnings: { type: Number, default: 0 },
      averageDeliveryTime: { type: Number, default: 0 }, // in minutes
      onTimeDeliveryRate: { type: Number, default: 0 }, // percentage
      customerSatisfactionRate: { type: Number, default: 0 },
      rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
        breakdown: {
          5: { type: Number, default: 0 },
          4: { type: Number, default: 0 },
          3: { type: Number, default: 0 },
          2: { type: Number, default: 0 },
          1: { type: Number, default: 0 },
        },
      },
    },

    // Earnings & Incentives
    earnings: {
      baseRate: { type: Number, default: 50 }, // per delivery
      distanceRate: { type: Number, default: 5 }, // per km
      timeRate: { type: Number, default: 2 }, // per minute
      incentives: [
        {
          type: String, // peak_hour, weekend, rain_bonus, etc.
          amount: Number,
          date: Date,
          description: String,
        },
      ],
      penalties: [
        {
          type: String, // late_delivery, order_cancellation, etc.
          amount: Number,
          date: Date,
          reason: String,
        },
      ],
      bonuses: [
        {
          type: String,
          amount: Number,
          date: Date,
          description: String,
        },
      ],
    },

    // Account Status & Verification
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected", "suspended", "deactivated"],
      default: "pending",
    },
    verificationStatus: {
      documents: { type: Boolean, default: false },
      background: { type: Boolean, default: false },
      training: { type: Boolean, default: false },
      medical: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: false },
    rejectionReason: String,
    suspensionReason: String,
    suspensionExpires: Date,

    // Training & Certification
    training: {
      completed: { type: Boolean, default: false },
      completedDate: Date,
      score: Number,
      certificateUrl: String,
      modules: [
        {
          name: String,
          completed: Boolean,
          completedDate: Date,
          score: Number,
        },
      ],
    },

    // Equipment & Gear
    equipment: {
      helmet: { type: Boolean, default: false },
      deliveryBag: { type: Boolean, default: false },
      smartphone: { type: Boolean, default: false },
      gps: { type: Boolean, default: false },
      uniform: { type: Boolean, default: false },
    },

    // Reviews & Feedback
    reviews: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        customerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        date: { type: Date, default: Date.now },
        isPublic: { type: Boolean, default: true },
      },
    ],

    // Notifications & Preferences
    notificationSettings: {
      newOrders: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      earnings: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },

    // Emergency & Safety
    emergency: {
      sosContacts: [
        {
          name: String,
          phone: String,
          relation: String,
        },
      ],
      lastSosAlert: Date,
      safetyScore: { type: Number, default: 100 },
      accidentHistory: [
        {
          date: Date,
          description: String,
          severity: String,
          reportNumber: String,
        },
      ],
    },

    // App Usage & Analytics
    appUsage: {
      totalLoginTime: { type: Number, default: 0 }, // in minutes
      averageSessionTime: { type: Number, default: 0 },
      lastAppVersion: String,
      deviceInfo: {
        platform: String,
        model: String,
        osVersion: String,
      },
    },

    // Referral System
    referral: {
      code: String,
      referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryPartner",
      },
      referredPartners: [
        {
          partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DeliveryPartner",
          },
          joinedDate: Date,
          bonus: Number,
        },
      ],
      totalReferrals: { type: Number, default: 0 },
      referralEarnings: { type: Number, default: 0 },
    },

    // Subscription & Plans
    subscription: {
      plan: {
        type: String,
        enum: ["free", "basic", "premium"],
        default: "free",
      },
      startDate: Date,
      endDate: Date,
      features: [String],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for performance
deliveryPartnerSchema.index({ "currentLocation.coordinates": "2dsphere" })
deliveryPartnerSchema.index({ "availability.isOnline": 1, status: 1 })
deliveryPartnerSchema.index({ userId: 1 })
deliveryPartnerSchema.index({ status: 1 })
deliveryPartnerSchema.index({ "stats.rating.average": -1 })
deliveryPartnerSchema.index({ createdAt: -1 })

// Virtual for completion rate
deliveryPartnerSchema.virtual("completionRate").get(function () {
  if (this.stats.totalDeliveries === 0) return 0
  return (this.stats.completedDeliveries / this.stats.totalDeliveries) * 100
})

// Pre-save middleware
deliveryPartnerSchema.pre("save", function (next) {
  if (this.isNew && !this.referral.code) {
    this.referral.code =
      "DP" +
      this.personalDetails.name.replace(/\s+/g, "").toUpperCase().slice(0, 3) +
      Math.random().toString(36).substr(2, 4).toUpperCase()
  }
  next()
})

module.exports = mongoose.model("DeliveryPartner", deliveryPartnerSchema)
