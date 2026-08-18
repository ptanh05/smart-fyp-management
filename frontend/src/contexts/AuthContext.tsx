import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiService } from '../services/api';
import type { UserType, Student, Supervisor, CommitteeMember, ExternalExaminer } from '../types';

interface AuthContextType {
  user: Student | Supervisor | CommitteeMember | ExternalExaminer | null;
  userType: UserType | null;
  loading: boolean;
  login: (token: string, refreshToken: string, userType: UserType) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Student | Supervisor | CommitteeMember | ExternalExaminer | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  const login = (token: string, refreshToken: string, type: UserType) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user_type', type);
    setUserType(type);
    refreshUser();
  };

  const logout = () => {
    apiService.logout();
    setUser(null);
    setUserType(null);
  };

  const refreshUser = async () => {
    try {
      const type = localStorage.getItem('user_type') as UserType;
      if (!type) {
        setLoading(false);
        return;
      }

      setUserType(type);
      let userData: Student | Supervisor | CommitteeMember | ExternalExaminer;

      switch (type) {
        case 'student':
          userData = await apiService.getStudentProfile();
          break;
        case 'supervisor':
          userData = await apiService.getSupervisorProfile();
          break;
        case 'committee_member':
          userData = await apiService.getCommitteeMemberProfile();
          break;
        case 'external_examiner':
          userData = await apiService.getExternalProfile();
          break;
        default:
          throw new Error('Invalid user type');
      }

      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userType, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
