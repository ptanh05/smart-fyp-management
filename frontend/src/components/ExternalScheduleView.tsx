import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import type { EvaluationSchedule } from '../types';
import { getCalendarDays } from '../utils/dateUtils';
import ErrorMessage from './ErrorMessage';
import './ExternalScheduleView.css';

interface ExternalScheduleViewProps {
  userType?: 'external_examiner' | 'student' | 'committee_member';
}

const ExternalScheduleView: React.FC<ExternalScheduleViewProps> = ({ userType: _userType }) => {
  const [schedules, setSchedules] = useState<EvaluationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [filter, setFilter] = useState({
    type: '',
    status: '',
    upcoming: 'true'
  });

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (filter.type) params.type = filter.type;
      if (filter.status) params.status = filter.status;
      if (filter.upcoming) params.upcoming = filter.upcoming;
      
      const response = await apiService.getEvaluationSchedules(params);
      setSchedules(response.results || []);
    } catch (err: unknown) {
      console.error('Failed to load schedules:', err);
      setSchedules([]);
      if (err instanceof Error) {
        if (err.message.includes('Network') || err.message.includes('fetch')) {
          setError('Unable to connect to the server. Please check your internet connection.');
        } else {
          setError('Failed to load schedules. Please try again.');
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handlePrevMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCalendarDate(new Date());
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: '#3b82f6',
      completed: '#10b981',
      postponed: '#f59e0b',
      cancelled: '#ef4444'
    };
    return colors[status] || '#64748b';
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      internal: '🏠',
      external: '🌐',
      final_defense: '🎓'
    };
    return icons[type] || '📋';
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const groupByDate = (schedules: EvaluationSchedule[]) => {
    const grouped: Record<string, EvaluationSchedule[]> = {};
    schedules.forEach(schedule => {
      const date = schedule.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(schedule);
    });
    return grouped;
  };

  const renderListView = () => {
    const grouped = groupByDate(schedules);
    const dates = Object.keys(grouped).sort();

    if (dates.length === 0) {
      return (
        <div className="empty-state">
          <p>No schedules found.</p>
          <p className="hint">Try adjusting your filters or check back later.</p>
        </div>
      );
    }

    return (
      <div className="schedule-list">
        {dates.map(date => (
          <div key={date} className="date-group">
            <div className="date-header">
              <span className="date-day">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
              </span>
              <span className="date-full">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </span>
            </div>
            <div className="date-schedules">
              {grouped[date].map(schedule => (
                <div 
                  key={schedule.id} 
                  className="schedule-item"
                  style={{ borderLeftColor: getStatusColor(schedule.status) }}
                >
                  <div className="schedule-time">
                    <span className="time-start">{formatTime(schedule.start_time)}</span>
                    <span className="time-separator">-</span>
                    <span className="time-end">{formatTime(schedule.end_time)}</span>
                  </div>
                  <div className="schedule-details">
                    <h4>
                      {getTypeIcon(schedule.evaluation_type)} {schedule.title}
                    </h4>
                    <p className="venue">📍 {schedule.venue}</p>
                    {schedule.external_group_name && (
                      <p className="group-name">👥 {schedule.external_group_name}</p>
                    )}
                    {schedule.panel_name && (
                      <p className="panel-name">📋 {schedule.panel_name}</p>
                    )}
                    {schedule.notes && (
                      <p className="notes">{schedule.notes}</p>
                    )}
                  </div>
                  <div className="schedule-status">
                    <span 
                      className="status-badge"
                      style={{ 
                        backgroundColor: `${getStatusColor(schedule.status)}20`,
                        color: getStatusColor(schedule.status)
                      }}
                    >
                      {schedule.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCalendarView = () => {
    const today = new Date();
    const currentMonth = calendarDate.getMonth();
    const currentYear = calendarDate.getFullYear();
    
    const days = getCalendarDays(currentYear, currentMonth);

    const getSchedulesForDay = (day: number) => {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return schedules.filter(s => s.date === dateStr);
    };

    const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear();

    return (
      <div className="calendar-view">
        <div className="calendar-header">
          <button 
            className="calendar-nav-btn" 
            onClick={handlePrevMonth}
            aria-label="Previous month"
          >
            ←
          </button>
          <div className="calendar-title">
            <h3>
              {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </h3>
            {!isCurrentMonth && (
              <button className="today-btn" onClick={handleToday}>
                Today
              </button>
            )}
          </div>
          <button 
            className="calendar-nav-btn" 
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            →
          </button>
        </div>
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          {days.map((day, index) => {
            const isToday = day === today.getDate() && 
                           currentMonth === today.getMonth() && 
                           currentYear === today.getFullYear();
            const daySchedules = day ? getSchedulesForDay(day) : [];
            
            return (
              <div 
                key={index} 
                className={`calendar-day ${isToday ? 'today' : ''} ${day === null ? 'empty' : ''}`}
              >
                {day !== null && (
                  <>
                    <span className={`day-number ${isToday ? 'today-number' : ''}`}>{day}</span>
                    <div className="day-events">
                      {daySchedules.slice(0, 3).map(schedule => (
                        <div 
                          key={schedule.id}
                          className="calendar-event"
                          style={{ backgroundColor: getStatusColor(schedule.status) }}
                          title={`${schedule.title} - ${formatTime(schedule.start_time)}`}
                        >
                          {schedule.title.length > 12 
                            ? schedule.title.substring(0, 12) + '...' 
                            : schedule.title}
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="more-events">
                          +{daySchedules.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="external-schedule-view">
      <div className="schedule-header">
        <h2>Evaluation Schedule</h2>
        <div className="schedule-controls">
          <div className="view-toggle">
            <button 
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              📋 List
            </button>
            <button 
              className={viewMode === 'calendar' ? 'active' : ''}
              onClick={() => setViewMode('calendar')}
            >
              📅 Calendar
            </button>
          </div>
          <div className="filters">
            <select 
              value={filter.type}
              onChange={(e) => setFilter({...filter, type: e.target.value})}
            >
              <option value="">All Types</option>
              <option value="internal">Internal</option>
              <option value="external">External</option>
              <option value="final_defense">Final Defense</option>
            </select>
            <select 
              value={filter.status}
              onChange={(e) => setFilter({...filter, status: e.target.value})}
            >
              <option value="">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="postponed">Postponed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <label className="upcoming-toggle">
              <input 
                type="checkbox"
                checked={filter.upcoming === 'true'}
                onChange={(e) => setFilter({...filter, upcoming: e.target.checked ? 'true' : ''})}
              />
              Upcoming only
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading schedules...</p>
        </div>
      ) : error ? (
        <ErrorMessage
          title="Unable to Load Schedules"
          message={error}
          onRetry={loadSchedules}
        />
      ) : (
        viewMode === 'list' ? renderListView() : renderCalendarView()
      )}
    </div>
  );
};

export default ExternalScheduleView;
