# Script khởi chạy toàn bộ 4 service của cả 2 dự án (Tự động nhận diện thư mục)
Write-Host "Dang khoi dong 4 service cho he thong Smart FYP UTC..." -ForegroundColor Green

$RootFolder = Split-Path -Parent $PSScriptRoot
$UserBackend = Join-Path $RootFolder "smart-fyp-management\backend"
$UserFrontend = Join-Path $RootFolder "smart-fyp-management\frontend"
$AdminBackend = Join-Path $RootFolder "Smart-Fyp-Admin\backend"
$AdminFrontend = Join-Path $RootFolder "Smart-Fyp-Admin\frontend"

# 1. Main Backend (Port 8000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$UserBackend'; Write-Host '=== USER BACKEND (PORT 8000) ===' -ForegroundColor Cyan; python manage.py runserver 8000"

# 2. Main Frontend (Port 3000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$UserFrontend'; Write-Host '=== USER FRONTEND (PORT 3000) ===' -ForegroundColor Green; npm run dev"

# 3. Admin Backend (Port 8001)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$AdminBackend'; Write-Host '=== ADMIN BACKEND (PORT 8001) ===' -ForegroundColor Yellow; python manage.py runserver 8001"

# 4. Admin Frontend (Port 5174)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$AdminFrontend'; Write-Host '=== ADMIN FRONTEND (PORT 5174) ===' -ForegroundColor Magenta; npm run dev"

Write-Host "Da mo 4 terminal. Vui long kiem tra cac cua so PowerShell vua duoc tao!" -ForegroundColor Green
