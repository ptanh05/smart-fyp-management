import React, { useState, useEffect, useRef } from 'react';
import './SearchFilter.css';

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterProps {
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
  filters?: {
    name: string;
    label: string;
    options: FilterOption[];
    value?: string;
  }[];
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
}

const SearchFilter: React.FC<SearchFilterProps> = ({
  searchPlaceholder = 'Search...',
  onSearch,
  debounceDelay = 300,
  filters = [],
  onFilterChange,
  showSearch = true,
  initialSearchValue = '',
}) => {
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Debounced search effect
  useEffect(() => {
    // Skip the first render to avoid triggering search on mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onSearch?.(searchValue);
    }, debounceDelay);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchValue, debounceDelay, onSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleFilterChange = (filterName: string, value: string) => {
    onFilterChange?.(filterName, value);
  };

  const handleClearSearch = () => {
    setSearchValue('');
    onSearch?.('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Trigger immediate search on Enter
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onSearch?.(searchValue);
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
              title="Clear search"
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
                value={filter.value || ''}
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
