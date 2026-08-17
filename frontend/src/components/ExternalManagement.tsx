import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { 
  ExternalExaminerListItem, 
  ExternalGroup, 
  ExternalGroupCreate,
  SupervisorOfStudentGroup 
} from '../types';
import './ExternalManagement.css';

const ExternalManagement: React.FC = () => {
  const [activeView, setActiveView] = useState<'examiners' | 'groups' | 'assignments'>('examiners');
  const [examiners, setExaminers] = useState<ExternalExaminerListItem[]>([]);
  const [groups, setGroups] = useState<ExternalGroup[]>([]);
  const [availableGroups, setAvailableGroups] = useState<SupervisorOfStudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedExaminer, setSelectedExaminer] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ExternalGroup | null>(null);

  // Form state for creating group
  const [groupForm, setGroupForm] = useState<ExternalGroupCreate>({
    name: '',
    semester: '8',
    max_groups: 10,
    evaluation_date: '',
    evaluation_venue: '',
    notes: ''
  });

  useEffect(() => {
    loadExaminers();
  }, []);

  useEffect(() => {
    loadData();
  }, [activeView]);

  const loadExaminers = async () => {
    try {
      const response = await apiService.getExternalExaminers();
      setExaminers(response.results || []);
    } catch (error) {
      console.error('Failed to load examiners:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeView === 'examiners') {
        const response = await apiService.getExternalExaminers();
        setExaminers(response.results || []);
      } else if (activeView === 'groups') {
        const response = await apiService.getExternalGroups();
        setGroups(response.results || []);
      } else if (activeView === 'assignments') {
        const [groupsRes, availableRes] = await Promise.all([
          apiService.getExternalGroups(),
          apiService.getAvailableGroupsForExternal()
        ]);
        setGroups(groupsRes.results || []);
        setAvailableGroups(availableRes.results || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExaminer) {
      alert('Please select an external examiner');
      return;
    }
    
    try {
      await apiService.createExternalGroup({
        ...groupForm,
        external_examiner: selectedExaminer
      } as any);
      alert('External group created successfully!');
      setShowCreateGroup(false);
      setGroupForm({
        name: '',
        semester: '8',
        max_groups: 10,
        evaluation_date: '',
        evaluation_venue: '',
        notes: ''
      });
      setSelectedExaminer(null);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create group');
    }
  };

  const handleAssignStudentGroup = async (externalGroupId: number, supervisorGroupId: number) => {
    try {
      await apiService.createExternalAssignment({
        external_group: externalGroupId,
        supervisor_group: supervisorGroupId
      });
      alert('Student group assigned successfully!');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to assign group');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!window.confirm('Are you sure you want to delete this external group?')) return;
    
    try {
      await apiService.deleteExternalGroup(groupId);
      alert('Group deleted successfully!');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete group');
    }
  };

  return (
    <div className="external-management">
      <div className="management-header">
        <h2>External Examiner Management</h2>
        <div className="view-tabs">
          <button 
            className={activeView === 'examiners' ? 'active' : ''}
            onClick={() => setActiveView('examiners')}
          >
            Examiners
          </button>
          <button 
            className={activeView === 'groups' ? 'active' : ''}
            onClick={() => setActiveView('groups')}
          >
            External Groups
          </button>
          <button 
            className={activeView === 'assignments' ? 'active' : ''}
            onClick={() => setActiveView('assignments')}
          >
            Assignments
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {/* Examiners View */}
          {activeView === 'examiners' && (
            <div className="examiners-list">
              <div className="list-header">
                <h3>External Examiners ({examiners.length})</h3>
              </div>
              {examiners.length === 0 ? (
                <div className="empty-state">
                  <p>No external examiners found.</p>
                  <p className="hint">External examiners are created from the Admin panel.</p>
                </div>
              ) : (
                <div className="examiners-grid">
                  {examiners.map(examiner => (
                    <div key={examiner.id} className="examiner-card">
                      <div className="examiner-info">
                        <h4>{examiner.full_name}</h4>
                        <p className="external-id">{examiner.external_id}</p>
                        <p>{examiner.email}</p>
                        <p>{examiner.designation} at {examiner.institution}</p>
                        {examiner.specialization && (
                          <p className="specialization">{examiner.specialization}</p>
                        )}
                      </div>
                      <div className="examiner-stats">
                        <span className={`status ${examiner.is_active ? 'active' : 'inactive'}`}>
                          {examiner.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="groups-count">{examiner.groups_count} groups</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Groups View */}
          {activeView === 'groups' && (
            <div className="groups-view">
              <div className="list-header">
                <h3>External Groups ({groups.length})</h3>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    loadExaminers();
                    setShowCreateGroup(true);
                  }}
                >
                  Create New Group
                </button>
              </div>

              {showCreateGroup && (
                <div className="create-group-form">
                  <h4>Create External Group</h4>
                  <form onSubmit={handleCreateGroup}>
                    <div className="form-group">
                      <label>External Examiner *</label>
                      <select 
                        value={selectedExaminer || ''} 
                        onChange={(e) => setSelectedExaminer(Number(e.target.value))}
                        required
                      >
                        <option value="">Select examiner...</option>
                        {examiners.map(ex => (
                          <option key={ex.id} value={ex.id}>
                            {ex.full_name} ({ex.institution})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Group Name *</label>
                      <input
                        type="text"
                        value={groupForm.name}
                        onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                        placeholder="e.g., External Batch 2026-A"
                        required
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Semester</label>
                        <select
                          value={groupForm.semester}
                          onChange={(e) => setGroupForm({...groupForm, semester: e.target.value})}
                        >
                          <option value="7">7th Semester</option>
                          <option value="8">8th Semester</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Max Groups</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={groupForm.max_groups}
                          onChange={(e) => setGroupForm({...groupForm, max_groups: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Evaluation Date</label>
                        <input
                          type="date"
                          value={groupForm.evaluation_date}
                          onChange={(e) => setGroupForm({...groupForm, evaluation_date: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Venue</label>
                        <input
                          type="text"
                          value={groupForm.evaluation_venue}
                          onChange={(e) => setGroupForm({...groupForm, evaluation_venue: e.target.value})}
                          placeholder="e.g., Room 101"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Notes</label>
                      <textarea
                        value={groupForm.notes}
                        onChange={(e) => setGroupForm({...groupForm, notes: e.target.value})}
                        rows={2}
                        placeholder="Additional notes..."
                      />
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowCreateGroup(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Create Group
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="groups-list">
                {groups.length === 0 ? (
                  <div className="empty-state">
                    <p>No external groups created yet.</p>
                    <p className="hint">Click "Create New Group" to get started.</p>
                  </div>
                ) : (
                  groups.map(group => (
                    <div key={group.id} className="group-card">
                      <div className="group-header">
                        <h4>{group.name}</h4>
                        <span className={`status-badge status-${group.status}`}>
                          {group.status}
                        </span>
                      </div>
                      <div className="group-details">
                        <p><strong>Examiner:</strong> {group.external_examiner_name}</p>
                        <p><strong>Semester:</strong> {group.semester}</p>
                        {group.evaluation_date && (
                          <p><strong>Date:</strong> {new Date(group.evaluation_date).toLocaleDateString()}</p>
                        )}
                        {group.evaluation_venue && (
                          <p><strong>Venue:</strong> {group.evaluation_venue}</p>
                        )}
                        <p><strong>Capacity:</strong> {group.assignments_count || 0}/{group.max_groups}</p>
                      </div>
                      <div className="group-actions">
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedGroup(group)}
                        >
                          View Assignments
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Assignments View */}
          {activeView === 'assignments' && (
            <div className="assignments-view">
              <div className="assignments-grid">
                <div className="available-groups">
                  <h3>Available Student Groups ({availableGroups.length})</h3>
                  <div className="groups-scroll">
                    {availableGroups.length === 0 ? (
                      <p className="empty-hint">No available groups for assignment.</p>
                    ) : (
                      availableGroups.map(sg => (
                        <div key={sg.id} className="available-group-item">
                          <div className="group-info">
                            <strong>{sg.project?.project_name || 'No Project'}</strong>
                            <p>{sg.group?.student_1_details?.user?.username}
                              {sg.group?.student_2_details && ` & ${sg.group.student_2_details.user.username}`}
                            </p>
                            <p className="supervisor">Supervisor: {sg.supervisor?.user?.username}</p>
                          </div>
                          <select 
                            className="assign-select"
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignStudentGroup(Number(e.target.value), sg.id);
                                e.target.value = '';
                              }
                            }}
                          >
                            <option value="">Assign to...</option>
                            {groups.filter(g => (g.assignments_count || 0) < g.max_groups).map(g => (
                              <option key={g.id} value={g.id}>
                                {g.name} ({g.assignments_count || 0}/{g.max_groups})
                              </option>
                            ))}
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                <div className="external-groups-summary">
                  <h3>External Groups Summary</h3>
                  <div className="groups-scroll">
                    {groups.length === 0 ? (
                      <p className="empty-hint">No external groups created yet.</p>
                    ) : (
                      groups.map(group => (
                        <div key={group.id} className="group-summary-card">
                          <h4>{group.name}</h4>
                          <p className="examiner">{group.external_examiner_name}</p>
                          <div className="capacity-bar">
                            <div 
                              className="capacity-fill"
                              style={{ 
                                width: `${((group.assignments_count || 0) / group.max_groups) * 100}%` 
                              }}
                            />
                          </div>
                          <p className="capacity-text">
                            {group.assignments_count || 0} / {group.max_groups} assigned
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Group Details Modal */}
      {selectedGroup && (
        <div className="modal-overlay" onClick={() => setSelectedGroup(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedGroup.name} - Assignments</h3>
              <button className="close-btn" onClick={() => setSelectedGroup(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p><strong>Examiner:</strong> {selectedGroup.external_examiner_name}</p>
              <p><strong>Capacity:</strong> {selectedGroup.assignments_count || 0}/{selectedGroup.max_groups}</p>
              {selectedGroup.evaluation_date && (
                <p><strong>Date:</strong> {new Date(selectedGroup.evaluation_date).toLocaleDateString()}</p>
              )}
              {selectedGroup.evaluation_venue && (
                <p><strong>Venue:</strong> {selectedGroup.evaluation_venue}</p>
              )}
              <p className="hint" style={{ marginTop: '16px' }}>
                To view assigned students, go to the Assignments tab.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedGroup(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalManagement;
