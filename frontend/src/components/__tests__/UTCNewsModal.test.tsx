import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UTCNewsModal, UTC_NEWS_DATA } from '../UTCNewsModal';

describe('UTCNewsModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <UTCNewsModal isOpen={false} onClose={mockOnClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders detail reader view with attachments when newsItem is provided', () => {
    const policyNews = UTC_NEWS_DATA.find((item) => item.id === 'news-policy-2026');
    expect(policyNews).toBeDefined();

    render(
      <UTCNewsModal
        isOpen={true}
        onClose={mockOnClose}
        newsItem={policyNews}
      />
    );

    // Verify title is rendered
    expect(
      screen.getByText('Thực hiện chế độ chính sách sinh viên học kỳ I năm học 2026 - 2027')
    ).toBeInTheDocument();

    // Verify attachments are rendered
    expect(
      screen.getByText('Don_de_nghi_mien_giam_hoc_phi_2026_UTC.pdf')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Huong_dan_ho_so_chinh_sach_K61_K64.docx')
    ).toBeInTheDocument();

    // Verify download links exist
    const downloadLinks = screen.getAllByText('Tải về');
    expect(downloadLinks.length).toBe(2);
    expect(downloadLinks[0]).toHaveAttribute('download', 'Don_de_nghi_mien_giam_hoc_phi_2026_UTC.pdf');
  });

  it('triggers download when Tải về link is clicked', async () => {
    const policyNews = UTC_NEWS_DATA.find((item) => item.id === 'news-policy-2026');
    const mockBlob = new Blob(['sample pdf content'], { type: 'application/pdf' });
    const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    });

    render(
      <UTCNewsModal
        isOpen={true}
        onClose={mockOnClose}
        newsItem={policyNews}
      />
    );

    const downloadLinks = screen.getAllByText('Tải về');
    fireEvent.click(downloadLinks[0]);

    expect(global.fetch).toHaveBeenCalledWith(
      '/attachments/Don_de_nghi_mien_giam_hoc_phi_2026_UTC.pdf'
    );

    createObjectURLSpy.mockRestore();
  });

  it('calls onClose when close button is clicked', () => {
    const policyNews = UTC_NEWS_DATA[0];
    render(
      <UTCNewsModal
        isOpen={true}
        onClose={mockOnClose}
        newsItem={policyNews}
      />
    );

    const closeBtn = screen.getByTitle('Đóng');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
