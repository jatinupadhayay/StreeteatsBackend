const express = require("express")
const mongoose = require("mongoose")
const Vendor = require("../models/Vendor")
const Order = require("../models/Order")
const Review = require("../models/Review")
const auth = require("../middleware/auth")
const upload = require("../middleware/upload")
const ErrorHandler = require("../utils/errorHandler")
const cloudinary = require("cloudinary").v2
const fs = require("fs")

const router = express.Router()

const DEFAULT_TRENDING_LIMIT = 15
const DEFAULT_TRENDING_WINDOW_DAYS = 14

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Helper function to calculate distance (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDistance(distance) {
  if (distance == null || Number.isNaN(distance)) {
    return null
  }
  return Number(distance.toFixed(2))
}

// GET ALL VENDORS (For customers)
router.get("/", async (req, res, next) => {
  try {
    const { cuisine, search, lat, lng, radius } = req.query
    const query = { status: "approved", isActive: true }

    if (search) {
      query.$or = [
        { shopName: { $regex: search, $options: "i" } },
        { shopDescription: { $regex: search, $options: "i" } },
        { cuisine: { $in: [new RegExp(search, "i")] } },
      ]
    }

    const vendorsRaw = await Vendor.find(query).populate("userId", "name email phone").lean()
    const vendorDistanceMap = new Map()
    let vendors = vendorsRaw
    const hasLocation = lat !== undefined && lng !== undefined && lat !== "" && lng !== ""

    if (hasLocation) {
      const userLat = Number.parseFloat(lat)
      const userLng = Number.parseFloat(lng)
      const searchRadius = Number.parseFloat(radius ?? "10")

      if (Number.isNaN(userLat) || Number.isNaN(userLng) || Number.isNaN(searchRadius)) {
        return next(new ErrorHandler("Invalid latitude, longitude, or radius provided.", 400))
      }

      const filteredVendors = []
      vendorsRaw.forEach((vendor) => {
        if (!vendor.address || !vendor.address.coordinates || vendor.address.coordinates.length < 2) {
          vendorDistanceMap.set(String(vendor._id), null)
          return
        }
        const [vendorLng, vendorLat] = vendor.address.coordinates
        if (vendorLng === 0 && vendorLat === 0) {
          vendorDistanceMap.set(String(vendor._id), null)
          return
        }
        const distanceKm = calculateDistance(userLat, userLng, vendorLat, vendorLng)
        vendorDistanceMap.set(String(vendor._id), distanceKm)
        if (distanceKm <= searchRadius) {
          filteredVendors.push(vendor)
        }
      })
      vendors = filteredVendors
    } else {
      vendorsRaw.forEach((vendor) => {
        vendorDistanceMap.set(String(vendor._id), null)
      })
    }

    res.json({
      success: true,
      vendors: vendors.map((vendor) => ({
        id: vendor._id,
        _id: vendor.userId,
        shopName: vendor.shopName,
        shopDescription: vendor.shopDescription,
        cuisine: vendor.cuisine,
        address: vendor.address,
        rating: vendor.rating,
        deliveryRadius: vendor.deliveryRadius,
        operationalHours: vendor.operationalHours,
        distanceKm: formatDistance(vendorDistanceMap.get(String(vendor._id))),
        images: {
          shop: vendor.images?.shop || null,
          gallery: vendor.images?.gallery || [],
        },
        isActive: vendor.isActive,
        menu: (vendor.menu || []).filter((item) => item.isAvailable),
      })),
    })
  } catch (error) {
    console.error("Get vendors error:", error)
    next(new ErrorHandler("Failed to fetch vendors", 500))
  }
})

// TRENDING DISHES
router.get("/trending/dishes", async (req, res, next) => {
  try {
    const { lat, lng, radius, limit, days } = req.query
    const limitNum = Math.min(Number.parseInt(limit, 10) || DEFAULT_TRENDING_LIMIT, 50)
    const windowDaysRaw = Number.parseInt(days, 10)
    const windowDays = Math.min(Math.max(windowDaysRaw || DEFAULT_TRENDING_WINDOW_DAYS, 1), 90)
    const radiusKm = (() => {
      const parsed = Number.parseFloat(radius ?? "5")
      return Number.isNaN(parsed) ? 5 : parsed
    })()

    const vendorsRaw = await Vendor.find({ status: "approved", isActive: true }).lean()
    if (vendorsRaw.length === 0) {
      return res.json({ success: true, dishes: [], metadata: { total: 0, limit: limitNum, radiusKm, windowDays } })
    }

    const vendorMap = new Map()
    vendorsRaw.forEach((vendor) => vendorMap.set(String(vendor._id), { vendor, distanceKm: null }))

    let hasLocation = false
    let userLat, userLng
    if (lat !== undefined && lng !== undefined && lat !== "" && lng !== "") {
      userLat = Number.parseFloat(lat)
      userLng = Number.parseFloat(lng)
      if (!Number.isNaN(userLat) && !Number.isNaN(userLng)) hasLocation = true
    }

    let filteredVendors = vendorsRaw
    if (hasLocation) {
      const withinRadius = []
      vendorsRaw.forEach((vendor) => {
        const coords = vendor.address?.coordinates
        if (Array.isArray(coords) && coords.length >= 2) {
          const distanceKm = calculateDistance(userLat, userLng, coords[1], coords[0])
          vendorMap.set(String(vendor._id), { vendor, distanceKm })
          if (distanceKm <= radiusKm) withinRadius.push(vendor)
        }
      })
      if (withinRadius.length > 0) filteredVendors = withinRadius
    }

    const vendorIds = filteredVendors.map((v) => v._id)
    const matchStage = { vendorId: { $in: vendorIds }, status: { $nin: ["cancelled"] } }
    if (windowDays > 0) matchStage.createdAt = { $gte: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) }

    const aggregation = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $group: {
          _id: { vendorId: "$vendorId", menuItemId: "$items.menuItemId" },
          totalOrders: { $sum: "$items.quantity" },
          lastOrderedAt: { $max: "$updatedAt" },
        },
      },
      { $sort: { totalOrders: -1, lastOrderedAt: -1 } },
      { $limit: limitNum * 2 },
    ])

    const dishes = []
    const seenDishIds = new Set()
    aggregation.forEach((entry) => {
      const vendorEntry = vendorMap.get(entry._id.vendorId.toString())
      if (!vendorEntry) return
      const menuItem = (vendorEntry.vendor.menu || []).find((item) => String(item._id) === entry._id.menuItemId)
      if (!menuItem || !menuItem.isAvailable || seenDishIds.has(entry._id.menuItemId)) return
      seenDishIds.add(entry._id.menuItemId)
      dishes.push({
        id: entry._id.menuItemId,
        name: menuItem.name,
        price: menuItem.price,
        image: menuItem.image,
        totalOrders: entry.totalOrders,
        vendor: { id: vendorEntry.vendor._id, shopName: vendorEntry.vendor.shopName, distanceKm: formatDistance(vendorEntry.distanceKm) }
      })
    })

    res.json({ success: true, dishes: dishes.slice(0, limitNum) })
  } catch (error) {
    console.error("Trending dishes error:", error)
    next(new ErrorHandler("Failed to fetch trending dishes", 500))
  }
})

