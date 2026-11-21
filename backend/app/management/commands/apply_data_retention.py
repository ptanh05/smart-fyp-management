import json

from django.core.management.base import BaseCommand

from app.feature_services import apply_data_retention


class Command(BaseCommand):
    help = (
        "Xóa dữ liệu cá nhân không còn cần thiết của các đợt đã đóng quá N năm (Nghị định 13/2023). "
        "Mặc định chỉ chạy thử; thêm --apply để xóa thật."
    )

    def add_arguments(self, parser):
        parser.add_argument("--years", type=int, default=None, help="Số năm lưu giữ (mặc định DATA_RETENTION_YEARS)")
        parser.add_argument("--apply", action="store_true", help="Thực sự xóa dữ liệu")

    def handle(self, *args, **options):
        summary = apply_data_retention(years=options["years"], apply=options["apply"])
        self.stdout.write(json.dumps(summary, ensure_ascii=False, indent=2))
        if not options["apply"]:
            self.stdout.write(self.style.WARNING("Chạy thử: chưa xóa gì. Thêm --apply để thực hiện."))
