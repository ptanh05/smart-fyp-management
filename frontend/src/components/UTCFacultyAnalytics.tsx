import React from 'react';
import { useTranslation } from 'react-i18next';
import './UTCFacultyAnalytics.css';

const UTCFacultyAnalytics: React.FC = () => {
  const { t } = useTranslation();

  const facultyData = [
    {
      name: 'Khoa Công nghệ Thông tin',
      count: 18,
      total: 40,
      avgScore: '8.4 (B+)',
      passRate: '100%',
    },
    {
      name: 'Khoa Điện - Điện tử',
      count: 10,
      total: 40,
      avgScore: '8.1 (B+)',
      passRate: '98%',
    },
    {
      name: 'Khoa Cầu đường',
      count: 6,
      total: 40,
      avgScore: '7.9 (B+)',
      passRate: '95%',
    },
    {
      name: 'Khoa Vận tải - Kinh tế',
      count: 4,
      total: 40,
      avgScore: '8.2 (B+)',
      passRate: '100%',
    },
    {
      name: 'Khoa Cơ khí (Đầu máy Toa xe)',
      count: 2,
      total: 40,
      avgScore: '8.0 (B+)',
      passRate: '100%',
    },
  ];

  return (
    <div className="utc-analytics-container">
      <div className="utc-analytics-header">
        <h3>📊 {t('dashboard.facultyAnalytics', 'BÁO CÁO THỐNG KÊ ĐỒ ÁN THEO KHOA UTC')}</h3>
        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
          Academic Year 2025 - 2026
        </span>
      </div>

      {/* Summary KPI Cards */}
      <div className="utc-summary-boxes" style={{ marginBottom: '24px' }}>
        <div className="utc-summary-box">
          <div className="num">40</div>
          <div className="label">Total Graduation Projects</div>
        </div>
        <div className="utc-summary-box accent">
          <div className="num">8.2 / 10</div>
          <div className="label">University Average (GPA 3.4)</div>
        </div>
        <div className="utc-summary-box">
          <div className="num">98.5%</div>
          <div className="label">Valid Defense Pass Rate</div>
        </div>
        <div className="utc-summary-box accent">
          <div className="num">5 Faculties</div>
          <div className="label">Participating Academic Faculties</div>
        </div>
      </div>

      {/* Faculty Distribution List */}
      <h4 style={{ margin: '0 0 16px 0', color: '#003366', fontSize: '1.05rem' }}>
        Department Project Distribution & Evaluation Breakdown:
      </h4>

      <div className="utc-faculty-grid">
        {facultyData.map((fac, idx) => {
          const percent = Math.round((fac.count / fac.total) * 100);
          return (
            <div key={idx} className="utc-faculty-card">
              <div className="utc-faculty-name">
                <span>{fac.name}</span>
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
                  Projects: <strong>{fac.count}</strong>
                </span>
                <span>
                  Avg Score: <strong>{fac.avgScore}</strong>
                </span>
                <span>
                  Pass Rate: <strong>{fac.passRate}</strong>
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
