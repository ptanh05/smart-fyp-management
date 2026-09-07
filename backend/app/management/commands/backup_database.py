"""
Automated Database Backup Command for Smart FYP Management.
Supports safe, live, point-in-time SQLite online backups without blocking
concurrent writes or requests, gzip compression, integrity verification,
and automated retention pruning.
"""
import os
import sys
import gzip
import shutil
import sqlite3
import hashlib
import json
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection


class Command(BaseCommand):
    help = "Sao lưu cơ sở dữ liệu tự động định kỳ an toàn kèm nén gzip và kiểm tra toàn vẹn."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dest",
            type=str,
            default=None,
            help="Thư mục lưu trữ bản sao lưu (Mặc định: backend/backups/)"
        )
        parser.add_argument(
            "--keep-days",
            type=int,
            default=7,
            help="Số ngày lưu trữ bản sao lưu trước khi tự động dọn dẹp (Mặc định: 7 ngày)"
        )
        parser.add_argument(
            "--no-compress",
            action="store_true",
            help="Không nén gzip (Lưu file raw .sqlite3)"
        )

    def handle(self, *args, **options):
        dest_dir = options["dest"]
        keep_days = options["keep_days"]
        no_compress = options["no_compress"]

        if not dest_dir:
            dest_dir = os.path.join(settings.BASE_DIR, "backups")
        os.makedirs(dest_dir, exist_ok=True)

        if hasattr(sys.stdout, "reconfigure"):
            try:
                sys.stdout.reconfigure(encoding="utf-8")
                sys.stderr.reconfigure(encoding="utf-8")
            except Exception:
                pass

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.stdout.write(f"[*] Bat dau sao luu CSDL / Starting database backup ({timestamp})...")

        db_engine = connection.settings_dict.get("ENGINE", "")
        db_name = connection.settings_dict.get("NAME", "")

        if "sqlite" in db_engine:
            self._backup_sqlite(db_name, dest_dir, timestamp, no_compress)
        elif "postgres" in db_engine:
            self._backup_postgres(dest_dir, timestamp, no_compress)
        else:
            self.stdout.write(self.style.WARNING(f"Engine {db_engine} chưa hỗ trợ native live backup. Sao lưu tệp trực tiếp..."))
            if os.path.exists(str(db_name)):
                raw_dest = os.path.join(dest_dir, f"backup_db_{timestamp}.db")
                shutil.copy2(str(db_name), raw_dest)
                self.stdout.write(self.style.SUCCESS(f"[✓] Đã sao lưu thô: {raw_dest}"))

        # Prune old backups
        self._prune_old_backups(dest_dir, keep_days)

    def _backup_sqlite(self, source_db_path, dest_dir, timestamp, no_compress):
        """Perform a safe live online SQLite backup using sqlite3.Connection.backup()."""
        source_path = str(source_db_path)
        close_src = False
        if os.path.exists(source_path):
            src_conn = sqlite3.connect(source_path, timeout=5.0)
            close_src = True
        elif hasattr(connection, "connection") and connection.connection:
            src_conn = connection.connection
        else:
            self.stderr.write(self.style.ERROR(f"[!] Không tìm thấy tệp cơ sở dữ liệu: {source_path}"))
            return

        temp_backup_file = os.path.join(dest_dir, f"backup_smart_fyp_{timestamp}.sqlite3")
        final_file = temp_backup_file

        try:
            # 1. Open destination connection and perform native SQLite Online Backup
            dst_conn = sqlite3.connect(temp_backup_file, timeout=5.0)
            src_conn.backup(dst_conn)
            dst_conn.close()
            if close_src:
                src_conn.close()

            # 3. Verify integrity of backup
            verify_conn = sqlite3.connect(temp_backup_file)
            cursor = verify_conn.cursor()
            cursor.execute("PRAGMA integrity_check;")
            integrity_result = cursor.fetchone()[0]
            verify_conn.close()

            if integrity_result != "ok":
                raise Exception(f"Integrity check failed: {integrity_result}")

            self.stdout.write(self.style.SUCCESS(f"[OK] Kiem tra toan ven CSDL (PRAGMA integrity_check): {integrity_result}"))

            # 4. Gzip Compression (if enabled)
            if not no_compress:
                compressed_file = f"{temp_backup_file}.gz"
                with open(temp_backup_file, "rb") as f_in:
                    with gzip.open(compressed_file, "wb", compresslevel=6) as f_out:
                        shutil.copyfileobj(f_in, f_out)
                os.remove(temp_backup_file)
                final_file = compressed_file

            # 5. Compute Checksum & Metadata
            sha256 = hashlib.sha256()
            with open(final_file, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    sha256.update(chunk)
            checksum = sha256.hexdigest()
            file_size = os.path.getsize(final_file)

            manifest = {
                "backup_file": os.path.basename(final_file),
                "timestamp": timestamp,
                "created_at": datetime.now().isoformat(),
                "size_bytes": file_size,
                "size_formatted": f"{file_size / (1024 * 1024):.2f} MB",
                "sha256": checksum,
                "integrity_check": integrity_result,
                "database_type": "SQLite",
            }

            manifest_file = os.path.join(dest_dir, f"backup_smart_fyp_{timestamp}.json")
            with open(manifest_file, "w", encoding="utf-8") as mf:
                json.dump(manifest, mf, indent=2, ensure_ascii=False)

            self.stdout.write(self.style.SUCCESS(
                f"[OK] Sao luu CSDL thanh cong!\n"
                f"    - Tep sao luu: {final_file}\n"
                f"    - Dung luong: {manifest['size_formatted']}\n"
                f"    - SHA256: {checksum[:16]}...\n"
                f"    - Metadata: {manifest_file}"
            ))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"[ERROR] Loi khi sao luu SQLite: {e}"))
            if os.path.exists(temp_backup_file):
                try:
                    os.remove(temp_backup_file)
                except Exception:
                    pass
            raise

    def _backup_postgres(self, dest_dir, timestamp, no_compress):
        """Backup PostgreSQL database using pg_dump."""
        db_conf = connection.settings_dict
        user = db_conf.get("USER", "postgres")
        host = db_conf.get("HOST", "localhost")
        port = db_conf.get("PORT", "5432")
        db_name = db_conf.get("NAME", "smart_fyp")

        dump_file = os.path.join(dest_dir, f"backup_postgres_{db_name}_{timestamp}.sql")
        cmd = f"pg_dump -h {host} -p {port} -U {user} -d {db_name} -F p -f \"{dump_file}\""

        self.stdout.write(self.style.NOTICE(f"[*] Đang chạy pg_dump: {cmd}"))
        res = os.system(cmd)
        if res == 0:
            if not no_compress:
                gz_file = f"{dump_file}.gz"
                with open(dump_file, "rb") as f_in, gzip.open(gz_file, "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)
                os.remove(dump_file)
                self.stdout.write(self.style.SUCCESS(f"[✓] Đã sao lưu PostgreSQL: {gz_file}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"[✓] Đã sao lưu PostgreSQL: {dump_file}"))
        else:
            self.stderr.write(self.style.ERROR(f"[!] pg_dump trả về mã lỗi: {res}"))

    def _prune_old_backups(self, dest_dir, keep_days):
        """Prune backup files older than keep_days."""
        if keep_days <= 0:
            return

        now = datetime.now()
        cutoff_date = now - timedelta(days=keep_days)
        pruned_count = 0

        self.stdout.write(self.style.NOTICE(f"[*] Kiểm tra dọn dẹp bản sao lưu cũ hơn {keep_days} ngày..."))

        for filename in os.listdir(dest_dir):
            if filename.startswith("backup_") and (filename.endswith(".gz") or filename.endswith(".sqlite3") or filename.endswith(".json")):
                filepath = os.path.join(dest_dir, filename)
                try:
                    mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                    if mtime < cutoff_date:
                        os.remove(filepath)
                        pruned_count += 1
                        self.stdout.write(f"    - Đã xóa bản sao lưu cũ: {filename}")
                except Exception as e:
                    self.stderr.write(f"[!] Không thể xóa {filename}: {e}")

        if pruned_count > 0:
            self.stdout.write(self.style.SUCCESS(f"[✓] Đã dọn dẹp {pruned_count} tệp sao lưu cũ."))
        else:
            self.stdout.write(self.style.SUCCESS("[✓] Không có tệp sao lưu nào vượt quá hạn lưu trữ."))
