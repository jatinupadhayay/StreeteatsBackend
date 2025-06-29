const mongoose = require("mongoose")

const analyticsSchema = new mongoose.Schema(
  {
    // Time Period
    date: { type: Date, required: true },
    period: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: true,
    },

    // Entity Reference
    entityType: {
      type: String,
      enum: ["vendor", "delivery_partner", "customer", "platform"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Metrics
    metrics: {
      // Order Metrics
      orders: {
        total: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        cancelled: { type: Number, default: 0 },
        refunded: { type: Number, default: 0 },
        averageValue: { type: Number, default: 0 },
        totalValue: { type: Number, default: 0 },
      },

      // Revenue Metrics
      revenue: {
        gross: { type: Number, default: 0 },
        net: { type: Number, default: 0 },
        commission: { type: Number, default: 0 },
        taxes: { type: Number, default: 0 },
        refunds: { type: Number, default: 0 },
      },

      // Customer Metrics
      customers: {
        new: { type: Number, default: 0 },
        returning: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        retention: { type: Number, default: 0 },
      },

      // Performance Metrics
      performance: {
        averageRating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 },
        preparationTime: { type: Number, default: 0 },
        deliveryTime: { type: Number, default: 0 },
        onTimeDelivery: { type: Number, default: 0 },
      },

      // Traffic Metrics
      traffic: {
        views: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        bounceRate: { type: Number, default: 0 },
      },
    },

    // Additional Data
    breakdown: {
      hourly: [Number],
      categories: [
        {
          name: String,
          value: Number,
        },
      ],
      locations: [
        {
          area: String,
          count: Number,
        },
      ],
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
analyticsSchema.index({ entityType: 1, entityId: 1, date: -1 })
analyticsSchema.index({ date: -1, period: 1 })

module.exports = mongoose.model("Analytics", analyticsSchema)
