# SMART FYP MANAGEMENT SYSTEM — PRODUCTION DEPLOYMENT GUIDE

**Institution**: University of Transport and Communications (UTC)  
**Target Repository**: `smart-fyp-management`

---

## 1. Deployment Topology Overview

| Component | Platform | Technology Stack | Entrypoint / Build Output |
| :--- | :--- | :--- | :--- |
| **Main Frontend** | **Vercel** | Vite 5 + React 18 + TypeScript | `frontend/dist` (Vite SPA) |
| **Main Backend** | **Render** | Django 4.2 + DRF + Django Channels | `backend.asgi:application` (Daphne) |
| **Database** | **Neon** | PostgreSQL 16 Managed Cloud DB | `DATABASE_URL` |
| **WebSocket Layer** | **Redis** | Render Redis / Upstash Redis | `REDIS_URL` |

---

## 2. Frontend Deployment (Vercel)

### Step 1: Connect Repository to Vercel
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New** ➔ **Project** ➔ Import `smart-fyp-management`.
3. In **Root Directory**, set: `frontend` (or leave default `.` as root `vercel.json` will build automatically).
4. **Framework Preset**: `Vite`.

### Step 2: Build & Output Settings
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Configure Environment Variables (Vercel)
In Vercel **Project Settings** ➔ **Environment Variables**, add:

| Variable Name | Environment | Example / Value | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Production, Preview, Dev | `https://smart-fyp-backend.onrender.com/app` | Render Backend HTTP API URL |
| `VITE_WS_URL` | Production, Preview, Dev | `wss://smart-fyp-backend.onrender.com/ws` | Render Backend WebSocket (WSS) URL |

---

## 3. Backend Deployment (Render)

