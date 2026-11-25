import React from 'react';
import { calculateUTCWeightedScore } from '../utils/utcGradeCalculator';
import { useModalGuard } from '../utils/modalHooks';
import { formatFullName } from '../utils/nameHelper';
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
    supervisorScore?: number | null;
    reviewerScore?: number | null;
    committeeScore?: number | null;
    finalScore10?: number | null;
    gpa4?: number | null;
    letterGrade?: string | null;
    classification?: string | null;
    isPass?: boolean | null;
  };
}

const UTCEvaluationSheetModal: React.FC<UTCEvaluationSheetModalProps> = ({
  isOpen,
  onClose,
  groupData,
}) => {
  const { requestClose, handleOverlayClick } = useModalGuard({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const hasSup = groupData.supervisorScore !== null && groupData.supervisorScore !== undefined && Number.isFinite(Number(groupData.supervisorScore));
  const hasRev = groupData.reviewerScore !== null && groupData.reviewerScore !== undefined && Number.isFinite(Number(groupData.reviewerScore));
  const hasCom = groupData.committeeScore !== null && groupData.committeeScore !== undefined && Number.isFinite(Number(groupData.committeeScore));

  const supScore = hasSup ? Number(groupData.supervisorScore) : null;
  const revScore = hasRev ? Number(groupData.reviewerScore) : null;
  const comScore = hasCom ? Number(groupData.committeeScore) : null;

  const computed = calculateUTCWeightedScore(supScore ?? 0, revScore ?? 0, comScore ?? 0);
  const allComponentsScored = hasSup && hasRev && hasCom;
  const hasFinalScore =
    (groupData.finalScore10 !== null && groupData.finalScore10 !== undefined && Number.isFinite(Number(groupData.finalScore10))) ||
    allComponentsScored;
  const finalScore10 =
    groupData.finalScore10 !== null && groupData.finalScore10 !== undefined && Number.isFinite(Number(groupData.finalScore10))
      ? Number(groupData.finalScore10)
      : computed.score10;
  const finalGpa4 =
    groupData.gpa4 !== null && groupData.gpa4 !== undefined && Number.isFinite(Number(groupData.gpa4))
      ? Number(groupData.gpa4)
      : computed.gpa4;
  const finalLetter = groupData.letterGrade || computed.letterGrade;
  const finalClass = groupData.classification || computed.classification;
  const finalPass =
    typeof groupData.isPass === 'boolean' ? groupData.isPass : computed.isPass;
  const finalBadgeColor = computed.color;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="utc-modal-overlay" onClick={handleOverlayClick}>
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
              title="In phiếu điểm / Biên bản đánh giá ĐATN UTC"
            >
              🖨️ In phiếu điểm
            </button>
            <button
              className="btn-utc-close"
              onClick={requestClose}
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
                {formatFullName(groupData.student1Name)} (MSSV: <strong>{groupData.student1RegNo}</strong>)
              </div>
            </div>
            {groupData.student2Name && (
              <div className="utc-info-row">
                <div className="utc-info-label">Sinh viên 2:</div>
                <div className="utc-info-value">
                  {formatFullName(groupData.student2Name)} (MSSV: <strong>{groupData.student2RegNo}</strong>)
                </div>
              </div>
            )}
            <div className="utc-info-row">
              <div className="utc-info-label">Giảng viên Hướng dẫn:</div>
              <div className="utc-info-value">
                {formatFullName(groupData.supervisorName) || 'Chưa cập nhật'}
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
                <td>30%</td>
                <td><strong>{supScore !== null ? supScore.toFixed(1) : '—'}</strong></td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left' }}>2. Điểm Cán bộ Phản biện / Chấm ngoài</td>
                <td>20%</td>
                <td><strong>{revScore !== null ? revScore.toFixed(1) : '—'}</strong></td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left' }}>3. Điểm Hội đồng Bảo vệ UTC</td>
                <td>50%</td>
                <td><strong>{comScore !== null ? comScore.toFixed(1) : '—'}</strong></td>
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
                    {hasFinalScore ? finalScore10.toFixed(2).replace(/\.00$/, '.0') : '—'}
                  </strong>
                </td>
                <td>
                  <strong style={{ fontSize: '1.1rem', color: '#2563eb' }}>
                    {hasFinalScore ? `${finalGpa4.toFixed(1)} / 4.0` : '—'}
                  </strong>
                </td>
                <td>
                  {hasFinalScore ? (
                    <span
                      className="utc-grade-badge"
                      style={{ backgroundColor: finalBadgeColor }}
                    >
                      {finalLetter} ({finalClass})
                    </span>
                  ) : (
                    <span>Chưa đủ điểm</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Result conclusion */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: !hasFinalScore ? '#f8fafc' : finalPass ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${!hasFinalScore ? '#cbd5e1' : finalPass ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: '8px',
              fontWeight: 600,
              color: !hasFinalScore ? '#475569' : finalPass ? '#166534' : '#991b1b',
              marginBottom: '32px',
              textAlign: 'center',
            }}
          >
            {!hasFinalScore
              ? 'KẾT LUẬN HỘI ĐỒNG: ⏳ CHƯA ĐỦ ĐIỂM ĐỂ TỔNG HỢP'
              : `KẾT LUẬN HỘI ĐỒNG: ${finalPass ? '✅ ĐẠT YÊU CẦU BẢO VỆ ĐỒ ÁN TỐT NGHIỆP' : '❌ KHÔNG ĐẠT YÊU CẦU BẢO VỆ'}`}
          </div>

          {/* Signatures */}
          <div className="utc-signatures">
            <div className="utc-sig-box">
              <div className="utc-sig-title">GIẢNG VIÊN HƯỚNG DẪN</div>
              <div className="utc-sig-name">{formatFullName(groupData.supervisorName) || 'Chưa cập nhật'}</div>
            </div>
            <div className="utc-sig-box">
              <div className="utc-sig-title">CÁN BỘ PHẢN BIỆN</div>
              <div className="utc-sig-name">{formatFullName(groupData.reviewerName) || 'Chưa cập nhật'}</div>
            </div>
            <div className="utc-sig-box">
              <div className="utc-sig-title">CHỦ TỊCH HỘI ĐỒNG UTC</div>
              <div className="utc-sig-name">{formatFullName(groupData.committeeName) || 'Chưa cập nhật'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UTCEvaluationSheetModal;
