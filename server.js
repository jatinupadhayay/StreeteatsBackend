// Backend server entry point
require("dotenv").config()
const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const http = require("http")
const path = require("path")
const socketIo = require("socket.io")

// ✅ Import models
const VendorModel = require("./models/Vendor") // make sure the path is correct
const Order = require("./models/Order")

const app = express()
const server = http.createServer(app)


// ✅ Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
})

// ✅ Security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
)

// ✅ CORS settings
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const allowed = [
        process.env.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "https://streeteats-frontend-kw1c.vercel.app/",
      ]
      if (allowed.some((url) => origin.includes(url))) {
        return callback(null, true)
      }
      return callback(null, true) // Allow all for now
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
)
app.options("*", cors())

// ✅ Body parsing
app.use(express.json({ limit: "10mb" })) // To parse JSON request bodies
app.use(express.urlencoded({ extended: true, limit: "10mb" })) // To parse URL-encoded request bodies (for form data)

// Serve static files from the 'uploads' directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// ✅ Rate limiting
app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: "Too many requests from this IP",
    standardHeaders: true,
    legacyHeaders: false,
  })
)

// ✅ MongoDB connection
let isConnected = false
const connectDB = async () => {
  if (isConnected) return
  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
    isConnected = db.connections[0].readyState === 1
    console.log("✅ Connected to MongoDB")
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message)
  }
}
connectDB()

// ✅ SOCKET.IO CONNECTION
io.on("connection", async (socket) => {
  const { userId, userRole } = socket.handshake.auth
  console.log("🔌 Client connected:", socket.id)
  console.log("🔐 Auth:", socket.handshake.auth)

  try {
    if (userRole === "vendor") {
      const vendor = await VendorModel.findOne({ userId })
      if (vendor) {
        const vendorRoom = `vendor-${vendor._id}`
        socket.join(vendorRoom)
        console.log(`🏪 Vendor user ${userId} joined room: ${vendorRoom}`)
      } else {
        console.warn(`⚠️ No vendor found for userId: ${userId}`)
      }
    }
  } catch (err) {
    console.error("❌ Error during vendor room join:", err.message)
  }

  socket.on("join-vendor", (vendorId) => {
    const room = `vendor-${vendorId}`
    socket.join(room)
    console.log(`🏪 Vendor manually joined room: ${room}`)
  })

  socket.on("join-customer", (customerId) => {
    const room = `customer-${customerId}`
    socket.join(room)
    console.log(`👤 Customer joined room: ${room}`)
  })

  socket.on("join-delivery", (deliveryId) => {
    const room = `delivery-${deliveryId}`
    socket.join(room)
    console.log(`🚚 Delivery joined room: ${room}`)
  })

  socket.on("ping-test", () => {
    console.log("📡 Ping received from:", socket.id)
    socket.emit("pong-test", "👋 Pong from server")
  })

  socket.on("disconnect", (reason) => {
    console.log("❌ Disconnected:", socket.id, "Reason:", reason)
  })

  socket.on("error", (err) => {
    console.error("🔥 Socket error:", err.message)
  })
})

// ✅ Attach io to app
app.set("io", io)

// ✅ Health check endpoints
app.get("/", (req, res) => {
  res.json({
    message: "🍕 Street Eats API is running!",
    status: "OK",
    timestamp: new Date().toISOString(),
  })
})

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Street Eats API is healthy",
    database: isConnected ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
  })
})

// Email Test Endpoint
app.get("/api/test-email", async (req, res) => {
  try {
    const { sendVendorApprovalEmail } = require("./utils/emailService")
    const mockVendor = {
      _id: "test_vendor_" + Date.now(),
      shopName: "Test Street Eats Vendor",
      ownerName: "Test Owner",
      contact: {
        email: "jatinup1204@gmail.com",
        phone: "9876543210"
      },
      cuisine: ["Test Cuisine"],
      address: {
        street: "Test Street",
        city: "Test City"
      }
    }
    await sendVendorApprovalEmail(mockVendor)
    res.json({ success: true, message: "Test approval email triggered" })
  } catch (error) {
    console.error("Test email error:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ✅ Routes
try {
  app.use("/api/auth", require("./routes/auth"))
  app.use("/api/customer", require("./routes/customer"))
  app.use("/api/vendors", require("./routes/vendors"))
  app.use("/api/orders", require("./routes/orders"))
  app.use("/api/delivery", require("./routes/delivery"))
  app.use("/api/payments", require("./routes/payments"))
  app.use("/api/search", require("./routes/search"))
  app.use("/api/rewards", require("./routes/rewards"))
  app.use("/api/gifts", require("./routes/gifts"))
  app.use("/api/upload", require("./routes/upload"))
  app.use("/api/reviews", require("./routes/reviews"))
  app.use("/api/users", require("./routes/users")) // Added users route
} catch (err) {
  console.error("❌ Failed to load routes:", err.message)
}

// ✅ Unknown API endpoint handler
app.all("/api/*", (req, res) => {
  res.status(404).json({
    message: "API endpoint not found",
    method: req.method,
    path: req.path,
  })
})

// ✅ Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500
  const message = err.message || "Something went wrong"

  console.error(`🔥 Error [${statusCode}]:`, err.stack)

  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  })
})

// ✅ Catch-all
app.use("*", (req, res) => {
  res.status(404).json({
    message: "Route not found",
    suggestion: "Check if you meant to access /api/*",
  })
})

// ✅ Start server (for local dev)
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`)

  // ✅ Auto-decline stale orders (every 1 minute)
  setInterval(async () => {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const staleOrders = await Order.find({
        status: { $in: ["placed", "confirmed"] },
        createdAt: { $lt: tenMinutesAgo }
      });

      if (staleOrders.length > 0) {
        console.log(`🕒 System: Auto-declining ${staleOrders.length} stale orders`);

        for (const order of staleOrders) {
          order.status = "cancelled";
          order.cancellation = {
            reason: "Auto-declined: Not accepted by vendor within 10 minutes",
            cancelledBy: "system"
          };
          await order.save();

          // Notify vendor and customer via Socket.IO
          if (io) {
            const updatePayload = {
              orderId: order._id,
              status: "cancelled",
              message: "Order auto-cancelled as it was not accepted within 10 minutes"
            };
            io.to(`vendor-${order.vendorId}`).emit("order-updated", updatePayload);
            io.to(`customer-${order.customerId}`).emit("order-updated", updatePayload);
          }
        }
      }
    } catch (err) {
      console.error("❌ Auto-decline task error:", err.message);
    }
  }, 60 * 1000); // Run every minute
})


// ✅ Export for Vercel/serverless
module.exports = app
