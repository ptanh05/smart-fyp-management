import os
import sys
import shutil
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
import openpyxl
from pptx import Presentation
from pptx.util import Inches as PptInches, Pt as PptPt

font_path = r'C:\Windows\Fonts\arial.ttf'
bold_path = r'C:\Windows\Fonts\arialbd.ttf'
pdfmetrics.registerFont(TTFont('ArialVN', font_path))
pdfmetrics.registerFont(TTFont('ArialVNBold', bold_path if os.path.exists(bold_path) else font_path))

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pub_dir = os.path.join(base_dir, 'frontend', 'public', 'attachments')
media_dir = os.path.join(base_dir, 'backend', 'media', 'news_attachments')
template_media_dir = os.path.join(base_dir, 'backend', 'media', 'doc_templates')

for d in [pub_dir, media_dir, template_media_dir]:
    os.makedirs(d, exist_ok=True)

w, h = A4

def draw_standard_header(c, org_top, org_bot, doc_num, title, subtitle=''):
    c.setFont('ArialVNBold', 10)
    c.drawString(40, h - 50, org_top)
    c.drawString(40, h - 65, org_bot)
    c.setFont('ArialVN', 9)
    c.drawString(40, h - 80, doc_num)

    c.setFont('ArialVNBold', 10)
    c.drawRightString(w - 40, h - 50, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')
    c.drawRightString(w - 40, h - 65, 'Độc lập - Tự do - Hạnh phúc')
    c.setFont('ArialVN', 9)
    c.drawRightString(w - 40, h - 80, 'Hà Nội, năm 2026')

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.8)
    c.line(40, h - 86, 220, h - 86)
    c.line(w - 200, h - 86, w - 40, h - 86)

    c.setFont('ArialVNBold', 14)
    c.drawCentredString(w / 2, h - 120, title)
    if subtitle:
        c.setFont('ArialVN', 10)
        c.drawCentredString(w / 2, h - 138, subtitle)

# 1. Don_de_nghi_mien_giam_hoc_phi_2026_UTC.pdf
pdf_path = os.path.join(pub_dir, 'Don_de_nghi_mien_giam_hoc_phi_2026_UTC.pdf')
c1 = canvas.Canvas(pdf_path, pagesize=A4)
draw_standard_header(c1, 'BỘ GIÁO DỤC VÀ ĐÀO TẠO', 'TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI', 'Số: 45/ĐN-CTCT&SV', 'ĐƠN ĐỀ NGHỊ MIỄN, GIẢM HỌC PHÍ', 'Học kỳ I - Năm học 2026 - 2027 (Khóa K61 - K64)')
y = h - 165
lines_1 = [
    ('Kính gửi:', 'ArialVNBold', 11),
    ('   - Ban Giám hiệu Trường Đại học Giao thông Vận tải;', 'ArialVN', 10),
    ('   - Phòng Công tác Chính trị và Sinh viên (CTCT&SV);', 'ArialVN', 10),
    ('   - Phòng Đào tạo & Phòng Tài chính - Kế toán.', 'ArialVN', 10),
    ('', 'ArialVN', 5),
    ('Họ và tên sinh viên: ............................................................................ Giới tính: ....................', 'ArialVN', 10),
    ('Ngày, tháng, năm sinh: ....../....../........... Nơi sinh: ..................................................................', 'ArialVN', 10),
    ('Mã số sinh viên (MSSV): ............................................ Lớp: ................................................', 'ArialVN', 10),
    ('Khoa: Công nghệ Thông tin .................................... Khóa học: .............................................', 'ArialVN', 10),
    ('Số Căn cước công dân: .................................... Ngày cấp: ...../...../......... Nơi cấp: .............', 'ArialVN', 10),
    ('Hộ khẩu thường trú: .................................................................................................................', 'ArialVN', 10),
    ('Điện thoại liên hệ: ............................................ Email sinh viên: ..........................................', 'ArialVN', 10),
    ('', 'ArialVN', 5),
    ('Căn cứ Nghị định số 81/2021/NĐ-CP của Chính phủ, em làm đơn này đề nghị Nhà trường', 'ArialVN', 10),
    ('xét duyệt chế độ cho em theo diện (đánh dấu X vào ô tương ứng):', 'ArialVN', 10),
    ('[   ] 1. Miễn 100% học phí (Con liệt sĩ, con thương binh/bệnh binh nặng, SV khuyết tật)', 'ArialVN', 10),
    ('[   ] 2. Miễn 100% học phí (Sinh viên người dân tộc thiểu số tại vùng ĐBKK theo QĐ)', 'ArialVN', 10),
    ('[   ] 3. Giảm 70% học phí (Dân tộc thiểu số ở thôn/bản đặc biệt khó khăn)', 'ArialVN', 10),
    ('[   ] 4. Giảm 50% học phí (Con cán bộ công chức bị tai nạn LĐ/Bệnh nghề nghiệp)', 'ArialVN', 10),
    ('', 'ArialVN', 5),
    ('Hồ sơ giấy tờ gửi kèm đơn gồm có:', 'ArialVNBold', 10),
    ('   1. Bản sao công chứng Căn cước công dân và Giấy khai sinh.', 'ArialVN', 9.5),
    ('   2. Giấy chứng nhận đối tượng chính sách / Thẻ thương binh / Giấy chứng nhận hộ nghèo 2026.', 'ArialVN', 9.5),
    ('   3. Giấy xác nhận thông tin về cư trú (Mẫu CT07) có xác nhận của Công an địa phương.', 'ArialVN', 9.5),
    ('', 'ArialVN', 5),
    ('Em xin cam đoan các thông tin kê khai trên là hoàn toàn chính xác. Nếu sai em xin chịu mọi', 'ArialVN', 10),
    ('trách nhiệm trước Nhà trường và pháp luật.', 'ArialVN', 10),
]
for text, fn, sz in lines_1:
    c1.setFont(fn, sz)
    c1.drawString(45, y, text)
    y -= (sz + 5)

