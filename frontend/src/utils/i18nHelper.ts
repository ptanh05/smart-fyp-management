/**
 * Helper chuyển đổi song ngữ Việt – Anh cho cả chuỗi tĩnh trên UI và chuỗi động
 * trả về từ backend (tên 6 mốc chuẩn UTC, nhãn giai đoạn, việc cần làm, chỉ số thống kê).
 *
 * Khi ngôn ngữ hiện tại là Tiếng Việt (`isEn === false`), luôn trả về nguyên bản Tiếng Việt
 * để đảm bảo tương thích tuyệt đối với toàn bộ bộ kiểm thử hiện có.
 */

export function isEnglish(lng?: string | null): boolean {
  return Boolean(lng && String(lng).toLowerCase().startsWith('en'));
}

export function tr(isEn: boolean, viText: string, enText: string): string {
  return isEn ? enText : viText;
}

const EXACT_EN_MAP: Record<string, string> = {
  // 6 mốc chuẩn UTC (seed default)
  'Khởi tạo đợt & Nhập danh sách SV/GV': 'Batch Setup & Student/Faculty Roster Import',
  'Thiết lập đợt đồ án, import sinh viên, gán GVHD & chỉ tiêu':
    'Configure thesis batch, import student roster, assign supervisors & quotas',
  'Đăng ký nguyện vọng & Phân công GVHD': 'Supervisor Preference Survey & Allocation',
  'Sinh viên đăng ký NV1-NV3, Khoa chạy thuật toán phân công & chốt':
    'Students register 1st–3rd preferences; Faculty runs matching & finalizes allocation',
  'Xây dựng & Phê duyệt Đề cương ĐATN': 'Thesis Outline Drafting & Approval',
  'Sinh viên nộp đề cương, GVHD xác nhận, Khoa phê duyệt & cấp mã đề tài':
    'Students submit outline, supervisor confirms, Faculty approves & issues topic code',
  'Xét điều kiện & Nộp bản nháp đồ án': 'Eligibility Review & Draft Report Submission',
  'Khoa rà soát điều kiện học vụ/đặc cách, SV nộp bản nháp báo cáo':
    'Faculty reviews academic eligibility/waivers; students upload draft thesis report',
  'Thực hiện đồ án, Task & Nhật ký hướng dẫn': 'Thesis Execution, Tasks & Supervision Logs',
  'GVHD giao task, nhật ký định kỳ, báo cáo tiến độ tuần & xác nhận đủ ĐK bảo vệ':
    'Supervisor assigns tasks, periodic logs, weekly progress reports & defense readiness confirmation',
  'Bảo vệ trước Hội đồng & Chốt điểm': 'Committee Defense & Final Grading',
  'Thành lập hội đồng, xếp lịch bảo vệ, chấm điểm, ký biên bản & đóng đợt':
    'Form defense councils, schedule sessions, grade, sign minutes & close batch',

  // Nhãn 6 giai đoạn từ GRADUATION_STAGES & batch_progress.py
  'GĐ 1: Đề Tài & GVHD': 'Stage 1: Topic & Supervisor',
  'GĐ 1: Đề Tài & Phân Công': 'Stage 1: Topic & Allocation',
  'GĐ 1: Khởi Tạo Đợt': 'Stage 1: Batch Initialization',
  '1. Đề tài & GVHD': '1. Topic & Supervisor',
  'Khởi tạo đợt': 'Batch Setup',
  'Phân công GVHD và hồ sơ đề tài ban đầu': 'Supervisor allocation and initial project profile',

  'GĐ 2: Khảo Sát Nguyện Vọng': 'Stage 2: Preference Survey',
  'GĐ 2: Nguyện Vọng & Phân Công GVHD': 'Stage 2: Preferences & Supervisor Allocation',
  '2. Khảo sát nguyện vọng': '2. Preference Survey',
  'Phân công GVHD': 'Supervisor Allocation',
  'Phiếu khảo sát nguyện vọng & thực tập doanh nghiệp': 'Supervisor preference survey & internship info',

  'GĐ 3: Đề Cương & Ký Số': 'Stage 3: Outline & Digital Sign-off',
  'GĐ 3: Duyệt Đề Cương & Ký Số': 'Stage 3: Outline Approval & Sign-off',
  'GĐ 3: Xây Dựng & Phê Duyệt Đề Cương': 'Stage 3: Outline Drafting & Approval',
  '3. Đề cương ĐATN': '3. Thesis Outline',
  'Duyệt đề cương': 'Outline Approval',
  'Bản thảo đề tài, xuất PDF và nộp đề cương có chữ ký': 'Topic draft, PDF export and signed outline submission',

  'GĐ 4: Bản Nháp Đồ Án': 'Stage 4: Thesis Draft Report',
  'GĐ 4: Nộp Bản Nháp Đồ Án': 'Stage 4: Submit Thesis Draft',
  'GĐ 4: Xét Điều Kiện & Nộp Bản Nháp': 'Stage 4: Eligibility & Draft Submission',
  '4. Bản nháp đồ án': '4. Draft Report',
  'Nộp bản nháp đồ án': 'Draft Report Submission',
  'Nộp các phiên bản bản nháp báo cáo/quyển đồ án để GVHD theo dõi':
    'Submit draft report versions for supervisor review and similarity check',

  'GĐ 5: Thực Hiện & Báo Cáo': 'Stage 5: Execution & Progress Reports',
  'GĐ 5: Task, Nhật Ký & Báo Cáo': 'Stage 5: Tasks, Logs & Weekly Reports',
  'GĐ 5: Thực Hiện Đồ Án & Báo Cáo Tiến Độ': 'Stage 5: Thesis Execution & Progress Reports',
  '5. Thực hiện & Báo cáo': '5. Execution & Reports',
  'Task, nhật ký & báo cáo tuần': 'Tasks, Logs & Weekly Reports',
  'GVHD giao task; sinh viên thực hiện, nộp sản phẩm, báo cáo tuần và ghi nhật ký':
    'Supervisor assigns tasks; student submits deliverables, weekly reports and logs',

  'GĐ 6: Bảng Điểm & Bảo Vệ': 'Stage 6: Final Grades & Defense',
  'GĐ 6: Đánh Giá & Bảo Vệ': 'Stage 6: Evaluation & Defense',
  'GĐ 6: Bảo Vệ & Chốt Điểm Hội Đồng': 'Stage 6: Council Defense & Final Grading',
  '6. Bảng điểm & Bảo vệ': '6. Grades & Defense',
  'Đánh giá & bảo vệ': 'Evaluation & Defense',
  'Đánh giá sơ khảo GVHD, điểm phản biện & Hội đồng bảo vệ':
    'Supervisor evaluation, reviewer score & Defense Committee grading',

  // Todos phổ biến từ RoleHomeSummaryAPIView
  'Chưa nộp phiếu khảo sát & nguyện vọng': 'Preference survey not submitted yet',
  'Giai đoạn 2 đang mở, hãy chọn chuyên ngành và GVHD nguyện vọng.':
    'Stage 2 is open. Please select your specialization and preferred supervisors.',
  'Đăng ký nguyện vọng GVHD bổ sung đang mở': 'Supplementary supervisor registration is open',
  'Khoa đang mở đăng ký bổ sung. Hãy gửi/cập nhật NV1-NV3 ngay.':
    'Faculty opened supplementary registration. Please submit/update your 1st–3rd preferences now.',
  'Chưa nộp / hoàn thiện đề cương ĐATN': 'Thesis outline not completed/submitted',
  'Nộp báo cáo tiến độ tuần đầu tiên': 'Submit your first weekly progress report',
  'Bạn chưa có báo cáo tiến độ tuần nào trong Giai đoạn thực hiện.':
    'You have not submitted any weekly progress reports in the Execution stage yet.',
  'Đồ án đang được bảo lưu, không thể thao tác ở các giai đoạn tiếp theo.':
    'Thesis is currently deferred; subsequent stages are read-only.',
  'Sinh viên đã bị loại khỏi đợt đồ án.': 'Student has been disqualified from this thesis batch.',
  'Sinh viên đã bị loại khỏi đợt đồ án do quá hạn hoàn thành giai đoạn.':
    'Student has been disqualified from the thesis batch due to an expired stage deadline.',
  'Chưa được phân công GVHD.': 'Supervisor has not been assigned yet.',
  'Sinh viên chưa được phân công GVHD.': 'Student has not been assigned a supervisor yet.',
  'Sinh viên chưa nộp đề cương.': 'Student has not submitted the thesis outline yet.',
  'Đề cương đã nộp, đang chờ GVHD duyệt.': 'Outline submitted, awaiting supervisor review.',
  'GVHD đã duyệt, đề cương đang chờ Khoa phê duyệt.': 'Supervisor confirmed, awaiting Faculty approval.',
  'Khoa đã duyệt đề tài, sinh viên cần nộp đề cương.': 'Faculty approved topic, student needs to submit outline.',
  'Đề tài đang chờ Khoa/GVHD phê duyệt.': 'Topic is awaiting Faculty/Supervisor approval.',
  'Đề tài đang ở trạng thái nháp.': 'Topic is currently in draft status.',
  'Đề cương đang được yêu cầu chỉnh sửa.': 'Outline requires revision.',
  'Khoa yêu cầu chỉnh sửa đề tài.': 'Faculty requested topic revision.',
  'Sinh viên đã nộp đề cương và chờ xác nhận để sang GĐ 4.':
    'Students submitted outlines and are awaiting confirmation to enter Stage 4.',
  'Sinh viên đã nộp file/link sản phẩm trên Task Board.':
    'Students submitted deliverable files/links on the Task Board.',
  'Đánh giá báo cáo tuần giúp cập nhật trạng thái tiến độ của sinh viên.':
    'Reviewing weekly reports keeps student progress status up to date.',
  'Khoa cần ý kiến xác nhận từ GVHD trước khi duyệt đơn bảo lưu.':
    'Faculty requires supervisor feedback before approving deferral requests.',
  'Chưa có báo cáo tuần & nhật ký HD': 'No weekly reports or supervision logs yet',
  'Tiến độ báo cáo tuần còn ít': 'Low weekly progress report count',

  // Stat labels trong BatchProgressBar
  'Sinh viên': 'Students',
  'Lớp HP': 'Classes',
  'GVHD': 'Supervisors',
  'Tổng chỉ tiêu': 'Total Quota',
  'Đã nộp NV': 'Preferences',
  'Đã phân công': 'Allocated',
  'Đề cương đã duyệt': 'Approved Outlines',
  'Tổng đồ án': 'Total Projects',
  'Đủ ĐK học vụ': 'Eligible',
  'Đã duyệt bản nháp': 'Approved Drafts',
  'Task hoàn thành': 'Tasks Done',
  'Báo cáo tuần': 'Weekly Reports',
  'Đủ ĐK bảo vệ': 'Defense Ready',
  'Hội đồng': 'Councils',
  'Đã chốt điểm': 'Finalized Grades',
  'SV hướng dẫn ở GĐ này': 'Supervised Students in Stage',
};

