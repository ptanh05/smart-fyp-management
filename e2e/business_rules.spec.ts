import { test, expect } from '@playwright/test';

// 2.2. Kiểm tra ràng buộc học vị GV tối thiểu (Kỹ sư vs Cử nhân)
test.describe('Kiểm tra ràng buộc học vị GV tối thiểu', () => {
  test('TC1 (Happy Path): SV Kỹ sư chọn GV có học vị Tiến sĩ (Hợp lệ, lưu thành công)', async ({ request }) => {
    // API mock or actual call
    const response = await request.post('/api/v1/student/supervisor-preference/', {
      data: {
        supervisor_id: 'TS_GV01', // Tiến sĩ
        student_id: 'KS_SV01' // Kỹ sư
      }
    });
    expect(response.status()).toBe(200);
  });

  test('TC2 (Negative): SV Kỹ sư chọn GV có học vị Thạc sĩ (Hệ thống chặn)', async ({ request }) => {
    const response = await request.post('/api/v1/student/supervisor-preference/', {
      data: {
        supervisor_id: 'THS_GV02', // Thạc sĩ
        student_id: 'KS_SV01' // Kỹ sư
      }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain('không đạt điều kiện học vị');
  });

  test('TC3 (Boundary): SV Cử nhân chọn GV Thạc sĩ (Hợp lệ)', async ({ request }) => {
    const response = await request.post('/api/v1/student/supervisor-preference/', {
      data: {
        supervisor_id: 'THS_GV02', // Thạc sĩ
        student_id: 'CN_SV02' // Cử nhân
      }
    });
    expect(response.status()).toBe(200);
  });
});

// 2.7. Thành lập hội đồng & Ràng buộc phân bổ SV
test.describe('Thành lập hội đồng & Ràng buộc phân bổ SV', () => {
  test('TC1 (Happy Path): Tạo hội đồng đủ chuẩn 5 thành viên', async ({ request }) => {
    const response = await request.post('/api/v1/admin/defense-council/', {
      data: {
        council_name: 'HĐ 01',
        members: [
          { role: 'CHAIR', supervisor_id: 'GV1' },
          { role: 'SECRETARY', supervisor_id: 'GV2' },
          { role: 'SECRETARY', supervisor_id: 'GV3' },
          { role: 'MEMBER', supervisor_id: 'GV4' },
          { role: 'MEMBER', supervisor_id: 'GV5' },
        ]
      }
    });
    expect(response.status()).toBe(201);
  });

  test('TC2 (Negative): GVHD != Thành viên Hội đồng', async ({ request }) => {
    const response = await request.post('/api/v1/admin/defense-council/assign-student/', {
      data: {
        council_id: 'COUNCIL_1',
        project_id: 'PROJ_1' // PROJ_1 has GVHD = GV1
      }
    });
    // Assuming COUNCIL_1 has GV1 as a member
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('trùng lặp GVHD');
  });

  test('TC3 (Boundary): Giới hạn tải 12 SV / Hội đồng', async ({ request }) => {
    // Attempt to assign 13th student to full council
    const response = await request.post('/api/v1/admin/defense-council/assign-student/', {
      data: {
        council_id: 'FULL_COUNCIL', // already has 12
        project_id: 'PROJ_13'
      }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain('đạt giới hạn tối đa 12 sinh viên');
  });
});

// 2.5. Xét điều kiện làm đồ án & Quyền Force Approve
test.describe('Xét điều kiện làm đồ án & Quyền Force Approve', () => {
  test('TC1 (Happy Path): SV nợ < 10 tín chỉ -> Đủ điều kiện', async ({ request }) => {
    const response = await request.get('/api/v1/student/eligibility/?student_id=SV_PASS');
    const data = await response.json();
    expect(data.is_eligible).toBe(true);
  });

  test('TC2 (Negative): SV nợ >= 10 tín chỉ -> Bị loại', async ({ request }) => {
    const response = await request.get('/api/v1/student/eligibility/?student_id=SV_FAIL');
    const data = await response.json();
    expect(data.is_eligible).toBe(false);
  });

  test('TC3 (Exception): Quyền Force approve cho SV nợ >= 10 tín chỉ', async ({ request }) => {
    const adminResponse = await request.post('/api/v1/admin/force-approve/', {
      data: { student_id: 'SV_FAIL', is_force_approved: true }
    });
    expect(adminResponse.status()).toBe(200);

    const checkResponse = await request.get('/api/v1/student/eligibility/?student_id=SV_FAIL');
    const data = await checkResponse.json();
    expect(data.is_eligible).toBe(true); // Overridden
  });
});
