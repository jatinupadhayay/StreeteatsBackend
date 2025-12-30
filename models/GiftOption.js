const mongoose = require("mongoose")

const giftOptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
    },
    pointsCost: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      default: "",
    },
    vendorName: {
      type: String,
      default: "Any Vendor",
    },
    tags: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

giftOptionSchema.index({ isActive: 1 })

module.exports = mongoose.model("GiftOption", giftOptionSchema)

