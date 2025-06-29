# 🚀 Street Eats Backend Deployment Guide

## Deploy to Vercel (Recommended)

### Step 1: Prepare Your Code
1. Download the backend code
2. Make sure all files are in the `backend/` folder
3. Ensure `vercel.json` is in the root of backend folder

### Step 2: Deploy to Vercel
\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (run from backend folder)
cd backend
vercel

# Follow the prompts:
# - Set up and deploy? Y
# - Which scope? (your account)
# - Link to existing project? N
# - Project name: street-eats-backend
# - Directory: ./
# - Override settings? N
\`\`\`

### Step 3: Set Environment Variables
Go to your Vercel dashboard → Project → Settings → Environment Variables

Add these variables:
\`\`\`
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=https://your-frontend-domain.vercel.app
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
\`\`\`

### Step 4: Get Your API URL
After deployment, you'll get a URL like:
`https://street-eats-backend.vercel.app`

### Step 5: Update Frontend
Update your frontend's API base URL to point to your deployed backend:
\`\`\`js
// In your frontend lib/api.ts
const API_BASE_URL = 'https://street-eats-backend.vercel.app/api'
\`\`\`

## Alternative: Deploy to Railway

### Step 1: Install Railway CLI
\`\`\`bash
npm install -g @railway/cli
\`\`\`

### Step 2: Deploy
\`\`\`bash
railway login
railway init
railway up
\`\`\`

## Alternative: Deploy to Render

1. Go to render.com
2. Connect your GitHub repo
3. Choose "Web Service"
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables

## Database Setup (MongoDB Atlas)

1. Go to mongodb.com/atlas
2. Create free cluster
3. Create database user
4. Whitelist IP addresses (0.0.0.0/0 for all)
5. Get connection string
6. Add to MONGODB_URI environment variable

## Testing Your Deployment

Test your API endpoints:
\`\`\`bash
# Health check
curl https://your-backend-url.vercel.app/api/health

# Test auth
curl -X POST https://your-backend-url.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"123456","role":"customer"}'
\`\`\`

## 🎉 Your backend is now live and accessible to all users!
\`\`\`

```plaintext file="backend/.env.example"
# Copy this file to .env and fill in your values

# Server Configuration
PORT=5000
NODE_ENV=development

# Database (Get from MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/streeteats

# JWT Secret (Generate a secure random string)
JWT_SECRET=your_super_secure_jwt_secret_here

# Frontend URL (Update after deploying frontend)
FRONTEND_URL=https://your-frontend-domain.vercel.app

# Razorpay (Get from razorpay.com)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Cloudinary (Get from cloudinary.com)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Service (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
