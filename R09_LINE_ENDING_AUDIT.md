# R-09 — Audit line ending (CRLF/LF) trước khi chuẩn hóa

- **Ngày:** 2026-11-21
- **Branch / HEAD:** `main` / `8063d89`
- **Loại:** Chỉ audit, chưa sửa file nào khi viết báo cáo này.

## 1. Cấu hình Git

| Mục | Giá trị | Nguồn |
|---|---|---|
| `core.autocrlf` | `true` | `C:/Program Files/Git/etc/gitconfig` (system). Không có override ở global hoặc local |
| `core.safecrlf` | chưa đặt | — |
| `core.eol` | chưa đặt | — |
| `.gitattributes` | **không có** ở repo, ở `frontend/` và ở thư mục cha | `git check-attr` không trả về thuộc tính nào |

Cấu hình **nhất quán**, chỉ có một nguồn duy nhất. Với `autocrlf=true`:
- Khi `git add`, Git chuyển CRLF thành LF, nên blob lưu trong repo **luôn là LF**.
- Khi checkout, Git ghi file ra dạng CRLF.

Toàn bộ 25 file đang sửa đều có `i/lf` (index và HEAD là LF).

## 2. Kết luận quan trọng: R-09 **không làm diff bị “toàn bộ file thay đổi”**

- `git diff --numstat` chỉ có số dòng thay đổi thật, ví dụ `api.ts` là `1 0` và `LoginPage.tsx` là `3 2`. Không file nào có diff toàn bộ.
- `git diff --check` trả về exit 0, không có lỗi whitespace.
- Lý do: với `autocrlf=true`, Git chuẩn hóa về LF trước khi so sánh và trước khi commit. Line ending trong working tree **không ảnh hưởng** tới nội dung commit.
- Cảnh báo `LF will be replaced by CRLF the next time Git touches it` chỉ có nghĩa là working tree hiện là LF, và lần checkout sau Git sẽ ghi lại thành CRLF.

> **Đính chính:** báo cáo trước (`FRONTEND_REMAINING_ISSUES.md`, R-09) viết rằng diff sẽ bị “toàn bộ file thay đổi”. Nhận định đó **không chính xác**. R-09 là vấn đề thẩm mỹ của working tree, không phải vấn đề của diff hay commit.

## 3. Trạng thái từng file

Cách xác định line ending **trước khi refactor**: so sánh kích thước file mà Git ghi trong index lúc checkout (`git ls-files --debug`) với kích thước blob HEAD (dạng LF) và với blob + số dòng (dạng CRLF).

| # | File | HEAD (blob) | Working tree **trước refactor** (bằng chứng) | Working tree **hiện tại** | Ai gây ra LF | Thay đổi nội dung thật (numstat) |
|---|---|---|---|---|---|---|
| 1 | `components/DocumentRequirementsManager.tsx` | LF | **CRLF** (index 15461 = CRLF 15461) | LF | **Đợt refactor** | +2 / −1 |
| 2 | `components/DocumentReview.tsx` | LF | **CRLF** (30050 = 30050) | LF | **Đợt refactor** | +10 / −9 |
| 3 | `components/SupervisorOfferedTopics.tsx` | LF | **CRLF** (20174 = 20174) | LF | **Đợt refactor** | +11 / −10 |
| 4 | `components/TemplatesList.tsx` | LF | **LF** (index 6648 = blob LF 6648) | LF | Có sẵn | +5 / −4 |
| 5 | `components/UTCSupervisorGroupChatView.tsx` | LF | **LF** (28946 = 28946) | LF | Có sẵn | +5 / −4 |
| 6 | `pages/LoginPage.tsx` | LF | **LF** (39527 = 39527) | LF | Có sẵn | +3 / −2 |
| 7 | `pages/StudentDashboard.tsx` | LF | **LF** (30675 = 30675) | LF | Có sẵn | +2 / −1 |
| 8 | `services/api.ts` | LF | **Hỗn hợp**: CRLF, có 11 dòng LF (index 55211 = CRLF 55222 − 11) | Hỗn hợp: 1449 CRLF, 11 LF (dòng 44–54, hàm `resolveApiBaseUrl`) | Có sẵn. Dòng mới thêm dùng CRLF | +1 / −0 |

**Không file nào chỉ thay đổi line ending.** Cả 8 file đều có thay đổi nội dung thật (thông báo tiếng Việt, `notifyError`, `confirmDialog`, `session_expired`), và các thay đổi đó phải được giữ nguyên.

Bối cảnh: các file trong `frontend/src` **không bị sửa** cũng đã lẫn lộn sẵn, gồm 45 file CRLF, 67 file LF và 1 file binary. Repo không có quy ước line ending cho working tree.

## 4. Phương án chuẩn hóa từng file

| Nhóm | File | Phương án | Lý do |
|---|---|---|---|
| **A — khôi phục** | #1, #2, #3 | Chuyển LF thành **CRLF** | Bằng chứng byte cho thấy trước refactor là CRLF. Đợt refactor đã vô tình đổi sang LF. Khôi phục đúng trạng thái cũ và khớp với `autocrlf=true` |
| **B — không xác định được, DỪNG** | #4, #5, #6, #7 | **Giữ nguyên LF**, chờ quyết định | Trước refactor đã là LF, nên refactor không đổi line ending của các file này. Chuyển sang CRLF là thay đổi *ngoài trạng thái gốc*. Repo không có `.gitattributes` để biết line ending mong muốn. Theo quy tắc của task, phải dừng và báo cáo |
| **C — giữ nguyên** | #8 `api.ts` | **Không sửa** | Trạng thái hỗn hợp có sẵn từ trước. 11 dòng LF nằm ở đoạn code refactor không chạm vào. Dòng thêm mới đã là CRLF. Chuẩn hóa sẽ động vào dòng ngoài phạm vi |

Kỹ thuật cho nhóm A:
- Đọc file dạng byte và chỉ thay các `\n` không có `\r` đứng trước thành `\r\n`.
- Không đổi encoding, không thêm hay bớt BOM, không format.
- Kiểm chứng bằng cách loại bỏ `\r` khỏi file sau khi sửa: kết quả phải trùng byte với file trước khi sửa. Đồng thời `git hash-object --path` (nội dung sau khi Git chuẩn hóa) phải **không đổi**.

## 5. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Làm mất thay đổi logic | Rất thấp | Chỉ thay byte `\n` thành `\r\n`. Kiểm tra normalized hash, `numstat` và hash của toàn bộ `git diff` trước và sau phải giống nhau |
| Đổi encoding hoặc BOM | Rất thấp | Xử lý ở mức byte, không decode |
| Chạm vào 4 file regression fix | Không | Không nằm trong danh sách. Kiểm tra lại sha256 sau khi sửa |
| Nhóm B vẫn còn cảnh báo `LF will be replaced by CRLF` | Thấp (chỉ thẩm mỹ) | Không ảnh hưởng commit. Cần người review quyết định |

## 6. File cần bảo toàn (snapshot trước khi sửa)

| File | sha256 (16 ký tự đầu) | normalized blob |
|---|---|---|
| `components/Toast.css` | `343a4ef55dddd5fc` | `7773c99c7f29` |
| `components/DialogHost.tsx` | `8fe34f8e66222ac1` | `f92cf530b01c` |
| `components/DialogHost.css` | `a10eaa96587dc542` | `96138e646c6a` |
| `components/__tests__/DialogHost.test.tsx` | `d748ee9806365ce8` | `4284f6f6a8ef` |

Hash của toàn bộ `git diff` trước khi sửa: `7808953fe8f84357`.