// GET VENDOR DASHBOARD (Fresh direct fetch)
router.get("/dashboard/stats", auth, async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId })
    if (!vendor) return next(new ErrorHandler("Vendor profile not found", 404))

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [todayOrders, pendingOrders, weeklyOrders, vendorReviews, totalReviews, avgRatingResult] = await Promise.all([
      Order.find({ vendorId: vendor._id, createdAt: { $gte: today }, status: { $ne: "cancelled" } }).lean(),
      Order.find({ vendorId: vendor._id, status: { $in: ["placed", "accepted", "preparing"] } }).populate("customerId", "name phone").lean(),
      Order.find({ vendorId: vendor._id, createdAt: { $gte: sevenDaysAgo }, status: "delivered" }).lean(),
      Review.find({ vendorId: vendor._id }).sort({ createdAt: -1 }).limit(5).populate("customerId", "name").lean(),
      Review.countDocuments({ vendorId: vendor._id }),
      Review.aggregate([{ $match: { vendorId: vendor._id } }, { $group: { _id: null, avg: { $avg: "$ratings.food.overall" } } }])
    ])

    const todayRevenue = (todayOrders || []).reduce((sum, o) => sum + (o.pricing?.total || 0), 0)
    const weeklyRevenue = (weeklyOrders || []).reduce((sum, o) => sum + (o.pricing?.total || 0), 0)
    const averageRating = (avgRatingResult && avgRatingResult.length > 0 && avgRatingResult[0].avg)
      ? parseFloat(avgRatingResult[0].avg.toFixed(1))
      : 0

    res.json({
      success: true,
      vendor: { id: vendor._id, shopName: vendor.shopName, stats: vendor.stats || {} },
      todayStats: { orders: (todayOrders || []).length, revenue: todayRevenue },
      weeklyStats: { orders: (weeklyOrders || []).length, revenue: weeklyRevenue },
      customerFeedback: {
        averageRating,
        totalReviews: totalReviews || 0,
        recentReviews: (vendorReviews || []).map(r => ({
          customer: r.customerId?.name || "Anonymous",
          rating: r.ratings?.food?.overall || 0,
          comment: r.comments?.overall || ""
        }))
      },
      pendingOrders: (pendingOrders || []).map(o => ({
        id: o._id,
        customerName: o.customerId?.name || "N/A",
        items: o.items || [],
        total: o.pricing?.total || 0
      }))
    })
  } catch (error) {
    next(new ErrorHandler("Failed to load dashboard", 500))
  }
})