### Option A: Web Service via Render Dashboard (Manual)
1. In [Render Dashboard](https://dashboard.render.com), click **New +** ➔ **Web Service**.
2. Connect repository `smart-fyp-management`.
3. Fill in configuration settings:
   - **Name**: `smart-fyp-main-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Region**: `Singapore`
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start Command**: `daphne -b 0.0.0.0 -p $PORT backend.asgi:application`

> [!IMPORTANT]
> Because `smart-fyp-management` utilizes Django Channels for real-time WebSockets (`/ws/chat/...`), the Start Command MUST use **Daphne** (`backend.asgi:application`), NOT Gunicorn WSGI.

### Option B: Render Blueprint (Infrastructure as Code)
Use the included `render.yaml` at the root of the repository to deploy automatically via **Blueprints**.

### Backend Environment Variables (Render)

| Variable Name | Required | Example / Recommended Value | Description |
| :--- | :--- | :--- | :--- |
| `SECRET_KEY` | Yes | `<64+ char random string>` | Django production secret key |
| `DEBUG` | Yes | `False` | Must be False in production |
| `ALLOWED_HOSTS` | Yes | `smart-fyp-backend.onrender.com,localhost,127.0.0.1` | Allowed domain hosts |
| `DATABASE_URL` | Yes | `postgres://user:pass@ep-cool-host.neon.tech/smart_fyp?sslmode=require` | Neon PostgreSQL Connection URI |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://smart-fyp-management.vercel.app` | Vercel frontend URL |
| `CSRF_TRUSTED_ORIGINS` | Yes | `https://smart-fyp-management.vercel.app` | Vercel frontend URL |
| `REDIS_URL` | Yes | `redis://default:pass@redis-host.render.com:6379` | Redis Channel Layer & Celery broker |
| `CELERY_BROKER_URL` | Optional | `redis://default:pass@redis-host:6379/0` | Celery broker URL (defaults to REDIS_URL) |
| `USE_S3` | Optional | `True` | Enable Cloud Object Storage (Cloudflare R2 / AWS S3) |
| `AWS_STORAGE_BUCKET_NAME`| Optional | `smart-fyp-media` | Cloud Storage bucket name |
| `AWS_ACCESS_KEY_ID` | Optional | `<access_key_id>` | Cloud Storage access key ID |
| `AWS_SECRET_ACCESS_KEY` | Optional | `<secret_access_key>` | Cloud Storage secret access key |
| `AWS_S3_ENDPOINT_URL` | Optional | `https://<account_id>.r2.cloudflarestorage.com` | Cloudflare R2 endpoint URL (omit for AWS S3) |
| `AWS_S3_REGION_NAME` | Optional | `auto` (R2) or `ap-southeast-1` (S3) | Object storage region name |
| `AWS_LOCATION` | Optional | `media` | Prefix subfolder inside bucket |
| `GOOGLE_OAUTH_CLIENT_ID`| Optional | `<client_id>.apps.googleusercontent.com` | Google OAuth2 Client ID for UTC SSO |
| `ALLOWED_SSO_DOMAINS` | Optional | `utc.edu.vn,gmail.com` | Allowed email domains for SSO |
| `EMAIL_BACKEND` | Optional | `django.core.mail.backends.smtp.EmailBackend` | Production email backend |
| `EMAIL_HOST` | Optional | `smtp.gmail.com` | SMTP Host |
| `EMAIL_PORT` | Optional | `587` | SMTP Port |
| `EMAIL_USE_TLS` | Optional | `True` | TLS Security |
| `EMAIL_HOST_USER` | Optional | `utc.notification@utc.edu.vn` | Sender address |
| `EMAIL_HOST_PASSWORD` | Optional | `<app_password>` | App-specific password |
| `SECURE_SSL_REDIRECT` | Optional | `True` | Enforce HTTPS redirects |
| `SESSION_COOKIE_SECURE` | Optional | `True` | Secure session cookies over HTTPS |
| `CSRF_COOKIE_SECURE` | Optional | `True` | Secure CSRF cookies over HTTPS |

---

## 4. Local Development Verification

```bash
# Frontend
cd frontend
npm install
npm run dev # Runs on http://localhost:3000

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

---

## 5. Persistent Cloud Media Storage (Cloudflare R2 / AWS S3 Setup & Migration Guide)

### 5.1 Architecture Overview
Render web services run on ephemeral containers: any files uploaded to local disk (`MEDIA_ROOT`) are wiped whenever the service restarts, redeploys, or spins down due to inactivity.

To ensure thesis outlines, deliverables, and chat attachments persist permanently:
- **Cloudflare R2** is the primary recommendation: S3-compatible API, global CDN, and **zero data egress fees**.
- **AWS S3** is supported as an enterprise alternative.
- All file access remains **100% private**: clients authenticate via JWT, and Django's `SecureMediaDownloadView` streams the files, preserving role-based access control (RBAC).

### 5.2 Option A: Cloudflare R2 Setup (Recommended)
1. In Cloudflare Dashboard, navigate to **R2** ➔ **Create bucket**.
   - Bucket name: `smart-fyp-media`
   - Location: Automatic
2. In R2 **Manage API Tokens** ➔ **Create API token**:
   - Permission: `Object Read & Write`
   - Specify bucket: `smart-fyp-media`
   - Copy:
     - `Access Key ID`
     - `Secret Access Key`
     - `Endpoint URL` (format: `https://<account_id>.r2.cloudflarestorage.com`)
3. In Render Web Service Environment Variables, configure:
   ```env
   USE_S3=True
   AWS_STORAGE_BUCKET_NAME=smart-fyp-media
   AWS_ACCESS_KEY_ID=<your_r2_access_key_id>
   AWS_SECRET_ACCESS_KEY=<your_r2_secret_access_key>
   AWS_S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
   AWS_S3_REGION_NAME=auto
   AWS_LOCATION=media
   ```

### 5.3 Option B: AWS S3 Setup (Alternative)
1. In AWS Console ➔ S3 ➔ **Create bucket**:
   - Bucket name: `smart-fyp-media`
   - Region: `ap-southeast-1` (Singapore)
   - Block *all* public access: Enabled (Private bucket)
2. In IAM ➔ Create programmatic user with `AmazonS3FullAccess` policy for the bucket.
3. In Render Web Service Environment Variables, configure:
   ```env
   USE_S3=True
   AWS_STORAGE_BUCKET_NAME=smart-fyp-media
   AWS_ACCESS_KEY_ID=<your_aws_access_key_id>
   AWS_SECRET_ACCESS_KEY=<your_aws_secret_access_key>
   AWS_S3_REGION_NAME=ap-southeast-1
   AWS_LOCATION=media
   ```

### 5.4 Data Migration Procedure (Local to Cloud)
Run the built-in idempotent migration command from the backend directory:
```bash
# Step 1: Dry run to preview files to migrate
python manage.py migrate_media_to_s3 --dry-run

# Step 2: Execute non-destructive upload (existing remote files with matching size are skipped)
python manage.py migrate_media_to_s3
```

### 5.5 Rollback Procedure
To instantly revert back to local disk storage without downtime:
1. In Render Dashboard ➔ Environment Variables: set `USE_S3=False`.
2. Save changes (triggers container redeploy).
3. The backend immediately switches back to `FileSystemStorage` at `MEDIA_ROOT`.
