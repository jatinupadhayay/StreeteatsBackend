const express = require("express")
const Order = require("../models/Order")
const Vendor = require("../models/Vendor")
const DeliveryPartner = require("../models/DeliveryPartner")
const User = require("../models/User")
const auth = require("../middleware/auth")
const { sendOrderConfirmationEmail, sendOrderStatusEmail } = require("../utils/emailService")

const router = express.Router()

// CREATE ORDER (Customer)
// In your order route (routes/orders.js)
// CREATE ORDER (Customer)
// CREATE ORDER (Customer)
router.post("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can place orders" })
    }

    const { vendorId, items, deliveryAddress, paymentMethod, specialInstructions } = req.body

    // Validate vendor
    const vendor = await Vendor.findById(vendorId)
    if (!vendor || !vendor.isActive) {
      return res.status(400).json({ message: "Vendor not available" })
    }

    // Calculate pricing
    let subtotal = 0
    const orderItems = []

    for (const item of items) {
      const menuItem = vendor.menu.id(item.menuItemId)
      if (!menuItem || !menuItem.isAvailable) {
        return res.status(400).json({ message: `Item ${item.name} is not available` })
      }

      const itemTotal = menuItem.price * item.quantity
      subtotal += itemTotal

      orderItems.push({
        menuItemId: item.menuItemId,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        customizations: item.customizations || [],
      })
    }

    const deliveryFee = 30
    const taxRate = 0.05
    const taxAmount = subtotal * taxRate

    // Generate order number manually
    const generateOrderNumber = () => {
      const date = new Date()
      const year = date.getFullYear().toString().slice(-2)
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      const day = date.getDate().toString().padStart(2, "0")
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
      return `SE${year}${month}${day}${random}`
    }

    // Create order with proper tax structure
    const order = new Order({
      orderNumber: generateOrderNumber(), // Manually generated
      customerId: req.user.userId,
      vendorId,
      items: orderItems,
      pricing: {
        subtotal,
        deliveryFee,
        taxes: {
          cgst: taxAmount / 2,  // Split tax between CGST
          sgst: taxAmount / 2,  // and SGST
          igst: 0,              // IGST not applicable
          total: taxAmount      // Total tax
        },
        total: subtotal + deliveryFee + taxAmount
      },
      deliveryAddress,
      paymentDetails: {
        method: paymentMethod,
        status: paymentMethod === "cod" ? "pending" : "completed"
      },
      specialInstructions,
      estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000)
    })

    await order.save()

    // Update vendor stats
    vendor.totalOrders += 1
    await vendor.save()

    // Send real-time notification to vendor
    const io = req.app.get("io")
    if (io) {
      io.to(`vendor-${vendorId}`).emit("new-order", {
        orderId: order._id,
        customer: req.userDetails.name,
        items: orderItems,
        total: order.pricing.total,
        address: deliveryAddress,
      })
    }

    // Send confirmation email
    try {
      await sendOrderConfirmationEmail(req.userDetails.email, order)
    } catch (emailError) {
      console.log("Email sending failed:", emailError.message)
    }

    res.status(201).json({
      message: "Order placed successfully",
      order: {
        id: order._id,
        status: order.status,
        total: order.pricing.total,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
      },
    })
  } catch (error) {
    console.error("Create order error:", error)
    res.status(500).json({ 
      message: "Failed to place order", 
      error: error.message,
      // Include detailed validation errors if available
      details: error.errors ? error.errors : undefined
    })
  }
})
// GET CUSTOMER ORDERS
router.get("/customer", auth, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Access denied" })
    }

    const { status, page = 1, limit = 10 } = req.query

    const query = { customerId: req.user.userId }
    if (status && status !== "all") {
      query.status = status
    }

    const orders = await Order.find(query)
      .populate("vendorId", "shopName address images")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Order.countDocuments(query)

    res.json({
      orders: orders.map((order) => ({
        id: order._id,
        vendor: order.vendorId,
        items: order.items,
        pricing: order.pricing,
        status: order.status,
        createdAt: order.createdAt,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        actualDeliveryTime: order.actualDeliveryTime,
        rating: order.rating,
      })),
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    })
  } catch (error) {
    console.error("Get customer orders error:", error)
    res.status(500).json({ message: "Failed to fetch orders", error: error.message })
  }
})

