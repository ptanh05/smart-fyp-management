# R-09 — Báo cáo xử lý line ending (CRLF/LF)

- **Ngày:** 2026-11-21
- **Branch / HEAD:** `main` / `8063d89`
- **Chưa commit hay push.** Không dùng `reset`, `checkout` hay `clean`. Không động vào backend, DB, `.env` hay `dist/`.
- Audit chi tiết: `R09_LINE_ENDING_AUDIT.md`.

## 1. Tóm tắt

- **Cảnh báo R-09 không làm diff bị “toàn bộ file thay đổi”.**
  - Repo dùng `core.autocrlf=true` (cấu hình system, không có `.gitattributes`).
  - Git chuẩn hóa về LF trước khi diff và commit, nên diff và nội dung commit **không phụ thuộc** vào line ending của working tree.
  - Nhận định “toàn bộ file thay đổi” trong `FRONTEND_REMAINING_ISSUES.md` là sai và đã được đính chính trong báo cáo audit.
- **3 file** bị đợt refactor vô tình đổi từ CRLF sang LF đã được **khôi phục về CRLF**.
- **4 file** đã là LF từ trước refactor, và **1 file** (`api.ts`) đã ở trạng thái hỗn hợp từ trước. Các file này **giữ nguyên** vì không xác định được line ending mong muốn, cần người review quyết định (mục 5).

## 2. Line ending trước và sau

| File | Trước refactor | Trước khi xử lý | **Sau khi xử lý** | Hành động |
|---|---|---|---|---|
| `components/DocumentRequirementsManager.tsx` | CRLF | LF | **CRLF** | Khôi phục |
| `components/DocumentReview.tsx` | CRLF | LF | **CRLF** | Khôi phục |
| `components/SupervisorOfferedTopics.tsx` | CRLF | LF | **CRLF** | Khôi phục |
| `components/TemplatesList.tsx` | LF | LF | LF | Giữ nguyên, chờ quyết định |
| `components/UTCSupervisorGroupChatView.tsx` | LF | LF | LF | Giữ nguyên, chờ quyết định |
| `pages/LoginPage.tsx` | LF | LF | LF | Giữ nguyên, chờ quyết định |
| `pages/StudentDashboard.tsx` | LF | LF | LF | Giữ nguyên, chờ quyết định |
| `services/api.ts` | Hỗn hợp (11 dòng LF) | Hỗn hợp (đúng 11 dòng LF như cũ) | Hỗn hợp | Giữ nguyên, vì trạng thái có sẵn và nằm ngoài phần code đã sửa |

Cách thực hiện cho 3 file khôi phục:
- Thay `\n` không có `\r` đứng trước thành `\r\n` ở mức byte. Kết quả: 399, 766 và 492 dòng CRLF; còn 0 dòng LF đơn.
- Không có BOM, không đổi encoding, không format.

## 3. Diff trước và sau

| Kiểm tra | Trước | Sau |
|---|---|---|
| `git status --short` | 25 file `M`, 7 file `??` | Giữ nguyên 25 file `M`. Thêm 1 file `??` là báo cáo `R09_LINE_ENDING_AUDIT.md` |
| `git diff --stat` | 25 files, +178 / −140 | **25 files, +178 / −140** |
| `git diff --numstat` | — | **Giống hệt từng dòng** |
| Hash của toàn bộ `git diff` | `7808953fe8f84357` | **`7808953fe8f84357`** (giống hệt) |
| `git diff --check` | exit 0 | exit 0 |
| Số cảnh báo `LF will be replaced by CRLF` | 8 file | **5 file** (4 file thuộc nhóm B và `api.ts`) |
| Normalized blob (`git hash-object --path`) của 8 file | — | **Không đổi**, nên thay đổi logic được bảo toàn 100% |

## 4. Bốn file regression fix

| File | sha256 trước | sha256 sau |
|---|---|---|
| `components/Toast.css` | `343a4ef55dddd5fc` | `343a4ef55dddd5fc` ✅ |
| `components/DialogHost.tsx` | `8fe34f8e66222ac1` | `8fe34f8e66222ac1` ✅ |
| `components/DialogHost.css` | `a10eaa96587dc542` | `a10eaa96587dc542` ✅ |
| `components/__tests__/DialogHost.test.tsx` | `d748ee9806365ce8` | `d748ee9806365ce8` ✅ |

Không bị chạm tới, trùng từng byte.

## 5. Kết quả kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| TypeScript (`tsc --noEmit`) | **PASS** |
| Vitest | **154/154 PASS** (14 file) |
| Production build (`vite build --outDir %TEMP%/uxverify-dist`) | **PASS** (1.78s). `dist/` không bị ghi, vẫn mang ngày 2026-11-15 |

## 6. Vấn đề còn tồn tại

1. **Cảnh báo CRLF ở 5 file** (`TemplatesList.tsx`, `UTCSupervisorGroupChatView.tsx`, `LoginPage.tsx`, `StudentDashboard.tsx`, `api.ts`).
   - Line ending của các file này là trạng thái có sẵn trước refactor, không phải do refactor.
   - Chỉ ảnh hưởng thẩm mỹ của working tree, **không ảnh hưởng nội dung commit**.
   - Muốn hết cảnh báo, cần chọn **một** trong hai cách:
     - **(a) Chuyển 5 file sang CRLF**, khớp với cách `autocrlf=true` checkout.
     - **(b) Thêm `.gitattributes`** (ví dụ `* text=auto eol=lf`) để thống nhất cả repo. Cách này thay đổi cấu hình Git, có thể kéo theo nhiều file khác, và nên thống nhất với nhóm.
   - Cả hai đều nằm ngoài quyền tự quyết của task này.
2. **Working tree của repo vốn đã lẫn lộn.** Trong các file `frontend/src` không bị sửa có 45 file CRLF và 67 file LF. Nguyên nhân gốc là repo không có `.gitattributes`.
3. **File mới** `DialogHost.tsx`, `DialogHost.test.tsx`, `notify.ts`, `notify.test.ts` dùng LF. Khi `git add`, Git sẽ cảnh báo tương tự, nhưng blob vẫn được lưu dạng LF. Không ảnh hưởng nội dung commit.
4. Mục R-09 trong `FRONTEND_REMAINING_ISSUES.md` vẫn ghi nhận định cũ (diff “toàn bộ file thay đổi”). Đã đính chính tại `R09_LINE_ENDING_AUDIT.md`, mục 2. Chưa sửa file cũ vì nằm ngoài phạm vi task.

## 7. Kết luận

**Đủ điều kiện chuẩn bị commit.**
- Diff sạch: chỉ còn 178 dòng thêm và 140 dòng xóa có nội dung thật, không có thay đổi giả do line ending.
- Toàn bộ thay đổi logic và 4 file regression fix được bảo toàn.
- TypeScript, unit test và build đều PASS.

Các cảnh báo CRLF còn lại chỉ ảnh hưởng thẩm mỹ của working tree. Có thể commit ngay, hoặc xử lý trước theo phương án (a) hay (b) ở mục 6 tùy quyết định của người review.
