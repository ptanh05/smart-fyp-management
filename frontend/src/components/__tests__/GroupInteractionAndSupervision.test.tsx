import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiService } from '../../services/api';

describe('Group Interaction & Supervision API Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renameStudentGroup sends POST request with name to /student-groups/rename/', async () => {
    const postSpy = vi.spyOn((apiService as any).api, 'post').mockResolvedValueOnce({
      data: {
        message: "Đổi tên nhóm thành 'Nhóm Đồ Án K61 Pro' thành công.",
        group: { id: 1, group_name: 'Nhóm Đồ Án K61 Pro' },
      },
    });

    const res = await apiService.renameStudentGroup('Nhóm Đồ Án K61 Pro');

    expect(postSpy).toHaveBeenCalledWith('/student-groups/rename/', {
      name: 'Nhóm Đồ Án K61 Pro',
    });
    expect(res.group.group_name).toBe('Nhóm Đồ Án K61 Pro');
  });

  it('broadcastAnnouncement sends POST request to /supervisor/broadcast-announcement/', async () => {
    const postSpy = vi.spyOn((apiService as any).api, 'post').mockResolvedValueOnce({
      data: {
        message: 'Đã gửi thông báo chung thành công tới 5 sinh viên.',
        recipient_count: 5,
      },
    });

    const res = await apiService.broadcastAnnouncement({
      title: 'Lịch báo cáo tiến độ tuần 5',
      message: 'Các nhóm chuẩn bị slide và bản nháp SRS.',
    });

    expect(postSpy).toHaveBeenCalledWith('/supervisor/broadcast-announcement/', {
      title: 'Lịch báo cáo tiến độ tuần 5',
      message: 'Các nhóm chuẩn bị slide và bản nháp SRS.',
    });
    expect(res.recipient_count).toBe(5);
  });

  it('getStudentSupervisionLogs sends GET request to /student/supervision-logs/', async () => {
    const mockLogs = [
      {
        id: 10,
        meeting_date: '2026-09-20',
        meeting_time: '14:00 - 15:30',
        meeting_type: 'ONLINE',
        location_or_link: 'https://meet.google.com/xyz-uvw-rst',
        content_discussed: 'Thống nhất kiến trúc microservices và schema DB',
        supervisor_notes: 'Tiến độ tốt',
      },
    ];

    const getSpy = vi.spyOn((apiService as any).api, 'get').mockResolvedValueOnce({
      data: mockLogs,
    });

    const res = await apiService.getStudentSupervisionLogs();

    expect(getSpy).toHaveBeenCalledWith('/student/supervision-logs/');
    expect(res).toHaveLength(1);
    expect(res[0].location_or_link).toBe('https://meet.google.com/xyz-uvw-rst');
    expect(res[0].meeting_type).toBe('ONLINE');
  });
});
