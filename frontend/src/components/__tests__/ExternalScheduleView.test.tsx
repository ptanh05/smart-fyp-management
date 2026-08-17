/**
 * Tests for ExternalScheduleView Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExternalScheduleView from '../ExternalScheduleView';
import { apiService } from '../../services/api';

// Mock API service
vi.mock('../../services/api', () => ({
  apiService: {
    getEvaluationSchedules: vi.fn(),
  },
}));

// Mock CSS import
vi.mock('../ExternalScheduleView.css', () => ({}));

describe('ExternalScheduleView', () => {
  const mockSchedules = [
    {
      id: 1,
      title: 'External Evaluation Session 1',
      evaluation_type: 'external' as const,
      semester: 'Spring 2026',
      date: '2026-02-15',
      start_time: '09:00',
      end_time: '12:00',
      venue: 'Room 101',
      status: 'scheduled' as const,
      external_group_name: 'Group A',
      notes: 'Bring all documents',
      created_at: '2026-01-01',
    },
    {
      id: 2,
      title: 'Internal Evaluation Session',
      evaluation_type: 'internal' as const,
      semester: 'Spring 2026',
      date: '2026-02-16',
      start_time: '14:00',
      end_time: '17:00',
      venue: 'Room 102',
      status: 'completed' as const,
      panel_name: 'Panel A',
      created_at: '2026-01-01',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getEvaluationSchedules).mockResolvedValue({
      results: mockSchedules,
    });
  });

  describe('Rendering', () => {
    it('renders header and controls', async () => {
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByText('Evaluation Schedule')).toBeInTheDocument();
      });
      
      // View toggle buttons
      expect(screen.getByText(/List/i)).toBeInTheDocument();
      expect(screen.getByText(/Calendar/i)).toBeInTheDocument();
    });

    it('renders filter dropdowns', async () => {
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('renders upcoming only checkbox', async () => {
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByText(/Upcoming only/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      vi.mocked(apiService.getEvaluationSchedules).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      
      render(<ExternalScheduleView />);
      
      expect(screen.getByText(/Loading schedules.../i)).toBeInTheDocument();
    });
  });

  describe('List View', () => {
    it('displays schedules in list view', async () => {
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByText(/External Evaluation Session 1/i)).toBeInTheDocument();
      });
    });

    it('shows venue information', async () => {
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByText(/Room 101/i)).toBeInTheDocument();
      });
    });

    it('shows schedule status', async () => {
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
      });
    });

    it('shows external group name when available', async () => {
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByText(/Group A/i)).toBeInTheDocument();
      });
    });
  });

  describe('View Toggle', () => {
    it('defaults to list view', async () => {
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        const listButton = screen.getByText(/List/i).closest('button');
        expect(listButton).toHaveClass('active');
      });
    });

    it('switches to calendar view when clicked', async () => {
      const user = userEvent.setup();
      
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByText(/Calendar/i)).toBeInTheDocument();
      });
      
      await user.click(screen.getByText(/Calendar/i));
      
      await waitFor(() => {
        const calendarButton = screen.getByText(/Calendar/i).closest('button');
        expect(calendarButton).toHaveClass('active');
      });
    });
  });

  describe('Calendar View', () => {
    it('displays calendar grid when calendar view selected', async () => {
      const user = userEvent.setup();
      
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByText(/Calendar/i)).toBeInTheDocument();
      });
      
      await user.click(screen.getByText(/Calendar/i));
      
      await waitFor(() => {
        // Calendar should show day headers
        expect(screen.getByText('Sun')).toBeInTheDocument();
        expect(screen.getByText('Mon')).toBeInTheDocument();
        expect(screen.getByText('Tue')).toBeInTheDocument();
        expect(screen.getByText('Wed')).toBeInTheDocument();
        expect(screen.getByText('Thu')).toBeInTheDocument();
        expect(screen.getByText('Fri')).toBeInTheDocument();
        expect(screen.getByText('Sat')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('filters by type', async () => {
      const user = userEvent.setup();
      
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
      });
      
      const typeSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(typeSelect, 'external');
      
      await waitFor(() => {
        expect(apiService.getEvaluationSchedules).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'external' })
        );
      });
    });

    it('filters by status', async () => {
      const user = userEvent.setup();
      
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
      });
      
      const statusSelect = screen.getAllByRole('combobox')[1];
      await user.selectOptions(statusSelect, 'completed');
      
      await waitFor(() => {
        expect(apiService.getEvaluationSchedules).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'completed' })
        );
      });
    });

    it('toggles upcoming filter', async () => {
      const user = userEvent.setup();
      
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeChecked();
      });
      
      await user.click(screen.getByRole('checkbox'));
      
      await waitFor(() => {
        expect(apiService.getEvaluationSchedules).toHaveBeenCalledWith({});
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no schedules', async () => {
      vi.mocked(apiService.getEvaluationSchedules).mockResolvedValue({
        results: [],
      });
      
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        expect(screen.getByText(/No schedules found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API error gracefully', async () => {
      vi.mocked(apiService.getEvaluationSchedules).mockRejectedValue(
        new Error('API Error')
      );
      
      render(<ExternalScheduleView />);
      
      // Should show error message component on error
      await waitFor(() => {
        expect(screen.getByText(/Failed to load schedules/i)).toBeInTheDocument();
      });
    });
  });

  describe('Time Formatting', () => {
    it('formats time correctly', async () => {
      render(<ExternalScheduleView />);
      
      await waitFor(() => {
        // 09:00 should become 9:00 AM
        expect(screen.getByText(/9:00 AM/i)).toBeInTheDocument();
      });
    });
  });
});