const STAGE_EN_INFO: Record<
  number,
  { label: string; sidebarLabel: string; shortLabel: string; description: string }
> = {
  1: {
    label: 'Stage 1: Topic & Supervisor',
    sidebarLabel: 'Stage 1: Topic & Allocation',
    shortLabel: '1. Topic & Supervisor',
    description: 'Supervisor allocation and initial project profile',
  },
  2: {
    label: 'Stage 2: Preference Survey',
    sidebarLabel: 'Stage 2: Preference Survey',
    shortLabel: '2. Preference Survey',
    description: 'Supervisor preference survey & enterprise internship info',
  },
  3: {
    label: 'Stage 3: Outline & Sign-off',
    sidebarLabel: 'Stage 3: Outline Approval & Sign-off',
    shortLabel: '3. Thesis Outline',
    description: 'Topic draft, PDF export and signed outline submission',
  },
  4: {
    label: 'Stage 4: Thesis Draft Report',
    sidebarLabel: 'Stage 4: Submit Thesis Draft',
    shortLabel: '4. Draft Report',
    description: 'Submit draft report versions for supervisor tracking',
  },
  5: {
    label: 'Stage 5: Execution & Reports',
    sidebarLabel: 'Stage 5: Tasks, Logs & Reports',
    shortLabel: '5. Execution & Reports',
    description: 'Supervisor assigns tasks; student submits deliverables, weekly reports and logs',
  },
  6: {
    label: 'Stage 6: Grades & Defense',
    sidebarLabel: 'Stage 6: Evaluation & Defense',
    shortLabel: '6. Grades & Defense',
    description: 'Supervisor preliminary evaluation, reviewer score & Defense Committee',
  },
};

