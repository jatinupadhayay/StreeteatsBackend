const mongoose = require("mongoose")

const orderSchema = new mongoose.Schema(
  {
    // Order Identification
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },

    // Parties Involved
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
      default: null,
    },

    // Order Items with Complete Details
    items: [
      {
        menuItemId: { type: String, required: true },
        name: { type: String, required: true },
        description: String,
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        image: String,
        category: String,
        isVeg: Boolean,
        customizations: [
          {
            name: String, // e.g., "Size", "Spice Level"
            selectedOption: String, // e.g., "Large", "Extra Spicy"
            additionalPrice: { type: Number, default: 0 },
          },
        ],
        specialInstructions: String,
        nutritionalInfo: {
          calories: Number,
          protein: Number,
          carbs: Number,
          fat: Number,
        },
      },
    ],

    // Comprehensive Pricing Breakdown
    pricing: {
      subtotal: { type: Number, required: true },
      itemTotal: Number,
      customizationCharges: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },
      packagingFee: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      taxes: {
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        igst: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
      },
      discount: {
        amount: { type: Number, default: 0 },
        type: String, // percentage, fixed, coupon
        code: String,
        description: String,
      },
      tip: { type: Number, default: 0 },
      total: { type: Number, required: true },
      roundOff: { type: Number, default: 0 },
    },
// Order Type
  orderType: {
  type: String,
  enum: ["delivery", "pickup", "dine_in"],
  required: true,
  default: "delivery"
  },

    // Delivery Information
    deliveryAddress: {
      type: {
        type: String,
        enum: ["home", "work", "other"],
        default: "home",
      },
      name: String,
      phone: String,
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      landmark: String,
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      instructions: String,
    },


    // Order Status & Timeline
    status: {
      type: String,
      enum: [
        "placed",
        "confirmed",
        "accepted",
        "preparing",
        "ready",
        "ready_for_pickup",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded",
      ],
      default: "placed",
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notes: String,
      },
    ],

    // Payment Details
    paymentDetails: {
      method: {
        type: String,
        enum: ["cod", "online", "pickup_pay", "upi", "card","pending"],
        required: true,
      },
      provider: String, // razorpay, stripe, paytm
      transactionId: String,
      paymentId: String,
      orderId: String,
      signature: String,
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed", "refunded", "partially_refunded"],
        default: "pending",
      },
      paidAmount: Number,
      refundAmount: { type: Number, default: 0 },
      refundReason: String,
      paymentTimestamp: Date,
      refundTimestamp: Date,
    },

    // Time Management
    timing: {
      placedAt: { type: Date, default: Date.now },
      confirmedAt: Date,
      acceptedAt: Date,
      preparingAt: Date,
      readyAt: Date,
      pickedUpAt: Date,
      deliveredAt: Date,
      cancelledAt: Date,
      estimatedPreparationTime: Number, // minutes
      estimatedDeliveryTime: Date,
      actualDeliveryTime: Date,
      totalPreparationTime: Number, // actual time taken
      totalDeliveryTime: Number, // actual delivery time
    },

    // Special Instructions & Notes
    specialInstructions: {
      customer: String,
      vendor: String,
      delivery: String,
    },
    internalNotes: String,

    // Ratings & Reviews
    rating: {
      food: {
        rating: { type: Number, min: 1, max: 5 },
        review: String,
        images: [String],
      },
      delivery: {
        rating: { type: Number, min: 1, max: 5 },
        review: String,
      },
      overall: {
        rating: { type: Number, min: 1, max: 5 },
        review: String,
        images: [String],
      },
      ratedAt: Date,
      isPublic: { type: Boolean, default: true },
    },

    // Delivery Tracking
    deliveryTracking: {
      assignedAt: Date,
      pickedUpAt: Date,
      currentLocation: {
        coordinates: [Number],
        timestamp: Date,
      },
      route: [
        {
          coordinates: [Number],
          timestamp: Date,
        },
      ],
      estimatedArrival: Date,
      deliveryInstructions: String,
    },

    // Order Source & Channel
    orderSource: {
      platform: {
        type: String,
        enum: ["web", "mobile_app", "phone", "whatsapp"],
        default: "web",
      },
      device: String,
      userAgent: String,
      referrer: String,
    },

    // Loyalty & Rewards
    loyaltyPoints: {
      earned: { type: Number, default: 0 },
      redeemed: { type: Number, default: 0 },
    },

    // Cancellation Details
    cancellation: {
      reason: String,
      cancelledBy: {
        type: String,
        enum: ["customer", "vendor", "delivery", "admin", "system"],
      },
      refundAmount: Number,
      refundStatus: String,
      cancellationFee: { type: Number, default: 0 },
    },

    // Group Order Details (if applicable)
    groupOrder: {
      isGroupOrder: { type: Boolean, default: false },
      groupId: String,
      organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      participants: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          items: [String], // item IDs
          amount: Number,
          paymentStatus: String,
        },
      ],
    },

    // Repeat Order Information
    isRepeatOrder: { type: Boolean, default: false },
    originalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    // Promotional Information
    promotions: [
      {
        code: String,
        title: String,
        discount: Number,
        type: String,
      },
    ],

    // Customer Feedback
    feedback: {
      packaging: {
        rating: Number,
        comment: String,
      },
      temperature: {
        rating: Number,
        comment: String,
      },
      quantity: {
        rating: Number,
        comment: String,
      },
      suggestions: String,
    },

    // Vendor Analytics Data
    vendorAnalytics: {
      preparationTime: Number,
      acceptanceTime: Number, // time taken to accept order
      customerType: String, // new, returning, vip
      orderValue: String, // low, medium, high
    },

    // System Metadata
    metadata: {
      version: { type: String, default: "1.0" },
      migrated: { type: Boolean, default: false },
      archived: { type: Boolean, default: false },
      tags: [String],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Pre-save middleware to generate order number
orderSchema.pre("save", function (next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")
    this.orderNumber = `SE${year}${month}${day}${random}`
  }

  // Update status history
  if (this.isModified("status")) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      updatedBy: this.updatedBy || null,
    })
  }

  next()
})

// Indexes for efficient queries
orderSchema.index({ customerId: 1, createdAt: -1 })
orderSchema.index({ vendorId: 1, status: 1 })
orderSchema.index({ deliveryPartnerId: 1, status: 1 })
orderSchema.index({ orderNumber: 1 })
orderSchema.index({ status: 1, createdAt: -1 })
orderSchema.index({ "deliveryAddress.coordinates": "2dsphere" })
orderSchema.index({ "timing.placedAt": -1 })
orderSchema.index({ "paymentDetails.status": 1 })

// Virtual for order age
orderSchema.virtual("orderAge").get(function () {
  return Date.now() - this.timing.placedAt
})

// Virtual for total items
orderSchema.virtual("totalItems").get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0)
})

module.exports = mongoose.model("Order", orderSchema)
