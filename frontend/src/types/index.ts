export type UserType = 'student' | 'supervisor' | 'committee_member' | 'external_examiner' | 'admin';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  user_type: UserType;
  is_active: boolean;
  is_staff: boolean;
  last_login: string | null;
}

export interface AdminSecurityEvent {
  id: number;
  action: string;
  actor: string;
  created_at: string;
  details: string;
}

export interface AdminSecurityMetrics {
  total_users: number;
  active_users: number;
  deactivated_users: number;
  security_headers: {
    httponly_cookies: boolean;
    content_security_policy: boolean;
    hsts_production: boolean;
    cors_credentials: boolean;
    magic_bytes_file_inspection: boolean;
    websocket_one_time_tickets: boolean;
  };
  recent_audit_events: AdminSecurityEvent[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  user_type: UserType;
  first_name?: string;
  last_name?: string;
}

export interface Student {
  id: number;
  user: User;
  registration_no: string;
  department: string;
  semester: string;
  batch_no: string;
  group_id?: number;
  groupmate_id?: number;
}

export interface Supervisor {
  id: number;
  user: User;
  supervisor_id: string;
  research_interest?: string;
  academic_background?: string;
}

export interface CommitteeMember {
  id: number;
  user: User;
  committee_id: string;
  panel: number;
  panel_info?: Panel | null;
}

export interface PanelMember {
  id: number;
  user: User;
  committee_id: string;
}

export interface Panel {
  id: number;
  name: string;
  members: PanelMember[];
}

export interface ProjectCategory {
  id: number;
  category_name: string;
  supervisor?: Supervisor[];
}

export interface Group {
  id: number;
  student_1: number;
  student_2: number;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  project_category: number;
  student_1_details?: Student;
  student_2_details?: Student;
  project_category_details?: ProjectCategory;
  comment_count?: number;
}

export interface Project {
  id: number;
  project_category: number;
  project_name: string;
  project_description: string;
  language: string;
  functionalities: string;
  groups_data?: number[];
  panel_info?: Panel | null;
  is_offered?: boolean;
}

export interface SupervisorOfStudentGroup {
  id: number;
  group: Group;
  supervisor: Supervisor;
  project: Project;
  status: 'pending' | 'accepted_by_student' | 'accepted' | 'rejected' | 'canceled';
  created_at: string;
  created_by: number;
}

export interface Document {
  id: number;
  title: string;
  document_type: 'scope_document' | 'srs_document' | 'sdd_document' | 'final_report_document' | 'presentation_document';
  uploaded_file: string;
  uploaded_at: string;
  status: 'pending' | 'accepted_by_student' | 'accepted' | 'rejected' | 'canceled';
  group: number;
  project_name?: string;
  uploaded_by?: Student;
  /** True after student submits this (accepted) document to committee; committee sees only these. */
  submitted_to_committee?: boolean;
  submitted_to_committee_at?: string | null;
  group_info?: {
    id: number;
    project_name: string | null;
    student_1: {
      id: number;
      username: string;
      registration_no: string;
    } | null;
    student_2: {
      id: number;
      username: string;
      registration_no: string;
    } | null;
  };
}

export type DocumentTypeValue =
  | 'scope_document'
  | 'srs_document'
  | 'sdd_document'
  | 'final_report_document'
  | 'presentation_document';

export interface DocumentRequirement {
  id: number;
  document_type: DocumentTypeValue;
  document_type_display: string;
  title: string;
  deadline: string;
  semester: string | null;
  created_at: string;
  updated_at: string;
  created_by: number | null;
}

export interface ChatMessage {
  id: number;
  group: number;
  message: string;
  sent_by: 'student' | 'supervisor';
  created_at: string;
  student?: Student;
  supervisor?: Supervisor;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  expire_time: string;
}

export interface EvaluationStatus {
  pending: number;
  marginal: number;
  adequate: number;
  good: number;
  excellent: number;
}

export interface GroupComment {
  id: number;
  comment: string;
  group: number;
  student: Student;
  created_at: string;
}

export interface SupervisorStudentComment {
  id: number;
  group: number;
  student: Student | null;
  supervisor: Supervisor | null;
  comment: string;
  commented_by: 'student' | 'supervisor';
  created_at: string;
}

export type NotificationType =
  | 'group_request'
  | 'group_request_accepted'
  | 'group_request_rejected'
  | 'supervisor_request'
  | 'supervisor_request_accepted'
  | 'supervisor_request_rejected'
  | 'new_chat_message'
  | 'document_uploaded'
  | 'document_approved'
  | 'document_rejected'
  | 'evaluation_completed'
  | 'new_comment'
  | 'external_assignment'
  | 'external_evaluation'
  | 'external_schedule'
  | 'general';

export interface Notification {
  id: number;
  notification_type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_group: number | null;
  related_supervisor_group: number | null;
  related_document: number | null;
  action_url: string | null;
}

export interface NotificationPreference {
  group_request_notifications: boolean;
  supervisor_request_notifications: boolean;
  chat_message_notifications: boolean;
  document_notifications: boolean;
  evaluation_notifications: boolean;
  comment_notifications: boolean;
  email_notifications_enabled: boolean;
  email_group_requests: boolean;
  email_supervisor_requests: boolean;
  email_document_updates: boolean;
  email_evaluation_updates: boolean;
}

export interface NotificationUnreadCount {
  unread_count: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Analytics Types
export interface EvaluationStat {
  completed: number;
  pending: number;
}

export interface SupervisorAnalytics {
  groups: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  };
  evaluations: {
    scope_document: EvaluationStat;
    srs_supervisor: EvaluationStat;
    sdd_supervisor: EvaluationStat;
    evaluation3_supervisor: EvaluationStat;
    evaluation4_supervisor: EvaluationStat;
  };
  average_marks: {
    srs_supervisor: number;
    sdd_supervisor: number;
    evaluation3_supervisor: number;
    evaluation4_supervisor: number;
  };
  documents: {
    total: number;
    pending: number;
    approved: number;
  };
  recent_documents: {
    id: number;
    title: string;
    document_type: string;
    status: string;
    uploaded_at: string;
  }[];
}

export interface CommitteeMemberAnalytics {
  panel: {
    id: number;
    name: string;
    total_members: number;
    members: {
      id: number;
      user__username: string;
      committee_id: string;
    }[];
  };
  groups: {
    total: number;
    groups_per_member: number;
  };
  evaluations: {
    srs_committee: EvaluationStat;
    sdd_committee: EvaluationStat;
    evaluation3_committee: EvaluationStat;
    evaluation4_committee: EvaluationStat;
  };
  average_marks: {
    srs_committee: number;
    sdd_committee: number;
    evaluation3_committee: number;
    evaluation4_committee: number;
  };
  completion: {
    total_evaluations: number;
    completed_evaluations: number;
    percentage: number;
  };
}

// Audit Log Types
export type AuditActionType = 
  | 'evaluation_update'
  | 'document_status_change'
  | 'group_status_change'
  | 'supervisor_request_update';

export type AuditEvaluationType =
  | 'scope_document'
  | 'srs_supervisor'
  | 'srs_committee'
  | 'sdd_supervisor'
  | 'sdd_committee'
  | 'evaluation3_supervisor'
  | 'evaluation3_committee'
  | 'evaluation4_supervisor'
  | 'evaluation4_committee';

export interface AuditLogGroupInfo {
  id: number;
  project_name: string | null;
  student_1: string | null;
  student_2: string | null;
}

export interface AuditLog {
  id: number;
  user: number;
  user_username: string;
  user_type: string;
  action_type: AuditActionType;
  evaluation_type: AuditEvaluationType | null;
  supervisor_group: number | null;
  group_info: AuditLogGroupInfo | null;
  description: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  ip_address: string | null;
}

export interface AuditLogStats {
  total_logs: number;
  recent_logs_7_days: number;
  by_evaluation_type: Record<string, number>;
  by_action_type: Record<string, number>;
}

// ==================== External Examiner Types ====================

export interface ExternalExaminer {
  id: number;
  user: User;
  external_id: string;
  institution: string;
  designation: string;
  specialization?: string;
  contact_number?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  groups_count?: number;
  total_students?: number;
}

export interface ExternalExaminerListItem {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  external_id: string;
  institution: string;
  designation: string;
  specialization?: string;
  is_active: boolean;
  groups_count: number;
}

export interface ExternalDashboardData {
  profile: ExternalExaminer;
  statistics: {
    total_groups: number;
    total_students: number;
    pending_evaluations: number;
    completed_evaluations: number;
  };
  upcoming_evaluations: ExternalGroupAssignment[];
  recent_evaluations: ExternalEvaluation[];
}

export interface ExternalGroup {
  id: number;
  name: string;
  external_examiner: number;
  external_examiner_name?: string;
  semester: string;
  max_groups: number;
  evaluation_date?: string;
  evaluation_venue?: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  created_by?: number;
  assignments_count?: number;
  available_slots?: number;
}

export interface ExternalGroupDetail extends ExternalGroup {
  assignments: ExternalGroupAssignment[];
  external_examiner_details: ExternalExaminerListItem;
}

export interface ExternalGroupCreate {
  name: string;
  semester: string;
  max_groups?: number;
  evaluation_date?: string;
  evaluation_venue?: string;
  notes?: string;
}

export interface ExternalGroupAssignment {
  id: number;
  external_group: number;
  external_group_name?: string;
  supervisor_group: number;
  supervisor_group_details?: {
    id: number;
    project: {
      id: number;
      project_name: string;
      project_category: string;
    } | null;
    supervisor: {
      id: number;
      name: string;
    };
    group: {
      id: number;
      student_1: {
        id: number;
        name: string;
        registration_no: string;
      };
      student_2: {
        id: number;
        name: string;
        registration_no: string;
      } | null;
    };
  };
  slot_number?: number;
  slot_time?: string;
  status: 'pending' | 'scheduled' | 'evaluated' | 'cancelled';
  assigned_at: string;
  assigned_by?: number;
  evaluation?: ExternalEvaluation | null;
}

export type ExternalEvaluationGrade = 'A' | 'B+' | 'B' | 'C+' | 'C' | 'F';

export interface ExternalEvaluation {
  id: number;
  assignment: number;
  assignment_details?: ExternalGroupAssignment;
  