y_sig = 95
c1.setFont('ArialVNBold', 10)
c1.drawString(50, y_sig, 'XÁC NHẬN CỦA ĐỊA PHƯƠNG')
c1.drawString(50, y_sig - 14, '(UBND Xã / Phường nơi cư trú)')
c1.setFont('ArialVN', 9)
c1.drawString(50, y_sig - 28, '(Ký tên, ghi rõ họ tên và đóng dấu)')

c1.setFont('ArialVNBold', 10)
c1.drawRightString(w - 50, y_sig, 'NGƯỜI LÀM ĐƠN')
c1.setFont('ArialVN', 9)
c1.drawRightString(w - 50, y_sig - 14, '(Ký và ghi rõ họ tên)')
c1.save()
print('Generated Don_de_nghi_mien_giam_hoc_phi_2026_UTC.pdf')

# 2. Huong_dan_ho_so_chinh_sach_K61_K64.docx
doc2 = docx.Document()
h2 = doc2.add_paragraph()
h2.alignment = WD_ALIGN_PARAGRAPH.CENTER
h2_run = h2.add_run('TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI\nPHÒNG CÔNG TÁC CHÍNH TRỊ VÀ SINH VIÊN\n***\n')
h2_run.bold = True
h2_run.font.size = Pt(12)

t2 = doc2.add_paragraph()
t2.alignment = WD_ALIGN_PARAGRAPH.CENTER
t2_run = t2.add_run('HƯỚNG DẪN HOÀN THIỆN HỒ SƠ CHẾ ĐỘ CHÍNH SÁCH\nNĂM HỌC 2026 - 2027 (KHÓA K61 - K64)\n')
t2_run.bold = True
t2_run.font.size = Pt(14)
t2_run.font.color.rgb = RGBColor(0, 51, 102)

p = doc2.add_paragraph()
p.add_run('Căn cứ quy định hiện hành về chế độ miễn giảm học phí và trợ cấp xã hội, Phòng CTCT&SV hướng dẫn sinh viên các bước chuẩn bị hồ sơ như sau:\n\n')
p.add_run('I. CÁC NHÓM ĐỐI TƯỢNG VÀ HỒ SƠ YÊU CẦU:\n').bold = True
p.add_run('1. Nhóm đối tượng 1: Miễn 100% học phí theo Nghị định 81/2021/NĐ-CP:\n')
p.add_run('   - Đơn đề nghị theo mẫu UTC 2026 (Mẫu ban hành đính kèm).\n')
p.add_run('   - Giấy chứng nhận người có công / Thẻ thương binh của cha/mẹ (bản sao công chứng).\n')
p.add_run('   - Giấy khai sinh và Căn cước công dân (bản sao công chứng).\n\n')
p.add_run('2. Nhóm đối tượng 2: Sinh viên diện hộ nghèo, cận nghèo:\n')
p.add_run('   - Giấy chứng nhận hộ nghèo/cận nghèo cấp năm 2026 (bản công chứng có dấu đỏ).\n')
p.add_run('   - Giấy xác nhận thông tin cư trú Mẫu CT07.\n\n')
p.add_run('II. QUY TRÌNH TIẾP NHẬN VÀ TRẢ KẾT QUẢ:\n').bold = True
p.add_run('1. Thời gian nộp: Từ 15/08/2026 đến 17h00 ngày 05/09/2026.\n')
p.add_run('2. Địa điểm: Văn phòng Một cửa sinh viên - P.104 Nhà A1, Trường ĐH Giao thông Vận tải.\n')
p.add_run('3. Kết quả xét duyệt: Sẽ được công bố công khai trên Cổng thông tin Đào tạo UTC trước ngày 20/09/2026.\n\n')
p.add_run('Mọi chi tiết xin liên hệ: Thầy Nguyễn Văn Hưng - Phòng CTCT&SV (Điện thoại: 024.37663311 máy lẻ 105).')
doc2.save(os.path.join(pub_dir, 'Huong_dan_ho_so_chinh_sach_K61_K64.docx'))
print('Generated Huong_dan_ho_so_chinh_sach_K61_K64.docx')

