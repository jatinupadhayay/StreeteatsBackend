const mongoose = require("mongoose")

const reviewSchema = new mongoose.Schema(
  {
    // Review Identification
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner",
    },
    menuItemId: {
      type: String, // String ID of the menu item
    },
    type: {
      type: String,
      enum: ["vendor", "dish"],
      default: "vendor",
    },

    // Review Content
    ratings: {
      food: {
        overall: { type: Number, min: 1, max: 5, required: true },
        taste: { type: Number, min: 1, max: 5 },
        quality: { type: Number, min: 1, max: 5 },
        quantity: { type: Number, min: 1, max: 5 },
        presentation: { type: Number, min: 1, max: 5 },
        packaging: { type: Number, min: 1, max: 5 },
        temperature: { type: Number, min: 1, max: 5 },
      },
      service: {
        overall: { type: Number, min: 1, max: 5 },
        orderAccuracy: { type: Number, min: 1, max: 5 },
        preparationTime: { type: Number, min: 1, max: 5 },
        staffBehavior: { type: Number, min: 1, max: 5 },
      },
      delivery: {
        overall: { type: Number, min: 1, max: 5 },
        timeliness: { type: Number, min: 1, max: 5 },
        driverBehavior: { type: Number, min: 1, max: 5 },
        orderCondition: { type: Number, min: 1, max: 5 },
      },
    },

    // Written Reviews
    comments: {
      food: String,
      service: String,
      delivery: String,
      overall: String,
    },

    // Media Attachments
    media: {
      images: [String],
      videos: [String],
    },

    // Review Metadata
    isVerified: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    isAnonymous: { type: Boolean, default: false },
    language: { type: String, default: "en" },

    // Helpful/Unhelpful votes
    votes: {
      helpful: { type: Number, default: 0 },
      unhelpful: { type: Number, default: 0 },
      voters: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          vote: {
            type: String,
            enum: ["helpful", "unhelpful"],
          },
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },

    // Vendor Response
    vendorResponse: {
      message: String,
      respondedAt: Date,
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },

    // Review Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "flagged"],
      default: "approved",
    },
    moderationNotes: String,

    // Tags and Categories
    tags: [String],
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
    },

    // Review Source
    source: {
      platform: String,
      device: String,
      version: String,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
reviewSchema.index({ vendorId: 1, createdAt: -1 })
reviewSchema.index({ customerId: 1, createdAt: -1 })
reviewSchema.index({ orderId: 1 })
reviewSchema.index({ "ratings.food.overall": -1 })
reviewSchema.index({ status: 1, isPublic: 1 })

module.exports = mongoose.model("Review", reviewSchema)
