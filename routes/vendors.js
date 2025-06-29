const express = require("express")
const Vendor = require("../models/Vendor")
const Order = require("../models/Order")
const Review = require("../models/Review") // Import Review model
const auth = require("../middleware/auth")
const upload = require("../middleware/upload")
const ErrorHandler = require("../utils/errorHandler")

const router = express.Router()

// Helper function to calculate distance (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// GET ALL VENDORS (For customers)
router.get("/", async (req, res, next) => {
  try {
    const { cuisine, search, lat, lng, radius = 10 } = req.query

    const query = { status: "approved", isActive: true }

    // Filter by cuisine
    if (cuisine && cuisine !== "all") {
      query.cuisine = { $in: [cuisine] }
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { shopName: { $regex: search, $options: "i" } },
        { shopDescription: { $regex: search, $options: "i" } },
        { cuisine: { $in: [new RegExp(search, "i")] } },
      ]
    }

    let vendors = await Vendor.find(query).populate("userId", "name email phone")

    // Filter by location if coordinates provided
    if (lat && lng) {
      const userLat = Number.parseFloat(lat)
      const userLng = Number.parseFloat(lng)
      const searchRadius = Number.parseFloat(radius)

      if (isNaN(userLat) || isNaN(userLng) || isNaN(searchRadius)) {
        return next(new ErrorHandler("Invalid latitude, longitude, or radius provided.", 400))
      }

      vendors = vendors.filter((vendor) => {
        // Ensure vendor.address.coordinates exists and has at least 2 elements (longitude, latitude)
        if (!vendor.address || !vendor.address.coordinates || vendor.address.coordinates.length < 2) {
          console.warn(`Vendor ${vendor._id} missing valid coordinates. Skipping distance calculation.`)
          return false // Exclude vendors without valid coordinates
        }
        const vendorLng = vendor.address.coordinates[0]
        const vendorLat = vendor.address.coordinates[1]

        const distance = calculateDistance(userLat, userLng, vendorLat, vendorLng)
        return distance <= searchRadius
      })
    }

    res.json({
      success: true,
      vendors: vendors.map((vendor) => ({
        id: vendor._id,
        shopName: vendor.shopName,
        shopDescription: vendor.shopDescription,
        cuisine: vendor.cuisine,
        address: vendor.address,
        rating: vendor.rating,
        deliveryRadius: vendor.deliveryRadius,
        operationalHours: vendor.operationalHours,
        images: vendor.images,
        isActive: vendor.isActive,
        menu: vendor.menu.filter((item) => item.isAvailable),
      })),
    })
  } catch (error) {
    console.error("Get vendors error:", error)
    next(new ErrorHandler("Failed to fetch vendors", 500))
  }
})

// GET SINGLE VENDOR (For customers)
router.get("/:id", async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate("userId", "name email phone")

    if (!vendor || vendor.status !== "approved") {
      return next(new ErrorHandler("Vendor not found or not approved.", 404))
    }

    res.json({
      success: true,
      vendor: {
        id: vendor._id,
        shopName: vendor.shopName,
        shopDescription: vendor.shopDescription,
        cuisine: vendor.cuisine,
        address: vendor.address,
        contact: vendor.contact,
        operationalHours: vendor.operationalHours,
        deliveryRadius: vendor.deliveryRadius,
        rating: vendor.rating,
        images: vendor.images,
        menu: vendor.menu.filter((item) => item.isAvailable),
        totalOrders: vendor.totalOrders,
      },
    })
  } catch (error) {
    console.error("Get vendor error:", error)
    if (error.name === "CastError") {
      return next(new ErrorHandler("Invalid Vendor ID format.", 400))
    }
    next(new ErrorHandler("Failed to fetch vendor", 500))
  }
})