# 3. JD_Chi_tiet_Tuyen_dung_Hoang_Phat_2026.pdf
c3 = canvas.Canvas(os.path.join(pub_dir, 'JD_Chi_tiet_Tuyen_dung_Hoang_Phat_2026.pdf'), pagesize=A4)
draw_standard_header(c3, 'CÔNG TY TNHH TƯ VẤN & CÔNG NGHỆ HOÀNG PHÁT', 'TRUNG TÂM PHÁT TRIỂN PHẦN MỀM GIAO THÔNG', 'Số: 88/TD-HP-2026', 'THÔNG BÁO TUYỂN DỤNG KỸ SƯ CNTT & LẬP TRÌNH VIÊN', 'Dành riêng cho sinh viên tốt nghiệp Trường Đại học Giao thông Vận tải')
y = h - 165
lines_3 = [
    ('1. VỊ TRÍ TUYỂN DỤNG:', 'ArialVNBold', 11),
    ('   • 05 Kỹ sư Backend (Node.js, Python FastAPI, PostgreSQL, Docker)', 'ArialVN', 10),
    ('   • 05 Kỹ sư Frontend (React, TypeScript, Next.js, TailwindCSS)', 'ArialVN', 10),
    ('   • 03 Kỹ sư DevOps & Cloud Infrastructure (Kubernetes, AWS/GCP)', 'ArialVN', 10),
    ('2. CHẾ ĐỘ PHÚC LỢI:', 'ArialVNBold', 11),
    ('   • Lương khởi điểm: 14.000.000 - 25.000.000 VNĐ/tháng (xét tăng lương 2 lần/năm).', 'ArialVN', 10),
    ('   • Thưởng dự án, thưởng tháng lương thứ 13, BHXH full lương.', 'ArialVN', 10),
    ('   • Hỗ trợ 100% kinh phí đồ án tốt nghiệp và trang bị laptop cấu hình cao.', 'ArialVN', 10),
    ('3. YÊU CẦU ỨNG VIÊN:', 'ArialVNBold', 11),
    ('   • Sinh viên năm cuối hoặc tốt nghiệp chuyên ngành CNTT, KHMT, KTPM ĐH GTVT.', 'ArialVN', 10),
    ('   • Điểm GPA tích lũy từ 2.8/4.0 trở lên, tư duy giải thuật tốt.', 'ArialVN', 10),
    ('4. THỜI GIAN VÀ ĐỊA ĐIỂM PHỎNG VẤN:', 'ArialVNBold', 11),
    ('   • 08h30 Thứ Bảy ngày 29/08/2026 tại Hội trường Thư viện UTC - Nhà A9.', 'ArialVN', 10),
]
for text, fn, sz in lines_3:
    c3.setFont(fn, sz)
    c3.drawString(45, y, text)
    y -= (sz + 8)
c3.save()
print('Generated JD_Chi_tiet_Tuyen_dung_Hoang_Phat_2026.pdf')

# 4. Thong_bao_tuyen_dung_VATM_Dot2_2026.pdf
c4 = canvas.Canvas(os.path.join(pub_dir, 'Thong_bao_tuyen_dung_VATM_Dot2_2026.pdf'), pagesize=A4)
draw_standard_header(c4, 'BỘ GIAO THÔNG VẬN TẢI', 'TỔNG CÔNG TY QUẢN LÝ BAY VIỆT NAM (VATM)', 'Số: 120/TB-VATM', 'THÔNG BÁO TUYỂN DỤNG KỸ SƯ HỆ THỐNG ĐIỀU HÀNH BAY', 'Đợt 2 - Năm 2026')
y = h - 165
lines_4 = [
    ('1. CHỈ TIÊU TUYỂN DỤNG:', 'ArialVNBold', 11),
    ('   • 10 Kỹ sư Hệ thống mạng & Viễn thông Hàng không.', 'ArialVN', 10),
    ('   • 05 Kỹ sư Phần mềm giám sát radar điều hành không lưu.', 'ArialVN', 10),
    ('2. TIÊU CHUẨN DỰ TUYỂN:', 'ArialVNBold', 11),
    ('   • Tốt nghiệp Đại học chính quy loại Khá trở lên tại ĐH Giao thông Vận tải.', 'ArialVN', 10),
    ('   • Tiếng Anh: TOEIC tối thiểu 600 điểm hoặc IELTS 5.5 còn thời hạn.', 'ArialVN', 10),
    ('3. ĐÃI NGỘ:', 'ArialVNBold', 11),
    ('   • Thu nhập bình quân từ 22 - 35 triệu VNĐ/tháng cùng chế độ hàng không cao cấp.', 'ArialVN', 10),
    ('   • Cơ hội tu nghiệp kỹ thuật tại Pháp, Đức và Singapore.', 'ArialVN', 10),
    ('4. HÌNH THỨC NỘP HỒ SƠ:', 'ArialVNBold', 11),
    ('   • Nộp hồ sơ trực tuyến tại Cổng tuyển dụng VATM trước ngày 15/09/2026.', 'ArialVN', 10),
]
for text, fn, sz in lines_4:
    c4.setFont(fn, sz)
    c4.drawString(45, y, text)
    y -= (sz + 8)
