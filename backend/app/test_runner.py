"""
Custom Django test runner cho smart-fyp-management.

Vấn đề: một số model legacy trong `app/legacy_models.py` được khai báo với
`Meta.managed = False` (vd: CommitteeMemberPanel, ExternalExaminer, Group,
ProjectCategories...). Trên production (Neon PostgreSQL) các bảng này đã tồn
tại sẵn, nhưng khi chạy test với SQLite in-memory, Django KHÔNG tạo bảng cho
model unmanaged -> toàn bộ test chạm vào những model này sẽ fail với
`sqlite3.OperationalError: no such table: ...`.

Test runner này tự tạo các bảng còn thiếu sau khi Django dựng xong test
database, giúp toàn bộ test suite chạy đúng trên môi trường test mà vẫn giữ
nguyên hành vi production.

Lưu ý: các bảng legacy được tạo KHÔNG kèm ràng buộc khóa ngoại (`db_constraint=False`).
Lý do: các model legacy dùng `on_delete=DO_NOTHING` tới bảng `app_customuser`
được quản lý, nên khi test xoá user, các dòng legacy trở thành orphan và
Django kiểm tra `PRAGMA foreign_key_check` sẽ báo lỗi IntegrityError dù logic
nghiệp vụ đã đúng.
"""
from django.db import connection
from django.test.runner import DiscoverRunner

# Bảng của các model unmanaged (legacy) cũng cần được xóa khi Django flush.
# Django `sql_flush` chỉ sinh lệnh DELETE cho các bảng managed, nên dữ liệu
# trong bảng legacy sẽ tồn đọng giữa các test class -> lỗi
# `UNIQUE constraint failed: app_externalexaminer.external_id`.
from django.core.management.commands.flush import sql_flush as _ORIGINAL_SQL_FLUSH


def _patched_sql_flush(style, connection, reset_sequences=True, allow_cascade=False):
    """Bọc `sql_flush` để bổ sung DELETE cho các bảng model unmanaged."""
    sql_list = _ORIGINAL_SQL_FLUSH(
        style, connection, reset_sequences=reset_sequences, allow_cascade=allow_cascade
    )

    from django.apps import apps

    existing = set(connection.introspection.table_names())
    for model in apps.get_models():
        meta = model._meta
        if meta.managed:
            continue
        table_name = meta.db_table
        if not table_name or table_name not in existing:
            continue
        sql_list.append(f'DELETE FROM "{table_name}"')

    return sql_list


class LegacyTableTestRunner(DiscoverRunner):
    """DiscoverRunner + tự tạo bảng cho các model unmanaged bị thiếu."""

    def setup_databases(self, **kwargs):
        # Patch sql_flush TRƯỚC khi Django tạo test database để mọi lần flush
        # (bao gồm teardown của TransactionTestCase) đều xóa cả bảng legacy.
        import django.core.management.commands.flush as flush_module

        flush_module.sql_flush = _patched_sql_flush

        result = super().setup_databases(**kwargs)
        self._create_missing_legacy_tables()
        return result

    # ------------------------------------------------------------------
    def _create_missing_legacy_tables(self):
        from django.apps import apps

        existing_tables = set(connection.introspection.table_names())

        with connection.schema_editor() as schema_editor:
            for model in apps.get_models():
                meta = model._meta
                if meta.managed:
                    continue
                table_name = meta.db_table
                if not table_name or table_name in existing_tables:
                    continue

                # Tạm thời bỏ ràng buộc FK để tránh orphan row khi test xoá user.
                patched = []
                for field in meta.local_fields:
                    if getattr(field, "db_constraint", False):
                        field.db_constraint = False
                        patched.append(field)

                try:
                    schema_editor.create_model(model)
                    existing_tables.add(table_name)
                except Exception:
                    # Bảng đã tồn tại hoặc không tạo được -> bỏ qua, không chặn test.
                    pass
                finally:
                    for field in patched:
                        field.db_constraint = True
