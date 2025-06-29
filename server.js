const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const http = require("http")
const socketIo = require("socket.io")
require("dotenv").config()

const app = express()
const server = http.createServer(app)

// Socket.io setup for Vercel
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
})

// Middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  }),
)

// Enhanced CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true)

      const allowedOrigins = [
        process.env.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "https://street-eats-frontend.vercel.app",
        "https://your-frontend-domain.vercel.app",
      ]

      if (allowedOrigins.some((allowedOrigin) => origin.includes(allowedOrigin))) {
        callback(null, true)
      } else {
        callback(null, true) // Allow all origins for now
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  }),
)

// Handle preflight requests
app.options("*", cors())

app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit
  message: "Too many requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
})
app.use("/api/", limiter)

// Database connection with better error handling
let isConnected = false

const connectDB = async () => {
  if (isConnected) {
    return
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    isConnected = db.connections[0].readyState === 1
    console.log("✅ Connected to MongoDB")
  } catch (error) {
    console.error("❌ MongoDB connection error:", error)
    // Don't throw error, continue without DB for now
  }
}

// Connect to database
connectDB()

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  // Join rooms for real-time updates
  socket.on("join-vendor", (vendorId) => {
    socket.join(`vendor-${vendorId}`)
    console.log(`Vendor ${vendorId} joined room`)
  })

  socket.on("join-customer", (customerId) => {
    socket.join(`customer-${customerId}`)
    console.log(`Customer ${customerId} joined room`)
  })

  socket.on("join-delivery", (deliveryId) => {
    socket.join(`delivery-${deliveryId}`)
    console.log(`Delivery partner ${deliveryId} joined room`)
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)
  })
})

// Make io available to routes
app.set("io", io)

// Health check endpoints
app.get("/", (req, res) => {
  res.json({
    message: "🍕 Street Eats API is running!",
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
})

app.get("/api", (req, res) => {
  res.json({
    message: "Street Eats API v1.0",
    status: "OK",
    endpoints: {
      auth: "/api/auth",
      vendors: "/api/vendors",
      orders: "/api/orders",
      delivery: "/api/delivery",
      payments: "/api/payments",
      upload: "/api/upload",
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
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

// API Routes with proper error handling
try {
  app.use("/api/auth", require("./routes/auth"))
  app.use("/api/vendors", require("./routes/vendors"))
  app.use("api/customer"),require("./routes/customer")
  app.use("/api/orders", require("./routes/orders"))
  app.use("/api/delivery", require("./routes/delivery"))
  app.use("/api/payments", require("./routes/payments"))
  app.use("/api/upload", require("./routes/upload"))
} catch (error) {
  console.error("Route loading error:", error)
}

// Catch-all for API routes that don't exist
app.all("/api/*", (req, res) => {
  res.status(404).json({
    message: "API endpoint not found",
    method: req.method,
    path: req.path,
    availableEndpoints: [
      "GET /api/health",
      "POST /api/auth/login",
      "POST /api/auth/register/customer",
      "GET /api/customer",
      "GET /api/vendors",
      "POST /api/orders",
    ],
  })
})

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error:", err.stack)

  // Handle specific error types
  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation Error",
      error: err.message,
    })
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      message: "Invalid ID format",
      error: err.message,
    })
  }

  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  })
})

// 404 handler for non-API routes
app.use("*", (req, res) => {
  res.status(404).json({
    message: "Route not found",
    method: req.method,
    path: req.path,
    suggestion: "Check if you meant to access /api/* endpoints",
  })
})

// For Vercel deployment
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
  })
}

module.exports = app
