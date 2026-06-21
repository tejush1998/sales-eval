import { useState } from 'react';

export default function LoginForm({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="card login-card">
        <h1>Sales Call Evaluator</h1>
        <p className="muted">Enter the password to continue</p>
        <form onSubmit={handleSubmit} data-testid="login-form">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
            data-testid="password-input"
          />
          <button type="submit" className="primary" disabled={loading || !password} data-testid="login-btn">
            {loading ? 'Checking…' : 'Sign in'}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
