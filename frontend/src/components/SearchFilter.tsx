import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import './SearchFilter.css';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  name: string;
  label: string;
  options: FilterOption[];
  value?: string;
}

export interface SearchFilterProps {
  /**
   * Placeholder text for the search input
   */
  searchPlaceholder?: string;
  /**
   * Callback when search value changes (debounced)
   */
  onSearch?: (value: string) => void;
  /**
   * Debounce delay in milliseconds (default: 300)
   */
  debounceDelay?: number;
  /**
   * Filter configurations
   */
  filters?: FilterConfig[];
  /**
   * Callback when any filter changes
   */
  onFilterChange?: (filterName: string, value: string) => void;
  /**
   * Whether to show the search input (default: true)
   */
  showSearch?: boolean;
  /**
   * Initial search value
   */
  initialSearchValue?: string;
  /**
   * Automatically synchronize filter & search state with URL Query Params (e.g. ?semester=2&search=AI)
   */
  syncWithUrl?: boolean;
  /**
   * Query parameter name for search (default: 'search')
   */
  searchParamKey?: string;
}

const SearchFilter: React.FC<SearchFilterProps> = ({
  searchPlaceholder = 'Search...',
  onSearch,
  debounceDelay = 300,
  filters = [],
  onFilterChange,
  showSearch = true,
  initialSearchValue = '',
  syncWithUrl = true,
  searchParamKey = 'search',
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize values from URL query params if syncWithUrl is enabled
  const getInitialSearch = () => {
    if (syncWithUrl) {
      const urlVal = searchParams.get(searchParamKey);
      if (urlVal !== null) return urlVal;
    }
    return initialSearchValue;
  };

  const [searchValue, setSearchValue] = useState<string>(getInitialSearch);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    filters.forEach((f) => {
      if (syncWithUrl) {
        const urlVal = searchParams.get(f.name);
        init[f.name] = urlVal !== null ? urlVal : (f.value || '');
      } else {
        init[f.name] = f.value || '';
      }
    });
    return init;
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMount = useRef(true);

  // Sync external filters prop into internal state if changed
  useEffect(() => {
    setFilterValues((prev) => {
      const next = { ...prev };
      filters.forEach((f) => {
        if (syncWithUrl) {
          const urlVal = searchParams.get(f.name);
          next[f.name] = urlVal !== null ? urlVal : (f.value !== undefined ? f.value : next[f.name] || '');
        } else if (f.value !== undefined) {
          next[f.name] = f.value;
        }
      });
      return next;
    });
  }, [filters, searchParams, syncWithUrl]);

  // Initial trigger from URL query params on mount
  useEffect(() => {
    if (syncWithUrl && isFirstMount.current) {
      const urlSearch = searchParams.get(searchParamKey);
      if (urlSearch) {
        onSearch?.(urlSearch);
      }

      filters.forEach((f) => {
        const urlVal = searchParams.get(f.name);
        if (urlVal) {
          onFilterChange?.(f.name, urlVal);
        }
      });
    }
  }, []);

  // Update URL Query Params helper
  const updateUrlParams = useCallback(
    (key: string, val: string) => {
      if (!syncWithUrl) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (val && val.trim()) {
            next.set(key, val.trim());
          } else {
            next.delete(key);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams, syncWithUrl]
  );

  // Debounced search effect
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onSearch?.(searchValue);
      updateUrlParams(searchParamKey, searchValue);
    }, debounceDelay);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchValue, debounceDelay, onSearch, searchParamKey, updateUrlParams]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleFilterChange = (filterName: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [filterName]: value }));
    updateUrlParams(filterName, value);
    onFilterChange?.(filterName, value);
  };

  const handleClearSearch = () => {
    setSearchValue('');
    updateUrlParams(searchParamKey, '');
    onSearch?.('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onSearch?.(searchValue);
      updateUrlParams(searchParamKey, searchValue);
    }
  };

  return (
    <div className="search-filter-container">
      {showSearch && (
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
          />
          {searchValue && (
            <button
              className="search-clear-btn"
              onClick={handleClearSearch}
              title="Xóa tìm kiếm"
            >
              ×
            </button>
          )}
        </div>
      )}

      {filters.length > 0 && (
        <div className="filters-wrapper">
          {filters.map((filter) => (
            <div key={filter.name} className="filter-group">
              <label className="filter-label">{filter.label}:</label>
              <select
                className="filter-select"
                value={filterValues[filter.name] ?? filter.value ?? ''}
                onChange={(e) => handleFilterChange(filter.name, e.target.value)}
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchFilter;
