import React from 'react';
import { useTranslation } from 'react-i18next';
import './UTCFacultyAnalytics.css';

const UTCFacultyAnalytics: React.FC = () => {
  const { t } = useTranslation();

  const departmentData = [
    {
      name: 'Bộ môn Công nghệ Phần mềm (CNPM)',
      shortName: 'CNPM',
      count: 18,
      total: 48,
      avgScore: '8.5 (A)',
      passRate: '100%',
    },
    {
      name: 'Bộ môn Hệ thống Thông tin & Mạng máy tính',
      shortName: 'HTTT & Mạng',
      count: 13,
      total: 48,
      avgScore: '8.3 (B+)',
      passRate: '100%',
    },
    {
      name: 'Bộ môn Khoa học Máy tính & Trí tuệ Nhân tạo',
      shortName: 'KHMT & AI',
      count: 10,
      total: 48,
      avgScore: '8.6 (A)',
      passRate: '98%',
    },
    {
      name: 'Chương trình Kỹ sư CLC CNTT Việt - Anh',
      shortName: 'CLC Việt - Anh',
      count: 5,
      total: 48,
      avgScore: '8.8 (A)',
      passRate: '100%',
    },
    {
      name: 'Bộ môn Tin học Cơ sở & Kỹ thuật Dữ liệu',
      shortName: 'Tin học Cơ sở',
      count: 2,
      total: 48,
      avgScore: '8.1 (B+)',
      passRate: '100%',
    },
  ];

  const totalProjects = departmentData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="utc-analytics-container">
      <div className="utc-analytics-header">
        <h3>📊 {t('dashboard.facultyAnalytics', 'BÁO CÁO THỐNG KÊ ĐỒ ÁN THEO BỘ MÔN - KHOA CNTT UTC')}</h3>
        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
          Học kỳ 2, Năm học 2025 - 2026 (Khoa CNTT)
        </span>
      </div>

      {/* Summary KPI Cards */}
      <div className="utc-summary-boxes" style={{ marginBottom: '24px' }}>
        <div className="utc-summary-box">
          <div className="num">{totalProjects}</div>
          <div className="label">Tổng số Đề tài Khoa CNTT</div>
        </div>
        <div className="utc-summary-box accent">
          <div className="num">8.45 / 10</div>
          <div className="label">Điểm Trung bình Khoa (GPA 3.48)</div>
        </div>
        <div className="utc-summary-box">
          <div className="num">99.2%</div>
          <div className="label">Tỷ lệ Bảo vệ Hợp lệ & Đạt</div>
        </div>
        <div className="utc-summary-box accent">
          <div className="num">5 Bộ môn / CTĐT</div>
          <div className="label">Đơn vị Chuyên môn Trực thuộc Khoa CNTT</div>
        </div>
      </div>

      {/* Department Distribution List */}
      <h4 style={{ margin: '0 0 16px 0', color: '#003366', fontSize: '1.05rem' }}>
        Phân bổ Đề tài & Kết quả Đánh giá theo Bộ môn Chuyên môn:
      </h4>

      <div className="utc-faculty-grid">
        {departmentData.map((dept, idx) => {
          const percent = Math.round((dept.count / totalProjects) * 100);
          return (
            <div key={idx} className="utc-faculty-card">
              <div className="utc-faculty-name">
                <span>{dept.name}</span>
                <span>{percent}%</span>
              </div>
              <div className="utc-progress-bar-bg">
                <div
                  className="utc-progress-bar-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="utc-faculty-stats">
                <span>
                  Đồ án: <strong>{dept.count}</strong>
                </span>
                <span>
                  Điểm TB: <strong>{dept.avgScore}</strong>
                </span>
                <span>
                  Tỷ lệ Đạt: <strong>{dept.passRate}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UTCFacultyAnalytics;
