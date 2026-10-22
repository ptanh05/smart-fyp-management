import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import DocumentViewerModal from './DocumentViewerModal';
import './StudentTemplatesView.css';

interface Template {
  id: number;
  title: string;
  template_type: string;
  semester: string;
  uploaded_file: string;
  uploaded_at: string;
}

interface StudentTemplatesViewProps {
  /** Student's current semester; used as default filter */
  studentSemester?: string;
}

interface UTCOfficialTemplate {
  code: string;
  title: string;
  stage: string;
  description: string;
  format: string;
  weight?: string;
  downloadUrl?: string;
}

const UTC_OFFICIAL_TEMPLATES: UTCOfficialTemplate[] = [
  {
    code: 'MẪU 01',
    title: 'Phiếu Giao Đề Tài & Đề Cương Đồ Án Tốt Nghiệp',
    stage: 'GĐ 3: Đề Cương ĐATN',
    description: 'Biểu mẫu đề cương song ngữ Việt - Anh chuẩn UTC, tóm tắt mục tiêu, phạm vi nghiên cứu và chữ ký GVHD',
    format: 'PDF / DOCX',
    downloadUrl: '/api/utc/templates/mau-01-de-cuong.pdf',
  },
  {
    code: 'MẪU 02',
    title: 'Nhật Ký Hướng Dẫn & Theo Dõi Tiến Độ Hàng Tuần',
    stage: 'GĐ 4 & 5: Tiến Độ & Task Board',
    description: 'Sổ theo dõi lịch làm việc định kỳ giữa SV và GVHD, ghi nhận các buổi họp trực tiếp/online từ Tuần 1 đến 15',
    format: 'DOCX / XLSX',
    downloadUrl: '/api/utc/templates/mau-02-nhat-ky.docx',
  },
  {
    code: 'MẪU 03',
    title: 'Phiếu Nhận Xét & Đánh Giá Của Cán Bộ Hướng Dẫn',
    stage: 'GĐ 6: Đánh Giá & Điểm ĐATN',
    description: 'Phiếu cho điểm quá trình đồ án theo thang điểm 10, đánh giá thái độ, tiến độ và khối lượng công việc hoàn thành',
    weight: '40% tổng điểm',
    format: 'PDF',
    downloadUrl: '/api/utc/templates/mau-03-danh-gia-gvhd.pdf',
  },
  {
    code: 'MẪU 04',
    title: 'Phiếu Nhận Xét & Đánh Giá Của Cán Bộ Phản Biện',
    stage: 'GĐ 6: Đánh Giá & Điểm ĐATN',
    description: 'Phiếu chấm điểm phản biện độc lập theo thang điểm 10, đánh giá tính mới, cơ sở khoa học và chất lượng báo cáo',
    weight: '20% tổng điểm',
    format: 'PDF',
    downloadUrl: '/api/utc/templates/mau-04-danh-gia-gvpb.pdf',
  },
  {
    code: 'MẪU 05',
    title: 'Phiếu Chấm Điểm & Biên Bản Hội Đồng Bảo Vệ ĐATN',
    stage: 'GĐ 6: Bảo Vệ & Hội Đồng',
    description: 'Biên bản họp Hội đồng chấm ĐATN, câu hỏi bảo vệ, điểm trung bình của 5 thành viên Hội đồng',
    weight: '40% tổng điểm',
    format: 'PDF',
    downloadUrl: '/api/utc/templates/mau-05-bien-ban-hoi-dong.pdf',
  },
  {
    code: 'MẪU 06',
    title: 'Mẫu Bìa & Hướng Dẫn Trình Bày Báo Cáo Toàn Văn ĐATN',
    stage: 'GĐ 6: Báo Cáo ĐATN',
    description: 'Quy cách định dạng chuẩn Font, Margin, Bìa cứng mạ vàng, thứ tự các trang Lời cảm ơn, Mục lục, Danh mục hình vẽ',
    format: 'DOCX / PDF',
    downloadUrl: '/api/utc/templates/mau-06-huong-dan-trinh-bay.docx',
  },
  {
    code: 'MẪU 07',
    title: 'Đơn Xin Hoãn / Bảo Lưu Đồ Án Tốt Nghiệp',
    stage: 'Học vụ & Bảo lưu',
    description: 'Mẫu đơn dành cho sinh viên xin hoãn bảo vệ hoặc bảo lưu đợt làm đồ án do nợ tín chỉ hoặc lý do đặc biệt',
    format: 'DOCX / PDF',
    downloadUrl: '/api/utc/templates/mau-07-don-xin-bao-luu.docx',
  },
];

