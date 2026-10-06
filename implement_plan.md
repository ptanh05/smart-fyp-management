# KẾ HOẠCH TRIỂN KHAI VÀ ĐIỀU CHỈNH HỆ THỐNG QUẢN LÝ ĐỒ ÁN TỐT NGHIỆP
## Chuẩn hóa theo Quy trình Nghiệp vụ 6 Giai đoạn & Nhánh Bảo lưu

> **Mã tài liệu:** `IMPLEMENT_PLAN_UTC_FYP_2026`  
> **Dự án:** `smart-fyp-management` (User Web Portal & Backend API)  
> **Phạm vi dự án:** Cổng thông tin người dùng (Sinh viên, Giảng viên hướng dẫn, GV Phản biện, Hội đồng bảo vệ) và Backend API kết nối cơ sở dữ liệu chung Neon PostgreSQL.  
> **Lưu ý phạm vi:** Các chức năng thuộc Web Admin riêng của Khoa/Phòng Đào tạo (như UI tạo đợt, UI import Excel SV, UI xếp lịch...) không làm giao diện ở repo này, nhưng **Backend API và Data Models** ở dự án này sẽ cung cấp đầy đủ để phục vụ cả hai bên.

---

## MỤC LỤC
1. [Đối chiếu Hiện trạng & Sơ đồ Nghiệp vụ](#1-đối-chiếu-hiện-trạng--sơ-đồ-nghiệp-vụ)
2. [Phân định Ranh giới Hệ thống](#2-phân-định-ranh-giới-hệ-thống)
3. [Kế hoạch Triển khai Chi tiết (Action Plan)](#3-kế-hoạch-triển-khai-chi-tiết-action-plan)
   - [Bước 1: Nâng cấp Data Models & Database Migrations](#bước-1-nâng-cấp-data-models--database-migrations)
   - [Bước 2: Phát triển Business Logic & Thuật toán Tối ưu Phân công](#bước-2-phát-triển-business-logic--thuật-toán-tối-ưu-phân-công)
   - [Bước 3: Xây dựng & Hoàn thiện RESTful API Endpoints](#bước-3-xây-dựng--hoàn-thiện-restful-api-endpoints)
   - [Bước 4: Cập nhật Giao diện User Web Portal](#bước-4-cập-nhật-giao-diện-user-web-portal)
   - [Bước 5: Kiểm thử & Đảm bảo Chất lượng](#bước-5-kiểm-thử--đảm-bảo-chất-lượng)
4. [Lộ trình Triển khai (Milestones & Checklist)](#4-lộ-trình-triển-khai-milestones--checklist)

---

## 1. ĐỐI CHIẾU HIỆN TRẠNG & SƠ ĐỒ NGHIỆP VỤ

### 1.1 Bảng Tổng hợp Mức độ Đáp ứng

| Giai đoạn | Tên Giai đoạn / Nghiệp vụ | Hiện trạng trong Codebase | Đánh giá | Mức đáp ứng |
| :--- | :--- | :--- | :---: | :---: |
| **GĐ 1** | Khởi tạo đợt đồ án & Thiết lập dữ liệu | Đã có `AcademicBatch`, `CourseClass`, `Supervisor`, `Student`. Chưa chuẩn hóa rõ trường `degree_program` (Kỹ sư vs Cử nhân). | 🟡 Khá | 70% |
| **GĐ 2** | Sinh viên chọn hướng, NV1-NV3 & Hệ thống phân công | Mới có 1 nguyện vọng duy nhất (`preferred_supervisor`). Thiếu chọn NV1-NV3; thiếu kiểm tra học vị GV với SV Kỹ sư; thiếu thuật toán tối ưu Hard/Soft constraints. | 🔴 Thiếu nhiều | 30% |
| **GĐ 3** | Công bố & Xây dựng đề tài (Draft $\rightarrow$ Duyệt $\rightarrow$ PDF) | Nhảy cóc thẳng lên nộp file đề cương; thiếu bước thảo luận đề tài Draft; thiếu phân quyền Khoa duyệt đề tài; thiếu sinh PDF đề cương chuẩn. | 🟡 Một phần | 50% |
| **GĐ 4** | Xét điều kiện làm đồ án & Nút Force Approve | Hoàn toàn chưa có cổng kiểm tra điều kiện học vụ đầu vào và nút Force Approve. | 🔴 Chưa có | 10% |
| **GĐ 5** | Thực hiện đồ án (Task, Nộp, GV Review, Đạt/Sửa) | Đã có `SupervisionTask`, Kanban, Báo cáo tuần. Thiếu nộp file kết quả task và nút GV đánh giá Đạt / Yêu cầu sửa task. | 🟡 Khá | 70% |
| **GĐ 6** | Xét bảo vệ, Hội đồng 1CT-2TK-2UV, Chấm điểm & Biên bản | Đã có chấm điểm Live Defense, tính điểm UTC tự động. Thiếu kiểm tra cơ cấu 1CT-2TK-2UV; thiếu xuất PDF Biên bản HĐ và xuất dữ liệu cuối kỳ. | 🟡 Khá | 65% |
| **Nhánh bảo lưu** | Rẽ nhánh Bảo lưu $\rightarrow$ Đơn $\rightarrow$ Khoa duyệt $\rightarrow$ Hồ sơ | Đã có status `DEFERRED` nhưng thiếu hẳn Model Đơn bảo lưu, API nộp đơn và luồng rẽ nhánh bảo lưu. | 🔴 Chưa có | 15% |

---

### 1.2 Chi tiết Khoảng cách (Gap Analysis) từng Giai đoạn

#### Giai đoạn 1: Khởi tạo đợt đồ án và thiết lập dữ liệu
* **Quy chuẩn nghiệp vụ**:
  - Bắt đầu $\rightarrow$ Khoa tạo đợt đồ án.
  - Chọn chương trình đào tạo (CT) (Nút quyết định): Cử nhân hoặc Kỹ sư. Cả hai nhánh đều đi tiếp đến bước import.
  - Import danh sách sinh viên $\rightarrow$ Phân loại SV theo ngành và chương trình đào tạo.
  - Thiết lập quan hệ Khoa – Bộ môn – Giảng viên – Sinh viên $\rightarrow$ Cập nhật hướng nghiên cứu và học vị của giảng viên.
  - SV đăng nhập hệ thống.
* **Khoảng cách cần xử lý**:
  - Bổ sung trường phân loại `degree_program` (`BACHELOR` / `ENGINEER`) vào `Student` và `CourseClass`.
  - Cập nhật liên kết hướng nghiên cứu chuẩn UTC (`ProjectTopicArea`) với thông tin Giảng viên (`Supervisor`).

#### Giai đoạn 2: Sinh viên chọn hướng, nguyện vọng và hệ thống phân công
* **Quy chuẩn nghiệp vụ**:
  - SV chọn hướng đồ án $\rightarrow$ Hệ thống hiển thị danh sách GV phù hợp với hướng đã chọn.
  - SV chọn nguyện vọng NV1 – NV3 kèm các tiêu chí phụ.
  - **Nút quyết định: SV có thuộc CT Kỹ sư không?**
    + *Có*: Chuyển sang kiểm tra học vị GV tối thiểu (Yêu cầu TS trở lên).
      - Đạt: Đi tiếp đến bước tính capacity.
      - Không đạt: Quay lại bước chọn NV1 – NV3.
    + *Không (Cử nhân)*: Đi thẳng đến bước tính capacity (chấp nhận ThS trở lên).
  - Tính capacity của GV theo hệ số.
  - Tối ưu hóa theo ràng buộc cứng (hard constraints) và ràng buộc mềm (soft constraints).
  - Hệ thống đề xuất phân công $\rightarrow$ Khoa review / override $\rightarrow$ Khoa chốt phân công.
* **Khoảng cách cần xử lý**:
  - Nâng cấp `InternshipInfo` hỗ trợ `preference_1`, `preference_2`, `preference_3` và các tiêu chí phụ.
  - Xây dựng bộ lọc hiển thị GV theo đúng hướng nghiên cứu đã chọn trên UI và API.
  - Viết logic kiểm tra học vị tối thiểu của GV khi SV thuộc CT Kỹ sư.
  - Phát triển thuật toán tối ưu phân công (Matching Optimization Algorithm: Hard/Soft constraints).
  - Thêm bảng lưu đề xuất phân công tạm thời `ProposedAllocation` phục vụ Khoa review/override trước khi chốt.

#### Giai đoạn 3: Công bố và xây dựng đề tài
* **Quy chuẩn nghiệp vụ**:
  - Công bố và gửi email kết quả phân công $\rightarrow$ Cập nhật nhóm, danh sách, lịch sử.
  - GV và SV cùng xác định đề tài (trạng thái `Draft`).
  - GV xác nhận đề tài.
  - **Nút quyết định: Khoa/Ban duyệt đề tài?**
    + *Không*: Hệ thống yêu cầu sửa đề tài $\rightarrow$ Quay lại `Draft`.
    + *Có*: Đề tài chuyển sang trạng thái `Approved`.
  - Hệ thống sinh đề cương và file PDF $\rightarrow$ SV ký nộp, Khoa lưu hồ sơ $\rightarrow$ Import điểm/danh sách xét điều kiện.
* **Khoảng cách cần xử lý**:
  - Tách bạch trạng thái đề tài: `TOPIC_DRAFT` $\rightarrow$ `TOPIC_CONFIRMED_BY_SUPERVISOR` $\rightarrow$ `TOPIC_APPROVED` / `TOPIC_REVISION_REQUIRED`.
  - Bổ sung chức năng tự động sinh file PDF Đề cương chi tiết theo mẫu chuẩn UTC từ thông tin đã duyệt.
  - Thêm chức năng nộp lại bản đề cương đã ký (`signed_outline_file`).

#### Giai đoạn 4: Xét điều kiện làm đồ án
* **Quy chuẩn nghiệp vụ**:
  - **Nút quyết định: Đủ điều kiện làm ĐA?** (Kiểm tra CPA, tín chỉ nợ, môn tiên quyết).
    + *Đủ*: Đi đến Giai đoạn 5 (Làm đồ án).
    + *Không đủ*: Chuyển sang nút xét Force Approve.
  - **Nút quyết định: Force approve?**
    + *Có*: Khoa duyệt đặc cách $\rightarrow$ Đi tiếp sang Giai đoạn 5.
    + *Không*: Loại khỏi đợt đồ án (`DISQUALIFIED`).
* **Khoảng cách cần xử lý**:
  - Bổ sung các tiêu chí điều kiện học vụ vào `Student` và `GraduationProject`.
  - Xây dựng cổng kiểm tra điều kiện học vụ trước khi cho phép bắt đầu đồ án.
  - Cung cấp API `force-approve` dành cho Khoa duyệt đặc cách.

#### Giai đoạn 5: Thực hiện đồ án
* **Quy chuẩn nghiệp vụ**:
  - Bắt đầu thực hiện đồ án (`IN_PROGRESS`).
  - Tạo task, deadline, comment $\rightarrow$ SV nhận task và làm.
  - SV submit kết quả.
  - GV review kết quả.
  - **Nút quyết định: Đánh giá Đạt?**
    + *Không*: Yêu cầu sửa task $\rightarrow$ SV làm lại, nộp lại.
    + *Có*: Hoàn thành task / project $\rightarrow$ Chuyển sang Giai đoạn 6.
* **Khoảng cách cần xử lý**:
  - Bổ sung trường upload file kết quả nộp bài (`deliverable_file`) và link sản phẩm trong `SupervisionTask`.
  - Bổ sung trạng thái đánh giá trên Task: `ACCEPTED` (Đạt) và `REVISION_REQUIRED` (Yêu cầu sửa lại) kèm nhận xét của GVHD.
  - Cập nhật giao diện Task Board của SV và GV để thao tác nộp bài và đánh giá trực tiếp.

#### Giai đoạn 6: Xét bảo vệ, bảo lưu và kết thúc & Nhánh bảo lưu
* **Quy chuẩn nghiệp vụ**:
  - **Nút quyết định 1: GV xác nhận đủ khả năng bảo vệ?**
    + *Không*: Chuyển sang nút "Bảo lưu?" (Bước 43).
    + *Có*: Đi tiếp.
  - Hệ thống kiểm tra điều kiện học vụ cuối $\rightarrow$ **Nút quyết định 2: Đủ điều kiện học vụ?**
    + *Không*: Chuyển sang nút "Bảo lưu?" (Bước 43).
    + *Có*: Đi tiếp $\rightarrow$ Đủ điều kiện bảo vệ (`DEFENSE_READY`).
  - Thành lập hội đồng: Tạo hội đồng gồm **1 Chủ tịch, 2 Thư ký, 2 Ủy viên (1CT-2TK-2UV)**.
  - Phân công: Gán SV và phản biện, cân bằng tải.
  - Xếp lịch: Khoa nhập tham số lịch $\rightarrow$ Hệ thống xếp lịch bảo vệ.
  - Bảo vệ: GV/Hội đồng nhập điểm và nhận xét $\rightarrow$ Tổng hợp điểm, Hội đồng xác nhận.
  - Biên bản: Xuất biên bản PDF, ký, lưu.
  - Xuất cuối kỳ: Xuất dữ liệu cuối kỳ (ký) $\rightarrow$ Kết thúc đợt đồ án.
* **Nhánh bảo lưu (Bước 43)**:
  - **Nút quyết định: Bảo lưu?**
    + *Có*: Tạo đơn bảo lưu $\rightarrow$ Khoa duyệt $\rightarrow$ Lưu hồ sơ $\rightarrow$ Đi thẳng đến "Xuất dữ liệu cuối kỳ (ký)" $\rightarrow$ Kết thúc đợt.
    + *Không*: Loại khỏi đợt đồ án (`FAILED` / `DISQUALIFIED`).
* **Khoảng cách cần xử lý**:
  - Xây dựng luồng rẽ nhánh: Khi GV không cho bảo vệ hoặc SV nợ môn học vụ cuối $\rightarrow$ Tự động mở form Đơn xin bảo lưu đồ án.
  - Bổ sung Model `ThesisDeferralRequest` và API nộp / xét duyệt đơn bảo lưu.
  - Thêm ràng buộc kiểm tra cơ cấu Hội đồng bảo vệ chuẩn **1CT - 2TK - 2UV** (5 thành viên).
  - Bổ sung API sinh Biên bản họp Hội đồng bảo vệ dạng PDF theo chuẩn biểu mẫu UTC.
  - Bổ sung API xuất toàn bộ bảng điểm tốt nghiệp cuối kỳ ra file Excel/PDF.

---

## 2. PHÂN ĐỊNH RANH GIỚI HỆ THỐNG

| Nghiệp vụ | Dự án này (`smart-fyp-management`) | Web Admin riêng (Khoa/PĐT) |
| :--- | :---: | :---: |
| **Model & Database** | Chịu trách nhiệm thiết kế, tạo migration, quản lý toàn bộ cấu trúc DB chung trên Neon Postgres. | Sử dụng chung database / models từ Backend. |
| **Đăng nhập & RBAC** | Cổng SV, GV, Ủy viên HĐ (JWT token, HttpOnly refresh cookie). | Cổng Admin / Trưởng bộ môn / Quản trị viên Khoa. |
| **Khảo sát & Chọn NV1-NV3** | Giao diện SV chọn hướng, chọn NV1-NV3 kèm validator học vị Kỹ sư. | Xem thống kê số lượng SV đăng ký theo ngành/hướng. |
| **Thuật toán Phân công** | Backend Service tính toán tối ưu theo Hard/Soft constraints. | Giao diện bấm chạy thuật toán, xem đề xuất, chỉnh sửa override và bấm Chốt. |
| **Đề tài Draft & Đề cương PDF** | Giao diện SV/GV cùng thống nhất đề tài Draft; Tải PDF đề cương tự động sinh; Nộp bản scan đã ký. | Giao diện Khoa bấm "Duyệt đề tài" hoặc "Yêu cầu chỉnh sửa". |
| **Xét điều kiện làm ĐA** | Backend API kiểm tra điều kiện học vụ đầu vào; Hiển thị thông báo trạng thái cho SV. | Giao diện import điểm tích lũy & bấm nút "Force Approve" (Duyệt đặc cách). |
| **Thực hiện Đồ án (Task Board)** | Giao diện Kanban cho SV nộp kết quả task (file/link); Giao diện GV đánh giá Đạt / Yêu cầu sửa. | Báo cáo tiến độ tổng quan toàn khoa. |
| **Xét bảo vệ & Hội đồng** | Giao diện GV đánh giá đủ/không đủ điều kiện bảo vệ; Giao diện HĐ Live Defense chấm điểm trực tiếp 4 tiêu chí UTC; Tải Biên bản PDF. | Giao diện tạo HĐ (chuẩn 1CT-2TK-2UV), xếp lịch bảo vệ phòng/giờ, gán GV phản biện. |
| **Đơn bảo lưu** | Giao diện SV nộp Đơn xin bảo lưu đồ án (kèm file minh chứng) khi không đủ điều kiện bảo vệ. | Giao diện Khoa xem xét và bấm "Duyệt bảo lưu" hoặc "Loại khỏi đợt". |

---

## 3. KẾ HOẠCH TRIỂN KHAI CHI TIẾT (ACTION PLAN)

### Bước 1: Nâng cấp Data Models & Database Migrations
**Tệp chỉnh sửa:** `backend/app/models.py`

1. **Chuẩn hóa Chương trình Đào tạo (`Student` & `CourseClass`)**:
   ```python
   # app/models.py
   class DegreeProgram(models.TextChoices):
       BACHELOR = "BACHELOR", "Cử nhân"
       ENGINEER = "ENGINEER", "Kỹ sư"

   # Thêm vào Student:
   degree_program = models.CharField(
       max_length=20, choices=DegreeProgram.choices, default=DegreeProgram.BACHELOR
   )
   cpa = models.FloatField(default=0.0, help_text="Điểm trung bình tích lũy thang 4")
   credits_accumulated = models.IntegerField(default=0, help_text="Số tín chỉ đã tích lũy")
   is_eligible_for_thesis = models.BooleanField(default=True, help_text="Đủ điều kiện làm ĐA")
   ```

2. **Nâng cấp Đăng ký Nguyện vọng (`InternshipInfo`)**:
   ```python
   # Thêm vào InternshipInfo:
   preference_1 = models.ForeignKey(
       Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="pref1_students"
   )
   preference_2 = models.ForeignKey(
       Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="pref2_students"
   )
   preference_3 = models.ForeignKey(
       Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="pref3_students"
   )
   secondary_criteria_note = models.TextField(blank=True, null=True, help_text="Tiêu chí phụ / Định hướng công nghệ")
   ```

3. **Tạo Model Đề xuất Phân công (`ProposedAllocation`)**:
   ```python
   class ProposedAllocation(models.Model):
       batch = models.ForeignKey(AcademicBatch, on_delete=models.CASCADE, related_name="proposed_allocations")
       student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="proposed_assignments")
       supervisor = models.ForeignKey(Supervisor, on_delete=models.CASCADE, related_name="proposed_students")
       matched_preference = models.IntegerField(default=1, help_text="Khớp NV1 (1), NV2 (2), NV3 (3) hoặc Hệ thống gán (0)")
       match_score = models.FloatField(default=0.0)
       is_overridden = models.BooleanField(default=False)
       override_reason = models.CharField(max_length=255, blank=True, null=True)
       created_at = models.DateTimeField(auto_now_add=True)
   ```

4. **Nâng cấp Vòng đời Đề tài (`GraduationProject`)**:
   ```python
   # Bổ sung trạng thái:
   STATUS_CHOICES = (
       ("ALLOCATED", "Đã phân công GVHD"),
       ("TOPIC_DRAFT", "Đang xây dựng đề tài (Draft)"),
       ("TOPIC_CONFIRMED", "GV đã xác nhận đề tài"),
       ("TOPIC_REVISION", "Khoa yêu cầu sửa đề tài"),
       ("TOPIC_APPROVED", "Đề tài đã duyệt"),
       ("ELIGIBILITY_CHECK_PENDING", "Chờ xét điều kiện làm ĐA"),
       ("IN_PROGRESS", "Đang thực hiện đồ án"),
       ("DEFENSE_READY", "Đủ điều kiện bảo vệ"),
       ("DEFENDING", "Đang bảo vệ"),
       ("PASSED", "Bảo vệ thành công"),
       ("FAILED", "Không đạt"),
       ("DEFERRED", "Bảo lưu đồ án"),
       ("DISQUALIFIED", "Loại khỏi đợt đồ án"),
   )
   is_force_approved = models.BooleanField(default=False, help_text="Khoa duyệt đặc cách cho làm ĐA")
   academic_clearance_status = models.CharField(
       max_length=20,
       choices=(("PENDING", "Chờ kiểm tra"), ("CLEARED", "Đạt điều kiện"), ("NOT_CLEARED", "Chưa đạt")),
       default="CLEARED"
   )
   signed_outline_file = models.FileField(upload_to="signed_outlines/", null=True, blank=True)
   ```

5. **Nâng cấp Quản lý Nhiệm vụ (`SupervisionTask`)**:
   ```python
   # Thêm vào SupervisionTask:
   deliverable_file = models.FileField(upload_to="task_deliverables/", null=True, blank=True)
   deliverable_url = models.URLField(max_length=500, blank=True, null=True)
   review_verdict = models.CharField(
       max_length=20,
       choices=(("PENDING", "Chờ đánh giá"), ("ACCEPTED", "Đạt"), ("REVISION_REQUIRED", "Yêu cầu làm lại")),
       default="PENDING"
   )
   supervisor_review_notes = models.TextField(blank=True, null=True)
   reviewed_at = models.DateTimeField(null=True, blank=True)
   ```

6. **Tạo Model Đơn Bảo lưu (`ThesisDeferralRequest`)**:
   ```python
   class ThesisDeferralRequest(models.Model):
       STATUS_CHOICES = (
           ("PENDING", "Chờ Khoa duyệt"),
           ("APPROVED", "Đã duyệt bảo lưu"),
           ("REJECTED", "Không chấp nhận / Loại khỏi đợt"),
       )
       project = models.ForeignKey(GraduationProject, on_delete=models.CASCADE, related_name="deferral_requests")
       student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="deferral_requests")
       reason = models.TextField(help_text="Lý do xin bảo lưu đồ án")
       evidence_file = models.FileField(upload_to="deferral_evidence/", null=True, blank=True)
       status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
       admin_notes = models.TextField(blank=True, null=True)
       submitted_at = models.DateTimeField(auto_now_add=True)
       reviewed_at = models.DateTimeField(null=True, blank=True)
       reviewed_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL)
   ```

---

### Bước 2: Phát triển Business Logic & Thuật toán Tối ưu Phân công
**Tệp chỉnh sửa:** `backend/app/services.py`

1. **Validation Học vị Giảng viên theo CTĐT Kỹ sư**:
   - `validate_supervisor_degree_for_student(student, supervisor)`:
     + Nếu `student.degree_program == 'ENGINEER'`: Kiểm tra `supervisor.academic_title`. Nếu title là `ThS` hoặc `KS` $\rightarrow$ ném ngoại lệ validation lỗi: *"Sinh viên chương trình Kỹ sư bắt buộc chọn GVHD có học vị Tiến sĩ (TS, PGS, GS) trở lên. Thầy/Cô {name} ({title}) không thỏa mãn điều kiện."*
     + Nếu `student.degree_program == 'BACHELOR'`: Chấp nhận ThS, TS, PGS, GS.
2. **Thuật toán Phân công Tối ưu Nguyện vọng (Matching Optimization Engine)**:
   - Viết Service class `ThesisAllocationService`:
     + **Ràng buộc cứng (Hard Constraints)**:
       * Tổng SV gán cho mỗi GV không vượt quá `max_total_quota` trong `SupervisorQuota`.
       * Ràng buộc học vị TS đối với SV Kỹ sư.
       * Mỗi SV chỉ được gán tối đa 1 GV.
     + **Ràng buộc mềm (Soft Constraints)**:
       * Ưu tiên nguyện vọng: NV1 (+100 điểm), NV2 (+70 điểm), NV3 (+40 điểm).
       * Cân bằng tải phân bổ giữa các giảng viên trong cùng bộ môn.
       * Tiêu chí phụ: Ưu tiên điểm tích lũy CPA khi xảy ra cạnh tranh cùng nguyện vọng.
     + Ghi dữ liệu vào bảng `ProposedAllocation` để Khoa review.
3. **Logic Xét điều kiện làm đồ án (Giai đoạn 4)**:
   - `check_student_thesis_eligibility(student)`:
     + Kiểm tra CPA $\ge 2.0$, không bị cảnh cáo học vụ, tích lũy đủ số tín chỉ quy định.
     + Nếu không đạt $\rightarrow$ Kiểm tra cờ `project.is_force_approved`. Nếu chưa có $\rightarrow$ Trạng thái thành `DISQUALIFIED`.
4. **Validation Cơ cấu Hội đồng Bảo vệ Chuẩn UTC**:
   - `validate_council_composition(council)`:
     + Kiểm tra tổng thành viên = 5.
     + Kiểm tra chính xác: 1 Chủ tịch (`CHAIR`), 2 Thư ký (`SECRETARY`), 2 Ủy viên (`MEMBER` hoặc `EXTERNAL_MEMBER`).
     + Ràng buộc độc lập: GVHD không được là thành viên chấm điểm cho SV của mình.

---

### Bước 3: Xây dựng & Hoàn thiện RESTful API Endpoints
**Tệp chỉnh sửa:** `backend/app/views_utc.py`, `backend/app/urls.py`, `backend/app/serializers/`

1. **Giai đoạn 2 - API Nguyện vọng & Phân công**:
   - `GET /app/student/survey/`: Trả về danh sách GV được lọc theo `topic_direction`, kèm thuộc tính `is_eligible_for_engineer`.
   - `POST /app/student/survey/`: Nhận và kiểm tra NV1, NV2, NV3 và tiêu chí phụ.
   - `POST /app/allocation/run-algorithm/`: Chạy thuật toán đề xuất phân công (Admin).
   - `GET /app/allocation/proposed-list/`: Xem danh sách phân công đề xuất (Admin).
   - `POST /app/allocation/override/`: Chỉnh sửa phân công thủ công (Admin).
   - `POST /app/allocation/finalize/`: Chốt phân công, sinh `GraduationProject` và gửi email hàng loạt qua `NotificationService.send_utc_html_email`.
2. **Giai đoạn 3 - API Xây dựng Đề tài & Sinh Đề cương PDF**:
   - `PATCH /app/graduation-project/topic-draft/`: SV hoặc GV cập nhật tên đề tài Draft.
   - `POST /app/graduation-project/confirm-topic/`: GV xác nhận đề tài gửi Khoa duyệt.
   - `POST /app/graduation-project/admin-approve-topic/`: Khoa duyệt đề tài hoặc yêu cầu sửa (quay lại Draft).
   - `GET /app/graduation-project/{id}/export-outline-pdf/`: Hệ thống tự động sinh biểu mẫu Đề cương Đồ án tốt nghiệp (PDF) chuẩn UTC.
   - `POST /app/graduation-project/{id}/upload-signed-outline/`: SV nộp file scan đề cương đã ký.
3. **Giai đoạn 4 - API Xét điều kiện làm đồ án**:
   - `POST /app/graduation-project/{id}/force-approve/`: Khoa duyệt đặc cách cho SV chưa đủ điều kiện học vụ tiếp tục làm đồ án.
4. **Giai đoạn 5 - API Nộp & Đánh giá Task**:
   - `POST /app/student/tasks/{id}/submit-result/`: SV upload file kết quả (`deliverable_file`) và link sản phẩm cho task.
   - `POST /app/supervisor/tasks/{id}/review/`: GV đánh giá task: Đạt (`ACCEPTED`) hoặc Yêu cầu làm lại (`REVISION_REQUIRED`) kèm nhận xét.
5. **Giai đoạn 6 & Nhánh Bảo lưu - API Xuất Biên bản & Đơn Bảo lưu**:
   - `GET /app/council/{id}/export-defense-minutes-pdf/`: Xuất Biên bản họp Hội đồng chấm bảo vệ khóa luận (PDF) chuẩn UTC (đầy đủ điểm số, nhận xét, cơ cấu 1CT-2TK-2UV).
   - `GET /app/batch/{id}/export-final-grades-excel/`: Xuất bảng điểm tổng kết toàn bộ đợt đồ án ra file Excel/PDF ký duyệt.
   - `POST /app/student/deferral-request/`: SV nộp đơn xin bảo lưu đồ án kèm file minh chứng.
   - `POST /app/admin/deferral-request/{id}/review/`: Khoa duyệt hoặc từ chối đơn bảo lưu.

---

### Bước 4: Cập nhật Giao diện User Web Portal
**Tệp chỉnh sửa:** `frontend/src/components/`

#### 1. Cổng Sinh viên (`UTCStudentGraduationView.tsx`)
- **Tab Đăng ký Nguyện vọng**:
  + Thêm dropdown chọn hướng nghiên cứu $\rightarrow$ danh sách GV tự động lọc tương ứng.
  + Thêm 3 ô chọn: NV1, NV2, NV3 với kiểm tra không chọn trùng.
  + Cảnh báo trực quan: Nếu SV thuộc CT Kỹ sư, hiển thị huy hiệu "Bắt buộc GV học vị TS trở lên", vô hiệu hóa hoặc cảnh báo nếu chọn ThS/KS.
- **Tab Đề tài**:
  + Hiển thị quy trình trạng thái: `Draft` (SV/GV trao đổi) $\rightarrow$ `GV đã duyệt` $\rightarrow$ `Khoa đã phê duyệt`.
  + Nút bấm: **"Tải Đề cương PDF tự động"** và form tải lên **"Bản scan đề cương có chữ ký"**.
- **Tab Task Board**:
  + Nút "Nộp kết quả nhiệm vụ": Modal tải lên file đính kèm/báo cáo và link commit/demo.
  + Hiển thị phản hồi từ GV: Huy hiệu "Đạt" (xanh lá) hoặc "Cần chỉnh sửa lại" (đỏ cam) kèm nhận xét của GV.
- **Modal Nộp Đơn Bảo lưu**:
  + Hiển thị tự động khi SV không đủ điều kiện bảo vệ hoặc chưa đạt điều kiện học vụ cuối: Nhập lý do, đính kèm minh chứng và gửi Khoa xem xét.

#### 2. Cổng Giảng viên (`UTCSupervisorGraduationView.tsx`)
- **Tab Thống nhất Đề tài**:
  + Xem tên đề tài Draft do SV đề xuất, chỉnh sửa tên tiếng Việt/tiếng Anh, mục tiêu.
  + Nút: **"Xác nhận đề tài (Gửi Khoa phê duyệt)"**.
- **Tab Nhiệm vụ**:
  + Xem kết quả nộp bài của SV (xem file đính kèm, link commit).
  + Nút đánh giá: **"Đạt (Hoàn thành)"** hoặc **"Yêu cầu làm lại"** kèm ô nhập nhận xét góp ý.
- **Tab Đánh giá Bảo vệ**:
  + Khi GV chọn "Không đủ khả năng bảo vệ" $\rightarrow$ Hiển thị thông báo hướng dẫn SV chuyển sang quy trình nộp đơn bảo lưu.

#### 3. Cổng Hội đồng Bảo vệ (`UTCCouncilLiveDefenseView.tsx`)
- Hiển thị đầy đủ cơ cấu chuẩn 5 thành viên (1 Chủ tịch, 2 Thư ký, 2 Ủy viên).
- Sau khi khóa điểm: Thêm nút **"Xuất Biên bản Bảo vệ Hội đồng (PDF)"** để Thư ký/Chủ tịch in ấn và ký nộp hồ sơ.

---

### Bước 5: Kiểm thử & Đảm bảo Chất lượng
**Tệp chỉnh sửa:** `backend/app/tests/`, `frontend/e2e/`

1. **Test Nút Quyết định Học vị Kỹ sư**:
   - `test_engineer_student_cannot_choose_master_supervisor()`: Kiểm tra trả về mã `400 Bad Request` khi SV Kỹ sư chọn GV có title `ThS`.
   - `test_bachelor_student_can_choose_master_supervisor()`: Cho phép hợp lệ đối với SV Cử nhân.
2. **Test Thuật toán Phân công Tối ưu**:
   - `test_allocation_respects_max_quota()`: Đảm bảo không có GV nào bị gán quá chỉ tiêu.
   - `test_allocation_optimizes_nv1_preferences()`: Đảm bảo tối đa hóa tỷ lệ SV đỗ NV1.
3. **Test Cổng Điều kiện Làm Đồ án & Force Approve**:
   - `test_ineligible_student_blocked()`: SV không đủ tín chỉ bị chuyển trạng thái `DISQUALIFIED`.
   - `test_force_approve_bypasses_check()`: Bật `is_force_approved=True` cho phép chuyển sang `IN_PROGRESS`.
4. **Test Đánh giá Task**:
   - `test_task_revision_required_reopens_task()`: Khi GV yêu cầu sửa, task chuyển sang `REVISION_REQUIRED` và tỷ lệ hoàn thành dự án được tính toán lại chính xác.
5. **Test Nhánh Bảo lưu**:
   - `test_deferral_request_flow()`: SV nộp đơn $\rightarrow$ Khoa duyệt $\rightarrow$ Trạng thái đồ án thành `DEFERRED`.
6. **Kiểm thử Hồi quy**:
   - Chạy toàn bộ 86 unit tests hiện có của backend và 69 tests của frontend đảm bảo không bị break tính năng cũ.

---

## 4. LỘ TRÌNH TRIỂN KHAI (MILESTONES & CHECKLIST)

```
[M1: Database Schema & Migrations] (Ưu tiên 1)
 ├── Thêm degree_program, gpa_cpa, credits_accumulated vào Student
 ├── Thêm preference_1, preference_2, preference_3 vào InternshipInfo
 ├── Tạo ProposedAllocation model
 ├── Bổ sung STATUS_CHOICES & is_force_approved vào GraduationProject
 ├── Bổ sung deliverable_file & review_verdict vào SupervisionTask
 └── Tạo ThesisDeferralRequest model

[M2: Backend Business Logic & Thuật toán] (Ưu tiên 2)
 ├── Viết validator học vị TS cho SV Kỹ sư
 ├── Viết ThesisAllocationService (Matching Optimization)
 ├── Viết hàm kiểm tra điều kiện làm ĐA & học vụ cuối
 └── Viết validator cơ cấu HĐ 1CT-2TK-2UV

[M3: Backend RESTful APIs & PDF Generators] (Ưu tiên 3)
 ├── Cập nhật Survey API nhận NV1-NV3
 ├── API chạy và finalize phân công
 ├── API sinh PDF Đề cương đồ án
 ├── API sinh PDF Biên bản họp Hội đồng
 ├── API nộp kết quả & đánh giá task
 └── API nộp & xét duyệt đơn bảo lưu

[M4: Cập nhật User Web Portal Frontend] (Ưu tiên 4)
 ├── UI SV chọn hướng, chọn NV1-NV3 kèm validator
 ├── UI Đề tài Draft & tải PDF đề cương
 ├── UI Nộp file task & xem phản hồi GV
 ├── UI GV xác nhận đề tài Draft
 ├── UI GV đánh giá task (Đạt / Yêu cầu sửa)
 ├── UI HĐ xuất biên bản bảo vệ PDF
 └── UI SV nộp đơn xin bảo lưu

[M5: Kiểm thử Toàn diện & Bàn giao] (Ưu tiên 5)
 ├── Viết Unit Tests cho các nút quyết định
 ├── Kiểm thử tích hợp luồng nghiệp vụ
 └── Bàn giao tài liệu API tích hợp cho Web Admin riêng
```
