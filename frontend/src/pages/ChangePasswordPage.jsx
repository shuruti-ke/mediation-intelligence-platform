import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import { auth } from '../api/client';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const getRedirectForRole = (role) => {
    if (role === 'super_admin') return '/admin';
    if (role === 'client_corporate' || role === 'client_individual') return '/client';
    if (role === 'trainee') return '/training/trainee-academy';
    return '/dashboard';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await auth.changePassword(currentPassword, newPassword);
      const userStr = localStorage.getItem('user');
      let user = { role: 'mediator' };
      try {
        if (userStr) user = JSON.parse(userStr);
      } catch {}
      if (user.must_change_password !== false) {
        user = { ...user, must_change_password: false };
        localStorage.setItem('user', JSON.stringify(user));
      }
      navigate(getRedirectForRole(user.role));
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <button type="button" className="back-link" onClick={() => navigate('/login')}>
          <ArrowLeft size={16} /> Back to login
        </button>
        <img src="/logo.png" alt="Mediation Intelligence Platform" className="login-logo" />
        <p className="subtitle">Change your password</p>
        <p className="change-password-hint">You must change your password before continuing.</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="error">{error}</div>}
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="New password (min 6 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            <LogIn size={18} /> {loading ? 'Changing...' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
