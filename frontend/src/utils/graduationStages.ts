// UTC FYP 6-Stage Workflow Definitions & Stage Determination

export type GraduationStageKey = 'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade';

export interface StageInfo {
  number: number;
  key: GraduationStageKey;
  label: string;
  sidebarLabel: string;
  shortLabel: string;
  icon: string;
  description: string;
}

export const GRADUATION_STAGES: StageInfo[] = [
  {
    number: 1,
    key: 'project',
    label: 'GĐ 1: Đề Tài & GVHD',
    sidebarLabel: 'GĐ 1: Đề Tài & Phân Công',
    shortLabel: '1. Đề tài & GVHD',
    icon: '🎓',
    description: 'Phân công GVHD và hồ sơ đề tài ban đầu',
  },
  {
    number: 2,
    key: 'survey',
    label: 'GĐ 2: Khảo Sát Nguyện Vọng',
    sidebarLabel: 'GĐ 2: Khảo Sát Nguyện Vọng',
    shortLabel: '2. Khảo sát nguyện vọng',
    icon: '📝',
    description: 'Phiếu khảo sát nguyện vọng & thực tập doanh nghiệp',
  },
  {
    number: 3,
    key: 'outline',
    label: 'GĐ 3: Đề Cương & Ký Số',
    sidebarLabel: 'GĐ 3: Duyệt Đề Cương & Ký Số',
    shortLabel: '3. Đề cương ĐATN',
    icon: '📄',
    description: 'Bản thảo đề tài, xuất PDF và nộp đề cương có chữ ký',
  },
  {
    number: 4,
    key: 'weekly',
    label: 'GĐ 4: Báo Cáo Tuần',
    sidebarLabel: 'GĐ 4: Báo Cáo Tuần',
    shortLabel: '4. Báo cáo tuần',
    icon: '📅',
    description: 'Báo cáo tiến độ tuần thường xuyên tuần 1 - 15',
  },
  {
    number: 5,
    key: 'supervision',
    label: 'GĐ 5: Task Board & Nhật Ký',
    sidebarLabel: 'GĐ 5: Task Board & Nhật Ký',
    shortLabel: '5. Task board & Nhật ký',
    icon: '📋',
    description: 'Quản lý nhiệm vụ, nộp sản phẩm & biên bản họp hướng dẫn',
  },
  {
    number: 6,
    key: 'grade',
    label: 'GĐ 6: Bảng Điểm & Bảo Vệ',
    sidebarLabel: 'GĐ 6: Đánh Giá & Bảo Vệ',
    shortLabel: '6. Bảng điểm & Bảo vệ',
    icon: '🏆',
    description: 'Đánh giá sơ khảo GVHD, điểm phản biện & Hội đồng bảo vệ',
  },
];

/**
 * Tính toán giai đoạn hiện tại (1 -> 6) của Sinh viên / Đồ án
 * Nguyên tắc: Khi Giảng viên hướng dẫn duyệt thì sinh viên mới sang giai đoạn mới
 */
export function getProjectStageNumber(project: any): number {
  if (!project) return 2; // Chưa được phân công đồ án -> Bước khảo sát nguyện vọng

  // Giai đoạn 2: Khảo sát nguyện vọng & đề tài gợi ý
  if (project.is_stage_2 || project.status === 'SURVEY' || project.stage === 2) {
    return 2;
  }

  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const finalGrade = project.final_grade || project.final_grade_summary || null;
  const supervisorScore =
    project.supervisor_score !== null && project.supervisor_score !== undefined && project.supervisor_score !== ''
      ? Number(project.supervisor_score)
      : null;
  const reviewerScore =
    project.reviewer_score !== null && project.reviewer_score !== undefined && project.reviewer_score !== ''
      ? Number(project.reviewer_score)
      : null;

  // Giai đoạn 6: GVHD đã đánh giá bảo vệ hoặc đủ điều kiện hoặc DEFENSE_READY / PASSED / FAILED / DEFENDING
  if (
    project.is_eligible_for_defense ||
    project.supervisor_defense_confirmed ||
    supervisorScore !== null ||
    reviewerScore !== null ||
    finalGrade?.is_finalized ||
    (finalGrade?.final_score_10 !== null && finalGrade?.final_score_10 !== undefined) ||
    project.status === 'DEFENSE_READY' ||
    project.status === 'PASSED' ||
    project.status === 'DEFENDING' ||
    (project.status === 'FAILED' && project.topic_review_status !== 'REJECTED')
  ) {
    return 6;
  }

  // Giai đoạn 5 & 4: Khi Đề cương đã được GVHD / Khoa DUYỆT (OUTLINE_APPROVED, IN_PROGRESS, hoặc đã ký nộp & Khoa duyệt) hoặc đã Force Approve
  const isOutlineApproved =
    project.status === 'OUTLINE_APPROVED' ||
    project.status === 'IN_PROGRESS' ||
    project.initial_eligibility === 'FORCE_APPROVED' ||
    project.is_force_approved === true ||
    (project.topic_review_status === 'APPROVED' && (project.outline_pdf_path || project.signed_outline_file));

  if (isOutlineApproved) {
    const hasTasks = tasks.length > 0;
    // Báo cáo tuần (GĐ4) chạy xuyên suốt 15 tuần. Việc GVHD nhận xét/đánh giá báo cáo tuần
    // là nghiệp vụ bình thường trong GĐ4, KHÔNG đẩy sinh viên sang GĐ5 hay kết thúc GĐ4.
    // Sinh viên chỉ sang GĐ5 khi GVHD đã giao nhiệm vụ trên Task Board (tasks.length > 0).
    if (hasTasks) {
      return 5;
    }
    // Ngay sau khi GVHD/Khoa duyệt đề cương -> Chuyển sang Giai đoạn 4: Báo cáo tuần
    return 4;
  }

  // Giai đoạn 3: Sinh viên đã nộp đề cương / đang chờ GVHD duyệt hoặc chờ Khoa phê duyệt
  if (
    project.signed_outline_file ||
    ['OUTLINE_PENDING', 'OUTLINE_REVISION', 'TOPIC_CONFIRMED', 'PENDING_REVIEW'].includes(project.status) ||
    project.topic_review_status === 'GV_CONFIRMED'
  ) {
    return 3;
  }

  // Giai đoạn 2: Khoa đã phân công GVHD (ALLOCATED / TOPIC_DRAFT) -> Sinh viên cập nhật khảo sát & xây dựng đề cương
  if (
    ['ALLOCATED', 'TOPIC_DRAFT'].includes(project.status) ||
    project.supervisor_id ||
    project.supervisor
  ) {
    return 2;
  }

  // Giai đoạn 1: Mới khởi tạo đợt, chưa có phân công GVHD
  return 1;
}

export function getProjectStageInfo(project: any): StageInfo {
  const num = getProjectStageNumber(project);
  return GRADUATION_STAGES.find((s) => s.number === num) || GRADUATION_STAGES[0];
}

/**
 * Tính số lượng sinh viên ở mỗi giai đoạn (1 -> 6) cho Bảng điều khiển của Giảng viên
 */
export function calculateStageCounts(projects: any[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  if (!Array.isArray(projects)) return counts;
  projects.forEach((p) => {
    const stage = getProjectStageNumber(p);
    if (stage >= 1 && stage <= 6) {
      counts[stage] = (counts[stage] || 0) + 1;
    }
  });
  return counts;
}
