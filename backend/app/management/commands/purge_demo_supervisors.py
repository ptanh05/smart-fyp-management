"""
Xóa (purge) các tài khoản giảng viên DEMO khỏi cơ sở dữ liệu dùng chung.

Mục tiêu:
  - Gỡ toàn bộ các tài khoản giảng viên demo (ts_thang, pgs_ha, ths_linh,
    supervisor1, gv_nguyenvana, gv_tranthib, gv_levanc, gv_phamminhd,
    gv_hoangvanh).
  - Trước khi xóa, mọi dòng dữ liệu đang tham chiếu tới các tài khoản demo
    (đồ án, phản biện, hội đồng, nhiệm vụ, thông báo...) được CHUYỂN sang
    giảng viên chính thức (UTC001..UTC033) phù hợp.
  - Lịch sử audit được giữ lại nhưng bỏ liên kết user (set NULL) - không gán
    sai người.

Cách dùng:
    python manage.py purge_demo_supervisors            # báo cáo + thực thi
    python manage.py purge_demo_supervisors --dry-run  # chỉ báo cáo, không ghi
    python manage.py purge_demo_supervisors --yes       # bỏ qua xác nhận

Lệnh là IDEMPOTENT: chạy lại nhiều lần vẫn an toàn (tài khoản demo đã xóa
thì bỏ qua, không báo lỗi).
"""

from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.models import Count

from app.models import (
    AcademicBatch,
    AcademicStaff,
    AuditLog,
    CouncilMember,
    CustomUser,
    GraduationProject,
    Notification,
    OutlineReview,
    Student,
    StudentPreference,
    Supervisor,
    SupervisorGroupChatMessage,
    SupervisorQuota,
    SupervisorTopicArea,
    SupervisionTask,
    ThesisDeferralRequest,
)

# ---------------------------------------------------------------------------
# Danh sách tài khoản demo cần xóa
# ---------------------------------------------------------------------------
DEMO_USERNAMES = [
    # Demo chips trên trang đăng nhập (frontend LoginPage.tsx)
    "ts_thang",
    "pgs_ha",
    "ths_linh",
    "supervisor1",
    # Demo supervisors do backend admin seed (seed_admin_data) tạo mỗi lần deploy
    "gv_nguyenvana",
    "gv_tranthib",
    "gv_levanc",
    "gv_phamminhd",
    "gv_hoangvanh",
    # Demo còn sót (dùng làm chip HĐ & giữ đồ án)
    "ts_nam",
    "ths_duc",
    "committee1",
    "gggg",
]

# Ánh xạ mã lĩnh vực của đồ án sang lĩnh vực mà giảng viên chính thức đảm nhiệm.
# Dùng khi đồ án có lĩnh vực mà không GV chính thức nào đảm nhiệm trực tiếp.
TOPIC_FALLBACK = {
    "WEB_CLOUD": "WEB_MOBILE",
    "MOBILE_APP": "WEB_MOBILE",
    "DATA_SCI": "AI_ML",
    "IOT_EMBED": "NETWORK_SYS",
    "SECURITY_CHAIN": "CYBER_SEC",
}

# Hệ số học vị & quota gợi ý - mirror seed_official_supervisors.py
TITLE_CONFIG = {
    "PGS.TS": {"multiplier": 1.5, "base_quota": 8},
    "TS": {"multiplier": 1.2, "base_quota": 6},
    "ThS": {"multiplier": 1.0, "base_quota": 5},
    "KS": {"multiplier": 0.8, "base_quota": 3},
}


def official_usernames():
    """Sinh danh sách username giảng viên chính thức từ seed command (nguồn chuẩn)."""
    from app.management.commands.seed_official_supervisors import (
        SUPERVISORS,
        slugify_username,
    )

    return [slugify_username(full_name) for _t, full_name, _topics in SUPERVISORS]


