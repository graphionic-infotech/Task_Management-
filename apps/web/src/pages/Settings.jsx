import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Settings({ user }) {
  const [statuses, setStatuses] = useState([]);
  const [types, setTypes] = useState([]);
  const [sName, setSName] = useState('');
  const [tName, setTName] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState('success');
  const [users, setUsers] = useState([]);
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', password: '', role: 'MEMBER' });
  const [loading, setLoading] = useState(true);

  const showMsg = (text, tone='success') => { setMsg(text); setMsgTone(tone); setTimeout(()=>setMsg(''), 3500); };

  const load = async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        api('/api/settings/statuses').catch(()=>[]),
        api('/api/settings/types').catch(()=>[])
      ]);
      setStatuses(s); setTypes(t);
      if (user.role !== 'MEMBER') {
        const u = await api('/api/users').catch(()=>[]);
        setUsers(u);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addUser = async () => {
    try {
      await api('/api/users', { method: 'POST', body: f });
      setF({ first_name: '', last_name: '', email: '', password: '', role: 'MEMBER' });
      showMsg('Member added ✓ They can log in right away.', 'success');
      load();
    } catch (e) { showMsg(e.message, 'error'); }
  };

  if (loading) {
    return (
      <div>
        <div className="page-header"><div className="skeleton" style={{width:160, height:22}} /></div>
        <div className="card"><div className="skeleton" style={{height:120}} /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Profile, team, workflow, and backup — all in one place.</p>
        </div>
      </div>

      {msg && (
        <div className={msgTone==='error' ? 'error-card' : 'card'} style={msgTone==='success' ? {borderColor:'var(--success-border)', background:'var(--success-soft)', color:'var(--success-text)', marginBottom:16, display:'flex', alignItems:'center', gap:10} : {marginBottom:16}}>
          <span aria-hidden>{msgTone==='error' ? '⚠' : '✓'}</span>
          <span style={{flex:1, fontWeight:600}}>{msg}</span>
          <button className="btn small ghost" onClick={()=>setMsg('')}>Dismiss</button>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon">◉</span> My profile</h3>
            <span className={`pill ${user.role==='ADMIN'?'teal':user.role==='MANAGER'?'blue':'gray'}`}>{user.role}</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:14, padding:'12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12}}>
            <div className="side-avatar" style={{width:40, height:40, borderRadius:12, fontSize:14}}>{(user.first_name?.[0]||'A')+(user.last_name?.[0]||'')}</div>
            <div>
              <div style={{fontWeight:700, fontSize:14}}>{user.first_name} {user.last_name}</div>
              <div style={{fontSize:12, color:'var(--text-muted)'}}>{user.email}</div>
            </div>
          </div>
          <div className="field">
            <label className="lbl">Change password</label>
            <input className="inp" type="password" placeholder="Current password" value={pw.current} onChange={e=>setPw({...pw, current:e.target.value})} style={{marginBottom:8}} />
            <input className="inp" type="password" placeholder="New password (min 6)" value={pw.next} onChange={e=>setPw({...pw, next:e.target.value})} />
            <div className="field-help">Use at least 6 characters. You’ll stay logged in.</div>
          </div>
          <button className="btn primary" style={{marginTop:12}} onClick={async ()=>{
            try { await api('/api/auth/change-password', {method:'POST', body:pw}); showMsg('Password changed ✓'); setPw({current:'', next:''}); }
            catch(e){ showMsg(e.message,'error'); }
          }}>Update password</button>
        </div>

        {user.role === 'ADMIN' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><span className="card-title-icon" style={{background:'var(--info-soft)', color:'var(--info)'}}>⬇</span> Backup & data</h3>
            </div>
            <p style={{color:'var(--text-muted)', fontSize:13, lineHeight:1.6, margin:'0 0 14px'}}>Download a full copy of your database. Keep it safe — it’s your team’s work.</p>
            <div style={{background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, padding:12, display:'flex', alignItems:'center', gap:12, marginBottom:14}}>
              <span style={{width:36, height:36, borderRadius:10, background:'var(--surface)', border:'1px solid var(--border)', display:'grid', placeItems:'center'}}>🗄</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:650, fontSize:13}}>grapteam.db</div>
                <div style={{fontSize:12, color:'var(--text-muted)'}}>SQLite · local file · includes tasks, comments, files</div>
              </div>
            </div>
            <a className="btn primary" href="/api/system/backup" style={{width:'100%', justifyContent:'center'}}>⬇ Download backup</a>
            <div className="field-help" style={{marginTop:10}}>Tip: also copy the <span style={{fontFamily:'var(--font-mono)', background:'#fff', border:'1px solid var(--border)', padding:'1px 6px', borderRadius:6, fontSize:11}}>data/</span> folder for uploaded files.</div>
          </div>
        )}
      </div>

      {user.role !== 'MEMBER' && (
        <div className="card" style={{marginTop:16}}>
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon" style={{background:'var(--primary-soft)', color:'var(--primary)'}}>◈</span> Team members</h3>
            <span className="pill gray">{users.length} members</span>
          </div>
          <p className="card-desc">Add your real team here. They can log in immediately.</p>

          <div className="table-wrap" style={{marginBottom:16}}>
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th style={{width:160}}>Actions</th></tr></thead>
              <tbody>
                {users.map(m=> (
                  <tr key={m.id}>
                    <td>
                      <span style={{display:'inline-flex', alignItems:'center', gap:8}}>
                        <span style={{width:28, height:28, borderRadius:8, background:'var(--bg-subtle)', border:'1px solid var(--border)', display:'grid', placeItems:'center', fontSize:12, fontWeight:700}}>{(m.first_name?.[0]||'?').toUpperCase()}</span>
                        <span style={{fontWeight:600}}>{m.first_name} {m.last_name}</span>
                      </span>
                    </td>
                    <td style={{fontSize:13, color:'var(--text-secondary)'}}>{m.email}</td>
                    <td><span className="pill gray">{m.role}</span></td>
                    <td>{m.is_active ? <span className="pill green">Active</span> : <span className="pill red">Off</span>}</td>
                    <td>
                      <div style={{display:'flex', gap:6}}>
                        <button className="btn small" onClick={async ()=>{ const np=prompt('New password for '+m.first_name+' (min 6):'); if(!np) return; try{ await api('/api/users/'+m.id,{method:'PATCH', body:{password:np}}); showMsg('Password updated ✓');} catch(e){ showMsg(e.message,'error');}}}>🔑</button>
                        <button className="btn small" onClick={async ()=>{ if(!confirm((m.is_active?'Deactivate ':'Activate ')+m.first_name+'?')) return; await api('/api/users/'+m.id,{method:'PATCH', body:{is_active:m.is_active?0:1}}); load();}}>{m.is_active?'⏸':'▶'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && <div className="empty" style={{padding:'24px 0'}}><div className="empty-desc">No team members yet</div></div>}
          </div>

          <div style={{background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, padding:16}}>
            <div style={{fontWeight:700, fontSize:13, marginBottom:10}}>Add new member</div>
            <div className="formgrid">
              <div className="field"><label className="lbl">First name *</label><input className="inp" value={f.first_name} onChange={e=>setF({...f, first_name:e.target.value})} placeholder="e.g. John" /></div>
              <div className="field"><label className="lbl">Last name</label><input className="inp" value={f.last_name} onChange={e=>setF({...f, last_name:e.target.value})} placeholder="e.g. Doe" /></div>
              <div className="field"><label className="lbl">Email (login) *</label><input className="inp" value={f.email} onChange={e=>setF({...f, email:e.target.value})} placeholder="name@grapteam.local" /></div>
              <div className="field"><label className="lbl">Password *</label><input className="inp" value={f.password} onChange={e=>setF({...f, password:e.target.value})} placeholder="min 6" /></div>
              <div className="field">
                <label className="lbl">Role</label>
                <select className="sel" value={f.role} onChange={e=>setF({...f, role:e.target.value})}>
                  <option>MEMBER</option><option>MANAGER</option>{user.role==='ADMIN' && <option>ADMIN</option>}
                </select>
              </div>
              <div style={{display:'flex', alignItems:'flex-end'}}>
                <button className="btn primary" onClick={addUser} style={{width:'100%'}}>+ Add member</button>
              </div>
            </div>
            <div style={{fontSize:11, color:'var(--text-faint)', marginTop:10, lineHeight:1.5}}>MEMBER does tasks · MANAGER sees reports · ADMIN full control + backup.</div>
          </div>
        </div>
      )}

      <div className="grid2" style={{marginTop:16}}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon">⬢</span> Statuses</h3>
            <span className="pill gray">{statuses.length}</span>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {statuses.map(s=> (
              <div key={s.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10}}>
                <span style={{display:'inline-flex', alignItems:'center', gap:8}}><span style={{width:8, height:8, borderRadius:'50%', background:s.color, display:'inline-block'}} /><span className="pill" style={{background:s.color+'18', color:s.color, borderColor:s.color+'40'}}>{s.name}</span>{s.is_closed ? <span style={{fontSize:11, color:'var(--text-faint)'}}>· closed</span> : null}</span>
                {user.role==='ADMIN' && <button className="btn small ghost" style={{padding:'4px 8px'}} onClick={async ()=>{ try{ await api('/api/settings/statuses/'+s.id,{method:'DELETE'}); load(); showMsg('Status removed')} catch(e){ showMsg(e.message,'error');}}}>✕</button>}
              </div>
            ))}
            {!statuses.length && <div style={{textAlign:'center', padding:12, color:'var(--text-muted)', fontSize:13}}>No statuses</div>}
          </div>
          {user.role==='ADMIN' && (
            <div style={{display:'flex', gap:8, marginTop:12}}>
              <input className="inp" placeholder="New status name" value={sName} onChange={e=>setSName(e.target.value)} />
              <button className="btn primary" onClick={async ()=>{ if(!sName.trim()) return; await api('/api/settings/statuses',{method:'POST', body:{name:sName}}); setSName(''); load(); showMsg('Status added');}}>Add</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon" style={{background:'var(--info-soft)', color:'var(--info)'}}>⬣</span> Task types</h3>
            <span className="pill gray">{types.length}</span>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {types.map(t=> (
              <div key={t.id} style={{padding:'10px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, display:'flex', alignItems:'center', gap:8}}>
                <span className="pill blue">{t.name}</span>
              </div>
            ))}
            {!types.length && <div style={{textAlign:'center', padding:12, color:'var(--text-muted)', fontSize:13}}>No types</div>}
          </div>
          {user.role==='ADMIN' && (
            <div style={{display:'flex', gap:8, marginTop:12}}>
              <input className="inp" placeholder="New type name" value={tName} onChange={e=>setTName(e.target.value)} />
              <button className="btn primary" onClick={async ()=>{ if(!tName.trim()) return; await api('/api/settings/types',{method:'POST', body:{name:tName}}); setTName(''); load(); showMsg('Type added');}}>Add</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
