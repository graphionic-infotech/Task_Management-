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
try {
  db.pragma('journal_mode = WAL');
} catch {
  try { db.pragma('journal_mode = DELETE'); } catch {}
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

export const SEED_USERS = [
  { id: 'usr_mayank', first_name: 'Mayank', last_name: '', email: 'mayank@grapteam.local', password_hash: '$2a$10$1px5BuEdoXNvcRwuRQOZK.37Igid2i7O0g0beo2AZwbgVb9cPSKWK', role: 'ADMIN', manager_id: null },
  { id: 'usr_rudra', first_name: 'Rudra', last_name: '', email: 'rudra@grapteam.local', password_hash: '$2a$10$HPRfgjXunnVi/b8Cdrqto.3Ewmwh1htJGWmjklc1wIKkeZUePkobO', role: 'MEMBER', manager_id: 'usr_mayank' },
  { id: 'usr_lay', first_name: 'Lay', last_name: '', email: 'lay@grapteam.local', password_hash: '$2a$10$cJoheniE70wVyl5rZ6sPku.iMiWVjPK8odWGEVoFCU5qYCvzjwo1e', role: 'MEMBER', manager_id: 'usr_mayank' },
  { id: 'usr_vedant', first_name: 'Vedant', last_name: '', email: 'vedant@grapteam.local', password_hash: '$2a$10$0joj.sFWv/vm0UiJAHe9tucYneFEVZEurWkm6qJisWzlhddP52DUK', role: 'MEMBER', manager_id: 'usr_mayank' },
  { id: 'usr_bhumi', first_name: 'Bhumi', last_name: '', email: 'bhumi@grapteam.local', password_hash: '$2a$10$IU3VzhllWpHKMaAPbpbJHOPN/I3mehkMq1QTPlJGjXh9hM0mU6BwW', role: 'MEMBER', manager_id: 'usr_mayank' },
];

export const SEED_STATUSES = [
  ['stat_not_started', 'Not Started', '#6366f1', 1, 0],
  ['stat_in_progress', 'In Progress', '#0ea5e9', 2, 0],
  ['stat_waiting', 'Waiting', '#f59e0b', 3, 0],
  ['stat_completed', 'Completed', '#10b981', 4, 1],
  ['stat_cancelled', 'Cancelled', '#64748b', 5, 1],
];

export const SEED_TYPES = [
  ['type_task', 'Task', '#0d9488'],
  ['type_meeting', 'Meeting', '#0ea5e9'],
  ['type_call', 'Call', '#3b82f6'],
  ['type_review', 'Review', '#f59e0b'],
  ['type_general', 'General', '#64748b']
];

export function syncTeamUsers() {
  const now = nowISO();
  for (const u of SEED_USERS) {
    try {
      const existing = db.prepare(`SELECT * FROM users WHERE id=? OR email=? OR LOWER(first_name)=?`).get(u.id, u.email, u.first_name.toLowerCase());
      if (!existing) {
        db.prepare(`INSERT INTO users (id, first_name, last_name, email, password_hash, role, manager_id, timezone, is_active, created_at, updated_at)
          VALUES (?, ?, '', ?, ?, ?, ?, 'Asia/Kolkata', 1, ?, ?)`).run(
          u.id, u.first_name, u.email, u.password_hash, u.role, u.manager_id, now, now
        );
      } else {
        db.prepare(`UPDATE users SET first_name=?, email=?, password_hash=?, role=?, is_active=1, deleted_at=NULL, updated_at=? WHERE id=?`)
          .run(u.first_name, u.email, u.password_hash, u.role, now, existing.id);
      }
    } catch (e) {
      console.warn('syncTeamUser warning for', u.id, e.message);
    }
  }

  // Remove any obsolete legacy demo users
  try {
    const validEmails = SEED_USERS.map(u => u.email);
    db.prepare(`DELETE FROM users WHERE email NOT IN (${validEmails.map(() => '?').join(',')})`).run(...validEmails);
  } catch {}
}

export function seedIfEmpty(){
  for (const [id, name, color, ord, closed] of SEED_STATUSES) {
    const s = db.prepare(`SELECT id FROM task_statuses WHERE name=? OR id=?`).get(name, id);
    if (!s) {
      db.prepare(`INSERT INTO task_statuses (id, name, color, sort_order, is_closed) VALUES (?,?,?,?,?)`).run(id, name, color, ord, closed);
    } else if (s.id !== id) {
      db.prepare(`UPDATE task_statuses SET id=? WHERE id=?`).run(id, s.id);
    }
  }

  for (const [id, name, color] of SEED_TYPES) {
    const t = db.prepare(`SELECT id FROM task_types WHERE name=? OR id=?`).get(name, id);
    if (!t) {
      db.prepare(`INSERT INTO task_types (id, name, color) VALUES (?,?,?)`).run(id, name, color);
    } else if (t.id !== id) {
      db.prepare(`UPDATE task_types SET id=? WHERE id=?`).run(id, t.id);
    }
  }

  syncTeamUsers();
}
