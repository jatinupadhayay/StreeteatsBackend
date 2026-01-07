const express = require("express")
const router = express.Router()
const authMiddleware = require("../middleware/auth")
const User = require("../models/User")

// PUT /api/customer/profile
// Update customer profile
router.put("/profile", authMiddleware, async (req, res) => {
    try {
        const { name, phone, email } = req.body
        const userId = req.user.userId

        // Find user
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        // Update fields
        if (name) user.name = name
        if (phone) user.phone = phone
        // Email update might require verification in a real app, but allowing for now 
        // or maybe checking if email is taken. 
        // For simplicity, we assume unique email check is done by mongo unique index or ignored here unless changed.
        if (email && email !== user.email) {
            const existing = await User.findOne({ email })
            if (existing) {
                return res.status(400).json({ message: "Email already in use" })
            }
            user.email = email
        }

        await user.save()

        // Return updated user (excluding password)
        const updatedUser = user.toObject()
        delete updatedUser.password

        res.json({
            message: "Profile updated successfully",
            user: updatedUser,
        })
    } catch (error) {
        console.error("Profile update error:", error)
        res.status(500).json({ message: "Server error updating profile" })
    }
})

// GET /api/customer/profile
// Get current profile (if needed explicitly, otherwise auth /me covers it)
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

module.exports = router
