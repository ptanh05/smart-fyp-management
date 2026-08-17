# Quick Password Change Guide

## ✅ Django Admin Password Change (Now Working!)

The `CustomUserAdmin` is now properly configured to handle password changes.

### Steps to Change Password in Admin:

1. **Go to Django Admin**: `http://localhost:8000/admin/`
2. **Navigate to**: Custom Users
3. **Click on a user** to edit
4. **You'll see two ways to change password:**

   **Option A: Change Password Form (Recommended)**
   - Look for a separate "Change password" form/section
   - Enter new password
   - Confirm password
   - Click "Save"

   **Option B: Password Field in Main Form**
   - Scroll to the password field
   - It shows: "Raw passwords are not stored..."
   - Click on it or use the change password link
   - Enter new password

5. **Save the user**

---

## 🚀 Quick Command Line Method

### Using Management Command:

```bash
cd backend
python manage.py change_user_password <username> <new_password>
```

**Example:**
```bash
python manage.py change_user_password rafiq_mufti admin123
```

### Using Django Shell:

```bash
python manage.py shell
```

```python
from app.models import CustomUser

user = CustomUser.objects.get(username='rafiq_mufti')
user.set_password('admin123')
user.save()
print("Password changed!")
```

---

## 🔍 Verify Password Change

```python
# In Django shell
from app.models import CustomUser

user = CustomUser.objects.get(username='rafiq_mufti')
print(user.check_password('admin123'))  # Should print: True
```

---

## 📝 What Was Fixed

1. ✅ Created `CustomUserAdmin` extending `BaseUserAdmin`
2. ✅ Proper fieldsets for user management
3. ✅ Password change form automatically available
4. ✅ Created management command for quick password changes

---

## 🎯 Features Now Available

- ✅ Change password in Django admin
- ✅ Update user information
- ✅ Set password when creating new users
- ✅ Password validation
- ✅ Proper password hashing

---

## 💡 Tips

- The password field in admin shows as "Raw passwords are not stored" - this is normal
- Use the "Change password" form for better UX
- Passwords are automatically hashed by Django
- You can't see existing passwords (security feature)