export function getLocalizedStageText(
  stageNumber: number,
  fallback: { label: string; sidebarLabel: string; shortLabel: string; description: string },
  isEn: boolean
) {
  if (!isEn) return fallback;
  return STAGE_EN_INFO[stageNumber] || fallback;
}

export function localizeDynamicText(text: string | undefined | null, isEn: boolean): string {
  if (!text) return '';
  if (!isEn) return text;

  const trimmed = text.trim();
  if (EXACT_EN_MAP[trimmed]) {
    return EXACT_EN_MAP[trimmed];
  }

  let m: RegExpMatchArray | null = null;

  m = trimmed.match(/^Mốc "(.+)" đã quá hạn (\d+) ngày$/);
  if (m) return `Milestone "${localizeDynamicText(m[1], true)}" is overdue by ${m[2]} days`;

  m = trimmed.match(/^Hạn chót hôm nay: (.+)$/);
  if (m) return `Due today: ${localizeDynamicText(m[1], true)}`;

  m = trimmed.match(/^Sắp tới hạn \((\d+) ngày\): (.+)$/);
  if (m) return `Upcoming deadline (${m[1]} days left): ${localizeDynamicText(m[2], true)}`;

  m = trimmed.match(/^Còn (\d+) ngày tới hạn chót mốc GĐ (\d*)(.*)$/);
  if (m) return `${m[1]} days remaining until Stage ${m[2]} milestone deadline${m[3] ? m[3].replace('Hạn:', 'Due:') : ''}`;

  m = trimmed.match(/^Hôm nay là hạn cuối của mốc GĐ (\d*)(.*)$/);
  if (m) return `Today is the final deadline for Stage ${m[1]} milestone${m[2] ? m[2].replace('Hạn:', 'Due:') : ''}`;

  m = trimmed.match(/^Mốc giai đoạn (\d*) đã vượt hạn chót(.*)$/);
  if (m) return `Stage ${m[1]} milestone has passed its deadline. Please review and complete immediately.`;

  m = trimmed.match(/^Trạng thái đề cương hiện tại: (.+)\.$/);
  if (m) return `Current outline review status: ${m[1]}.`;

  m = trimmed.match(/^Bạn có (\d+) nhiệm vụ quá hạn trên Task Board$/);
  if (m) return `You have ${m[1]} overdue task(s) on the Task Board`;

  m = trimmed.match(/^Còn (\d+) nhiệm vụ đang thực hiện trên Task Board$/);
  if (m) return `${m[1]} task(s) currently in progress on the Task Board`;

  m = trimmed.match(/^Nhiệm vụ sớm nhất quá hạn: (.+)$/);
  if (m) return `Earliest overdue task: ${m[1]}`;

  m = trimmed.match(/^Tiếp theo: (.+)$/);
  if (m) return `Next up: ${m[1]}`;

  m = trimmed.match(/^Có (\d+) đề cương sinh viên đang chờ GVHD duyệt$/);
  if (m) return `${m[1]} student outline(s) awaiting supervisor review`;

  m = trimmed.match(/^Có (\d+) nhiệm vụ sinh viên đã nộp bài chờ nghiệm thu$/);
  if (m) return `${m[1]} submitted student task(s) awaiting review`;

  m = trimmed.match(/^Có (\d+) báo cáo tiến độ tuần chưa nhận xét$/);
  if (m) return `${m[1]} weekly progress report(s) awaiting feedback`;

  m = trimmed.match(/^Có (\d+) đơn xin hoãn\/bảo lưu cần ý kiến GVHD$/);
  if (m) return `${m[1]} deferral request(s) awaiting supervisor feedback`;

  m = trimmed.match(/^Phân công GVHD: (.+)$/);
  if (m) {
    const inner = m[1]
      .replace('Sinh viên đăng ký nguyện vọng tại GĐ 2', 'Students submit preferences in Stage 2')
      .replace(/đã phân công (\d+)\/(\d+) SV/i, 'allocated $1/$2 students');
    return `Supervisor Allocation: ${inner}`;
  }

  m = trimmed.match(/^Đợt chung đang ở GĐ (\d+)\/6 · Đã có sinh viên hướng dẫn mở khóa tới (.+)$/);
  if (m) return `Batch is at Stage ${m[1]}/6 · Supervised students have unlocked up to ${localizeDynamicText(m[2], true)}`;

  m = trimmed.match(/^Chậm nhịp mốc GĐ5 \((\d+)% thời gian đã trôi qua\)$/);
  if (m) return `Behind Stage 5 schedule (${m[1]}% of stage time elapsed)`;

  m = trimmed.match(/^Đã qua (\d+)% thời gian GĐ5 nhưng tiến độ thực hiện rất thấp$/);
  if (m) return `${m[1]}% of Stage 5 time elapsed with very low execution progress`;

  return text;
}
