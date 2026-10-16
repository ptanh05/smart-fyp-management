# Script khởi chạy toàn bộ 4 service của cả 2 dự án
Write-Host "Dang khoi dong 4 service cho he thong Smart FYP UTC..." -ForegroundColor Green

# 1. Main Backend (Port 8000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\smart-fyp-management\backend'; Write-Host '=== USER BACKEND (PORT 8000) ===' -ForegroundColor Cyan; python manage.py runserver 8000"

# 2. Main Frontend (Port 3000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\smart-fyp-management\frontend'; Write-Host '=== USER FRONTEND (PORT 3000) ===' -ForegroundColor Green; npm run dev"

# 3. Admin Backend (Port 8001)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\Smart-Fyp-Admin\backend'; Write-Host '=== ADMIN BACKEND (PORT 8001) ===' -ForegroundColor Yellow; python manage.py runserver 8001"

# 4. Admin Frontend (Port 5174)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\Smart-Fyp-Admin\frontend'; Write-Host '=== ADMIN FRONTEND (PORT 5174) ===' -ForegroundColor Magenta; npm run dev"

Write-Host "Da mo 4 terminal. Vui long kiem tra cac cua so PowerShell vua duoc tao!" -ForegroundColor Green
