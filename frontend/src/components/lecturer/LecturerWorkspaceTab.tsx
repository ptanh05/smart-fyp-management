/**
 * LecturerWorkspaceTab – tab tổng hợp cho giảng viên: danh sách khối lượng,
 * chi tiết đồ án (bài nộp + tương đồng), và chấm điểm rubric.
 *
 * Được nhúng vào SupervisorDashboard dưới tab "workload".
 */
import React, { useState } from 'react';
import { WorkloadDashboard } from './WorkloadDashboard';
import { ProjectDetailPanel } from './ProjectDetailPanel';
import { RubricGradingUI } from './RubricGradingUI';
import type { LecturerWorkloadItem } from '../../services/api';

type View = 'list' | 'detail' | 'grade';

export const LecturerWorkspaceTab: React.FC = () => {
  const [view, setView] = useState<View>('list');
  const [selectedProject, setSelectedProject] = useState<LecturerWorkloadItem | null>(null);

  const handleSelectProject = (item: LecturerWorkloadItem) => {
    setSelectedProject(item);
    setView('detail');
  };

  const handleGradeClick = (item: LecturerWorkloadItem) => {
    setSelectedProject(item);
    setView('grade');
  };

  return (
    <div className="space-y-3">
      <div className="utc-card p-3 flex items-center gap-2 text-sm bg-blue-50 border border-blue-100">
        <span className="font-semibold text-blue-800">Không gian làm việc GV</span>
        <span className="text-blue-500">•</span>
        <button
          className={`px-2 py-0.5 rounded text-xs font-medium ${view === 'list' ? 'bg-blue-700 text-white' : 'text-blue-600 hover:bg-blue-100'}`}
          onClick={() => setView('list')}
        >
          Danh sách đồ án
        </button>
        {selectedProject && (
          <>
            <span className="text-blue-300">›</span>
            <button
              className={`px-2 py-0.5 rounded text-xs font-medium truncate max-w-[200px] ${
                view === 'detail' ? 'bg-blue-700 text-white' : 'text-blue-600 hover:bg-blue-100'
              }`}
              onClick={() => setView('detail')}
            >
              {selectedProject.student_name}
            </button>
          </>
        )}
        {selectedProject && view === 'grade' && (
          <>
            <span className="text-blue-300">›</span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-700 text-white">
              Chấm điểm
            </span>
          </>
        )}
      </div>

      {view === 'list' && (
        <WorkloadDashboard onSelectProject={handleSelectProject} />
      )}

      {view === 'detail' && selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
          onBack={() => setView('list')}
          onGradeClick={handleGradeClick}
        />
      )}

      {view === 'grade' && selectedProject && (
        <RubricGradingUI
          project={selectedProject}
          onBack={() => setView('detail')}
        />
      )}
    </div>
  );
};

export default LecturerWorkspaceTab;
