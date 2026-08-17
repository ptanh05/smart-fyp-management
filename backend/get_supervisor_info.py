"""
Script to get supervisor information and reset password if needed
Run this from the backend directory with: python get_supervisor_info.py
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from app.models import Supervisor, CustomUser

def get_supervisor_info(username_search='rafiq'):
    """Get supervisor information by username"""
    try:
        # Search for supervisor by username (case-insensitive)
        supervisor = Supervisor.objects.filter(
            user__username__icontains=username_search
        ).first()
        
        if not supervisor:
            print(f"❌ Supervisor with username containing '{username_search}' not found.")
            print("\nAvailable supervisors:")
            all_supervisors = Supervisor.objects.all()
            for sup in all_supervisors:
                print(f"  - {sup.user.username} (Email: {sup.user.email})")
            return None
        
        user = supervisor.user
        
        print("=" * 60)
        print("SUPERVISOR INFORMATION")
        print("=" * 60)
        print(f"Username: {user.username}")
        print(f"Email: {user.email}")
        print(f"Supervisor ID: {supervisor.supervisor_id}")
        print(f"User Type: {user.user_type}")
        print(f"Research Interest: {supervisor.research_interest or 'N/A'}")
        print(f"Academic Background: {supervisor.academic_background or 'N/A'}")
        print(f"\n⚠️  Password: Cannot be retrieved (stored as hash)")
        print("=" * 60)
        
        return supervisor
        
    except Exception as e:
        print(f"Error: {e}")
        return None

def reset_password(username_search='rafiq', new_password='admin123'):
    """Reset supervisor password"""
    try:
        supervisor = Supervisor.objects.filter(
            user__username__icontains=username_search
        ).first()
        
        if not supervisor:
            print(f"❌ Supervisor not found.")
            return False
        
        user = supervisor.user
        user.set_password(new_password)
        user.save()
        
        print("=" * 60)
        print("PASSWORD RESET SUCCESSFUL")
        print("=" * 60)
        print(f"Username: {user.username}")
        print(f"Email: {user.email}")
        print(f"New Password: {new_password}")
        print("=" * 60)
        print("\n⚠️  Please change this password after first login!")
        
        return True
        
    except Exception as e:
        print(f"Error resetting password: {e}")
        return False

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Get supervisor info or reset password')
    parser.add_argument('--username', '-u', default='rafiq', help='Username to search for')
    parser.add_argument('--reset', '-r', action='store_true', help='Reset password')
    parser.add_argument('--password', '-p', default='admin123', help='New password (if resetting)')
    
    args = parser.parse_args()
    
    if args.reset:
        reset_password(args.username, args.password)
    else:
        get_supervisor_info(args.username)
