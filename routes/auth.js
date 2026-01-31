const express = require("express")
const ErrorHandler = require("../utils/errorHandler");
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const Vendor = require("../models/Vendor")
const DeliveryPartner = require("../models/DeliveryPartner")
const { sendWelcomeEmail, sendVendorApprovalEmail, sendPasswordResetOTP } = require("../utils/emailService")
const { sendOTP } = require("../utils/smsService")
const upload = require("../middleware/upload")

const router = express.Router()
console.log("✅ /api/auth router loaded")
// ------------------------- CUSTOMER REGISTRATION -------------------------
router.post("/register/customer", async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: "All fields are required" })
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const customer = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role: "customer",
      isVerified: true,
    })

    await customer.save()

    // Non-blocking email sending
    sendWelcomeEmail(email, name, "customer").catch(err => console.error("Background email failed:", err.message));

    const token = jwt.sign({ userId: customer._id, role: "user" }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.status(201).json({
      message: "Customer registered successfully",
      token,
      user: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: "user",
      },
    })
  } catch (error) {
    console.error("Customer registration error:", error)
    res.status(500).json({ message: "Registration failed", error: error.message })
  }
})

// ------------------------- VENDOR REGISTRATION -------------------------
router.post(
  "/register/vendor",
  upload.fields([
    { name: "shopImage", maxCount: 1 },
    { name: "licenseDocument", maxCount: 1 },
    { name: "ownerPhoto", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        ownerName,
        email,
        password,
        phone,
        shopName,
        shopDescription,
        cuisine,
        street,
        city,
        state,
        pincode,
        licenseNumber,
        gstNumber,
        bankAccount,
        ifscCode,
        openingTime,
        closingTime,
        deliveryRadius,
      } = req.body

      console.log("📥 Incoming Vendor Registration Payload:", JSON.stringify(req.body, null, 2));
      console.log("📁 Uploaded Files:", req.files ? Object.keys(req.files).map(k => ({ field: k, name: req.files[k][0]?.originalname })) : "None");

      // Validation
      if (!ownerName || !email || !password || !phone || !shopName) {
        return res.status(400).json({ message: "Required fields are missing" })
      }

      // Check if vendor already exists by email or phone
      const userExists = await User.findOne({ $or: [{ email }, { phone }] })
      if (userExists) {
        const field = userExists.email === email ? "email" : "phone"
        return res.status(400).json({ message: `Vendor already exists with this ${field}` })
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)

      // Create user account for vendor
      const vendorUser = new User({
        name: ownerName,
        email,
        password: hashedPassword,
        phone,
        role: "vendor",
        isVerified: false,
      })
      console.log(vendorUser);
      console.log("Saved to collection:", vendorUser.collection.name);

      const savedUser = await vendorUser.save()

      if (!savedUser || !savedUser._id) {
        return res.status(500).json({ message: "User creation failed. Registration aborted." })
      }

      // Handle file uploads
      const shopImage = req.files?.shopImage?.[0]?.path || null
      const licenseDocument = req.files?.licenseDocument?.[0]?.path || null
      const ownerPhoto = req.files?.ownerPhoto?.[0]?.path || null

      // Create vendor profile
      const vendor = new Vendor({
        userId: vendorUser._id,
        ownerName,
        shopName,
        shopDescription,
        cuisine: Array.isArray(cuisine) ? cuisine : (cuisine ? cuisine.split(",").map((c) => c.trim()) : []),
        address: {
          street: street || "",
          city: city || "",
          state: state || "",
          pincode: pincode || "",
          coordinates: [0, 0],
        },
        contact: {
          phone,
          email,
        },
        businessDetails: {
          licenseNumber: licenseNumber || "",
          gstNumber: gstNumber || "",
          bankAccount: bankAccount || "",
          ifscCode: ifscCode || "",
        },
        operationalHours: {
          monday: { open: openingTime || "09:00", close: closingTime || "22:00" },
          tuesday: { open: openingTime || "09:00", close: closingTime || "22:00" },
          wednesday: { open: openingTime || "09:00", close: closingTime || "22:00" },
          thursday: { open: openingTime || "09:00", close: closingTime || "22:00" },
          friday: { open: openingTime || "09:00", close: closingTime || "22:00" },
          saturday: { open: openingTime || "09:00", close: closingTime || "22:00" },
          sunday: { open: openingTime || "09:00", close: closingTime || "22:00" },
        },
        deliveryRadius: Number.parseInt(deliveryRadius) || 5,
        images: {
          shop: shopImage ? [shopImage] : [],
          license: licenseDocument,
          owner: ownerPhoto,
        },
        status: "pending",
        isActive: false,
      })

      await vendor.save()

      // Non-blocking email sending
      sendVendorApprovalEmail(vendor).catch(err => console.error("Vendor approval email failed:", err.message));
      sendWelcomeEmail(email, ownerName, "vendor").catch(err => console.error("Welcome email failed:", err.message));

      const token = jwt.sign({ userId: vendor.userId, role: "vendor" }, process.env.JWT_SECRET, { expiresIn: "7d" })

      res.status(201).json({
        message: "Vendor registration submitted successfully. Awaiting admin approval.",
        token,
        user: {
          id: vendor.userId,
          _id: vendor.userId,
          name: ownerName,
          email: email,
          role: "vendor",
          status: "pending"
        }
      })
    } catch (error) {
      console.error("Vendor registration error:", error)

      // Attempt to cleanup user if vendor creation failed
      if (typeof vendorUser !== 'undefined' && vendorUser._id) {
        try {
          await User.findByIdAndDelete(vendorUser._id);
          console.log("Cleanup: Deleted orphaned user after vendor creation failure");
        } catch (cleanupErr) {
          console.error("Cleanup failed:", cleanupErr.message);
        }
      }

      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((val) => val.message);
        return res.status(400).json({
          message: "Validation failed",
          details: messages,
          error: error.message
        });
      }

      res.status(500).json({
        message: "Vendor registration failed",
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  },
)
// Delivery partner api end point
router.post(
  "/register/delivery",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "licenseImage", maxCount: 1 },
    { name: "vehicleImage", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const {
        name,
        email,
        password,
        phone,
        vehicleType,
        vehicleNumber, // ADDED
        licenseNumber,
        "address.street": street,
        "address.city": city,
        "address.state": state,
        "address.pincode": pincode,
      } = req.body;

      const address = { street, city, state, pincode };

      // Add vehicleNumber to required fields
      if (
        !name ||
        !email ||
        !password ||
        !phone ||
        !vehicleType ||
        !vehicleNumber || // ADDED
        !licenseNumber ||
        !address.street ||
        !address.city ||
        !address.state ||
        !address.pincode
      ) {
        return next(new ErrorHandler("Please fill all required delivery partner fields", 400));
      }

      let user = await User.findOne({ email });
      if (user) {
        return next(new ErrorHandler("User already exists with this email", 400));
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const profileImage = req.files?.profileImage ? req.files.profileImage[0].path : "";
      const licenseImage = req.files?.licenseImage ? req.files.licenseImage[0].path : "";
      const vehicleImage = req.files?.vehicleImage ? req.files.vehicleImage[0].path : "";

      // CREATE USER FIRST
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        phone,
        role: "delivery",
      });

      // CREATE DELIVERY PARTNER WITH PROPER STRUCTURE
      const newDeliveryPartner = await DeliveryPartner.create({
        userId: user._id, // REQUIRED FIELD
        personalDetails: { // REQUIRED STRUCTURE
          name,
          email,
          phone
        },
        vehicleDetails: { // REQUIRED STRUCTURE
          type: vehicleType,
          number: vehicleNumber
        },
        documents: {
          licenseNumber,
        },
        address,
        images: {
          profile: profileImage,
          license: licenseImage,
          vehicle: vehicleImage,
        },
        status: "pending",
      });

      // UPDATE USER WITH DELIVERY PARTNER ID
      user.deliveryPartnerId = newDeliveryPartner._id;
      await user.save();

      // Non-blocking email sending
      sendWelcomeEmail({
        email: newDeliveryPartner.personalDetails.email,
        subject: "Delivery Partner Registration Received - Street Eats",
        message: `Dear ${name},\n\nThank you for registering as a delivery partner...`,
      }).catch(err => console.error("Delivery welcome email failed:", err.message));

      const token = jwt.sign({ userId: user._id, role: "delivery" }, process.env.JWT_SECRET, { expiresIn: "7d" })

      res.status(201).json({
        success: true,
        message: "Delivery partner skipping verification for demo",
        token,
        user: {
          id: user._id,
          _id: user._id,
          name: name,
          email: email,
          role: "delivery",
          status: "pending"
        }
      });
    } catch (error) {
      console.error("Delivery partner registration error:", error);
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((val) => val.message);
        return next(new ErrorHandler(`Delivery partner validation failed: ${messages.join(", ")}`, 400));
      }
      next(new ErrorHandler("Delivery partner registration failed", 500));
    }
  }
);
// ------------------------- LOGIN -------------------------
router.post("/login", async (req, res) => {
  console.log("✅ /api/auth router loaded")
  try {
    const { email, password, role } = req.body

    if (!email || !password || !role) {
      return res.status(400).json({ message: "Email, password, and role are required" })
    }

    const user = await User.findOne({ email, role })
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    // Check account status
    if (user.accountStatus !== "active" || !user.isActive) {
      return res.status(403).json({
        message: `Your account is ${user.accountStatus || 'inactive'}. Please contact support.`,
        status: user.accountStatus
      })
    }

    if (role === "vendor") {
      const vendor = await Vendor.findOne({ userId: user._id })
      if (!vendor) {
        return res.status(404).json({ message: "Vendor profile not found" })
      }
      // Allow pending/approved vendors to login. 
      // Rejected/suspended vendors should still be blocked if needed, checking isActive might be better for that.
      if (vendor.status === "rejected" || vendor.status === "suspended") {
        return res.status(403).json({
          message: `Your vendor account has been ${vendor.status}`,
          status: vendor.status,
        })
      }

      // Return vendor details for frontend
      const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" })

      user.lastLogin = new Date()
      await user.save()

      return res.json({
        message: "Login successful",
        token,
        user: {
          id: user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        vendor: {
          _id: vendor._id,
          status: vendor.status,
          shopName: vendor.shopName,
          isActive: vendor.isActive
        }
      })
    }

    if (role === "delivery") {
      const deliveryPartner = await DeliveryPartner.findOne({ userId: user._id })
      if (!deliveryPartner || deliveryPartner.status !== "approved") {
        return res.status(403).json({
          message: "Your delivery partner account is still under verification",
          status: deliveryPartner?.status || "not found",
        })
      }
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" })

    user.lastLogin = new Date()
    await user.save()

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Login failed", error: error.message })
  }
})

// ------------------------- FORGOT PASSWORD -------------------------

// Step 1: Request OTP
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, phone, role } = req.body

    if (!email || !phone || !role) {
      return res.status(400).json({ message: "Email, phone number, and role are required" })
    }

    const user = await User.findOne({ email, phone, role })
    if (!user) {
      return res.status(404).json({ message: "No account found with this email, phone, and role combination." })
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    user.forgotPasswordOtp = otp
    user.forgotPasswordOtpExpires = otpExpires
    await user.save()

    // Send OTP via Email Service
    const emailResult = await sendPasswordResetOTP(user.email, otp);

    if (emailResult.success || emailResult.mode === "mock") {
      res.json({
        success: true,
        message: `Verification code sent to your registered email address: ${email}`,
        mode: emailResult.mode // "real" or "mock"
      })
    } else {
      res.status(500).json({
        message: "Failed to send verification code to your email. Please try again later.",
        error: emailResult.error
      })
    }
  } catch (error) {
    console.error("Forgot password error:", error)
    res.status(500).json({ message: "Failed to process request", error: error.message })
  }
})