// GET VENDOR DASHBOARD (For vendors)
router.get("/dashboard/stats", auth, async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return next(new ErrorHandler("Access denied. Only vendors can access this dashboard.", 403))
    }

    const vendor = await Vendor.findOne({ userId: req.user.id }) // Use req.user.id from auth middleware
    if (!vendor) {
      return next(new ErrorHandler("Vendor profile not found for this user.", 404))
    }

    // Get today's orders
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayOrders = await Order.find({
      vendorId: vendor._id,
      createdAt: { $gte: today, $lt: tomorrow },
    })

    // Get pending orders
    const pendingOrders = await Order.find({
      vendorId: vendor._id,
      status: { $in: ["placed", "accepted", "preparing"] },
    }).populate("customerId", "name phone")

    // Calculate stats
    const todayRevenue = todayOrders.reduce((sum, order) => sum + order.pricing.total, 0)
    const todayOrderCount = todayOrders.length
    const avgOrderValue = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0

    // Weekly Stats (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weeklyOrders = await Order.find({
      vendorId: vendor._id,
      createdAt: { $gte: sevenDaysAgo },
      status: "delivered",
    })
    const weeklyRevenue = weeklyOrders.reduce((sum, order) => sum + order.pricing.total, 0)
    const weeklyOrderCount = weeklyOrders.length
    // For growth, you'd need previous week's data. For simplicity, we'll use a placeholder or calculate based on current week.
    const weeklyGrowth = 12.5 // Placeholder for now

    // Top Performing Dishes
    const topDishes = await Order.aggregate([
      { $match: { vendorId: vendor._id, createdAt: { $gte: today }, status: "delivered" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.menuItemId",
          name: { $first: "$items.name" },
          orders: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ])

    // Customer Feedback
    const vendorReviews = await Review.find({ vendorId: vendor._id }).sort({ createdAt: -1 }).limit(5)
    const totalReviews = await Review.countDocuments({ vendorId: vendor._id })
    const averageRatingResult = await Review.aggregate([
      { $match: { vendorId: vendor._id } },
      { $group: { _id: null, avgRating: { $avg: "$overall" } } },
    ])
    const averageRating =
      averageRatingResult.length > 0 ? Number.parseFloat(averageRatingResult[0].avgRating.toFixed(1)) : 0

    res.json({
      success: true,
      vendor: {
        id: vendor._id,
        shopName: vendor.shopName,
        shopDescription: vendor.shopDescription, // Added for VendorProfile
        cuisine: vendor.cuisine, // Added for VendorProfile
        address: vendor.address, // Added for VendorProfile
        contact: vendor.contact, // Added for VendorProfile
        operationalHours: vendor.operationalHours, // Added for VendorProfile
        deliveryRadius: vendor.deliveryRadius, // Added for VendorProfile
        minimumOrderValue: vendor.minimumOrderValue, // Added for VendorProfile
        averagePreparationTime: vendor.averagePreparationTime, // Added for VendorProfile
        images: vendor.images, // Added for VendorProfile
        rating: vendor.rating,
        totalOrders: vendor.totalOrders,
        totalRevenue: vendor.totalRevenue,
        isActive: vendor.isActive,
        menu: vendor.menu, // Include the full menu here
      },
      todayStats: {
        orders: todayOrderCount,
        revenue: todayRevenue,
        avgOrderValue: avgOrderValue, // Added
      },
      weeklyStats: {
        revenue: weeklyRevenue,
        orders: weeklyOrderCount,
        growth: weeklyGrowth,
      },
      topDishes: topDishes,
      customerFeedback: {
        averageRating: averageRating,
        totalReviews: totalReviews,
        recentReviews: vendorReviews.map((review) => ({
          customer: review.customerId ? review.customerId.name : "Anonymous", // Populate customer name if needed
          rating: review.overall,
          comment: review.review,
        })),
      },
      pendingOrders: pendingOrders.map((order) => ({
        id: order._id,
        orderId: order.orderId, // Ensure orderId is included
        customerName: order.customerId ? order.customerId.name : "N/A", // Populate customer name
        customerPhone: order.customerId ? order.customerId.phone : "N/A", // Populate customer phone
        items: order.items,
        total: order.pricing.total,
        status: order.status,
        orderTime: order.createdAt.toLocaleString(), // Format date
        deliveryAddress: order.deliveryAddress,
      })),
    })
  } catch (error) {
    console.error("Vendor dashboard error:", error)
    next(new ErrorHandler("Failed to fetch vendor dashboard data", 500))
  }
})

