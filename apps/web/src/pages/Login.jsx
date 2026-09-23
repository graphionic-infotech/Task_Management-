import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErr('Please enter both name and password');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const u = await api('/api/auth/login', {
        method: 'POST',
        body: { username: username.trim(), password }
      });
      if (u && u.token) setToken(u.token);
      onLogin(u);
      nav('/dashboard');
    } catch (er) {
      console.error('Login failed', er);
      setErr(er.message || 'Invalid name or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit} style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div className="brand-mark" style={{ width: 42, height: 42, fontSize: 20, borderRadius: 12 }}>G</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>GraphTeam</h1>
            <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Task Management Workspace</div>
          </div>
        </div>
        
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5, margin: '8px 0 20px' }}>
          Enter your name and password to access your tasks and workspace.
        </p>

        {err && (
          <div className="error-card" style={{ marginBottom: 16 }}>
            <span>⚠</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{err}</span>
            <button type="button" className="btn small ghost" onClick={() => setErr('')}>✕</button>
          </div>
        )}

        <div className="field" style={{ marginBottom: 14 }}>
          <label className="lbl" htmlFor="login-username">Name / Username</label>
          <input
            id="login-username"
            className="inp"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="e.g. mayank, rudra, lay, vedant, bhumi"
            disabled={loading}
            autoFocus
            required
          />
        </div>

        <div className="field" style={{ marginBottom: 20 }}>
          <label className="lbl" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="inp"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter password"
            disabled={loading}
            required
          />
        </div>

        <button className="btn primary" style={{ width: '100%', padding: '12px', fontSize: 14.5, fontWeight: 700 }} type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--text-faint)' }}>
          Secured team access · GraphTeam
        </div>
      </form>
    </div>
  );
}
