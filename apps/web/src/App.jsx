import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api, setToken } from './lib/api.js';
import Layout from './components/Layout.jsx';
import QuickCreate from './components/QuickCreate.jsx';
import TaskDetail from './components/TaskDetail.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import Documents from './pages/Documents.jsx';
import Settings from './pages/Settings.jsx';

function MyTasks({ meta, onOpen, refreshKey, user }) {
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState('open');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    const p = new URLSearchParams({ assignee: user.id });
    if (tab === 'today') p.set('view', 'today');
    else if (tab === 'overdue') p.set('view', 'overdue');
    else if (tab === 'upcoming') p.set('view', 'upcoming');
    else if (tab === 'completed') p.set('view', 'completed');
    else p.set('view', 'open');
    api('/api/tasks?' + p.toString()).then(setRows).catch(()=>{}).finally(()=>setLoading(false));
  }, [tab, refreshKey, user?.id]);
  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">My Tasks</h1>
          <p className="page-sub">Focused on you — {user?.first_name || 'You'}'s open, today, overdue and upcoming.</p>
        </div>
        <div className="page-actions">
          <span className="pill teal" style={{fontSize:13, padding:'6px 12px'}}>{rows.length} tasks</span>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {[['open','Open'],['today','Today'],['overdue','Overdue'],['upcoming','Upcoming'],['completed','Completed']].map(([v,l])=>(
          <button key={v} role="tab" aria-selected={tab===v} className={tab===v?'active':''} onClick={()=>setTab(v)}>{l}</button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Task</th><th style={{width:160}}>Status</th><th style={{width:110}}>Priority</th><th style={{width:180}}>Due</th></tr></thead>
          <tbody>
            {loading ? (
              [1,2,3].map(i=> <tr key={i}><td colSpan={4}><div className="skeleton" style={{height:14}} /></td></tr>)
            ) : rows.map(t=> (
              <tr key={t.id}>
                <td>
                  <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                    <span className="tasklink" onClick={()=>onOpen(t.id)}>{t.title}</span>
                    {t.subtask_count > 0 && (
                      <span className={`subtask-badge ${t.subtask_completed_count === t.subtask_count ? 'complete' : ''}`} style={{fontSize:10, padding:'1px 6px'}}>
                        ☑ {t.subtask_completed_count}/{t.subtask_count}
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:12, color:'var(--text-faint)', marginTop:2}}>{new Date(t.due_at).toLocaleDateString('en-IN',{day:'numeric', month:'short'})}</div>
                </td>
                <td>
                  <select
                    className="sel"
                    style={{width:150, padding:'6px 8px', fontSize:12, fontWeight:600}}
                    value={t.status_id}
                    onChange={async e=>{
                      const nextStatusId = e.target.value;
                      await api('/api/tasks/'+t.id, { method: 'PATCH', body: { status_id: nextStatusId } });
                      const st = meta.statuses.find(s => s.id === nextStatusId);
                      setRows(r => r.map(x => x.id === t.id ? { ...x, status_id: nextStatusId, status_closed: st?.is_closed ? 1 : 0, status_name: st?.name || x.status_name } : x).filter(x => {
                        if (tab === 'open') return !x.status_closed;
                        if (tab === 'completed') return !!x.status_closed;
                        return true;
                      }));
                    }}
                  >
                    {meta.statuses.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td><span className={`pill ${t.priority==='URGENT'?'red':t.priority==='HIGH'?'amber':t.priority==='MEDIUM'?'teal':'gray'}`}>{t.priority}</span></td>
                <td style={{fontSize:13, color:'var(--text-secondary)'}}>{new Date(t.due_at).toLocaleString('en-IN',{day:'numeric', month:'short', hour:'numeric', minute:'2-digit'})}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && (
          <div className="empty">
            <div className="empty-icon">◎</div>
            <div className="empty-title">Nothing here</div>
            <div className="empty-desc">No tasks in “{tab}”. Switch tabs or create a new one.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ statuses: [], types: [], users: [] });
  const [showNew, setShowNew] = useState(false);
  const [openTask, setOpenTask] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const nav = useNavigate();

  const loadSession = useCallback(async () => {
    try {
      const me = await api('/api/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const loadLookups = useCallback(async () => {
    try { setMeta(await api('/api/meta')); } catch {}
  }, []);
  useEffect(() => { if (user) loadLookups(); }, [user, loadLookups]);

  const bump = () => { setRefreshKey((k) => k + 1); loadLookups(); };

  // Auto-fetch new tasks and updates every 6 seconds
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 6000);
    return () => clearInterval(timer);
  }, [user]);

  useEffect(() => {
    const fn = (e) => {
      if ((e.key === 'c' || e.key === 'C') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && user) setShowNew(true);
      if (e.key === 'Escape') { setShowNew(false); setOpenTask(null); }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [user]);

  if (loading) return <div className="login-wrap"><div className="card" style={{padding:'24px 32px', textAlign:'center'}}>Loading GraphTeam…</div></div>;
  if (!user) return <Routes><Route path="*" element={<Login onLogin={(u) => { setUser(u); bump(); }} />} /></Routes>;

  return (
    <Layout user={user} meta={meta} onNewTask={() => setShowNew(true)} onOpenTask={setOpenTask}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<Dashboard onOpen={setOpenTask} />} />
        <Route path="/tasks" element={<Tasks meta={meta} onOpen={setOpenTask} refreshKey={refreshKey} user={user} />} />
        <Route path="/my" element={<MyTasks meta={meta} onOpen={setOpenTask} refreshKey={refreshKey} user={user} />} />
        <Route path="/documents" element={<Documents onOpenTask={setOpenTask} />} />
        <Route path="/settings" element={<Settings user={user} />} />
        <Route path="/login" element={<Navigate to="/dashboard" />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
      {showNew && <QuickCreate meta={meta} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); bump(); }} />}
      {openTask && <TaskDetail id={openTask} meta={meta} onClose={() => setOpenTask(null)} onChanged={bump} />}
    </Layout>
  );
}
