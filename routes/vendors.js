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
    const { cuisine, search, lat, lng, radius } = req.query

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
    console.log(vendors)

    // Filter by location if coordinates provided
    if (lat && lng) {
      const userLat = Number.parseFloat(lng)
      const userLng = Number.parseFloat(lat)
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
        id:  vendor._id,
        _id: vendor.userId,
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
 
router.get("/:id", async (req, res, next) => {
  
  try {
    const vendor = await Vendor.findById(req.params.id).populate("userId", "name email phone")

    if (!vendor || vendor.status !== "approved") {
      return next(new ErrorHandler("Vendor not found or not approved.", 404))
    }

    res.json({
      success: true,
      vendor: {
        id:  vendor._id,
        _id: vendor.userId,
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
// GET VENDOR DASHBOARD (For vendors)
router.get("/dashboard/stats", auth, async (req, res, next) => {
  try {
    // 1. Verify user is a vendor using the new isVendor flag
    if (!req.user?.isVendor) {
      return next(new ErrorHandler("Access denied. Only vendors can access this dashboard.", 403));
    }

    const vendor = await Vendor.findOne({ userId: req.vendorDetails.userId });
    console
    if (!vendor) {
      return next(new ErrorHandler("Vendor profile not available", 404));
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let todayOrders, pendingOrders, weeklyOrders, vendorReviews, totalReviews, averageRatingResult, topDishes;

    try {
      [todayOrders, pendingOrders, weeklyOrders, vendorReviews, totalReviews, averageRatingResult, topDishes] = 
        await Promise.all([
          Order.find({
            vendorId: vendor._id,
            createdAt: { $gte: today, $lt: tomorrow },
            status: { $ne: "cancelled" }
          }).lean(),
          
          Order.find({
            vendorId: vendor._id,
            status: { $in: ["placed", "accepted", "preparing"] }
          }).populate("customerId", "name phone email").lean(),
          
          Order.find({
            vendorId: vendor._id,
            createdAt: { $gte: sevenDaysAgo },
            status: "delivered"
          }).lean(),
          
          Review.find({ vendorId: vendor._id })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("customerId", "name")
            .lean(),
          
          Review.countDocuments({ vendorId: vendor._id }),
          
          Review.aggregate([
            { $match: { vendorId: vendor._id } },
            { $group: { _id: null, avgRating: { $avg: "$overall" } } }
          ]),
          
          Order.aggregate([
            { 
              $match: { 
                vendorId: vendor._id, 
                createdAt: { $gte: sevenDaysAgo },
                status: "delivered" 
              } 
            },
            { $unwind: "$items" },
            {
              $group: {
                _id: "$items.menuItemId",
                name: { $first: "$items.name" },
                orders: { $sum: "$items.quantity" },
                revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
              }
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 }
          ])
        ]);
    } catch (queryError) {
      console.error("Dashboard queries failed:", queryError);
      return next(new ErrorHandler("Failed to load dashboard data", 500));
    }

    const todayRevenue = todayOrders?.reduce((sum, order) => sum + (order?.pricing?.total || 0), 0) || 0;
    const todayOrderCount = todayOrders?.length || 0;
    const avgOrderValue = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;
    
    const weeklyRevenue = weeklyOrders?.reduce((sum, order) => sum + (order?.pricing?.total || 0), 0) || 0;
    const weeklyOrderCount = weeklyOrders?.length || 0;

    let averageRating = 0;
    try {
      averageRating = averageRatingResult?.length > 0 
        ? Number.parseFloat(averageRatingResult[0].avgRating?.toFixed(1) || 0) 
        : 0;
    } catch (ratingError) {
      console.error("Rating calculation failed:", ratingError);
      averageRating = 0;
    }

    let growthPercentage = 0;
    try {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const lastWeekOrders = await Order.find({
        vendorId: vendor._id,
        createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
        status: "delivered"
      }).lean();

      const lastWeekRevenue = lastWeekOrders?.reduce((sum, order) => sum + (order?.pricing?.total || 0), 0) || 0;

      if (lastWeekRevenue > 0) {
        growthPercentage = ((weeklyRevenue - lastWeekRevenue) / lastWeekRevenue) * 100;
      } else if (weeklyRevenue > 0) {
        growthPercentage = 100;
      }
    } catch (growthError) {
      console.error("Growth calculation failed:", growthError);
      growthPercentage = 0;
    }

    const response = {
      success: true,
      vendor: {
        id: vendor._id,
        shopName: vendor.shopName || "",
        rating: vendor.rating || {},
        stats: vendor.stats || {},
        menu: vendor.menu || [] // ✅ include full menu here
      },
      todayStats: {
        orders: todayOrderCount,
        revenue: todayRevenue,
        avgOrderValue,
        cancelledOrders: todayOrders?.filter(o => o?.status === "cancelled").length || 0
      },
      weeklyStats: {
        revenue: weeklyRevenue,
        orders: weeklyOrderCount,
        growth: parseFloat(growthPercentage.toFixed(2))
      },
      customerFeedback: {
        averageRating,
        totalReviews: totalReviews || 0,
        recentReviews: (vendorReviews || []).map(review => ({
          customer: review?.customerId?.name || "Anonymous",
          rating: review?.overall || 0,
          comment: review?.review || ""
        }))
      },
      pendingOrders: (pendingOrders || []).map(order => ({
        id: order?._id || "",
        customerName: order?.customerId?.name || "N/A",
        customerPhone: order?.customerId?.phone || "N/A",
        items: (order?.items || []).map(item => ({
          name: item?.name || "",
          quantity: item?.quantity || 0,
          price: item?.price || 0
        })),
        total: order?.pricing?.total || 0
      }))
    };

    res.json(response);

  } catch (error) {
    console.error("Vendor dashboard error:", error);
    next(new ErrorHandler("Failed to fetch vendor dashboard data", 500));
  }
});

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
      // 1. Verify user is a vendor
      if (!req.user?.isVendor) {
        return next(new ErrorHandler("Access denied. Only vendors can access this dashboard.", 403));
      }
      // 2. PROPERLY GET THE VENDOR DOCUMENT (FIX)
      const vendor = await Vendor.findOne({ userId: req.vendorDetails.userId });
      if (!vendor) {
        return next(new ErrorHandler("Vendor profile not found", 404));
      }

      // 3. Handle file uploads
      if (req.files?.shopImage?.[0]) {
        vendor.images.shop = req.files.shopImage[0].path;
      }
      if (req.files?.licenseImage?.[0]) {
        vendor.businessDetails.licenseImage = req.files.licenseImage[0].path;
      }

      // 4. Process update data
      const updateData = req.body;

      // Handle special fields
      if (updateData.cuisine) {
        vendor.cuisine = typeof updateData.cuisine === 'string' 
          ? updateData.cuisine.split(',').map(c => c.trim())
          : updateData.cuisine;
      }

      if (updateData.operationalHours) {
        try {
          vendor.operationalHours = typeof updateData.operationalHours === 'string'
            ? JSON.parse(updateData.operationalHours)
            : updateData.operationalHours;
        } catch (e) {
          console.warn("Invalid operationalHours format:", e);
          return next(new ErrorHandler("Invalid operational hours format", 400));
        }
      }

      // Handle other fields
      for (const [key, value] of Object.entries(updateData)) {
        if (value === undefined || value === null) continue;
        
        // Skip already processed fields
        if (['cuisine', 'operationalHours'].includes(key)) continue;
        
        // Handle nested fields (e.g., "address.city")
        if (key.includes('.')) {
          const keys = key.split('.');
          let target = vendor;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) target[keys[i]] = {};
            target = target[keys[i]];
          }
          target[keys[keys.length - 1]] = value;
        } 
        // Regular fields
        else {
          vendor[key] = value;
        }
      }

      // 5. Validate and save
      const updatedVendor = await vendor.save();

      // 6. Send response
      res.json({
        success: true,
        message: "Profile updated successfully",
        vendor: updatedVendor,
      });

    } catch (error) {
      console.error("Update vendor profile error:", error);
      
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map(val => val.message);
        return next(new ErrorHandler(`Validation failed: ${messages.join(", ")}`, 400));
      }
      
      next(new ErrorHandler(error.message || "Failed to update profile", 500));
    }
  }
);

// ADD MENU ITEM
router.post("/menu", auth, upload.single("itemImage"), async (req, res, next) => {
  try {
    // 1. Verify user is a vendor using the new isVendor flag
    if (!req.user?.isVendor) {
      return next(new ErrorHandler("Access denied. Only vendors can access this dashboard.", 403));
    }

    const vendor = await Vendor.findOne({ userId: req.vendorDetails.userId });;
    if (!vendor) {
      return next(new ErrorHandler("Vendor profile not available", 404));
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
    console.log("menu is add")
    await vendor.save();

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
    // 1. Verify user is a vendor using the new isVendor flag
    if (!req.user?.isVendor) {
      return next(new ErrorHandler("Access denied. Only vendors can access this dashboard.", 403));
    }

    const vendor = await Vendor.findOne({ userId: req.vendorDetails.userId });
    if (!vendor) {
      return next(new ErrorHandler("Vendor profile not available", 404));
    }

    const menuItem = vendor.menu.id(req.params.itemId);
    if (!menuItem) {
      return next(new ErrorHandler("Menu item not found.", 404));
    }

    // Update basic fields
    const fieldsToUpdate = ["name", "category", "description"];
    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        menuItem[field] = req.body[field];
      }
    });

    // Parse and update price
    if (req.body.price) {
      const parsedPrice = parseFloat(req.body.price);
      if (isNaN(parsedPrice)) {
        return next(new ErrorHandler("Menu item price must be a valid number.", 400));
      }
      menuItem.price = parsedPrice;
    }

    // Update boolean flags
    if (req.body.isVeg !== undefined) {
      menuItem.isVeg = req.body.isVeg === "true" || req.body.isVeg === true;
    }
    if (req.body.isAvailable !== undefined) {
      menuItem.isAvailable = req.body.isAvailable === "true" || req.body.isAvailable === true;
    }

    // Handle image
    if (req.file) {
      menuItem.image = req.file.path;
    }

    // Parse and assign customizations
    if (req.body.customizations) {
      try {
        const parsedCustomizations = JSON.parse(req.body.customizations);
        if (!Array.isArray(parsedCustomizations)) {
          return next(new ErrorHandler("Customizations must be an array.", 400));
        }
        menuItem.customizations = parsedCustomizations;
      } catch (err) {
        return next(new ErrorHandler("Invalid JSON format for customizations.", 400));
      }
    }

    await vendor.save();

    res.json({
      success: true,
      message: "Menu item updated successfully",
      menuItem,
    });
  } catch (error) {
    console.error("Update menu item error:", error);
    if (error.name === "CastError") {
      return next(new ErrorHandler("Invalid Menu Item ID format.", 400));
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return next(new ErrorHandler(`Validation failed: ${messages.join(", ")}`, 400));
    }
    next(new ErrorHandler("Failed to update menu item", 500));
  }
});


// DELETE MENU ITEM
router.delete("/menu/:itemId", auth, async (req, res, next) => {
 try {
  // 1. Ensure user is a vendor
  if (!req.user?.isVendor) {
    return next(new ErrorHandler("Access denied. Only vendors can access this dashboard.", 403));
  }

  // 2. Find the vendor profile
  const vendor = await Vendor.findOne({ userId: req.vendorDetails.userId });
  if (!vendor) {
    return next(new ErrorHandler("Vendor profile not available", 404));
  }

  // 3. Get itemId from params
  const itemId = req.params.itemId;

  // 4. Check if menu item exists using subdocument id()
  const menuItemExists = vendor.menu.id(itemId);
  if (!menuItemExists) {
    return res.status(404).json({ success: false, message: "Menu item not found" });
  }

  // 5. Remove the subdocument using .pull() and save vendor
  vendor.menu.pull({ _id: itemId });
  await vendor.save();

  return res.status(200).json({ success: true, message: "Menu item deleted successfully" });
}  catch (error) {
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

    const vendor = await Vendor.findOne({ userId: req.vendorDetails.userId })
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