// GET PAYMENT SETTINGS
router.get("/payment-settings", auth, async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId }).lean()
    if (!vendor) return next(new ErrorHandler("Vendor not found", 404))
    res.json({
      success: true,
      settings: {
        upiId: vendor.businessDetails?.upiId || "",
        upiName: vendor.businessDetails?.upiName || "",
        upiEnabled: vendor.businessDetails?.upiEnabled || false,
      }
    })
  } catch (error) {
    next(new ErrorHandler("Failed to fetch payment settings", 500))
  }
})

// UPDATE PAYMENT SETTINGS
router.put("/payment-settings", auth, async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId })
    if (!vendor) return next(new ErrorHandler("Vendor profile not found", 404))

    if (!vendor.businessDetails) vendor.businessDetails = { licenseNumber: "NA", bankAccount: "NA", ifscCode: "NA" }
    vendor.businessDetails.upiId = req.body.upiId || ""
    vendor.businessDetails.upiName = req.body.upiName || ""
    vendor.businessDetails.upiEnabled = req.body.upiEnabled || false
    vendor.markModified('businessDetails')
    await vendor.save()
    res.json({ success: true, message: "Settings updated", settings: vendor.businessDetails })
  } catch (error) {
    next(new ErrorHandler("Failed to update settings", 500))
  }
})

// PROMOTIONS
router.get("/promotions", auth, async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId }).lean()
    res.json({ success: true, promotions: vendor?.activeOffers || [] })
  } catch (error) { next(error) }
})

router.post("/promotions", auth, async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId })
    const newOffer = { ...req.body, validTill: req.body.validTill ? new Date(req.body.validTill) : null, isActive: true, usedCount: 0 }
    if (!vendor.activeOffers) vendor.activeOffers = []
    vendor.activeOffers.push(newOffer)
    await vendor.save()
    res.status(201).json({ success: true, message: "Promotion created", promotion: vendor.activeOffers[vendor.activeOffers.length - 1] })
  } catch (error) { next(error) }
})

router.delete("/promotions/:id", auth, async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId })
    vendor.activeOffers = (vendor.activeOffers || []).filter(o => o._id.toString() !== req.params.id)
    await vendor.save()
    res.json({ success: true, message: "Promotion deleted" })
  } catch (error) { next(error) }
})

// INDIVIDUAL VENDOR (Public)
router.get("/:id", async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate("userId", "name email phone")
    if (!vendor || vendor.status !== "approved") return next(new ErrorHandler("Vendor not found", 404))
    res.json({
      success: true,
      vendor: {
        id: vendor._id,
        _id: vendor.userId,
        shopName: vendor.shopName,
        shopDescription: vendor.shopDescription,
        cuisine: vendor.cuisine,
        address: vendor.address,
        rating: vendor.rating,
        deliveryRadius: vendor.deliveryRadius,
        images: vendor.images,
        isActive: vendor.isActive,
        menu: (vendor.menu || []).filter(i => i.isAvailable),
        totalOrders: vendor.stats?.totalOrders || 0,
        activeOffers: vendor.activeOffers || [],
        contact: vendor.contact,
        upiPayment: vendor.upiEnabled ? { enabled: true, upiId: vendor.upiId, upiName: vendor.upiName } : { enabled: false }
      }
    })
  } catch (error) {
    if (error.name === "CastError") return next(new ErrorHandler("Invalid ID", 400))
    next(error)
  }
})