c4.save()
print('Generated Thong_bao_tuyen_dung_VATM_Dot2_2026.pdf')

# 5. Bang_quy_doi_chuan_dau_ra_ngoai_ngu_UTC.pdf
c_ielts = canvas.Canvas(os.path.join(pub_dir, 'Bang_quy_doi_chuan_dau_ra_ngoai_ngu_UTC.pdf'), pagesize=A4)
draw_standard_header(c_ielts, 'TRƯỜNG ĐH GIAO THÔNG VẬN TẢI', 'PHÒNG ĐÀO TẠO ĐẠI HỌC', 'Số: 112/QĐ-ĐHGTVT', 'BẢNG QUY ĐỔI CHUẨN ĐẦU RA NGOẠI NGỮ ĐỒ ÁN TỐT NGHIỆP', 'Áp dụng cho sinh viên Khóa K61, K62, K63')
y = h - 165
lines_ielts = [
    ('1. KHUNG THAM CHIẾU QUY ĐỔI ĐIỂM NGOẠI NGỮ:', 'ArialVNBold', 11),
    ('   • Khối Kỹ thuật & Công nghệ (CNTT, Điện - Điện tử): TOEIC 550 / IELTS 5.0 / VSTEP B1', 'ArialVN', 10),
    ('   • Khối Chương trình Tiên tiến & CLC Việt - Anh: IELTS 6.0 / TOEFL iBT 65', 'ArialVN', 10),
    ('   • Khối Kinh tế & Vận tải: TOEIC 600 / IELTS 5.5 / VSTEP B2', 'ArialVN', 10),
    ('2. QUY ĐỊNH HẬU KIỂM & XÁC MINH:', 'ArialVNBold', 11),
    ('   • Sinh viên tải ảnh gốc và mã tra cứu chứng chỉ lên Smart FYP UTC trước ngày 20/09/2026.', 'ArialVN', 10),
    ('   • Nhà trường sẽ đối soát trực tiếp cùng IDP, British Council và IIG Việt Nam.', 'ArialVN', 10),
    ('3. ĐIỀU KIỆN XÉT MIỄN HỌC PHẦN NGOẠI NGỮ & ĐATN:', 'ArialVNBold', 11),
    ('   • Sinh viên đạt IELTS >= 6.5 được đặc cách bảo vệ ĐATN bằng tiếng Anh trước Hội đồng quốc tế.', 'ArialVN', 10),
]
for text, fn, sz in lines_ielts:
    c_ielts.setFont(fn, sz)
    c_ielts.drawString(45, y, text)
    y -= (sz + 8)
c_ielts.save()
print('Generated Bang_quy_doi_chuan_dau_ra_ngoai_ngu_UTC.pdf')

# 6. Danh_sach_don_vi_cap_chung_chi_duoc_chap_nhan.docx
doc_cert = docx.Document()
h_c = doc_cert.add_heading('TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI - PHÒNG ĐÀO TẠO', 0)
doc_cert.add_heading('DANH SÁCH ĐƠN VỊ CẤP CHỨNG CHỈ NGOẠI NGỮ HỢP LỆ (2026)', level=1)
doc_cert.add_paragraph('Danh mục các đơn vị và hội đồng khảo thí quốc tế được ĐH Giao thông Vận tải công nhận theo thông tư của Bộ GD&ĐT:')
table_c = doc_cert.add_table(rows=1, cols=3)
hdr_cells = table_c.rows[0].cells
hdr_cells[0].text = 'Tổ chức / Đơn vị cấp'
hdr_cells[1].text = 'Loại chứng chỉ'
hdr_cells[2].text = 'Ghi chú hậu kiểm'
certs_data = [
    ('IDP Education / British Council', 'IELTS Academic', 'Tra cứu mã TRF trực tuyến'),
    ('IIG Việt Nam / ETS', 'TOEIC, TOEFL iBT', 'Xác thực qua hệ thống ETS Official'),
    ('Trường ĐH Ngoại ngữ - ĐHQGHN', 'VSTEP B1/B2/C1', 'Tra cứu qua Cổng văn bằng ĐHQG'),
    ('Trường ĐH Hà Nội (HANU)', 'VSTEP B1/B2/C1', 'Tra cứu văn bằng trực tuyến')
]
for org, cert, note in certs_data:
    row_cells = table_c.add_row().cells
    row_cells[0].text = org
    row_cells[1].text = cert
    row_cells[2].text = note
