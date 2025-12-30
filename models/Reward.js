const mongoose = require("mongoose")

const rewardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    pointsRequired: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      default: "General",
    },
    image: {
      type: String,
      default: "",
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    vendorName: {
      type: String,
      trim: true,
    },
    tags: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
    expiresAt: Date,
    stock: {
      type: Number,
      default: null,
    },
    redemptionLimit: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

rewardSchema.index({ isActive: 1, priority: -1 })
rewardSchema.index({ expiresAt: 1 })

module.exports = mongoose.model("Reward", rewardSchema)

