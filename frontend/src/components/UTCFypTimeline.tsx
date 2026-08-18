import React from 'react';
import { useTranslation } from 'react-i18next';
import './UTCFypTimeline.css';

export interface UTCFypTimelineProps {
  currentStep?: number; // 1 to 5
}

const UTCFypTimeline: React.FC<UTCFypTimelineProps> = ({ currentStep = 3 }) => {
  const { t } = useTranslation();

  const steps = [
    {
      id: 1,
      title: t('timeline.step1', 'Đăng Ký Đề Tài'),
      subtitle: t('timeline.step1Sub', 'Ghép nhóm & Chọn GVHD'),
      time: 'Tuần 1 - 2',
    },
    {
      id: 2,
      title: t('timeline.step2', 'Đề Cương Chi Tiết'),
      subtitle: t('timeline.step2Sub', 'Nộp & Duyệt đề cương'),
      time: 'Tuần 3 - 4',
    },
    {
      id: 3,
      title: t('timeline.step3', 'Đánh Giá Giữa Kỳ'),
      subtitle: t('timeline.step3Sub', 'Báo cáo SDD & Tiến độ'),
      time: 'Tuần 8 - 10',
    },
    {
      id: 4,
      title: t('timeline.step4', 'Nộp Khóa Luận'),
      subtitle: t('timeline.step4Sub', 'Nộp Báo cáo & Mã nguồn'),
      time: 'Tuần 14',
    },
    {
      id: 5,
      title: t('timeline.step5', 'Bảo Vệ UTC'),
      subtitle: t('timeline.step5Sub', 'Chấm điểm Hội đồng'),
      time: 'Tuần 16',
    },
  ];

  return (
    <div className="utc-timeline-card">
      <div className="utc-timeline-header">
        <h3>📅 {t('dashboard.timelineTitle', 'LỊCH TRÌNH TIẾN ĐỘ ĐỒ ÁN TỐT NGHIỆP UTC')}</h3>
        <span className="utc-timeline-badge">
          Step {currentStep}/5 ({steps[currentStep - 1]?.title})
        </span>
      </div>

      <div className="utc-timeline-steps">
        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <div
              key={step.id}
              className={`utc-step-item ${isCompleted ? 'completed' : ''} ${
                isActive ? 'active' : ''
              }`}
            >
              <div className="utc-step-icon">
                {isCompleted ? '✓' : step.id}
              </div>
              <div>
                <div className="utc-step-title">{step.title}</div>
                <div className="utc-step-time">
                  {step.subtitle} • <em>{step.time}</em>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UTCFypTimeline;
