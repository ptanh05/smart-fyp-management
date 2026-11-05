"""
Django Management Command: migrate_media_to_s3
Migrates local media files to persistent cloud object storage (Cloudflare R2 / AWS S3),
or restores files from cloud storage back to local disk for rollback/disaster recovery.
Strictly idempotent, non-destructive (never deletes source files).
"""
import os
import sys
import hashlib
from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files import File


def safe_str(val):
    """Safely format string for console output across Windows and POSIX."""
    if isinstance(val, bytes):
        val = val.decode("utf-8", errors="replace")
    val_str = str(val)
    try:
        encoding = getattr(sys.stdout, "encoding", "utf-8") or "utf-8"
        val_str.encode(encoding)
        return val_str
    except (UnicodeEncodeError, LookupError):
        return val_str.encode("ascii", errors="replace").decode("ascii")


def compute_file_sha256(filepath):
    """Compute SHA256 checksum of a local file."""
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


def compute_storage_sha256(storage, path):
    """Compute SHA256 checksum of a file directly from a Django storage backend."""
    sha = hashlib.sha256()
    with storage.open(path, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


def discover_cloud_media_files(storage):
    """
    Discover all media file paths stored in cloud/active storage by inspecting
    all Django models containing FileField/ImageField, as well as recursive
    storage.listdir() if supported by the storage backend.
    """
    discovered = set()

    # 1. Inspect all Django model FileFields
    try:
        from django.apps import apps
        from django.db import models
        for model in apps.get_models():
            file_fields = [
                f.name for f in model._meta.get_fields()
                if isinstance(f, (models.FileField, models.ImageField))
            ]
            if not file_fields:
                continue
            try:
                for instance in model.objects.all().only(*file_fields):
                    for fname in file_fields:
                        val = getattr(instance, fname)
                        if val and getattr(val, "name", None):
                            clean = str(val.name).replace("\\", "/").lstrip("/")
                            if clean:
                                discovered.add(clean)
            except Exception:
                pass
    except Exception:
        pass

    # 2. Try recursive listdir if supported by the storage backend
    def _walk_storage(prefix=""):
        try:
            dirs, files = storage.listdir(prefix)
            for f in files:
                p = f"{prefix}/{f}" if prefix else f
                discovered.add(p.replace("\\", "/").lstrip("/"))
            for d in dirs:
                # Exclude root self-loop or dots
                if d not in (".", ".."):
                    subprefix = f"{prefix}/{d}" if prefix else d
                    _walk_storage(subprefix)
        except Exception:
            pass

    _walk_storage("")
    return sorted(discovered)


class Command(BaseCommand):
    help = "Safely migrate media files between local disk and persistent cloud storage (Cloudflare R2 / AWS S3)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate migration without uploading or downloading any files.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Force overwrite existing destination files even if sizes match.",
        )
        parser.add_argument(
            "--verify-checksum",
            action="store_true",
            help="Verify SHA256 checksum on transferred files to guarantee byte-for-byte integrity.",
        )
        parser.add_argument(
            "--from-s3-to-local",
            action="store_true",
            dest="reverse",
            help="Rollback/restore mode: download files from cloud storage back to local MEDIA_ROOT.",
        )
        parser.add_argument(
            "--source-dir",
            type=str,
            default=None,
            help="Custom local source directory (defaults to settings.MEDIA_ROOT).",
        )
        parser.add_argument(
            "--dest-dir",
            type=str,
            default=None,
            help="Custom local destination directory for rollback mode (defaults to settings.MEDIA_ROOT).",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=1000,
            help="Maximum number of files to process in this run.",
        )

    def _resolve_cloud_storage(self):
        """
        Resolves the cloud storage backend (R2/S3).
        Decoupled from local filesystem storage to prevent self-referential collisions.
        """
        try:
            from storages.backends.s3boto3 import S3Boto3Storage
            if isinstance(default_storage, S3Boto3Storage):
                return default_storage
            from app.storage_backends import MediaStorage
            if getattr(settings, "AWS_STORAGE_BUCKET_NAME", None) and S3Boto3Storage:
                return MediaStorage()
        except Exception:
            pass
        return default_storage

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        overwrite = options["overwrite"]
        verify_checksum = options["verify_checksum"]
        reverse = options["reverse"]
        batch_size = options["batch_size"]

        if reverse:
            self._handle_reverse_migration(dry_run, overwrite, verify_checksum, batch_size, options)
        else:
            self._handle_forward_migration(dry_run, overwrite, verify_checksum, batch_size, options)

    def _handle_forward_migration(self, dry_run, overwrite, verify_checksum, batch_size, options):
        source_dir = options["source_dir"] or str(settings.MEDIA_ROOT)
        dest_storage = self._resolve_cloud_storage()

        self.stdout.write("=== SMART FYP MEDIA STORAGE MIGRATION (LOCAL -> CLOUD) ===")
        self.stdout.write(f"Source Directory: {safe_str(source_dir)}")
        self.stdout.write(f"Active Storage Backend: {dest_storage.__class__.__name__}")
        self.stdout.write(f"Dry Run Mode: {dry_run}")
        self.stdout.write(f"Overwrite Existing: {overwrite}")
        self.stdout.write(f"Verify Checksum: {verify_checksum}")

        if not os.path.exists(source_dir):
            self.stdout.write(self.style.WARNING(f"Source directory '{safe_str(source_dir)}' does not exist. Nothing to migrate."))
            return

        total_discovered = 0
        total_uploaded = 0
        total_skipped = 0
        total_verified = 0
        total_failed = 0
        failed_files = []

        # Collect local files from source directory
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
                    already_exists = False
                    try:
                        already_exists = dest_storage.exists(rel_path)
                    except Exception as e:
                        raise RuntimeError(f"Storage existence check failed: {e}")

                    if already_exists and not overwrite:
                        try:
                            remote_size = dest_storage.size(rel_path)
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
                        local_sha256 = compute_file_sha256(local_path) if verify_checksum else None

                        with open(local_path, "rb") as lf:
                            if already_exists and overwrite:
                                try:
                                    dest_storage.delete(rel_path)
                                except Exception:
                                    pass
                            saved_name = dest_storage.save(rel_path, File(lf))

                        if not dest_storage.exists(saved_name):
                            raise IOError(f"File '{saved_name}' could not be verified after save.")

                        if verify_checksum and local_sha256:
                            remote_sha256 = compute_storage_sha256(dest_storage, saved_name)
                            if remote_sha256 != local_sha256:
                                raise IOError(f"Checksum mismatch for '{saved_name}': expected {local_sha256}, got {remote_sha256}")
                            total_verified += 1

                        self.stdout.write(self.style.SUCCESS(f"[UPLOADED] '{safe_str(rel_path)}' -> '{safe_str(saved_name)}' ({local_size} bytes)"))
                        total_uploaded += 1

                except Exception as err:
                    self.stdout.write(self.style.ERROR(f"[FAILED] '{safe_str(rel_path)}': {safe_str(err)}"))
                    total_failed += 1
                    failed_files.append((rel_path, str(err)))

        self.stdout.write("\n=== MIGRATION SUMMARY ===")
        self.stdout.write(f"Total Discovered: {total_discovered}")
        self.stdout.write(self.style.SUCCESS(f"Successfully Uploaded: {total_uploaded}"))
        self.stdout.write(self.style.WARNING(f"Skipped (Already in Storage): {total_skipped}"))
        if verify_checksum:
            self.stdout.write(self.style.SUCCESS(f"Checksums Verified: {total_verified}"))
        if total_failed > 0:
            self.stdout.write(self.style.ERROR(f"Failed Files: {total_failed}"))
            for fpath, reason in failed_files:
                self.stdout.write(self.style.ERROR(f"  - {safe_str(fpath)}: {safe_str(reason)}"))
        else:
            self.stdout.write(self.style.SUCCESS("Failed Files: 0"))
        self.stdout.write("==========================")

    def _handle_reverse_migration(self, dry_run, overwrite, verify_checksum, batch_size, options):
        dest_dir = options["dest_dir"] or str(settings.MEDIA_ROOT)
        source_storage = self._resolve_cloud_storage()

        self.stdout.write("=== SMART FYP MEDIA STORAGE RESTORE (CLOUD -> LOCAL ROLLBACK) ===")
        self.stdout.write(f"Destination Directory: {safe_str(dest_dir)}")
        self.stdout.write(f"Active Storage Backend: {source_storage.__class__.__name__}")
        self.stdout.write(f"Dry Run Mode: {dry_run}")
        self.stdout.write(f"Overwrite Existing: {overwrite}")
        self.stdout.write(f"Verify Checksum: {verify_checksum}")

        os.makedirs(dest_dir, exist_ok=True)

        remote_files = discover_cloud_media_files(source_storage)
        total_discovered = 0
        total_downloaded = 0
        total_skipped = 0
        total_verified = 0
        total_failed = 0
        failed_files = []

        for rel_path in remote_files:
            total_discovered += 1
            if total_discovered > batch_size:
                self.stdout.write(self.style.WARNING(f"Reached batch limit of {batch_size} files. Stopping."))
                break

            local_path = os.path.join(dest_dir, rel_path.replace("/", os.sep))

            try:
                if not source_storage.exists(rel_path):
                    continue

                local_exists = os.path.exists(local_path)
                if local_exists and not overwrite:
                    try:
                        remote_size = source_storage.size(rel_path)
                        local_size = os.path.getsize(local_path)
                        if remote_size == local_size:
                            self.stdout.write(f"[SKIPPED] '{safe_str(rel_path)}' already exists locally ({local_size} bytes).")
                            total_skipped += 1
                            continue
                    except Exception:
                        self.stdout.write(f"[SKIPPED] '{safe_str(rel_path)}' already exists locally.")
                        total_skipped += 1
                        continue

                if dry_run:
                    self.stdout.write(self.style.SUCCESS(f"[DRY-RUN] Would download: '{safe_str(rel_path)}' -> '{safe_str(local_path)}'"))
                    total_downloaded += 1
                else:
                    os.makedirs(os.path.dirname(local_path), exist_ok=True)
                    with source_storage.open(rel_path, "rb") as rf, open(local_path, "wb") as lf:
                        while chunk := rf.read(65536):
                            lf.write(chunk)

                    if not os.path.exists(local_path):
                        raise IOError(f"Local file '{local_path}' could not be verified after download.")

                    if verify_checksum:
                        remote_sha256 = compute_storage_sha256(source_storage, rel_path)
                        local_sha256 = compute_file_sha256(local_path)
                        if remote_sha256 != local_sha256:
                            raise IOError(f"Checksum mismatch for '{rel_path}': remote {remote_sha256}, local {local_sha256}")
                        total_verified += 1

                    downloaded_size = os.path.getsize(local_path)
                    self.stdout.write(self.style.SUCCESS(f"[DOWNLOADED] '{safe_str(rel_path)}' -> '{safe_str(local_path)}' ({downloaded_size} bytes)"))
                    total_downloaded += 1

            except Exception as err:
                self.stdout.write(self.style.ERROR(f"[FAILED] '{safe_str(rel_path)}': {safe_str(err)}"))
                total_failed += 1
                failed_files.append((rel_path, str(err)))

        self.stdout.write("\n=== RESTORE SUMMARY ===")
        self.stdout.write(f"Total Discovered: {total_discovered}")
        self.stdout.write(self.style.SUCCESS(f"Successfully Downloaded: {total_downloaded}"))
        self.stdout.write(self.style.WARNING(f"Skipped (Already in Local Storage): {total_skipped}"))
        if verify_checksum:
            self.stdout.write(self.style.SUCCESS(f"Checksums Verified: {total_verified}"))
        if total_failed > 0:
            self.stdout.write(self.style.ERROR(f"Failed Files: {total_failed}"))
            for fpath, reason in failed_files:
                self.stdout.write(self.style.ERROR(f"  - {safe_str(fpath)}: {safe_str(reason)}"))
        else:
            self.stdout.write(self.style.SUCCESS("Failed Files: 0"))
        self.stdout.write("==========================")
