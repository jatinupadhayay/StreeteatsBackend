const express = require("express")
const cloudinary = require("cloudinary").v2
const upload = require("../middleware/upload")
const auth = require("../middleware/auth")

const router = express.Router()

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// UPLOAD SINGLE FILE
router.post("/single", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" })
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "street-eats",
      resource_type: "auto",
    })

    res.json({
      message: "File uploaded successfully",
      url: result.secure_url,
      publicId: result.public_id,
    })
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).json({ message: "File upload failed", error: error.message })
  }
})

// UPLOAD MULTIPLE FILES
router.post("/multiple", auth, upload.array("files", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" })
    }

    const uploadPromises = req.files.map((file) =>
      cloudinary.uploader.upload(file.path, {
        folder: "street-eats",
        resource_type: "auto",
      }),
    )

    const results = await Promise.all(uploadPromises)

    res.json({
      message: "Files uploaded successfully",
      files: results.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
      })),
    })
  } catch (error) {
    console.error("Multiple upload error:", error)
    res.status(500).json({ message: "File upload failed", error: error.message })
  }
})

// DELETE FILE
router.delete("/:publicId", auth, async (req, res) => {
  try {
    const { publicId } = req.params

    const result = await cloudinary.uploader.destroy(publicId)

    if (result.result === "ok") {
      res.json({ message: "File deleted successfully" })
    } else {
      res.status(400).json({ message: "File deletion failed" })
    }
  } catch (error) {
    console.error("Delete file error:", error)
    res.status(500).json({ message: "File deletion failed", error: error.message })
  }
})

module.exports = router
