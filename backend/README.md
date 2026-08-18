# 🎓 Smart FYP UTC - Backend Service (Django REST Framework)

Dịch vụ Backend quản lý Đồ án Tốt nghiệp chuẩn Trường Đại học Giao thông Vận tải (UTC).

## 🚀 Công nghệ & Kiến trúc
- **Framework**: Django 4.2 + Django REST Framework (DRF)
- **ASGI Server**: Daphne / Django Channels (Real-time Chat & Websockets)
- **Cơ sở dữ liệu**: Hỗ trợ linh hoạt **PostgreSQL**, **MySQL** (cho Production) và **SQLite** (cho Dev/Test)
- **Authentication**: JWT (JSON Web Tokens) + Role-Based Access Control (RBAC)

---

## 🛠️ Hướng dẫn Khởi chạy Backend

### 1. Cài đặt Phụ thuộc (Dependencies)
```bash
pip install -r requirements.txt
```

### 2. Cấu hình Biến Môi trường (`.env`)
Tạo tệp `.env` trong thư mục `backend/` từ tệp mẫu `example.env`:
```env
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1

# Cấu hình Cơ sở dữ liệu (PostgreSQL / MySQL / SQLite)
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=db.sqlite3
# DB_ENGINE=django.db.backends.postgresql
# DB_NAME=smart_fyp_utc
# DB_USER=postgres
# DB_PASSWORD=yourpassword
# DB_HOST=localhost
# DB_PORT=5432
```

### 3. Thực thi Migration & Seed Dữ liệu UTC
```bash
python manage.py migrate
python manage.py seed_database
```

### 4. Khởi chạy Server
```bash
python manage.py runserver 8000
```

---

## 🔐 Hướng dẫn Đổi Mật khẩu & Quản trị (Consolidated Password Guide)

### 1. Đổi mật khẩu tài khoản Admin / Superuser
Nếu cần đặt lại mật khẩu cho tài khoản Quản trị viên (`admin`):
```bash
python manage.py changepassword admin
```

Hoặc qua Django Shell:
```bash
python manage.py shell -c "from app.models import CustomUser; u = CustomUser.objects.get(username='admin'); u.set_password('admin123'); u.save(); print('Mật khẩu Admin đã được cập nhật thành công!')"
```

### 2. Danh sách Tài khoản Mẫu Đã Seed:
- **Superuser**: `admin` / `admin123` (`admin@utc.edu.vn`)
- **Sinh viên UTC Demo**: `svdemo` (MSSV: `201200999`) / `demo123`
- **Giảng viên UTC Demo**: `gvdemo` (`gvdemo@utc.edu.vn`) / `demo123`
- **Sinh viên mẫu 1**: `student1` (MSSV: `201200101`) / `student123`
- **Giảng viên Hướng dẫn 1**: `gvc.nguyen@utc.edu.vn` / `supervisor123`
- **Hội đồng / Phản biện 1**: `hd.nguyen@utc.edu.vn` / `committee123`
