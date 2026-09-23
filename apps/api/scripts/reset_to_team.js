import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'grapteam.db');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = OFF');

console.log('Clearing old demo tasks, documents, subtasks, activities, comments, companies, contacts...');
db.exec(`
  DELETE FROM tasks;
  DELETE FROM subtasks;
  DELETE FROM documents;
  DELETE FROM attachments;
  DELETE FROM comments;
  DELETE FROM activities;
  DELETE FROM notifications;
  DELETE FROM contacts;
  DELETE FROM companies;
  DELETE FROM projects;
  DELETE FROM users;
`);

const now = new Date().toISOString();
const team = [
  { name: 'Mayank', email: 'mayank@grapteam.local', pass: 'admin@mayank', role: 'ADMIN', manager_id: null },
  { name: 'Rudra', email: 'rudra@grapteam.local', pass: 'team@rudra', role: 'MEMBER' },
  { name: 'Lay', email: 'lay@grapteam.local', pass: 'team@lay', role: 'MEMBER' },
  { name: 'Vedant', email: 'vedant@grapteam.local', pass: 'team@vedant', role: 'MEMBER' },
  { name: 'Bhumi', email: 'bhumi@grapteam.local', pass: 'team@bhumi', role: 'MEMBER' }
];

const adminId = uuidv4();
console.log('Seeding Admin: Mayank (pass: admin@mayank)...');
db.prepare(`INSERT INTO users (id, first_name, last_name, email, password_hash, role, manager_id, timezone, is_active, created_at, updated_at)
  VALUES (?, 'Mayank', '', 'mayank@grapteam.local', ?, 'ADMIN', NULL, 'Asia/Kolkata', 1, ?, ?)`).run(
  adminId, bcrypt.hashSync('admin@mayank', 10), now, now
);

for (const m of team.slice(1)) {
  console.log(`Seeding Member: ${m.name} (pass: ${m.pass})...`);
  db.prepare(`INSERT INTO users (id, first_name, last_name, email, password_hash, role, manager_id, timezone, is_active, created_at, updated_at)
    VALUES (?, ?, '', ?, ?, 'MEMBER', ?, 'Asia/Kolkata', 1, ?, ?)`).run(
    uuidv4(), m.name, m.email, bcrypt.hashSync(m.pass, 10), adminId, now, now
  );
}

// Clean upload files
const uploadDir = path.join(DATA_DIR, 'uploads');
if (fs.existsSync(uploadDir)) {
  const files = fs.readdirSync(uploadDir);
  for (const f of files) {
    if (f !== '.gitkeep') {
      try { fs.unlinkSync(path.join(uploadDir, f)); } catch {}
    }
  }
}

db.pragma('foreign_keys = ON');

console.log('Database successfully reset to Mayank + 4 team members with zero demo tasks!');
console.log('Users in database:', db.prepare('SELECT id, first_name, email, role FROM users').all());
db.close();