doc_cert.save(os.path.join(pub_dir, 'Danh_sach_don_vi_cap_chung_chi_duoc_chap_nhan.docx'))
print('Generated Danh_sach_don_vi_cap_chung_chi_duoc_chap_nhan.docx')

# 7. Mau_De_Cuong_Chi_Tiet_DATN_Khoa_CNTT_2026.doc / docx
doc_decuong = docx.Document()
doc_decuong.add_heading('TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI\nKHOA CÔNG NGHỆ THÔNG TIN', 0)
doc_decuong.add_heading('ĐỀ CƯƠNG CHI TIẾT ĐỒ ÁN TỐT NGHIỆP ĐẠI HỌC', level=1)
doc_decuong.add_paragraph('Tên đề tài tiếng Việt: .........................................................................................................................')
doc_decuong.add_paragraph('Tên đề tài tiếng Anh: ...........................................................................................................................')
doc_decuong.add_paragraph('Sinh viên thực hiện: ...................................................... MSSV: .......................... Lớp: .................')
doc_decuong.add_paragraph('Giảng viên hướng dẫn: .................................................. Bộ môn: ...............................................')
doc_decuong.add_paragraph('\nNỘI DUNG ĐỀ CƯƠNG CHI TIẾT:')
for item in [
    '1. Tính cấp thiết và mục tiêu nghiên cứu của đề tài',
    '2. Đối tượng nghiên cứu, phạm vi ứng dụng và khảo sát hiện trạng',
    '3. Cơ sở lý thuyết, các công nghệ & kiến trúc hệ thống áp dụng',
    '4. Thiết kế các chức năng chính và cơ sở dữ liệu dự kiến',
    '5. Kế hoạch triển khai thực hiện theo 15 tuần làm việc',
    '6. Kết quả dự kiến đạt được (sản phẩm phần mềm, báo cáo kỹ thuật)'
]:
    doc_decuong.add_paragraph('   ' + item)
# Save both .docx and .doc
doc_decuong.save(os.path.join(pub_dir, 'Mau_De_Cuong_Chi_Tiet_DATN_Khoa_CNTT_2026.docx'))
doc_decuong.save(os.path.join(pub_dir, 'Mau_De_Cuong_Chi_Tiet_DATN_Khoa_CNTT_2026.doc'))
print('Generated Mau_De_Cuong_Chi_Tiet_DATN_Khoa_CNTT_2026.doc')

# 8. Quy_dinh_dinh_dang_va_trich_dan_tai_lieu.pdf
c_fmt = canvas.Canvas(os.path.join(pub_dir, 'Quy_dinh_dinh_dang_va_trich_dan_tai_lieu.pdf'), pagesize=A4)
draw_standard_header(c_fmt, 'TRƯỜNG ĐH GIAO THÔNG VẬN TẢI', 'KHOA CÔNG NGHỆ THÔNG TIN', 'Số: 68/QĐ-CNTT-UTC', 'QUY ĐỊNH ĐỊNH DẠNG VÀ TRÍCH DẪN TÀI LIỆU ĐATN', 'Ban hành năm học 2026 - 2027')
y = h - 165
lines_fmt = [
    ('1. ĐỊNH DẠNG KHỔ GIẤY VÀ CĂN LỀ:', 'ArialVNBold', 11),
    ('   • Khổ giấy A4 (210 x 297 mm), in một mặt trên giấy định lượng 80gsm.', 'ArialVN', 10),
    ('   • Căn lề: Lề trên: 2.5 cm, Lề dưới: 2.5 cm, Lề trái (đóng gáy): 3.5 cm, Lề phải: 2.0 cm.', 'ArialVN', 10),
    ('2. KIỂU CHỮ VÀ GIÃN DÒNG:', 'ArialVNBold', 11),
    ('   • Kiểu chữ: Times New Roman, Cỡ chữ: 13 pt, Giãn dòng: 1.3 lines, Before/After: 3pt.', 'ArialVN', 10),
    ('3. ĐÁNH SỐ TRANG VÀ ĐẦU TRANG:', 'ArialVNBold', 11),
    ('   • Phần phụ lục, mục lục: Đánh số La Mã thường (i, ii, iii...).', 'ArialVN', 10),
    ('   • Phần nội dung chính từ Chương 1: Đánh số Ả Rập (1, 2, 3...) ở giữa cuối trang.', 'ArialVN', 10),
]
for text, fn, sz in lines_fmt:
    c_fmt.setFont(fn, sz)
    c_fmt.drawString(45, y, text)
    y -= (sz + 8)
