# Các vấn đề Frontend còn tồn đọng — sau refactor UX

Nguồn: `FRONTEND_POST_REFACTOR_VERIFICATION_REPORT.md` (2026-11-21). Đường dẫn file tính từ `frontend/src/`.

**Nguồn gốc:**
- **MỚI** — lỗi do đợt refactor gây ra.
- **SÓT** — refactor chưa xử lý tới.
- **CÓ SẴN** — đã tồn tại ở HEAD `8063d89` trước refactor.

| ID | Mức | Nguồn gốc | Tóm tắt | Trạng thái xác minh |
|---|---|---|---|---|
| R-01 | 🔴 Cao | MỚI | Nhấn Enter khi focus ở nút “Hủy” lại **xác nhận** thao tác (kể cả thao tác nguy hiểm) | ✅ **ĐÃ SỬA**, có unit test và UI test |
| R-02 | 🟡 TB | MỚI | Toast không xuống dòng, thông báo nhiều dòng bị dồn thành 1 dòng | ✅ **ĐÃ SỬA**, có unit test và UI test |
| R-03 | 🟡 TB | MỚI | Click vào phần chữ trong dialog thì phím Esc không còn đóng được | ✅ **ĐÃ SỬA**, có unit test và UI test |
| R-04 | 🟡 TB | SÓT | `modalHooks.ts` vẫn dùng `window.confirm` | Grep |
| R-05 | 🟡 TB | SÓT | Khoảng 20 chỗ vẫn hiện `err.message` hoặc fallback tiếng Anh | Grep |
| R-06 | 🟢 Thấp | SÓT | Thông báo từ backend (`res.message`) có thể là tiếng Anh | Chưa xác minh (cần backend) |
| R-07 | 🟡 TB | CÓ SẴN | Hết phiên khi đang nhập form thì tải lại trang, mất dữ liệu đang nhập | Đọc code; UI bị BLOCKED |
| R-08 | 🟢 Thấp | CÓ SẴN | Gọi `token/logout` 2 lần; chuyển trang 2 kiểu (SPA và tải lại) | Đo bằng UI |
| R-09 | 🟢 Thấp | MỚI | 8 file bị đổi ký tự xuống dòng CRLF thành LF | `git` cảnh báo |
| R-10 | 🟡 TB | CÓ SẴN | Dashboard sập toàn bộ (ErrorBoundary) khi API trả thiếu field | Đã tái hiện, cả bản HEAD |
| R-11 | 🟡 TB | CÓ SẴN | Các mục còn lại từ đợt audit UX đầu tiên | Chưa xử lý |

---

## R-01 🔴 Nhấn Enter khi focus ở “Hủy” lại xác nhận thao tác — ✅ ĐÃ SỬA

> **Đã sửa (2026-11-21):** Bỏ nhánh Enter → `onConfirm()` toàn cục. Enter trên nút để trình duyệt kích hoạt chính nút đó. Enter khi focus ở vùng khác bị chặn, không tự xác nhận. Prompt dùng Ctrl/Cmd+Enter để gửi. Test: `components/__tests__/DialogHost.test.tsx` (nhóm R-01), UI test `B-EnterCancel`, `R01-Box`, `R01-Space`. Phần mô tả bên dưới giữ lại để tham khảo.

- **File:** `components/DialogHost.tsx:53-55`
  ```ts
  } else if (e.key === 'Enter' && !e.shiftKey && (!isPrompt || e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    onConfirm();
  ```
- **Tái hiện:** Mở `confirmDialog('Xóa vĩnh viễn?', { danger: true })`, nhấn Shift+Tab để focus vào “Hủy”, rồi nhấn Enter. Kết quả là `true`: thao tác **bị thực hiện**.
- **Ảnh hưởng:** Người dùng dùng bàn phím, hoặc chỉ cần nhấn Tab một lần, có thể xóa đề tài, nhiệm vụ, tin nhắn, nhóm, hoặc khóa điểm hội đồng ngoài ý muốn.
- **Đề xuất:** Khi Enter được nhấn trên một `<button>`, để trình duyệt tự kích hoạt nút đó và không gọi `onConfirm`. Ví dụ: `if ((e.target as HTMLElement).tagName === 'BUTTON') return;` trước nhánh Enter. Nên thêm test UI cho kịch bản này.
- **Ưu tiên:** Sửa **trước khi commit hoặc deploy** đợt refactor.

## R-02 🟡 Toast không giữ ký tự xuống dòng — ✅ ĐÃ SỬA

> **Đã sửa:** `.toast-message` thêm `white-space: pre-line; overflow-wrap: anywhere; min-width: 0`. Đã kiểm tra trên màn 375px: không tràn, auto-dismiss không đổi. Test: nhóm R-02 trong `DialogHost.test.tsx`, UI test `A7`, `R02-Mobile`, `R02-Dismiss`.

