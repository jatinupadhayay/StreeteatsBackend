const express = require("express")
const router = express.Router()
const auth = require("../middleware/auth")
const Vendor = require("../models/Vendor")

// GET VENDOR REVIEWS
router.get("/vendor/:vendorId", async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query
        const reviews = await Review.find({
            vendorId: req.params.vendorId,
            type: "vendor",
            status: "approved"
        })
            .populate("customerId", "name avatar")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)

        res.json({
            success: true,
            reviews
        })
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch reviews", error: error.message })
    }
})

// GET DISH REVIEWS
router.get("/dish/:menuItemId", async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query
        const reviews = await Review.find({
            menuItemId: req.params.menuItemId,
            type: "dish",
            status: "approved"
        })
            .populate("customerId", "name avatar")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)

        res.json({
            success: true,
            reviews
        })
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch reviews", error: error.message })
    }
})

// ADD REVIEW (Direct)
router.post("/", auth, async (req, res) => {
    try {
        const { vendorId, menuItemId, rating, comment, type = "vendor" } = req.body

        const newReview = new Review({
            customerId: req.user.userId,
            vendorId,
            menuItemId,
            type,
            ratings: {
                food: { overall: rating },
            },
            comments: {
                overall: comment
            },
            status: "approved"
        })
        await newReview.save()

        // Update vendor rating if it's a vendor review
        if (type === "vendor") {
            const vendor = await Vendor.findById(vendorId)
            if (vendor) {
                const newRatingCount = vendor.rating.count + 1
                const newAverage = (vendor.rating.average * vendor.rating.count + rating) / newRatingCount
                vendor.rating.average = newAverage
                vendor.rating.count = newRatingCount
                await vendor.save()
            }
        }

        res.json({ success: true, review: newReview })
    } catch (error) {
        res.status(500).json({ message: "Failed to add review", error: error.message })
    }
})

module.exports = router
