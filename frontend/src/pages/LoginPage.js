import React, { useState } from 'react';
import { Zap, Wand2 } from 'lucide-react';
import { login } from '../services/api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(
        err.response?.data?.error || 'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFill = () => {
    setEmail('admin@crisiscomm.ai');
    setPassword('password123');
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <Zap size={24} />
          </div>
          <div className="login-title">CrisisComm AI</div>
        </div>
        <p className="login-description">
          AI-powered crisis communication platform.<br />
          Manage, respond, and analyze in real time.
        </p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="login-actions">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
            <button
              type="button"
              className="auto-fill-btn"
              onClick={handleAutoFill}
            >
              <Wand2 size={14} />
              Auto-Fill Demo Credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
