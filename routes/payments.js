const express = require("express")
const Razorpay = require("razorpay")
const crypto = require("crypto")
const Order = require("../models/Order")
const auth = require("../middleware/auth")
const { sendOrderConfirmationEmail } = require("../utils/emailService")

const router = express.Router()

// Initialize Razorpay
let razorpay = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn("⚠️ Razorpay keys are missing. Payment-related features will be disabled.");
}


// CREATE PAYMENT ORDER
router.post("/create-order", auth, async (req, res) => {
  try {
    const { orderId } = req.body

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.customerId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    const options = {
      amount: Math.round(order.pricing.total * 100), // Amount in paise
      currency: "INR",
      receipt: `order_${orderId}`,
      notes: {
        orderId: orderId,
        customerId: req.user.userId,
      },
    }

    const razorpayOrder = await razorpay.orders.create(options)

    res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
    })
  } catch (error) {
    console.error("Create payment order error:", error)
    res.status(500).json({ message: "Failed to create payment order", error: error.message })
  }
})

// VERIFY PAYMENT
router.post("/verify", auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex")

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" })
    }

    // Update order payment status
    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    order.paymentDetails.status = "completed"
    order.paymentDetails.transactionId = razorpay_payment_id
    await order.save()

    // Send real-time notification to vendor
    const io = req.app.get("io")
    if (io) {
      io.to(`vendor-${order.vendorId}`).emit("payment-confirmed", {
        orderId: order._id,
        paymentId: razorpay_payment_id,
        amount: order.pricing.total,
      })
    }

    res.json({
      message: "Payment verified successfully",
      paymentId: razorpay_payment_id,
      status: "completed",
    })
  } catch (error) {
    console.error("Verify payment error:", error)
    res.status(500).json({ message: "Payment verification failed", error: error.message })
  }
})

// REFUND PAYMENT
router.post("/refund", auth, async (req, res) => {
  try {
    const { orderId, reason } = req.body

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    // Check if user has permission to refund
    if (req.user.role !== "admin" && req.user.role !== "vendor") {
      return res.status(403).json({ message: "Access denied" })
    }

    if (order.paymentDetails.status !== "completed") {
      return res.status(400).json({ message: "Cannot refund incomplete payment" })
    }

    // Create refund
    const refund = await razorpay.payments.refund(order.paymentDetails.transactionId, {
      amount: Math.round(order.pricing.total * 100), // Full refund
      notes: {
        reason: reason || "Order cancelled",
        orderId: orderId,
      },
    })

    // Update order status
    order.status = "cancelled"
    order.paymentDetails.status = "refunded"
    await order.save()

    // Send notification to customer
    const io = req.app.get("io")
    if (io) {
      io.to(`customer-${order.customerId}`).emit("refund-processed", {
        orderId: order._id,
        refundId: refund.id,
        amount: order.pricing.total,
        reason,
      })
    }

    res.json({
      message: "Refund processed successfully",
      refundId: refund.id,
      amount: order.pricing.total,
    })
  } catch (error) {
    console.error("Refund error:", error)
    res.status(500).json({ message: "Refund failed", error: error.message })
  }
})

// WEBHOOK HANDLER
router.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"]
    const body = req.body

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex")

    if (signature !== expectedSignature) {
      return res.status(400).json({ message: "Invalid webhook signature" })
    }

    const event = JSON.parse(body)

    // Handle different webhook events
    switch (event.event) {
      case "payment.captured":
        handlePaymentCaptured(event.payload.payment.entity)
        break
      case "payment.failed":
        handlePaymentFailed(event.payload.payment.entity)
        break
      case "refund.processed":
        handleRefundProcessed(event.payload.refund.entity)
        break
      default:
        console.log(`Unhandled webhook event: ${event.event}`)
    }

    res.json({ status: "ok" })
  } catch (error) {
    console.error("Webhook error:", error)
    res.status(500).json({ message: "Webhook processing failed" })
  }
})

// Webhook handlers
async function handlePaymentCaptured(payment) {
  try {
    const orderId = payment.notes.orderId
    const order = await Order.findById(orderId)

    if (order) {
      order.paymentDetails.status = "completed"
      order.paymentDetails.transactionId = payment.id
      await order.save()

      console.log(`Payment captured for order ${orderId}`)
    }
  } catch (error) {
    console.error("Handle payment captured error:", error)
  }
}

async function handlePaymentFailed(payment) {
  try {
    const orderId = payment.notes.orderId
    const order = await Order.findById(orderId)

    if (order) {
      order.paymentDetails.status = "failed"
      order.status = "cancelled"
      await order.save()

      console.log(`Payment failed for order ${orderId}`)
    }
  } catch (error) {
    console.error("Handle payment failed error:", error)
  }
}

async function handleRefundProcessed(refund) {
  try {
    console.log(`Refund processed: ${refund.id}`)
  } catch (error) {
    console.error("Handle refund processed error:", error)
  }
}

// CONFIRM UPI PAYMENT (CUSTOMER CONFIRMATION)
router.post("/confirm-upi-payment", auth, async (req, res) => {
  try {
    const { orderId, userConfirmed } = req.body

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." })
    }

    if (order.customerId.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied." })
    }

    if (userConfirmed) {
      order.paymentDetails.status = "pending_verification"
      // Optionally, update order status to 'payment_pending' or similar
      order.status = "placed" // Keep as placed, vendor will confirm payment then accept

      // Notify the vendor about a potentially paid UPI order
      const io = req.app.get("io")
      if (io) {
        io.to(`vendor-${order.vendorId}`).emit("upi-payment-pending-verification", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          amount: order.pricing.total,
          customerName: req.user.name, // Assuming req.user has name
        })
      }
    } else {
      // User explicitly stated payment failed or cancelled
      order.paymentDetails.status = "failed"
      order.status = "cancelled" // Mark order as cancelled if payment failed
      // Optionally, notify vendor of failed payment/cancelled order
      const io = req.app.get("io")
      if (io) {
        io.to(`vendor-${order.vendorId}`).emit("upi-payment-failed", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          amount: order.pricing.total,
          customerName: req.user.name, // Assuming req.user has name
        })
      }
    }
    await order.save()

    // Send confirmation email if user confirmed payment
    if (userConfirmed) {
      try {
        await sendOrderConfirmationEmail(req.userDetails.email, order)
        console.log("UPI Order confirmation email sent")
      } catch (emailError) {
        console.log("Email sending failed:", emailError.message)
      }
    }

    res.json({ success: true, message: "Payment status updated successfully." })
  } catch (error) {
    console.error("Confirm UPI payment error:", error)
    res.status(500).json({ success: false, message: "Failed to confirm UPI payment.", error: error.message })
  }
})

module.exports = router
