const express = require("express")
const Vendor = require("../models/Vendor")
const ErrorHandler = require("../utils/errorHandler")

const router = express.Router()

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

function escapeRegExp(string = "") {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function formatDistance(distance) {
  if (distance == null || Number.isNaN(distance)) {
    return null
  }
  return Number(distance.toFixed(2))
}

async function performSearch({
  searchTerm,
  scope,
  radiusKm,
  userLat,
  userLng,
  vendorLimit,
  dishLimit,
}) {
  const hasLocation = Number.isFinite(userLat) && Number.isFinite(userLng)
  const regex = searchTerm ? new RegExp(escapeRegExp(searchTerm), "i") : null

  const baseQuery = { status: "approved", isActive: true }
  if (regex) {
    baseQuery.$or = [
      { shopName: regex },
      { shopDescription: regex },
      { cuisine: { $in: [regex] } },
      { "address.city": regex },
      { "address.state": regex },
      { "address.pincode": regex },
    ]
  }

  const vendorsRaw = await Vendor.find(baseQuery).lean()

  const vendorEntries = []
  const vendorMap = new Map()

  vendorsRaw.forEach((vendor) => {
    let distanceKm = null
    if (hasLocation && vendor.address?.coordinates?.length >= 2) {
      const [vendorLng, vendorLat] = vendor.address.coordinates
      distanceKm = calculateDistance(userLat, userLng, vendorLat, vendorLng)
    }

    vendorMap.set(String(vendor._id), { vendor, distanceKm })

    if (scope === "nearby") {
      if (!hasLocation) {
        vendorEntries.push({ vendor, distanceKm })
      } else if (distanceKm != null && distanceKm <= radiusKm) {
        vendorEntries.push({ vendor, distanceKm })
      }
    } else {
      vendorEntries.push({ vendor, distanceKm })
    }
  })

  let fallbackUsed = false
  let effectiveVendors = vendorEntries

  if (scope === "nearby") {
    if (!hasLocation) {
      fallbackUsed = true
      effectiveVendors = vendorsRaw.map((vendor) => vendorMap.get(String(vendor._id)))
    } else if (vendorEntries.length === 0 && vendorsRaw.length > 0) {
      fallbackUsed = true
      effectiveVendors = vendorsRaw.map((vendor) => vendorMap.get(String(vendor._id)))
    }
  }

  effectiveVendors = effectiveVendors.filter(Boolean)

  effectiveVendors.sort((a, b) => {
    if (hasLocation) {
      return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)
    }
    const ratingA = a.vendor.rating?.average ?? 0
    const ratingB = b.vendor.rating?.average ?? 0
    if (ratingB !== ratingA) {
      return ratingB - ratingA
    }
    return (a.vendor.stats?.totalOrders ?? 0) - (b.vendor.stats?.totalOrders ?? 0)
  })

  const limitedVendors = effectiveVendors.slice(0, vendorLimit)

  const vendorResults = limitedVendors.map(({ vendor, distanceKm }) => ({
    id: vendor._id,
    shopName: vendor.shopName,
    shopDescription: vendor.shopDescription,
    cuisine: vendor.cuisine,
    rating: vendor.rating,
    distanceKm: formatDistance(distanceKm),
    deliveryRadius: vendor.deliveryRadius,
    isActive: vendor.isActive,
    images: vendor.images,
    address: vendor.address,
    specialties: vendor.specialties,
  }))

  const dishResults = []
  if (dishLimit > 0) {
    const seen = new Set()
    const sourceVendors = effectiveVendors.slice(0, Math.max(vendorLimit, 12))

    sourceVendors.forEach(({ vendor, distanceKm }) => {
      const menu = vendor.menu || []
      menu.forEach((item) => {
        if (!item || item.isAvailable === false) {
          return
        }

        const matches = regex
          ? regex.test(item.name) ||
            (!!item.description && regex.test(item.description)) ||
            (!!item.category && regex.test(item.category))
          : item.isPopular || item.isFeatured

        if (!matches) {
          return
        }

        const dishId = String(item._id)
        if (seen.has(dishId)) {
          return
        }

        seen.add(dishId)
        dishResults.push({
          id: dishId,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image,
          category: item.category,
          isVeg: item.isVeg,
          isAvailable: item.isAvailable,
          vendor: {
            id: vendor._id,
            shopName: vendor.shopName,
            rating: vendor.rating,
            distanceKm: formatDistance(distanceKm),
          },
        })
      })
    })

    if (dishResults.length === 0 && sourceVendors.length > 0) {
      fallbackUsed = true
      sourceVendors.forEach(({ vendor, distanceKm }) => {
        (vendor.menu || [])
          .filter((item) => item && item.isAvailable !== false)
          .slice(0, 2)
          .forEach((item) => {
            const dishId = String(item._id)
            if (seen.has(dishId) || dishResults.length >= dishLimit) {
              return
            }
            seen.add(dishId)
            dishResults.push({
              id: dishId,
              name: item.name,
              description: item.description,
              price: item.price,
              image: item.image,
              category: item.category,
              isVeg: item.isVeg,
              isAvailable: item.isAvailable,
              vendor: {
                id: vendor._id,
                shopName: vendor.shopName,
                rating: vendor.rating,
                distanceKm: formatDistance(distanceKm),
              },
            })
          })
      })
    }
  }

  return {
    vendors: vendorResults,
    dishes: dishLimit > 0 ? dishResults.slice(0, dishLimit) : [],
    fallbackUsed,
    hasLocation,
    totalVendors: vendorResults.length,
    totalDishes: Math.min(dishResults.length, dishLimit),
  }
}

