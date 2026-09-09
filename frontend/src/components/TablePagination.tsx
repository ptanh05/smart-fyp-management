import React from 'react';
import './TablePagination.css';

export interface TablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  loading?: boolean;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  loading = false,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value);
    onPageSizeChange(newSize);
  };

  return (
    <div className="table-pagination-container">
      {/* Page Size & Summary */}
      <div className="table-pagination-info">
        <div className="page-size-selector">
          <label htmlFor="page-size-select">Số lượng hiển thị:</label>
          <select
            id="page-size-select"
            className="page-size-select"
            value={pageSize}
            onChange={handlePageSizeChange}
            disabled={loading}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / trang
              </option>
            ))}
          </select>
        </div>

        <span className="pagination-range-text">
          Hiển thị <strong>{startItem}</strong> - <strong>{endItem}</strong> trên{' '}
          <strong>{totalItems}</strong> bản ghi
        </span>
      </div>

      {/* Navigation Buttons */}
      <div className="table-pagination-controls">
        <button
          type="button"
          className="pagination-btn pagination-nav-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1 || loading}
          title="Trang đầu"
        >
          ⏮
        </button>
        <button
          type="button"
          className="pagination-btn pagination-nav-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          title="Trang trước"
        >
          ◀ Trước
        </button>

        <div className="pagination-pages">
          {getPageNumbers().map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={idx}
                type="button"
                className={`pagination-btn pagination-page-btn ${p === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
                disabled={loading}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="pagination-ellipsis">
                {p}
              </span>
            )
          )}
        </div>

        <button
          type="button"
          className="pagination-btn pagination-nav-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalItems === 0 || loading}
          title="Trang sau"
        >
          Sau ▶
        </button>
        <button
          type="button"
          className="pagination-btn pagination-nav-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || totalItems === 0 || loading}
          title="Trang cuối"
        >
          ⏭
        </button>
      </div>
    </div>
  );
};

export default TablePagination;
