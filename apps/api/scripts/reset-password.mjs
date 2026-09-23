import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
const [email, pw] = process.argv.slice(2);
if (!email || !pw) {
  console.log('Usage: node scripts/reset-password.mjs <email> <new-password>');
  console.log('Example: node scripts/reset-password.mjs admin@grapteam.local MyNewPass123');
  process.exit(1);
}
if (pw.length < 6) {
  console.log('Password must be at least 6 characters.');
  process.exit(1);
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '../../../data/grapteam.db'));
const r = db.prepare('UPDATE users SET password_hash=?, updated_at=? WHERE email=?')
  .run(bcrypt.hashSync(pw, 10), new Date().toISOString(), email.trim().toLowerCase());
console.log(r.changes ? `Password updated for ${email}. You can log in now.` : `No user found with email ${email}.`);
