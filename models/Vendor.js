const mongoose = require("mongoose")

const vendorSchema = new mongoose.Schema(
  {
    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Owner Information
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerPhoto: String,
    ownerAadhar: String,
    ownerPan: String,

    // Business Information
    shopName: {
      type: String,
      required: true,
      trim: true,
    },
    shopDescription: {
      type: String,
      default: "",
      maxlength: 500,
    },
    businessType: {
      type: String,
      enum: ["restaurant", "food_truck", "home_kitchen", "cloud_kitchen", "cafe", "bakery"],
      default: "restaurant",
    },
    establishedYear: Number,

    // Cuisine & Menu Categories
    cuisine: [
      {
        type: String,
        required: true,
      },
    ],
    specialties: [String],
    menuCategories: [
      {
        name: String,
        description: String,
        displayOrder: Number,
      },
    ],

    // Location Details
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      landmark: String,
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
        index: "2dsphere",
      },
      googlePlaceId: String,
    },

    // Contact Information
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true },
      whatsapp: String,
      website: String,
      socialMedia: {
        facebook: String,
        instagram: String,
        twitter: String,
      },
    },

    // Business Documents & Legal
    businessDetails: {
      licenseNumber: { type: String, required: true },
      gstNumber: String,
      fssaiNumber: String,
      panNumber: String,
      bankAccount: { type: String, required: true },
      ifscCode: { type: String, required: true },
      accountHolderName: String,
      upiId: String,
      upiName: String,
      upiEnabled: { type: Boolean, default: false },
    },

    // Operational Details
    operationalHours: {
      monday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      thursday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      friday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      saturday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      sunday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    },
    deliveryRadius: {
      type: Number,
      default: 5,
      min: 1,
      max: 50,
    },
    minimumOrderValue: {
      type: Number,
      default: 100,
    },
    averagePreparationTime: {
      type: Number,
      default: 30, // minutes
    },

    // Images & Media
    images: {
      shop: [String], // Multiple shop images
      license: String,
      owner: String,
      menu: [String],
      gallery: [String],
      logo: String,
      banner: String,
    },

    // Menu Items
    menu: [
      {
        name: { type: String, required: true },
        description: String,
        price: { type: Number, required: true },
        originalPrice: Number, // for discounts
        category: { type: String, required: true },
        subCategory: String,
        image: String,
        images: [String], // Multiple images per item
        isVeg: { type: Boolean, default: true },
        isVegan: { type: Boolean, default: false },
        isGlutenFree: { type: Boolean, default: false },
        spiceLevel: {
          type: String,
          enum: ["mild", "medium", "hot", "extra-hot"],
          default: "medium",
        },
        allergens: [String],
        nutritionalInfo: {
          calories: Number,
          protein: Number,
          carbs: Number,
          fat: Number,
          fiber: Number,
        },
        ingredients: [String],
        preparationTime: Number, // minutes
        isAvailable: { type: Boolean, default: true },
        isPopular: { type: Boolean, default: false },
        isFeatured: { type: Boolean, default: false },
        customizations: [
          {
            name: String, // e.g., "Size", "Spice Level"
            options: [
              {
                name: String, // e.g., "Large", "Extra Spicy"
                price: Number, // additional price
              },
            ],
            required: { type: Boolean, default: false },
            multiSelect: { type: Boolean, default: false },
          },
        ],
        tags: [String],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    // Ratings & Reviews
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

    // Business Metrics
    stats: {
      totalOrders: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      monthlyRevenue: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      repeatCustomers: { type: Number, default: 0 },
      cancellationRate: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },

    // Status & Verification
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended", "under_review"],
      default: "pending",
    },
    verificationNotes: String,
    rejectionReason: String,
    isActive: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },

    // Delivery Settings
    deliverySettings: {
      selfDelivery: { type: Boolean, default: false },
      deliveryFee: { type: Number, default: 30 },
      freeDeliveryAbove: { type: Number, default: 500 },
      deliveryTime: {
        min: { type: Number, default: 30 },
        max: { type: Number, default: 60 },
      },
    },

    // Promotions & Offers
    activeOffers: [
      {
        title: String,
        description: String,
        type: {
          type: String,
          enum: ["percentage", "fixed", "buy_one_get_one", "free_delivery"],
        },
        value: Number,
        minimumOrder: Number,
        validFrom: Date,
        validTill: Date,
        isActive: { type: Boolean, default: true },
        usageLimit: Number,
        usedCount: { type: Number, default: 0 },
      },
    ],

    // Subscription & Plans
    subscription: {
      plan: {
        type: String,
        enum: ["free", "basic", "premium", "enterprise"],
        default: "free",
      },
      startDate: Date,
      endDate: Date,
      isActive: { type: Boolean, default: true },
      features: [String],
    },

    // Analytics & Insights
    analytics: {
      viewCount: { type: Number, default: 0 },
      searchAppearances: { type: Number, default: 0 },
      clickThroughRate: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
      popularItems: [String],
      peakHours: [String],
      topCustomers: [mongoose.Schema.Types.ObjectId],
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
    },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Compliance & Certifications
    certifications: [
      {
        name: String,
        issuedBy: String,
        validTill: Date,
        certificateUrl: String,
      },
    ],

    // Notifications & Preferences
    notificationSettings: {
      newOrders: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
    },

    // UPI Payment Settings
    upiId: { type: String, trim: true, default: null },
    upiName: { type: String, trim: true, default: null },
    upiEnabled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for performance
vendorSchema.index({ "address.coordinates": "2dsphere" })
vendorSchema.index({ cuisine: 1, isActive: 1 })
vendorSchema.index({ status: 1 })
vendorSchema.index({ "rating.average": -1 })
vendorSchema.index({ shopName: "text", shopDescription: "text" })
vendorSchema.index({ createdAt: -1 })
vendorSchema.index({ userId: 1 })

// Virtual for average rating
vendorSchema.virtual("averageRating").get(function () {
  return this.rating.average
})

// Pre-save middleware to update menu item timestamps
vendorSchema.pre("save", function (next) {
  if (this.isModified("menu")) {
    this.menu.forEach((item) => {
      if (item.isNew) {
        item.createdAt = new Date()
      }
      item.updatedAt = new Date()
    })
  }
  next()
})

module.exports = mongoose.model("Vendor", vendorSchema)
