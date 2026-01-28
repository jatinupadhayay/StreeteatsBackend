const nodemailer = require("nodemailer")

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    // Changed from createTransporter to createTransport
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// Test email connection
const testEmailConnection = async () => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Email service not configured")
      return
    }

    const transporter = createTransporter()
    await transporter.verify()
    console.log("✅ Email service connected")
  } catch (error) {
    console.log("❌ Email service connection failed:", error.message)
  }
}

// Send welcome email
const sendWelcomeEmail = async (email, name, role) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("Email service not configured, skipping email send")
      return
    }

    const transporter = createTransporter()

    const roleMessages = {
      customer: "Start exploring delicious street food near you!",
      vendor: "Your account is pending approval. We will notify you once approved.",
      delivery: "Your account is under verification. We will notify you once verified.",
    }

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `Welcome to Street Eats - ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff6b35;">Welcome to Street Eats, ${name}!</h2>
          <p>Thank you for joining our platform as a ${role}.</p>
          <p>${roleMessages[role]}</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>What's Next?</h3>
            ${role === "customer" ? "<p>• Browse nearby vendors<br>• Place your first order<br>• Enjoy delicious street food!</p>" : ""}
            ${role === "vendor" ? "<p>• Complete your profile<br>• Upload menu items<br>• Start receiving orders once approved</p>" : ""}
            ${role === "delivery" ? "<p>• Complete document verification<br>• Set your availability<br>• Start earning with deliveries</p>" : ""}
          </div>
          <p>Best regards,<br><strong>Street Eats Team</strong></p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Welcome email sent to ${email}`)
  } catch (error) {
    console.error("Email sending error:", error.message)
  }
}

// Send order confirmation email
const sendOrderConfirmationEmail = async (email, order) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return
    }

    const transporter = createTransporter()

    const itemsList = order.items
      .map((item) => `<li>${item.name} x ${item.quantity} - ₹${item.price * item.quantity}</li>`)
      .join("")

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `Order Confirmation - ${order._id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff6b35;">Order Confirmed!</h2>
          <p>Your order has been placed successfully.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Total Amount:</strong> ₹${order.pricing.total}</p>
            <p><strong>Estimated Delivery:</strong> ${order.estimatedDeliveryTime}</p>
            
            <h4>Items Ordered:</h4>
            <ul>${itemsList}</ul>
          </div>
          
          <p>We'll notify you when your order status changes.</p>
          <p>Best regards,<br><strong>Street Eats Team</strong></p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Order confirmation email sent for order ${order._id}`)
  } catch (error) {
    console.error("Order confirmation email error:", error.message)
  }
}

// Send order status email
const sendOrderStatusEmail = async (email, order) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return
    }

    const transporter = createTransporter()

    const statusMessages = {
      accepted: "Your order has been accepted by the vendor and is being prepared.",
      preparing: "Your delicious food is being prepared with care.",
      ready: "Your order is ready and waiting for pickup by our delivery partner.",
      picked_up: "Your order is on its way! Our delivery partner has picked it up.",
      delivered: "Your order has been delivered successfully. Enjoy your meal!",
      cancelled: "Your order has been cancelled. If you were charged, a refund will be processed.",
    }

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `Order Update - ${order.status.toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff6b35;">Order Status Update</h2>
          <p><strong>Order ID:</strong> ${order._id}</p>
          <p><strong>Status:</strong> ${order.status.toUpperCase()}</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>${statusMessages[order.status]}</p>
          </div>
          
          <p>Best regards,<br><strong>Street Eats Team</strong></p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Status email sent for order ${order._id}`)
  } catch (error) {
    console.error("Status email error:", error.message)
  }
}

// Send vendor approval email
const sendVendorApprovalEmail = async (vendor) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return
    }

    const transporter = createTransporter()

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: "jatinup1204@gmail.com", // Admin email
      subject: "New Vendor Registration - Approval Required",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff6b35;">New Vendor Registration</h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Shop Name:</strong> ${vendor.shopName}</p>
            <p><strong>Owner:</strong> ${vendor.ownerName}</p>
            <p><strong>Email:</strong> ${vendor.contact.email}</p>
            <p><strong>Phone:</strong> ${vendor.contact.phone}</p>
            <p><strong>Cuisine:</strong> ${vendor.cuisine.join(", ")}</p>
            <p><strong>Address:</strong> ${vendor.address.street}, ${vendor.address.city}</p>
          </div>
          
          <p>Please review and approve this vendor registration in the admin panel.</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log("Vendor approval email sent to admin")
  } catch (error) {
    console.error("Vendor approval email error:", error.message)
  }
}

// Send password reset OTP email
const sendPasswordResetOTP = async (email, otp) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("Email service not configured, skipping OTP email send")
      return { success: false, mode: "mock", otp }
    }

    const transporter = createTransporter()

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "Password Reset Verification Code - Street Eats",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #ff6b35; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Street Eats</h1>
          </div>
          <div style="padding: 30px; color: #333 text-align: center;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>We received a request to reset your password. Use the verification code below to proceed:</p>
            <div style="background-color: #fff0eb; padding: 20px; border-radius: 8px; margin: 25px 0; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ff6b35;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p>© 2026 Street Eats. All rights reserved.</p>
          </div>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Password reset OTP sent to ${email}`)
    return { success: true, mode: "real" }
  } catch (error) {
    console.error("OTP email sending error:", error.message)
    return { success: false, error: error.message }
  }
}

module.exports = {
  testEmailConnection,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendVendorApprovalEmail,
  sendPasswordResetOTP,
}