// PROFILE UPDATE
router.put("/profile", auth, upload.fields([{ name: "shopImage", maxCount: 1 }, { name: "gallery", maxCount: 10 }, { name: "licenseImage", maxCount: 1 }]), async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId })
    if (!vendor) return next(new ErrorHandler("Profile not found", 404))

    if (req.files?.shopImage?.[0]) vendor.images.shop = (await cloudinary.uploader.upload(req.files.shopImage[0].path, { folder: "street-eats" })).secure_url
    if (req.files?.gallery) {
      const results = await Promise.all(req.files.gallery.map(f => cloudinary.uploader.upload(f.path, { folder: "street-eats" })))
      vendor.images.gallery = [...(vendor.images.gallery || []), ...results.map(r => r.secure_url)]
    }

    const updateData = req.body
    if (updateData.cuisine) vendor.cuisine = typeof updateData.cuisine === 'string' ? updateData.cuisine.split(',').map(c => c.trim()) : updateData.cuisine

    Object.entries(updateData).forEach(([key, value]) => {
      if (['cuisine', 'images'].includes(key)) return
      if (key.includes('.')) {
        const keys = key.split('.')
        let t = vendor
        for (let i = 0; i < keys.length - 1; i++) { t[keys[i]] = t[keys[i]] || {}; t = t[keys[i]] }
        t[keys[keys.length - 1]] = value
      } else { vendor[key] = value }
    })

    await vendor.save()
    res.json({ success: true, message: "Profile updated", vendor })
  } catch (error) { next(error) }
})

// TOGGLE STATUS
router.put("/toggle-status", auth, async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId })
    vendor.isActive = !vendor.isActive
    await vendor.save()
    res.json({ success: true, isActive: vendor.isActive })
  } catch (error) { next(error) }
})

// MENU MGMT
router.post("/menu", auth, upload.single("itemImage"), async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId })
    let imageUrl = ""
    if (req.file) imageUrl = (await cloudinary.uploader.upload(req.file.path, { folder: "street-eats" })).secure_url
    const item = { ...req.body, price: parseFloat(req.body.price), image: imageUrl, isAvailable: true }
    vendor.menu.push(item)
    await vendor.save()
    res.status(201).json({ success: true, menuItem: vendor.menu[vendor.menu.length - 1] })
  } catch (error) { next(error) }
})

router.put("/menu/:itemId", auth, upload.single("itemImage"), async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId })
    const item = vendor.menu.id(req.params.itemId)
    if (req.file) item.image = (await cloudinary.uploader.upload(req.file.path, { folder: "street-eats" })).secure_url
    Object.assign(item, req.body)
    await vendor.save()
    res.json({ success: true, menuItem: item })
  } catch (error) { next(error) }
})

router.delete("/menu/:itemId", auth, async (req, res, next) => {
  try {
    if (!req.user?.isVendor) return next(new ErrorHandler("Access denied.", 403))
    const vendor = await Vendor.findOne({ userId: req.user.userId })
    vendor.menu.pull(req.params.itemId)
    await vendor.save()
    res.json({ success: true, message: "Deleted" })
  } catch (error) { next(error) }
})

// SOCIAL
router.put("/:id/like", auth, async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
    const userId = req.user.userId
    const idx = vendor.likedBy.indexOf(userId)
    if (idx === -1) { vendor.likedBy.push(userId); vendor.analytics.likes = (vendor.analytics.likes || 0) + 1 }
    else { vendor.likedBy.splice(idx, 1); vendor.analytics.likes = Math.max(0, (vendor.analytics.likes || 0) - 1) }
    await vendor.save()
    res.json({ success: true, likes: vendor.analytics.likes, isLiked: idx === -1 })
  } catch (error) { next(error) }
})

module.exports = router