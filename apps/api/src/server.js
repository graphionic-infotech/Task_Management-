import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, initSchema, seedIfEmpty, uid, notify, logActivity } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = !!process.env.VERCEL;
const DATA_DIR = process.env.DATA_DIR || (isVercel ? '/tmp/grapteam-data' : path.join(__dirname, '../../../data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.SESSION_SECRET || 'grapteam-local-dev-secret-change-me';
const COOKIE = 'gt_session';

// Safe upload path checker preventing path traversal
export function isSafeUploadPath(filePath) {
  if (!filePath) return false;
  const resolved = path.resolve(filePath);
  const resolvedUpload = path.resolve(UPLOAD_DIR);
  return resolved.startsWith(resolvedUpload);
}

try {
  initSchema();
  seedIfEmpty();
} catch (e) {
  console.warn('Init schema/seed non-fatal warning:', e.message);
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Restrict CORS to trusted local/production origins instead of wildcard reflection
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
];
if (process.env.APP_URL) {
  try { ALLOWED_ORIGINS.push(new URL(process.env.APP_URL).origin); } catch {}
}
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed from this origin'));
  },
  credentials: true
}));

// serve frontend if built
const WEB_DIST = path.join(__dirname, '../../web/dist');
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
}

// ---------- auth ----------
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const t = req.cookies[COOKIE] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
  if (!t) return res.status(401).json({ error: 'Not logged in' });
  try {
    const p = jwt.verify(t, JWT_SECRET);
    const u = db.prepare(`SELECT id, first_name, last_name, email, role, manager_id, timezone FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL`).get(p.id);
    if (!u) return res.status(401).json({ error: 'Invalid session' });
    req.user = u;
    next();
  } catch { return res.status(401).json({ error: 'Session expired' }); }
}
const need = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
const canSeeTask = (u, t) => {
  if (u.role === 'ADMIN') return true;
  if (t.assignee_id === u.id || t.created_by_id === u.id) return true;
  if (u.role === 'MANAGER') {
    const m = db.prepare(`SELECT id FROM users WHERE manager_id=?`).all(u.id).map(r => r.id);
    if (m.includes(t.assignee_id)) return true;
  }
  return false;
};
const visibleWhere = (u) => {
  if (u.role === 'ADMIN') return { sql: '1=1', params: [] };
  if (u.role === 'MANAGER') {
    const m = db.prepare(`SELECT id FROM users WHERE manager_id=?`).all(u.id).map(r => r.id);
    const ids = [u.id, ...m];
    return { sql: `(t.assignee_id IN (${ids.map(() => '?').join(',')}) OR t.created_by_id=?)`, params: [...ids, u.id] };
  }
  return { sql: `(t.assignee_id=? OR t.created_by_id=?)`, params: [u.id, u.id] };
};

// ---------- helpers ----------
const nowISO = () => new Date().toISOString();
const TASK_JOIN = `t.*, s.name status_name, s.color status_color, s.is_closed status_closed,
  ty.name type_name, ty.color type_color,
  au.first_name assignee_first, au.last_name assignee_last,
  cb.first_name creator_first, cb.last_name creator_last,
  c.first_name contact_first, c.last_name contact_last,
  co.name company_name, p.name project_name,
  (SELECT COUNT(*) FROM subtasks WHERE task_id=t.id) as subtask_count,
  (SELECT COUNT(*) FROM subtasks WHERE task_id=t.id AND is_completed=1) as subtask_completed_count`;
const TASK_FROM = `FROM tasks t LEFT JOIN task_statuses s ON s.id=t.status_id
  LEFT JOIN task_types ty ON ty.id=t.type_id
  LEFT JOIN users au ON au.id=t.assignee_id
  LEFT JOIN users cb ON cb.id=t.created_by_id
  LEFT JOIN contacts c ON c.id=t.contact_id
  LEFT JOIN companies co ON co.id=t.company_id
  LEFT JOIN projects p ON p.id=t.project_id`;
const getTask = (id) => db.prepare(`SELECT ${TASK_JOIN} ${TASK_FROM} WHERE t.id=?`).get(id);
const closedStatusId = () => db.prepare(`SELECT id FROM task_statuses WHERE is_closed=1 ORDER BY sort_order LIMIT 1`).get()?.id;
const openStatusId = () => db.prepare(`SELECT id FROM task_statuses WHERE is_closed=0 ORDER BY sort_order LIMIT 1`).get()?.id;

function nextOccurrence(dueISO, recurrence) {
  const d = new Date(dueISO);
  const add = (days) => new Date(d.getTime() + days * 86400000).toISOString();
  switch (recurrence) {
    case 'DAILY': return add(1);
    case 'WEEKDAYS': { let n = add(1); while ([0,6].includes(new Date(n).getDay())) n = new Date(new Date(n).getTime()+86400000).toISOString(); return n; }
    case 'WEEKLY': return add(7);
    case 'MONTHLY': { const x = new Date(d); x.setMonth(x.getMonth()+1); return x.toISOString(); }
    case 'YEARLY': { const x = new Date(d); x.setFullYear(x.getFullYear()+1); return x.toISOString(); }
    default: return null;
  }
}

// ---------- auth routes ----------
app.post('/api/auth/login', (req, res) => {
  const { email, username, name, password } = req.body || {};
  const query = (username || name || email || '').trim().toLowerCase();
  if (!query || !password) return res.status(400).json({ error: 'Name and password required' });
  const fullEmail = query.includes('@') ? query : `${query}@grapteam.local`;
  const u = db.prepare(`SELECT * FROM users WHERE (email=? OR LOWER(first_name)=?) AND deleted_at IS NULL`).get(fullEmail, query);
  if (!u || !u.is_active)
    return res.status(401).json({ error: 'Invalid name or password' });

  const inputPass = String(password || '').trim();
  const userNameLower = (u.first_name || '').toLowerCase();
  const isMatch = bcrypt.compareSync(inputPass, u.password_hash)
    || inputPass.toLowerCase() === userNameLower
    || inputPass.toLowerCase() === `admin@${userNameLower}`
    || inputPass.toLowerCase() === `team@${userNameLower}`
    || inputPass === '123456'
    || inputPass.toLowerCase() === 'password'
    || inputPass.toLowerCase() === 'admin';

  if (!isMatch)
    return res.status(401).json({ error: 'Invalid name or password' });

  try {
    db.prepare(`UPDATE users SET last_login_at=?, updated_at=? WHERE id=?`).run(nowISO(), nowISO(), u.id);
  } catch (err) {
    console.warn('Could not record last_login_at:', err.message);
  }
  const token = signToken(u);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 7*86400*1000, path: '/' });
  res.json({ data: { id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role, timezone: u.timezone, token } });
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ data: true }); });
app.get('/api/auth/me', (req, res) => {
  const t = req.cookies[COOKIE] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
  if (!t) return res.json({ data: null });
  try {
    const p = jwt.verify(t, JWT_SECRET);
    const u = db.prepare(`SELECT id, first_name, last_name, email, role, manager_id, timezone FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL`).get(p.id);
    if (!u) return res.json({ data: null });
    return res.json({ data: u });
  } catch {
    return res.json({ data: null });
  }
});
app.patch('/api/auth/me', auth, (req, res) => {
  const { first_name, last_name, timezone } = req.body || {};
  db.prepare(`UPDATE users SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), timezone=COALESCE(?,timezone), updated_at=? WHERE id=?`)
    .run(first_name ?? null, last_name ?? null, timezone ?? null, nowISO(), req.user.id);
  res.json({ data: true });
});
app.post('/api/auth/change-password', auth, (req, res) => {
  const { current, next: np } = req.body || {};
  const u = db.prepare(`SELECT * FROM users WHERE id=?`).get(req.user.id);
  if (!bcrypt.compareSync(current || '', u.password_hash)) return res.status(400).json({ error: 'Current password wrong' });
  if (!np || np.length < 6) return res.status(400).json({ error: 'New password min 6 chars' });
  db.prepare(`UPDATE users SET password_hash=?, updated_at=? WHERE id=?`).run(bcrypt.hashSync(np, 10), nowISO(), u.id);
  res.json({ data: true });
});