// GET VENDOR ORDERS
router.get("/vendor", auth, async (req, res) => {
  try {
    if (req.user.role !== "vendor") {
      return res.status(403).json({ message: "Access denied" })
    }

    const vendor = await Vendor.findOne({ userId: req.user.userId })
    if (!vendor) {
      return res.status(404).json({ message: "Vendor profile not found" })
    }

    const { status, page = 1, limit = 20 } = req.query

    const query = { vendorId: vendor._id }
    if (status && status !== "all") {
      query.status = status
    }

    const orders = await Order.find(query)
      .populate("customerId", "name phone")
      .populate("deliveryPartnerId", "personalDetails.name personalDetails.phone")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Order.countDocuments(query)

    res.json({
      orders: orders.map((order) => ({
        id: order._id,
        customer: order.customerId,
        deliveryPartner: order.deliveryPartnerId,
        items: order.items,
        pricing: order.pricing,
        status: order.status,
        deliveryAddress: order.deliveryAddress,
        createdAt: order.createdAt,
        specialInstructions: order.specialInstructions,
      })),
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    })
  } catch (error) {
    console.error("Get vendor orders error:", error)
    res.status(500).json({ message: "Failed to fetch orders", error: error.message })
  }
})

// UPDATE ORDER STATUS (Vendor)
router.put("/:orderId/status", auth, async (req, res) => {
  try {
    const { status } = req.body
    const { orderId } = req.params

    const order = await Order.findById(orderId).populate("customerId", "name email phone")

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    // Check permissions
    if (req.user.role === "vendor") {
      const vendor = await Vendor.findOne({ userId: req.user.userId })
      if (!vendor || order.vendorId.toString() !== vendor._id.toString()) {
        return res.status(403).json({ message: "Access denied" })
      }
    } else if (req.user.role === "delivery") {
      const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user.userId })
      if (!deliveryPartner || order.deliveryPartnerId?.toString() !== deliveryPartner._id.toString()) {
        return res.status(403).json({ message: "Access denied" })
      }
    } else {
      return res.status(403).json({ message: "Access denied" })
    }

    // Update status
    order.status = status

    // Handle status-specific logic
    if (status === "ready" && !order.deliveryPartnerId) {
      // Find available delivery partner
      const availablePartner = await DeliveryPartner.findOne({
        status: "approved",
        "availability.isOnline": true,
        isActive: true,
      })

      if (availablePartner) {
        order.deliveryPartnerId = availablePartner._id

        // Notify delivery partner
        const io = req.app.get("io")
        if (io) {
          io.to(`delivery-${availablePartner._id}`).emit("new-delivery-request", {
            orderId: order._id,
            vendor: order.vendorId,
            customer: order.customerId,
            deliveryAddress: order.deliveryAddress,
            total: order.pricing.total,
          })
        }
      }
    }

    if (status === "delivered") {
      order.actualDeliveryTime = new Date()

      // Update vendor revenue
      const vendor = await Vendor.findById(order.vendorId)
      if (vendor) {
        vendor.totalRevenue += order.pricing.total
        await vendor.save()
      }

      // Update delivery partner stats
      if (order.deliveryPartnerId) {
        const deliveryPartner = await DeliveryPartner.findById(order.deliveryPartnerId)
        if (deliveryPartner) {
          deliveryPartner.stats.totalDeliveries += 1
          deliveryPartner.stats.totalEarnings += 50 // Fixed delivery earning
          await deliveryPartner.save()
        }
      }
    }

    await order.save()

    // Send real-time updates
    const io = req.app.get("io")
    if (io) {
      io.to(`customer-${order.customerId._id}`).emit("order-status-updated", {
        orderId: order._id,
        status: order.status,
        message: getStatusMessage(status),
      })

      if (order.deliveryPartnerId) {
        io.to(`delivery-${order.deliveryPartnerId}`).emit("order-status-updated", {
          orderId: order._id,
          status: order.status,
        })
      }
    }

    // Send status email
    try {
      await sendOrderStatusEmail(order.customerId.email, order)
    } catch (emailError) {
      console.log("Email sending failed:", emailError.message)
    }

    res.json({
      message: "Order status updated successfully",
      order: {
        id: order._id,
        status: order.status,
        actualDeliveryTime: order.actualDeliveryTime,
      },
    })
  } catch (error) {
    console.error("Update order status error:", error)
    res.status(500).json({ message: "Failed to update order status", error: error.message })
  }
})

