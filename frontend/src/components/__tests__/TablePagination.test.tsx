import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TablePagination from '../TablePagination';

// Mock CSS import
vi.mock('../TablePagination.css', () => ({}));

describe('TablePagination', () => {
  it('renders page size selector with 10, 25, 50 options and correct default', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <TablePagination
        currentPage={1}
        pageSize={10}
        totalItems={60}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[10, 25, 50]}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('10');

    // Change page size to 25
    fireEvent.change(select, { target: { value: '25' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('renders correct record range text for page size 25 on page 1', () => {
    const { container } = render(
      <TablePagination
        currentPage={1}
        pageSize={25}
        totalItems={60}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        pageSizeOptions={[10, 25, 50]}
      />
    );

    const textEl = container.querySelector('.pagination-range-text');
    expect(textEl?.textContent).toContain('Hiển thị 1 - 25 trên');
    expect(textEl?.textContent).toContain('60 bản ghi');
  });

  it('renders correct record range text on page 3 with remaining items', () => {
    const { container } = render(
      <TablePagination
        currentPage={3}
        pageSize={25}
        totalItems={60}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        pageSizeOptions={[10, 25, 50]}
      />
    );

    const textEl = container.querySelector('.pagination-range-text');
    expect(textEl?.textContent).toContain('Hiển thị 51 - 60 trên');
    expect(textEl?.textContent).toContain('60 bản ghi');
  });

  it('handles page navigation (next and previous buttons)', () => {
    const onPageChange = vi.fn();

    const { rerender } = render(
      <TablePagination
        currentPage={1}
        pageSize={25}
        totalItems={60}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />
    );

    const prevBtn = screen.getByTitle(/Trang trước/i);
    const nextBtn = screen.getByTitle(/Trang sau/i);

    // Prev button should be disabled on page 1
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Click next -> goes to page 2
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);

    // Rerender on page 3 (last page of 60 items with pageSize 25)
    rerender(
      <TablePagination
        currentPage={3}
        pageSize={25}
        totalItems={60}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />
    );

    // Next button should now be disabled on last page
    expect(screen.getByTitle(/Trang sau/i)).toBeDisabled();
  });

  it('renders zero items properly without negative ranges', () => {
    const { container } = render(
      <TablePagination
        currentPage={1}
        pageSize={10}
        totalItems={0}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const textEl = container.querySelector('.pagination-range-text');
    expect(textEl?.textContent).toContain('Hiển thị 0 - 0 trên');
    expect(textEl?.textContent).toContain('0 bản ghi');
  });
});
