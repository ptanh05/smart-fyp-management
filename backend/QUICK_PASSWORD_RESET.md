# Quick Password Reset Guide

## ⚠️ Important: Passwords Cannot Be Retrieved

Django stores passwords as **one-way hashes** for security. The original password cannot be retrieved from the database.

## To Get Supervisor Information

Run this command from the `backend` directory:

```bash
python get_supervisor_info.py --username rafiq
```

Or if the username is exactly "rafiq_mufti":

```bash
python get_supervisor_info.py --username rafiq_mufti
```

## To Reset Password

If you need to reset the password for supervisor "rafiq_mufti":

```bash
python get_supervisor_info.py --username rafiq_mufti --reset --password newpassword123
```

**Example:**
```bash
python get_supervisor_info.py -u rafiq_mufti -r -p admin123
```

## Alternative: Using Django Shell

You can also use Django shell directly:

```bash
python manage.py shell
```

Then run:
```python
from app.models import Supervisor, CustomUser

# Find supervisor
supervisor = Supervisor.objects.filter(user__username__icontains='rafiq').first()

# Show info
print(f"Username: {supervisor.user.username}")
print(f"Email: {supervisor.user.email}")

# Reset password
supervisor.user.set_password('newpassword123')
supervisor.user.save()
print("Password reset to: newpassword123")
```

## Login Credentials Format

For supervisor login, use:
- **Email**: The email from the database
- **Password**: The password you set (or the original if you know it)