router.get("/", async (req, res, next) => {
  try {
    const searchTerm = (req.query.q || "").toString().trim()
    const scope = req.query.scope === "all" ? "all" : "nearby"
    const radiusKm = (() => {
      const parsed = Number.parseFloat(req.query.radius ?? "5")
      return Number.isNaN(parsed) ? 5 : parsed
    })()
    const vendorLimit = Math.min(Number.parseInt(req.query.vendorLimit, 10) || 20, 50)
    const dishLimit = Math.min(Number.parseInt(req.query.dishLimit, 10) || 20, 50)
    const userLat = req.query.lat !== undefined ? Number.parseFloat(req.query.lat) : Number.NaN
    const userLng = req.query.lng !== undefined ? Number.parseFloat(req.query.lng) : Number.NaN

    if ((req.query.lat && Number.isNaN(userLat)) || (req.query.lng && Number.isNaN(userLng))) {
      return next(new ErrorHandler("Invalid latitude or longitude provided.", 400))
    }

    const result = await performSearch({
      searchTerm,
      scope,
      radiusKm,
      userLat,
      userLng,
      vendorLimit,
      dishLimit,
    })

    res.json({
      success: true,
      query: searchTerm,
      scope,
      radiusKm,
      hasLocation: result.hasLocation,
      fallbackUsed: result.fallbackUsed,
      vendors: result.vendors,
      dishes: result.dishes,
      metadata: {
        vendors: result.totalVendors,
        dishes: result.totalDishes,
      },
    })
  } catch (error) {
    console.error("Global search error:", error)
    next(new ErrorHandler("Failed to perform search", 500))
  }
})

router.get("/vendors", async (req, res, next) => {
  try {
    const searchTerm = (req.query.q || "").toString().trim()
    const scope = req.query.scope === "all" ? "all" : "nearby"
    const radiusKm = (() => {
      const parsed = Number.parseFloat(req.query.radius ?? "5")
      return Number.isNaN(parsed) ? 5 : parsed
    })()
    const vendorLimit = Math.min(Number.parseInt(req.query.limit, 10) || 30, 60)
    const userLat = req.query.lat !== undefined ? Number.parseFloat(req.query.lat) : Number.NaN
    const userLng = req.query.lng !== undefined ? Number.parseFloat(req.query.lng) : Number.NaN

    if ((req.query.lat && Number.isNaN(userLat)) || (req.query.lng && Number.isNaN(userLng))) {
      return next(new ErrorHandler("Invalid latitude or longitude provided.", 400))
    }

    const result = await performSearch({
      searchTerm,
      scope,
      radiusKm,
      userLat,
      userLng,
      vendorLimit,
      dishLimit: 0,
    })

    res.json({
      success: true,
      vendors: result.vendors,
      hasLocation: result.hasLocation,
      fallbackUsed: result.fallbackUsed,
      metadata: {
        vendors: result.totalVendors,
        radiusKm,
        scope,
      },
    })
  } catch (error) {
    console.error("Vendor search error:", error)
    next(new ErrorHandler("Failed to search vendors", 500))
  }
})

router.get("/menu-items", async (req, res, next) => {
  try {
    const searchTerm = (req.query.q || "").toString().trim()
    const scope = req.query.scope === "all" ? "all" : "nearby"
    const radiusKm = (() => {
      const parsed = Number.parseFloat(req.query.radius ?? "5")
      return Number.isNaN(parsed) ? 5 : parsed
    })()
    const dishLimit = Math.min(Number.parseInt(req.query.limit, 10) || 30, 60)
    const userLat = req.query.lat !== undefined ? Number.parseFloat(req.query.lat) : Number.NaN
    const userLng = req.query.lng !== undefined ? Number.parseFloat(req.query.lng) : Number.NaN

    if ((req.query.lat && Number.isNaN(userLat)) || (req.query.lng && Number.isNaN(userLng))) {
      return next(new ErrorHandler("Invalid latitude or longitude provided.", 400))
    }

    const result = await performSearch({
      searchTerm,
      scope,
      radiusKm,
      userLat,
      userLng,
      vendorLimit: 40,
      dishLimit,
    })

    res.json({
      success: true,
      dishes: result.dishes,
      hasLocation: result.hasLocation,
      fallbackUsed: result.fallbackUsed,
      metadata: {
        dishes: result.totalDishes,
        radiusKm,
        scope,
      },
    })
  } catch (error) {
    console.error("Menu search error:", error)
    next(new ErrorHandler("Failed to search dishes", 500))
  }
})

module.exports = router

