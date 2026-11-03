import React, { useState, useMemo } from 'react';
import './UTCNewsModal.css';

export interface UTCNewsItem {
  id: string;
  category: 'school' | 'training' | 'recruitment';
  categoryName: string;
  title: string;
  date: string;
  author: string;
  badge: string;
  badgeClass: 'badge-school' | 'badge-training' | 'badge-recruitment';
  summary: string;
  content: string[];
  bullets?: string[];
  highlight?: string;
  attachments?: Array<{ name: string; size: string }>;
  contact?: string;
}

export const UTC_NEWS_DATA: UTCNewsItem[] = [
  {
    id: 'news-policy-2026',
    category: 'school',
    categoryName: 'Tin Nhà Trường',
    title: 'Thực hiện chế độ chính sách sinh viên học kỳ I năm học 2026 - 2027',
    date: '11/08/2026',
    author: 'Phòng Công tác Chính trị & Sinh viên (CTCT&SV) - UTC',
    badge: 'Chính sách SV',
    badgeClass: 'badge-school',
    summary: 'Thông báo xét miễn, giảm học phí và hỗ trợ chi phí học tập cho sinh viên hệ chính quy thuộc diện chính sách trong học kỳ I năm học 2026 - 2027.',
    content: [
      'Căn cứ Nghị định số 81/2021/NĐ-CP và hướng dẫn thực hiện chế độ chính sách cho người học năm 2026, Trường Đại học Giao thông Vận tải hướng dẫn các thủ tục nộp hồ sơ xét miễn, giảm học phí như sau:',
      '1. Đối tượng áp dụng: Sinh viên chính quy các khóa K61, K62, K63, K64 thuộc diện: con thương binh, liệt sĩ; sinh viên khuyết tật; sinh viên người dân tộc thiểu số tại vùng có điều kiện đặc biệt khó khăn; sinh viên thuộc hộ nghèo/cận nghèo theo chuẩn nghèo đa chiều.',
      '2. Thời hạn nộp hồ sơ: Từ ngày 15/08/2026 đến hết 17h00 ngày 05/09/2026. Quá thời hạn trên, nhà trường sẽ không giải quyết bổ sung.'
    ],
    bullets: [
      'Đơn đề nghị miễn/giảm học phí (theo mẫu quy định tải từ Cổng SV UTC)',
      'Bản sao công chứng Căn cước công dân và Giấy khai sinh',
      'Giấy chứng nhận hộ nghèo / cận nghèo hoặc thẻ thương binh (có hiệu lực trong năm 2026)',
      'Giấy xác nhận thông tin cư trú (CT07) đối với diện sinh viên vùng sâu vùng xa'
    ],
    highlight: 'Lưu ý: Sinh viên nộp trực tiếp tại Văn phòng Một cửa - Tầng 1 Nhà A1 hoặc gửi chuyển phát nhanh bảo đảm về Phòng CTCT&SV.',
    attachments: [
      { name: 'Don_de_nghi_mien_giam_hoc_phi_2026_UTC.pdf', size: '245 KB' },
      { name: 'Huong_dan_ho_so_chinh_sach_K61_K64.docx', size: '180 KB' }
    ],
    contact: 'Mọi thắc mắc vui lòng liên hệ Thầy Nguyễn Văn Hưng - Phòng CTCT&SV (P.104 - A1). Điện thoại: (024) 37663311 (Số máy lẻ 105).'
  },
  {
    id: 'news-hoangphat-recruit',
    category: 'school',
    categoryName: 'Tin Nhà Trường',
    title: 'Công ty TNHH Tư vấn & Công nghệ Xây dựng Hoàng Phát tuyển dụng sinh viên UTC',
    date: '22/07/2026',
    author: 'Trung tâm Hỗ trợ Sinh viên & Quan hệ Doanh nghiệp UTC',
    badge: 'Tuyển dụng',
    badgeClass: 'badge-recruitment',
    summary: 'Công ty TNHH Hoàng Phát tổ chức ngày hội phỏng vấn tuyển dụng Kỹ sư Phần mềm và Chuyên viên Công nghệ thông tin tốt nghiệp đợt 1 năm 2026.',
    content: [
      'Công ty Hoàng Phát là đơn vị tiên phong trong việc số hóa dữ liệu công trình giao thông và phát triển phần mềm quản lý hạ tầng đô thị thông minh.',
      'Nhằm đáp ứng mở rộng quy mô dự án cấp quốc gia, công ty trân trọng thông báo tuyển dụng 20 kỹ sư CNTT và Cử nhân Khoa học máy tính tốt nghiệp tại UTC với các chế độ đãi ngộ vượt trội.'
    ],
    bullets: [
      'Vị trí tuyển dụng: Backend Developer (Node.js/Python), Frontend Developer (React/TypeScript), BIM Specialist',
      'Mức lương khởi điểm: 14.000.000 - 25.000.000 VNĐ/tháng + Thưởng dự án theo quý',
      'Hỗ trợ toàn diện kinh phí thực hiện đề tài ĐATN và thực tập tốt nghiệp tại trụ sở công ty',
      'Được đào tạo trực tiếp bởi các Chuyên gia Kiến trúc phần mềm và Kỹ sư trưởng'
    ],
    highlight: 'Thời gian phỏng vấn trực tiếp: 08h30 Thứ Bảy ngày 29/08/2026 tại Phòng Hội thảo tầng 2 - Thư viện UTC.',
    attachments: [
      { name: 'JD_Chi_tiet_Tuyen_dung_Hoang_Phat_2026.pdf', size: '512 KB' }
    ],
    contact: 'Gửi CV về email: tuyendung@hoangphat-tech.vn hoặc liên hệ Trung tâm HTSV UTC (email: htsv@utc.edu.vn).'
  },
  {
    id: 'news-vatm-recruit',
    category: 'school',
    categoryName: 'Tin Nhà Trường',
    title: 'Tổng công ty Quản lý bay Việt Nam thông báo tuyển dụng lao động năm 2026',
    date: '16/07/2026',
    author: 'Tổng công ty Quản lý bay Việt Nam (VATM)',
    badge: 'Cơ hội việc làm',
    badgeClass: 'badge-recruitment',
    summary: 'Thông báo tuyển dụng Kỹ sư Quản trị mạng, Kỹ sư Phát triển Hệ thống radar & viễn thông phục vụ điều hành bay toàn quốc năm 2026.',
    content: [
      'Tổng công ty Quản lý bay Việt Nam (VATM) trực thuộc Bộ Giao thông Vận tải thông báo tuyển dụng 15 Kỹ sư Công nghệ thông tin và Điện tử viễn thông phục vụ vận hành đài kiểm soát không lưu và các trung tâm chỉ huy bay đường dài.',
      'Ứng viên trúng tuyển sẽ được cử đi đào tạo chuyên ngành tại Trung tâm Đào tạo Hàng không và các cơ sở kỹ thuật đối tác tại Singapore và Pháp.'
    ],
    bullets: [
      'Tốt nghiệp Đại học chính quy loại Khá trở lên các ngành CNTT, Kỹ thuật Máy tính, Điện tử - Viễn thông',
      'Trình độ tiếng Anh: TOEIC tối thiểu 600 điểm hoặc IELTS 5.5 trở lên',
      'Sức khỏe tốt, chịu được áp lực ca trực kỹ thuật 24/7'
    ],
    highlight: 'Hạn nộp hồ sơ trực tuyến: Trước 17h00 ngày 15/09/2026 qua Cổng tuyển dụng VATM.',
    attachments: [
      { name: 'Thong_bao_tuyen_dung_VATM_Dot2_2026.pdf', size: '1.2 MB' }
    ],
    contact: 'Ban Tổ chức cán bộ - Lao động VATM: Số 6/200 phố Nguyễn Sơn, Bồ Đề, Long Biên, Hà Nội.'
  },
  {
    id: 'train-ielts-k61',
    category: 'training',
    categoryName: 'Tin Đào Tạo & Đồ Án',
    title: 'THÔNG BÁO VỀ VIỆC SỬ DỤNG CHỨNG CHỈ IELTS / CHUẨN ĐẦU RA TRONG QUÁ TRÌNH ĐÀO TẠO ĐỒ ÁN K61',
    date: '14/08/2026',
    author: 'Phòng Đào tạo Đại học - UTC',
    badge: 'Chuẩn đầu ra',
    badgeClass: 'badge-training',
    summary: 'Hướng dẫn nộp minh chứng và quy đổi chứng chỉ tiếng Anh quốc tế (IELTS/TOEIC/VSTEP) phục vụ xét điều kiện bảo vệ Đồ án tốt nghiệp khóa K61.',
    content: [
      'Căn cứ Quy chuẩn đầu ra ngoại ngữ áp dụng cho sinh viên các chương trình Kỹ sư và Cử nhân chính quy, Phòng Đào tạo Đại học thông báo:',
      '1. Điều kiện bảo vệ ĐATN: Sinh viên đăng ký bảo vệ Đồ án tốt nghiệp đợt 1 năm học 2026 - 2027 bắt buộc phải có chứng chỉ ngoại ngữ còn hiệu lực tính đến ngày bảo vệ (IELTS >= 5.0, TOEIC >= 550, hoặc chuẩn tương đương).',
      '2. Quy trình nộp: Sinh viên đăng nhập Cổng đào tạo UTC, chụp ảnh 2 mặt bản gốc chứng chỉ và mã tra cứu kết quả trực tuyến.',
      '3. Phòng Đào tạo sẽ phối hợp với tổ chức khảo thí (IDP, British Council, IIG Việt Nam) để hậu kiểm xác thực trong vòng 5 ngày làm việc.'
    ],
    bullets: [
      'Hạn chót cập nhật chứng chỉ: 20/09/2026',
      'Các trường hợp nộp chứng chỉ giả mạo hoặc không hợp lệ sẽ bị kỷ luật đình chỉ bảo vệ đồ án tốt nghiệp và xử lý theo quy chế của Bộ GD&ĐT',
      'Sinh viên có chứng chỉ IELTS từ 6.5 trở lên được ưu tiên xét chọn vào các Hội đồng bảo vệ bằng tiếng Anh để nhận giấy khen của Hiệu trưởng'
    ],
    highlight: 'Đặc biệt: Sinh viên chương trình CNTT Việt - Anh bắt buộc phải nộp chứng chỉ tiếng Anh tương đương IELTS 6.0 trở lên.',
    attachments: [
      { name: 'Bang_quy_doi_chuan_dau_ra_ngoai_ngu_UTC.pdf', size: '340 KB' },
      { name: 'Danh_sach_don_vi_cap_chung_chi_duoc_chap_nhan.docx', size: '95 KB' }
    ],
    contact: 'Bộ phận Khảo thí & Chuẩn đầu ra - Phòng Đào tạo (P.208 - A1). Email: daotao@utc.edu.vn.'
  },
  {
    id: 'train-timeline-k62',
    category: 'training',
    categoryName: 'Tin Đào Tạo & Đồ Án',
    title: 'Thông báo lịch đăng ký bổ sung, duyệt đề cương Đồ án Tốt nghiệp đợt 1 năm học 2026 - 2027',
    date: '10/08/2026',
    author: 'Văn phòng Khoa Công nghệ Thông tin - UTC',
    badge: 'Đề cương ĐATN',
    badgeClass: 'badge-training',
    summary: 'Kế hoạch nộp quyển đề cương ĐATN chi tiết (bản có chữ ký của GVHD) và lịch họp xét duyệt đề cương của các Bộ môn Khoa CNTT.',
    content: [
      'Khoa Công nghệ Thông tin thông báo lịch trình thực hiện Giai đoạn 3 (Nộp và Phê duyệt Đề cương ĐATN) đợt 1 năm học 2026 - 2027 như sau:',
      '1. Nộp đề cương số hóa: Sinh viên tải lên bản mềm PDF đề cương chi tiết (đã được Giảng viên hướng dẫn duyệt và ký xác nhận) tại phân hệ Smart FYP UTC trước 23h59 ngày 25/08/2026.',
      '2. Hội đồng Khoa và Trưởng Bộ môn sẽ tiến hành đánh giá và phản hồi kết quả trực tiếp trên hệ thống với 3 trạng thái: Approved (Đạt), Request Revision (Cần sửa lại), hoặc Rejected (Từ chối).',
      '3. Đối với đề cương yêu cầu chỉnh sửa, sinh viên có thời hạn tối đa 5 ngày kể từ ngày nhận thông báo để hoàn thiện và nộp lại.'
    ],
    bullets: [
      'Đề cương phải tuân thủ đúng biểu mẫu chuẩn của Khoa CNTT (tối thiểu 15 - 20 trang)',
      'Phải nêu rõ: Lý do chọn đề tài, Mục tiêu nghiên cứu, Đối tượng & Phạm vi, Công nghệ sử dụng, và Kế hoạch chi tiết theo 15 tuần',
      'Tuyệt đối không sao chép đề tài của các khóa trước (hệ thống tự động kiểm tra tương đồng qua Turnitin)'
    ],
    highlight: 'Hạn cuối Giảng viên hướng dẫn ký duyệt đề cương: 23/08/2026. Sinh viên chủ động liên hệ GVHD để hoàn tất chữ ký.',
    attachments: [
      { name: 'Mau_De_Cuong_Chi_Tiet_DATN_Khoa_CNTT_2026.doc', size: '220 KB' },
      { name: 'Quy_dinh_dinh_dang_va_trich_dan_tai_lieu.pdf', size: '410 KB' }
    ],
    contact: 'Văn phòng Khoa CNTT - P.402 Nhà A9. Hotline hỗ trợ: (024) 37664422.'
  },
  {
    id: 'train-midterm-eval',
    category: 'training',
    categoryName: 'Tin Đào Tạo & Đồ Án',
    title: 'Lịch báo cáo Đánh giá Giữa kỳ Đồ án Tốt nghiệp các Khoa CNTT, Điện tử, Cầu đường (10/08 - 23/08)',
    date: '06/08/2026',
    author: 'Hội đồng Khoa CNTT & Ban Đào tạo',
    badge: 'Báo cáo giữa kỳ',
    badgeClass: 'badge-training',
    summary: 'Lịch tổ chức buổi đánh giá tiến độ đồ án giữa kỳ (Giai đoạn 5) và yêu cầu demo sản phẩm thực tế đối với sinh viên làm đồ án tốt nghiệp.',
    content: [
      'Để đảm bảo chất lượng và tiến độ thực hiện ĐATN, Khoa CNTT phối hợp cùng các Khoa chuyên ngành tổ chức đợt Đánh giá Tiến độ Giữa kỳ từ ngày 10/08 đến 23/08/2026.',
      'Tất cả sinh viên bắt buộc phải tham gia báo cáo trực tiếp trước Tiểu ban Đánh giá hoặc trực tuyến có ghi hình để được xét điều kiện tiếp tục hoàn thiện đồ án.'
    ],
    bullets: [
      'Thời lượng báo cáo: 10 phút thuyết trình Slide + 10 phút Demo chức năng hệ thống phần mềm',
      'Khối lượng công việc tối thiểu: Đã hoàn thành 50% các chức năng cốt lõi đã cam kết trong đề cương',
      'Kết quả đánh giá: Giảng viên chấm điểm tiến độ và đánh giá điểm chữ (A, B, C, D, F) trực tiếp vào phiếu kiểm tra giữa kỳ trên hệ thống Smart FYP'
    ],
    highlight: 'Những sinh viên vắng mặt không có lý do chính đáng hoặc tiến độ < 30% sẽ bị cảnh báo học vụ và dừng làm đồ án.',
    attachments: [
      { name: 'Lich_chia_ca_bao_cao_giua_ky_Khoa_CNTT.xlsx', size: '185 KB' },
      { name: 'Mau_Slide_Thuyet_Trinh_Tien_Do_Giua_Ky.pptx', size: '1.5 MB' }
    ],
    contact: 'Các bộ môn chuyên môn: Bộ môn KHMT, Bộ môn KTPM, Bộ môn Mạng & ATTT - Nhà A9.'
  },
  {
    id: 'train-thesis-guide',
    category: 'training',
    categoryName: 'Tin Đào Tạo & Đồ Án',
    title: 'Hướng dẫn viết và trình bày Báo cáo Đồ án Tốt nghiệp chuẩn mẫu ĐH GTVT',
    date: '01/08/2026',
    author: 'Ban Học vụ Khoa CNTT',
    badge: 'Quy chuẩn ĐATN',
    badgeClass: 'badge-training',
    summary: 'Bộ quy chuẩn trình bày thuyết minh ĐATN, quy cách đóng bìa da mạ vàng và quy tắc định dạng danh mục tài liệu tham khảo theo IEEE.',
    content: [
      'Khoa CNTT ban hành hướng dẫn chi tiết về cấu trúc quyển thuyết minh ĐATN dành cho sinh viên chuẩn bị bảo vệ trước Hội đồng chấm đồ án:',
      'Quyển đồ án gồm 4 chương chính: Chương 1: Tổng quan bài toán; Chương 2: Cơ sở lý thuyết và công nghệ; Chương 3: Phân tích thiết kế hệ thống; Chương 4: Cài đặt, thử nghiệm và đánh giá kết quả.'
    ],
    bullets: [
      'Font chữ: Times New Roman, cỡ 13, giãn dòng 1.3 lines, căn lề trái 3.5cm, phải 2cm, trên/dưới 2.5cm',
      'Trích dẫn tài liệu tham khảo: Bắt buộc đánh số theo định dạng IEEE [1], [2]...',
      'Mỗi sinh viên phải nộp 03 quyển bìa mềm cho phản biện và 01 quyển bìa cứng mạ vàng lưu thư viện sau bảo vệ'
    ],
    attachments: [
      { name: 'Mau_Thuyet_Minh_DATN_Chuan_UTC_2026.docx', size: '650 KB' },
      { name: 'Huong_dan_danh_so_tai_lieu_tham_khao_IEEE.pdf', size: '280 KB' }
    ]
  },
  {
    id: 'news-health-insurance',
    category: 'school',
    categoryName: 'Tin Nhà Trường',
    title: 'Thông báo gia hạn Bảo hiểm Y tế bắt buộc cho sinh viên năm học 2026 - 2027',
    date: '28/07/2026',
    author: 'Trạm Y tế - Trường ĐH Giao thông Vận tải',
    badge: 'Y tế & BHYT',
    badgeClass: 'badge-school',
    summary: 'Kế hoạch thu và cấp phát thẻ Bảo hiểm Y tế điện tử (VssID) cho sinh viên toàn trường theo Luật BHYT sửa đổi.',
    content: [
      'Căn cứ Luật Bảo hiểm Y tế và hướng dẫn của Bảo hiểm Xã hội TP. Hà Nội, Trạm Y tế trường thông báo về mức phí BHYT học sinh - sinh viên năm học 2026 - 2027 (được ngân sách nhà nước hỗ trợ 30% mức đóng).',
      'Sinh viên nộp phí trực tuyến qua cổng thanh toán VNPay của Nhà trường để được gia hạn tự động trên ứng dụng VssID.'
    ],
    bullets: [
      'Mức đóng: 705.600 VNĐ / 12 tháng',
      'Thời hạn hoàn thành: Trước ngày 15/09/2026',
      'Sinh viên đã có thẻ BHYT diện chính sách (hộ nghèo, thân nhân sĩ quan...) nộp bản chụp thẻ để được miễn trừ'
    ]
  }
];

