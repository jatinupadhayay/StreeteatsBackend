const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer to use Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "street-eats", // change folder name if needed
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = require("multer")({ storage });

module.exports = { cloudinary, upload };
