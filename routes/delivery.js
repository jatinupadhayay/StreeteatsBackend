const express = require("express")
const DeliveryPartner = require("../models/DeliveryPartner")
const Order = require("../models/Order")
const User = require("../models/User")
const auth = require("../middleware/auth")

const router = express.Router()

// GET DELIVERY PARTNER DASHBOARD
router.get("/dashboard", auth, async (req, res) => {
  try {
    if (req.user.role !== "delivery") {
      return res.status(403).json({ message: "Access denied" })
    }

    const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user.userId })
    if (!deliveryPartner) {
      return res.status(404).json({ message: "Delivery partner profile not found" })
    }

    // Get today's deliveries
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayDeliveries = await Order.find({
      deliveryPartnerId: deliveryPartner._id,
      createdAt: { $gte: today, $lt: tomorrow },
    })

    // Get active orders
    const activeOrders = await Order.find({
      deliveryPartnerId: deliveryPartner._id,
      status: { $in: ["picked_up"] },
    })
      .populate("customerId", "name phone")
      .populate("vendorId", "shopName address contact")

    // Get available orders (ready for pickup)
    const availableOrders = await Order.find({
      status: "ready",
      deliveryPartnerId: null,
    })
      .populate("vendorId", "shopName address contact")
      .limit(10)

    // Calculate today's earnings
    const todayEarnings = todayDeliveries.filter((order) => order.status === "delivered").length * 50 // ₹50 per delivery

    res.json({
      deliveryPartner: {
        id: deliveryPartner._id,
        name: deliveryPartner.personalDetails.name,
        phone: deliveryPartner.personalDetails.phone,
        vehicleType: deliveryPartner.vehicleDetails.type,
        vehicleNumber: deliveryPartner.vehicleDetails.number,
        rating: deliveryPartner.stats.rating,
        totalDeliveries: deliveryPartner.stats.totalDeliveries,
        totalEarnings: deliveryPartner.stats.totalEarnings,
        isOnline: deliveryPartner.availability.isOnline,
      },
      todayStats: {
        deliveries: todayDeliveries.filter((order) => order.status === "delivered").length,
        earnings: todayEarnings,
        totalOrders: todayDeliveries.length,
      },
      activeOrders: activeOrders.map((order) => ({
        id: order._id,
        customer: order.customerId,
        vendor: order.vendorId,
        deliveryAddress: order.deliveryAddress,
        total: order.pricing.total,
        status: order.status,
        createdAt: order.createdAt,
      })),
      availableOrders: availableOrders.map((order) => ({
        id: order._id,
        vendor: order.vendorId,
        deliveryAddress: order.deliveryAddress,
        total: order.pricing.total,
        estimatedEarning: 50,
        distance: "2.5 km", // Calculate actual distance
      })),
    })
  } catch (error) {
    console.error("Delivery dashboard error:", error)
    res.status(500).json({ message: "Failed to fetch dashboard data", error: error.message })
  }
})

// TOGGLE ONLINE STATUS
router.put("/toggle-online", auth, async (req, res) => {
  try {
    if (req.user.role !== "delivery") {
      return res.status(403).json({ message: "Access denied" })
    }

    const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user.userId })
    if (!deliveryPartner) {
      return res.status(404).json({ message: "Delivery partner profile not found" })
    }

    deliveryPartner.availability.isOnline = !deliveryPartner.availability.isOnline
    await deliveryPartner.save()

    // Emit status change
    const io = req.app.get("io")
    if (io) {
      io.emit("delivery-partner-status-changed", {
        deliveryPartnerId: deliveryPartner._id,
        isOnline: deliveryPartner.availability.isOnline,
      })
    }

    res.json({
      message: `You are now ${deliveryPartner.availability.isOnline ? "online" : "offline"}`,
      isOnline: deliveryPartner.availability.isOnline,
    })
  } catch (error) {
    console.error("Toggle online status error:", error)
    res.status(500).json({ message: "Failed to toggle online status", error: error.message })
  }
})

