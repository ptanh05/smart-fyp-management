"""
Automated Database Backup Runner for Smart FYP Management.
Can be invoked via OS cron job (Linux/macOS) or Windows Task Scheduler.
Usage:
    python scripts/run_backup.py [--keep-days 7] [--no-compress]
"""
import os
import sys
import argparse
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Set up paths and Django environment
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

import django
django.setup()

from django.core.management import call_command


def main():
    parser = argparse.ArgumentParser(description="Automated Database Backup Runner for Smart FYP Management")
    parser.add_argument("--keep-days", type=int, default=7, help="Number of days to keep old backups (default: 7)")
    parser.add_argument("--no-compress", action="store_true", help="Do not gzip compress backup")
    parser.add_argument("--dest", type=str, default=None, help="Destination directory for backups")
    args = parser.parse_args()

    print(f"[*] Starting Smart FYP database backup (keep-days={args.keep_days})...")
    kwargs = {
        "keep_days": args.keep_days,
        "no_compress": args.no_compress,
    }
    if args.dest:
        kwargs["dest"] = args.dest

    try:
        call_command("backup_database", **kwargs)
        print("[OK] Smart FYP database backup completed successfully!")
        sys.exit(0)
    except Exception as exc:
        print(f"[ERROR] Database backup failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
