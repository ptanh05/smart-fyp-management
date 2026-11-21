# Báo cáo kiểm tra sau refactor UX — Frontend ThesisHub / Smart FYP UTC

- **Ngày kiểm tra:** 2026-11-21
- **Phạm vi:** Toast, DialogHost / `confirmDialog` / `promptDialog`, `getErrorMessage` / `notifyError`, thông báo hết phiên, hồi quy hiển thị.
- **Loại nhiệm vụ:** CHỈ KIỂM TRA — không sửa code, không commit, không chạm backend/DB.

**Tổng kết:** Kiểm tra kỹ thuật **PASS toàn bộ**. Manual UI test: **33 PASS / 3 FAIL thật / 1 FAIL do sai ngưỡng kiểm tra (đã phân tích lại thành PASS)**. Hồi quy với dữ liệu thật: **BLOCKED** (không có backend an toàn). Phát hiện **3 lỗi mới do refactor** (1 mức Cao) và một số vấn đề có sẵn — chi tiết ở `FRONTEND_REMAINING_ISSUES.md`.

> **Cập nhật:** R-01, R-02 và R-03 **đã được sửa và kiểm tra lại**: 154/154 unit test PASS, build PASS, UI test liên quan PASS. Xem **mục 7**.

---

## 0. Trạng thái repo trước khi kiểm tra

| Mục | Giá trị |
|---|---|
| Branch | `main` |
| HEAD | `8063d89e0a565da5565866a8fd4b5e364efa2f42` |
| Thay đổi chưa commit | 24 file `M`, 4 file mới `??` (`notify.ts`, `DialogHost.tsx`, `DialogHost.css`, `notify.test.ts`) — 174 dòng thêm / 140 dòng xóa, đúng phạm vi refactor |
| Sau kiểm tra | `git status` giữ nguyên 28 mục; không file nào trong repo bị sửa ngoài 2 báo cáo này |

Ghi chú: Git cảnh báo LF → CRLF cho 8 file (do script refactor ghi LF vào file vốn CRLF). Không ảnh hưởng chạy, nhưng sẽ làm diff khi commit (xem Remaining Issues R-09).

---

## 1. Kiểm tra kỹ thuật (đã chạy thực tế)

| # | Kiểm tra | Lệnh | Kết quả | Bằng chứng |
|---|---|---|---|---|
| T1 | TypeScript | `npx tsc --noEmit -p .` | **PASS** | exit 0, không lỗi |
| T2 | Vitest toàn bộ | `npx vitest run` | **PASS** | 13 file, **141/141 test** pass (gồm 6 test mới của `notify.test.ts`) |
| T3 | Production build | `npx vite build --outDir %TEMP%/uxverify-dist` | **PASS** | `✓ built in 1.34s`, exit 0. Build ra thư mục tạm để không ghi đè `dist/` |
| T4 | ESLint | — | **BLOCKED** | Dự án không cài ESLint và không có file cấu hình (`.eslintrc*`, `eslint.config.*`) |
| T5 | Import/export `notify.ts`, `DialogHost.tsx` | tsc + grep | **PASS** | 22 file import `utils/notify`; `DialogHost` mount tại `App.tsx:114` trong `ToastProvider` |
| T6 | `alert/confirm/prompt` còn sót | grep (loại trừ `__tests__`) | **FAIL (1)** | `src/utils/modalHooks.ts:25` vẫn gọi `window.confirm` (guard “dữ liệu chưa lưu” của BugReportModal, ChangePasswordModal, DocumentViewerModal…) |
| T7 | Dùng `notifyError` / `getErrorMessage` | grep | **PASS (có ghi chú)** | 41 lời gọi `notifyError`; `getErrorMessage` chỉ được gọi gián tiếp qua `notifyError`. Còn khoảng 20 chỗ tự ghép `err.message` (xem R-05) |
| T8 | Nhánh hết phiên | đọc code + chạy UI (mục D) | **PASS** | `api.ts:161-163` đặt cờ `session_expired` trước khi chuyển trang; `ToastContext.tsx` đọc cờ, xóa cờ, hiện toast |