c_fmt.save()
print('Generated Quy_dinh_dinh_dang_va_trich_dan_tai_lieu.pdf')

# 9. Lich_chia_ca_bao_cao_giua_ky_Khoa_CNTT.xlsx
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Lich_Bao_Cao_Giua_Ky"
ws.append(["TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI - KHOA CÔNG NGHỆ THÔNG TIN"])
ws.append(["LỊCH BÁO CÁO ĐÁNH GIÁ TIẾN ĐỘ GIỮA KỲ ĐATN NĂM 2026"])
ws.append([])
ws.append(["STT", "Hội đồng / Tiểu ban", "Mã SV", "Họ và tên SV", "Tên đề tài ĐATN", "GV Hướng Dẫn", "Ngày báo cáo", "Phòng họp / Link Meet"])
demo_rows = [
    [1, "Tiểu ban KHMT 01", "201200001", "Nguyễn Văn An", "Đề tài tốt nghiệp của Nguyễn Văn An", "TS. Trần Thị Ngân", "15/08/2026 - 08h30", "P.402 - A9"],
    [2, "Tiểu ban KTPM 02", "201200011", "Trần Quang Hùng", "Hệ thống quản lý chuỗi cung ứng logistics", "PGS.TS. Nguyễn Văn Long", "15/08/2026 - 09h15", "P.403 - A9"],
    [3, "Tiểu ban Mạng & ATTT", "201200102", "Đỗ Minh Hải", "Nghiên cứu kiến trúc Zero Trust Network Access", "TS. Phạm Tuấn Anh", "16/08/2026 - 08h30", "P.405 - A9"],
    [4, "Tiểu ban HTTT 01", "201200012", "Lê Quốc Khánh", "Ứng dụng AI nhận diện biển báo giao thông", "ThS. Vũ Thị Mai", "16/08/2026 - 10h00", "P.402 - A9"],
]
for r in demo_rows:
    ws.append(r)
wb.save(os.path.join(pub_dir, 'Lich_chia_ca_bao_cao_giua_ky_Khoa_CNTT.xlsx'))
print('Generated Lich_chia_ca_bao_cao_giua_ky_Khoa_CNTT.xlsx')

# 10. Mau_Slide_Thuyet_Trinh_Tien_Do_Giua_Ky.pptx
prs = Presentation()
title_slide_layout = prs.slide_layouts[0]
slide = prs.slides.add_slide(title_slide_layout)
title = slide.shapes.title
subtitle = slide.placeholders[1]
title.text = "BÁO CÁO TIẾN ĐỘ GIỮA KỲ ĐATN"
subtitle.text = "Trường Đại học Giao thông Vận tải - Khoa CNTT\nSinh viên: [Họ và tên] | MSSV: [Mã số SV]\nGV Hướng Dẫn: [Họ tên GVHD]"

bullet_layout = prs.slide_layouts[1]
s2 = prs.slides.add_slide(bullet_layout)
s2.shapes.title.text = "Cấu trúc báo cáo tiến độ (10 phút)"
tf2 = s2.shapes.placeholders[1].text_frame
tf2.text = "1. Tóm tắt mục tiêu và phạm vi đề tài"
p = tf2.add_paragraph()
p.text = "2. Khối lượng công việc đã hoàn thành (50% Milestone)"
p = tf2.add_paragraph()
p.text = "3. Demo trực tiếp chức năng hệ thống đang chạy"
p = tf2.add_paragraph()
p.text = "4. Khó khăn vướng mắc và giải pháp khắc phục"
p = tf2.add_paragraph()
p.text = "5. Kế hoạch hoàn thiện 50% còn lại trước đợt bảo vệ"

prs.save(os.path.join(pub_dir, 'Mau_Slide_Thuyet_Trinh_Tien_Do_Giua_Ky.pptx'))
print('Generated Mau_Slide_Thuyet_Trinh_Tien_Do_Giua_Ky.pptx')

# 11. Mau_Thuyet_Minh_DATN_Chuan_UTC_2026.docx
doc5 = docx.Document()
h5 = doc5.add_paragraph()
h5.alignment = WD_ALIGN_PARAGRAPH.CENTER
h5_run = h5.add_run('TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI\nKHOA CÔNG NGHỆ THÔNG TIN\nBỘ MÔN HỆ THỐNG THÔNG TIN\n\n')
h5_run.bold = True
h5_run.font.size = Pt(13)