  // Project Implementation (30 marks)
  project_completion: number;
  code_quality: number;
  functionality: number;
  project_implementation_marks: number;
  
  // Technical Knowledge (25 marks)
  understanding_of_technology: number;
  problem_solving: number;
  innovation: number;
  technical_knowledge_marks: number;
  
  // Presentation Skills (20 marks)
  presentation_clarity: number;
  communication: number;
  time_management: number;
  presentation_marks: number;
  
  // Documentation Quality (15 marks)
  documentation_completeness: number;
  documentation_quality: number;
  documentation_marks: number;
  
  // Q&A Response (10 marks)
  qa_response: number;
  qa_marks: number;
  
  // Totals
  total_marks: number;
  grade: ExternalEvaluationGrade;
  is_pass: boolean;
  
  // Comments
  overall_comment?: string;
  strengths?: string;
  areas_of_improvement?: string;
  
  // Timestamps
  evaluated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalEvaluationCreate {
  assignment: number;
  
  // Project Implementation (30 marks)
  project_completion: number;
  code_quality: number;
  functionality: number;
  
  // Technical Knowledge (25 marks)
  understanding_of_technology: number;
  problem_solving: number;
  innovation: number;
  
  // Presentation Skills (20 marks)
  presentation_clarity: number;
  communication: number;
  time_management: number;
  
  // Documentation Quality (15 marks)
  documentation_completeness: number;
  documentation_quality: number;
  
  // Q&A Response (10 marks)
  qa_response: number;
  
  // Comments
  overall_comment?: string;
  strengths?: string;
  areas_of_improvement?: string;
}

export type EvaluationScheduleType = 'internal' | 'external' | 'final_defense';
export type EvaluationScheduleStatus = 'scheduled' | 'completed' | 'postponed' | 'cancelled';

export interface EvaluationSchedule {
  id: number;
  title: string;
  evaluation_type: EvaluationScheduleType;
  semester: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  external_group?: number;
  external_group_name?: string;
  panel?: number;
  panel_name?: string;
  status: EvaluationScheduleStatus;
  notes?: string;
  created_by?: number;
  created_at: string;
}

export interface EvaluationScheduleCreate {
  title: string;
  evaluation_type: EvaluationScheduleType;
  semester: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  external_group?: number;
  panel?: number;
  status?: EvaluationScheduleStatus;
  notes?: string;
}
