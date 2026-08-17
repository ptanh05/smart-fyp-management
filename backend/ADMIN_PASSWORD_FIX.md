# Fix: Password Change in Django Admin

## Problem
- Seeing "Users" table instead of "Custom Users" (this is now correct)
- No way to change password in admin

## Solution Applied

### 1. Added Meta Class to CustomUser Model
- Added `verbose_name = "User"` and `verbose_name_plural = "Users"`
- This makes the admin show "Users" (which is what you're seeing - this is correct!)

### 2. Verified Admin Configuration
- `CustomUserAdmin` extends `BaseUserAdmin` ✓
- Proper fieldsets configured ✓
- Password field included in fieldsets ✓

## How to Change Password Now

### Step-by-Step:

1. **Go to Django Admin**: `http://localhost:8000/admin/`
2. **Click on "Users"** (this is your CustomUser model)
3. **Click on a username** to edit that user
4. **Look for the password field** - it will show:
   ```
   Password: ********
   Raw passwords are not stored, so there is no way to see this user's password, but you can change the password using this form.
   ```
5. **Click on the password field** or look for a **"Change password" link** (usually appears as a separate form section)
6. **Enter new password** in the password change form
7. **Confirm password**
8. **Click "Save"** or "Change password"

### Alternative: Direct Password Field

If you see the password field directly in the form:
1. Click on the password field
2. Enter new password
3. Confirm password
4. Save the user

## If Password Change Still Doesn't Appear

### Option 1: Restart Django Server
```bash
# Stop the server (Ctrl+C)
# Then restart:
python manage.py runserver
```

### Option 2: Clear Browser Cache
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or clear browser cache completely

### Option 3: Use Management Command
```bash
python manage.py change_user_password <username> <new_password>
```

### Option 4: Use Django Shell
```bash
python manage.py shell
```

```python
from app.models import CustomUser

user = CustomUser.objects.get(username='rafiq_mufti')
user.set_password('newpassword123')
user.save()
print("Password changed!")
```

## Verification

After changing password, verify it works:
```python
# In Django shell
from app.models import CustomUser

user = CustomUser.objects.get(username='rafiq_mufti')
print(user.check_password('newpassword123'))  # Should print: True
```

## What You Should See

When you click on a user in the admin:
- **Username** field
- **Password** field (with change password link/form)
- **Personal info** section
- **Permissions** section
- **Important dates** section
- **Custom Fields** section (with user_type)

The password change functionality is built into `BaseUserAdmin` - it should appear automatically!
