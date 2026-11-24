import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GRADUATION_STAGES,
  calculateStageCounts,
  getFallbackStageNumber,
  getProjectStageNumber,
  getProjectWorkflow,
  getStageAccess,
  resolveStageTab,
  workflowStageToBarStatus,
  type ProjectWorkflow,
  type WorkflowStageStatus,
} from '../graduationStages';

/**
 * Fixture contract dùng chung với backend (app/tests/fixtures/stage_contract_cases.json).
 * Frontend dựng lại payload `workflow` từ kỳ vọng của từng case và kiểm tra rằng
 * các helper hiển thị/điều hướng tôn trọng tuyệt đối quyết định của backend.
 */
const contract = JSON.parse(
  readFileSync(
    // vitest chạy với cwd = frontend/
    resolve(process.cwd(), '../backend/app/tests/fixtures/stage_contract_cases.json'),
    'utf-8'
  )
);

type Case = {
  id: string;
  description: string;
  expected: {
    current_stage_number: number;
    statuses?: WorkflowStageStatus[];
    accessible?: boolean[];
    editable?: boolean[];
    overall_percent?: number;
  };
};

function buildWorkflow(current: number, overrides: Partial<ProjectWorkflow> = {}, statuses?: WorkflowStageStatus[], accessible?: boolean[], editable?: boolean[]): ProjectWorkflow {
  const stages = GRADUATION_STAGES.map((stage, idx) => {
    const status: WorkflowStageStatus =
      statuses?.[idx] ?? (stage.number < current ? 'completed' : stage.number === current ? 'active' : 'locked');
    return {
      number: stage.number,
      key: stage.key,
      label: stage.label,
      status,
      accessible: accessible?.[idx] ?? status !== 'locked',
      editable: editable?.[idx] ?? status === 'active',
      reason: status === 'locked' ? `Cần hoàn thành GĐ${stage.number - 1} trước.` : null,
    };
  });
  const info = GRADUATION_STAGES[current - 1];
  return {
    current_stage_number: current,
    current_stage_key: info.key,
    current_stage_label: info.label,
    overall_percent: stages.filter((s) => s.status === 'completed').length * (100 / 6),
    project_status: null,
    batch_status: null,
    stages,
    ...overrides,
  };
}

const workflowFromCase = (c: Case) =>
  buildWorkflow(c.expected.current_stage_number, {}, c.expected.statuses, c.expected.accessible, c.expected.editable);

describe('graduationStages – backend workflow là nguồn sự thật', () => {
  it('fixture contract có đủ case cho 10 kịch bản backend', () => {
    expect(contract.cases.length).toBeGreaterThanOrEqual(15);
  });

  it.each((contract.cases as Case[]).map((c) => [c.id, c] as const))(
    '%s: getProjectStageNumber/getStageAccess dùng đúng giá trị backend',
    (_id, c) => {
      const workflow = workflowFromCase(c);
      expect(getProjectStageNumber({ status: 'TOPIC_DRAFT', workflow })).toBe(c.expected.current_stage_number);
      GRADUATION_STAGES.forEach((stage, idx) => {
        const access = getStageAccess(workflow, stage.number);
        expect(access.status).toBe(workflow.stages[idx].status);
        expect(access.accessible).toBe(workflow.stages[idx].accessible);
        expect(access.editable).toBe(workflow.stages[idx].editable);
      });
    }
  );

  it.each((contract.cases as Case[]).map((c) => [c.id, c] as const))(
    '%s: URL tới giai đoạn khóa luôn bị chuyển về giai đoạn hiện tại',
    (_id, c) => {
      const workflow = workflowFromCase(c);
      const currentKey = GRADUATION_STAGES[c.expected.current_stage_number - 1].key;
      workflow.stages.forEach((stage) => {
        const resolved = resolveStageTab(stage.key, workflow);
        if (stage.accessible) {
          expect(resolved).toEqual({ key: stage.key, redirected: false, reason: null });
        } else {
          expect(resolved.key).toBe(currentKey);
          expect(resolved.redirected).toBe(true);
          expect(resolved.reason).toBeTruthy();
        }
      });
    }
  );

  it('ưu tiên workflow kể cả khi trạng thái thô gợi ý giai đoạn khác', () => {
    // Đề cương mới gửi GVHD (status thô OUTLINE_APPROVED giả định) nhưng backend nói GĐ3.
    expect(getProjectStageNumber({ status: 'OUTLINE_APPROVED', workflow: buildWorkflow(3) })).toBe(3);
    expect(getProjectStageNumber({ status: 'IN_PROGRESS', workflow_stage_number: 5 })).toBe(5);
    expect(getProjectWorkflow({ workflow: { current_stage_number: 2 } })).toBeNull();
  });

  it('fallback khi chưa có workflow: bảo thủ, không heuristic, không tự mở GĐ5', () => {
    expect(getFallbackStageNumber(null)).toBe(2);
    expect(getFallbackStageNumber({ status: 'ALLOCATED' })).toBe(2);
    expect(getFallbackStageNumber({ status: 'OUTLINE_PENDING', topic_review_status: 'GV_CONFIRMED' })).toBe(3);
    expect(getFallbackStageNumber({ status: 'OUTLINE_APPROVED' })).toBe(4);
    // Trước đây: có task/báo cáo tuần -> tự nhảy GĐ5. Nay GĐ5 chỉ mở khi Khoa chuyển đợt.
    expect(
      getFallbackStageNumber({ status: 'OUTLINE_APPROVED', tasks: [{ id: 1 }], weekly_reports: [1, 2, 3, 4, 5] })
    ).toBe(4);
    expect(getFallbackStageNumber({ status: 'IN_PROGRESS', supervisor_score: 8 })).toBe(4);
    expect(getFallbackStageNumber({ status: 'DEFENSE_READY' })).toBe(6);
    expect(getFallbackStageNumber({ status: 'FAILED', topic_review_status: 'REJECTED' })).toBe(3);
  });
});

