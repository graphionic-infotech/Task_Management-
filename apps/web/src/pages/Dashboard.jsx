import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { dueLabel } from '../lib/time.js';

function TaskRow({ t, onOpen }) {
  const dl = dueLabel(t.due_at, t.status_closed);
  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => onOpen(t.id)}>
      <td>
        <div className="task-title-row" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="tasklink" title={t.title}>{t.title}</span>
          {t.subtask_count > 0 && (
            <span
              className={`subtask-badge ${t.subtask_completed_count === t.subtask_count ? 'complete' : ''}`}
              style={{ fontSize: 10, padding: '1px 5px' }}
              title={`${t.subtask_completed_count} of ${t.subtask_count} subtasks completed`}
            >
              ☑ {t.subtask_completed_count}/{t.subtask_count}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
          {t.type_name || 'Task'} {t.company_name ? '· ' + t.company_name : ''}
        </div>
      </td>
      <td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>
            {(t.assignee_first?.[0] || '?').toUpperCase()}
          </span>
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: 13 }}>{t.assignee_first}</span>
        </span>
      </td>
      <td>
        <span className={`pill ${t.priority === 'URGENT' ? 'red' : t.priority === 'HIGH' ? 'amber' : t.priority === 'MEDIUM' ? 'teal' : 'gray'}`}>
          {t.priority}
        </span>
      </td>
      <td><span className={`due ${dl.cls}`}>{dl.text}</span></td>
    </tr>
  );
}

function StatCard({ icon, tone, value, label, hint, onClick }) {
  return (
    <div
      className="stat"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        userSelect: 'none'
      }}
      title={onClick ? `Click to view ${label} tasks` : undefined}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--primary)';
        }
      }}
      onMouseLeave={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }
      }}
    >
      <div className="stat-top">
        <div>
          <div className="n" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{value}</span>
            {onClick && <span style={{ fontSize: 12, color: 'var(--primary)', opacity: 0.8 }}>↗</span>}
          </div>
          <div className="t">{label}</div>
          {hint && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6, fontWeight: 500 }}>{hint}</div>}
        </div>
        <div className={`stat-icon ${tone}`} aria-hidden>{icon}</div>
      </div>
    </div>
  );
}

function SkeletonStats() {
  return (
    <div className="cards4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="stat" style={{ padding: 18 }}>
          <div className="skeleton" style={{ width: 60, height: 28 }} />
          <div className="skeleton" style={{ width: 90, height: 12, marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ onOpen }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const load = () => {
    setErr('');
    api('/api/dashboard').then(setD).catch(e => setErr(e.message || 'Failed to load'));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // auto-refresh dashboard every 8 seconds
    return () => clearInterval(t);
  }, []);

  if (err) {
    return (
      <div className="error-card">
        <span aria-hidden>⚠</span>
        <span style={{ flex: 1 }}>Could not load dashboard: {err}</span>
        <button className="btn small" onClick={load}>Retry</button>
        <button className="btn small ghost" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  if (!d) return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton" style={{ width: 180, height: 22 }} />
          <div className="skeleton" style={{ width: 260, height: 14, marginTop: 8 }} />
        </div>
      </div>
      <SkeletonStats />
      <div className="grid2">
        <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>
        <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>
      </div>
    </div>
  );

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{todayStr} · Real-time team task overview. Click any metric to filter tasks.</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => nav('/tasks')}>
            View All Tasks →
          </button>
        </div>
      </div>

      {/* Main KPI Row — ALL CARDS CLICKABLE */}
      <div className="cards4">
        <StatCard
          icon="◷"
          tone="red"
          value={d.counts.overdue}
          label="Overdue"
          hint={d.counts.overdue ? 'Click to view & act' : 'All clear'}
          onClick={() => nav('/tasks?tab=overdue')}
        />
        <StatCard
          icon="◐"
          tone="amber"
          value={d.counts.dueToday}
          label="Due today"
          hint="Click for today's schedule"
          onClick={() => nav('/tasks?tab=today')}
        />
        <StatCard
          icon="▸"
          tone="blue"
          value={d.counts.upcoming}
          label="Upcoming"
          hint="Click for next 7 days"
          onClick={() => nav('/tasks?tab=upcoming')}
        />
        <StatCard
          icon="✓"
          tone="green"
          value={d.counts.completedToday}
          label="Completed today"
          hint="Click to view done tasks"
          onClick={() => nav('/tasks?tab=completed')}
        />
      </div>

      {/* Secondary KPI Row — ALL CARDS CLICKABLE */}
      <div className="cards3" style={{ marginBottom: 18 }}>
        <StatCard
          icon="!"
          tone="red"
          value={d.counts.high}
          label="High / Urgent open"
          hint="Click for priority tasks"
          onClick={() => nav('/tasks?tab=open&priority=HIGH')}
        />
        <StatCard
          icon="◎"
          tone="teal"
          value={d.counts.myOpen}
          label="My open tasks"
          hint="Click for your assignments"
          onClick={() => nav('/my')}
        />
        <StatCard
          icon="☑"
          tone="blue"
          value={d.overdue.length + d.dueToday.length + d.upcoming.length}
          label="Active work pool"
          hint="Click to view all tasks"
          onClick={() => nav('/tasks?tab=open')}
        />
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => nav('/tasks?tab=overdue')}>
            <h3 className="card-title">
              <span className="card-title-icon" style={{ background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid var(--error-border)' }}>!</span>
              Overdue — act first
            </h3>
            <span className="pill red">{d.overdue.length}</span>
          </div>
          {!d.overdue.length ? (
            <div className="empty">
              <div className="empty-icon">✦</div>
              <div className="empty-title">Nothing overdue</div>
              <div className="empty-desc">Great work — no tasks past due. Keep it that way.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Task</th><th>Who</th><th>Pri</th><th>Due</th></tr></thead>
                <tbody>{d.overdue.map(t => <TaskRow key={t.id} t={t} onOpen={onOpen} />)}</tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => nav('/tasks?tab=today')}>
            <h3 className="card-title">
              <span className="card-title-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid var(--warning-border)' }}>◐</span>
              Due today
            </h3>
            <span className="pill amber">{d.dueToday.length}</span>
          </div>
          {!d.dueToday.length ? (
            <div className="empty">
              <div className="empty-icon">◐</div>
              <div className="empty-title">Nothing due today</div>
              <div className="empty-desc">No deadlines today. Use time for upcoming work.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Task</th><th>Who</th><th>Pri</th><th>Due</th></tr></thead>
                <tbody>{d.dueToday.map(t => <TaskRow key={t.id} t={t} onOpen={onOpen} />)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => nav('/tasks?tab=upcoming')}>
          <h3 className="card-title">
            <span className="card-title-icon" style={{ background: 'var(--info-soft)', color: 'var(--info)', border: '1px solid var(--info-border)' }}>▸</span>
            Upcoming deadlines
          </h3>
          <span className="pill blue">{d.upcoming.length}</span>
        </div>
        {!d.upcoming.length ? (
          <div className="empty">
            <div className="empty-icon">▸</div>
            <div className="empty-title">Nothing upcoming</div>
            <div className="empty-desc">No tasks in the next days. Create one with + New Task.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Task</th><th>Who</th><th>Pri</th><th>Due</th></tr></thead>
              <tbody>{d.upcoming.map(t => <TaskRow key={t.id} t={t} onOpen={onOpen} />)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
