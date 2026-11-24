// UTC FYP 6-Stage Workflow Definitions & Stage Determination
//
// NGUỒN SỰ THẬT: backend (app/workflow_stages.py) tính giai đoạn và trả về trong
// trường `workflow` (BatchProgress, hồ sơ SV, danh sách đồ án GVHD/Admin).
// Frontend CHỈ hiển thị theo `workflow`; fallback bên dưới chỉ dùng tạm khi dữ
// liệu chưa tải xong và cố ý bảo thủ (không tự mở GĐ5).

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
    label: 'GĐ 4: Bản Nháp Đồ Án',
    sidebarLabel: 'GĐ 4: Nộp Bản Nháp Đồ Án',
    shortLabel: '4. Bản nháp đồ án',
    icon: '📄',
    description: 'Nộp các phiên bản bản nháp báo cáo/quyển đồ án để GVHD theo dõi',
  },
  {
    number: 5,
    key: 'supervision',
    label: 'GĐ 5: Thực Hiện & Báo Cáo',
    sidebarLabel: 'GĐ 5: Task, Nhật Ký & Báo Cáo',
    shortLabel: '5. Thực hiện & Báo cáo',
    icon: '📋',
    description: 'GVHD giao task; sinh viên thực hiện, nộp sản phẩm, báo cáo tuần và ghi nhật ký',
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

/** Mapping trạng thái chính thức của đợt sang số giai đoạn cho màn hình GVHD. */
export const BATCH_STAGE_CODE_TO_NUMBER: Record<string, number> = {
  PHASE_1_SETUP: 1,
  PHASE_2_ALLOCATING: 2,
  PHASE_2_LOCKED: 2,
  PHASE_3_TOPIC: 3,
  PHASE_4_ELIGIBILITY: 4,
  PHASE_5_IN_PROGRESS: 5,
  PHASE_6_DEFENSE: 6,
  COMPLETED: 6,
};

export function resolveBatchWorkflowStageNumber(
  batchStageCode?: string | null,
  progressStageNumber?: number | null
): number {
  const fromCode = batchStageCode ? BATCH_STAGE_CODE_TO_NUMBER[batchStageCode] || 1 : 1;
  return Math.min(6, Math.max(fromCode, Number(progressStageNumber) || 1));
}

/** Giai đoạn cao nhất mà sinh viên do GVHD phụ trách trong đợt đã đạt tới (1..6, hoặc 0 nếu chưa có). */
export function getHighestStudentStage(
  stageCounts?: Record<number, number> | null
): number {
  if (!stageCounts) return 0;
  return Object.entries(stageCounts).reduce((max, [stageNum, count]) => {
    return Number(count) > 0 ? Math.max(max, Number(stageNum) || 0) : max;
  }, 0);
}


export type WorkflowStageStatus = 'completed' | 'active' | 'locked';

export interface ProjectWorkflowStage {
  number: number;
  key: GraduationStageKey;
  label: string;
  status: WorkflowStageStatus;
  accessible: boolean;
  editable: boolean;
  reason: string | null;
}

/** Contract tiến trình 6 giai đoạn do backend tính (workflow_stages.compute_project_progress). */
export interface ProjectWorkflow {
  contract_version?: string;
  current_stage_number: number;
  current_stage_key: GraduationStageKey;
  current_stage_label: string;
  current_step_key?: string;
  current_step_label?: string | null;
  overall_percent: number;
  timeline_step?: number;
  project_stage_number?: number;
  batch_stage_number?: number;
  project_status: string | null;
  batch_status: string | null;
  batch_closed?: boolean;
  has_project?: boolean;
  is_blocked?: boolean;
  blocked_reason?: string | null;
  block_kind?: string | null;
  is_finished?: boolean;
  defense_eligible?: boolean;
  stages: ProjectWorkflowStage[];
}

const clampStage = (value: unknown): number => {
  const num = Math.trunc(Number(value));
  if (!Number.isFinite(num)) return 1;
  return Math.min(6, Math.max(1, num));
};

export function isProjectWorkflow(value: any): value is ProjectWorkflow {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Number.isFinite(Number(value.current_stage_number)) &&
      Array.isArray(value.stages) &&
      value.stages.length === 6
  );
}

/** Lấy workflow backend từ một đối tượng bất kỳ (đồ án, my_project, hồ sơ, batch progress). */
export function getProjectWorkflow(source: any): ProjectWorkflow | null {
  if (!source || typeof source !== 'object') return null;
  if (isProjectWorkflow(source)) return source;
  if (isProjectWorkflow(source.workflow)) return source.workflow;
  return null;
}

const OUTLINE_STATUSES = [
  'TOPIC_DRAFT',
  'TOPIC_CONFIRMED',
  'PENDING_REVIEW',
  'TOPIC_APPROVED',
  'TOPIC_REVISION',
  'OUTLINE_PENDING',
  'OUTLINE_REVISION',
];
const DEFENSE_STATUSES = ['DEFENSE_READY', 'DEFENDING', 'DEFENDED', 'PASSED', 'FAILED'];