describe('resolveStageTab – đồng bộ URL ↔ UI (kịch bản 11, 12, 13)', () => {
  const gd4 = buildWorkflow(4);

  it('11. reload với subtab hợp lệ giữ nguyên tab', () => {
    expect(resolveStageTab('weekly', gd4)).toEqual({ key: 'weekly', redirected: false, reason: null });
    // Giai đoạn đã qua vẫn xem lại được (chỉ xem).
    expect(resolveStageTab('outline', gd4)).toEqual({ key: 'outline', redirected: false, reason: null });
  });

  it('12. URL trỏ tới giai đoạn tương lai -> chuyển về giai đoạn hiện tại kèm lý do', () => {
    const resolved = resolveStageTab('grade', gd4);
    expect(resolved.key).toBe('weekly');
    expect(resolved.redirected).toBe(true);
    expect(resolved.reason).toContain('GĐ5');
  });

  it('12b. subtab rác / thiếu -> giai đoạn hiện tại', () => {
    expect(resolveStageTab('khong-ton-tai', gd4)).toEqual({ key: 'weekly', redirected: true, reason: null });
    expect(resolveStageTab(null, gd4)).toEqual({ key: 'weekly', redirected: false, reason: null });
  });

  it('13. chuyển tab qua lại giữa các giai đoạn truy cập được không bị bật ngược', () => {
    const sequence = ['project', 'survey', 'outline', 'weekly', 'outline', 'weekly'];
    sequence.forEach((key) => {
      expect(resolveStageTab(key, gd4).key).toBe(key);
    });
  });

  it('đồ án bị hoãn: backend khóa giai đoạn sau dù đợt đã sang GĐ5', () => {
    const deferred = buildWorkflow(3, { is_blocked: true, blocked_reason: 'Đồ án đã được duyệt hoãn.' });
    deferred.stages[2].editable = false;
    expect(resolveStageTab('supervision', deferred).key).toBe('outline');
    expect(getStageAccess(deferred, 3).editable).toBe(false);
  });

  it('fallback không có workflow: dùng số giai đoạn tạm thời', () => {
    expect(resolveStageTab('grade', null, 3)).toMatchObject({ key: 'outline', redirected: true });
    expect(getStageAccess(null, 2, 3)).toMatchObject({ status: 'completed', accessible: true, editable: false });
  });
});

describe('Sidebar / thanh tiến trình / nội dung / vai trò (kịch bản 14, 15)', () => {
  it('14. trạng thái thanh tiến trình suy ra trực tiếp từ workflow', () => {
    const wf = buildWorkflow(4);
    expect(wf.stages.map((s) => workflowStageToBarStatus(s.status))).toEqual([
      'done', 'done', 'done', 'active', 'locked', 'locked',
    ]);
    // Sidebar mở đúng các giai đoạn backend cho phép, trùng với stepper nội dung.
    expect(GRADUATION_STAGES.map((s) => getStageAccess(wf, s.number).accessible)).toEqual(
      wf.stages.map((s) => s.accessible)
    );
  });

  it('15. GVHD đếm số SV theo cùng workflow mà Sinh viên/Admin nhìn thấy', () => {
    const projects = [
      { status: 'OUTLINE_PENDING', workflow: buildWorkflow(3) },
      { status: 'OUTLINE_APPROVED', workflow: buildWorkflow(4) },
      // Trạng thái thô IN_PROGRESS nhưng đợt đã ở GĐ5 -> backend nói GĐ5.
      { status: 'IN_PROGRESS', workflow: buildWorkflow(5) },
      { status: 'DEFERRED', workflow_stage_number: 2 },
    ];
    expect(calculateStageCounts(projects)).toEqual({ 1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0 });
  });
});