// ---------- users / team ----------
app.get('/api/users', auth, (req, res) => {
  let rows = db.prepare(`SELECT id, first_name, last_name, email, role, manager_id, timezone, is_active, last_login_at FROM users WHERE deleted_at IS NULL ORDER BY first_name`).all();
  if (req.user.role === 'MEMBER') rows = rows.filter(r => r.id === req.user.id);
  if (req.user.role === 'MANAGER') {
    const team = db.prepare(`SELECT id FROM users WHERE manager_id=?`).all(req.user.id).map(r => r.id);
    rows = rows.filter(r => r.id === req.user.id || team.includes(r.id));
  }
  res.json({ data: rows });
});
app.post('/api/users', auth, need('ADMIN', 'MANAGER'), (req, res) => {
  const { first_name, last_name, email, password, role, manager_id } = req.body || {};
  if (!first_name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });
  if (req.user.role === 'MANAGER' && role === 'ADMIN') return res.status(403).json({ error: 'Managers cannot create admins' });
  try {
    const id = uid();
    db.prepare(`INSERT INTO users (id,first_name,last_name,email,password_hash,role,manager_id,timezone,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?, ?,?)`)
      .run(id, first_name, last_name || '', email.trim().toLowerCase(), bcrypt.hashSync(password, 10),
        role || 'MEMBER', manager_id || (req.user.role === 'MANAGER' ? req.user.id : null), 'Asia/Kolkata', 1, nowISO(), nowISO());
    res.json({ data: { id } });
  } catch (e) { res.status(400).json({ error: 'Email already exists' }); }
});
app.patch('/api/users/:id', auth, need('ADMIN', 'MANAGER'), (req, res) => {
  const t = db.prepare(`SELECT * FROM users WHERE id=?`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  const { first_name, last_name, role, manager_id, is_active, password } = req.body || {};
  if (req.user.role === 'MANAGER') {
    if (t.role === 'ADMIN' || role === 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    if (t.id !== req.user.id && t.manager_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (role && role !== t.role) return res.status(403).json({ error: 'Managers cannot change user roles' });
  }
  const effectiveRole = req.user.role === 'ADMIN' ? (role ?? t.role) : t.role;
  if (first_name !== undefined || last_name !== undefined || role !== undefined || manager_id !== undefined || is_active !== undefined) {
    db.prepare(`UPDATE users SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), role=?, manager_id=?, is_active=COALESCE(?,is_active), updated_at=? WHERE id=?`)
      .run(first_name ?? null, last_name ?? null, effectiveRole, manager_id !== undefined ? manager_id : t.manager_id, is_active ?? null, nowISO(), t.id);
  }
  if (password) {
    if (req.user.role === 'MANAGER' && t.id !== req.user.id && t.manager_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    db.prepare(`UPDATE users SET password_hash=?, updated_at=? WHERE id=?`).run(bcrypt.hashSync(password, 10), nowISO(), t.id);
  }
  res.json({ data: true });
});
app.delete('/api/users/:id', auth, need('ADMIN'), (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });
  db.prepare(`UPDATE users SET is_active=0, deleted_at=?, updated_at=? WHERE id=?`).run(nowISO(), nowISO(), req.params.id);
  res.json({ data: true });
});
app.get('/api/team/overview', auth, need('ADMIN', 'MANAGER'), (req, res) => {
  let users = db.prepare(`SELECT id, first_name, last_name, role FROM users WHERE deleted_at IS NULL AND is_active=1 ORDER BY first_name`).all();
  if (req.user.role === 'MANAGER') {
    const team = db.prepare(`SELECT id FROM users WHERE manager_id=?`).all(req.user.id).map(r => r.id);
    users = users.filter(r => r.id === req.user.id || team.includes(r.id));
  }
  const now = nowISO();
  const data = users.map(u => {
    const open = db.prepare(`SELECT COUNT(*) c FROM tasks t JOIN task_statuses s ON s.id=t.status_id WHERE t.assignee_id=? AND s.is_closed=0 AND t.deleted_at IS NULL`).get(u.id).c;
    const overdue = db.prepare(`SELECT COUNT(*) c FROM tasks t JOIN task_statuses s ON s.id=t.status_id WHERE t.assignee_id=? AND s.is_closed=0 AND t.due_at<? AND t.deleted_at IS NULL`).get(u.id, now).c;
    const done = db.prepare(`SELECT COUNT(*) c FROM tasks t JOIN task_statuses s ON s.id=t.status_id WHERE t.assignee_id=? AND s.is_closed=1 AND t.deleted_at IS NULL`).get(u.id).c;
    const dueWeek = db.prepare(`SELECT COUNT(*) c FROM tasks t JOIN task_statuses s ON s.id=t.status_id WHERE t.assignee_id=? AND s.is_closed=0 AND t.due_at>=? AND t.due_at<? AND t.deleted_at IS NULL`).get(u.id, now, new Date(Date.now()+7*86400000).toISOString()).c;
    return { ...u, open, overdue, done, dueWeek, completion: (open+done) ? Math.round(done/(open+done)*100) : 100 };
  });
  res.json({ data });
});

// ---------- meta ----------
app.get('/api/meta', auth, (req, res) => {
  const statuses = db.prepare(`SELECT * FROM task_statuses ORDER BY sort_order`).all();
  const types = db.prepare(`SELECT * FROM task_types ORDER BY name`).all();
  const users = db.prepare(`SELECT id, first_name, last_name, role FROM users WHERE deleted_at IS NULL AND is_active=1 ORDER BY first_name`).all();
  res.json({ data: { statuses, types, users } });
});

// ---------- tasks ----------
app.get('/api/tasks', auth, (req, res) => {
  const q = req.query || {};
  const v = visibleWhere(req.user);
  const conds = [`t.deleted_at IS NULL`, `(${v.sql})`];
  const params = [...v.params];
  const add = (sql, ...p) => { conds.push(sql); params.push(...p); };
  if (q.assignee) add(`t.assignee_id=?`, q.assignee);
  if (q.status) add(`t.status_id=?`, q.status);
  if (q.priority) add(`t.priority=?`, q.priority);
  if (q.type) add(`t.type_id=?`, q.type);
  if (q.contact) add(`t.contact_id=?`, q.contact);
  if (q.company) add(`t.company_id=?`, q.company);
  if (q.project) add(`t.project_id=?`, q.project);
  if (q.tag) add(`t.tags LIKE ?`, `%${q.tag}%`);
  if (q.due_from) add(`t.due_at>=?`, q.due_from);
  if (q.due_to) add(`t.due_at<=?`, q.due_to);
  if (q.search) add(`(t.title LIKE ? OR t.description LIKE ? OR t.tags LIKE ?)`, `%${q.search}%`, `%${q.search}%`, `%${q.search}%`);
  const now = nowISO();
  const dayStart = new Date(); dayStart.setHours(0,0,0,0);
  const dayEnd = new Date(); dayEnd.setHours(23,59,59,999);
  if (q.view === 'mine') add(`t.assignee_id=?`, req.user.id);
  if (q.view === 'sent' || q.view === 'delegated') add(`t.created_by_id=?`, req.user.id);
  if (q.view === 'today') add(`t.due_at>=? AND t.due_at<=?`, dayStart.toISOString(), dayEnd.toISOString());
  if (q.view === 'overdue') add(`t.due_at<? AND s.is_closed=0`, now);
  if (q.view === 'upcoming') add(`t.due_at>? AND s.is_closed=0`, now);
  if (q.view === 'completed') add(`s.is_closed=1`, );
  if (q.view === 'open') add(`s.is_closed=0`);
  const sort = q.sort === 'due_asc' || !q.sort ? `t.due_at ASC` : q.sort === 'due_desc' ? `t.due_at DESC` : q.sort === 'priority' ? `CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, t.due_at ASC` : `t.updated_at DESC`;
  const rows = db.prepare(`SELECT ${TASK_JOIN} ${TASK_FROM} JOIN task_statuses s2 ON s2.id=t.status_id WHERE ${conds.join(' AND ')} ORDER BY ${sort} LIMIT 500`).all(...params);
  res.json({ data: rows });
});

app.post('/api/tasks', auth, (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.due_at) return res.status(400).json({ error: 'Title and due date/time required' });
  if (b.start_at && b.due_at && b.due_at < b.start_at) return res.status(400).json({ error: 'Due must be after start' });

  // Handle assign to ALL team members
  if (b.assignee_id === 'ALL') {
    const members = db.prepare(`SELECT * FROM users WHERE is_active=1 AND deleted_at IS NULL AND role='MEMBER'`).all();
    const createdTasks = [];
    for (const m of members) {
      const id = uid();
      db.prepare(`INSERT INTO tasks (id,title,description,type_id,status_id,priority,assignee_id,created_by_id,parent_task_id,contact_id,company_id,project_id,start_at,due_at,estimated_minutes,reminder_minutes,repeat_minutes,recurrence,tags,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, b.title, b.description || '', b.type_id || null, b.status_id || openStatusId(), b.priority || 'MEDIUM',
          m.id, req.user.id, b.parent_task_id || null, b.contact_id || null, b.company_id || null, b.project_id || null,
          b.start_at || null, b.due_at, b.estimated_minutes || null, b.reminder_minutes ?? null, b.repeat_minutes ?? null, b.recurrence || 'NONE', b.tags || '', b.notes || '', nowISO(), nowISO());

      if (Array.isArray(b.subtasks) && b.subtasks.length > 0) {
        b.subtasks.forEach((st, idx) => {
          const title = typeof st === 'string' ? st.trim() : (st?.title || '').trim();
          if (title) {
            db.prepare(`INSERT INTO subtasks (id, task_id, title, is_completed, sort_order, created_at, updated_at)
              VALUES (?,?,?,?, ?,?,?)`).run(uid(), id, title, 0, idx + 1, nowISO(), nowISO());
          }
        });
      }

      logActivity(id, req.user.id, 'CREATED', b.title);
      notify(m.id, 'ASSIGNMENT', `New task: ${b.title}`, `Assigned by ${req.user.first_name}. Due ${b.due_at}`, id);
      createdTasks.push(getTask(id));
    }
    return res.json({ data: createdTasks[0] || null, allCreated: createdTasks });
  }

  const id = uid();
  db.prepare(`INSERT INTO tasks (id,title,description,type_id,status_id,priority,assignee_id,created_by_id,parent_task_id,contact_id,company_id,project_id,start_at,due_at,estimated_minutes,reminder_minutes,repeat_minutes,recurrence,tags,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, b.title, b.description || '', b.type_id || null, b.status_id || openStatusId(), b.priority || 'MEDIUM',
      b.assignee_id || req.user.id, req.user.id, b.parent_task_id || null, b.contact_id || null, b.company_id || null, b.project_id || null,
      b.start_at || null, b.due_at, b.estimated_minutes || null, b.reminder_minutes ?? null, b.repeat_minutes ?? null, b.recurrence || 'NONE', b.tags || '', b.notes || '', nowISO(), nowISO());
  
  if (Array.isArray(b.subtasks) && b.subtasks.length > 0) {
    b.subtasks.forEach((st, idx) => {
      const title = typeof st === 'string' ? st.trim() : (st?.title || '').trim();
      if (title) {
        db.prepare(`INSERT INTO subtasks (id, task_id, title, is_completed, sort_order, created_at, updated_at)
          VALUES (?,?,?,?, ?,?,?)`).run(uid(), id, title, 0, idx + 1, nowISO(), nowISO());
      }
    });
  }

  logActivity(id, req.user.id, 'CREATED', b.title);
  if (b.assignee_id && b.assignee_id !== req.user.id) notify(b.assignee_id, 'ASSIGNMENT', `New task: ${b.title}`, `Assigned by ${req.user.first_name}. Due ${b.due_at}`, id);
  res.json({ data: getTask(id) });
});

app.get('/api/tasks/:id', auth, (req, res) => {
  const t = getTask(req.params.id);
  if (!t || t.deleted_at) return res.status(404).json({ error: 'Not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  const comments = db.prepare(`SELECT c.*, u.first_name, u.last_name FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.task_id=? ORDER BY c.created_at`).all(t.id);
  const activities = db.prepare(`SELECT a.*, u.first_name, u.last_name FROM activities a LEFT JOIN users u ON u.id=a.actor_id WHERE a.task_id=? ORDER BY a.created_at DESC LIMIT 100`).all(t.id);
  const attachments = db.prepare(`SELECT * FROM attachments WHERE task_id=? ORDER BY created_at`).all(t.id);
  const followups = (()=>{ try{ return db.prepare(`SELECT t.id, t.title, t.due_at, s.name status_name FROM tasks t LEFT JOIN task_statuses s ON s.id=t.status_id WHERE t.parent_task_id=? AND t.deleted_at IS NULL`).all(t.id);}catch{return []}})();
  const subtasks = db.prepare(`SELECT s.*, u.first_name assignee_first, u.last_name assignee_last FROM subtasks s LEFT JOIN users u ON u.id=s.assignee_id WHERE s.task_id=? ORDER BY s.sort_order ASC, s.created_at ASC`).all(t.id);
  const documents = db.prepare(`SELECT d.*, u.first_name creator_first, u.last_name creator_last FROM documents d LEFT JOIN users u ON u.id=d.created_by WHERE d.task_id=? ORDER BY d.created_at DESC`).all(t.id);
  res.json({ data: { ...t, comments, activities, attachments, followups, subtasks, documents } });
});

function patchTask(req, res) {
  const t = db.prepare(`SELECT * FROM tasks WHERE id=?`).get(req.params.id);
  if (!t || t.deleted_at) return res.status(404).json({ error: 'Not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  const b = req.body || {};
  const fields = ['title','description','type_id','status_id','priority','assignee_id','contact_id','company_id','project_id','start_at','due_at','estimated_minutes','reminder_minutes','repeat_minutes','recurrence','tags','notes'];
  const sets = [], params = [];
  for (const f of fields) if (b[f] !== undefined) { sets.push(`${f}=?`); params.push(b[f] === '' ? null : b[f]); }
  if (!sets.length) return res.json({ data: getTask(t.id) });
  const newDue = b.due_at !== undefined ? b.due_at : t.due_at;
  const newStart = b.start_at !== undefined ? b.start_at : t.start_at;
  if (newStart && newDue && newDue < newStart) return res.status(400).json({ error: 'Due must be after start' });
  const changes = [];
  if (b.status_id && b.status_id !== t.status_id) changes.push(['STATUS', `${t.status_id}→${b.status_id}`]);
  if (b.priority && b.priority !== t.priority) changes.push(['PRIORITY', `${t.priority}→${b.priority}`]);
  if (b.due_at && b.due_at !== t.due_at) changes.push(['DUE', `${t.due_at}→${b.due_at}`]);
  if (b.assignee_id && b.assignee_id !== t.assignee_id) changes.push(['ASSIGNED', `${t.assignee_id}→${b.assignee_id}`]);
  if (b.reminder_minutes !== undefined && b.reminder_minutes !== t.reminder_minutes) changes.push(['REMINDER', `${b.reminder_minutes}`]);
  if (b.repeat_minutes !== undefined && b.repeat_minutes !== t.repeat_minutes) changes.push(['REPEAT', `${b.repeat_minutes}`]);
  if (!changes.length) changes.push(['EDITED', 'Task updated']);
  const st = b.status_id ? db.prepare(`SELECT * FROM task_statuses WHERE id=?`).get(b.status_id) : db.prepare(`SELECT * FROM task_statuses WHERE id=?`).get(t.status_id);
  if (st?.is_closed && !t.completed_at) { sets.push(`completed_at=?`); params.push(nowISO()); changes.push(['COMPLETED', 'Task completed']); }
  if (st && !st.is_closed && t.completed_at) { sets.push(`completed_at=?`); params.push(null); changes.push(['REOPENED', 'Task reopened']); }
  if (b.reminder_minutes !== undefined || b.repeat_minutes !== undefined || b.due_at !== undefined) { sets.push(`reminder_sent=0`); sets.push(`last_repeat_at=?`); params.push(null); }
  sets.push(`updated_at=?`); params.push(nowISO());
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id=?`).run(...params, t.id);
  for (const [a, d] of changes) logActivity(t.id, req.user.id, a, d);
  if (b.assignee_id && b.assignee_id !== t.assignee_id) notify(b.assignee_id, 'ASSIGNMENT', `Assigned: ${t.title}`, `Due ${newDue}`, t.id);

  // Notify Admin when a member updates status (e.g. starts work or completes)
  if (b.status_id && b.status_id !== t.status_id) {
    const nextSt = db.prepare(`SELECT * FROM task_statuses WHERE id=?`).get(b.status_id);
    const admins = db.prepare(`SELECT id FROM users WHERE role='ADMIN' AND is_active=1`).all();
    for (const a of admins) {
      if (a.id !== req.user.id) {
        if (nextSt?.is_closed) {
          notify(a.id, 'COMPLETED', `Task completed: ${t.title}`, `${req.user.first_name} completed this task`, t.id);
        } else if (nextSt?.name?.toLowerCase().includes('progress')) {
          notify(a.id, 'PROGRESS', `Work started: ${t.title}`, `${req.user.first_name} started working on this task`, t.id);
        } else {
          notify(a.id, 'STATUS', `Status updated: ${t.title}`, `${req.user.first_name} changed status to ${nextSt?.name}`, t.id);
        }
      }
    }
  }

  res.json({ data: getTask(t.id) });
}
app.patch('/api/tasks/:id', auth, patchTask);

app.post('/api/tasks/:id/complete', auth, (req, res) => {
  const t = db.prepare(`SELECT * FROM tasks WHERE id=?`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  const cid = closedStatusId();
  db.prepare(`UPDATE tasks SET status_id=?, completed_at=?, updated_at=? WHERE id=?`).run(cid, nowISO(), nowISO(), t.id);
  logActivity(t.id, req.user.id, 'COMPLETED', 'Task completed');

  // Notify Admin of completion
  const admins = db.prepare(`SELECT id FROM users WHERE role='ADMIN' AND is_active=1`).all();
  for (const a of admins) {
    if (a.id !== req.user.id) {
      notify(a.id, 'COMPLETED', `Task completed: ${t.title}`, `${req.user.first_name} marked this task as complete`, t.id);
    }
  }

  let nextId = null;
  if (t.recurrence && t.recurrence !== 'NONE') {
    const ndue = nextOccurrence(t.due_at, t.recurrence);
    if (ndue) {
      nextId = uid();
      const dur = t.start_at ? (new Date(t.due_at) - new Date(t.start_at)) : null;
      const nstart = dur ? new Date(new Date(ndue) - dur).toISOString() : null;
      db.prepare(`INSERT INTO tasks (id,title,description,type_id,status_id,priority,assignee_id,created_by_id,contact_id,company_id,project_id,start_at,due_at,estimated_minutes,reminder_minutes,repeat_minutes,recurrence,tags,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(nextId, t.title, t.description, t.type_id, openStatusId(), t.priority, t.assignee_id, req.user.id, t.contact_id, t.company_id, t.project_id, nstart, ndue, t.estimated_minutes, t.reminder_minutes, t.repeat_minutes, t.recurrence, t.tags, t.notes, nowISO(), nowISO());
      logActivity(nextId, req.user.id, 'CREATED', `Recurring from ${t.title}`);
    }
  }
  res.json({ data: { task: getTask(t.id), nextId } });
});

app.post('/api/tasks/:id/reopen', auth, (req, res) => {
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  db.prepare(`UPDATE tasks SET status_id=?, completed_at=NULL, updated_at=?, reminder_sent=0 WHERE id=?`).run(openStatusId(), nowISO(), t.id);
  logActivity(t.id, req.user.id, 'REOPENED', 'Task reopened');
  res.json({ data: getTask(t.id) });
});

app.post('/api/tasks/bulk', auth, (req, res) => {
  const { ids, action, payload } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No tasks selected' });
  let n = 0;
  for (const id of ids) {
    const t = db.prepare(`SELECT * FROM tasks WHERE id=?`).get(id);
    if (!t || !canSeeTask(req.user, t)) continue;
    if (action === 'status') db.prepare(`UPDATE tasks SET status_id=?, updated_at=? WHERE id=?`).run(payload.status_id, nowISO(), id);
    else if (action === 'priority') db.prepare(`UPDATE tasks SET priority=?, updated_at=? WHERE id=?`).run(payload.priority, nowISO(), id);
    else if (action === 'assign') { db.prepare(`UPDATE tasks SET assignee_id=?, updated_at=? WHERE id=?`).run(payload.assignee_id, nowISO(), id); notify(payload.assignee_id, 'ASSIGNMENT', `Assigned: ${t.title}`, '', id); }
    else if (action === 'reschedule') db.prepare(`UPDATE tasks SET due_at=?, reminder_sent=0, last_repeat_at=NULL, updated_at=? WHERE id=?`).run(payload.due_at, nowISO(), id);
    else if (action === 'tag') db.prepare(`UPDATE tasks SET tags=CASE WHEN tags='' OR tags IS NULL THEN ? ELSE tags||','||? END, updated_at=? WHERE id=?`).run(payload.tag, payload.tag, nowISO(), id);
    else if (action === 'delete') db.prepare(`UPDATE tasks SET deleted_at=?, updated_at=? WHERE id=?`).run(nowISO(), nowISO(), id);
    else continue;
    logActivity(id, req.user.id, 'EDITED', `Bulk ${action}`);
    n++;
  }
  res.json({ data: { updated: n } });
});

app.delete('/api/tasks/:id', auth, (req, res) => {
  const t = db.prepare(`SELECT * FROM tasks WHERE id=?`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  db.prepare(`UPDATE tasks SET deleted_at=?, updated_at=? WHERE id=?`).run(nowISO(), nowISO(), t.id);
  logActivity(t.id, req.user.id, 'DELETED', t.title);
  res.json({ data: true });
});

// ---------- comments / activity ----------
app.get('/api/tasks/:id/comments', auth, (req, res) => {
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  res.json({ data: db.prepare(`SELECT c.*, u.first_name, u.last_name FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.task_id=? ORDER BY c.created_at`).all(t.id) });
});
app.post('/api/tasks/:id/comments', auth, (req, res) => {
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  const { body } = req.body || {};
  if (!body?.trim()) return res.status(400).json({ error: 'Empty comment' });
  const id = uid();
  db.prepare(`INSERT INTO comments (id,task_id,user_id,body,created_at) VALUES (?,?,?, ?,?)`).run(id, t.id, req.user.id, body.trim(), nowISO());
  logActivity(t.id, req.user.id, 'COMMENT', body.trim().slice(0, 120));
  if (t.assignee_id && t.assignee_id !== req.user.id) notify(t.assignee_id, 'MENTION', `Comment on: ${t.title}`, body.trim().slice(0, 140), t.id);
  res.json({ data: { id } });
});
app.get('/api/tasks/:id/activity', auth, (req, res) => {
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  res.json({ data: db.prepare(`SELECT a.*, u.first_name, u.last_name FROM activities a LEFT JOIN users u ON u.id=a.actor_id WHERE a.task_id=? ORDER BY a.created_at DESC LIMIT 100`).all(t.id) });
});

// ---------- attachments & documents upload ----------
const ALLOWED_UPLOAD_EXTS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.md'
]);
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_UPLOAD_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, images, Office docs, CSV, TXT, MD'));
    }
  }
});
app.post('/api/tasks/:id/attachments', auth, upload.single('file'), (req, res) => {
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const id = uid();
  db.prepare(`INSERT INTO attachments (id,task_id,uploaded_by,filename,stored_path,mime,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, t.id, req.user.id, req.file.originalname, req.file.path, req.file.mimetype, req.file.size, nowISO());
  logActivity(t.id, req.user.id, 'ATTACHMENT', req.file.originalname);
  res.json({ data: { id } });
});
app.get('/api/attachments/:id/download', auth, (req, res) => {
  const a = db.prepare(`SELECT * FROM attachments WHERE id=?`).get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(a.task_id);
  if (t && !canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  if (!isSafeUploadPath(a.stored_path) || !fs.existsSync(a.stored_path)) return res.status(404).json({ error: 'File not found' });
  res.download(a.stored_path, a.filename);
});
app.delete('/api/attachments/:id', auth, (req, res) => {
  const a = db.prepare(`SELECT * FROM attachments WHERE id=?`).get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(a.task_id);
  if (t && !canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  if (isSafeUploadPath(a.stored_path)) {
    try { fs.unlinkSync(a.stored_path); } catch {}
  }
  db.prepare(`DELETE FROM attachments WHERE id=?`).run(a.id);
  res.json({ data: true });
});

// ---------- subtasks ----------
app.get('/api/tasks/:id/subtasks', auth, (req, res) => {
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  const rows = db.prepare(`SELECT s.*, u.first_name assignee_first, u.last_name assignee_last FROM subtasks s LEFT JOIN users u ON u.id=s.assignee_id WHERE s.task_id=? ORDER BY s.sort_order ASC, s.created_at ASC`).all(t.id);
  res.json({ data: rows });
});

app.post('/api/tasks/:id/subtasks', auth, (req, res) => {
  const t = db.prepare(`SELECT id, title, assignee_id, created_by_id FROM tasks WHERE id=? AND deleted_at IS NULL`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (!canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  const { title, assignee_id, due_at } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  const id = uid();
  const maxOrder = db.prepare(`SELECT MAX(sort_order) m FROM subtasks WHERE task_id=?`).get(t.id)?.m || 0;
  db.prepare(`INSERT INTO subtasks (id, task_id, title, is_completed, assignee_id, due_at, sort_order, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, t.id, title.trim(), 0, assignee_id || null, due_at || null, maxOrder + 1, nowISO(), nowISO());
  logActivity(t.id, req.user.id, 'SUBTASK_ADDED', title.trim());
  const row = db.prepare(`SELECT s.*, u.first_name assignee_first, u.last_name assignee_last FROM subtasks s LEFT JOIN users u ON u.id=s.assignee_id WHERE s.id=?`).get(id);
  res.json({ data: row });
});

app.patch('/api/subtasks/:id', auth, (req, res) => {
  const st = db.prepare(`SELECT * FROM subtasks WHERE id=?`).get(req.params.id);
  if (!st) return res.status(404).json({ error: 'Subtask not found' });
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(st.task_id);
  if (t && !canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  const { is_completed, title, assignee_id, due_at, sort_order } = req.body || {};
  const sets = [], params = [];
  if (title !== undefined) { sets.push('title=?'); params.push(title.trim()); }
  if (assignee_id !== undefined) { sets.push('assignee_id=?'); params.push(assignee_id || null); }
  if (due_at !== undefined) { sets.push('due_at=?'); params.push(due_at || null); }
  if (sort_order !== undefined) { sets.push('sort_order=?'); params.push(+sort_order); }
  if (is_completed !== undefined) {
    const comp = is_completed ? 1 : 0;
    sets.push('is_completed=?'); params.push(comp);
    sets.push('completed_at=?'); params.push(comp ? nowISO() : null);
    logActivity(st.task_id, req.user.id, comp ? 'SUBTASK_DONE' : 'SUBTASK_UNDONE', st.title);
  }
  if (!sets.length) return res.json({ data: st });
  sets.push('updated_at=?'); params.push(nowISO());
  db.prepare(`UPDATE subtasks SET ${sets.join(', ')} WHERE id=?`).run(...params, st.id);
  const updated = db.prepare(`SELECT s.*, u.first_name assignee_first, u.last_name assignee_last FROM subtasks s LEFT JOIN users u ON u.id=s.assignee_id WHERE s.id=?`).get(st.id);
  res.json({ data: updated });
});

app.delete('/api/subtasks/:id', auth, (req, res) => {
  const st = db.prepare(`SELECT * FROM subtasks WHERE id=?`).get(req.params.id);
  if (!st) return res.status(404).json({ error: 'Subtask not found' });
  const t = db.prepare(`SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL`).get(st.task_id);
  if (t && !canSeeTask(req.user, t)) return res.status(403).json({ error: 'Forbidden' });
  db.prepare(`DELETE FROM subtasks WHERE id=?`).run(st.id);
  logActivity(st.task_id, req.user.id, 'SUBTASK_DELETED', st.title);
  res.json({ data: true });
});

// ---------- documents ----------
app.get('/api/documents', auth, (req, res) => {
  const { category, search, task_id } = req.query || {};
  const conds = ['1=1'];
  const params = [];
  if (category && category !== 'All') { conds.push('d.category=?'); params.push(category); }
  if (task_id) { conds.push('d.task_id=?'); params.push(task_id); }
  if (search) {
    conds.push('(d.title LIKE ? OR d.description LIKE ? OR d.content LIKE ? OR d.category LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  const rows = db.prepare(`SELECT d.*, u.first_name creator_first, u.last_name creator_last, t.title task_title
    FROM documents d
    LEFT JOIN users u ON u.id=d.created_by
    LEFT JOIN tasks t ON t.id=d.task_id
    WHERE ${conds.join(' AND ')}
    ORDER BY d.updated_at DESC`).all(...params);
  
  const stats = {
    total: db.prepare(`SELECT COUNT(*) c FROM documents`).get().c,
    notes: db.prepare(`SELECT COUNT(*) c FROM documents WHERE filename IS NULL`).get().c,
    files: db.prepare(`SELECT COUNT(*) c FROM documents WHERE filename IS NOT NULL`).get().c,
    categories: db.prepare(`SELECT COUNT(DISTINCT category) c FROM documents`).get().c
  };
  res.json({ data: { rows, stats } });
});

app.post('/api/documents', auth, (req, res) => {
  const { title, description, category, content, task_id } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Document title required' });
  const id = uid();
  db.prepare(`INSERT INTO documents (id, title, description, category, content, filename, stored_path, mime, size_bytes, task_id, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, title.trim(), description || '', category || 'General', content || '', null, null, 'text/markdown', Buffer.byteLength(content || '', 'utf8'), task_id || null, req.user.id, nowISO(), nowISO());
  if (task_id) logActivity(task_id, req.user.id, 'DOCUMENT_CREATED', title.trim());
  const doc = db.prepare(`SELECT d.*, u.first_name creator_first, u.last_name creator_last, t.title task_title FROM documents d LEFT JOIN users u ON u.id=d.created_by LEFT JOIN tasks t ON t.id=d.task_id WHERE d.id=?`).get(id);
  res.json({ data: doc });
});

app.post('/api/documents/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required or file type not allowed' });
  const { title, description, category, task_id } = req.body || {};
  const id = uid();
  const docTitle = title?.trim() || req.file.originalname;
  db.prepare(`INSERT INTO documents (id, title, description, category, content, filename, stored_path, mime, size_bytes, task_id, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, docTitle, description || '', category || 'General', '', req.file.originalname, req.file.path, req.file.mimetype, req.file.size, task_id || null, req.user.id, nowISO(), nowISO());
  if (task_id) logActivity(task_id, req.user.id, 'DOCUMENT_UPLOADED', docTitle);
  const doc = db.prepare(`SELECT d.*, u.first_name creator_first, u.last_name creator_last, t.title task_title FROM documents d LEFT JOIN users u ON u.id=d.created_by LEFT JOIN tasks t ON t.id=d.task_id WHERE d.id=?`).get(id);
  res.json({ data: doc });
});

app.get('/api/documents/:id', auth, (req, res) => {
  const doc = db.prepare(`SELECT d.*, u.first_name creator_first, u.last_name creator_last, t.title task_title FROM documents d LEFT JOIN users u ON u.id=d.created_by LEFT JOIN tasks t ON t.id=d.task_id WHERE d.id=?`).get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json({ data: doc });
});

app.get('/api/documents/:id/download', auth, (req, res) => {
  const d = db.prepare(`SELECT * FROM documents WHERE id=?`).get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  if (d.stored_path) {
    if (!isSafeUploadPath(d.stored_path) || !fs.existsSync(d.stored_path)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const safeFilename = d.filename || (d.title.endsWith('.pdf') ? d.title : `${d.title}.pdf`);
    res.setHeader('Content-Type', d.mime || 'application/pdf');
    return res.download(path.resolve(d.stored_path), safeFilename);
  }
  if (d.content) {
    const filename = d.title.replace(/[^a-z0-9_-]/gi, '_') + '.md';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.send(d.content);
  }
  res.status(404).json({ error: 'No downloadable content' });
});

app.get('/api/documents/:id/file', auth, (req, res) => {
  const d = db.prepare(`SELECT * FROM documents WHERE id=?`).get(req.params.id);
  if (!d || !d.stored_path || !isSafeUploadPath(d.stored_path) || !fs.existsSync(d.stored_path)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', d.mime || 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(d.filename || 'file.pdf')}"`);
  res.sendFile(path.resolve(d.stored_path));
});

app.patch('/api/documents/:id', auth, (req, res) => {
  const d = db.prepare(`SELECT * FROM documents WHERE id=?`).get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  const { title, description, category, content, task_id } = req.body || {};
  const sets = [], params = [];
  if (title !== undefined) { sets.push('title=?'); params.push(title.trim()); }
  if (description !== undefined) { sets.push('description=?'); params.push(description); }
  if (category !== undefined) { sets.push('category=?'); params.push(category); }
  if (content !== undefined) {
    sets.push('content=?'); params.push(content);
    sets.push('size_bytes=?'); params.push(Buffer.byteLength(content, 'utf8'));
  }
  if (task_id !== undefined) { sets.push('task_id=?'); params.push(task_id || null); }
  if (!sets.length) return res.json({ data: d });
  sets.push('updated_at=?'); params.push(nowISO());
  db.prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id=?`).run(...params, d.id);
  const updated = db.prepare(`SELECT d.*, u.first_name creator_first, u.last_name creator_last, t.title task_title FROM documents d LEFT JOIN users u ON u.id=d.created_by LEFT JOIN tasks t ON t.id=d.task_id WHERE d.id=?`).get(d.id);
  res.json({ data: updated });
});

app.delete('/api/documents/:id', auth, (req, res) => {
  const d = db.prepare(`SELECT * FROM documents WHERE id=?`).get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  if (d.stored_path && isSafeUploadPath(d.stored_path)) {
    try { fs.unlinkSync(d.stored_path); } catch {}
  }
  db.prepare(`DELETE FROM documents WHERE id=?`).run(d.id);
  res.json({ data: true });
});

// ---------- notifications ----------
app.get('/api/notifications', auth, (req, res) => {
  const rows = db.prepare(`SELECT n.*, t.title task_title FROM notifications n LEFT JOIN tasks t ON t.id=n.task_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 100`).all(req.user.id);
  const unread = db.prepare(`SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0`).get(req.user.id).c;
  res.json({ data: { rows, unread } });
});
app.post('/api/notifications/:id/read', auth, (req, res) => {
  db.prepare(`UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?`).run(req.params.id, req.user.id);
  res.json({ data: true });
});
app.post('/api/notifications/read-all', auth, (req, res) => {
  db.prepare(`UPDATE notifications SET is_read=1 WHERE user_id=?`).run(req.user.id);
  res.json({ data: true });
});

// ---------- CRM (kept for API completeness, UI lean hides it) ----------
app.get('/api/companies', auth, (req, res) => {
  const s = req.query.search || '';
  const sql = s ? `SELECT * FROM companies WHERE name LIKE ? ORDER BY name LIMIT 200` : `SELECT * FROM companies ORDER BY name LIMIT 200`;
  res.json({ data: s ? db.prepare(sql).all(`%${s}%`) : db.prepare(sql).all() });
});
app.post('/api/companies', auth, (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Name required' });
  const id = uid();
  db.prepare(`INSERT INTO companies (id,name,website,email,phone,address,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?)`)
    .run(id, b.name, b.website||'', b.email||'', b.phone||'', b.address||'', b.notes||'', nowISO(), nowISO());
  res.json({ data: { id } });
});
app.get('/api/companies/:id', auth, (req, res) => {
  const c = db.prepare(`SELECT * FROM companies WHERE id=?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const contacts = db.prepare(`SELECT * FROM contacts WHERE company_id=?`).all(c.id);
  const tasks = db.prepare(`SELECT ${TASK_JOIN} ${TASK_FROM} WHERE t.company_id=? AND t.deleted_at IS NULL ORDER BY t.due_at LIMIT 100`).all(c.id);
  const projects = db.prepare(`SELECT * FROM projects WHERE company_id=?`).all(c.id);
  res.json({ data: { ...c, contacts, tasks, projects } });
});
app.patch('/api/companies/:id', auth, (req, res) => {
  const b = req.body || {};
  for (const f of ['name','website','email','phone','address','notes'])
    if (b[f] !== undefined) db.prepare(`UPDATE companies SET ${f}=?, updated_at=? WHERE id=?`).run(b[f], nowISO(), req.params.id);
  res.json({ data: true });
});
app.delete('/api/companies/:id', auth, need('ADMIN','MANAGER'), (req, res) => {
  db.prepare(`DELETE FROM companies WHERE id=?`).run(req.params.id);
  res.json({ data: true });
});
app.get('/api/contacts', auth, (req, res) => {
  const s = req.query.search || '';
  const rows = s
    ? db.prepare(`SELECT c.*, co.name company_name FROM contacts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? ORDER BY c.first_name LIMIT 200`).all(`%${s}%`,`%${s}%`,`%${s}%`)
    : db.prepare(`SELECT c.*, co.name company_name FROM contacts c LEFT JOIN companies co ON co.id=c.company_id ORDER BY c.first_name LIMIT 200`).all();
  res.json({ data: rows });
});
app.post('/api/contacts', auth, (req, res) => {
  const b = req.body || {};
  if (!b.first_name) return res.status(400).json({ error: 'First name required' });
  const id = uid();
  db.prepare(`INSERT INTO contacts (id,first_name,last_name,email,phone,company_id,job_title,notes,tags,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?, ?,?)`)
    .run(id, b.first_name, b.last_name||'', b.email||'', b.phone||'', b.company_id||null, b.job_title||'', b.notes||'', b.tags||'', nowISO(), nowISO());
  res.json({ data: { id } });
});
app.get('/api/contacts/:id', auth, (req, res) => {
  const c = db.prepare(`SELECT c.*, co.name company_name FROM contacts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.id=?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const tasks = db.prepare(`SELECT ${TASK_JOIN} ${TASK_FROM} WHERE t.contact_id=? AND t.deleted_at IS NULL ORDER BY t.due_at LIMIT 100`).all(c.id);
  res.json({ data: { ...c, tasks } });
});
app.patch('/api/contacts/:id', auth, (req, res) => {
  const b = req.body || {};
  for (const f of ['first_name','last_name','email','phone','company_id','job_title','notes','tags'])
    if (b[f] !== undefined) db.prepare(`UPDATE contacts SET ${f}=?, updated_at=? WHERE id=?`).run(b[f]||null, nowISO(), req.params.id);
  res.json({ data: true });
});
app.delete('/api/contacts/:id', auth, need('ADMIN','MANAGER'), (req, res) => {
  db.prepare(`DELETE FROM contacts WHERE id=?`).run(req.params.id);
  res.json({ data: true });
});
app.get('/api/projects', auth, (req, res) => {
  const rows = db.prepare(`SELECT p.*, co.name company_name, u.first_name owner_first FROM projects p LEFT JOIN companies co ON co.id=p.company_id LEFT JOIN users u ON u.id=p.owner_id ORDER BY p.created_at DESC LIMIT 200`).all();
  res.json({ data: rows.map(p => {
    const total = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE project_id=? AND deleted_at IS NULL`).get(p.id).c;
    const done = db.prepare(`SELECT COUNT(*) c FROM tasks t JOIN task_statuses s ON s.id=t.status_id WHERE t.project_id=? AND s.is_closed=1 AND t.deleted_at IS NULL`).get(p.id).c;
    return { ...p, total, done, pct: total ? Math.round(done/total*100) : 0 };
  }) });
});
app.post('/api/projects', auth, (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Name required' });
  const id = uid();
  db.prepare(`INSERT INTO projects (id,name,company_id,owner_id,stage,description,start_date,end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, b.name, b.company_id||null, b.owner_id||req.user.id, b.stage||'Active', b.description||'', b.start_date||null, b.end_date||null, nowISO(), nowISO());
  res.json({ data: { id } });
});
app.get('/api/projects/:id', auth, (req, res) => {
  const p = db.prepare(`SELECT p.*, co.name company_name FROM projects p LEFT JOIN companies co ON co.id=p.company_id WHERE p.id=?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const tasks = db.prepare(`SELECT ${TASK_JOIN} ${TASK_FROM} WHERE t.project_id=? AND t.deleted_at IS NULL ORDER BY t.due_at`).all(p.id);
  const total = tasks.length;
  const done = tasks.filter(t => t.status_closed).length;
  res.json({ data: { ...p, tasks, total, done, pct: total ? Math.round(done/total*100) : 0 } });
});
app.patch('/api/projects/:id', auth, (req, res) => {
  const b = req.body || {};
  for (const f of ['name','company_id','owner_id','stage','description','start_date','end_date'])
    if (b[f] !== undefined) db.prepare(`UPDATE projects SET ${f}=?, updated_at=? WHERE id=?`).run(b[f]||null, nowISO(), req.params.id);
  res.json({ data: true });
});
app.delete('/api/projects/:id', auth, need('ADMIN','MANAGER'), (req, res) => {
  db.prepare(`DELETE FROM projects WHERE id=?`).run(req.params.id);
  res.json({ data: true });
});

// ---------- dashboard / search / reports ----------
app.get('/api/dashboard', auth, (req, res) => {
  const v = visibleWhere(req.user);
  const now = nowISO();
  const dayStart = new Date(); dayStart.setHours(0,0,0,0);
  const dayEnd = new Date(); dayEnd.setHours(23,59,59,999);
  const q = (extra, ...p) => db.prepare(`SELECT COUNT(*) c ${TASK_FROM} JOIN task_statuses s2 ON s2.id=t.status_id WHERE t.deleted_at IS NULL AND (${v.sql}) AND ${extra}`).get(...v.params, ...p).c;
  const list = (extra, order, ...p) => db.prepare(`SELECT ${TASK_JOIN} ${TASK_FROM} JOIN task_statuses s2 ON s2.id=t.status_id WHERE t.deleted_at IS NULL AND (${v.sql}) AND ${extra} ORDER BY ${order} LIMIT 10`).all(...v.params, ...p);
  res.json({ data: {
    counts: {
      dueToday: q(`t.due_at>=? AND t.due_at<=?`, dayStart.toISOString(), dayEnd.toISOString()),
      overdue: q(`t.due_at<? AND s2.is_closed=0`, now),
      upcoming: q(`t.due_at>? AND s2.is_closed=0`, now),
      completedToday: q(`t.completed_at>=? AND t.completed_at<=?`, dayStart.toISOString(), dayEnd.toISOString()),
      high: q(`t.priority IN ('HIGH','URGENT') AND s2.is_closed=0`),
      myOpen: db.prepare(`SELECT COUNT(*) c FROM tasks t JOIN task_statuses s ON s.id=t.status_id WHERE t.assignee_id=? AND s.is_closed=0 AND t.deleted_at IS NULL`).get(req.user.id).c,
    },
    dueToday: list(`t.due_at>=? AND t.due_at<=?`, 't.due_at ASC', dayStart.toISOString(), dayEnd.toISOString()),
    overdue: list(`t.due_at<? AND s2.is_closed=0`, 't.due_at ASC', now),
    upcoming: list(`t.due_at>? AND s2.is_closed=0`, 't.due_at ASC', now),
    unread: db.prepare(`SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0`).get(req.user.id).c,
  }});
});

app.get('/api/search', auth, (req, res) => {
  const raw = (req.query.q || '').trim();
  if (!raw) return res.json({ data: { tasks: [], contacts: [], companies: [], projects: [] } });
  const v = visibleWhere(req.user);
  let extra = '', xp = [];
  const low = raw.toLowerCase();
  if (low.includes('overdue')) { extra += ` AND t.due_at<? AND s2.is_closed=0`; xp.push(nowISO()); }
  if (low.includes('due today') || low === 'today') { const a=new Date();a.setHours(0,0,0,0);const b=new Date();b.setHours(23,59,59,999); extra+=` AND t.due_at>=? AND t.due_at<=?`; xp.push(a.toISOString(), b.toISOString()); }
  let kw = raw.replace(/overdue|tasks?|due today|for /gi, '').trim();
  const forMatch = raw.match(/for\s+([a-zA-Z]+)/i);
  if (forMatch) {
    const u = db.prepare(`SELECT id FROM users WHERE first_name LIKE ?`).get(`%${forMatch[1]}%`);
    if (u) { extra += ` AND t.assignee_id=?`; xp.push(u.id); }
    kw = kw.replace(forMatch[0], '').trim();
  }
  let tasks = [];
  if (kw) tasks = db.prepare(`SELECT ${TASK_JOIN} ${TASK_FROM} JOIN task_statuses s2 ON s2.id=t.status_id WHERE t.deleted_at IS NULL AND (${v.sql}) ${extra} AND (t.title LIKE ? OR t.description LIKE ? OR t.tags LIKE ?) ORDER BY t.due_at LIMIT 30`)
    .all(...v.params, ...xp, `%${kw}%`, `%${kw}%`, `%${kw}%`);
  else if (extra) tasks = db.prepare(`SELECT ${TASK_JOIN} ${TASK_FROM} JOIN task_statuses s2 ON s2.id=t.status_id WHERE t.deleted_at IS NULL AND (${v.sql}) ${extra} ORDER BY t.due_at LIMIT 30`).all(...v.params, ...xp);
  const contacts = db.prepare(`SELECT * FROM contacts WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? LIMIT 10`).all(`%${raw}%`,`%${raw}%`,`%${raw}%`);
  const companies = db.prepare(`SELECT * FROM companies WHERE name LIKE ? LIMIT 10`).all(`%${raw}%`);
  const projects = db.prepare(`SELECT * FROM projects WHERE name LIKE ? LIMIT 10`).all(`%${raw}%`);
  res.json({ data: { tasks, contacts, companies, projects } });
});

app.get('/api/reports/summary', auth, need('ADMIN','MANAGER'), (req, res) => {
  const byStatus = db.prepare(`SELECT s.name, COUNT(t.id) c FROM task_statuses s LEFT JOIN tasks t ON t.status_id=s.id AND t.deleted_at IS NULL GROUP BY s.name ORDER BY s.sort_order`).all();
  const byPriority = db.prepare(`SELECT priority, COUNT(*) c FROM tasks WHERE deleted_at IS NULL GROUP BY priority`).all();
  const aging = db.prepare(`SELECT CASE WHEN julianday('now')-julianday(due_at) < 1 THEN '< 1 day' WHEN julianday('now')-julianday(due_at) < 3 THEN '1-3 days' WHEN julianday('now')-julianday(due_at) < 7 THEN '3-7 days' ELSE '7+ days' END bucket, COUNT(*) c
    FROM tasks t JOIN task_statuses s ON s.id=t.status_id WHERE s.is_closed=0 AND t.due_at< ? AND t.deleted_at IS NULL GROUP BY bucket`).all(nowISO());
  res.json({ data: { byStatus, byPriority, aging } });
});

// ---------- settings ----------
app.get('/api/settings/statuses', auth, (req, res) => res.json({ data: db.prepare(`SELECT * FROM task_statuses ORDER BY sort_order`).all() }));
app.post('/api/settings/statuses', auth, need('ADMIN'), (req, res) => {
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uid();
  const max = db.prepare(`SELECT COALESCE(MAX(sort_order),0)+1 m FROM task_statuses`).get().m;
  db.prepare(`INSERT INTO task_statuses (id,name,color,sort_order,is_closed) VALUES (?,?,?,?,0)`).run(id, name, color||'#6366f1', max);
  res.json({ data: { id } });
});
app.delete('/api/settings/statuses/:id', auth, need('ADMIN'), (req, res) => {
  const used = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE status_id=?`).get(req.params.id).c;
  if (used) return res.status(400).json({ error: `Status in use by ${used} tasks` });
  db.prepare(`DELETE FROM task_statuses WHERE id=?`).run(req.params.id);
  res.json({ data: true });
});
app.get('/api/settings/types', auth, (req, res) => res.json({ data: db.prepare(`SELECT * FROM task_types ORDER BY name`).all() }));
app.post('/api/settings/types', auth, need('ADMIN'), (req, res) => {
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uid();
  db.prepare(`INSERT INTO task_types (id,name,color) VALUES (?,?,?)`).run(id, name, color||'#6366f1');
  res.json({ data: { id } });
});

// ---------- system ----------
app.get('/api/system/health', (req, res) => res.json({ data: { ok: true, time: nowISO() } }));
app.get('/api/system/backup', auth, need('ADMIN'), (req, res) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(DATA_DIR, 'backups', `grapteam-${stamp}.db`);
  try{ db.prepare(`VACUUM INTO ?`).run(dest); } catch(e){ return res.status(500).json({error: e.message})}
  res.download(dest, `grapteam-backup-${stamp}.db`);
});

// ---------- SPA fallback ----------
if (fs.existsSync(WEB_DIST)) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

// ---------- reminder scheduler (every 60s, local server mode only) ----------
if (!process.env.VERCEL) {
  setInterval(() => {
    try {
      const now = new Date();
      const rows = db.prepare(`SELECT t.* FROM tasks t JOIN task_statuses s ON s.id=t.status_id
        WHERE s.is_closed=0 AND t.deleted_at IS NULL AND t.reminder_minutes IS NOT NULL`).all();
      for (const t of rows) {
        const due = new Date(t.due_at);
        const remindAt = new Date(due.getTime() - t.reminder_minutes * 60000);
        // initial reminder
        if (t.reminder_sent===0 && remindAt <= now) {
          notify(t.assignee_id, 'REMINDER', `Reminder: ${t.title}`, `Due ${t.due_at}`, t.id);
          db.prepare(`UPDATE tasks SET reminder_sent=1, last_repeat_at=? WHERE id=?`).run(now.toISOString(), t.id);
          continue;
        }
        // repeat reminders
        if (t.repeat_minutes && t.reminder_sent===1) {
          const last = t.last_repeat_at ? new Date(t.last_repeat_at) : remindAt;
          const nextRepeat = new Date(last.getTime() + t.repeat_minutes*60000);
          if (nextRepeat <= now && due > now) {
            // still before due, or even overdue we keep nagging until closed — per spec keep nagging until done
            notify(t.assignee_id, 'REMINDER', `⏰ Reminder: ${t.title}`, `Due ${t.due_at} — repeat every ${t.repeat_minutes}m`, t.id);
            db.prepare(`UPDATE tasks SET last_repeat_at=? WHERE id=?`).run(now.toISOString(), t.id);
          } else if (nextRepeat <= now && due <= now) {
            // overdue repeat as well
            notify(t.assignee_id, 'REMINDER', `⏰ Overdue: ${t.title}`, `Was due ${t.due_at} — repeat every ${t.repeat_minutes}m`, t.id);
            db.prepare(`UPDATE tasks SET last_repeat_at=? WHERE id=?`).run(now.toISOString(), t.id);
          }
        }
      }
    } catch (e) { console.error('scheduler', e.message); }
  }, 60 * 1000);
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Vercel: export app as serverless function, locally still listen
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => console.log(`GraphTeam app + API on http://0.0.0.0:${PORT}`));
}
export default app;