- **File:** `components/Toast.css` (`.toast-message` không có `white-space`)
- **Bằng chứng:** `white-space=normal`; `"Dòng 1\n\nDòng 2"` hiển thị thành `"Dòng 1 Dòng 2"`.
- **Vị trí bị ảnh hưởng:** `pages/StudentDashboard.tsx:453-455` (thông báo khóa phiếu đánh giá, 3 đoạn), `components/UTCStudentGraduationView.tsx:373` (danh sách lưu ý dạng `- …`), `components/UTCCouncilLiveDefenseView.tsx` (danh sách thành viên đã nhắc).
- **Đề xuất:** Thêm `white-space: pre-line;` cho `.toast-message`. Có thể cân nhắc tăng thời lượng hiển thị cho thông báo dài.

## R-03 🟡 Esc mất tác dụng khi focus rơi khỏi dialog — ✅ ĐÃ SỬA

> **Đã sửa:** Listener `keydown` chuyển lên `window` pha capture, chỉ gắn khi dialog đang mở. Esc gọi `stopImmediatePropagation()` để không đóng nhầm modal bên dưới. Hộp dialog có `tabIndex={-1}` để click vào phần chữ vẫn giữ focus trong hộp. Test: nhóm R-03 trong `DialogHost.test.tsx`, UI test `R03-UI`, `R03-Tab`, `R03-NoLeak`.

- **File:** `components/DialogHost.tsx:76` (`onKeyDown` gắn trên overlay)
- **Tái hiện:** Click vào phần chữ của dialog thì `activeElement=BODY`; nhấn Esc thì dialog vẫn mở.
- **Đề xuất:** Gắn `keydown` lên `document` trong `useEffect` khi `current` khác null, hoặc focus vào hộp dialog (`tabIndex={-1}`) khi click vào vùng không focus được.

## R-04 🟡 Còn sót `window.confirm` trong `modalHooks.ts`

- **File:** `utils/modalHooks.ts:25`
- **Ảnh hưởng:** Hỏi “Bạn có dữ liệu đang nhập dở chưa lưu…” vẫn dùng hộp thoại native, không theo dark mode. Dùng ở `BugReportModal`, `ChangePasswordModal`, `DocumentViewerModal`…
- **Lý do chưa chuyển:** `requestClose` đang đồng bộ và trả `boolean`. Muốn dùng `confirmDialog` phải đổi sang async, đồng thời sửa `utils/__tests__/modalHooks.test.ts` (đang mock `window.confirm`).

## R-05 🟡 Còn hiện lỗi kỹ thuật thô hoặc tiếng Anh

Các chỗ chưa dùng `getErrorMessage`/`notifyError`:

| File:dòng | Vấn đề |
|---|---|
| `components/AuditLogViewer.tsx:70, 125-126` | `err.message` (ví dụ “Request failed with status code 500”); fallback tiếng Anh “Failed to load audit logs” |
| `components/DocumentRequirementsManager.tsx:85, 109, 126` | `err.message`, “Failed to create/update/delete.” |
| `components/SupervisorAnalytics.tsx:21`, `CommitteeMemberAnalytics.tsx:19` | “Failed to load analytics” |
| `components/GroupRequestModal.tsx:79`, `SupervisorRequestModal.tsx:76` | `err.message`, fallback tiếng Anh |
| `components/UTCStudentGraduationView.tsx:384-385` | `JSON.stringify(err.response?.data)`: có thể hiện chuỗi JSON thô cho người dùng |
| `components/UTCStudentGraduationView.tsx:575-577` | `err.message` |
| `components/UTCSupervisorGroupChatView.tsx:65, 171` | `err.message` |
| `components/DocumentViewerModal.tsx:58` | `err.message` |
| `pages/SupervisorDashboard.tsx:155` | `err.message` |
| `components/DocumentReview.tsx:168`, `DocumentsList.tsx:49`, `TemplatesList.tsx:~100` | tự trích lỗi, có thể ra chuỗi tiếng Anh từ backend |
| `components/ExternalEvaluationForm.tsx:134` | “Unknown error” |

**Đề xuất:** Thay bằng `getErrorMessage(err, '<câu tiếng Việt>')`.

## R-06 🟢 Thông báo thành công lấy nguyên văn từ backend

`notify.success(res.message || '…')` ở nhiều chỗ, ví dụ `UTCSupervisorGraduationView.tsx:536, 559, 583, 633` và `UTCCouncilLiveDefenseView.tsx:128, 209, 240`. Nếu backend trả câu tiếng Anh thì giao diện sẽ lẫn ngôn ngữ. **Chưa xác minh** vì không chạy được backend. Có thể kiểm tra trong code backend xem các chuỗi `message` đã là tiếng Việt chưa.

