import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

// Route Code Splitting: Lazy-loaded dashboard pages for fast initial load
const LoginPage = lazy(() => import('./pages/LoginPage'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const SupervisorDashboard = lazy(() => import('./pages/SupervisorDashboard'));
const CommitteeMemberDashboard = lazy(() => import('./pages/CommitteeMemberDashboard'));
const ExternalDashboard = lazy(() => import('./pages/ExternalDashboard'));

const RouteLoadingFallback: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '14px' }}>
    <div
      className="route-spinner"
      style={{
        width: '42px',
        height: '42px',
        border: '3.5px solid #e2e8f0',
        borderTop: '3.5px solid #003366',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <span style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 500 }}>
      Đang tải trang...
    </span>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedTypes: string[] }> = ({
  children,
  allowedTypes,
}) => {
  const { userType, loading } = useAuth();

  if (loading) {
    return <RouteLoadingFallback />;
  }

  if (!userType || !allowedTypes.includes(userType)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { userType, loading } = useAuth();

  if (loading) {
    return <RouteLoadingFallback />;
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route
          path="/login"
          element={userType && ['student', 'supervisor', 'committee_member', 'external_examiner'].includes(userType) ? <Navigate to={`/${userType}/dashboard`} replace /> : <LoginPage />}
        />
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute allowedTypes={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/dashboard"
          element={
            <ProtectedRoute allowedTypes={['supervisor']}>
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/committee_member/dashboard"
          element={
            <ProtectedRoute allowedTypes={['committee_member']}>
              <CommitteeMemberDashboard />
            </ProtectedRoute>
          }
        />
        {/* External Examiner Route */}
        <Route
          path="/external_examiner/dashboard"
          element={
            <ProtectedRoute allowedTypes={['external_examiner']}>
              <ExternalDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <ToastContainer />
          <Router>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </Router>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
