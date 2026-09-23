import React, { useEffect, useState, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtDateTime, dueLabel } from '../lib/time.js';

const VIEWS = [
  ['all', 'All', 'All tasks'],
  ['open', 'Open', 'Not completed'],
  ['today', 'Today', 'Due today'],
  ['overdue', 'Overdue', 'Past due'],
  ['upcoming', 'Upcoming', 'Future'],
  ['sent', 'Sent Tasks', 'Created by me'],
  ['completed', 'Completed', 'Done'],
];

export default function Tasks({ meta, onOpen, refreshKey, user }) {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || searchParams.get('view') || 'all';
  const initialPri = searchParams.get('priority') || '';

  const [view, setView] = useState(initialTab);
  const [mode, setMode] = useState('list');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ assignee: '', status: '', priority: initialPri, search: '' });
  const [sel, setSel] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState([]);
  const [subtasksMap, setSubtasksMap] = useState({});

  useEffect(() => {
    const tab = searchParams.get('tab') || searchParams.get('view');
    if (tab && tab !== view) setView(tab);
    const pri = searchParams.get('priority');
    if (pri && pri !== f.priority) setF(s => ({ ...s, priority: pri }));
  }, [searchParams]);

  const load = async () => {
    setLoading(true); setErr('');
    const p = new URLSearchParams();
    if (view !== 'all') p.set('view', view);
    if (f.assignee) p.set('assignee', f.assignee);
    if (f.status) p.set('status', f.status);
    if (f.priority) p.set('priority', f.priority);
    if (f.search) p.set('search', f.search);
    try {
      const data = await api('/api/tasks?' + p.toString());
      setRows(data);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); setSel([]); }, [view, refreshKey]);
  useEffect(() => { const t = setTimeout(load, 320); return () => clearTimeout(t); }, [f.search, f.assignee, f.status, f.priority]);

  const toggle = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const bulk = async (action, payload) => {
    await api('/api/tasks/bulk', { method: 'POST', body: { ids: sel, action, payload } });
    setSel([]); load();
  };
  const setStatus = async (id, status_id) => { await api('/api/tasks/' + id, { method: 'PATCH', body: { status_id } }); load(); };

  const toggleExpandSubtasks = async (taskId, e) => {
    e?.stopPropagation();
    if (expandedTasks.includes(taskId)) {
      setExpandedTasks(expandedTasks.filter(id => id !== taskId));
    } else {
      setExpandedTasks([...expandedTasks, taskId]);
      if (!subtasksMap[taskId]) {
        try {
          const list = await api(`/api/tasks/${taskId}/subtasks`);
          setSubtasksMap(s => ({ ...s, [taskId]: list || [] }));
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  const toggleInlineSubtask = async (taskId, st, e) => {
    e?.stopPropagation();
    try {
      const nextCompleted = !st.is_completed;
      const updated = await api(`/api/subtasks/${st.id}`, {
        method: 'PATCH',
        body: { is_completed: nextCompleted }
      });
      setSubtasksMap(s => ({
        ...s,
        [taskId]: (s[taskId] || []).map(item => item.id === st.id ? updated : item)
      }));
      setRows(r => r.map(task => {
        if (task.id === taskId) {
          const diff = nextCompleted ? 1 : -1;
          return { ...task, subtask_completed_count: (task.subtask_completed_count || 0) + diff };
        }
        return task;
      }));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Tasks</h1>
          <p className="page-sub">{loading ? 'Loading…' : `${rows.length} tasks`} · Click any task for details, comments, files. Press <span style={{fontFamily:'var(--font-mono)', background:'#fff', border:'1px solid var(--border)', padding:'1px 6px', borderRadius:6, fontSize:11}}>C</span> to create.</p>
        </div>
        <div className="page-actions">
          <div style={{display:'flex', gap:8, background:'var(--bg-subtle)', padding:4, borderRadius:999, border:'1px solid var(--border)'}}>
            <button className={mode==='list' ? 'btn small primary' : 'btn small ghost'} style={{borderRadius:999}} onClick={()=>setMode('list')}>☰ List</button>
            <button className={mode==='kanban' ? 'btn small primary' : 'btn small ghost'} style={{borderRadius:999}} onClick={()=>setMode('kanban')}>▦ Board</button>
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Task views">
        {VIEWS.map(([v,l]) => (
          <button key={v} role="tab" aria-selected={view===v} className={view===v ? 'active' : ''} onClick={()=>setView(v)}>{l}</button>
        ))}
      </div>

      <div className="toolbar-card" style={{marginBottom:14}}>
        <div style={{display:'flex', gap:10, flexWrap:'wrap', flex:1}}>
          {user?.role !== 'MEMBER' && (
            <select className="sel" style={{width:160}} value={f.assignee} onChange={e=>setF({...f, assignee:e.target.value})} aria-label="Filter by assignee">
              <option value="">All team members</option>{meta.users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          )}
          <select className="sel" style={{width:160}} value={f.status} onChange={e=>setF({...f, status:e.target.value})} aria-label="Filter by status">
            <option value="">All statuses</option>{meta.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="sel" style={{width:150}} value={f.priority} onChange={e=>setF({...f, priority:e.target.value})} aria-label="Filter by priority">
            <option value="">All priorities</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
          </select>
        </div>
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <div className="searchbox" style={{maxWidth:260, minWidth:200}}>
            <span className="sic" aria-hidden>⌕</span>
            <input className="inp" placeholder="Filter by keyword…" value={f.search} onChange={e=>setF({...f, search:e.target.value})} aria-label="Filter by keyword" />
          </div>
        </div>
      </div>

      {sel.length>0 && (
        <div className="bulkbar" role="toolbar" aria-label="Bulk actions">
          <span style={{fontWeight:700, display:'inline-flex', alignItems:'center', gap:8}}><span style={{background:'#fff', color:'var(--text-primary)', padding:'2px 8px', borderRadius:999, fontSize:12, fontWeight:800}}>{sel.length}</span> selected</span>
          <select className="sel" style={{width:150, background:'#fff', color:'#0f172a'}} defaultValue="" onChange={e=> e.target.value && bulk('status', {status_id:e.target.value})}>
            <option value="">Set status…</option>{meta.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="sel" style={{width:140, background:'#fff', color:'#0f172a'}} defaultValue="" onChange={e=> e.target.value && bulk('priority', {priority:e.target.value})}>
            <option value="">Set priority…</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
          </select>
          <select className="sel" style={{width:150, background:'#fff', color:'#0f172a'}} defaultValue="" onChange={e=> e.target.value && bulk('assign', {assignee_id:e.target.value})}>
            <option value="">Assign…</option>{meta.users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
          </select>
          <button className="btn small" style={{background:'#fff'}} onClick={()=>{ const d=prompt('New due (YYYY-MM-DD HH:MM)',''); if(d) bulk('reschedule',{due_at:new Date(d.replace(' ','T')).toISOString()});}}>📅 Reschedule</button>
          <button className="btn small" style={{background:'#fff'}} onClick={()=>{ const t=prompt('Tag to add:'); if(t) bulk('tag',{tag:t});}}>🏷 Tag</button>
          <button className="btn small danger" onClick={()=> confirm('Archive selected?') && bulk('delete',{})}>🗑 Archive</button>
          <button className="btn small ghost" style={{color:'#fff', borderColor:'rgba(255,255,255,0.2)'}} onClick={()=>setSel([])}>✕ Clear</button>
        </div>
      )}

      {err && <div className="error-card" style={{marginBottom:14}}><span>⚠</span><span style={{flex:1}}>{err}</span><button className="btn small" onClick={load}>Retry</button></div>}

      {loading ? (
        <div className="card" style={{padding:0, overflow:'hidden'}}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="skeleton-row" style={{borderBottom:'1px solid var(--border-light)'}}>
              <div className="skeleton" style={{width:16, height:16, borderRadius:4}} />
              <div style={{flex:1}}>
                <div className="skeleton" style={{width:'40%', height:12}} />
                <div className="skeleton" style={{width:'25%', height:10, marginTop:8}} />
              </div>
              <div className="skeleton" style={{width:80, height:22, borderRadius:999}} />
            </div>
          ))}
        </div>
      ) : mode === 'list' ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{width:36}}><input type="checkbox" checked={sel.length===rows.length && rows.length>0} onChange={()=>setSel(sel.length===rows.length ? [] : rows.map(r=>r.id))} aria-label="Select all" /></th>
                <th>Task</th>
                <th style={{width:140}}>Who</th>
                <th style={{width:150}}>Status</th>
                <th style={{width:110}}>Priority</th>
                <th style={{width:180}}>Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => {
                const dl = dueLabel(t.due_at, t.status_closed);
                const isExpanded = expandedTasks.includes(t.id);
                return (
                  <React.Fragment key={t.id}>
                    <tr className={t.priority==='URGENT' ? 'urgent' : t.priority==='HIGH' ? 'high' : ''}>
                      <td><input type="checkbox" checked={sel.includes(t.id)} onChange={()=>toggle(t.id)} aria-label={`Select ${t.title}`} /></td>
                      <td>
                        <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                          <span className="tasklink" onClick={()=>onOpen(t.id)}>{t.title}</span>
                          {t.subtask_count > 0 && (
                            <span
                              className={`subtask-badge ${t.subtask_completed_count === t.subtask_count ? 'complete' : ''}`}
                              style={{cursor: 'pointer'}}
                              onClick={(e) => toggleExpandSubtasks(t.id, e)}
                              title="Click to view & check subtasks"
                            >
                              ☑ {t.subtask_completed_count}/{t.subtask_count} {isExpanded ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                        <div style={{fontSize:12, color:'var(--text-faint)', marginTop:3}}>{t.type_name || ''}{t.company_name ? ' · '+t.company_name : ''}{t.project_name ? ' · '+t.project_name : ''}</div>
                      </td>
                      <td>
                        <span style={{display:'inline-flex', alignItems:'center', gap:7}}>
                          <span style={{width:24, height:24, borderRadius:'50%', background:'var(--primary-soft)', border:'1px solid var(--primary-soft-hover)', display:'grid', placeItems:'center', fontSize:11, fontWeight:700, color:'var(--primary)'}}>{(t.assignee_first?.[0]||'?').toUpperCase()}</span>
                          <span style={{fontWeight:500, fontSize:13}}>{t.assignee_first} {t.assignee_last}</span>
                        </span>
                      </td>
                      <td>
                        <select className="sel" style={{width:140, padding:'6px 8px', fontSize:12, fontWeight:600}} value={t.status_id} onChange={e=>setStatus(t.id, e.target.value)} aria-label={`Status for ${t.title}`}>
                          {meta.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td><span className={`pill ${t.priority==='URGENT' ? 'red' : t.priority==='HIGH' ? 'amber' : t.priority==='MEDIUM' ? 'teal' : 'gray'}`}>{t.priority}</span></td>
                      <td>
                        <span className={`due ${dl.cls}`}>{dl.text}</span>
                        <div style={{fontSize:11, color:'var(--text-faint)', marginTop:2}}>{fmtDateTime(t.due_at)}</div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="expandable-subtasks-row">
                        <td colSpan={6}>
                          <div style={{padding: '8px 0'}}>
                            <div style={{fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6}}>
                              <span>☑ Subtasks Checklist:</span>
                              <span style={{color: 'var(--primary-dark)'}}>{t.subtask_completed_count || 0} of {t.subtask_count || 0} completed</span>
                            </div>
                            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                              {(subtasksMap[t.id] || []).map(st => (
                                <div key={st.id} style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 13}}>
                                  <button
                                    type="button"
                                    className={`subtask-check-btn ${st.is_completed ? 'checked' : ''}`}
                                    onClick={(e) => toggleInlineSubtask(t.id, st, e)}
                                    aria-label="Toggle subtask"
                                  >
                                    ✓
                                  </button>
                                  <span style={{textDecoration: st.is_completed ? 'line-through' : 'none', color: st.is_completed ? 'var(--text-faint)' : 'var(--text-primary)'}}>
                                    {st.title}
                                  </span>
                                </div>
                              ))}
                              {subtasksMap[t.id] === undefined ? (
                                <span style={{fontSize: 12, color: 'var(--text-faint)'}}>Loading subtasks…</span>
                              ) : subtasksMap[t.id].length === 0 ? (
                                <span style={{fontSize: 12, color: 'var(--text-faint)'}}>No subtasks yet. Click task to add checklist steps.</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <div className="empty">
              <div className="empty-icon">☑</div>
              <div className="empty-title">No tasks in this view</div>
              <div className="empty-desc">Try changing filters or press <span style={{fontFamily:'var(--font-mono)', background:'var(--bg-subtle)', border:'1px solid var(--border)', padding:'1px 6px', borderRadius:6}}>C</span> to create one.</div>
            </div>
          )}
        </div>
      ) : (
        <div className="kanban">
          {meta.statuses.map(s => {
            const colRows = rows.filter(r => r.status_id === s.id);
            return (
              <div key={s.id} className="kcol">
                <div className="kcol-head">
                  <span className="kcol-title"><span style={{width:8, height:8, borderRadius:'50%', background:s.color, display:'inline-block'}} /> {s.name}</span>
                  <span className="kcol-count">{colRows.length}</span>
                </div>
                {colRows.map(t => {
                  const dl = dueLabel(t.due_at, t.status_closed);
                  return (
                    <div key={t.id} className={'kcard' + (t.priority==='URGENT' ? ' urgent' : '')} onClick={()=>onOpen(t.id)} role="button" tabIndex={0} onKeyDown={e=> e.key==='Enter' && onOpen(t.id)}>
                      <div className="kcard-head">
                        <span style={{fontWeight:650, fontSize:13.5, lineHeight:1.35}}>{t.title}</span>
                        <span className={`pill ${t.priority==='URGENT' ? 'red' : t.priority==='HIGH' ? 'amber' : 'gray'}`} style={{fontSize:11, padding:'2px 7px'}}>{t.priority[0]}</span>
                      </div>
                      <div className="kcard-meta">
                        <span style={{display:'inline-flex', alignItems:'center', gap:6}}><span style={{width:18, height:18, borderRadius:'50%', background:'var(--bg-subtle)', display:'grid', placeItems:'center', fontSize:10, fontWeight:700}}>{t.assignee_first?.[0]}</span> {t.assignee_first}</span>
                        <span>·</span>
                        <span className={`due ${dl.cls}`} style={{fontSize:11}}>{dl.text.replace('Due ','')}</span>
                        {t.subtask_count > 0 && (
                          <>
                            <span>·</span>
                            <span className={`subtask-badge ${t.subtask_completed_count === t.subtask_count ? 'complete' : ''}`} style={{fontSize: 10, padding: '1px 5px'}}>
                              ☑ {t.subtask_completed_count}/{t.subtask_count}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!colRows.length && <div style={{textAlign:'center', padding:'20px 8px', color:'var(--text-faint)', fontSize:13}}>Empty</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
