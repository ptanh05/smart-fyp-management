import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const [userType, setUserType] = useState<'student' | 'supervisor' | 'committee_member' | 'external_examiner'>('student');
  const [registrationNo, setRegistrationNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let response;
      if (userType === 'student') {
        response = await apiService.studentLogin(registrationNo, password);
      } else if (userType === 'supervisor') {
        response = await apiService.supervisorLogin(email, password);
      } else if (userType === 'committee_member') {
        response = await apiService.committeeMemberLogin(email, password);
      } else {
        response = await apiService.externalExaminerLogin(email, password);
      }

      login(response.access, response.refresh, userType);
      navigate(`/${userType}/dashboard`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Project Management System</h1>
        <h2>Login</h2>
        
        <div className="user-type-selector">
          <button
            className={`type-btn ${userType === 'student' ? 'active' : ''}`}
            onClick={() => setUserType('student')}
          >
            Student
          </button>
          <button
            className={`type-btn ${userType === 'supervisor' ? 'active' : ''}`}
            onClick={() => setUserType('supervisor')}
          >
            Supervisor
          </button>
          <button
            className={`type-btn ${userType === 'committee_member' ? 'active' : ''}`}
            onClick={() => setUserType('committee_member')}
          >
            Committee
          </button>
          <button
            className={`type-btn ${userType === 'external_examiner' ? 'active' : ''}`}
            onClick={() => setUserType('external_examiner')}
          >
            External
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {userType === 'student' ? (
            <div className="form-group">
              <label htmlFor="registrationNo">Registration Number</label>
              <input
                id="registrationNo"
                type="text"
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                required
                placeholder="Enter registration number"
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="email">
                {userType === 'external_examiner' ? 'Email Address' : 'Email'}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={userType === 'external_examiner' ? 'Enter your email address' : 'Enter email'}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
