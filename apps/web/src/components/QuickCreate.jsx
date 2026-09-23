import { useState } from 'react';
import { api } from '../lib/api.js';
import { presetDue } from '../lib/time.js';

const REMINDERS = [
  [null, 'No reminder'],
  [0, 'At task time'],
  [5, '5 min before'],
  [15, '15 min before'],
  [30, '30 min before'],
  [60, '1 hour before'],
  [120, '2 hours before'],
  [1440, '1 day before']
];

export default function QuickCreate({ meta, onClose, onSaved }) {
  const [mode, setMode] = useState('standard'); // 'standard' or 'small_task'
  const [adv, setAdv] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    title: '',
    assignee_id: '',
    duePreset: 'today',
    due_at: '',
    priority: 'MEDIUM',
    reminder_minutes: 15,
    repeat_minutes: null,
    description: '',
    start_at: '',
    recurrence: 'NONE'
  });

  // Subtasks list for this task
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  const handleAddSubtask = (e) => {
    e?.preventDefault();
    if (!subtaskInput.trim()) return;
    setSubtasks([...subtasks, subtaskInput.trim()]);
    setSubtaskInput('');
  };

  const removeSubtask = (index) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!f.title.trim()) { setErr('Task name is required'); return; }
    setErr(''); setLoading(true);
    try {
      let due_at;
      if (f.due_at) {
        const parsed = new Date(f.due_at);
        if (isNaN(parsed.getTime())) {
          setErr('Please select a valid due date and time');
          setLoading(false);
          return;
        }
        due_at = parsed.toISOString();
      } else {
        due_at = presetDue(f.duePreset);
      }

      let start_at = undefined;
      if (f.start_at) {
        const parsedStart = new Date(f.start_at);
        if (!isNaN(parsedStart.getTime())) {
          start_at = parsedStart.toISOString();
          if (due_at && start_at > due_at) {
            setErr('Due date/time must be after start date/time');
            setLoading(false);
            return;
          }
        }
      }

      await api('/api/tasks', {
        method: 'POST',
        body: {
          title: f.title.trim(),
          description: f.description,
          assignee_id: f.assignee_id || undefined,
          due_at,
          start_at,
          priority: f.priority,
          reminder_minutes: f.reminder_minutes,
          repeat_minutes: f.repeat_minutes,
          recurrence: f.recurrence,
          subtasks: subtasks
        }
      });
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="New task">
      <div className="modal">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: 14, border: '1px solid var(--primary-soft-hover)' }}>⚡</span>
              {mode === 'small_task' ? 'Quick Small Task with Subtasks' : 'New Task'}
            </h3>
            <p className="modal-desc" style={{ marginBottom: 0 }}>
              {mode === 'small_task' ? 'Create a lightweight task with actionable checklist steps.' : 'Create in ~10 seconds — name, person, date & priority.'}
            </p>
          </div>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Task Type Switcher */}
        <div style={{ display: 'flex', gap: 6, margin: '12px 0 4px', background: 'var(--bg)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
          <button
            type="button"
            className={mode === 'standard' ? 'btn small primary' : 'btn small ghost'}
            style={{ flex: 1, borderRadius: 6, fontSize: 12 }}
            onClick={() => setMode('standard')}
          >
            📋 Standard Task
          </button>
          <button
            type="button"
            className={mode === 'small_task' ? 'btn small primary' : 'btn small ghost'}
            style={{ flex: 1, borderRadius: 6, fontSize: 12 }}
            onClick={() => {
              setMode('small_task');
              if (!f.priority || f.priority === 'LOW') set('priority', 'MEDIUM');
            }}
          >
            ⚡ Small Task + Subtasks
          </button>
        </div>

        {err && (
          <div className="error-card" style={{ marginTop: 10 }}>
            <span>⚠</span>
            <span style={{ flex: 1 }}>{err}</span>
            <button className="btn small ghost" onClick={() => setErr('')}>Dismiss</button>
          </div>
        )}

        <div className="field" style={{ marginTop: 14 }}>
          <label className="lbl" htmlFor="qc-title">
            {mode === 'small_task' ? 'Small Task Name *' : 'Task Name *'}
          </label>
          <input
            id="qc-title"
            className="inp"
            autoFocus
            placeholder={mode === 'small_task' ? 'e.g. Verify ABC delivery package' : 'e.g. Call ABC Industries'}
            value={f.title}
            onChange={e => set('title', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (!subtasks.length || e.ctrlKey) && save()}
          />
        </div>

        {/* Subtasks Section in Quick Create */}
        <div style={{ margin: '12px 0 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
              <span>☑</span> Add Subtasks / Checklist Steps ({subtasks.length})
            </span>
          </div>

          {subtasks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {subtasks.map((st, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{idx + 1}.</span>
                  <span style={{ flex: 1 }}>{st}</span>
                  <button type="button" onClick={() => removeSubtask(idx)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="inp"
              style={{ fontSize: 12.5, background: '#fff' }}
              placeholder="Type subtask and press Enter (e.g. Check PO number)"
              value={subtaskInput}
              onChange={e => setSubtaskInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubtask();
                }
              }}
            />
            <button
              type="button"
              className="btn small"
              onClick={handleAddSubtask}
              disabled={!subtaskInput.trim()}
            >
              + Add
            </button>
          </div>
        </div>

        <div className="formgrid">
          <div className="field">
            <label className="lbl">Assign to</label>
            <select className="sel" value={f.assignee_id} onChange={e => set('assignee_id', e.target.value)}>
              <option value="">Me</option>
              <option value="ALL">👥 All Team Members (Assign to Everyone)</option>
              {meta.users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Priority</label>
            <select className="sel" value={f.priority} onChange={e => set('priority', e.target.value)}>
              <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
            </select>
          </div>
          <div className="field">
            <label className="lbl">Due preset</label>
            <select className="sel" value={f.duePreset} onChange={e => set('duePreset', e.target.value)}>
              <option value="today">Today 6 PM</option>
              <option value="tomorrow">Tomorrow 10 AM</option>
              <option value="week">Next week</option>
            </select>
          </div>
          <div className="field">
            <label className="lbl">Or custom due</label>
            <input type="datetime-local" className="inp" value={f.due_at} onChange={e => set('due_at', e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Reminder</label>
            <select className="sel" value={f.reminder_minutes ?? ''} onChange={e => set('reminder_minutes', e.target.value === '' ? null : +e.target.value)}>
              {REMINDERS.map(([v, l]) => <option key={l} value={v ?? ''}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Repeat reminder</label>
            <select className="sel" value={f.repeat_minutes ?? ''} onChange={e => set('repeat_minutes', e.target.value === '' ? null : +e.target.value)}>
              <option value="">No repeat</option>
              <option value="3">Every 3 min</option>
              <option value="5">Every 5 min</option>
              <option value="15">Every 15 min</option>
              <option value="60">Every 1 hour</option>
              <option value="120">Every 2 hours</option>
            </select>
          </div>
        </div>

        {/* Description directly visible */}
        <div className="field full" style={{ marginTop: 12 }}>
          <label className="lbl">Task Description / Instructions</label>
          <textarea
            className="ta"
            rows="3"
            placeholder="Add instructions, context, links or notes for this task…"
            value={f.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        {!adv ? (
          <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setAdv(true)}>
            + More options — recurrence & start date
          </button>
        ) : (
          <div style={{ marginTop: 10, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Schedule & Recurrence</div>
            <div className="formgrid">
              <div className="field">
                <label className="lbl">Recurrence</label>
                <select className="sel" value={f.recurrence} onChange={e => set('recurrence', e.target.value)}>
                  <option value="NONE">None</option><option value="DAILY">Daily</option><option value="WEEKDAYS">Weekdays</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div className="field"><label className="lbl">Start</label><input type="datetime-local" className="inp" value={f.start_at} onChange={e => set('start_at', e.target.value)} /></div>
            </div>
            <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setAdv(false)}>− Less</button>
          </div>
        )}

        <div className="mrow" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!f.title.trim() || loading}>
            {loading ? 'Creating…' : mode === 'small_task' ? '⚡ Create Small Task' : '✓ Create Task'}
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-faint)' }}>
          Press <span style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 6 }}>Esc</span> to close · <span style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 6 }}>C</span> to open again
        </div>
      </div>
    </div>
  );
}
