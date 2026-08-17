/**
 * Test data fixtures for E2E tests
 */

export const testUsers = {
  externalExaminer: {
    email: 'external@test.com',
    password: 'test123',
    name: 'Dr. External Examiner',
  },
  committeeMember: {
    email: 'committee@test.com',
    password: 'test123',
    name: 'Committee Member',
  },
  student: {
    registrationNo: '2021-CS-001',
    password: 'test123',
    name: 'John Doe',
  },
  supervisor: {
    email: 'supervisor@test.com',
    password: 'test123',
    name: 'Dr. Supervisor',
  },
};

export const testExternalGroup = {
  name: 'E2E Test External Group',
  semester: 'Spring 2026',
  maxGroups: 7,
  evaluationVenue: 'Room 101',
};

export const testEvaluation = {
  projectCompletion: 'good',
  codeQuality: 'excellent',
  functionality: 'good',
  understandingOfTechnology: 'excellent',
  problemSolving: 'good',
  innovation: 'adequate',
  presentationClarity: 'excellent',
  communication: 'good',
  timeManagement: 'good',
  documentationCompleteness: 'good',
  documentationQuality: 'good',
  qaResponse: 'excellent',
  overallComment: 'Great project implementation and presentation.',
  strengths: 'Strong technical foundation and clear presentation.',
  areasOfImprovement: 'Documentation could be more detailed.',
};
