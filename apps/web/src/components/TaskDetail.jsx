import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtDateTime, dueLabel, toLocalInput, fromLocalInput } from '../lib/time.js';

const REMINDERS = [[null, 'No reminder'], [0, 'At task time'], [5, '5 min before'], [15, '15 min before'], [30, '30 min before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before']];

export default function TaskDetail({ id, meta, onClose, onChanged }) {
  const [t, setT] = useState(null);
  const [err, setErr] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);

  const load = async () => {
    try { setT(await api('/api/tasks/' + id)); setErr(''); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [id]);

  const addSubtask = async (e) => {
    e?.preventDefault();
    if (!subtaskTitle.trim() || addingSubtask) return;
    setAddingSubtask(true);
    try {
      const res = await api(`/api/tasks/${id}/subtasks`, {
        method: 'POST',
        body: { title: subtaskTitle.trim() }
      });
      setT(s => ({ ...s, subtasks: [...(s.subtasks || []), res] }));
      setSubtaskTitle('');
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setAddingSubtask(false);
    }
  };

  const toggleSubtask = async (st) => {
    try {
      const nextCompleted = !st.is_completed;
      const res = await api(`/api/subtasks/${st.id}`, {
        method: 'PATCH',
        body: { is_completed: nextCompleted }
      });
      setT(s => ({
        ...s,
        subtasks: (s.subtasks || []).map(item => item.id === st.id ? res : item)
      }));
      onChanged();
    } catch (e) {
      setErr(e.message);
    }
  };

  const deleteSubtask = async (stId) => {
    try {
      await api(`/api/subtasks/${stId}`, { method: 'DELETE' });
      setT(s => ({
        ...s,
        subtasks: (s.subtasks || []).filter(item => item.id !== stId)
      }));
      onChanged();
    } catch (e) {
      setErr(e.message);
    }
  };

  const patch = async (body) => {
    try {
      const nt = await api('/api/tasks/' + id, { method: 'PATCH', body });
      setT(s => ({ ...s, ...nt }));
      onChanged();
    } catch (e) { setErr(e.message); }
  };
  const complete = async () => {
    try {
      const r = await api(`/api/tasks/${id}/complete`, { method: 'POST' });
      setT(s => ({ ...s, ...r.task }));
      onChanged();
      if (r.suggestFollowUp) setShowDone(true);
    } catch (e) { setErr(e.message); }
  };
  const sendComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try { await api(`/api/tasks/${id}/comments`, { method: 'POST', body: { body: comment } }); setComment(''); load(); }
    catch (e) { setErr(e.message); }
    finally { setSending(false); }
  };

  if (err && !t) {
    return (
      <div className="drawer">
        <div className="drawer-head">
          <span style={{fontWeight:700}}>Error</span>
          <button className="btn small ghost" onClick={onClose}>✕ Close</button>
        </div>
        <div className="drawer-body">
          <div className="error-card"><span>⚠</span><span style={{flex:1}}>{err}</span><button className="btn small" onClick={load}>Retry</button></div>
        </div>
      </div>
    );
  }
  if (!t) {
    return (
      <div className="drawer">
        <div className="drawer-head"><div className="skeleton" style={{width:120, height:14}} /><button className="btn small ghost" onClick={onClose}>✕</button></div>
        <div className="drawer-body">
          <div className="skeleton" style={{height:22, width:'70%'}} />
          <div className="skeleton" style={{height:14, width:'40%', marginTop:10}} />
          <div className="skeleton" style={{height:120, marginTop:16}} />
        </div>
      </div>
    );
  }

  const dl = dueLabel(t.due_at, t.status_closed);

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={t.title}>
      <div className="drawer-head">
        <span className={`due ${dl.cls}`} style={{fontWeight:700, fontSize:12, background: dl.cls==='overdue' ? 'var(--error-soft)' : dl.cls==='today' || dl.cls==='soon' ? 'var(--warning-soft)' : 'var(--primary-soft)', border:'1px solid var(--border)', padding:'4px 10px', borderRadius:999}}>{dl.text}</span>
        <button className="btn small ghost" onClick={onClose} aria-label="Close">✕ Close</button>
      </div>

      <div className="drawer-body">
        <h2 style={{margin:'0 0 8px', fontSize:20, fontWeight:800, letterSpacing:'-0.4px', lineHeight:1.25}}>{t.title}</h2>

        <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
          <span className="pill" style={{background: t.status_color+'18', color: t.status_color, borderColor: t.status_color+'40'}}>{t.status_name}</span>
          <span className={`pill ${t.priority==='URGENT'?'red':t.priority==='HIGH'?'amber':t.priority==='MEDIUM'?'teal':'gray'}`}>{t.priority}</span>
          {t.recurrence!=='NONE' && <span className="pill green">🔁 {t.recurrence}</span>}
          {t.repeat_minutes && <span className="pill" style={{background:'#fff7ed', color:'#9a3412', borderColor:'#fed7aa'}}>⏰ Every {t.repeat_minutes}m</span>}
        </div>

        <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, marginBottom:14}}>
          <span style={{width:32, height:32, borderRadius:10, background:'var(--primary-soft)', border:'1px solid var(--primary-soft-hover)', display:'grid', placeItems:'center', fontWeight:700, color:'var(--primary)', fontSize:13}}>{(t.assignee_first?.[0]||'?').toUpperCase()}</span>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontWeight:650, fontSize:13}}>{t.assignee_first} {t.assignee_last}</div>
            <div style={{fontSize:12, color:'var(--text-muted)'}}>Assignee · Created by {t.creator_first} {t.creator_last}</div>
          </div>
          <span style={{fontSize:12, color:'var(--text-faint)', textAlign:'right'}}>{t.start_at ? fmtDateTime(t.start_at)+' → ' : ''}{fmtDateTime(t.due_at)}</span>
        </div>

        <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:8}}>
          {!t.status_closed ? (
            <button className="btn primary" onClick={complete}>✓ Complete Task</button>
          ) : (
            <button className="btn" onClick={async ()=>{ const nt=await api(`/api/tasks/${id}/reopen`,{method:'POST'}); setT(s=>({...s,...nt})); onChanged();}}>↩ Reopen Task</button>
          )}
        </div>

        {err && <div className="error-card" style={{marginBottom:14}}><span>⚠</span><span style={{flex:1}}>{err}</span><button className="btn small ghost" onClick={()=>setErr('')}>Dismiss</button></div>}

        {/* Subtasks / Checklist */}
        <div className="drawer-section">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
            <h4 style={{margin:0, fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:8}}>
              <span style={{width:22, height:22, borderRadius:7, background:'var(--primary-soft)', color:'var(--primary)', display:'grid', placeItems:'center', fontSize:11, border:'1px solid var(--primary-soft-hover)'}}>☑</span>
              Subtasks & Checklist
            </h4>
            {t.subtasks?.length > 0 && (
              <div className="subtasks-progress-wrap">
                <span>{t.subtasks.filter(s=>s.is_completed).length}/{t.subtasks.length}</span>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{width: `${Math.round((t.subtasks.filter(s=>s.is_completed).length / t.subtasks.length) * 100)}%`}}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="subtasks-container">
            <div className="subtask-list">
              {(t.subtasks || []).map(st => (
                <div key={st.id} className="subtask-item">
                  <button
                    type="button"
                    className={`subtask-check-btn ${st.is_completed ? 'checked' : ''}`}
                    onClick={() => toggleSubtask(st)}
                    aria-label={st.is_completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    ✓
                  </button>
                  <span className={`subtask-title ${st.is_completed ? 'completed' : ''}`}>
                    {st.title}
                  </span>
                  <button
                    type="button"
                    className="subtask-delete-btn"
                    onClick={() => deleteSubtask(st.id)}
                    title="Delete subtask"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {!t.subtasks?.length && (
                <div style={{padding:'12px 14px', fontSize:12.5, color:'var(--text-faint)', textAlign:'center'}}>
                  No subtasks yet. Break this task into smaller steps below.
                </div>
              )}
            </div>

            <form onSubmit={addSubtask} className="subtask-inline-add">
              <input
                placeholder="+ Add a subtask (press Enter)..."
                value={subtaskTitle}
                onChange={e => setSubtaskTitle(e.target.value)}
                disabled={addingSubtask}
              />
              <button
                type="submit"
                className="btn small primary"
                disabled={!subtaskTitle.trim() || addingSubtask}
              >
                {addingSubtask ? '…' : 'Add'}
              </button>
            </form>
          </div>
        </div>

        <div className="drawer-section">
          <h4 style={{margin:'0 0 12px', fontSize:13, fontWeight:800, letterSpacing:'-0.2px', display:'flex', alignItems:'center', gap:8}}><span style={{width:22, height:22, borderRadius:7, background:'var(--bg-subtle)', border:'1px solid var(--border)', display:'grid', placeItems:'center', fontSize:11}}>✎</span> Edit</h4>
          <div className="formgrid">
            <div className="field">
              <label className="lbl">Status</label>
              <select className="sel" value={t.status_id} onChange={e=>patch({status_id:e.target.value})}>
                {meta.statuses.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Priority</label>
              <select className="sel" value={t.priority} onChange={e=>patch({priority:e.target.value})}>
                <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">Assignee</label>
              <select className="sel" value={t.assignee_id||''} onChange={e=>patch({assignee_id:e.target.value})}>
                {meta.users.map(u=> <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Reminder</label>
              <select className="sel" value={t.reminder_minutes ?? ''} onChange={e=>patch({reminder_minutes: e.target.value==='' ? null : +e.target.value})}>
                {REMINDERS.map(([v,l])=> <option key={l} value={v ?? ''}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Repeat reminder</label>
              <select className="sel" value={t.repeat_minutes ?? ''} onChange={e=>patch({repeat_minutes: e.target.value==='' ? null : +e.target.value})}>
                <option value="">No repeat</option><option value="3">Every 3 min</option><option value="5">Every 5 min</option><option value="15">Every 15 min</option><option value="60">Every 1 hour</option><option value="120">Every 2 hours</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">Recurrence</label>
              <select className="sel" value={t.recurrence} onChange={e=>patch({recurrence:e.target.value})}>
                <option value="NONE">None</option><option value="DAILY">Daily</option><option value="WEEKDAYS">Weekdays</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option>
              </select>
            </div>
            <div className="field"><label className="lbl">Start</label><input type="datetime-local" className="inp" value={toLocalInput(t.start_at)} onChange={e=>patch({start_at:fromLocalInput(e.target.value)})} /></div>
            <div className="field"><label className="lbl">Due *</label><input type="datetime-local" className="inp" value={toLocalInput(t.due_at)} onChange={e=>patch({due_at:fromLocalInput(e.target.value)})} /></div>
            <div className="field full"><label className="lbl">Description</label><textarea className="ta" placeholder="Add details…" defaultValue={t.description||''} key={t.id+(t.description||'')} onBlur={e=> e.target.value !== (t.description||'') && patch({description:e.target.value})} /></div>
          </div>
        </div>

        <div className="drawer-section">
          <h4 style={{margin:'0 0 12px', fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:8}}><span style={{width:22, height:22, borderRadius:7, background:'var(--primary-soft)', color:'var(--primary)', display:'grid', placeItems:'center', fontSize:12, border:'1px solid var(--primary-soft-hover)'}}>💬</span> Comments <span style={{background:'var(--bg-subtle)', border:'1px solid var(--border)', padding:'1px 7px', borderRadius:999, fontSize:11, fontWeight:700, color:'var(--text-muted)'}}>{(t.comments||[]).length}</span></h4>
          {(t.comments||[]).map(c=> (
            <div key={c.id} className="comment">
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{width:22, height:22, borderRadius:'50%', background:'var(--primary-soft)', display:'grid', placeItems:'center', fontSize:11, fontWeight:700, color:'var(--primary)'}}>{(c.first_name?.[0]||'?').toUpperCase()}</span>
                <b>{c.first_name} {c.last_name}</b>
                <small>{fmtDateTime(c.created_at)}</small>
              </div>
              <div style={{marginTop:6, lineHeight:1.5}}>{c.body}</div>
            </div>
          ))}
          {!t.comments?.length && <div style={{textAlign:'center', padding:'14px', color:'var(--text-faint)', fontSize:13, background:'var(--bg)', border:'1px dashed var(--border)', borderRadius:10}}>No comments yet — start the discussion.</div>}
          <div style={{display:'flex', gap:8, marginTop:10}}>
            <input className="inp" placeholder="Write a comment… (Enter to send)" value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={async e=>{ if(e.key==='Enter' && comment.trim() && !sending){ await sendComment(); }}} disabled={sending} />
            <button className="btn primary" disabled={!comment.trim() || sending} onClick={sendComment}>{sending ? '…' : 'Send'}</button>
          </div>
        </div>

        <div className="drawer-section">
          <h4 style={{margin:'0 0 10px', fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:8}}><span style={{width:22, height:22, borderRadius:7, background:'var(--info-soft)', color:'var(--info)', display:'grid', placeItems:'center', fontSize:11, border:'1px solid var(--info-border)'}}>📎</span> Attachments <span style={{background:'var(--bg-subtle)', border:'1px solid var(--border)', padding:'1px 7px', borderRadius:999, fontSize:11, fontWeight:700, color:'var(--text-muted)'}}>{(t.attachments||[]).length}</span></h4>
          {(t.attachments||[]).map(a=> (
            <div key={a.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, marginBottom:8}}>
              <span style={{display:'flex', alignItems:'center', gap:8, fontSize:13}}><span style={{width:28, height:28, borderRadius:8, background:'#fff', border:'1px solid var(--border)', display:'grid', placeItems:'center'}}>📄</span> <span style={{fontWeight:500}}>{a.filename}</span> <small style={{color:'var(--text-faint)'}}>({Math.round(a.size_bytes/1024)} KB)</small></span>
              <span style={{display:'flex', gap:6}}>
                <a className="btn small" href={`/api/attachments/${a.id}/download`} aria-label="Download">⬇</a>
                <button className="btn small danger" onClick={async ()=>{ await api(`/api/attachments/${a.id}`,{method:'DELETE'}); load(); }}>✕</button>
              </span>
            </div>
          ))}
          {!t.attachments?.length && <div style={{fontSize:12, color:'var(--text-faint)', marginBottom:8}}>PDF, images, docs, txt, csv — 25 MB max.</div>}
          <label className="btn small" style={{cursor:'pointer'}}>
            + Attach file
            <input type="file" style={{display:'none'}} onChange={async e=>{
              const f=e.target.files[0]; if(!f) return;
              const fd=new FormData(); fd.append('file', f);
              const r=await fetch(`/api/tasks/${id}/attachments`,{method:'POST', credentials:'include', headers:{Authorization:'Bearer '+(localStorage.getItem('gt_token')||'')}, body:fd});
              if(!r.ok) setErr('Upload failed — allowed: pdf, images, office docs, txt, csv');
              e.target.value=''; load();
            }} />
          </label>
        </div>

        {/* Linked Documents from Documents Hub */}
        <div className="drawer-section">
          <h4 style={{margin:'0 0 10px', fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:8}}>
            <span style={{width:22, height:22, borderRadius:7, background:'var(--info-soft)', color:'var(--info)', display:'grid', placeItems:'center', fontSize:11, border:'1px solid var(--info-border)'}}>📁</span>
            Linked Documents <span style={{background:'var(--bg-subtle)', border:'1px solid var(--border)', padding:'1px 7px', borderRadius:999, fontSize:11, fontWeight:700, color:'var(--text-muted)'}}>{(t.documents||[]).length}</span>
          </h4>
          {(t.documents || []).map(d => (
            <div key={d.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, marginBottom:8}}>
              <span style={{display:'flex', alignItems:'center', gap:8, fontSize:13}}>
                <span style={{fontSize:18}}>{d.filename ? '📎' : '📄'}</span>
                <div>
                  <div style={{fontWeight:650}}>{d.title}</div>
                  <div style={{fontSize:11, color:'var(--text-faint)'}}>{d.category} · {d.creator_first}</div>
                </div>
              </span>
              <a className="btn small" href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer" title="Download">
                ⬇
              </a>
            </div>
          ))}
          {!t.documents?.length && <div style={{fontSize:12, color:'var(--text-faint)', marginBottom:8}}>No linked documents yet.</div>}
        </div>


        <div className="drawer-section">
          <h4 style={{margin:'0 0 10px', fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:8}}><span style={{width:22, height:22, borderRadius:7, background:'var(--bg-subtle)', border:'1px solid var(--border)', display:'grid', placeItems:'center', fontSize:11}}>◷</span> Activity</h4>
          <div className="activity">
            {(t.activities||[]).map(a=> (
              <div key={a.id} className="ev">
                <span style={{fontWeight:650}}>{a.action}</span> {a.detail}
                <small>{a.first_name} · {fmtDateTime(a.created_at)}</small>
              </div>
            ))}
            {!t.activities?.length && <div style={{color:'var(--text-faint)', fontSize:13}}>No activity yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
