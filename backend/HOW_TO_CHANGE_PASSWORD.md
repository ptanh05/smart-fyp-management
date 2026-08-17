# How to Change Password in Django Admin

## ✅ Current Status

- **"Users" table is CORRECT** - This is your CustomUser model (we set `verbose_name = "User"`)
- Password change functionality is configured and should work

## 🔧 Steps to Change Password

### Method 1: Via Django Admin (Primary Method)

1. **Go to**: `http://localhost:8000/admin/`
2. **Click on**: "Users" (this is your CustomUser model)
3. **Click on**: Any username to edit that user
4. **Look for the password field** - You should see:
   ```
   Password: ********
   Raw passwords are not stored, so there is no way to see this user's password, 
   but you can change the password using this form.
   ```
5. **Click on the password field** - This should open a password change form
6. **OR look for a "Change password" link** (usually appears above or below the password field)
7. **Enter new password**
8. **Confirm password**
9. **Click "Save"** or "Change password"

### Method 2: Direct URL (If form doesn't appear)

If the password change form doesn't appear when clicking the password field, try this URL directly:

```
http://localhost:8000/admin/auth/user/<user_id>/password/
```

Replace `<user_id>` with the actual user ID (you can see it in the URL when editing a user).

### Method 3: Management Command (Fastest)

```bash
cd backend
python manage.py change_user_password <username> <new_password>
```

**Example:**
```bash
python manage.py change_user_password rafiq_mufti admin123
```

### Method 4: Django Shell

```bash
cd backend
python manage.py shell
```

```python
from app.models import CustomUser

user = CustomUser.objects.get(username='rafiq_mufti')
user.set_password('admin123')
user.save()
print("Password changed successfully!")
```

## 🔍 Troubleshooting

### If password change form doesn't appear:

1. **Restart Django server**:
   ```bash
   # Stop server (Ctrl+C)
   # Then restart:
   python manage.py runserver
   ```

2. **Clear browser cache**:
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely

3. **Check admin URL**:
   - Make sure you're logged in as a superuser
   - URL should be: `http://localhost:8000/admin/`

4. **Verify user permissions**:
   - You need to be a superuser or have permission to change users
   - Check: `http://localhost:8000/admin/auth/user/` - you should see users here

### If "Users" table doesn't appear:

1. **Check AUTH_USER_MODEL** in `backend/backend/settings.py`:
   ```python
   AUTH_USER_MODEL = "app.CustomUser"
   ```

2. **Restart Django server** after any settings changes

3. **Run migrations** (if needed):
   ```bash
   python manage.py migrate
   ```

## ✅ Verification

After changing password, verify it works:

```python
# In Django shell
from app.models import CustomUser

user = CustomUser.objects.get(username='rafiq_mufti')
print(user.check_password('admin123'))  # Should print: True
```

## 📝 What You Should See

When you click on a user in the admin:

1. **Username** field
2. **Password** field (with change password functionality)
3. **Personal info** section (first name, last name, email)
4. **Permissions** section
5. **Important dates** section
6. **Custom Fields** section (user_type)

The password field should be clickable and show a password change form when clicked.

## 🎯 Quick Test

Try this to verify everything works:

```bash
# Change password via command
python manage.py change_user_password rafiq_mufti test123

# Then try logging in with the new password
```

If this works, the password change functionality is working correctly!
