import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = !!process.env.VERCEL;
const DATA_DIR = process.env.DATA_DIR || (isVercel ? '/tmp/grapteam-data' : path.join(__dirname, '../../../data'));
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'grapteam.db');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });

// On Vercel, copy repo seed database into /tmp if not already present
if (isVercel) {
  const seedDb = path.join(__dirname, '../../../data/grapteam.db');
  if (!fs.existsSync(DB_PATH) && fs.existsSync(seedDb)) {
    try { fs.copyFileSync(seedDb, DB_PATH); } catch (e) { console.error('Vercel DB copy failed', e.message); }
  }
}

export const db = new Database(DB_PATH, { timeout: 10000 });
if (isVercel) {
  try { db.pragma('journal_mode = DELETE'); } catch {}
} else {
  try { db.pragma('journal_mode = WAL'); } catch {}
}
try { db.pragma('foreign_keys = ON'); } catch {}
try { db.pragma('busy_timeout = 10000'); } catch {}

export const uid = () => uuidv4();
export const nowISO = () => new Date().toISOString();

export function notify(userId, type, title, body, taskId=null){
  try{
    db.prepare(`INSERT INTO notifications (id,user_id,type,title,body,task_id,is_read,created_at) VALUES (?,?,?,?,?,?,0,?)`)
      .run(uid(), userId, type, title, body||'', taskId, nowISO());
  }catch(e){ console.error('notify',e.message)}
}
export function logActivity(taskId, actorId, action, detail){
  try{
    db.prepare(`INSERT INTO activities (id,task_id,actor_id,action,detail,created_at) VALUES (?,?,?,?,?,?)`)
      .run(uid(), taskId, actorId, action, detail||'', nowISO());
  }catch(e){ console.error('logActivity',e.message)}
}