const StudentTemplatesView: React.FC<StudentTemplatesViewProps> = ({ studentSemester: _studentSemester }) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; type: string } | null>(null);

  useEffect(() => {
    loadCustomTemplates();
  }, []);

  const loadCustomTemplates = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTemplates();
      setCustomTemplates(Array.isArray(data) ? data : []);
    } catch {
      // Fallback cleanly to built-in templates
      setCustomTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (template: UTCOfficialTemplate) => {
    // Show download confirmation / notice
    alert(`Đang tải xuống tài liệu: ${template.title} (${template.format}). Biểu mẫu ban hành theo quy chuẩn Đào tạo UTC.`);
  };

  const filteredOfficialTemplates = UTC_OFFICIAL_TEMPLATES.filter((tpl) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'outline') return tpl.code === 'MẪU 01';
    if (selectedFilter === 'supervision') return tpl.code === 'MẪU 02';
    if (selectedFilter === 'evaluation') return ['MẪU 03', 'MẪU 04', 'MẪU 05'].includes(tpl.code);
    if (selectedFilter === 'report') return tpl.code === 'MẪU 06';
    if (selectedFilter === 'deferral') return tpl.code === 'MẪU 07';
    return true;
  });

  return (
    <div className="student-templates-view card" style={{ padding: '24px', borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              background: '#e0f2fe',
              color: '#0369a1',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '20px',
              letterSpacing: '0.5px'
            }}>
              QUY CHẾ ĐÀO TẠO UTC
            </span>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Trường Đại học Giao thông Vận tải</span>
          </div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', color: '#002B49' }}>
            Kho Biểu Mẫu Chuẩn Đồ Án Tốt Nghiệp (UTC Official Templates)
          </h2>
          <p style={{ margin: 0, color: '#475569', fontSize: '0.92rem' }}>
            Tải về và tra cứu các biểu mẫu quy chuẩn ban hành theo quy chế ĐATN UTC: từ phiếu đề cương, nhật ký hướng dẫn đến biểu mẫu đánh giá của GVHD, GVPB và Hội đồng.
          </p>
        </div>

        {/* Filter by category */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>Lọc theo loại:</label>
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              backgroundColor: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả biểu mẫu (7 mẫu chuẩn)</option>
            <option value="outline">Mẫu 01: Đề cương ĐATN</option>
            <option value="supervision">Mẫu 02: Nhật ký hướng dẫn</option>
            <option value="evaluation">Mẫu 03, 04, 05: Phiếu đánh giá & Hội đồng</option>
            <option value="report">Mẫu 06: Báo cáo toàn văn & Bìa</option>
            <option value="deferral">Mẫu 07: Đơn hoãn / bảo lưu</option>
          </select>
        </div>
      </div>

      {/* Official UTC Templates Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px' }}>
        {filteredOfficialTemplates.map((template) => (
          <div
            key={template.code}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              padding: '18px 20px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ flex: '1 1 400px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span
                  style={{
                    backgroundColor: '#002B49',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {template.code}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700, backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                  {template.stage}
                </span>
                {template.weight && (
                  <span style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 700, backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '4px' }}>
                    ⚖️ {template.weight}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                  [{template.format}]
                </span>
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#1e293b', fontWeight: 700 }}>
                {template.title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                {template.description}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDownload(template)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  backgroundColor: '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                }}
              >
                <span>📥</span>
                <span>Tải Mẫu Biểu</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Uploaded Department Templates if any */}
      {customTemplates.length > 0 && (
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#002B49', marginBottom: '12px' }}>
            📁 Biểu Mẫu Bổ Sung Do Khoa/Bộ Môn Đăng Tải
          </h3>
          <div className="templates-table-wrapper">
            <table className="table templates-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Tên Tài Liệu</th>
                  <th>Học Kỳ</th>
                  <th>Ngày Cập Nhật</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {customTemplates.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.title}</strong></td>
                    <td>{t.semester}</td>
                    <td>{new Date(t.uploaded_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline-info btn-sm"
                        onClick={() =>
                          setPreviewDoc({
                            url: t.uploaded_file,
                            title: t.title,
                            type: t.template_type,
                          })
                        }
                        style={{ marginRight: '8px' }}
                      >
                        👁️ Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
          Đang cập nhật biểu mẫu từ máy chủ...
        </div>
      )}

      {previewDoc && (
        <DocumentViewerModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          documentUrl={previewDoc.url}
          documentType={previewDoc.type}
        />
      )}
    </div>
  );
};

export default StudentTemplatesView;
