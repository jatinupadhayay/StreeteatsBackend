const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema(
  {
    // Recipients
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userType: {
      type: String,
      enum: ["customer", "vendor", "delivery", "admin"],
      required: true,
    },

    // Notification Content
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "order_placed",
        "order_confirmed",
        "order_preparing",
        "order_ready",
        "order_picked_up",
        "order_delivered",
        "order_cancelled",
        "payment_success",
        "payment_failed",
        "refund_processed",
        "new_review",
        "promotion",
        "system_update",
        "account_update",
        "delivery_assigned",
        "delivery_request",
        "earnings_update",
      ],
      required: true,
    },

    // Related Data
    relatedId: mongoose.Schema.Types.ObjectId,
    relatedType: {
      type: String,
      enum: ["order", "vendor", "user", "delivery_partner", "payment", "review"],
    },

    // Notification Channels
    channels: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "read"],
      default: "pending",
    },
    isRead: { type: Boolean, default: false },
    readAt: Date,

    // Delivery Status
    delivery: {
      push: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
        error: String,
      },
      email: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
        error: String,
      },
      sms: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
        error: String,
      },
    },

    // Additional Data
    data: mongoose.Schema.Types.Mixed,
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    expiresAt: Date,
  },
  {
    timestamps: true,
  },
)

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ status: 1, createdAt: -1 })
notificationSchema.index({ type: 1 })
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model("Notification", notificationSchema)