export function initSchema(){
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT, last_name TEXT,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT, manager_id TEXT,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    is_active INTEGER DEFAULT 1,
    created_at TEXT, updated_at TEXT, deleted_at TEXT,
    last_login_at TEXT
  );
  CREATE TABLE IF NOT EXISTS task_statuses (
    id TEXT PRIMARY KEY, name TEXT UNIQUE, color TEXT, sort_order INTEGER, is_closed INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS task_types (
    id TEXT PRIMARY KEY, name TEXT UNIQUE, color TEXT, icon TEXT
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT, phone TEXT, company_id TEXT, job_title TEXT, notes TEXT, tags TEXT, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY, name TEXT, website TEXT, email TEXT, phone TEXT, address TEXT, notes TEXT, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT, company_id TEXT, owner_id TEXT, stage TEXT, description TEXT, start_date TEXT, end_date TEXT, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT, description TEXT,
    type_id TEXT, status_id TEXT, priority TEXT,
    assignee_id TEXT, created_by_id TEXT, parent_task_id TEXT,
    contact_id TEXT, company_id TEXT, project_id TEXT,
    start_at TEXT, due_at TEXT,
    estimated_minutes INTEGER,
    reminder_minutes INTEGER,
    repeat_minutes INTEGER,
    recurrence TEXT DEFAULT 'NONE',
    tags TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    completed_at TEXT,
    reminder_sent INTEGER DEFAULT 0,
    last_repeat_at TEXT,
    created_at TEXT, updated_at TEXT, deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY, task_id TEXT, user_id TEXT, body TEXT, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY, task_id TEXT, actor_id TEXT, action TEXT, detail TEXT, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT, type TEXT, title TEXT, body TEXT, task_id TEXT, is_read INTEGER DEFAULT 0, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY, task_id TEXT, uploaded_by TEXT, filename TEXT, stored_path TEXT, mime TEXT, size_bytes INTEGER, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    assignee_id TEXT,
    due_at TEXT,
    sort_order INTEGER DEFAULT 0,
    completed_at TEXT,
    created_at TEXT,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'General',
    content TEXT DEFAULT '',
    filename TEXT,
    stored_path TEXT,
    mime TEXT,
    size_bytes INTEGER DEFAULT 0,
    task_id TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
  );
  `);
  // add columns if missing (migrations)
  try{ db.prepare(`SELECT repeat_minutes FROM tasks LIMIT 1`).get(); } catch{ try{ db.exec(`ALTER TABLE tasks ADD COLUMN repeat_minutes INTEGER`)}catch{}}
  try{ db.prepare(`SELECT last_repeat_at FROM tasks LIMIT 1`).get(); } catch{ try{ db.exec(`ALTER TABLE tasks ADD COLUMN last_repeat_at TEXT`)}catch{}}
  try{ db.prepare(`SELECT reminder_sent FROM tasks LIMIT 1`).get(); } catch{ try{ db.exec(`ALTER TABLE tasks ADD COLUMN reminder_sent INTEGER DEFAULT 0`)}catch{}}
  try{ db.prepare(`SELECT notes FROM tasks LIMIT 1`).get(); } catch{ try{ db.exec(`ALTER TABLE tasks ADD COLUMN notes TEXT DEFAULT ''`)}catch{}}

}

export function syncTeamUsers() {
  const now = nowISO();
  const teamUsers = [
    { name: 'Mayank', email: 'mayank@grapteam.local', pass: 'admin@mayank', role: 'ADMIN' },
    { name: 'Rudra', email: 'rudra@grapteam.local', pass: 'team@rudra', role: 'MEMBER' },
    { name: 'Lay', email: 'lay@grapteam.local', pass: 'team@lay', role: 'MEMBER' },
    { name: 'Vedant', email: 'vedant@grapteam.local', pass: 'team@vedant', role: 'MEMBER' },
    { name: 'Bhumi', email: 'bhumi@grapteam.local', pass: 'team@bhumi', role: 'MEMBER' }
  ];

  let admin = db.prepare(`SELECT * FROM users WHERE email='mayank@grapteam.local' OR LOWER(first_name)='mayank'`).get();
  if (!admin) {
    const adminId = uid();
    db.prepare(`INSERT INTO users (id, first_name, last_name, email, password_hash, role, manager_id, timezone, is_active, created_at, updated_at)
      VALUES (?, ?, '', ?, ?, 'ADMIN', NULL, 'Asia/Kolkata', 1, ?, ?)`).run(
      adminId, 'Mayank', 'mayank@grapteam.local', bcrypt.hashSync('admin@mayank', 10), now, now
    );
    admin = { id: adminId };
  } else if (!admin.password_hash || !admin.is_active) {
    db.prepare(`UPDATE users SET first_name='Mayank', last_name='', email='mayank@grapteam.local', password_hash=COALESCE(password_hash, ?), role='ADMIN', is_active=1, deleted_at=NULL, updated_at=? WHERE id=?`)
      .run(bcrypt.hashSync('admin@mayank', 10), now, admin.id);
  }

  for (const m of teamUsers.slice(1)) {
    const existing = db.prepare(`SELECT * FROM users WHERE email=? OR LOWER(first_name)=?`).get(m.email, m.name.toLowerCase());
    if (!existing) {
      db.prepare(`INSERT INTO users (id, first_name, last_name, email, password_hash, role, manager_id, timezone, is_active, created_at, updated_at)
        VALUES (?, ?, '', ?, ?, 'MEMBER', ?, 'Asia/Kolkata', 1, ?, ?)`).run(
        uid(), m.name, m.email, bcrypt.hashSync(m.pass, 10), admin.id, now, now
      );
    } else if (!existing.password_hash || !existing.is_active) {
      db.prepare(`UPDATE users SET first_name=?, last_name='', email=?, password_hash=COALESCE(password_hash, ?), role='MEMBER', manager_id=?, is_active=1, deleted_at=NULL, updated_at=? WHERE id=?`)
        .run(m.name, m.email, bcrypt.hashSync(m.pass, 10), admin.id, now, existing.id);
    }
  }

  // Remove any obsolete legacy demo users
  const validEmails = teamUsers.map(u => u.email);
  try {
    db.prepare(`DELETE FROM users WHERE email NOT IN (${validEmails.map(() => '?').join(',')})`).run(...validEmails);
  } catch {}
}

export function seedIfEmpty(){
  const statuses = [
    [uid(),'Not Started','#6366f1',1,0],
    [uid(),'In Progress','#0ea5e9',2,0],
    [uid(),'Waiting','#f59e0b',3,0],
    [uid(),'Completed','#10b981',4,1],
    [uid(),'Cancelled','#64748b',5,1],
  ];
  const sc = db.prepare(`SELECT COUNT(*) c FROM task_statuses`).get().c;
  if (sc === 0) {
    for (const [id, name, color, ord, closed] of statuses) {
      db.prepare(`INSERT INTO task_statuses (id, name, color, sort_order, is_closed) VALUES (?,?,?,?,?)`).run(id, name, color, ord, closed);
    }
  }

  const types = [
    [uid(),'Task','#0d9488'],
    [uid(),'Meeting','#0ea5e9'],
    [uid(),'Call','#3b82f6'],
    [uid(),'Review','#f59e0b'],
    [uid(),'General','#64748b']
  ];
  const tc = db.prepare(`SELECT COUNT(*) c FROM task_types`).get().c;
  if (tc === 0) {
    for (const [id, name, color] of types) {
      db.prepare(`INSERT INTO task_types (id, name, color) VALUES (?,?,?)`).run(id, name, color);
    }
  }

  syncTeamUsers();
}