// Step 2: Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, role, otp } = req.body

    if (!email || !role || !otp) {
      return res.status(400).json({ message: "Email, role, and OTP are required" })
    }

    const user = await User.findOne({
      email,
      role,
      forgotPasswordOtp: otp,
      forgotPasswordOtpExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" })
    }

    res.json({
      success: true,
      message: "OTP verified successfully",
    })
  } catch (error) {
    console.error("OTP verification error:", error)
    res.status(500).json({ message: "Verification failed", error: error.message })
  }
})

// Step 3: Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, role, otp, newPassword } = req.body

    if (!email || !role || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" })
    }

    const user = await User.findOne({
      email,
      role,
      forgotPasswordOtp: otp,
      forgotPasswordOtpExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    user.password = hashedPassword

    // Clear OTP fields
    user.forgotPasswordOtp = undefined
    user.forgotPasswordOtpExpires = undefined
    await user.save()

    res.json({
      success: true,
      message: "Password reset successful. You can now login with your new password.",
    })
  } catch (error) {
    console.error("Password reset error:", error)
    res.status(500).json({ message: "Password reset failed", error: error.message })
  }
})


// Admin Approval Route (Simplified for Demo)
router.get("/approve-vendor/:id", async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).send("Vendor not found");

    vendor.status = "approved";
    vendor.isActive = true;
    await vendor.save();

    const user = await User.findById(vendor.userId);
    if (user) {
      user.accountStatus = "active";
      await user.save();
    }

    res.send(`
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #4CAF50;">✅ Vendor Approved!</h1>
        <p>Vendor <strong>${vendor.shopName}</strong> has been successfully approved.</p>
        <p>They can now access their dashboard and receive orders.</p>
      </div>
    `);
  } catch (error) {
    res.status(500).send("Approval failed: " + error.message);
  }
});

module.exports = router
