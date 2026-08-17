# Django Admin Password Change Guide

## How to Change Passwords in Django Admin

### Method 1: Using the Change Password Form (Recommended)

1. **Log in to Django Admin**
   - Go to `http://localhost:8000/admin/`
   - Log in with your superuser credentials

2. **Navigate to Custom Users**
   - Click on "Custom Users" in the admin panel

3. **Select a User**
   - Click on the username of the user you want to change password for

4. **Change Password**
   - You'll see a form with user details
   - **Look for the "Change password" form** at the top (Django automatically adds this)
   - OR scroll down to find password-related fields
   - Enter the new password
   - Confirm the password
   - Click "Save"

### Method 2: Direct Password Field (If Available)

1. **Edit User**
   - Go to Custom Users → Select user

2. **Password Section**
   - In the form, you'll see a password field
   - It may show as "Raw passwords are not stored, so there is no way to see this user's password"
   - Click on the password field or use the change password link

3. **Enter New Password**
   - Type new password
   - Confirm password
   - Save

---

## Using Django Shell (Alternative Method)

If admin doesn't work, use Django shell:

```bash
cd backend
python manage.py shell
```

Then run:
```python
from app.models import CustomUser

# Find user
user = CustomUser.objects.get(username='username_here')

# Set new password (Django will hash it automatically)
user.set_password('newpassword123')
user.save()

print(f"Password changed successfully for {user.username}")
```

---

## Using Management Command (Quick Script)

Create a file `backend/change_password.py`:

```python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from app.models import CustomUser
import sys

if len(sys.argv) < 3:
    print("Usage: python change_password.py <username> <new_password>")
    sys.exit(1)

username = sys.argv[1]
new_password = sys.argv[2]

try:
    user = CustomUser.objects.get(username=username)
    user.set_password(new_password)
    user.save()
    print(f"✓ Password changed successfully for {user.username}")
except CustomUser.DoesNotExist:
    print(f"✗ User '{username}' not found")
```

Run it:
```bash
python change_password.py rafiq_mufti newpassword123
```

---

## Troubleshooting

### Password Field Not Showing?
- Make sure you're using the CustomUserAdmin (already configured)
- Clear browser cache
- Try a different browser

### Can't Save Password?
- Check if user has required fields filled
- Verify you have admin permissions
- Check Django logs for errors

### Password Not Working After Change?
- Make sure you're using the new password
- Check if password was saved (verify in shell)
- Try logging out and back in

---

## Verification

After changing password, verify it works:

```python
# In Django shell
from app.models import CustomUser

user = CustomUser.objects.get(username='username')
print(user.check_password('newpassword123'))  # Should return True
```
