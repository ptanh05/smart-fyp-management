import React from 'react';
import { calculateUTCWeightedScore } from '../utils/utcGradeCalculator';
import './UTCEvaluationSheetModal.css';

export interface UTCEvaluationSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupData: {
    groupId: number | string;
    projectTitle: string;
    facultyDepartment?: string;
    student1Name: string;
    student1RegNo: string;
    student2Name?: string;
    student2RegNo?: string;
    supervisorName?: string;
    reviewerName?: string;
    committeeName?: string;
    supervisorScore?: number;
    reviewerScore?: number;
    committeeScore?: number;
  };
}

const UTCEvaluationSheetModal: React.FC<UTCEvaluationSheetModalProps> = ({
  isOpen,
  onClose,
  groupData,
}) => {
  if (!isOpen) return null;

  const supScore = groupData.supervisorScore ?? 8.5;
  const revScore = groupData.reviewerScore ?? 8.0;
  const comScore = groupData.committeeScore ?? 8.7;

  const result = calculateUTCWeightedScore(supScore, revScore, comScore);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="utc-modal-overlay" onClick={onClose}>
      <div
        className="utc-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="utc-modal-header">
          <h3>🎓 BIÊN BẢN ĐÁNH GIÁ ĐỒ ÁN TỐT NGHIỆP UTC</h3>
          <div className="utc-modal-actions">
            <button
              className="btn-utc-print"
              onClick={handlePrint}
              title="In hoặc Xuất PDF Biên bản"
            >
              🖨️ In Biên Bản / Xuất PDF
            </button>
            <button
              className="btn-utc-close"
              onClick={onClose}
              title="Đóng cửa sổ"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="utc-modal-body">
          {/* Header standard */}
          <div className="utc-doc-header">
            <div className="utc-header-left">
              <div>BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
              <div>TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'normal' }}>
                HỘI ĐỒNG BẢO VỆ ĐỒ ÁN TỐT NGHIỆP
              </div>
            </div>
            <div className="utc-header-right">
              <div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div>Độc lập - Tự do - Hạnh phúc</div>
              <div style={{ fontWeight: 'normal', fontStyle: 'italic', marginTop: '4px' }}>
                Hà Nội, Ngày ..... tháng ..... năm 2026
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="utc-doc-title">
            <h2>BIÊN BẢN CHẤM VÀ ĐÁNH GIÁ ĐỒ ÁN TỐT NGHIỆP</h2>
            <p>(Ban hành theo Quy chế Đào tạo Tín chỉ - Trường Đại học Giao thông Vận tải)</p>
          </div>

          {/* Student & Project Details */}
          <div className="utc-info-section">
            <div className="utc-info-row">
              <div className="utc-info-label">Mã Nhóm Đồ Án:</div>
              <div className="utc-info-value">#Group-{groupData.groupId}</div>
            </div>
            <div className="utc-info-row">
              <div className="utc-info-label">Tên Đề Tài Đồ Án:</div>
              <div className="utc-info-value" style={{ fontWeight: 'bold', color: '#003366' }}>
                {groupData.projectTitle}
              </div>
            </div>
            <div className="utc-info-row">
              <div className="utc-info-label">Khoa / Ngành:</div>
              <div className="utc-info-value">
                {groupData.facultyDepartment || 'Khoa Công nghệ Thông tin - UTC'}
              </div>
            </div>
            <div className="utc-info-row">
              <div className="utc-info-label">Sinh viên 1:</div>
              <div className="utc-info-value">
                {groupData.student1Name} (MSSV: <strong>{groupData.student1RegNo}</strong>)
              </div>
            </div>
            {groupData.student2Name && (
              <div className="utc-info-row">
                <div className="utc-info-label">Sinh viên 2:</div>
                <div className="utc-info-value">
                  {groupData.student2Name} (MSSV: <strong>{groupData.student2RegNo}</strong>)
                </div>
              </div>
            )}
            <div className="utc-info-row">
              <div className="utc-info-label">Giảng viên Hướng dẫn:</div>
              <div className="utc-info-value">
                {groupData.supervisorName || 'PGS.TS. Nguyễn Văn Minh'}
              </div>
            </div>
          </div>

          {/* Table Breakdown */}
          <table className="utc-grade-table">
            <thead>
              <tr>
                <th>Thành Phần Đánh Giá</th>
                <th>Trọng Số</th>
                <th>Điểm Thang 10</th>
                <th>Điểm Quy Đổi Thang 4</th>
                <th>Điểm Chữ (UTC)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left' }}>1. Điểm Giảng viên Hướng dẫn</td>
                <td>40%</td>
                <td><strong>{supScore.toFixed(1)}</strong></td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left' }}>2. Điểm Cán bộ Phản biện / Chấm ngoài</td>
                <td>20%</td>
                <td><strong>{revScore.toFixed(1)}</strong></td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left' }}>3. Điểm Hội đồng Bảo vệ UTC</td>
                <td>40%</td>
                <td><strong>{comScore.toFixed(1)}</strong></td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ textAlign: 'left', fontWeight: 'bold' }}>
                  TỔNG ĐIỂM CHUNG CUỘC (UTC)
                </td>
                <td><strong>100%</strong></td>
                <td>
                  <strong style={{ fontSize: '1.1rem', color: '#003366' }}>
                    {result.score10.toFixed(1)}
                  </strong>
                </td>
                <td>
                  <strong style={{ fontSize: '1.1rem', color: '#2563eb' }}>
                    {result.gpa4.toFixed(1)} / 4.0
                  </strong>
                </td>
                <td>
                  <span
                    className="utc-grade-badge"
                    style={{ backgroundColor: result.color }}
                  >
                    {result.letterGrade} ({result.classification})
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Result conclusion */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: result.isPass ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${result.isPass ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: '8px',
              fontWeight: 600,
              color: result.isPass ? '#166534' : '#991b1b',
              marginBottom: '32px',
              textAlign: 'center',
            }}
          >
            KẾT LUẬN HỘI ĐỒNG: {result.isPass ? '✅ ĐẠT YÊU CẦU BẢO VỆ ĐỒ ÁN TỐT NGHIỆP' : '❌ KHÔNG ĐẠT YÊU CẦU BẢO VỆ'}
          </div>

          {/* Signatures */}
          <div className="utc-signatures">
            <div className="utc-sig-box">
              <div className="utc-sig-title">GIẢNG VIÊN HƯỚNG DẪN</div>
              <div className="utc-sig-name">{groupData.supervisorName || 'TS. Nguyễn Văn Minh'}</div>
            </div>
            <div className="utc-sig-box">
              <div className="utc-sig-title">CÁN BỘ PHẢN BIỆN</div>
              <div className="utc-sig-name">{groupData.reviewerName || 'PGS.TS. Trần Thị Mai'}</div>
            </div>
            <div className="utc-sig-box">
              <div className="utc-sig-title">CHỦ TỊCH HỘI ĐỒNG UTC</div>
              <div className="utc-sig-name">{groupData.committeeName || 'PGS.TS. Nguyễn Đức Thắng'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UTCEvaluationSheetModal;