// UPDATE LOCATION
router.put("/location", auth, async (req, res) => {
  try {
    if (req.user.role !== "delivery") {
      return res.status(403).json({ message: "Access denied" })
    }

    const { latitude, longitude } = req.body

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Latitude and longitude are required" })
    }

    const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user.userId })
    if (!deliveryPartner) {
      return res.status(404).json({ message: "Delivery partner profile not found" })
    }

    deliveryPartner.currentLocation.coordinates = [longitude, latitude]
    deliveryPartner.currentLocation.lastUpdated = new Date()
    await deliveryPartner.save()

    // Emit location update for active orders
    const activeOrders = await Order.find({
      deliveryPartnerId: deliveryPartner._id,
      status: "picked_up",
    })

    const io = req.app.get("io")
    if (io) {
      activeOrders.forEach((order) => {
        io.to(`customer-${order.customerId}`).emit("delivery-location-updated", {
          orderId: order._id,
          location: { latitude, longitude },
          timestamp: new Date(),
        })
      })
    }

    res.json({
      message: "Location updated successfully",
      location: { latitude, longitude },
    })
  } catch (error) {
    console.error("Update location error:", error)
    res.status(500).json({ message: "Failed to update location", error: error.message })
  }
})

// GET DELIVERY HISTORY
router.get("/history", auth, async (req, res) => {
  try {
    if (req.user.role !== "delivery") {
      return res.status(403).json({ message: "Access denied" })
    }

    const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user.userId })
    if (!deliveryPartner) {
      return res.status(404).json({ message: "Delivery partner profile not found" })
    }

    const { page = 1, limit = 20, status = "all" } = req.query

    const query = { deliveryPartnerId: deliveryPartner._id }
    if (status !== "all") {
      query.status = status
    }

    const orders = await Order.find(query)
      .populate("customerId", "name phone")
      .populate("vendorId", "shopName address")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Order.countDocuments(query)

    res.json({
      orders: orders.map((order) => ({
        id: order._id,
        customer: order.customerId,
        vendor: order.vendorId,
        total: order.pricing.total,
        earning: order.status === "delivered" ? 50 : 0,
        status: order.status,
        deliveryAddress: order.deliveryAddress,
        createdAt: order.createdAt,
        actualDeliveryTime: order.actualDeliveryTime,
        rating: order.rating?.delivery || null,
      })),
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    })
  } catch (error) {
    console.error("Get delivery history error:", error)
    res.status(500).json({ message: "Failed to fetch delivery history", error: error.message })
  }
})

// GET EARNINGS SUMMARY
router.get("/earnings", auth, async (req, res) => {
  try {
    if (req.user.role !== "delivery") {
      return res.status(403).json({ message: "Access denied" })
    }

    const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user.userId })
    if (!deliveryPartner) {
      return res.status(404).json({ message: "Delivery partner profile not found" })
    }

    const { period = "week" } = req.query

    const startDate = new Date()
    if (period === "week") {
      startDate.setDate(startDate.getDate() - 7)
    } else if (period === "month") {
      startDate.setMonth(startDate.getMonth() - 1)
    } else if (period === "year") {
      startDate.setFullYear(startDate.getFullYear() - 1)
    }

    const deliveredOrders = await Order.find({
      deliveryPartnerId: deliveryPartner._id,
      status: "delivered",
      actualDeliveryTime: { $gte: startDate },
    })

    const totalEarnings = deliveredOrders.length * 50
    const totalDeliveries = deliveredOrders.length

    // Group by date for chart data
    const earningsByDate = {}
    deliveredOrders.forEach((order) => {
      const date = order.actualDeliveryTime.toISOString().split("T")[0]
      earningsByDate[date] = (earningsByDate[date] || 0) + 50
    })

    res.json({
      summary: {
        totalEarnings,
        totalDeliveries,
        averagePerDelivery: totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0,
        period,
      },
      chartData: Object.entries(earningsByDate).map(([date, earnings]) => ({
        date,
        earnings,
        deliveries: earnings / 50,
      })),
    })
  } catch (error) {
    console.error("Get earnings error:", error)
    res.status(500).json({ message: "Failed to fetch earnings data", error: error.message })
  }
})

module.exports = router
