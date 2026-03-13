import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import { auth } from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const getRedirectForRole = (role) => {
    if (role === 'super_admin') return '/admin';
    if (role === 'client_corporate' || role === 'client_individual') return '/client';
    if (role === 'trainee') return '/training/trainee-academy';
    return '/dashboard'; // mediator
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await auth.login(email, password);
      localStorage.setItem('token', data.access_token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate(getRedirectForRole(data.user.role));
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(err.response?.status === 401
        ? 'Invalid email or password. Run the seed script on the backend if this is a new deployment.'
        : (typeof detail === 'string' ? detail : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to home</Link>
        <img src="/logo.png" alt="Mediation Intelligence Platform" className="login-logo" />
        <p className="subtitle">Sign in to your account</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="error">{error}</div>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            <LogIn size={18} /> {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
