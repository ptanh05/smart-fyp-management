"""
Django Management Command: migrate_media_to_s3
Migrates local media files to persistent cloud object storage (Cloudflare R2 / AWS S3).
Strictly idempotent, non-destructive (never deletes local source files).
"""
import os
import hashlib
from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files import File


def safe_str(val):
    """Safely format string for console output across Windows and POSIX."""
    if isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    return str(val).encode("ascii", errors="replace").decode("ascii")


def compute_file_sha256(filepath):
    """Compute SHA256 checksum of a local file."""
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


class Command(BaseCommand):
    help = "Safely migrate local media files to persistent cloud storage (Cloudflare R2 / AWS S3)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate migration without uploading any files to cloud storage.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Force overwrite files in cloud storage even if they already exist with matching size.",
        )
        parser.add_argument(
            "--source-dir",
            type=str,
            default=None,
            help="Custom local source directory (defaults to settings.MEDIA_ROOT).",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=1000,
            help="Maximum number of files to process in this run.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        overwrite = options["overwrite"]
        batch_size = options["batch_size"]
        source_dir = options["source_dir"] or str(settings.MEDIA_ROOT)

        self.stdout.write("=== SMART FYP MEDIA STORAGE MIGRATION ===")
        self.stdout.write(f"Source Directory: {safe_str(source_dir)}")
        self.stdout.write(f"Active Storage Backend: {default_storage.__class__.__name__}")
        self.stdout.write(f"Dry Run Mode: {dry_run}")
        self.stdout.write(f"Overwrite Existing: {overwrite}")

        if not os.path.exists(source_dir):
            self.stdout.write(self.style.WARNING(f"Source directory '{safe_str(source_dir)}' does not exist. Nothing to migrate."))
            return

        total_discovered = 0
        total_uploaded = 0
        total_skipped = 0
        total_failed = 0
        failed_files = []

        # Collect local files
        for root, _, files in os.walk(source_dir):
            for filename in files:
                total_discovered += 1
                if total_discovered > batch_size:
                    self.stdout.write(self.style.WARNING(f"Reached batch limit of {batch_size} files. Stopping."))
                    break

                local_path = os.path.join(root, filename)
                rel_path = os.path.relpath(local_path, source_dir).replace("\\", "/")

                # Exclude hidden files or OS artifacts
                if filename.startswith(".") or filename.endswith(".tmp"):
                    continue

                local_size = os.path.getsize(local_path)

                try:
                    # Check if file exists in destination storage
                    already_exists = False
                    try:
                        already_exists = default_storage.exists(rel_path)
                    except Exception as e:
                        # Storage check failed (e.g. backend connectivity issue)
                        raise RuntimeError(f"Storage existence check failed: {e}")

                    if already_exists and not overwrite:
                        # Check size if available
                        try:
                            remote_size = default_storage.size(rel_path)
                            if remote_size == local_size:
                                self.stdout.write(f"[SKIPPED] '{safe_str(rel_path)}' already exists ({local_size} bytes).")
                                total_skipped += 1
                                continue
                        except Exception:
                            self.stdout.write(f"[SKIPPED] '{safe_str(rel_path)}' already exists.")
                            total_skipped += 1
                            continue

                    if dry_run:
                        self.stdout.write(self.style.SUCCESS(f"[DRY-RUN] Would upload: '{safe_str(rel_path)}' ({local_size} bytes)"))
                        total_uploaded += 1
                    else:
                        with open(local_path, "rb") as lf:
                            if already_exists and overwrite:
                                try:
                                    default_storage.delete(rel_path)
                                except Exception:
                                    pass
                            saved_name = default_storage.save(rel_path, File(lf))

                        # Verify upload
                        if default_storage.exists(saved_name):
                            self.stdout.write(self.style.SUCCESS(f"[UPLOADED] '{safe_str(rel_path)}' -> '{safe_str(saved_name)}' ({local_size} bytes)"))
                            total_uploaded += 1
                        else:
                            raise IOError(f"File '{saved_name}' could not be verified after save.")

                except Exception as err:
                    self.stdout.write(self.style.ERROR(f"[FAILED] '{safe_str(rel_path)}': {safe_str(err)}"))
                    total_failed += 1
                    failed_files.append((rel_path, str(err)))

        self.stdout.write("\n=== MIGRATION SUMMARY ===")
        self.stdout.write(f"Total Discovered: {total_discovered}")
        self.stdout.write(self.style.SUCCESS(f"Successfully Uploaded: {total_uploaded}"))
        self.stdout.write(self.style.WARNING(f"Skipped (Already in Storage): {total_skipped}"))
        if total_failed > 0:
            self.stdout.write(self.style.ERROR(f"Failed Files: {total_failed}"))
            for fpath, reason in failed_files:
                self.stdout.write(self.style.ERROR(f"  - {safe_str(fpath)}: {safe_str(reason)}"))
        else:
            self.stdout.write(self.style.SUCCESS("Failed Files: 0"))
        self.stdout.write("==========================")
