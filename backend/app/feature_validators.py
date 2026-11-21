"""
Validators bổ sung cho file bài nộp đồ án.

Owned by Agent 1 (Backend & API).
Tách ra khỏi views_features.py để có thể tái sử dụng và test độc lập.
"""
import io
import os
import re
import zipfile

from rest_framework import serializers

# Giới hạn kích thước giải nén khi đọc nội bộ docx/pptx (chống zip-bomb)
ZIP_UNCOMPRESSED_LIMIT = 50 * 1024 * 1024  # 50 MB


# ---------------------------------------------------------------------------
# Các magic bytes cần kiểm tra
# ---------------------------------------------------------------------------
_MAGIC_RULES = {
    ".pdf": (b"%PDF", "Tệp PDF không đúng định dạng (thiếu header %PDF)."),
    ".docx": (b"PK", "Tệp DOCX không đúng định dạng (phải có header PK)."),
    ".pptx": (b"PK", "Tệp PPTX không đúng định dạng (phải có header PK)."),
    ".zip": (b"PK", "Tệp ZIP không đúng định dạng (phải có header PK)."),
}

_BLOCKED_MAGIC = [
    (b"MZ", "Windows Executable (.exe/.dll)"),
    (b"\x7fELF", "Linux ELF Executable"),
    (b"\xca\xfe\xba\xbe", "Java Class / Mach-O Binary"),
    (b"\xfe\xed\xfa\xce", "Mach-O 32-bit"),
    (b"\xfe\xed\xfa\xcf", "Mach-O 64-bit"),
    (b"\xce\xfa\xed\xfe", "Mach-O Reverse Endian"),
    (b"\xcf\xfa\xed\xfe", "Mach-O 64-bit Reverse Endian"),
    (b"#!", "Shell Script"),
]

# Ký tự không được phép trong tên file (path traversal)
_PATH_UNSAFE_RE = re.compile(r"[/\\<>:\"'|?*\x00-\x1f]|\.{2,}")


def sanitize_filename(name: str) -> str:
    """Làm sạch tên file: loại bỏ path traversal, null bytes, ký tự đặc biệt.
    Giữ lại phần tên file sau dấu / hoặc \\ cuối cùng (phòng path injection).
    """
    if not name:
        return "upload"
    # Chỉ lấy phần base
    name = os.path.basename(name)
    # Thay null byte
    name = name.replace("\x00", "")
    # Thay ký tự không an toàn bằng dấu _
    name = _PATH_UNSAFE_RE.sub("_", name)
    # Rút gọn nhiều dấu _ liền nhau
    name = re.sub(r"_+", "_", name).strip("_")
    return name or "upload"


def _read_header(file_obj, n=512):
    try:
        file_obj.seek(0)
        header = file_obj.read(n)
        file_obj.seek(0)
        return header
    except Exception:
        return b""


def check_zip_bomb(file_obj, limit=ZIP_UNCOMPRESSED_LIMIT):
    """Đọc central directory của ZIP để kiểm tra kích thước giải nén tổng.
    Raise ValidationError nếu tổng > limit (mặc định 50 MB).
    Chỉ gọi với file .docx/.pptx/.zip.
    """
    try:
        file_obj.seek(0)
        data = file_obj.read()
        file_obj.seek(0)
    except Exception:
        return
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            total = sum(info.file_size for info in zf.infolist())
        if total > limit:
            limit_mb = limit // (1024 * 1024)
            raise serializers.ValidationError(
                f"Tệp ZIP/DOCX/PPTX có kích thước giải nén ({total // (1024*1024)} MB) "
                f"vượt giới hạn an toàn ({limit_mb} MB). Vui lòng kiểm tra lại tệp."
            )
    except serializers.ValidationError:
        raise
    except Exception:
        # Nếu không phải ZIP hợp lệ sẽ bị bắt ở bước magic bytes
        pass


def validate_submission_file(uploaded, allowed_extensions=None, max_size_bytes=25 * 1024 * 1024):
    """Validate file bài nộp đồ án:
    1. Làm sạch tên file (path traversal).
    2. Kiểm tra extension.
    3. Kiểm tra kích thước.
    4. Kiểm tra magic bytes (blocked EXE/ELF; required PDF/ZIP headers).
    5. Zip-bomb guard cho .docx/.pptx/.zip.
    Trả về tên file đã sanitize.
    Raise rest_framework.serializers.ValidationError nếu không hợp lệ.
    """
    if not uploaded:
        raise serializers.ValidationError("Vui lòng chọn file.")

    # 1. Sanitize filename
    clean_name = sanitize_filename(uploaded.name or "")
    ext = os.path.splitext(clean_name)[1].lower()

    # 2. Extension check
    default_allowed = {".pdf", ".docx", ".pptx", ".zip", ".txt", ".md"}
    allowed = set(e.lower() for e in (allowed_extensions or default_allowed))
    if ext not in allowed:
        raise serializers.ValidationError(
            f"Định dạng '{ext}' không được chấp nhận. Cho phép: {', '.join(sorted(allowed))}"
        )

    # 3. Size check
    size = getattr(uploaded, "size", None)
    if size is not None and size > max_size_bytes:
        raise serializers.ValidationError(
            f"Kích thước tệp ({size // (1024*1024)} MB) vượt giới hạn "
            f"{max_size_bytes // (1024*1024)} MB."
        )

    # 4. Magic bytes
    header = _read_header(uploaded, 512)
    if header:
        for sig, desc in _BLOCKED_MAGIC:
            if header.startswith(sig):
                raise serializers.ValidationError(
                    f"Tệp bị từ chối: phát hiện nhị phân thực thi ({desc})."
                )
        rule = _MAGIC_RULES.get(ext)
        if rule:
            expected_magic, msg = rule
            if not header.startswith(expected_magic):
                raise serializers.ValidationError(msg)

    # 5. Zip-bomb guard
    if ext in (".docx", ".pptx", ".zip"):
        check_zip_bomb(uploaded)

    return clean_name
