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

  // Giai đoạn 6: GVHD đã đánh giá bảo vệ hoặc đủ điều kiện hoặc DEFENSE_READY / PASSED / FAILED / DEFENDING
  if (
    project.is_eligible_for_defense ||
    project.status === 'DEFENSE_READY' ||
    project.status === 'PASSED' ||
    project.status === 'FAILED' ||
    project.status === 'DEFENDING' ||
    (project.supervisor_score !== null && project.supervisor_score !== undefined && Number(project.supervisor_score) > 0)
  ) {
    return 6;
  }

  // Giai đoạn 5 & 4: Khi Đề cương đã được GVHD DUYỆT (OUTLINE_APPROVED hoặc outline_review.verdict === 'APPROVED')
  const isOutlineApproved =
    project.status === 'OUTLINE_APPROVED' ||
    project.outline_review?.verdict === 'APPROVED';

  if (isOutlineApproved) {
    const hasTasks = Array.isArray(project.tasks) && project.tasks.length > 0;
    const weeklyReports = Array.isArray(project.weekly_reports) ? project.weekly_reports : [];
    const hasReviewedWeekly = weeklyReports.some((r: any) => r.supervisor_rating || r.supervisor_feedback);

    // Nếu đã giao tasks hoặc đã có báo cáo tuần được GVHD đánh giá nhận xét -> Sang Giai đoạn 5: Task board & Nhật ký
    if (hasTasks || hasReviewedWeekly || weeklyReports.length >= 5) {
      return 5;
    }
    // Ngay sau khi GVHD duyệt đề cương -> Chuyển sang Giai đoạn 4: Báo cáo tuần
    return 4;
  }

  // Giai đoạn 1: Mới phân công GVHD ban đầu, đề tài chưa xác nhận / DRAFT / PENDING
  if (
    project.status === 'ALLOCATED' &&
    (!project.topic_review_status || project.topic_review_status === 'DRAFT' || project.topic_review_status === 'PENDING') &&
    !project.signed_outline_file
  ) {
    return 1;
  }

  // Giai đoạn 3: Sinh viên làm việc trên đề tài & nộp đề cương, CHỜ GVHD DUYỆT ĐỀ CƯƠNG
  return 3;
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