**Lưu ý môi trường:** Khi chạy vitest từ đường dẫn bắt đầu bằng `c:\` (chữ thường), cả 13 file báo *“No test suite found”*. Chạy từ `C:\` thì pass hết. Đây là lỗi của vitest/Windows, không liên quan code.

---

## 2. Phân loại kiểm thử

| Loại | Nội dung | Công cụ |
|---|---|---|
| **Unit Test** | `getErrorMessage` (400 detail/message, lỗi theo field, HTML 500, 403, Network Error, fallback), `confirmDialog` (sự kiện + resolve) | Vitest + jsdom — `src/utils/__tests__/notify.test.ts` |
| **Integration Test** | `apiService` thật (axios + interceptor) → response giả lập bằng Playwright route → `notifyError` → toast trên DOM. Luồng 401 → refresh → redirect chạy qua interceptor thật | Playwright + Microsoft Edge hệ thống, Vite dev `:5199` |
| **Manual UI Test (tự động hóa)** | Toast, dialog (bàn phím, focus, dark mode, mobile), click link trên LoginPage, smoke dashboard 4 vai trò | Playwright headless Edge; có ảnh chụp màn hình |
| **Manual UI Test với dữ liệu thật** | — | **BLOCKED** (xem mục 5) |

Môi trường UI: Microsoft Edge hệ thống (`channel: msedge`, không cài thêm trình duyệt), viewport 1280×800 và 375×667. **Mọi request tới `localhost:8000` / `onrender.com` đều bị chặn và trả dữ liệu giả lập**; ở smoke test, mọi request ghi (POST/PUT/PATCH/DELETE) đều bị trả 403. Không có request nào tới backend hay DB thật.

Script và ảnh nằm ngoài repo: `%TEMP%\uxfix\verify.cjs`, `compare.cjs`, `focuslost.cjs`, `results.json`, `compare.json`, `*.png`.

---

## 3. Kết quả Manual UI / Integration

### A. Toast

| ID | Kiểm tra | KQ | Bằng chứng |
|---|---|---|---|
| A1–A4 | 4 loại success / error / warning / info đúng class `toast-*` | **PASS** | `count=4, types=[true,true,true,true]` — ảnh `A_toasts.png` |
| A5 | Tự ẩn theo thời lượng | **PASS** | Sau 4.3 giây: success và info đã ẩn, còn error và warning |
| A5b | Toast error tự ẩn khoảng 6.5 giây | **PASS** | Sau 6.9 giây còn 0 toast |
| A6 | Nhiều toast liên tiếp | **PASS** | Gọi 4 toast liền nhau → 4 thẻ cùng hiển thị |
| A7 | Thông báo nhiều dòng (`\n`) | **FAIL** | `white-space=normal`; `"Dòng 1\n\nDòng 2"` hiển thị thành `"Dòng 1 Dòng 2"`. Xem R-02 |
| A8 | Click “Quên mật khẩu” trên LoginPage | **PASS** | Hiện toast info “Vui lòng liên hệ Giáo vụ Khoa UTC…” |
| A9 | Không còn hộp thoại native khi click link trợ giúp | **PASS** | `native dialog fired=false` |
| A-Dark | Toast trong dark mode | **PASS** | nền `rgb(30,41,59)`, chữ `rgb(248,250,252)` — ảnh `A_toast_dark.png` |

### B. Dialog

| ID | Kiểm tra | KQ | Bằng chứng |
|---|---|---|---|
| B1 | Mở dialog, focus ban đầu, ARIA | **PASS** | Focus ở nút “Xóa”; `role=alertdialog`, `aria-modal=true` |
| B2/B3 | Esc đóng dialog | **PASS** | `result=false, stillOpen=false` |
| B4 | Enter khi focus ở nút xác nhận | **PASS** | `result=true` |
| B5 | Trả focus về phần tử cũ khi đóng | **PASS** | `before=INPUT, after=INPUT` |
| B-Tab | Tab / Shift+Tab không thoát khỏi dialog | **PASS** | Thứ tự focus: `["Hủy","Xác nhận","Hủy","Xác nhận"]` |
| **B-EnterCancel** | **Enter khi focus ở nút “Hủy”** | **FAIL** | `focus=Hủy, result=true` — **thao tác nguy hiểm vẫn được XÁC NHẬN**. Xem R-01 |
| B-FocusLost | Click vào phần chữ của dialog rồi nhấn Esc | **FAIL** | `activeElement=BODY`, `escResult=pending`, dialog vẫn mở. Xem R-03 |
| B-Overlay | Click ra ngoài overlay | **PASS** | `result=false` |
| B6 | Thao tác nguy hiểm | **PASS** | nút có class `app-dialog-btn-danger`, tiêu đề “⚠️ Xác nhận thao tác” — ảnh `B_dialog_light.png` |
| B7 | Ô nhập bắt buộc để rỗng | **PASS** | Rỗng hoặc chỉ khoảng trắng → nút bị khóa; Enter thường không gửi; Ctrl+Enter gửi; kết quả được trim thành `"Thiếu tài liệu"` |
| B7b | Hủy prompt | **PASS** | `null` |
| B-Queue | Nhiều dialog gọi cùng lúc | **PASS** | Hiện Q1 rồi Q2; kết quả `[["Q1",true],["Q2",false]]` |
| B8 | Dark mode | **PASS** | `data-theme=dark`, nền `rgb(22,33,62)`, chữ `rgb(232,232,232)` — ảnh `B_dialog_dark.png` |
| B9 | Mobile 375px | **PASS** | Dialog rộng 343px (lề 16px), nút rộng 297px xếp dọc (nút xác nhận ở trên), `scrollWidth=375` — ảnh `B_dialog_mobile.png` |
| B-Console | Không có lỗi JS trong cả suite dialog | **PASS** | `[]` |

### C. Xử lý lỗi (Integration: `apiService` thật → `notifyError`)

| ID | Response giả lập | KQ | Nội dung toast thực tế |
|---|---|---|---|
| C-400 | `400 {"detail":"Tên đề tài đã tồn tại."}` | **PASS** | ❌ Lỗi lưu đề tài: Tên đề tài đã tồn tại. |
| C-400f | `400 {"outline_file":["File phải là PDF."]}` | **PASS** | ❌ Lỗi lưu đề tài: File phải là PDF. |
| C-403 | `403 {}` | **PASS** | ❌ Lỗi lưu đề tài: Bạn không có quyền thực hiện thao tác này. |
| C-404 | `404 {}` | **PASS** | ❌ Lỗi lưu đề tài: Không tìm thấy dữ liệu yêu cầu. |
| C-500 | `500 text/html <!DOCTYPE html>…` | **PASS** | ❌ Lỗi lưu đề tài: Máy chủ đang gặp sự cố, vui lòng thử lại sau. **Không lộ HTML** |
| C-net | connection refused | **PASS** | ❌ Lỗi lưu đề tài: Không thể kết nối máy chủ. Vui lòng kiểm tra Internet. (kèm theo toast “Mất kết nối Internet” có sẵn của ToastProvider) |

Ảnh: `C_error_toast.png`. Trong mọi trường hợp đều không lộ chuỗi `status code`, `Network Error` hay HTML.

### D. Phiên đăng nhập (Integration: interceptor thật)

| ID | Kịch bản | KQ | Bằng chứng |
|---|---|---|---|
| D1 | Access token hết hạn → 401 | **PASS** | Interceptor gọi `/app/token/refresh/` đúng 1 lần |
| D2 | Refresh thành công | **PASS** | Ở lại `/student/dashboard`, token mới là `fresh.token`, request được gửi lại, không có toast hết phiên — ảnh `D_refresh_ok.png` |
| D3 | Refresh thất bại | **PASS** | Chuyển về `/login`; `access_token` và `user_type` đã bị xóa; cờ `session_expired` đã được xóa sau khi đọc |
| D3-toast | Hiện toast hết phiên | **PASS** | “⚠️ Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.” — ảnh `D_session_expired.png` |
| D4 | Hết phiên khi đang nhập dở form | **BLOCKED** | Muốn tới các form phải render được dashboard với dữ liệu hợp lệ. Dữ liệu giả lập làm dashboard crash từ trước (mục E), còn backend thật thì không được phép dùng. Theo code: interceptor chuyển trang bằng tải lại hoàn toàn (`window.location.href`), nên **dữ liệu đang nhập sẽ mất**. Đây là hành vi có sẵn, xem R-07 |
| D5 | Không lặp redirect | **PASS** (sau khi phân tích lại) | Lần chạy đầu đánh FAIL do đặt ngưỡng sai. Đo lại 15 giây: 2 lần tải trang, 6 sự kiện điều hướng; **từ giây 5 đến 15 không còn điều hướng nào**, nên không lặp. Bản HEAD (trước refactor) cho kết quả **y hệt** (`compare.json`) |
| D6 | Không có toast hết phiên trùng lặp | **PASS** | Đúng 1 toast (kể cả khi React StrictMode chạy effect 2 lần) |

Quan sát thêm (có sẵn từ trước, không phải hồi quy): `/app/token/logout/` bị gọi **2 lần**, và vừa có điều hướng nội bộ SPA vừa có tải lại trang hoàn toàn. Xem R-08.

### E. Smoke dashboard theo vai trò (dữ liệu giả lập, chỉ đọc)

| Vai trò | Bản sau refactor | Bản HEAD (trước refactor) | Kết luận |
|---|---|---|---|
| Student | crash `Cannot read properties of undefined (reading 'map')` tại `UTCAppLayout`, hiện ErrorBoundary | **giống hệt** | Không phải hồi quy; do dữ liệu giả lập thiếu field |
| Supervisor | crash `…reading 'map'`, hiện ErrorBoundary | **giống hệt** | như trên |
| Committee member | render được, không lỗi | render được, không lỗi | **PASS** |
| External examiner | crash `…reading 'id'`, hiện ErrorBoundary | **giống hệt** | như trên |
| Hộp thoại native khi tải trang | không có | — | **PASS** |

Phương pháp so sánh: dựng git worktree tạm ở HEAD `8063d89` (dùng chung `node_modules` qua junction), chạy Vite ở cổng `:5198` với **cùng kịch bản**. Worktree đã được gỡ sau khi kiểm tra.

**Kết luận E:** Không phát hiện hồi quy do refactor. Hiển thị đúng của các luồng nghiệp vụ Sinh viên, GVHD, Phản biện ngoài với dữ liệu thật thì **chưa xác minh được** (BLOCKED, xem mục 5). Ngoài ra: một API trả thiếu field là đủ làm sập cả dashboard. Đây là điểm yếu có sẵn, xem R-10.

---

## 4. Rà soát code (review tĩnh)

| Mục | Kết quả |
|---|---|
| Xác nhận đã chuyển sang `await confirmDialog` | 9/9 chỗ nằm trong hàm `async`; logic `return` sớm khi hủy được giữ nguyên |
| `promptDialog` từ chối bảo lưu | Có `required: true`, nên không còn trường hợp gửi lý do rỗng (trước đây `window.prompt` cho phép) |
| Phân loại toast tự động | Đã rà 85 lời gọi `notify.*`. Một chỗ chưa hợp lý: `UTCStudentGraduationView.tsx:373` báo **lưu thành công kèm lưu ý** nhưng dùng `warning`, chấp nhận được. Các thông báo khóa giai đoạn dùng `warning`, hợp lý |
| Thông điệp lỗi theo field (`outline_file[0]`, `supervisor_score[0]`, `reviewer_score[0]`) | Trước refactor đọc trực tiếp; nay `getErrorMessage` lấy chuỗi đầu tiên trong `data`. Đã kiểm chứng ở C-400f. Nếu response có cả `detail` lẫn lỗi field thì `detail` được ưu tiên. Không coi là lỗi |
| `DialogHost` xử lý Enter | **Lỗi:** `onKeyDown` gọi `onConfirm()` cho mọi phím Enter mà không xét phần tử đang focus (`DialogHost.tsx:53-55`). Đã tái hiện ở B-EnterCancel |
| `DialogHost` xử lý phím trên overlay | **Lỗi:** listener gắn ở `onKeyDown` của overlay (`DialogHost.tsx:76`), nên chỉ nhận phím khi focus đang nằm trong dialog. Đã tái hiện ở B-FocusLost |
| `Toast.css` | Không có `white-space: pre-line`. Đã tái hiện ở A7 |

---

## 5. Hạng mục BLOCKED / chưa xác minh

| Hạng mục | Lý do |
|---|---|
| ESLint | Dự án chưa cài và chưa cấu hình |
| Hồi quy nghiệp vụ với tài khoản test (Sinh viên / GVHD / Hội đồng / Quản trị) | Backend local không chạy (`localhost:8000` không phản hồi). `backend/.env` trỏ tới **CSDL Neon trên cloud**; khởi động backend với cấu hình đó có nguy cơ tác động dữ liệu dùng chung hoặc production, vi phạm nguyên tắc 3, 4, 6, nên **không thực hiện** |
| D4 — hết phiên khi đang nhập form | Cần dashboard render được với dữ liệu hợp lệ (xem trên) |
| Các toast và dialog cụ thể trong từng màn nghiệp vụ (ví dụ xóa nhiệm vụ, khóa điểm hội đồng) | Chỉ kiểm chứng được cơ chế dùng chung (`notify`, `confirmDialog`) và 1 điểm gọi thật trên LoginPage. Chưa bấm thử từng nút nghiệp vụ, vì cần dữ liệu thật |
| Safari / Firefox / thiết bị di động thật | Chỉ chạy trên Edge (Chromium) |
| Trình đọc màn hình | Chỉ kiểm tra thuộc tính ARIA, chưa thử với NVDA hoặc VoiceOver |

---

## 6. Đề xuất thứ tự xử lý tiếp

1. **R-01 (Cao):** sửa lỗi Enter trên nút “Hủy” xác nhận luôn thao tác nguy hiểm. Đây là thay đổi nhỏ trong `DialogHost.tsx` và nên làm **trước khi commit hoặc deploy** đợt refactor.
2. **R-02:** thêm `white-space: pre-line` cho `.toast-message`.
3. **R-03:** chuyển listener bàn phím của dialog lên `document` khi dialog đang mở.
4. **R-04:** thay `window.confirm` trong `modalHooks.ts` (cần đổi `requestClose` sang async).
5. Dựng **backend local trỏ tới DB local hoặc SQLite riêng** với dữ liệu seed test, rồi chạy lại phần hồi quy nghiệp vụ và D4.
6. Các vấn đề có sẵn: R-05 → R-10.

Chi tiết từng vấn đề: xem `FRONTEND_REMAINING_ISSUES.md`.

---

## 7. Kiểm tra lại sau khi sửa R-01 / R-02 / R-03 (2026-11-21)

### 7.1 Thay đổi đã thực hiện (chỉ trong phạm vi 3 lỗi)

| Lỗi | File | Thay đổi |
|---|---|---|
| R-01 | `components/DialogHost.tsx` | Bỏ nhánh “Enter → `onConfirm()`” toàn cục. Enter trên `<button>` để trình duyệt kích hoạt **chính nút đang focus** (không `preventDefault`). Enter trong textarea xuống dòng, chỉ Ctrl/Cmd+Enter gửi. Enter khi focus không ở phần tử tương tác thì bị chặn, **không tự xác nhận** |
| R-03 | `components/DialogHost.tsx`, `DialogHost.css` | Listener bàn phím chuyển từ `onKeyDown` của overlay sang `window` **pha capture**, chỉ gắn khi đang có dialog. Esc gọi `stopImmediatePropagation()` để không lan xuống modal bên dưới (`useModalGuard` nghe ở pha bubble). Hộp dialog có `tabIndex={-1}`, nên click vào phần chữ vẫn giữ focus trong hộp. Tab từ ngoài hộp đưa focus vào lại. Thêm `.app-dialog:focus { outline: none; }` |
| R-02 | `components/Toast.css` | `.toast-message`: thêm `white-space: pre-line`, `overflow-wrap: anywhere`, `min-width: 0` |

Không thay đổi `ToastContext`, thời lượng auto-dismiss hay cách xếp chồng toast.

### 7.2 Regression test bổ sung

- **Unit test** (`components/__tests__/DialogHost.test.tsx`, 13 test, dùng `user-event` để giả lập phím thật):
  - **R-01:**
    - Enter trên “Hủy” trả về `false`.
    - Enter trên “Xác nhận” trả về `true` đúng một lần và không ảnh hưởng dialog kế tiếp trong hàng đợi.
    - Enter khi focus ở hộp dialog không xác nhận.
    - Space trên “Hủy” hủy.
  - **R-03:**
    - Esc vẫn đóng dialog khi focus đã rơi ra `body`.
    - Hộp dialog có `tabindex=-1`.
    - Esc không lan xuống listener của modal bên dưới; sau khi dialog đóng, Esc lại thuộc về modal đó.
    - Tab từ ngoài hộp đưa focus vào lại dialog.
    - Tab / Shift+Tab xoay vòng trong dialog.
  - **Prompt:**
    - Enter xuống dòng.
    - Ctrl+Enter gửi giá trị đã trim; gửi rỗng bị chặn.
    - Esc trong textarea trả về `null`.
  - **Focus:** đóng dialog thì focus trở về phần tử đã mở nó.
  - **R-02:** `.toast-message` có `white-space: pre-line` và `overflow-wrap: anywhere`.
- **Kiểm chứng test bắt được lỗi (mutation check):** tạm thay lại `DialogHost.tsx` và `Toast.css` bản trước khi sửa thì **5 test mới FAIL**, gồm R-01 Enter-Hủy, R-01 Enter-hộp, R-03 Esc-body, R-03 Esc-lan và R-02 CSS. Sau đó đã khôi phục bản sửa và so khớp bằng `cmp` (giống hệt).
- **UI test bổ sung trên Edge thật** (Playwright), tất cả **PASS**:

| ID | Kịch bản | Kết quả | Bằng chứng |
|---|---|---|---|
| R03-UI | Click chuột vào phần chữ, rồi nhấn Esc | PASS | Focus sau click nằm ở `DIV.app-dialog`; kết quả `false`; dialog đã đóng |
| R03-Tab | Click vào chữ, Tab, rồi Enter | PASS | Focus vào nút “Hủy”; kết quả `false` |
| R01-Box | Click vào chữ, rồi nhấn Enter | PASS | Kết quả `pending`; dialog vẫn mở |
| R01-Space | Shift+Tab sang “Hủy”, rồi nhấn Space | PASS | Kết quả `false` |
| R03-NoLeak | Esc khi dưới dialog có listener modal | PASS | Listener bên dưới nhận 0 lần khi dialog mở, 1 lần sau khi đóng |
| R02-Mobile | Toast 5 dòng kèm chuỗi URL dài 120 ký tự trên màn 375px, cùng 1 toast khác | PASS | `pre-line`, 5 dòng, card trong khoảng [24, 351] px, `scrollWidth=375` (ảnh `R02_toast_multiline_mobile.png`) |
| R02-Dismiss | Auto-dismiss với toast nhiều dòng | PASS | Sau 3.9s toast success đã ẩn, toast warning còn |

### 7.3 Chạy lại toàn bộ kiểm tra

| Hạng mục | Lần 1 | Sau khi sửa |
|---|---|---|
| `tsc --noEmit` | PASS | **PASS** |
| Unit test (Vitest) | 141/141 PASS | **154/154 PASS** (141 cũ + 13 mới, 14 file) |
| Production build (`vite build` ra thư mục tạm, không ghi đè `dist/`) | PASS | **PASS** (1.83s) |
| UI test 37 mục | 33 PASS / 4 FAIL (+ D5 sai ngưỡng) | **33 PASS / 4 FAIL** — xem dưới |
| A7: Toast xuống dòng | FAIL | **PASS** (`white-space=pre-line`, `innerText="Dòng 1\n\nDòng 2"`) |
| B-EnterCancel: Enter trên “Hủy” | FAIL | **PASS** (`result=false`) |
| B4, B-Tab, B2/B3, B5, B7, B7b, B-Queue, B8, B9, B-Overlay, B-Console | PASS | **PASS**, không có hồi quy |
| D5: Không lặp redirect | FAIL do ngưỡng 5s (đã phân tích lại thành PASS) | Như lần 1, kết luận vẫn là **PASS** |
| E-Student / E-supervisor / E-external_examiner | FAIL (có sẵn, R-10) | FAIL **giống hệt** bản HEAD; không liên quan đến 3 lỗi đã sửa |

Ghi chú: ở lần 1, tổng 33 PASS gồm cả các mục E. Lần này A7 và B-EnterCancel chuyển sang PASS. Các FAIL còn lại đều là D5 (sai ngưỡng) hoặc lỗi có sẵn R-10.

### 7.4 Rà soát diff và `git status`

- File đã sửa thêm so với lần kiểm tra trước: `Toast.css`, `DialogHost.tsx`, `DialogHost.css`. File test mới: `DialogHost.test.tsx`. Không có thay đổi ngoài phạm vi.
- Không chạm backend, DB, file cấu hình môi trường hay `dist/`. **Chưa commit.**
- Còn tồn: cảnh báo CRLF/LF của 8 file (R-09), không thuộc phạm vi 3 lỗi này.

### 7.5 Checklist chấp nhận

| Tiêu chí | Trạng thái |
|---|---|
| Enter trên “Hủy” hủy; Enter trên “Xác nhận” xác nhận | ✅ PASS (unit + UI) |
| Không có handler toàn cục ghi đè hành vi mặc định của nút | ✅ PASS |
| Esc, Tab, Shift+Tab và quản lý focus vẫn hoạt động | ✅ PASS |
| Esc hoạt động sau khi click vào phần chữ của dialog | ✅ PASS (UI thật) |
| Esc không đóng nhầm modal hoặc dialog khác | ✅ PASS |
| Không ảnh hưởng tới textarea (Enter xuống dòng, Esc hủy) | ✅ PASS |
| Toast giữ xuống dòng, không tràn màn hình 375px | ✅ PASS |
| Auto-dismiss và toast xếp chồng không đổi | ✅ PASS (A5, A5b, A6, R02-Dismiss) |
| 141 unit test cũ PASS | ✅ PASS (154/154) |
| 37 UI test chạy lại, không có hồi quy | ✅ PASS (các FAIL còn lại có sẵn từ trước) |
| Production build | ✅ PASS |
| Có regression test riêng cho từng lỗi | ✅ PASS |
| Không có thay đổi ngoài phạm vi | ✅ PASS |
| Commit | ⏸ Chờ người dùng quyết định (nên xử lý R-09 trước) |