## R-07 🟡 Hết phiên khi đang nhập form làm mất dữ liệu (CÓ SẴN)

- **File:** `services/api.ts:161-163`. Dùng `window.location.href = '/login'`, tức là tải lại trang hoàn toàn.
- Refactor chỉ bổ sung toast giải thích lý do. Nội dung form đang nhập dở vẫn mất.
- **Đề xuất:** Lưu nháp các form dài (đề cương, báo cáo tuần, nhật ký hướng dẫn) vào `sessionStorage`, hoặc mở modal đăng nhập lại tại chỗ thay vì chuyển trang.
- **Trạng thái UI:** BLOCKED (xem báo cáo, mục D4).

## R-08 🟢 Đăng xuất bị gọi 2 lần (CÓ SẴN)

- **Bằng chứng:** Khi refresh thất bại, các request API là `profile → token/refresh → token/logout → token/logout`. Có cả điều hướng SPA (`AuthContext.logout` dẫn tới `ProtectedRoute` chuyển về `/login`) lẫn tải lại trang hoàn toàn. Bản HEAD giống hệt.
- **Nguyên nhân khả dĩ:** `AuthContext.tsx:76-78` (`catch → logout()`) chạy 2 lần do React StrictMode gọi effect 2 lần trong môi trường dev, cộng thêm chuyển trang từ interceptor.
- **Ảnh hưởng:** Thấp. Đã xác nhận **không có vòng lặp redirect** (theo dõi 15 giây).

## R-09 🟢 Ký tự xuống dòng bị đổi

Git cảnh báo “LF will be replaced by CRLF” cho: `DocumentRequirementsManager.tsx`, `DocumentReview.tsx`, `SupervisorOfferedTopics.tsx`, `TemplatesList.tsx`, `UTCSupervisorGroupChatView.tsx`, `LoginPage.tsx`, `StudentDashboard.tsx`, `services/api.ts`. Nên chuẩn hóa trước khi commit, hoặc thêm `.gitattributes`, để diff không bị “toàn bộ file thay đổi”.

## R-10 🟡 Dashboard sập toàn bộ khi API thiếu field (CÓ SẴN)

- **Bằng chứng:** Khi API trả object thiếu mảng hoặc field, Student và Supervisor crash `Cannot read properties of undefined (reading 'map')` trong `UTCAppLayout`; External crash `…reading 'id'`. Cả trang chuyển sang ErrorBoundary. Bản HEAD trước refactor cũng giống hệt.
- **Đề xuất:** Dùng giá trị mặc định (`?? []`) cho dữ liệu từ API trong `UTCAppLayout` và `ExternalDashboard`, và bọc ErrorBoundary theo từng khu vực thay vì cả trang.
- **Lưu ý:** Kết quả này lấy từ dữ liệu giả lập. Với backend thật, mức độ xảy ra **chưa xác minh**.

## R-11 Các mục còn lại từ đợt audit UX đầu tiên (chưa xử lý)

- Khoảng 83 khối `catch` chỉ `console.error`, không báo gì cho người dùng và không có nút “Thử lại”.
- 14 modal cũ chưa hỗ trợ Esc và chưa giữ focus bên trong.
- 35 chỗ màu viết cứng bằng inline style làm lệch dark mode. Spinner trong `App.tsx` dùng `#e2e8f0` / `#003366`.
- Nút chỉ có icon thiếu `aria-label`.
- Bảng tràn ngang trên điện thoại.
- Tab giai đoạn bị khóa chỉ báo lỗi sau khi click (nên làm mờ kèm tooltip).
- Hai file Graduation View khoảng 2.700 dòng.

---

## Thứ tự xử lý đề xuất

1. ~~**R-01**: chặn trước khi commit hoặc deploy.~~ ✅ Đã sửa
2. ~~**R-02, R-03**: sửa nhanh cho DialogHost và Toast.~~ ✅ Đã sửa
3. **R-09**: chuẩn hóa ký tự xuống dòng, rồi commit đợt refactor.
4. **R-04, R-05**: hoàn tất việc thống nhất thông báo.
5. Dựng backend local với DB riêng và dữ liệu seed, rồi chạy lại kiểm thử hồi quy nghiệp vụ và D4 (để xác minh R-06, R-07, R-10 với dữ liệu thật).
6. **R-10, R-07**: tăng độ bền của dashboard và bảo vệ dữ liệu form.
7. **R-11**: các mục còn lại theo đợt audit ban đầu.
