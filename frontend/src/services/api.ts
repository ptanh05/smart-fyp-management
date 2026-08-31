import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
  LoginResponse,
  Student,
  Supervisor,
  CommitteeMember,
  ProjectCategory,
  Group,
  Project,
  SupervisorOfStudentGroup,
  Document,
  DocumentRequirement,
  DocumentTypeValue,
  ChatMessage,
  Notification,
  NotificationPreference,
  NotificationUnreadCount,
  PaginatedResponse,
  SupervisorAnalytics,
  CommitteeMemberAnalytics,
  AuditLog,
  AuditLogStats,
  // External Examiner Types
  ExternalExaminer,
  ExternalExaminerListItem,
  ExternalDashboardData,
  ExternalGroup,
  ExternalGroupDetail,
  ExternalGroupCreate,
  ExternalGroupAssignment,
  ExternalEvaluation,
  ExternalEvaluationCreate,
  EvaluationSchedule,
  EvaluationScheduleCreate,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/app';


class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh via HttpOnly Cookie
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            // Send request to refresh token endpoint - HttpOnly cookie attached automatically via withCredentials
            const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {}, { withCredentials: true });
            const { access } = response.data;
            localStorage.setItem('access_token', access);
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${access}`;
            }
            return this.api(originalRequest);
          } catch (refreshError) {
            this.logout();
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async studentLogin(registrationNo: string, password: string): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>('/student/login/', {
      registration_no: registrationNo,
      password,
    });
    return response.data;
  }

  async supervisorLogin(email: string, password: string): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>('/supervisor/login/', {
      email,
      password,
    });
    return response.data;
  }

  async committeeMemberLogin(email: string, password: string): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>('/committee_member/login/', {
      email,
      password,
    });
    return response.data;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.api.post('/change_password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  // Student Profile
  async getStudentProfile(): Promise<Student> {
    const response = await this.api.get<Student>('/student/profile/');
    return response.data;
  }

  // WebSocket Ticket
  async getWebSocketTicket(groupId: number): Promise<{ ticket: string; expires_in: number }> {
    const response = await this.api.post<{ ticket: string; expires_in: number }>('/ws-ticket/', { group_id: groupId });
    return response.data;
  }

  // Supervisor Profile
  async getSupervisorProfile(): Promise<Supervisor> {
    const response = await this.api.get<Supervisor>('/supervisor/profile/');
    return response.data;
  }

  async updateSupervisorProfile(data: Partial<Supervisor>): Promise<Supervisor> {
    const response = await this.api.patch<Supervisor>('/supervisor/profile/', data);
    return response.data;
  }

  // Committee Member Profile
  async getCommitteeMemberProfile(): Promise<CommitteeMember> {
    const response = await this.api.get<CommitteeMember>('/committee_member/profile/');
    return response.data;
  }

  // Committee Member Groups (for evaluation)
  async getCommitteeMemberGroups(): Promise<{ results: SupervisorOfStudentGroup[]; count: number }> {
    const response = await this.api.get<{ results: SupervisorOfStudentGroup[]; count: number } | SupervisorOfStudentGroup[]>('/committee-member/groups/');
    // Handle paginated response
    if (Array.isArray(response.data)) {
      return { results: response.data, count: response.data.length };
    }
    return response.data;
  }

  // Students List
  async getStudentsList(options?: { forRequest?: boolean; search?: string }): Promise<{ results: Student[]; count: number }> {
    const params: Record<string, string> = {};
    if (options?.forRequest) params.for_request = 'true';
    if (options?.search) params.search = options.search;
    const response = await this.api.get<{ results: Student[]; count: number }>('/listofstudents/', { params });
    return response.data;
  }

  // Project Categories
  async getProjectCategories(): Promise<{ results: ProjectCategory[] }> {
    const response = await this.api.get<{ results: ProjectCategory[] }>('/project/categories/');
    return response.data;
  }

  // Groups
  async getGroupRequests(options?: { requested?: 'to' | 'from'; status?: string; search?: string }): Promise<Group[]> {
    const params: Record<string, string> = {};
    if (options?.requested) params.requested = options.requested;
    if (options?.status) params.status = options.status;
    if (options?.search) params.search = options.search;
    const response = await this.api.get<Group[] | { results: Group[] }>('/groupmate/request/', { params });
    // Handle paginated response
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data.results) {
      return response.data.results;
    }
    return [];
  }

  async getGroupRequest(id: number): Promise<Group> {
    const response = await this.api.get<Group>(`/groupmate/request/${id}/`);
    return response.data;
  }

  async createGroupRequest(data: { student_2: number; project_category: number }): Promise<Group> {
    const response = await this.api.post<Group>('/groupmate/request/', data);
    return response.data;
  }

  async updateGroupRequest(id: number, data: Partial<Group>): Promise<Group> {
    const response = await this.api.patch<Group>(`/groupmate/request/?pk=${id}`, data);
    return response.data;
  }

  async getGroup(id: number): Promise<Group> {
    const response = await this.api.get<Group>(`/group/${id}/`);
    return response.data;
  }

  async getGroupComments(groupId: number): Promise<any[]> {
    const response = await this.api.get(`/groupmate/${groupId}/comments/`);
    return response.data;
  }

  async createGroupComment(groupId: number, comment: string): Promise<any> {
    const response = await this.api.post(`/groupmate/${groupId}/comments/`, { comment });
    return response.data;
  }

  // Projects
  async getProjects(options?: {
    categoryId?: number;
    search?: string;
    /** Admin-set, category-wise projects (offered to students) */
    offered?: boolean;
    mineOnly?: boolean;
  }): Promise<Project[]> {
    const params: Record<string, string | number | boolean> = {};
    if (options?.categoryId) params.category_id = options.categoryId;
    if (options?.search) params.search = options.search;
    if (options?.offered === true) params.offered = true;
    if (options?.mineOnly === true) params.mine_only = true;
    const response = await this.api.get<Project[] | { results: Project[] }>('/projects/list/', { params });
    // Handle paginated response
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data.results) {
      return response.data.results;
    }
    return [];
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    const response = await this.api.post<Project>('/projects/list/', data);
    return response.data;
  }

  async getProject(id: number): Promise<Project> {
    const response = await this.api.get<Project>(`/project/${id}/`);
    return response.data;
  }

  async deleteProject(id: number): Promise<void> {
    await this.api.delete(`/projects/list/${id}/`);
  }

  // Supervisors
  async getSupervisors(options?: { categoryId?: number; search?: string }): Promise<{ results: Supervisor[] }> {
    const params: Record<string, string | number> = {};
    if (options?.categoryId) params.category = options.categoryId;
    if (options?.search) params.search = options.search;
    const response = await this.api.get<{ results: Supervisor[] }>('/supervisor/list/', { params });
    return response.data;
  }

  // Supervisor Requests
  async getSupervisorRequests(requested?: 'to' | 'from'): Promise<{ results: SupervisorOfStudentGroup[] }> {
    const params = requested ? { requested } : {};
    const response = await this.api.get<{ results: SupervisorOfStudentGroup[] }>('/supervisor/student/request/', { params });
    return response.data;
  }

  async getSupervisorRequest(id: number): Promise<SupervisorOfStudentGroup> {
    const response = await this.api.get<SupervisorOfStudentGroup>(`/supervisor-student/${id}/`);
    return response.data;
  }

  async createSupervisorRequest(data: { supervisor: number; project: number | Partial<Project> }): Promise<SupervisorOfStudentGroup> {
    const response = await this.api.post<SupervisorOfStudentGroup>('/supervisor/student/request/', data);
    return response.data;
  }

  async updateSupervisorRequest(id: number, data: Partial<SupervisorOfStudentGroup>): Promise<SupervisorOfStudentGroup> {
    const response = await this.api.patch<SupervisorOfStudentGroup>(`/supervisor/student/request/?pk=${id}`, data);
    return response.data;
  }

  async respondToSupervisorRequest(supervisorStudentId: number, status: 'accepted' | 'rejected'): Promise<SupervisorOfStudentGroup> {
    const response = await this.api.post<SupervisorOfStudentGroup>('/supervisor/student/response/', {
      supervisor_student_id: supervisorStudentId,
      status,
    });
    return response.data;
  }

  // Comments
  async getSupervisorStudentComments(groupId?: number, page?: number): Promise<{ results: any[]; count: number; next: string | null; previous: string | null }> {
    const params: any = {};
    if (groupId) params.group = groupId;
    if (page) params.page = page;
    const response = await this.api.get<{ results: any[]; count: number; next: string | null; previous: string | null } | any[]>('/supervisor/student/comments/', { params });
    // Handle paginated response
    if (response.data && typeof response.data === 'object' && 'results' in response.data) {
      return response.data as { results: any[]; count: number; next: string | null; previous: string | null };
    }
    // Legacy non-paginated response
    const comments = Array.isArray(response.data) ? response.data : [];
    return { results: comments, count: comments.length, next: null, previous: null };
  }

  async createSupervisorStudentComment(data: { group: number; comment: string }): Promise<any> {
    const response = await this.api.post('/supervisor/student/comments/', data);
    return response.data;
  }

  // Documents
  async getDocuments(documentType: string, groupId?: number): Promise<Document[]> {
    const params = groupId ? { group: groupId } : {};
    const response = await this.api.get<{ count?: number; results?: Document[] } | Document[]>(`/proposal-document/${documentType}/`, { params });
    // Handle both paginated and non-paginated responses
    if (response.data && typeof response.data === 'object' && 'results' in response.data) {
      return response.data.results || [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  async uploadDocument(documentType: string, data: FormData): Promise<Document> {
    const response = await this.api.post<Document>(`/proposal-document/${documentType}/`, data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async updateDocumentStatus(documentType: string, documentId: number, status: string): Promise<Document> {
    const response = await this.api.patch<Document>(`/proposal-document/${documentType}/?pk=${documentId}`, { status });
    return response.data;
  }

  /** Submit an accepted document to committee (before deadline). Committee sees only submitted documents. */
  async submitDocumentToCommittee(documentType: string, documentId: number): Promise<Document> {
    const response = await this.api.post<Document>(`/document-submit-to-committee/${documentType}/${documentId}/`);
    return response.data;
  }

  async downloadDocument(fileUrl: string, fileName: string): Promise<void> {
    try {
      // Handle both relative and absolute URLs
      const url = fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  async deleteDocument(documentType: string, documentId: number): Promise<void> {
    await this.api.delete(`/proposal-document/${documentType}/${documentId}/`);
  }

  // Document requirements (committee-defined deadlines; students see and submit against these)
  async getDocumentRequirements(semester?: string): Promise<DocumentRequirement[]> {
    const params: Record<string, string | number> = { page_size: 200 };
    if (semester) params.semester = semester;
    const response = await this.api.get<DocumentRequirement[] | { results: DocumentRequirement[] }>(
      '/document-requirements/',
      { params }
    );
    if (Array.isArray(response.data)) return response.data;
    if (response.data && 'results' in response.data) return response.data.results;
    return [];
  }

  async createDocumentRequirement(data: {
    document_type: DocumentTypeValue;
    title: string;
    deadline: string;
    semester?: string | null;
  }): Promise<DocumentRequirement> {
    const response = await this.api.post<DocumentRequirement>('/document-requirements/', data);
    return response.data;
  }

  async getDocumentRequirement(id: number): Promise<DocumentRequirement> {
    const response = await this.api.get<DocumentRequirement>(`/document-requirements/${id}/`);
    return response.data;
  }

  async updateDocumentRequirement(
    id: number,
    data: Partial<Pick<DocumentRequirement, 'title' | 'deadline' | 'semester'>>
  ): Promise<DocumentRequirement> {
    const response = await this.api.patch<DocumentRequirement>(`/document-requirements/${id}/`, data);
    return response.data;
  }

  async deleteDocumentRequirement(id: number): Promise<void> {
    await this.api.delete(`/document-requirements/${id}/`);
  }

  // Supervisor Documents
  async getSupervisorDocuments(params?: {
    document_type?: string;
    status?: string;
    group?: number;
  }): Promise<{ results: Document[]; count: number; next: string | null; previous: string | null }> {
    const response = await this.api.get<{ results: Document[]; count: number; next: string | null; previous: string | null } | Document[]>('/supervisor/documents/', { params });
    // Handle paginated response
    if (response.data && typeof response.data === 'object' && 'results' in response.data) {
      return response.data as { results: Document[]; count: number; next: string | null; previous: string | null };
    }
    // Legacy non-paginated response
    const docs = Array.isArray(response.data) ? response.data : [];
    return { results: docs, count: docs.length, next: null, previous: null };
  }

  // Evaluations
  async getScopeDocumentEvaluation(groupId: number): Promise<any> {
    const response = await this.api.get(`/scope_document_evaluation_criteria/${groupId}/`);
    return response.data;
  }

  async updateScopeDocumentEvaluation(groupId: number, data: any): Promise<any> {
    const response = await this.api.patch(`/scope_document_evaluation_criteria/${groupId}/`, data);
    return response.data;
  }

  async getSRSEvaluationSupervisor(groupId: number): Promise<any> {
    const response = await this.api.get(`/srs-evaluation-supervisor/${groupId}/`);
    return response.data;
  }

  async updateSRSEvaluationSupervisor(groupId: number, data: any): Promise<any> {
    const response = await this.api.patch(`/srs-evaluation-supervisor/${groupId}/`, data);
    return response.data;
  }

  async getSRSEvaluationCommitteeMember(groupId: number): Promise<any> {
    const response = await this.api.get(`/srs-evaluation-committee-member/${groupId}/`);
    return response.data;
  }

  async updateSRSEvaluationCommitteeMember(groupId: number, data: any): Promise<any> {
    const response = await this.api.patch(`/srs-evaluation-committee-member/${groupId}/`, data);
    return response.data;
  }

  // SDD Evaluations
  async getSDDEvaluationSupervisor(groupId: number): Promise<any> {
    const response = await this.api.get(`/sdd-evaluation-supervisor/${groupId}/`);
    return response.data;
  }

  async updateSDDEvaluationSupervisor(groupId: number, data: any): Promise<any> {
    const response = await this.api.patch(`/sdd-evaluation-supervisor/${groupId}/`, data);
    return response.data;
  }

  async getSDDEvaluationCommitteeMember(groupId: number): Promise<any> {
    const response = await this.api.get(`/sdd-evaluation-committee-member/${groupId}/`);
    return response.data;
  }

  async updateSDDEvaluationCommitteeMember(groupId: number, data: any): Promise<any> {
    const response = await this.api.patch(`/sdd-evaluation-committee-member/${groupId}/`, data);
    return response.data;
  }

  // Evaluation 3
  async getEvaluation3Supervisor(groupId: number): Promise<any> {
    const response = await this.api.get(`/evaluation3-supervisor/${groupId}/`);
    return response.data;
  }

  async updateEvaluation3Supervisor(groupId: number, data: any): Promise<any> {
    const response = await this.api.patch(`/evaluation3-supervisor/${groupId}/`, data);
    return response.data;
  }

  async getEvaluation3CommitteeMember(groupId: number): Promise<any> {
    const response = await this.api.get(`/evaluation3-committee-member/${groupId}/`);
    return response.data;
  }

  async updateEvaluation3CommitteeMember(groupId: number, data: any): Promise<any> {
    const response = await this.api.patch(`/evaluation3-committee-member/${groupId}/`, data);
    return response.data;
  }

  // Evaluation 4
  async getEvaluation4Supervisor(groupId: number): Promise<any> {
    const response = await this.api.get(`/evaluation4-supervisor/${groupId}/`);
    return response.data;
  }

  async updateEvaluation4Supervisor(groupId: number, data: any): Promise<any> {
    const response = await this.api.patch(`/evaluation4-supervisor/${groupId}/`, data);
    return response.data;
  }

  async getEvaluation4CommitteeMember(groupId: number): Promise<any> {
    const response = await this.api.get(`/evaluation4-committee-member/${groupId}/`);
    return response.data;
  }

  async updateEvaluation4CommitteeMember(groupId: number, data: any): Promise<any> {
    const response = await this.api.patch(`/evaluation4-committee-member/${groupId}/`, data);
    return response.data;
  }

  // Chat
  async getChatMessages(groupId: number, page?: number): Promise<{ results: ChatMessage[]; count: number; next: string | null; previous: string | null }> {
    const params: any = { group: groupId };
    if (page) params.page = page;
    const response = await this.api.get<{ results: ChatMessage[]; count: number; next: string | null; previous: string | null } | ChatMessage[]>('/chatroom/', { params });
    // Handle paginated response
    if (response.data && typeof response.data === 'object' && 'results' in response.data) {
      return response.data as { results: ChatMessage[]; count: number; next: string | null; previous: string | null };
    }
    // Legacy non-paginated response
    const messages = Array.isArray(response.data) ? response.data : [];
    return { results: messages, count: messages.length, next: null, previous: null };
  }

  async sendChatMessage(data: { group: number; message: string }): Promise<ChatMessage> {
    const response = await this.api.post<ChatMessage>('/chatroom/', data);
    return response.data;
  }

  async deleteChatMessage(messageId: number): Promise<void> {
    await this.api.delete(`/chatroom/${messageId}/`);
  }

  // Templates
  async getTemplates(templateType: string, semester?: string): Promise<any[]> {
    const params = semester ? { semester } : {};
    const response = await this.api.get<any[] | { results: any[] }>(`/srs_template/${templateType}/`, { params });
    // Handle paginated response
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data.results) {
      return response.data.results;
    }
    return [];
  }

  async uploadTemplate(templateType: string, data: FormData): Promise<any> {
    const response = await this.api.post(`/srs_template/${templateType}/`, data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Export
  async exportReport(): Promise<Blob> {
    const response = await this.api.get('/export/report/', {
      responseType: 'blob',
    });
    return response.data;
  }

  // ==================== Notifications ====================

  async getNotifications(params?: {
    page?: number;
    is_read?: boolean;
    type?: string;
  }): Promise<PaginatedResponse<Notification>> {
    const response = await this.api.get<PaginatedResponse<Notification>>('/notifications/', { params });
    return response.data;
  }

  async getUnreadNotificationCount(): Promise<NotificationUnreadCount> {
    const response = await this.api.get<NotificationUnreadCount>('/notifications/unread-count/');
    return response.data;
  }

  async markNotificationsAsRead(notificationIds?: number[]): Promise<{ message: string; updated_count: number }> {
    const response = await this.api.post<{ message: string; updated_count: number }>(
      '/notifications/mark-read/',
      notificationIds ? { notification_ids: notificationIds } : {}
    );
    return response.data;
  }

  async getNotification(id: number): Promise<Notification> {
    const response = await this.api.get<Notification>(`/notifications/${id}/`);
    return response.data;
  }

  async deleteNotification(id: number): Promise<void> {
    await this.api.delete(`/notifications/${id}/`);
  }

  async deleteAllNotifications(): Promise<{ message: string; deleted_count: number }> {
    const response = await this.api.delete<{ message: string; deleted_count: number }>('/notifications/delete-all/');
    return response.data;
  }

  async getNotificationPreferences(): Promise<NotificationPreference> {
    const response = await this.api.get<NotificationPreference>('/notifications/preferences/');
    return response.data;
  }

  async updateNotificationPreferences(preferences: Partial<NotificationPreference>): Promise<NotificationPreference> {
    const response = await this.api.patch<NotificationPreference>('/notifications/preferences/', preferences);
    return response.data;
  }

  // ==================== Analytics ====================

  async getSupervisorAnalytics(): Promise<SupervisorAnalytics> {
    const response = await this.api.get<SupervisorAnalytics>('/supervisor/analytics/');
    return response.data;
  }

  async getCommitteeMemberAnalytics(): Promise<CommitteeMemberAnalytics> {
    const response = await this.api.get<CommitteeMemberAnalytics>('/committee-member/analytics/');
    return response.data;
  }

  // ==================== Audit Logs ====================

  async getAuditLogs(params?: {
    page?: number;
    evaluation_type?: string;
    action_type?: string;
    group?: number;
    user?: number;
    from_date?: string;
    to_date?: string;
  }): Promise<PaginatedResponse<AuditLog>> {
    const response = await this.api.get<PaginatedResponse<AuditLog>>('/audit-logs/', { params });
    return response.data;
  }

  async getAuditLogsByGroup(groupId: number, page = 1): Promise<PaginatedResponse<AuditLog>> {
    const response = await this.api.get<PaginatedResponse<AuditLog>>(`/audit-logs/group/${groupId}/`, {
      params: { page }
    });
    return response.data;
  }

  async getAuditLogStats(): Promise<AuditLogStats> {
    const response = await this.api.get<AuditLogStats>('/audit-logs/stats/');
    return response.data;
  }

  // ==================== External Examiner API ====================

  // External Login
  async externalExaminerLogin(email: string, password: string): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>('/external/login/', {
      email,
      password,
    });
    return response.data;
  }

  // External Profile
  async getExternalProfile(): Promise<ExternalExaminer> {
    const response = await this.api.get<ExternalExaminer>('/external/profile/');
    return response.data;
  }

  async updateExternalProfile(data: Partial<ExternalExaminer>): Promise<ExternalExaminer> {
    const response = await this.api.patch<ExternalExaminer>('/external/profile/', data);
    return response.data;
  }

  // External Dashboard
  async getExternalDashboard(): Promise<ExternalDashboardData> {
    const response = await this.api.get<ExternalDashboardData>('/external/dashboard/');
    return response.data;
  }

  // External Examiners List (for committee)
  async getExternalExaminers(params?: {
    institution?: string;
    designation?: string;
    is_active?: boolean;
  }): Promise<PaginatedResponse<ExternalExaminerListItem>> {
    const response = await this.api.get<PaginatedResponse<ExternalExaminerListItem>>('/external/examiners/', { params });
    return response.data;
  }

  // External Groups
  async getExternalGroups(params?: {
    semester?: string;
    status?: string;
    external_examiner?: number;
  }): Promise<PaginatedResponse<ExternalGroup>> {
    const response = await this.api.get<PaginatedResponse<ExternalGroup>>('/external/groups/', { params });
    return response.data;
  }

  async getExternalGroup(id: number): Promise<ExternalGroupDetail> {
    const response = await this.api.get<ExternalGroupDetail>(`/external/groups/${id}/`);
    return response.data;
  }

  async createExternalGroup(data: ExternalGroupCreate): Promise<ExternalGroup> {
    const response = await this.api.post<ExternalGroup>('/external/groups/', data);
    return response.data;
  }

  async updateExternalGroup(id: number, data: Partial<ExternalGroupCreate>): Promise<ExternalGroup> {
    const response = await this.api.patch<ExternalGroup>(`/external/groups/${id}/`, data);
    return response.data;
  }

  async deleteExternalGroup(id: number): Promise<void> {
    await this.api.delete(`/external/groups/${id}/`);
  }

  // External Group Assignments
  async getExternalGroupStudents(groupId: number): Promise<ExternalGroupAssignment[]> {
    const response = await this.api.get<ExternalGroupAssignment[]>(
      `/external/groups/${groupId}/students/`
    );
    return response.data;
  }

  async getAvailableGroupsForExternal(params?: {
    semester?: string;
    completed_internal?: string;
  }): Promise<PaginatedResponse<SupervisorOfStudentGroup>> {
    const response = await this.api.get<PaginatedResponse<SupervisorOfStudentGroup>>(
      '/external/available-groups/',
      { params }
    );
    return response.data;
  }

  async createExternalAssignment(data: {
    external_group: number;
    supervisor_group: number;
    slot_number?: number;
    slot_time?: string;
  }): Promise<ExternalGroupAssignment> {
    const response = await this.api.post<ExternalGroupAssignment>(
      '/external/assignments/',
      data
    );
    return response.data;
  }

  async deleteExternalAssignment(id: number): Promise<void> {
    await this.api.delete(`/external/assignments/${id}/`);
  }

  // External Evaluations
  async getExternalEvaluations(): Promise<ExternalEvaluation[]> {
    const response = await this.api.get<ExternalEvaluation[]>('/external/evaluations/');
    return response.data;
  }

  async getExternalEvaluation(id: number): Promise<ExternalEvaluation> {
    const response = await this.api.get<ExternalEvaluation>(`/external/evaluations/${id}/`);
    return response.data;
  }

  async createExternalEvaluation(data: ExternalEvaluationCreate): Promise<ExternalEvaluation> {
    const response = await this.api.post<ExternalEvaluation>(
      '/external/evaluations/create/',
      data
    );
    return response.data;
  }

  async updateExternalEvaluation(
    id: number,
    data: Partial<ExternalEvaluationCreate>
  ): Promise<ExternalEvaluation> {
    const response = await this.api.patch<ExternalEvaluation>(
      `/external/evaluations/${id}/`,
      data
    );
    return response.data;
  }

  // Student External Evaluation View
  async getStudentExternalEvaluation(): Promise<ExternalEvaluation | null> {
    try {
      const response = await this.api.get<ExternalEvaluation>('/student/external-evaluation/');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Evaluation Schedules
  async getEvaluationSchedules(params?: {
    type?: string;
    semester?: string;
    status?: string;
    upcoming?: string;
  }): Promise<PaginatedResponse<EvaluationSchedule>> {
    const response = await this.api.get<PaginatedResponse<EvaluationSchedule>>('/schedules/', { params });
    return response.data;
  }

  async getEvaluationSchedule(id: number): Promise<EvaluationSchedule> {
    const response = await this.api.get<EvaluationSchedule>(`/schedules/${id}/`);
    return response.data;
  }

  async createEvaluationSchedule(data: EvaluationScheduleCreate): Promise<EvaluationSchedule> {
    const response = await this.api.post<EvaluationSchedule>('/schedules/', data);
    return response.data;
  }

  async updateEvaluationSchedule(id: number, data: Partial<EvaluationScheduleCreate>): Promise<EvaluationSchedule> {
    const response = await this.api.patch<EvaluationSchedule>(`/schedules/${id}/`, data);
    return response.data;
  }

  async deleteEvaluationSchedule(id: number): Promise<void> {
    await this.api.delete(`/schedules/${id}/`);
  }

  // Consolidated Report Export
  async downloadConsolidatedReport(): Promise<void> {
    const response = await this.api.get('/export/consolidated-report/', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'consolidated_evaluations.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // Utility
  async logout(): Promise<void> {
    try {
      await axios.post(`${API_BASE_URL}/token/logout/`, {}, { withCredentials: true });
    } catch (e) {
      // Ignore network errors during logout cleanup
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_type');
    }
  }
}

export const apiService = new ApiService();
