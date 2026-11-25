import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RagUtcChatWidget from '../RagUtcChatWidget';

const renderAtRoute = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="*" element={<RagUtcChatWidget />} />
      </Routes>
    </MemoryRouter>
  );

describe('RagUtcChatWidget', () => {
  it('chỉ hiển thị nút nổi và popup giới thiệu tại đúng route /student/dashboard', () => {
    renderAtRoute('/student/dashboard');

    const wrapper = screen.getByTestId('rag-utc-chat-widget');
    expect(wrapper).toHaveClass('fixed', 'bottom-6', 'right-6', 'z-50');

    const triggerBtn = screen.getByRole('button', { name: /Hỏi AI RAG-UTC/i });
    expect(triggerBtn).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(triggerBtn);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hỏi đáp AI RAG-UTC' })).toBeInTheDocument();
    expect(screen.getByText(/Tính năng đang được phát triển/i)).toBeInTheDocument();
    expect(screen.getByText(/Tra cứu nhanh quy trình/i)).toBeInTheDocument();
    expect(screen.getByText(/biểu mẫu chuẩn/i)).toBeInTheDocument();
    expect(screen.getByText(/mốc thời gian/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Đã hiểu/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(triggerBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Đóng khung giới thiệu/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(triggerBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('vẫn hiển thị bình thường khi route có dấu gạch chéo cuối /student/dashboard/', () => {
    renderAtRoute('/student/dashboard/');
    expect(screen.getByRole('button', { name: /Hỏi AI RAG-UTC/i })).toBeInTheDocument();
  });

  it.each(['/admin', '/admin/batches', '/supervisor/dashboard', '/committee_member/dashboard', '/login', '/'])(
    'không hiển thị ở route %s',
    (route) => {
      const { container } = renderAtRoute(route);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('rag-utc-chat-widget')).not.toBeInTheDocument();
    }
  );
});