class Command(BaseCommand):
    help = "Gỡ tài khoản giảng viên demo, chuyển dữ liệu tham chiếu sang GV chính thức."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Chỉ in báo cáo kế hoạch, không thực hiện thay đổi nào trên DB.",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Không hỏi xác nhận trước khi thực thi.",
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _build_official_pool(self):
        """Trả về dict {supervisor_id: info} mô tả toàn bộ giảng viên chính thức."""
        usernames = official_usernames()
        pool = {}
        supervisors = (
            Supervisor.objects.filter(user__username__in=usernames)
            .select_related("user")
            .prefetch_related("topic_area_links", "quotas")
        )
        for supervisor in supervisors:
            pool[supervisor.pk] = {
                "supervisor": supervisor,
                "user": supervisor.user,
                "topics": {
                    link.topic_area.code for link in supervisor.topic_area_links.all()
                },
                "quota_batches": {q.batch_id for q in supervisor.quotas.all()},
            }
        return pool

    def _missing_quota(self, pool, batch_ids):
        """Trả về {batch_id: [supervisor_id...]} các GV chính thức còn thiếu quota."""
        missing = defaultdict(list)
        for batch_id in sorted(b for b in batch_ids if b is not None):
            try:
                batch = AcademicBatch.objects.get(pk=batch_id)
            except AcademicBatch.DoesNotExist:
                continue
            for sid, info in pool.items():
                if batch_id in info["quota_batches"]:
                    continue
                missing[batch_id].append((sid, info["supervisor"]))
            _ = batch
        return missing

    def _create_quota(self, pool, batch_id, supervisor):
        cfg = TITLE_CONFIG.get(
            supervisor.academic_title, {"multiplier": 1.0, "base_quota": 5}
        )
        batch = AcademicBatch.objects.get(pk=batch_id)
        quota = SupervisorQuota.objects.create(
            supervisor=supervisor,
            batch=batch,
            department=supervisor.department_name or "",
            base_quota=cfg["base_quota"],
            rank_multiplier=cfg["multiplier"],
            max_total_quota=int(round(cfg["base_quota"] * cfg["multiplier"])),
            current_assigned=0,
        )
        return quota

    def _pick(self, pool, batch_id, topic_code, load, exclude=()):
        """Chọn GV chính thức phù hợp nhất.

        Ưu tiên: (a) có lĩnh vực khớp đồ án, (b) có quota cho batch,
        (c) tải nhẹ nhất trong batch, (d) tie-break theo supervisor_id.
        """
        eligible = [
            info
            for sid, info in pool.items()
            if sid not in exclude
            and (batch_id is None or batch_id in info["quota_batches"])
        ]
        if not eligible:
            return None
        if topic_code:
            codes = {topic_code}
            if topic_code in TOPIC_FALLBACK:
                codes.add(TOPIC_FALLBACK[topic_code])
            matched = [i for i in eligible if i["topics"] & codes]
            if matched:
                eligible = matched
        eligible.sort(
            key=lambda i: (
                load.get((i["supervisor"].pk, batch_id), 0),
                i["supervisor"].supervisor_id,
            )
        )
        return eligible[0]

    # ------------------------------------------------------------------
    # Main
    # ------------------------------------------------------------------
    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        self.stdout.write("=" * 78)
        self.stdout.write("PURGE DEMO SUPERVISORS")
        self.stdout.write("=" * 78)

        demo_users = {
            u.username: u for u in CustomUser.objects.filter(username__in=DEMO_USERNAMES)
        }
        if not demo_users:
            self.stdout.write(
                self.style.SUCCESS(
                    "✔ Không còn tài khoản giảng viên demo nào trong DB. Không làm gì."
                )
            )
            return

        demo_user_ids = [u.id for u in demo_users.values()]
        demo_supervisors = list(
            Supervisor.objects.filter(user_id__in=demo_user_ids).select_related("user")
        )
        demo_sup_ids = [s.pk for s in demo_supervisors]
        self.stdout.write(
            f"Tài khoản demo tìm thấy: {len(demo_users)} user / "
            f"{len(demo_supervisors)} hồ sơ GV"
        )

        pool = self._build_official_pool()
        if not pool:
            self.stdout.write(self.style.ERROR("✖ Không tìm thấy GV chính thức nào!"))
            return
        self.stdout.write(f"GV chính thức khả dụng: {len(pool)}")

        # Batches có dự án đang do GV demo phụ trách
        demo_projects = list(
            GraduationProject.objects.filter(supervisor_id__in=demo_sup_ids).select_related(
                "batch", "topic_category"
            )
        )
        needed_batches = {p.batch_id for p in demo_projects}
        missing_quota = self._missing_quota(pool, needed_batches)
        for batch_id, entries in sorted(missing_quota.items()):
            self.stdout.write(
                f"  + Sẽ tạo quota batch {batch_id} cho {len(entries)} GV chính thức"
            )
        # Cho phép chọn GV ở các batch sắp được tạo quota (dự kiến trong cùng
        # transaction) - nếu không thì không GV nào "đủ tư cách" nhận đồ án.
        for batch_id, entries in missing_quota.items():
            for sid, _supervisor in entries:
                pool[sid]["quota_batches"].add(batch_id)

        # Load hiện tại theo (supervisor, batch)
        load = defaultdict(int)
        for row in GraduationProject.objects.values("supervisor_id", "batch_id").annotate(
            n=Count("id")
        ):
            load[(row["supervisor_id"], row["batch_id"])] = row["n"]

        report = defaultdict(lambda: defaultdict(int))
        assign_plan = {}

        # --------------------------------------------------------------
        # 1. Đồ án (supervisor + reviewer + force_approved_by)
        # --------------------------------------------------------------
        for project in demo_projects:
            old = project.supervisor
            topic_code = project.topic_category.code if project.topic_category_id else None
            chosen = self._pick(pool, project.batch_id, topic_code, load)
            if chosen is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"  ! Đồ án #{project.id}: không tìm được GV chính thức, giữ nguyên."
                    )
                )
                continue
            target = chosen["supervisor"]
            assign_plan[project.pk] = target
            load[(target.pk, project.batch_id)] += 1
            report[old.user.username]["app_graduationproject.supervisor"] += 1
            report[old.user.username][f"  -> {target.supervisor_id}"] += 1

            if project.reviewer_id in demo_sup_ids:
                rev = self._pick(
                    pool, project.batch_id, topic_code, load, exclude={target.pk}
                )
                if rev is not None:
                    project.reviewer_id = rev["supervisor"].pk
                    report[old.user.username]["app_graduationproject.reviewer"] += 1
                else:
                    project.reviewer_id = None
                    report[old.user.username]["app_graduationproject.reviewer -> NULL"] += 1

            if project.force_approved_by_id in demo_user_ids:
                project.force_approved_by_id = chosen["user"].id
                report[old.user.username]["app_graduationproject.force_approved_by"] += 1

            project.supervisor_id = target.pk

        # --------------------------------------------------------------
        # 2. Hội đồng bảo vệ (CouncilMember)
        # --------------------------------------------------------------
        council_members = list(
            CouncilMember.objects.filter(user_id__in=demo_user_ids).select_related(
                "council", "supervisor"
            )
        )
        used_in_council = defaultdict(set)
        for cm in CouncilMember.objects.filter(
            council_id__in={cm.council_id for cm in council_members}
        ):
            if cm.supervisor_id:
                used_in_council[cm.council_id].add(cm.supervisor_id)

        for cm in council_members:
            old_user = demo_users.get(cm.user.username)
            batch_id = cm.council.batch_id if cm.council_id else None
            chosen = self._pick(
                pool, batch_id, None, defaultdict(int),
                exclude=used_in_council[cm.council_id],
            )
            if chosen is None:
                chosen = self._pick(
                    pool, None, None, defaultdict(int),
                    exclude=used_in_council[cm.council_id],
                )
            if chosen is None:
                continue
            cm.user_id = chosen["user"].id
            cm.supervisor_id = chosen["supervisor"].pk
            used_in_council[cm.council_id].add(chosen["supervisor"].pk)
            key = old_user.username if old_user else f"user_id={cm.user_id}"
            report[key]["app_councilmember (user+supervisor)"] += 1

        # --------------------------------------------------------------
        # 3. Nhiệm vụ (SupervisionTask.assigned_by)
        # --------------------------------------------------------------
        tasks = list(
            SupervisionTask.objects.filter(assigned_by_id__in=demo_sup_ids).select_related(
                "project", "project__topic_category"
            )
        )
        for task in tasks:
            old = task.assigned_by
            topic_code = (
                task.project.topic_category.code if task.project.topic_category_id else None
            )
            chosen = self._pick(pool, task.project.batch_id, topic_code, load)
            if chosen is None:
                continue
            task.assigned_by_id = chosen["supervisor"].pk
            report[old.user.username]["app_supervisiontask.assigned_by"] += 1

        # --------------------------------------------------------------
        # 4. Duyệt đề cương (OutlineReview.reviewer) + M2M group members
        # --------------------------------------------------------------
        reviews = list(
            OutlineReview.objects.filter(reviewer_id__in=demo_sup_ids).select_related(
                "project", "project__topic_category"
            )
        )
        for rev in reviews:
            old = rev.reviewer
            topic_code = (
                rev.project.topic_category.code if rev.project.topic_category_id else None
            )
            chosen = self._pick(pool, rev.project.batch_id, topic_code, load)
            if chosen is None:
                rev.reviewer_id = None
                report[old.user.username]["app_outlinereview.reviewer -> NULL"] += 1
                continue
            rev.reviewer_id = chosen["supervisor"].pk
            report[old.user.username]["app_outlinereview.reviewer"] += 1

        with connection.cursor() as cur:
            cur.execute(
                "SELECT id, supervisor_id FROM app_outlinereviewgroup_members "
                "WHERE supervisor_id = ANY(%s)",
                [demo_sup_ids],
            )
            group_member_rows = cur.fetchall()

        for gm_id, old_sid in group_member_rows:
            old = Supervisor.objects.filter(pk=old_sid).first()
            chosen = self._pick(pool, None, None, defaultdict(int))
            if chosen is None:
                continue
            with connection.cursor() as cur:
                cur.execute(
                    "UPDATE app_outlinereviewgroup_members SET supervisor_id = %s WHERE id = %s",
                    [chosen["supervisor"].pk, gm_id],
                )
            if old is not None:
                report[old.user.username]["app_outlinereviewgroup_members"] += 1

        # --------------------------------------------------------------
        # 5. Tin nhắn nhóm GV (supervisor + sender)
        # --------------------------------------------------------------
        chats = list(
            SupervisorGroupChatMessage.objects.filter(
                supervisor_id__in=demo_sup_ids
            ).select_related("supervisor")
        )
        for msg in chats:
            old = msg.supervisor
            chosen = self._pick(pool, None, None, defaultdict(int))
            if chosen is None:
                continue
            msg.supervisor_id = chosen["supervisor"].pk
            msg.sender_id = chosen["user"].id
            report[old.user.username]["app_supervisorgroupchatmessage"] += 1

        # --------------------------------------------------------------
        # 6. Nguyện vọng GV của sinh viên (preference_1/2/3)
        # --------------------------------------------------------------
        pref_ids = set(
            StudentPreference.objects.filter(
                preference_1_id__in=demo_sup_ids
            ).values_list("pk", flat=True)
        )
        pref_ids |= set(
            StudentPreference.objects.filter(
                preference_2_id__in=demo_sup_ids
            ).values_list("pk", flat=True)
        )
        pref_ids |= set(
            StudentPreference.objects.filter(
                preference_3_id__in=demo_sup_ids
            ).values_list("pk", flat=True)
        )
        prefs = list(
            StudentPreference.objects.filter(pk__in=pref_ids).select_related(
                "batch", "topic_direction"
            )
        )
        for pref in prefs:
            topic_code = pref.topic_direction.code if pref.topic_direction_id else None
            for field in ("preference_1", "preference_2", "preference_3"):
                old_sid = getattr(pref, f"{field}_id")
                if old_sid not in demo_sup_ids:
                    continue
                old = Supervisor.objects.filter(pk=old_sid).first()
                chosen = self._pick(pool, pref.batch_id, topic_code, load)
                if chosen is None:
                    setattr(pref, f"{field}_id", None)
                    if old is not None:
                        report[old.user.username][f"app_studentpreference.{field} -> NULL"] += 1
                else:
                    setattr(pref, f"{field}_id", chosen["supervisor"].pk)
                    if old is not None:
                        report[old.user.username][f"app_studentpreference.{field}"] += 1

        # --------------------------------------------------------------
        # 7. Thông báo (Notification.user -> NOT NULL)
        # --------------------------------------------------------------
        notifications = list(
            Notification.objects.filter(user_id__in=demo_user_ids).select_related("user")
        )
        for notif in notifications:
            old = notif.user
            chosen = self._pick(pool, None, None, defaultdict(int))
            if chosen is None:
                continue
            notif.user_id = chosen["user"].id
            report[old.username]["app_notification.user"] += 1

        # --------------------------------------------------------------
        # 8. Audit log (user nullable -> set NULL, không gán sai người)
        # --------------------------------------------------------------
        audit_logs = list(
            AuditLog.objects.filter(user_id__in=demo_user_ids).select_related("user")
        )
        for log in audit_logs:
            report[log.user.username]["app_auditlog.user -> NULL"] += 1
            log.user_id = None

        # --------------------------------------------------------------
        # 9. Đơn bảo lưu (reviewed_by nullable)
        # --------------------------------------------------------------
        deferrals = list(
            ThesisDeferralRequest.objects.filter(
                reviewed_by_id__in=demo_user_ids
            ).select_related("student")
        )
        for d in deferrals:
            old = CustomUser.objects.filter(pk=d.reviewed_by_id).first()
            project = GraduationProject.objects.filter(student=d.student).first()
            target_user = None
            if project is not None and project.pk in assign_plan:
                target_user = assign_plan[project.pk].user
            d.reviewed_by_id = target_user.id if target_user else None
            if old is not None:
                report[old.username]["app_thesisdeferralrequest.reviewed_by"] += 1

        # --------------------------------------------------------------
        # 10. Kiểm tra hồ sơ liên quan (AcademicStaff / Student)
        # --------------------------------------------------------------
        staff_demo = list(AcademicStaff.objects.filter(user_id__in=demo_user_ids))
        student_demo = list(Student.objects.filter(user_id__in=demo_user_ids))
        for staff in staff_demo:
            report[staff.user.username]["app_academicstaff.user"] += 1
        for stu in student_demo:
            report[stu.user.username]["app_student.user"] += 1

        # --------------------------------------------------------------
        # BÁO CÁO KẾ HOẠCH
        # --------------------------------------------------------------
        self.stdout.write("")
        self.stdout.write("-" * 78)
        self.stdout.write("KẾ HOẠCH XÓA")
        self.stdout.write("-" * 78)
        for username in DEMO_USERNAMES:
            if username not in demo_users:
                continue
            self.stdout.write(f"\n  [{username}] (user_id={demo_users[username].id})")
            for key, count in sorted(report.get(username, {}).items()):
                self.stdout.write(f"      {key:<45} {count}")
            self.stdout.write(f"      {'XOA CustomUser + Supervisor':<45} 1")
        self.stdout.write("")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY-RUN: không có thay đổi nào được ghi."))
            return

        if not options["yes"]:
            answer = input("Xac nhan xoa? (yes/no): ").strip().lower()
            if answer not in ("y", "yes"):
                self.stdout.write(self.style.WARNING("Đã hủy."))
                return

        # --------------------------------------------------------------
        # GHI THAY ĐỔI (trong 1 transaction)
        # --------------------------------------------------------------
        with transaction.atomic():
            for batch_id, entries in sorted(missing_quota.items()):
                for _sid, supervisor in entries:
                    self._create_quota(pool, batch_id, supervisor)
                self.stdout.write(
                    f"  + Đã tạo quota batch {batch_id} cho {len(entries)} GV chính thức"
                )

            # LƯU Ý: phải dùng TÊN FIELD của model (vd. "supervisor"), KHÔNG dùng
            # attname ("supervisor_id"). GraduationProject.save() lọc update_fields
            # theo tên field; nếu truyền attname thì danh sách rỗng => Django bỏ qua
            # lần save => FK không được ghi => xóa Supervisor sẽ cascade mất đồ án.
            for project in demo_projects:
                project.save(update_fields=["supervisor", "reviewer", "force_approved_by"])
            for cm in council_members:
                cm.save(update_fields=["user", "supervisor"])
            for task in tasks:
                task.save(update_fields=["assigned_by"])
            for rev in reviews:
                rev.save(update_fields=["reviewer"])
            for msg in chats:
                msg.save(update_fields=["supervisor", "sender"])
            for pref in prefs:
                pref.save(update_fields=["preference_1", "preference_2", "preference_3"])
            for notif in notifications:
                notif.save(update_fields=["user"])
            for log in audit_logs:
                log.save(update_fields=["user"])
            for d in deferrals:
                d.save(update_fields=["reviewed_by"])

            # Quota + topic area của GV demo bị xóa
            quota_del, _ = SupervisorQuota.objects.filter(
                supervisor_id__in=demo_sup_ids
            ).delete()
            topic_del, _ = SupervisorTopicArea.objects.filter(
                supervisor_id__in=demo_sup_ids
            ).delete()
            self.stdout.write(
                f"  - Xóa {quota_del} SupervisorQuota, {topic_del} SupervisorTopicArea của GV demo"
            )

            # Lưới an toàn: sau khi reassign, KHÔNG được còn dòng nào trong
            # app_graduationproject.app_supervisor_id trỏ tới GV demo.
            # Nếu còn (do save bị bỏ qua), tuyệt đối KHÔNG xóa hồ sơ GV demo
            # vì Django sẽ cascade xóa luôn đồ án -> mất dữ liệu sinh viên.
            leftover = list(
                GraduationProject.objects.filter(supervisor_id__in=demo_sup_ids).values_list(
                    "id", flat=True
                )
            )
            if leftover:
                self.stdout.write(
                    self.style.ERROR(
                        f"  ✖ Vẫn còn {len(leftover)} đồ án trỏ tới GV demo "
                        f"(id: {leftover[:10]}). DỪNG - không xóa GV demo để tránh mất đồ án."
                    )
                )
                raise SystemExit(1)

            # Xóa hồ sơ GV demo (đã reassign mọi tham chiếu trước đó)
            sup_deleted = Supervisor.objects.filter(pk__in=demo_sup_ids).delete()
            self.stdout.write(f"  - Xóa {sup_deleted[0]} hồ sơ Supervisor demo")

            # Dọn token / group / permission / admin log của user demo
            with connection.cursor() as cur:
                # token_blacklist_blacklistedtoken là con của outstandingtoken
                # (FK NO ACTION) -> phải xóa trước.
                cur.execute(
                    "DELETE FROM token_blacklist_blacklistedtoken WHERE token_id IN "
                    "(SELECT id FROM token_blacklist_outstandingtoken WHERE user_id = ANY(%s))",
                    [demo_user_ids],
                )
                blk = cur.rowcount
                cur.execute(
                    "DELETE FROM token_blacklist_outstandingtoken WHERE user_id = ANY(%s)",
                    [demo_user_ids],
                )
                tok = cur.rowcount
                cur.execute(
                    "DELETE FROM app_customuser_groups WHERE customuser_id = ANY(%s)",
                    [demo_user_ids],
                )
                grp = cur.rowcount
                cur.execute(
                    "DELETE FROM app_customuser_user_permissions WHERE customuser_id = ANY(%s)",
                    [demo_user_ids],
                )
                perm = cur.rowcount
                cur.execute(
                    "DELETE FROM django_admin_log WHERE user_id = ANY(%s)",
                    [demo_user_ids],
                )
                adm = cur.rowcount
            self.stdout.write(
                f"  - Xóa {blk} blacklistedtoken, {tok} token, {grp} group, "
                f"{perm} permission, {adm} admin log của user demo"
            )

            # Xóa user demo
            user_deleted = CustomUser.objects.filter(pk__in=demo_user_ids).delete()
            self.stdout.write(f"  - Xóa {user_deleted[0]} CustomUser demo")

            # Đồng bộ sequence
            with connection.cursor() as cur:
                cur.execute(
                    "SELECT setval(pg_get_serial_sequence('app_customuser','id'), "
                    "COALESCE((SELECT MAX(id) FROM app_customuser), 1))"
                )
                cur.execute(
                    "SELECT setval(pg_get_serial_sequence('app_supervisor','id'), "
                    "COALESCE((SELECT MAX(id) FROM app_supervisor), 1))"
                )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("✔ Hoàn tất purge tài khoản giảng viên demo."))