/**
 * Fallback tạm thời khi CHƯA có workflow từ backend (đang tải / API cũ).
 * Chỉ đọc trạng thái đã ghi rõ, không dùng heuristic (số báo cáo tuần, task...)
 * và không tự mở GĐ5 vì GĐ5 phụ thuộc quyết định chuyển đợt của Khoa.
 */
export function getFallbackStageNumber(project: any): number {
  if (!project) return 2;
  if (project.is_stage_2 || project.status === 'SURVEY' || project.stage === 2) return 2;
  const status = String(project.status || '');
  const review = String(project.topic_review_status || '');
  if (status === 'FAILED' && review === 'REJECTED') return 3;
  if (DEFENSE_STATUSES.includes(status)) return 6;
  if (status === 'OUTLINE_APPROVED' || status === 'IN_PROGRESS') return 4;
  if (
    OUTLINE_STATUSES.includes(status) ||
    ['GV_CONFIRMED', 'APPROVED', 'REVISION_REQUIRED'].includes(review) ||
    project.signed_outline_file
  ) {
    return 3;
  }
  return 2;
}

/**
 * Giai đoạn hiện tại (1 -> 6) của Sinh viên / Đồ án.
 * Luôn ưu tiên `workflow.current_stage_number` do backend tính.
 */
export function getProjectStageNumber(project: any): number {
  const workflow = getProjectWorkflow(project);
  if (workflow) return clampStage(workflow.current_stage_number);
  if (project && project.workflow_stage_number !== undefined && project.workflow_stage_number !== null) {
    return clampStage(project.workflow_stage_number);
  }
  return getFallbackStageNumber(project);
}

export function getStageInfo(stageNumber: number): StageInfo {
  return GRADUATION_STAGES.find((s) => s.number === clampStage(stageNumber)) || GRADUATION_STAGES[0];
}

export function getStageByKey(key: string | null | undefined): StageInfo | undefined {
  return GRADUATION_STAGES.find((s) => s.key === key);
}

export function getProjectStageInfo(project: any): StageInfo {
  return getStageInfo(getProjectStageNumber(project));
}

export interface StageAccess {
  number: number;
  key: GraduationStageKey;
  status: WorkflowStageStatus;
  accessible: boolean;
  editable: boolean;
  reason: string | null;
}

/**
 * Quyền truy cập một giai đoạn. Có workflow -> dùng nguyên giá trị backend.
 * Không có -> suy ra từ giai đoạn hiện tại (chỉ giai đoạn hiện tại được sửa).
 */
export function getStageAccess(
  workflow: ProjectWorkflow | null | undefined,
  stageNumber: number,
  fallbackCurrentStage = 1
): StageAccess {
  const info = getStageInfo(stageNumber);
  const fromBackend = workflow?.stages?.find((s) => s.number === info.number);
  if (fromBackend) {
    return {
      number: info.number,
      key: info.key,
      status: fromBackend.status,
      accessible: Boolean(fromBackend.accessible),
      editable: Boolean(fromBackend.editable),
      reason: fromBackend.reason ?? null,
    };
  }
  const current = clampStage(fallbackCurrentStage);
  const status: WorkflowStageStatus =
    info.number < current ? 'completed' : info.number === current ? 'active' : 'locked';
  return {
    number: info.number,
    key: info.key,
    status,
    accessible: info.number <= current,
    editable: info.number === current,
    reason: info.number > current ? `Cần hoàn thành GĐ${current} trước.` : null,
  };
}

export interface ResolvedStageTab {
  key: GraduationStageKey;
  redirected: boolean;
  reason: string | null;
}

/**
 * Chọn tab giai đoạn hợp lệ cho một yêu cầu (URL subtab / click / thông báo).
 * - Tab hợp lệ và truy cập được -> giữ nguyên (reload giữ đúng tab).
 * - Tab tương lai / bị khóa -> chuyển về giai đoạn hiện tại kèm lý do.
 * - Không có / không hợp lệ -> giai đoạn hiện tại.
 */
export function resolveStageTab(
  requestedKey: string | null | undefined,
  workflow: ProjectWorkflow | null | undefined,
  fallbackCurrentStage = 1
): ResolvedStageTab {
  const current = workflow ? clampStage(workflow.current_stage_number) : clampStage(fallbackCurrentStage);
  const currentKey = getStageInfo(current).key;
  const requested = getStageByKey(requestedKey);
  if (!requested) {
    return { key: currentKey, redirected: Boolean(requestedKey), reason: null };
  }
  const access = getStageAccess(workflow, requested.number, current);
  if (access.accessible) {
    return { key: requested.key, redirected: false, reason: null };
  }
  return {
    key: currentKey,
    redirected: true,
    reason: access.reason || `Giai đoạn ${requested.number} chưa được mở.`,
  };
}

/** Trạng thái hiển thị trên thanh tiến trình (BatchProgressBar) từ workflow backend. */
export function workflowStageToBarStatus(status: WorkflowStageStatus): 'done' | 'active' | 'locked' {
  if (status === 'completed') return 'done';
  if (status === 'active') return 'active';
  return 'locked';
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
