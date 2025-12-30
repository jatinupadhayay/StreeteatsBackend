const express = require("express")

const Reward = require("../models/Reward")
const RewardRedemption = require("../models/RewardRedemption")
const User = require("../models/User")
const auth = require("../middleware/auth")
const ErrorHandler = require("../utils/errorHandler")

const router = express.Router()

const MEMBERSHIP_TIERS = [
  { level: "bronze", min: 0, max: 999, multiplier: 1 },
  { level: "silver", min: 1000, max: 2499, multiplier: 1.2 },
  { level: "gold", min: 2500, max: 4999, multiplier: 1.5 },
  { level: "platinum", min: 5000, max: Infinity, multiplier: 2 },
]

function determineTier(points) {
  const tier = MEMBERSHIP_TIERS.find((t) => points >= t.min && points <= t.max) || MEMBERSHIP_TIERS[0]

  const nextTierIndex = MEMBERSHIP_TIERS.indexOf(tier) + 1
  const nextTier = MEMBERSHIP_TIERS[nextTierIndex]

  return {
    level: tier.level,
    multiplier: tier.multiplier,
    nextLevel: nextTier ? nextTier.level : tier.level,
    pointsToNextLevel: nextTier ? Math.max(nextTier.min - points, 0) : 0,
  }
}

router.get("/summary", auth, async (req, res, next) => {
  try {
    if (req.user.role !== "customer") {
      return next(new ErrorHandler("Only customers can access rewards", 403))
    }

    const user = await User.findById(req.user.userId).lean()
    if (!user) {
      return next(new ErrorHandler("User not found", 404))
    }

    const points = user.loyaltyPoints || 0
    const tierInfo = determineTier(points)

    const recentRedemptions = await RewardRedemption.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("rewardId", "title pointsRequired category")
      .lean()

    res.json({
      success: true,
      summary: {
        pointsCurrent: points,
        pointsTotal: user.totalSpent || 0,
        tier: tierInfo.level,
        multiplier: tierInfo.multiplier,
        nextTier: tierInfo.nextLevel,
        pointsToNextTier: tierInfo.pointsToNextLevel,
        totalOrders: user.orderCount || 0,
      },
      recentRedemptions: recentRedemptions.map((redemption) => ({
        id: redemption._id,
        title: redemption.rewardId?.title || "Reward",
        category: redemption.rewardId?.category || "General",
        pointsSpent: redemption.pointsSpent,
        status: redemption.status,
        redeemedAt: redemption.createdAt,
      })),
    })
  } catch (error) {
    console.error("Rewards summary error:", error)
    next(new ErrorHandler("Failed to load rewards summary", 500))
  }
})

router.get("/catalog", auth, async (req, res, next) => {
  try {
    let rewards = await Reward.find({ isActive: true })
      .sort({ priority: -1, pointsRequired: 1 })
      .lean()

    if (rewards.length === 0) {
      await Reward.insertMany([
        {
          title: "Free Pani Puri",
          description: "Enjoy a plate of 8 pani puris from top vendors",
          pointsRequired: 200,
          category: "Food",
          vendorName: "Spice Street Corner",
          image: "https://images.unsplash.com/photo-1589308078055-1871a90a0520?auto=format&fit=crop&w=400&q=60",
          priority: 10,
        },
        {
          title: "₹50 off next order",
          description: "Valid on orders above ₹200",
          pointsRequired: 300,
          category: "Discount",
          vendorName: "Any vendor",
          image: "https://images.unsplash.com/photo-1604908177079-dc08245182b4?auto=format&fit=crop&w=400&q=60",
          priority: 8,
        },
        {
          title: "Free delivery pass",
          description: "Waive delivery fee on your next 3 orders",
          pointsRequired: 150,
          category: "Service",
          vendorName: "Street Eats",
          image: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=400&q=60",
          priority: 6,
        },
      ])

      rewards = await Reward.find({ isActive: true })
        .sort({ priority: -1, pointsRequired: 1 })
        .lean()
    }

    res.json({
      success: true,
      rewards: rewards.map((reward) => ({
        id: reward._id,
        title: reward.title,
        description: reward.description,
        pointsRequired: reward.pointsRequired,
        category: reward.category,
        image: reward.image,
        vendorName: reward.vendorName,
        expiresAt: reward.expiresAt,
        tags: reward.tags,
        stock: reward.stock,
      })),
    })
  } catch (error) {
    console.error("Rewards catalog error:", error)
    next(new ErrorHandler("Failed to load rewards catalog", 500))
  }
})

router.get("/history", auth, async (req, res, next) => {
  try {
    const history = await RewardRedemption.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .populate("rewardId", "title category pointsRequired")
      .lean()

    res.json({
      success: true,
      history: history.map((entry) => ({
        id: entry._id,
        title: entry.rewardId?.title || "Reward",
        category: entry.rewardId?.category || "General",
        pointsSpent: entry.pointsSpent,
        status: entry.status,
        redeemedAt: entry.createdAt,
      })),
    })
  } catch (error) {
    console.error("Rewards history error:", error)
    next(new ErrorHandler("Failed to load reward history", 500))
  }
})

router.post("/:rewardId/redeem", auth, async (req, res, next) => {
  try {
    if (req.user.role !== "customer") {
      return next(new ErrorHandler("Only customers can redeem rewards", 403))
    }

    const reward = await Reward.findById(req.params.rewardId)
    if (!reward || !reward.isActive) {
      return next(new ErrorHandler("Reward not available", 404))
    }

    const user = await User.findById(req.user.userId)
    if (!user) {
      return next(new ErrorHandler("User not found", 404))
    }

    if ((user.loyaltyPoints || 0) < reward.pointsRequired) {
      return next(new ErrorHandler("Insufficient loyalty points", 400))
    }

    user.loyaltyPoints = Math.max((user.loyaltyPoints || 0) - reward.pointsRequired, 0)
    await user.save()

    const redemption = await RewardRedemption.create({
      rewardId: reward._id,
      userId: user._id,
      pointsSpent: reward.pointsRequired,
      status: "completed",
      metadata: {
        rewardTitle: reward.title,
        vendorName: reward.vendorName,
      },
    })

    res.json({
      success: true,
      message: "Reward redeemed successfully",
      redemption: {
        id: redemption._id,
        pointsSpent: redemption.pointsSpent,
        status: redemption.status,
        redeemedAt: redemption.createdAt,
      },
      balance: user.loyaltyPoints,
    })
  } catch (error) {
    console.error("Redeem reward error:", error)
    next(new ErrorHandler("Failed to redeem reward", 500))
  }
})

module.exports = router

