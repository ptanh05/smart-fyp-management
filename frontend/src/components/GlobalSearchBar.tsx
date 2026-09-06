import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import './GlobalSearchBar.css';

export interface SearchResultItem {
  id: string;
  item_id: number;
  type: 'project' | 'faculty' | 'student' | 'council' | 'document';
  type_label: string;
  icon: string;
  title: string;
  subtitle: string;
  extra_info?: string;
  action_url: string;
}

interface GlobalSearchBarProps {
  placeholder?: string;
  className?: string;
  onSelectResult?: (item: SearchResultItem) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'projects', label: 'Đề tài' },
  { id: 'faculty', label: 'Giảng viên' },
  { id: 'students', label: 'Sinh viên' },
  { id: 'councils', label: 'Hội đồng' },
  { id: 'documents', label: 'Biểu mẫu' },
];

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  placeholder = 'Tìm kiếm đề tài, sinh viên, GV, hội đồng, biểu mẫu... (Ctrl+K)',
  className = '',
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  // Execute Search
  const executeSearch = useCallback(async (searchTerm: string, category: string) => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setResults([]);
      setTotalResults(0);
      setCategoryCounts({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiService.globalSearch(searchTerm.trim(), category);
      setResults(data.results || []);
      setTotalResults(data.total_results || 0);
      setCategoryCounts(data.categories || {});
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Global search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle Input Change with 300ms debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val || val.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val, activeCategory);
    }, 280);
  };

  // Category switch
  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    if (query.trim().length >= 2) {
      executeSearch(query, catId);
    }
  };

  // Clear query
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Select result
  const handleItemClick = (item: SearchResultItem) => {
    setIsOpen(false);
    if (onSelectResult) {
      onSelectResult(item);
    } else if (item.action_url) {
      navigate(item.action_url);
    }
  };

  // Keyboard navigation & Shortcuts (Ctrl+K, Escape, Arrows, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }

      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleItemClick(results[selectedIndex]);
      }
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`global-search-container ${className}`} ref={containerRef}>
      <div className="global-search-input-wrap">
        <span className="global-search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="global-search-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          aria-label="Tìm kiếm toàn cục"
          aria-expanded={isOpen}
        />

        {loading && <span className="global-search-spinner" title="Đang tìm kiếm...">⏳</span>}

        {query && !loading && (
          <button
            type="button"
            className="global-search-clear-btn"
            onClick={handleClear}
            title="Xóa tìm kiếm"
          >
            ✕
          </button>
        )}

        <div className="global-search-shortcut" title="Phím tắt: Ctrl + K">
          <kbd>Ctrl</kbd>+<kbd>K</kbd>
        </div>
      </div>

      {isOpen && (
        <div className="global-search-dropdown">
          {/* Category Tabs */}
          <div className="global-search-tabs">
            {CATEGORIES.map((cat) => {
              const count = cat.id === 'all' ? totalResults : (categoryCounts[cat.id] || 0);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`search-tab-item ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => handleCategoryChange(cat.id)}
                >
                  {cat.label}
                  {count > 0 && <span className="search-tab-badge">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Results List */}
          <div className="global-search-results-list">
            {loading && results.length === 0 ? (
              <div className="search-status-box">
                <span className="search-status-spinner">⏳</span>
                <span>Đang tìm kiếm trên toàn hệ thống...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((item, idx) => (
                <div
                  key={item.id}
                  className={`search-result-row ${selectedIndex === idx ? 'selected' : ''}`}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="result-type-icon">{item.icon}</div>
                  <div className="result-body">
                    <div className="result-head">
                      <span className="result-title">{item.title}</span>
                      <span className={`result-tag tag-${item.type}`}>{item.type_label}</span>
                    </div>
                    {item.subtitle && <div className="result-sub">{item.subtitle}</div>}
                    {item.extra_info && <div className="result-extra">{item.extra_info}</div>}
                  </div>
                  <div className="result-arrow">→</div>
                </div>
              ))
            ) : (
              <div className="search-status-box empty">
                <span>🔍 Không tìm thấy kết quả nào phù hợp cho "<strong>{query}</strong>"</span>
                <p className="search-tip">Mẹo: Bạn có thể tìm theo tên đề tài, mã sinh viên (MSSV), tên giảng viên hoặc số hội đồng.</p>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="global-search-footer">
            <span>Tìm thấy <strong>{totalResults}</strong> kết quả</span>
            <span className="keyboard-hint">Dùng phím <kbd>↑</kbd> <kbd>↓</kbd> để di chuyển, <kbd>Enter</kbd> để chọn, <kbd>Esc</kbd> để đóng</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearchBar;