t5 = doc5.add_paragraph()
t5.alignment = WD_ALIGN_PARAGRAPH.CENTER
t5_run = t5.add_run('THUYẾT MINH ĐỒ ÁN TỐT NGHIỆP ĐẠI HỌC\n\n')
t5_run.bold = True
t5_run.font.size = Pt(18)
t5_run.font.color.rgb = RGBColor(0, 51, 102)

p_topic = doc5.add_paragraph()
p_topic.alignment = WD_ALIGN_PARAGRAPH.CENTER
r_top = p_topic.add_run('ĐỀ TÀI: [NHẬP TÊN ĐỀ TÀI TIẾNG VIỆT CHÍNH THỨC Ở ĐÂY]\nTHESIS TITLE: [ENTER ENGLISH TITLE HERE]\n\n')
r_top.bold = True
r_top.font.size = Pt(13)

doc5.add_paragraph('Sinh viên thực hiện: ........................................................... MSSV: ...............................')
doc5.add_paragraph('Lớp: ..................................................................................... Khóa: K61 CNTT')
doc5.add_paragraph('Giảng viên hướng dẫn: ................................................... Học hàm/học vị: ..................')
doc5.add_paragraph('Bộ môn: Hệ thống thông tin / Mạng & An toàn thông tin')
doc5.add_paragraph('\n\nMỤC LỤC TÀI LIỆU:')
for ch in [
    'LỜI CAM ĐOAN',
    'LỜI CẢM ƠN',
    'DANH MỤC CÁC CHỮ VIẾT TẮT, HÌNH VẼ, BẢNG BIỂU',
    'CHƯƠNG 1: TỔNG QUAN VÀ ĐẶT VẤN ĐỀ',
    'CHƯƠNG 2: PHÂN TÍCH YÊU CẦU VÀ THIẾT KẾ KIẾN TRÚC HỆ THỐNG',
    'CHƯƠNG 3: HIỆN THỰC HÓA VÀ CÀI ĐẶT HỆ THỐNG THỰC NGHIỆM',
    'CHƯƠNG 4: THỬ NGHIỆM, ĐÁNH GIÁ KẾT QUẢ VÀ TỐI ƯU HIỆU NĂNG',
    'KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN TIẾP THEO',
    'TÀI LIỆU THAM KHẢO (THEO ĐỊNH DẠNG IEEE)',
    'PHỤ LỤC: MÃ NGUỒN VÀ DỮ LIỆU ĐO KIỂM'
]:
    doc5.add_paragraph('  • ' + ch)

doc5.save(os.path.join(pub_dir, 'Mau_Thuyet_Minh_DATN_Chuan_UTC_2026.docx'))
print('Generated Mau_Thuyet_Minh_DATN_Chuan_UTC_2026.docx')

# 12. Huong_dan_danh_so_tai_lieu_tham_khao_IEEE.pdf
c6 = canvas.Canvas(os.path.join(pub_dir, 'Huong_dan_danh_so_tai_lieu_tham_khao_IEEE.pdf'), pagesize=A4)
draw_standard_header(c6, 'TRƯỜNG ĐH GIAO THÔNG VẬN TẢI', 'HỘI ĐỒNG KHOA HỌC KHOA CNTT', 'Số: 09/HD-KHCN-UTC', 'HƯỚNG DẪN TRÍCH DẪN TÀI LIỆU THEO CHUẨN IEEE', 'Quy định định dạng chuẩn trích dẫn tài liệu tham khảo cho Khóa luận & ĐATN')
y = h - 170
lines_6 = [
    ('1. NGUYÊN TẮC CHUNG:', 'ArialVNBold', 11),
    ('   • Trích dẫn trong bài được đặt trong dấu ngoặc vuông theo số thứ tự xuất hiện, ví dụ: [1], [2-4].', 'ArialVN', 10),
    ('   • Không phân biệt tài liệu tiếng Việt hay tiếng nước ngoài trong thứ tự trích dẫn.', 'ArialVN', 10),
    ('   • Danh mục tài liệu tham khảo cuối báo cáo phải được sắp xếp theo đúng số thứ tự trích dẫn [1], [2]...', 'ArialVN', 10),
    ('2. ĐỊNH DẠNG TRÍCH DẪN SÁCH & BÁO CÁO:', 'ArialVNBold', 11),
    ('   • [Số] Tác giả, Tên sách in nghiêng, Tái bản (nếu có). Nơi xuất bản: Nhà xuất bản, Năm.', 'ArialVN', 10),
    ('   • Ví dụ: [1] J. Smith and R. Brown, Modern Cloud Architecture, 2nd ed. Boston: TechPress, 2024.', 'ArialVN', 10),
    ('3. ĐỊNH DẠNG TRÍCH DẪN BÀI BÁO TẠP CHÍ & KỶ YẾU HỘI NGHỊ:', 'ArialVNBold', 11),
    ('   • [Số] Tác giả, Tên bài báo trong ngoặc kép, Tên tạp chí in nghiêng, tập, số, trang, năm.', 'ArialVN', 10),
    ('   • Ví dụ: [2] N. V. An and T. T. Ngan, Zero Trust Network in Hybrid Clouds, IEEE Trans., 2025.', 'ArialVN', 10),
    ('4. ĐỊNH DẠNG TRÍCH DẪN TÀI LIỆU TRỰC TUYẾN / WEBSITE / SPEC:', 'ArialVNBold', 11),
    ('   • [Số] Tác giả hoặc Tổ chức, Tiêu đề tài liệu, Tên website, URL (truy cập: ngày/tháng/năm).', 'ArialVN', 10),
]
for text, fn, sz in lines_6:
    c6.setFont(fn, sz)
    c6.drawString(45, y, text)
    y -= (sz + 8)
