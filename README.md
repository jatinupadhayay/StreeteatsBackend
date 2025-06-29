# Street Eats Backend API

Complete backend for Street Food delivery platform with real-time features.

## 🚀 Features

- **Complete Authentication System**
  - Customer, Vendor, Delivery Partner registration
  - JWT-based authentication
  - Role-based access control

- **Real-time Communication**
  - Socket.io for live updates
  - Order status notifications
  - Location tracking

- **Payment Integration**
  - Razorpay payment gateway
  - Secure payment verification
  - Refund processing

- **File Upload System**
  - Cloudinary integration
  - Image optimization
  - Document storage

- **Email Notifications**
  - Welcome emails
  - Order confirmations
  - Status updates

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- Razorpay account
- Cloudinary account
- Gmail account (for SMTP)

## 🛠️ Installation

1. **Extract the backend files**
2. **Install dependencies:**
   \`\`\`bash
   cd backend
   npm install
   \`\`\`

3. **Setup environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in your API keys and credentials

4. **Start MongoDB:**
   \`\`\`bash
   # For local MongoDB
   mongod
   
   # Or use MongoDB Atlas connection string
   \`\`\`

5. **Run the server:**
   \`\`\`bash
   npm start
   # or for development
   npm run dev
   \`\`\`

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register/customer` - Customer registration
- `POST /api/auth/register/vendor` - Vendor registration  
- `POST /api/auth/register/delivery` - Delivery partner registration
- `POST /api/auth/login` - Login for all roles
- `GET /api/auth/profile` - Get user profile

### Vendors
- `GET /api/vendors` - Get all active vendors
- `GET /api/vendors/:id` - Get single vendor
- `GET /api/vendors/dashboard/stats` - Vendor dashboard
- `POST /api/vendors/menu` - Add menu item
- `PUT /api/vendors/menu/:itemId` - Update menu item
- `DELETE /api/vendors/menu/:itemId` - Delete menu item

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders/customer` - Get customer orders
- `GET /api/orders/vendor` - Get vendor orders
- `GET /api/orders/delivery` - Get delivery orders
- `PUT /api/orders/:orderId/status` - Update order status
- `PUT /api/orders/:orderId/rate` - Rate completed order

### Delivery
- `GET /api/delivery/dashboard` - Delivery partner dashboard
- `PUT /api/delivery/toggle-online` - Toggle online status
- `PUT /api/delivery/location` - Update location
- `GET /api/delivery/history` - Delivery history
- `GET /api/delivery/earnings` - Earnings summary

### Payments
- `POST /api/payments/create-order` - Create payment order
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/refund` - Process refund
- `POST /api/payments/webhook` - Payment webhook

### File Upload
- `POST /api/upload/single` - Upload single file
- `POST /api/upload/multiple` - Upload multiple files
- `DELETE /api/upload/:publicId` - Delete file

## 🔄 Real-time Events

### Socket.io Events

**Customer Events:**
- `order-status-updated` - Order status changes
- `delivery-location-updated` - Live delivery tracking
- `refund-processed` - Refund notifications

**Vendor Events:**
- `new-order` - New order received
- `payment-confirmed` - Payment confirmation

**Delivery Events:**
- `new-delivery-request` - New delivery assignment
- `order-status-updated` - Order updates

## 🗄️ Database Models

- **User** - Base user model for all roles
- **Vendor** - Vendor profiles and menu management
- **Order** - Order management and tracking
- **DeliveryPartner** - Delivery partner profiles

## 🔐 Security Features

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation
- File upload restrictions

## 📧 Email Templates

- Welcome emails for all user types
- Order confirmation emails
- Status update notifications
- Vendor approval requests

## 🚀 Deployment

1. **Environment Variables:**
   - Set all required environment variables
   - Use production MongoDB URI
   - Configure production SMTP

2. **Build and Deploy:**
   \`\`\`bash
   npm start
   \`\`\`

3. **Health Check:**
   - Visit `/api/health` to verify deployment

## 🤝 API Integration

Your frontend should connect to:
\`\`\`
http://localhost:5000/api
\`\`\`

For production, update `FRONTEND_URL` in environment variables.

## 📞 Support

For issues or questions, check the logs or contact the development team.
