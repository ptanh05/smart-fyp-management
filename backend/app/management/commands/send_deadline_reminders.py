from django.core.management.base import BaseCommand

from app.feature_services import send_deadline_reminders


class Command(BaseCommand):
    help = "Gửi thông báo nhắc hạn task (D-3, D-1, quá hạn). An toàn khi chạy lại: mỗi mốc chỉ gửi một lần."

    def add_arguments(self, parser):
        parser.add_argument("--no-email", action="store_true", help="Chỉ tạo thông báo trong hệ thống, không gửi email")

    def handle(self, *args, **options):
        sent = send_deadline_reminders(send_email=not options["no_email"])
        self.stdout.write(self.style.SUCCESS(f"Đã gửi {sent} nhắc hạn."))
