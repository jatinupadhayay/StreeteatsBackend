const mongoose = require("mongoose")

const rewardRedemptionSchema = new mongoose.Schema(
  {
    rewardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reward",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pointsSpent: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "completed",
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
)

rewardRedemptionSchema.index({ userId: 1, createdAt: -1 })
rewardRedemptionSchema.index({ rewardId: 1, userId: 1 })

module.exports = mongoose.model("RewardRedemption", rewardRedemptionSchema)