// UPDATE VENDOR PROFILE
router.put(
  "/profile",
  auth,
  upload.fields([
    { name: "shopImage", maxCount: 1 },
    { name: "licenseImage", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      if (req.user.role !== "vendor") {
        return next(new ErrorHandler("Access denied. Only vendors can update their profile.", 403))
      }

      const vendor = await Vendor.findOne({ userId: req.user.id })
      if (!vendor) {
        return next(new ErrorHandler("Vendor profile not found for this user.", 404))
      }

      const updateData = { ...req.body }

      // Handle file uploads
      if (req.files && req.files.shopImage && req.files.shopImage[0]) {
        updateData["images.shop"] = req.files.shopImage[0].path
      }
      if (req.files && req.files.licenseImage && req.files.licenseImage[0]) {
        updateData["businessDetails.licenseImage"] = req.files.licenseImage[0].path
      }

      // Update top-level fields and nested fields
      for (const key in updateData) {
        if (key.includes(".")) {
          // Handle nested fields (e.g., "address.street")
          const [parent, child] = key.split(".")
          if (vendor[parent] && typeof vendor[parent] === "object") {
            vendor[parent][child] = updateData[key]
          }
        } else if (key === "cuisine") {
          // Ensure cuisine is an array
          vendor.cuisine =
            typeof updateData.cuisine === "string"
              ? updateData.cuisine.split(",").map((c) => c.trim())
              : updateData.cuisine
        } else if (key === "operationalHours") {
          // Handle operationalHours as a nested object
          if (typeof updateData.operationalHours === "string") {
            try {
              vendor.operationalHours = JSON.parse(updateData.operationalHours)
            } catch (e) {
              console.warn("Failed to parse operationalHours string:", e)
              // Fallback or error handling if JSON parsing fails
            }
          } else {
            vendor.operationalHours = updateData.operationalHours
          }
        } else {
          // Update top-level fields
          vendor[key] = updateData[key]
        }
      }

      await vendor.save() // Use save() to trigger schema validation and pre-save hooks

      res.json({
        success: true,
        message: "Profile updated successfully",
        vendor: vendor, // Send back the updated vendor object
      })
    } catch (error) {
      console.error("Update vendor profile error:", error)
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((val) => val.message)
        return next(new ErrorHandler(`Validation failed: ${messages.join(", ")}`, 400))
      }
      next(new ErrorHandler("Failed to update profile", 500))
    }
  },
)

// ADD MENU ITEM
router.post("/menu", auth, upload.single("itemImage"), async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return next(new ErrorHandler("Access denied. Only vendors can add menu items.", 403))
    }

    const vendor = await Vendor.findOne({ userId: req.user.id })
    if (!vendor) {
      return next(new ErrorHandler("Vendor profile not found for this user.", 404))
    }

    const { name, description, price, category, isVeg } = req.body

    if (!name || !price || !category) {
      return next(new ErrorHandler("Menu item name, price, and category are required.", 400))
    }

    const menuItem = {
      name,
      description: description || "",
      price: Number.parseFloat(price),
      category,
      isVeg: isVeg === "true" || isVeg === true, // Handle boolean conversion
      image: req.file ? req.file.path : "",
      isAvailable: true,
    }

    if (isNaN(menuItem.price)) {
      return next(new ErrorHandler("Menu item price must be a valid number.", 400))
    }

    vendor.menu.push(menuItem)
    await vendor.save()

    res.status(201).json({
      success: true,
      message: "Menu item added successfully",
      menuItem: vendor.menu[vendor.menu.length - 1], // Return the newly added item
    })
  } catch (error) {
    console.error("Add menu item error:", error)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message)
      return next(new ErrorHandler(`Validation failed: ${messages.join(", ")}`, 400))
    }
    next(new ErrorHandler("Failed to add menu item", 500))
  }
})