c6.save()
print('Generated Huong_dan_danh_so_tai_lieu_tham_khao_IEEE.pdf')

# 7 Official Templates for StudentTemplatesView
tpl_files = [
    ('mau-01-de-cuong.pdf', 'MẪU 01: ĐỀ CƯƠNG CHI TIẾT ĐỒ ÁN TỐT NGHIỆP', True),
    ('mau-02-nhat-ky.docx', 'MẪU 02: NHẬT KÝ HƯỚNG DẪN ĐỒ ÁN TỐT NGHIỆP', False),
    ('mau-03-danh-gia-gvhd.pdf', 'MẪU 03: PHIẾU ĐÁNH GIÁ CỦA GIẢNG VIÊN HƯỚNG DẪN', True),
    ('mau-04-danh-gia-gvpb.pdf', 'MẪU 04: PHIẾU ĐÁNH GIÁ CỦA GIẢNG VIÊN PHẢN BIỆN', True),
    ('mau-05-bien-ban-hoi-dong.pdf', 'MẪU 05: BIÊN BẢN HỌP HỘI ĐỒNG CHẤM BẢO VỆ ĐATN', True),
    ('mau-06-huong-dan-trinh-bay.docx', 'MẪU 06: QUY CHUẨN TRÌNH BÀY KHÓA LUẬN VÀ ĐỒ ÁN TỐT NGHIỆP', False),
    ('mau-07-don-xin-bao-luu.docx', 'MẪU 07: ĐƠN XIN HOÃN / BẢO LƯU TIẾN ĐỘ ĐỒ ÁN TỐT NGHIỆP', False),
]

for fname, title, is_pdf in tpl_files:
    fpath = os.path.join(pub_dir, fname)
    if is_pdf:
        cp = canvas.Canvas(fpath, pagesize=A4)
        draw_standard_header(cp, 'TRƯỜNG ĐH GIAO THÔNG VẬN TẢI', 'PHÒNG ĐÀO TẠO ĐẠI HỌC - KHOA CNTT', 'Số: UTC-DATN/2026', title, 'Ban hành theo Quyết định số 142/QĐ-ĐHGTVT về Quy chế ĐATN')
        cp.setFont('ArialVN', 10)
        cp.drawString(50, h - 180, 'Biểu mẫu quy chuẩn chính thức của Trường Đại học Giao thông Vận tải.')
        cp.drawString(50, h - 200, 'Sinh viên và Giảng viên sử dụng biểu mẫu này trong toàn bộ các giai đoạn ĐATN.')
        cp.drawString(50, h - 220, 'Họ tên Sinh viên / Học viên: .................................................... MSSV: ...............................')
        cp.drawString(50, h - 240, 'Đề tài tốt nghiệp: ...................................................................................................................')
        cp.drawString(50, h - 260, 'Giảng viên hướng dẫn: ...........................................................................................................')
        cp.save()
    else:
        d = docx.Document()
        d.add_heading('TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI', 0)
        d.add_heading(title, level=1)
        d.add_paragraph('Biểu mẫu quy chuẩn ban hành kèm theo Quy chế đào tạo tốt nghiệp UTC năm 2026.')
        d.add_paragraph('Họ và tên: .................................................... MSSV: ................................... Lớp: .................')
        d.add_paragraph('Đề tài: ..................................................................................................................................')
        d.save(fpath)

# Copy all files to media directories as well
for fname in os.listdir(pub_dir):
    src = os.path.join(pub_dir, fname)
    if os.path.isfile(src):
        shutil.copy2(src, os.path.join(media_dir, fname))
        shutil.copy2(src, os.path.join(template_media_dir, fname))

print('All 19 documents generated and copied successfully to static and media dirs!')