// GET DELIVERY ORDERS
router.get("/delivery", auth, async (req, res) => {
  try {
    if (req.user.role !== "delivery") {
      return res.status(403).json({ message: "Access denied" })
    }

    const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user.userId })
    if (!deliveryPartner) {
      return res.status(404).json({ message: "Delivery partner profile not found" })
    }

    const { status = "all", page = 1, limit = 10 } = req.query

    const query = { deliveryPartnerId: deliveryPartner._id }
    if (status !== "all") {
      query.status = status
    }

    const orders = await Order.find(query)
      .populate("customerId", "name phone")
      .populate("vendorId", "shopName address contact")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Order.countDocuments(query)

    res.json({
      orders: orders.map((order) => ({
        id: order._id,
        customer: order.customerId,
        vendor: order.vendorId,
        items: order.items,
        pricing: order.pricing,
        status: order.status,
        deliveryAddress: order.deliveryAddress,
        createdAt: order.createdAt,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
      })),
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    })
  } catch (error) {
    console.error("Get delivery orders error:", error)
    res.status(500).json({ message: "Failed to fetch delivery orders", error: error.message })
  }
})

// ACCEPT DELIVERY REQUEST
router.put("/:orderId/accept-delivery", auth, async (req, res) => {
  try {
    if (req.user.role !== "delivery") {
      return res.status(403).json({ message: "Access denied" })
    }

    const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user.userId })
    if (!deliveryPartner) {
      return res.status(404).json({ message: "Delivery partner profile not found" })
    }

    const order = await Order.findById(req.params.orderId)
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.status !== "ready") {
      return res.status(400).json({ message: "Order is not ready for pickup" })
    }

    order.deliveryPartnerId = deliveryPartner._id
    order.status = "picked_up"
    await order.save()

    // Send real-time updates
    const io = req.app.get("io")
    if (io) {
      io.to(`customer-${order.customerId}`).emit("order-status-updated", {
        orderId: order._id,
        status: "picked_up",
        message: "Your order has been picked up and is on the way!",
      })

      io.to(`vendor-${order.vendorId}`).emit("order-status-updated", {
        orderId: order._id,
        status: "picked_up",
      })
    }

    res.json({
      message: "Delivery request accepted successfully",
      order: {
        id: order._id,
        status: order.status,
      },
    })
  } catch (error) {
    console.error("Accept delivery error:", error)
    res.status(500).json({ message: "Failed to accept delivery", error: error.message })
  }
})

// RATE ORDER (Customer)
router.put("/:orderId/rate", auth, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can rate orders" })
    }

    const { food, delivery, overall, review } = req.body
    const order = await Order.findById(req.params.orderId)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.customerId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    if (order.status !== "delivered") {
      return res.status(400).json({ message: "Can only rate delivered orders" })
    }

    // Update order rating
    order.rating = { food, delivery, overall, review }
    await order.save()

    // Update vendor rating
    const vendor = await Vendor.findById(order.vendorId)
    if (vendor) {
      const newRatingCount = vendor.rating.count + 1
      const newAverage = (vendor.rating.average * vendor.rating.count + overall) / newRatingCount

      vendor.rating.average = newAverage
      vendor.rating.count = newRatingCount
      await vendor.save()
    }

    // Update delivery partner rating
    if (order.deliveryPartnerId && delivery) {
      const deliveryPartner = await DeliveryPartner.findById(order.deliveryPartnerId)
      if (deliveryPartner) {
        const newRatingCount = deliveryPartner.stats.rating.count + 1
        const newAverage =
          (deliveryPartner.stats.rating.average * deliveryPartner.stats.rating.count + delivery) / newRatingCount

        deliveryPartner.stats.rating.average = newAverage
        deliveryPartner.stats.rating.count = newRatingCount
        await deliveryPartner.save()
      }
    }

    res.json({
      message: "Order rated successfully",
      rating: order.rating,
    })
  } catch (error) {
    console.error("Rate order error:", error)
    res.status(500).json({ message: "Failed to rate order", error: error.message })
  }
})

// Helper function to get status message
function getStatusMessage(status) {
  const messages = {
    placed: "Order placed successfully",
    accepted: "Order accepted by vendor",
    preparing: "Your order is being prepared",
    ready: "Order is ready for pickup",
    picked_up: "Order picked up by delivery partner",
    delivered: "Order delivered successfully",
    cancelled: "Order has been cancelled",
  }
  return messages[status] || "Order status updated"
}

module.exports = router