// UPDATE MENU ITEM
router.put("/menu/:itemId", auth, upload.single("itemImage"), async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return next(new ErrorHandler("Access denied. Only vendors can update menu items.", 403))
    }

    const vendor = await Vendor.findOne({ userId: req.user.id })
    if (!vendor) {
      return next(new ErrorHandler("Vendor profile not found for this user.", 404))
    }

    const menuItem = vendor.menu.id(req.params.itemId)
    if (!menuItem) {
      return next(new ErrorHandler("Menu item not found.", 404))
    }

    // Update menu item fields
    Object.assign(menuItem, req.body)
    if (req.file) {
      menuItem.image = req.file.path
    }
    if (req.body.price) {
      menuItem.price = Number.parseFloat(req.body.price)
      if (isNaN(menuItem.price)) {
        return next(new ErrorHandler("Menu item price must be a valid number.", 400))
      }
    }
    if (req.body.isVeg !== undefined) {
      menuItem.isVeg = req.body.isVeg === "true" || req.body.isVeg === true
    }
    if (req.body.isAvailable !== undefined) {
      menuItem.isAvailable = req.body.isAvailable === "true" || req.body.isAvailable === true
    }

    await vendor.save()

    res.json({
      success: true,
      message: "Menu item updated successfully",
      menuItem,
    })
  } catch (error) {
    console.error("Update menu item error:", error)
    if (error.name === "CastError") {
      return next(new ErrorHandler("Invalid Menu Item ID format.", 400))
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message)
      return next(new ErrorHandler(`Validation failed: ${messages.join(", ")}`, 400))
    }
    next(new ErrorHandler("Failed to update menu item", 500))
  }
})

// DELETE MENU ITEM
router.delete("/menu/:itemId", auth, async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return next(new ErrorHandler("Access denied. Only vendors can delete menu items.", 403))
    }

    const vendor = await Vendor.findOne({ userId: req.user.id })
    if (!vendor) {
      return next(new ErrorHandler("Vendor profile not found for this user.", 404))
    }

    const menuItem = vendor.menu.id(req.params.itemId)
    if (!menuItem) {
      return next(new ErrorHandler("Menu item not found.", 404))
    }

    menuItem.remove() // Mongoose subdocument remove method
    await vendor.save()

    res.json({ success: true, message: "Menu item deleted successfully" })
  } catch (error) {
    console.error("Delete menu item error:", error)
    if (error.name === "CastError") {
      return next(new ErrorHandler("Invalid Menu Item ID format.", 400))
    }
    next(new ErrorHandler("Failed to delete menu item", 500))
  }
})

// TOGGLE VENDOR ACTIVE STATUS
router.put("/toggle-status", auth, async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return next(new ErrorHandler("Access denied. Only vendors can toggle their status.", 403))
    }

    const vendor = await Vendor.findOne({ userId: req.user.id })
    if (!vendor) {
      return next(new ErrorHandler("Vendor profile not found for this user.", 404))
    }

    vendor.isActive = !vendor.isActive
    await vendor.save()

    // Emit status change to connected clients
    const io = req.app.get("io")
    if (io) {
      io.emit("vendor-status-changed", {
        vendorId: vendor._id,
        isActive: vendor.isActive,
      })
    }

    res.json({
      success: true,
      message: `Vendor ${vendor.isActive ? "activated" : "deactivated"} successfully`,
      isActive: vendor.isActive,
    })
  } catch (error) {
    console.error("Toggle vendor status error:", error)
    next(new ErrorHandler("Failed to toggle vendor status", 500))
  }
})

module.exports = router
