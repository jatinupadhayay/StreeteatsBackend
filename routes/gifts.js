const express = require("express")

const GiftOption = require("../models/GiftOption")
const GiftTransaction = require("../models/GiftTransaction")
const User = require("../models/User")
const auth = require("../middleware/auth")
const ErrorHandler = require("../utils/errorHandler")

const router = express.Router()

const sanitizePhone = (phone = "") => phone.replace(/\s|-/g, "")

router.get("/options", auth, async (req, res, next) => {
  try {
    let options = await GiftOption.find({ isActive: true }).sort({ pointsCost: 1 }).lean()

    if (options.length === 0) {
      await GiftOption.insertMany([
        {
          name: "Pani Puri treat",
          description: "8 pani puris with tangy water",
          price: 60,
          pointsCost: 120,
          vendorName: "Spice Street Corner",
          image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=60",
          tags: ["street food", "snacks"],
        },
        {
          name: "Chai & samosa combo",
          description: "Hot masala chai with crispy samosas",
          price: 45,
          pointsCost: 90,
          vendorName: "Tea Junction",
          image: "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=400&q=60",
          tags: ["tea", "snacks"],
        },
        {
          name: "₹100 food voucher",
          description: "Gift a voucher usable at any vendor",
          price: 100,
          pointsCost: 200,
          vendorName: "Any vendor",
          image: "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=400&q=60",
          tags: ["voucher"],
        },
      ])

      options = await GiftOption.find({ isActive: true }).sort({ pointsCost: 1 }).lean()
    }

    res.json({
      success: true,
      options: options.map((option) => ({
        id: option._id,
        name: option.name,
        description: option.description,
        price: option.price,
        pointsCost: option.pointsCost,
        image: option.image,
        vendorName: option.vendorName,
        tags: option.tags,
      })),
    })
  } catch (error) {
    console.error("Gift options error:", error)
    next(new ErrorHandler("Failed to load gift options", 500))
  }
})

router.get("/history", auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).lean()
    if (!user) {
      return next(new ErrorHandler("User not found", 404))
    }

    const phone = sanitizePhone(user.phone)

    const history = await GiftTransaction.find({
      $or: [
        { senderId: req.user.userId },
        { recipientUserId: req.user.userId },
        { recipientPhone: phone },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("optionId", "name pointsCost vendorName")
      .lean()

    res.json({
      success: true,
      history: history.map((entry) => ({
        id: entry._id,
        type: entry.type,
        option:
          entry.optionSnapshot && Object.keys(entry.optionSnapshot).length > 0
            ? entry.optionSnapshot
            : entry.optionId
          ? {
              id: entry.optionId._id,
              name: entry.optionId.name,
              pointsCost: entry.optionId.pointsCost,
              vendorName: entry.optionId.vendorName,
            }
          : null,
        points: entry.points,
        status: entry.status,
        message: entry.message,
        createdAt: entry.createdAt,
        sender: {
          id: entry.senderId ? entry.senderId.toString() : undefined,
          name: entry.senderName,
        },
        recipient: {
          phone: entry.recipientPhone,
          name: entry.recipientName,
        },
        direction: entry.senderId?.toString() === req.user.userId ? "sent" : "received",
      })),
    })
  } catch (error) {
    console.error("Gift history error:", error)
    next(new ErrorHandler("Failed to load gift history", 500))
  }
})

router.post("/send/food", auth, async (req, res, next) => {
  try {
    const { optionId, recipientPhone, message } = req.body

    if (!optionId || !recipientPhone) {
      return next(new ErrorHandler("Gift option and recipient phone are required", 400))
    }

    const option = await GiftOption.findById(optionId)
    if (!option || !option.isActive) {
      return next(new ErrorHandler("Selected gift option is not available", 404))
    }

    const user = await User.findById(req.user.userId)
    if (!user) {
      return next(new ErrorHandler("User not found", 404))
    }

    if ((user.loyaltyPoints || 0) < option.pointsCost) {
      return next(new ErrorHandler("Insufficient loyalty points", 400))
    }

    user.loyaltyPoints = Math.max((user.loyaltyPoints || 0) - option.pointsCost, 0)
    await user.save()

    const normalizedPhone = sanitizePhone(recipientPhone)
    const recipientUser = await User.findOne({ phone: normalizedPhone }).lean()

    if (recipientUser) {
      await User.updateOne(
        { _id: recipientUser._id },
        { $inc: { loyaltyPoints: Math.floor(option.pointsCost / 2) } },
      )
    }

    const transaction = await GiftTransaction.create({
      senderId: user._id,
      senderName: user.name,
      recipientUserId: recipientUser?._id,
      recipientPhone: normalizedPhone,
      recipientName: recipientUser?.name,
      type: "food",
      optionId: option._id,
      optionSnapshot: {
        name: option.name,
        pointsCost: option.pointsCost,
        vendorName: option.vendorName,
        description: option.description,
        image: option.image,
      },
      points: option.pointsCost,
      message,
      status: "delivered",
    })

    res.json({
      success: true,
      message: "Gift sent successfully",
      transaction: {
        id: transaction._id,
        status: transaction.status,
        createdAt: transaction.createdAt,
      },
      balance: user.loyaltyPoints,
    })
  } catch (error) {
    console.error("Send gift error:", error)
    next(new ErrorHandler("Failed to send gift", 500))
  }
})

router.post("/send/points", auth, async (req, res, next) => {
  try {
    const { points, recipientPhone, message } = req.body

    const pointsAmount = Number(points)
    if (!pointsAmount || pointsAmount <= 0) {
      return next(new ErrorHandler("Points amount must be greater than zero", 400))
    }

    if (!recipientPhone) {
      return next(new ErrorHandler("Recipient phone is required", 400))
    }

    const user = await User.findById(req.user.userId)
    if (!user) {
      return next(new ErrorHandler("User not found", 404))
    }

    if ((user.loyaltyPoints || 0) < pointsAmount) {
      return next(new ErrorHandler("Insufficient loyalty points", 400))
    }

    user.loyaltyPoints = Math.max((user.loyaltyPoints || 0) - pointsAmount, 0)
    await user.save()

    const normalizedPhone = sanitizePhone(recipientPhone)
    const recipientUser = await User.findOne({ phone: normalizedPhone })

    if (recipientUser) {
      recipientUser.loyaltyPoints = (recipientUser.loyaltyPoints || 0) + pointsAmount
      await recipientUser.save()
    }

    const transaction = await GiftTransaction.create({
      senderId: user._id,
      senderName: user.name,
      recipientUserId: recipientUser?._id,
      recipientPhone: normalizedPhone,
      recipientName: recipientUser?.name,
      type: "points",
      points: pointsAmount,
      message,
      status: recipientUser ? "redeemed" : "delivered",
    })

    res.json({
      success: true,
      message: "Points sent successfully",
      transaction: {
        id: transaction._id,
        status: transaction.status,
        createdAt: transaction.createdAt,
      },
      balance: user.loyaltyPoints,
    })
  } catch (error) {
    console.error("Send points error:", error)
    next(new ErrorHandler("Failed to send points", 500))
  }
})

module.exports = router

