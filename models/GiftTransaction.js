const mongoose = require("mongoose")

const giftTransactionSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: {
      type: String,
      trim: true,
    },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    recipientPhone: {
      type: String,
      required: true,
      trim: true,
    },
    recipientName: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["food", "points"],
      required: true,
    },
    optionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GiftOption",
    },
    optionSnapshot: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    points: {
      type: Number,
      default: 0,
    },
    message: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "delivered", "redeemed", "cancelled"],
      default: "delivered",
    },
  },
  {
    timestamps: true,
  },
)

giftTransactionSchema.index({ senderId: 1, createdAt: -1 })
giftTransactionSchema.index({ recipientUserId: 1, createdAt: -1 })
giftTransactionSchema.index({ recipientPhone: 1, createdAt: -1 })

module.exports = mongoose.model("GiftTransaction", giftTransactionSchema)

