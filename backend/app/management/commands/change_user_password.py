"""
Django management command to change user password
Usage: python manage.py change_user_password <username> <new_password>
"""
from django.core.management.base import BaseCommand
from app.models import CustomUser


class Command(BaseCommand):
    help = 'Change password for a user'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username of the user')
        parser.add_argument('password', type=str, help='New password')

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']

        try:
            user = CustomUser.objects.get(username=username)
            user.set_password(password)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f'✓ Password changed successfully for {username}')
            )
        except CustomUser.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'✗ User "{username}" not found')
            )