interface UTCNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * If an article is specifically selected, render the Detail Reader view.
   * If null/undefined, render the Full News Portal list view.
   */
  newsItem?: UTCNewsItem | null;
  /**
   * Default category filter when opening the portal list
   */
  initialCategory?: 'all' | 'school' | 'training' | 'recruitment';
  /**
   * Callback when a news item is clicked in the portal list
   */
  onSelectNews?: (item: UTCNewsItem) => void;
}

export const UTCNewsModal: React.FC<UTCNewsModalProps> = ({
  isOpen,
  onClose,
  newsItem,
  initialCategory = 'all',
  onSelectNews,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'school' | 'training' | 'recruitment'>(initialCategory);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<UTCNewsItem | null>(newsItem || null);

  // Sync internal state if prop changes
  React.useEffect(() => {
    setCurrentArticle(newsItem || null);
  }, [newsItem]);

  React.useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  // Filtered news items for Portal List view
  const filteredNews = useMemo(() => {
    return UTC_NEWS_DATA.filter((item) => {
      const matchCategory =
        selectedCategory === 'all' ? true : item.category === selectedCategory;
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.summary.toLowerCase().includes(term) ||
        item.author.toLowerCase().includes(term) ||
        item.badge.toLowerCase().includes(term);

      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchTerm]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const textToCopy = currentArticle
        ? `${currentArticle.title}\n📅 Ngày ban hành: ${currentArticle.date}\n🏛️ Ban hành: ${currentArticle.author}\n\n${currentArticle.summary}`
        : window.location.href;
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleDownload = (fileName: string) => {
    alert(`📥 Đang kết nối tải tệp đính kèm: "${fileName}" từ Cổng thông tin đào tạo UTC...`);
  };

  // 1. DETAIL READER VIEW (When reading a specific article)
  if (currentArticle) {
    return (
      <div className="utc-news-overlay" onClick={onClose}>
        <div className="utc-news-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          {/* Header */}
          <div className="utc-news-modal-header">
            <div>
              <div className="utc-news-header-meta">
                <span className={`utc-news-badge ${currentArticle.badgeClass}`}>
                  {currentArticle.badge}
                </span>
                <span className="utc-news-date-tag">
                  📅 {currentArticle.date}
                </span>
                <span className="utc-news-author-tag">
                  • {currentArticle.author}
                </span>
              </div>
              <h2 className="utc-news-modal-title">{currentArticle.title}</h2>
            </div>
            <button className="utc-news-close-btn" onClick={onClose} title="Đóng">
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="utc-news-modal-body">
            {/* Summary Callout */}
            <div className="utc-news-summary-box">
              <strong>📌 Tóm tắt nội dung: </strong>
              {currentArticle.summary}
            </div>

            {/* Content paragraphs */}
            <div className="utc-news-content">
              <h4 className="utc-news-section-title">📄 Nội dung thông báo</h4>
              {currentArticle.content.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>

            {/* Bullets */}
            {currentArticle.bullets && currentArticle.bullets.length > 0 && (
              <div>
                <h4 className="utc-news-section-title">📋 Chi tiết yêu cầu & Hướng dẫn</h4>
                <ul className="utc-news-list-bullets">
                  {currentArticle.bullets.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Highlight Banner */}
            {currentArticle.highlight && (
              <div className="utc-news-highlight-banner">
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <div>{currentArticle.highlight}</div>
              </div>
            )}

            {/* Attachments */}
            {currentArticle.attachments && currentArticle.attachments.length > 0 && (
              <div className="utc-news-attachments">
                <strong style={{ color: '#003366', display: 'flex', alignItems: 'center', gap: 6 }}>
                  📎 Tệp đính kèm văn bản ({currentArticle.attachments.length}):
                </strong>
                {currentArticle.attachments.map((att, idx) => (
                  <div key={idx} className="utc-news-attachment-item">
                    <div className="utc-attachment-info">
                      <span className="utc-attachment-icon">📄</span>
                      <div>
                        <span className="utc-attachment-name">{att.name}</span>
                        <span className="utc-attachment-size">({att.size})</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="utc-btn-download-attach"
                      onClick={() => handleDownload(att.name)}
                    >
                      Tải về
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Contact Box */}
            {currentArticle.contact && (
              <div className="utc-news-contact-card">
                <strong>📞 Đầu mối hỗ trợ & Liên hệ: </strong>
                <span>{currentArticle.contact}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="utc-news-modal-footer">
            <div className="utc-news-actions-left">
              <button type="button" className="utc-news-btn utc-news-btn-secondary" onClick={handlePrint}>
                🖨️ In thông báo
              </button>
              <button type="button" className="utc-news-btn utc-news-btn-secondary" onClick={handleCopy}>
                {copied ? '✓ Đã sao chép!' : '📋 Sao chép nội dung'}
              </button>
              {newsItem && (
                <button
                  type="button"
                  className="utc-news-btn utc-news-btn-secondary"
                  onClick={() => setCurrentArticle(null)}
                >
                  ← Về danh sách tin
                </button>
              )}
            </div>
            <button type="button" className="utc-news-btn utc-news-btn-primary" onClick={onClose}>
              Đóng lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. FULL NEWS PORTAL LIST VIEW
  return (
    <div className="utc-news-overlay" onClick={onClose}>
      <div
        className="utc-news-dialog utc-news-portal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="utc-news-modal-header">
          <div>
            <div className="utc-news-header-meta">
              <span className="utc-news-badge badge-school">CỔNG BẢN TIN & THÔNG BÁO</span>
              <span className="utc-news-date-tag">Trường Đại học Giao thông Vận tải (UTC)</span>
            </div>
            <h2 className="utc-news-modal-title">Bản Tin & Thông Báo Đồ Án Tốt Nghiệp</h2>
          </div>
          <button className="utc-news-close-btn" onClick={onClose} title="Đóng">
            ✕
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="utc-portal-search-bar">
          <div className="utc-portal-input-wrap">
            <span className="utc-portal-input-icon">🔍</span>
            <input
              type="text"
              className="utc-portal-input"
              placeholder="Tìm kiếm thông báo theo tiêu đề, phòng ban, từ khóa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="utc-portal-filter-tabs">
            <button
              type="button"
              className={`utc-portal-tab ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              📌 Tất cả ({UTC_NEWS_DATA.length})
            </button>
            <button
              type="button"
              className={`utc-portal-tab ${selectedCategory === 'school' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('school')}
            >
              🏛️ Tin Nhà Trường ({UTC_NEWS_DATA.filter((n) => n.category === 'school').length})
            </button>
            <button
              type="button"
              className={`utc-portal-tab ${selectedCategory === 'training' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('training')}
            >
              🎓 Tin Đào Tạo & ĐATN ({UTC_NEWS_DATA.filter((n) => n.category === 'training').length})
            </button>
            <button
              type="button"
              className={`utc-portal-tab ${selectedCategory === 'recruitment' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('recruitment')}
            >
              💼 Tuyển Dụng & Việc Làm ({UTC_NEWS_DATA.filter((n) => n.category === 'recruitment').length})
            </button>
          </div>
        </div>

        {/* Portal Articles List */}
        <div className="utc-portal-list">
          {filteredNews.length === 0 ? (
            <div className="utc-portal-empty-state">
              <div className="utc-portal-empty-icon">📭</div>
              <h4>Không tìm thấy thông báo nào phù hợp</h4>
              <p>Vui lòng thử tìm kiếm với từ khóa khác hoặc chuyển danh mục.</p>
            </div>
          ) : (
            filteredNews.map((item) => (
              <div
                key={item.id}
                className="utc-portal-item-card"
                onClick={() => {
                  if (onSelectNews) {
                    onSelectNews(item);
                  }
                  setCurrentArticle(item);
                }}
              >
                <div className="utc-portal-item-top">
                  <span className={`utc-news-badge ${item.badgeClass}`}>
                    {item.badge}
                  </span>
                  <span className="utc-news-date-tag">📅 {item.date}</span>
                </div>
                <h3 className="utc-portal-item-title">{item.title}</h3>
                <p className="utc-portal-item-summary">{item.summary}</p>
                <div className="utc-portal-item-foot">
                  <span>🏛️ {item.author}</span>
                  <span className="utc-portal-read-link">
                    Xem chi tiết thông báo →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="utc-news-modal-footer">
          <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
            Hiển thị <strong>{filteredNews.length}</strong> / <strong>{UTC_NEWS_DATA.length}</strong> thông báo chính thức
          </div>
          <button type="button" className="utc-news-btn utc-news-btn-primary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default UTCNewsModal;

