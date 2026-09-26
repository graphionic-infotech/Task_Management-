import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api.js';

const TEAM_MEMBERS = [
  { name: 'Mayank', role: 'ADMIN', pass: 'admin@mayank', color: '#0d9488', bg: '#ccfbf1', icon: '👑', label: 'Admin' },
  { name: 'Rudra', role: 'MEMBER', pass: 'team@rudra', color: '#6366f1', bg: '#e0e7ff', icon: '⚡', label: 'Member' },
  { name: 'Lay', role: 'MEMBER', pass: 'team@lay', color: '#0284c7', bg: '#e0f2fe', icon: '🚀', label: 'Member' },
  { name: 'Vedant', role: 'MEMBER', pass: 'team@vedant', color: '#7c3aed', bg: '#ede9fe', icon: '🎯', label: 'Member' },
  { name: 'Bhumi', role: 'MEMBER', pass: 'team@bhumi', color: '#db2777', bg: '#fce7f3', icon: '✨', label: 'Member' },
];

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingInAs, setLoggingInAs] = useState(null);
  const nav = useNavigate();

  const handleLogin = async (userQuery, passInput) => {
    const q = (userQuery || username).trim();
    const p = passInput || password;

    if (!q || !p) {
      setErr('Please enter both name and password');
      return;
    }

    setErr('');
    setLoading(true);

    try {
      const u = await api('/api/auth/login', {
        method: 'POST',
        body: { username: q, password: p }
      });
      if (u && u.token) setToken(u.token);
      onLogin(u);
      window.location.href = '/dashboard';
    } catch (er) {
      setErr(er.message || 'Invalid name or password');
    } finally {
      setLoading(false);
      setLoggingInAs(null);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    handleLogin();
  };

  const quickLogin = (m) => {
    setUsername(m.name);
    setPassword(m.pass);
    setLoggingInAs(m.name);
    handleLogin(m.name, m.pass);
  };

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 440, width: '100%', padding: '32px 28px' }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 22, borderRadius: 12, boxShadow: '0 4px 12px rgba(13,148,136,0.25)' }}>G</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>GraphTeam</h1>
            <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Task Management Workspace</div>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5, margin: '8px 0 20px' }}>
          Welcome back! Sign in or choose your profile below to enter your workspace.
        </p>

        {/* 1-Click Quick Login Section */}
        <div style={{ marginBottom: 22, padding: '14px', background: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚡ 1-Click Team Quick Access
            </span>
            <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>Tap to login</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {TEAM_MEMBERS.map((m) => {
              const isSelected = loggingInAs === m.name;
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => quickLogin(m)}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    padding: '8px 4px',
                    borderRadius: 10,
                    border: isSelected ? `2px solid ${m.color}` : '1px solid var(--border)',
                    background: isSelected ? m.bg : 'var(--surface)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: loading && !isSelected ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.06)';
                      e.currentTarget.style.borderColor = m.color;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = isSelected ? m.color : 'var(--border)';
                    }
                  }}
                  title={`Quick login as ${m.name} (${m.label})`}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: m.bg,
                    color: m.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700
                  }}>
                    {isSelected ? '⏳' : m.icon}
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize: 9.5, color: m.color, fontWeight: 600, background: m.bg, padding: '1px 5px', borderRadius: 4 }}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            or enter credentials
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Error notification */}
        {err && (
          <div className="error-card" style={{ marginBottom: 16 }}>
            <span>⚠</span>
            <span style={{ flex: 1, fontWeight: 650, fontSize: 13 }}>{err}</span>
            <button type="button" className="btn small ghost" onClick={() => setErr('')}>✕</button>
          </div>
        )}

        {/* Manual login form */}
        <form onSubmit={submit}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label className="lbl" htmlFor="login-password" style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showPass ? 'Hide Password' : 'Show Password'}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="inp"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter password or your name"
                disabled={loading}
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  opacity: 0.6,
                  padding: 4
                }}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          <button
            className="btn primary"
            style={{ width: '100%', padding: '12px', fontSize: 14.5, fontWeight: 700 }}
            type="submit"
            disabled={loading}
          >
            {loading ? (loggingInAs ? `Signing in as ${loggingInAs}…` : 'Signing in…') : 'Sign In →'}
          </button>
        </form>

        {/* Credentials guide note */}
        <div style={{
          marginTop: 18,
          padding: '10px 12px',
          background: 'var(--bg-subtle)',
          borderRadius: 10,
          border: '1px solid var(--border-light)',
          fontSize: 11.5,
          color: 'var(--text-muted)',
          lineHeight: 1.5
        }}>
          💡 <b>Team Passwords:</b> Mayank (<code>admin@mayank</code>) · Team (<code>team@&lt;name&gt;</code> or just your name / <code>123456</code>).
        </div>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11.5, color: 'var(--text-faint)' }}>
          Graphionic Infotech · GraphTeam Workspace
        </div>
      </div>
    </div>
  );
}
