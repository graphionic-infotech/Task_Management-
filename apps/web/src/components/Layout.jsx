import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { api, setToken } from '../lib/api.js';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      ['/dashboard', '◧', 'Dashboard', 'Overview & today'],
      ['/tasks', '☑', 'Tasks', 'All work'],
      ['/my', '◎', 'My Tasks', 'Personal'],
      ['/documents', '📁', 'Documents', 'Files & Specs'],
      ['/settings', '⚙', 'Settings', 'Preferences'],
    ]
  }
];

const ALL_NAV = NAV_GROUPS.flatMap(g => g.items);

export default function Layout({ user, meta, onNewTask, onOpenTask, children }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [notifs, setNotifs] = useState({ rows: [], unread: 0 });
  const [showN, setShowN] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const boxRef = useRef();
  const topRef = useRef();

  const initials = (user?.first_name?.[0] || 'A') + (user?.last_name?.[0] || '');

  const loadNotifs = async () => {
    try { setNotifs(await api('/api/notifications')); } catch {}
  };
  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 6000);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const r = notifs.rows.find(n => !n.is_read);
    if (r && !window.__gtNotified?.includes(r.id) && 'Notification' in window && Notification.permission === 'granted') {
      window.__gtNotified = [...(window.__gtNotified || []), r.id];
      try { new Notification(r.title, { body: r.body }); } catch {}
    }
  }, [notifs]);

  useEffect(() => {
    const fn = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) { setResults(null); }
      if (topRef.current && !topRef.current.contains(e.target)) { setShowN(false); }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(async () => {
      try { setResults(await api('/api/search?q=' + encodeURIComponent(q))); } catch {}
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const logout = async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} setToken(null); nav('/login'); };

  const activeItem = ALL_NAV.find(([p]) => loc.pathname.startsWith(p));

  return (
    <div className="shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div className="brand-text">
            <div className="brand-name">GraphTeam</div>
            <div className="brand-sub">Team workspace</div>
          </div>
        </div>

        <nav className="nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(([p, ico, label, desc]) => (
                <NavLink key={p} to={p} className={({ isActive }) => isActive ? 'active' : ''} title={desc}>
                  <span className="ico" aria-hidden>{ico}</span>
                  <span style={{flex:1}}>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="side-footer">
          <div className="side-user">
            <div className="side-avatar" aria-hidden>{initials.toUpperCase()}</div>
            <div className="side-user-meta">
              <div className="side-user-name">{user?.first_name} {user?.last_name}</div>
              <div className="side-user-role">{user?.role}</div>
            </div>
            <button className="side-user-action" onClick={logout} aria-label="Logout" title="Logout">↗</button>
          </div>
          <div style={{fontSize:11, color:'var(--text-faint)', textAlign:'center', marginTop:8, fontWeight:500}}>Press <span style={{background:'#fff', border:'1px solid var(--border)', padding:'1px 5px', borderRadius:6, fontFamily:'var(--font-mono)', fontSize:10}}>C</span> for new task</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar" ref={topRef}>
          <div className="searchbox" ref={boxRef}>
            <span className="sic" aria-hidden>⌕</span>
            <input
              aria-label="Search tasks, contacts, companies"
              placeholder="Search tasks, documents, or team members…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {results && (
              <div className="search-results" role="listbox">
                <div className="cat">Tasks — {results.tasks.length}</div>
                {results.tasks.slice(0, 8).map((t) => (
                  <div key={t.id} className="sr" role="option" onClick={() => { onOpenTask(t.id); setResults(null); setQ(''); }}>
                    <span style={{width:8, height:8, borderRadius:'50%', background: t.priority==='URGENT' ? 'var(--pri-urgent)' : t.priority==='HIGH' ? 'var(--pri-high)' : 'var(--primary)', flexShrink:0}} />
                    <span style={{flex:1, minWidth:0}}><b style={{fontWeight:650}}>{t.title}</b> <span style={{color:'var(--text-muted)'}}>· {t.assignee_first} · {t.priority}</span></span>
                  </div>
                ))}
                {!results.tasks.length && <div className="sr" style={{color:'var(--text-muted)'}}>No tasks found</div>}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            <div style={{position:'relative'}}>
              <button className="bell" onClick={() => setShowN(!showN)} aria-label={`Notifications ${notifs.unread ? '('+notifs.unread+' unread)' : ''}`} aria-expanded={showN}>
                <span aria-hidden>◐</span>
                {notifs.unread > 0 && <span className="dot" aria-hidden>{notifs.unread}</span>}
              </button>
              {showN && (
                <div className="notif-panel" role="dialog" aria-label="Notifications">
                  <div className="notif-panel-head">
                    <span>Notifications</span>
                    <button className="btn small ghost" onClick={async () => { await api('/api/notifications/read-all', { method: 'POST' }); loadNotifs(); }}>Mark all read</button>
                  </div>
                  <div className="notif-list">
                    {notifs.rows.map((n) => (
                      <div key={n.id} className={'notif' + (n.is_read ? '' : ' unread')} onClick={async () => { await api(`/api/notifications/${n.id}/read`, { method: 'POST' }); loadNotifs(); if (n.task_id) onOpenTask(n.task_id); setShowN(false); }}>
                        <div className="notif-dot" aria-hidden />
                        <div className="notif-content">
                          <b>{n.title}</b>
                          <small>{n.body} · {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>
                        </div>
                      </div>
                    ))}
                    {!notifs.rows.length && (
                      <div className="empty" style={{padding:'28px 16px'}}>
                        <div className="empty-icon">✦</div>
                        <div className="empty-title">All caught up</div>
                        <div className="empty-desc">No new notifications. Reminders and assignments will appear here.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="btn primary" onClick={onNewTask} aria-label="Create new task">
              <span aria-hidden>+</span> New Task
            </button>
          </div>
        </header>

        <div className="mobile-topbar">
          <div className="mobile-brand">
            <div className="brand-mark" style={{width:30, height:30, borderRadius:9, fontSize:14}}>G</div>
            <span>GraphTeam</span>
          </div>
          <button className="btn primary small" onClick={onNewTask}>+ New</button>
        </div>

        <div className="content">{children}</div>

        {/* Mobile bottom nav */}
        <nav className="mobile-nav" aria-label="Mobile">
          {ALL_NAV.map(([p, ico, label]) => (
            <NavLink key={p} to={p} className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="ico" aria-hidden>{ico}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
