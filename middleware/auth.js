const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) throw new Error("No token provided");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check both User and Vendor collections
    const [user, vendor] = await Promise.all([
      User.findById(decoded.userId).lean(),
      Vendor.findOne({ userId: decoded.userId }).lean()
    ]);

    if (!user && !vendor) {
      throw new Error("No user or vendor found");
    }

    // Attach to request object
    req.user = {
      ...decoded,
      isVendor: !!vendor,  // Explicit vendor flag
      role: vendor ? "vendor" : user?.role
    };

    if (user) req.userDetails = user;
    if (vendor) req.vendorDetails = vendor;

    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    res.status(401).json({ 
      message: "Authentication failed",
      error: error.message 
    });
  }
};

module.exports = auth;