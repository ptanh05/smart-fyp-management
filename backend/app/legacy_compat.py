"""
Helper cho các bảng "legacy" (model `managed = False`) mà KHÔNG tồn tại trên
production Neon PostgreSQL.

Bối cảnh
---------
Một số model legacy trong `app/legacy_models.py` được khai báo `Meta.managed = False`
(vd: `ProjectCategories`, `Group`, `Document`, `SupervisorOfStudentGroup`). Vì vậy
Django KHÔNG bao giờ tạo các bảng `app_projectcategories`, `app_group`,
`app_document`, `app_supervisorofstudentgroup` trên Neon, và các bảng này thực tế
KHÔNG tồn tại trên DB production.

Các trường `ForeignKey`/`ManyToManyField` trỏ tới những model đó được khai báo
với `db_constraint=False` để `manage.py migrate` không bị lỗi
`relation "app_xxx" does not exist` khi build trên Render.

Hệ quả: các đường đi runtime đọc những quan hệ này sẽ ném
`django.db.utils.ProgrammingError` (relation does not exist) nếu bảng đích không có
trong DB. Module này cung cấp helper để các đường đi đó "fail-safe" (trả về giá trị
rỗng) thay vì làm sập API 500.
"""
from django.db import connection

# Cache theo connection hiện tại: tên bảng -> tồn tại hay không.
# Neon dùng connection pool nên cache sống suốt tiến trình là an toàn
# (schema không đổi trong lúc server chạy).
_TABLE_EXISTS_CACHE: dict = {}


def legacy_table_exists(table_name: str) -> bool:
    """
    Kiểm tra bảng có tồn tại trong DB hiện tại hay không (an toàn cho cả
    PostgreSQL lẫn SQLite).

    Trả về False nếu có bất kỳ lỗi nào khi truy vấn (VD: thiếu quyền), để
    caller có thể fallback về hành vi "coi như bảng không tồn tại".
    """
    if not table_name:
        return False

    cache_key = (connection.alias, table_name)
    cached = _TABLE_EXISTS_CACHE.get(cache_key)
    if cached is not None:
        return cached

    exists = False
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = %s",
                [table_name],
            )
            exists = cursor.fetchone() is not None
    except Exception:
        # SQLite (unit test) không có information_schema -> dùng sqlite_master.
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=%s",
                    [table_name],
                )
                exists = cursor.fetchone() is not None
        except Exception:
            exists = False

    _TABLE_EXISTS_CACHE[cache_key] = exists
    return exists


def reset_cache() -> None:
    """Xoá cache (dùng cho test)."""
    _TABLE_EXISTS_CACHE.clear()


def safe_legacy_values(manager, values_list_field: str) -> list:
    """
    Đọc an toàn từ một queryset của model legacy.

    - Nếu bảng đích không tồn tại -> trả về list rỗng.
    - Nếu có lỗi DB bất kỳ -> trả về list rỗng thay vì làm sập request.

    Args:
        manager: queryset/manager của model legacy (vd: `supervisor.category`).
        values_list_field: tên field cần lấy (vd: `"category_name"`).
    """
    try:
        model = manager.model
        table_name = model._meta.db_table
        if not legacy_table_exists(table_name):
            return []
        return list(manager.values_list(values_list_field, flat=True))
    except Exception:
        return []
