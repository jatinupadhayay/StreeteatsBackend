const express = require("express")
const router = express.Router()
const authMiddleware = require("../middleware/auth")
const User = require("../models/User")
const { sendVendorApprovalEmail } = require("../utils/emailService")

// GET /api/users/profile
router.get("/profile", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("-password")
        if (!user) return res.status(404).json({ message: "User not found" })
        res.json({ user })
    } catch (error) {
        console.error("Profile fetch error:", error)
        res.status(500).json({ message: "Server error" })
    }
})

// PUT /api/users/profile
router.put("/profile", authMiddleware, async (req, res) => {
    try {
        const { name, phone, email } = req.body
        const userId = req.user.userId

        const user = await User.findById(userId)
        if (!user) return res.status(404).json({ message: "User not found" })

        if (name) user.name = name
        if (phone) user.phone = phone
        if (email && email !== user.email) {
            const existing = await User.findOne({ email })
            if (existing) return res.status(400).json({ message: "Email already in use" })
            user.email = email
        }

        await user.save()
        const updatedUser = user.toObject()
        delete updatedUser.password

        res.json({ message: "Profile updated", user: updatedUser })
    } catch (error) {
        console.error("Profile update error:", error)
        res.status(500).json({ message: "Server error" })
    }
})

// GET /api/users/addresses
router.get("/addresses", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
        if (!user) return res.status(404).json({ message: "User not found" })
        res.json({ addresses: user.addresses || [] })
    } catch (error) {
        console.error("Get addresses error:", error)
        res.status(500).json({ message: "Server error" })
    }
})

// POST /api/users/addresses
router.post("/addresses", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
        if (!user) return res.status(404).json({ message: "User not found" })

        const newAddress = { ...req.body }
        if (!user.addresses) user.addresses = []

        // If set as default, unset others
        if (newAddress.isDefault) {
            user.addresses.forEach(a => a.isDefault = false)
        }

        user.addresses.push(newAddress)
        await user.save()

        res.json({ success: true, message: "Address added", addresses: user.addresses })
    } catch (error) {
        console.error("Add address error:", error)
        res.status(500).json({ message: "Server error" })
    }
})

// PUT /api/users/addresses/:id
router.put("/addresses/:id", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
        if (!user) return res.status(404).json({ message: "User not found" })

        const addressIndex = user.addresses.findIndex(a => a._id.toString() === req.params.id)
        if (addressIndex === -1) return res.status(404).json({ message: "Address not found" })

        const updates = req.body

        // If setting default, unset others
        if (updates.isDefault) {
            user.addresses.forEach(a => a.isDefault = false)
        }

        Object.assign(user.addresses[addressIndex], updates)
        await user.save()

        res.json({ success: true, message: "Address updated", addresses: user.addresses })
    } catch (error) {
        console.error("Update address error:", error)
        res.status(500).json({ message: "Server error" })
    }
})

// DELETE /api/users/addresses/:id
router.delete("/addresses/:id", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
        if (!user) return res.status(404).json({ message: "User not found" })

        user.addresses = user.addresses.filter(a => a._id.toString() !== req.params.id)
        await user.save()

        res.json({ success: true, message: "Address deleted", addresses: user.addresses })
    } catch (error) {
        console.error("Delete address error:", error)
        res.status(500).json({ message: "Server error" })
    }
})

// TEST ENDPOINT: Send Approval Email
router.post("/test-email-approval", async (req, res) => {
    try {
        // Mock vendor data
        const mockVendor = {
            _id: "test_vendor_id_123",
            shopName: "Test Street Eats Vendor",
            ownerName: "Test Owner",
            contact: {
                email: "jatinup1204@gmail.com", // Send to admin email for verification
                phone: "9876543210"
            },
            cuisine: ["Indian", "Street Food"],
            address: {
                street: "123 Test Lane",
                city: "Test City"
            }
        }

        console.log("Triggering test approval email...")
        await sendVendorApprovalEmail(mockVendor)
        res.json({ success: true, message: "Test approval email triggered. Check server logs." })
    } catch (error) {
        console.error("Test email error:", error)
        res.status(500).json({ success: false, message: error.message })
    }
})

module.exports = router
