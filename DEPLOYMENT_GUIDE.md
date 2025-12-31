# Deployment Guide - Digital Human App

Complete step-by-step guide for deploying to Cloudflare Pages (frontend) + Render (backend).

---

## Summary of Code Changes Made

### Files Modified

| File | Change |
|------|--------|
| `apps/frontend/src/config/api.js` | Added support for `VITE_BACKEND_URL` environment variable |
| `apps/backend/server.js` | Added import for credentials helper |

### Files Created

| File | Purpose |
|------|---------|
| `apps/backend/modules/credentials.mjs` | Handles Google credentials from environment variable |
| `apps/backend/render.yaml` | Render deployment configuration |
| `apps/frontend/wrangler.toml` | Cloudflare Pages configuration |

---

## Required External Inputs

> [!IMPORTANT]
> You need to gather these before deploying:

### 1. GitHub Repository
- Your code must be in a GitHub repository
- Both Cloudflare Pages and Render will connect to this repo

### 2. Gemini API Key
- **Where to get**: [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Cost**: Free tier available
- **Environment variable**: `GEMINI_API_KEY`

### 3. Google Cloud Service Account JSON
- **Where to get**: [Google Cloud Console](https://console.cloud.google.com/)
- **Steps**:
  1. Create a project (or use existing)
  2. Enable "Speech-to-Text API" and "Text-to-Speech API"
  3. Go to "IAM & Admin" → "Service Accounts"
  4. Create a service account
  5. Download the JSON key file
- **Cost**: Free tier (60 min STT/month, 1M chars TTS/month)
- **Environment variable**: `GOOGLE_CREDENTIALS_JSON` (paste entire JSON content)

---

## Step 1: Push Code to GitHub

If your code is not already in a GitHub repository:

```bash
# Navigate to project root
cd "c:\Users\pmkma\New folder\adam-project"

# Initialize git if needed
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for deployment"

# Create a new repo on GitHub.com, then:
git remote add origin https://github.com/YOUR_USERNAME/adam-project.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend to Render

### 2.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub (recommended for easier repo connection)

### 2.2 Create New Web Service
1. Click **"New"** → **"Web Service"**
2. Connect your GitHub account if prompted
3. Select your `adam-project` repository

### 2.3 Configure Service Settings

| Setting | Value |
|---------|-------|
| **Name** | `adam-backend` (or your choice) |
| **Root Directory** | `apps/backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | `Free` |

### 2.4 Add Environment Variables

Click **"Add Environment Variable"** for each:

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | Your Gemini API key from Google AI Studio |
| `GOOGLE_CREDENTIALS_JSON` | Entire contents of your service account JSON file (copy-paste all) |
| `NODE_ENV` | `production` |

> [!WARNING]
> For GOOGLE_CREDENTIALS_JSON, you must paste the ENTIRE JSON file content, including the curly braces. It will look like:
> ```json
> {"type":"service_account","project_id":"...","private_key":"..."}
> ```

### 2.5 Deploy
1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Note your URL: `https://your-backend-name.onrender.com`
4. Test by visiting: `https://your-backend-name.onrender.com/` - should show "Avatar Backend is running"

---

## Step 3: Deploy Frontend to Cloudflare Pages

### 3.1 Create Cloudflare Account
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Sign up (free, no credit card needed)

### 3.2 Create New Project
1. Click **"Create a project"**
2. Click **"Connect to Git"**
3. Authorize Cloudflare to access GitHub
4. Select your `adam-project` repository

### 3.3 Configure Build Settings

| Setting | Value |
|---------|-------|
| **Project name** | `adam-avatar` (will become `adam-avatar.pages.dev`) |
| **Production branch** | `main` |
| **Root directory (Advanced)** | `apps/frontend` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |

### 3.4 Add Environment Variable

Click **"Add variable"**:

| Variable name | Value |
|---------------|-------|
| `VITE_BACKEND_URL` | `https://your-backend-name.onrender.com` (from Step 2.5) |

> [!IMPORTANT]
> Make sure to use your actual Render backend URL!

### 3.5 Deploy
1. Click **"Save and Deploy"**
2. Wait for build (2-5 minutes)
3. Your app is live at `https://your-project-name.pages.dev`

---

## Step 4: Verify Deployment

### Test Checklist
- [ ] Visit your Cloudflare URL on desktop
- [ ] Verify avatar loads
- [ ] Type a message and verify response
- [ ] Visit on mobile phone
- [ ] Test voice input (requires HTTPS, which you now have!)

### Common Issues

| Problem | Solution |
|---------|----------|
| Backend returns 503 | Wait 30-60 sec for cold start |
| "Failed to fetch" on frontend | Check VITE_BACKEND_URL is correct |
| Avatar doesn't speak | Check GOOGLE_CREDENTIALS_JSON in Render |
| STT doesn't work | Verify Speech-to-Text API is enabled in Google Cloud |

---

## Step 5: Prevent Cold Starts (Optional)

To prevent the 30-60 second delay after inactivity:

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Create free account
3. Add new monitor:
   - **Type**: HTTP(s)
   - **URL**: `https://your-backend-name.onrender.com`
   - **Interval**: 5 minutes

This pings your backend every 5 minutes, keeping it awake.

---

## Environment Variables Summary

### Render (Backend)
| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | API key from Google AI Studio |
| `GOOGLE_CREDENTIALS_JSON` | ✅ Yes | Service account JSON content |
| `NODE_ENV` | Optional | Set to `production` |

### Cloudflare Pages (Frontend)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_BACKEND_URL` | ✅ Yes | Your Render backend URL |

---

## Questions?

If you encounter any issues during deployment, let me know:
1. Which step you're on
2. What error message you see
3. Screenshots if available

I'll help you troubleshoot!
