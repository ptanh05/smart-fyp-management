# CLOUD MEDIA STORAGE MIGRATION GUIDE
**Smart FYP Management System — University of Transport and Communications (UTC)**

---

## 1. Overview & Objectives

In production deployments on container platforms like Render, the container filesystem is ephemeral: files uploaded to local disk (`MEDIA_ROOT`) are wiped during redeployments, restarts, or inactivity spin-downs.

This guide provides step-by-step procedures to migrate user-uploaded media files (outlines, progress reports, deliverables, chat attachments, bug reports) to persistent, highly available cloud object storage (**Cloudflare R2** or **AWS S3**), ensuring zero data loss, end-to-end data integrity, and seamless bidirectional rollback capability.

---

## 2. Architecture & Safety Principles

1. **Strictly Private Bucket**:
   - The bucket is NOT exposed publicly.
   - All download access is mediated by Django's `SecureMediaDownloadView`, which enforces JWT authentication, group RBAC permissions, and path traversal protection.
2. **Non-Destructive Execution**:
   - Source files are never deleted or truncated during migration.
   - Local files remain intact as an offline backup.
3. **Idempotent Migration**:
   - Re-running the command automatically skips files that already exist in destination storage with matching byte sizes.
4. **Byte-for-Byte Checksum Verification**:
   - The `--verify-checksum` flag calculates SHA256 hashes of both source and destination streams to guarantee zero corruption.
5. **Bidirectional Rollback Support**:
   - The `--from-s3-to-local` flag allows instant syncing of all cloud files back to local disk if a rollback or disaster recovery is required.

---

## 3. Preparation & Prerequisites

### 3.1 Cloudflare R2 Configuration (Recommended)
1. In Cloudflare Dashboard ➔ **R2** ➔ Create a bucket: `smart-fyp-media`.
2. Under **Manage R2 API Tokens**, create a token with `Object Read & Write` permissions.
3. Note the following parameters:
   - **Account ID**: Used in Endpoint URL: `https://<account_id>.r2.cloudflarestorage.com`
   - **Access Key ID**: 32-character string
   - **Secret Access Key**: 64-character string
   - **Bucket Name**: `smart-fyp-media`

### 3.2 Environment Variables (Render Dashboard or `.env`)
```env
USE_S3=True
AWS_STORAGE_BUCKET_NAME=smart-fyp-media
AWS_ACCESS_KEY_ID=<your_access_key_id>
AWS_SECRET_ACCESS_KEY=<your_secret_access_key>
AWS_S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
AWS_S3_REGION_NAME=auto
AWS_S3_ADDRESSING_STYLE=path
AWS_LOCATION=media
AWS_QUERYSTRING_AUTH=False
```

---

## 4. Migration Execution Steps

### Step 1: Pre-Migration Inventory Check
Check the count and size of local media files:
```bash
cd backend
python -c "
import os
from backend import settings
src = str(settings.MEDIA_ROOT)
files = [os.path.join(r, f) for r, _, fs in os.walk(src) for f in fs if not f.startswith('.')]
print(f'Total local media files: {len(files)}')
print(f'Total size: {sum(os.path.getsize(f) for f in files) / (1024*1024):.2f} MB')
"
```

### Step 2: Simulation Mode (Dry-Run)
Test connectivity and preview all files that will be uploaded without writing anything:
```bash
python manage.py migrate_media_to_s3 --dry-run
```
*Expected output: Lists each file with `[DRY-RUN] Would upload: ...` and summarizes total discovered and planned uploads.*

### Step 3: Execute Live Migration with SHA256 Integrity Verification
Run the actual migration with checksum verification:
```bash
python manage.py migrate_media_to_s3 --verify-checksum
```
*Expected output:*
```text
=== SMART FYP MEDIA STORAGE MIGRATION (LOCAL -> CLOUD) ===
Source Directory: /path/to/backend/media
Active Storage Backend: MediaStorage
Dry Run Mode: False
Overwrite Existing: False
Verify Checksum: True
[UPLOADED] 'chat_attachments/Báo_cáo_tuần_1.pdf' -> 'chat_attachments/Báo_cáo_tuần_1.pdf' (1048576 bytes)
...
=== MIGRATION SUMMARY ===
Total Discovered: 42
Successfully Uploaded: 42
Skipped (Already in Storage): 0
Checksums Verified: 42
Failed Files: 0
==========================
```

### Step 4: Verification of Idempotence
Re-run the command immediately:
```bash
python manage.py migrate_media_to_s3
```
*Expected output:*
- `Total Discovered: 42`
- `Successfully Uploaded: 0`
- `Skipped (Already in Storage): 42`
- `Failed Files: 0`

---

## 5. Rollback & Disaster Recovery (Cloud to Local)

If cloud storage must be disabled or offline backups restored, use the reverse migration mode:

```bash
# Step 1: Dry run to preview restore
python manage.py migrate_media_to_s3 --from-s3-to-local --dry-run

# Step 2: Download all cloud objects to local MEDIA_ROOT with SHA256 verification
python manage.py migrate_media_to_s3 --from-s3-to-local --verify-checksum

# Step 3: Disable S3 on Render / server
# In Render Environment Variables, set:
USE_S3=False
```
When `USE_S3=False`, Django immediately reverts to local `FileSystemStorage` at `MEDIA_ROOT`. Because all cloud files were synced down in Step 2, no data is lost.

---

## 6. CLI Command Reference

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--dry-run` | Flag | `False` | Simulates file discovery and transfers without writing to destination. |
| `--overwrite` | Flag | `False` | Overwrites files in destination even if they already exist with matching size. |
| `--verify-checksum` | Flag | `False` | Verifies SHA256 hash match between source and destination streams. |
| `--from-s3-to-local` | Flag | `False` | Reverse mode: downloads files from cloud storage back to local filesystem. |
| `--source-dir` | String | `settings.MEDIA_ROOT` | Custom source directory for local files. |
| `--dest-dir` | String | `settings.MEDIA_ROOT` | Custom destination directory for restore/rollback mode. |
| `--batch-size` | Integer | `1000` | Maximum number of files processed per execution run. |

