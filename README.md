# GraphTeam — MASTER GUIDE 📘

**GraphTeam = Tasks + People + Dates + Reminders + Follow-ups — for your full office team.**

This one file has EVERYTHING: what it does, how to install, how to run, how to use daily,
team setup, backup, passwords, problems & solutions.

> **New here?** Do this: Section 4 (install) → Section 5 (run) → Section 6 (login).
> Total time: about 5 minutes.

---

## CONTENTS

1. [What is GraphTeam?](#1-what-is-graphteam)
2. [Your 5 pages (app tour)](#2-your-5-pages-app-tour)
3. [Requirements](#3-requirements)
4. [Install — step by step](#4-install--step-by-step)
5. [Run it](#5-run-it)
6. [Login + demo accounts](#6-login--demo-accounts)
7. [Add YOUR real team (important!)](#7-add-your-real-team-important)
8. [Daily office workflow (with example)](#8-daily-office-workflow-with-example)
9. [Every feature explained](#9-every-feature-explained)
10. [How reminders work](#10-how-reminders-work)
11. [Team on office network — all desks, one system](#11-team-on-office-network--all-desks-one-system)
12. [Backup & restore](#12-backup--restore)
13. [Forgot password?](#13-forgot-password)
14. [Settings page reference](#14-settings-page-reference)
15. [Keyboard shortcuts](#15-keyboard-shortcuts)
16. [Files & folders (what is where)](#16-files--folders-what-is-where)
17. [Database (your data)](#17-database-your-data)
18. [API list (for technical users)](#18-api-list-for-technical-users)
19. [Ports, addresses & settings](#19-ports-addresses--settings)
20. [Rebuilding after changes](#20-rebuilding-after-changes)
21. [Security notes](#21-security-notes)
22. [TROUBLESHOOTING (read when stuck)](#22-troubleshooting-read-when-stuck)
23. [FAQ — quick answers](#23-faq--quick-answers)
24. [What is NOT in this version](#24-what-is-not-in-this-version)

---

## 1. What is GraphTeam?

A **simple, private task system for your office**. It always answers:

- **What** work needs to be done?
- **Who** has to do it?
- **When exactly** is it due? (date + time)
- **How much time** is left? (`Due in 2h`, `Overdue by 3h`)
- **What is done**, overdue, or needs follow-up?
- **What is happening today?**

**Kept lean on purpose:** no calendar page, no CRM pages, no extra modules.
Just work getting done. ✅

**Main features:**

| Feature | What it does |
|---|---|
| ⚡ + New Task | Create a task in ~10 seconds (name + person + date/time + priority) |
| 📊 Dashboard | Overdue first, then due-today, upcoming, completed-today |
| ✅ Tasks | List + Kanban board, Today / Overdue / Upcoming / Completed views |
| 👤 My Tasks | Each person sees only their own work |
| 🔔 Reminders | Bell + browser popup before due time |
| ⏰ Repeat reminders | Nag every 3/5/15 min or 1/2 hr until task is done |
| ➕ Follow-ups | Completing a task asks: follow up tomorrow / 3 days / next week? |
| 🔁 Recurring | Daily / weekdays / weekly / monthly auto-repeat tasks |
| 💬 Comments | Team discussion inside every task |
| 📎 Files | Attach PDF, images, documents to tasks |
| 🕓 Activity | Full history: who did what, when |
| 🔍 Search | Find anything, e.g. `overdue tasks` or `high priority` |
| 📈 Reports | Tasks by status/priority, overdue aging |
| 👥 Team (in Settings) | Add members, reset passwords, on/off |
| 💾 Backup | One-click database download |

---

## 2. Your 5 pages (app tour)

Left sidebar has only 5 pages:

| Page | Use it for |
|---|---|
| 📊 **Dashboard** | Morning check: what is overdue 🔴, due today 📅, upcoming ⏭ |
| ✅ **Tasks** | All work. Filter by person/status/priority, select many for bulk actions, switch List ☰ / Board ▦ |
| 👤 **My Tasks** | "What should *I* do now?" — your Open / Today / Overdue / Upcoming / Completed |
| 📈 **Reports** | Manager view: tasks by status, by priority, how old overdue tasks are (Managers/Admins) |
| ⚙️ **Settings** | Profile, **team members**, statuses, types, backup |

**Top bar:** 🔍 search → 🔔 notifications bell → **+ New Task** button.

**Click any task** → detail opens: edit everything, Complete/Reopen, Follow-up,
comments, files, activity history.

---

## 3. Requirements

- **Node.js 20 or newer** (only requirement — includes `npm`)
- Works on **Windows, Mac, Linux**
- ~200 MB disk space · any office PC is fine
- No internet needed after install (runs 100% on your machine/network)

**Check if Node is installed** — open terminal and run:

```bash
node --version
```

If it shows `v20.x` or higher → ready. If "not found" → install:

- **Windows:** download LTS from <https://nodejs.org> → install → close & reopen terminal
- **Mac:** same website, or `brew install node`
- **Linux:** `sudo apt install nodejs npm` (then check version is 20+)

---

## 4. Install — step by step

> **Windows users:** use **PowerShell** or **CMD**. Copy-paste each line one by one.

```bash
# 1. Go to the project folder (wherever you kept "grapteam")
cd grapteam

# 2. Install backend pieces
cd apps/api
npm install

# 3. Install frontend pieces
cd ../web
npm install

# 4. Build the frontend (makes the fast production version)
npm run build

# 5. Go back to backend folder
cd ../api
```

Done. You do this **only once** (or again only if files change).

---

## 5. Run it

### ✅ Recommended: ONE server, ONE link

```bash
# from the grapteam folder:
cd apps/api
npm start

# open in browser:  http://localhost:3001
```

Keep this window open while the team works. To stop: press `Ctrl + C`.

### 🔧 Developer mode (only if you edit code): TWO servers

```bash
# window 1 — backend:
cd apps/api && npm run dev

# window 2 — frontend:
cd apps/web && npm run dev

# open in browser:  http://localhost:5173
```

> First start creates everything automatically: database file, demo users, demo tasks.
> You will see: `GraphTeam app + API on http://0.0.0.0:3001`

---

## 6. Login + Team Accounts

Open the app → login page appears. Enter your **Name** (or username) and **Password** (no email required).

| Name / Username | Role | Password |
|---|---|---|
| **`mayank`** | Admin | `admin@mayank` |
| **`rudra`** | Member | `team@rudra` |
| **`lay`** | Member | `team@lay` |
| **`vedant`** | Member | `team@vedant` |
| **`bhumi`** | Member | `team@bhumi` |

---

## 7. Team Roles & Management

1. Log in as **Mayank (Admin)**
2. Go to **⚙️ Settings** → **👥 Team members**
3. Manage roles, add new members, or reset passwords if needed.

**Roles:**

| Role | Permissions |
|---|---|
| MEMBER | Own tasks, comments, subtasks, files. Restricted from Reports and Team Settings. |
| MANAGER | Own tasks + Reports + member management (cannot modify Admins) |
| ADMIN | Full access to all tasks, Reports, team management, backups, and lookup configuration. |

---

## 8. Daily office workflow (with example)

**Morning (2 min):** Open **Dashboard** → red **Overdue** first → **Due today** →
tell each person their top 3.

**Create work (10 sec):** Press **`C`** or **+ New Task**:
`Call ABC Industries` → Assign: Rahul → Due: Today 6 PM → Priority: High →
Reminder: 15 min before → **Create Task**.

**Work it:** Person opens **My Tasks** → sets **In Progress** → adds 💬 comment
("customer asked revised rates") → attaches 📎 quotation PDF → clicks **✓ Complete**.

**Follow-up:** On complete, app asks *"Create a follow-up?"* → Tomorrow / 3 days /
next week → linked child task auto-created. Nothing slips. 🎯

**Repeat jobs:** `Check production machine` → Recurrence: Daily → completing it
auto-creates tomorrow's copy. Same for weekly reports.

**Evening (2 min):** Dashboard → Completed today ✅ → move leftovers to tomorrow
(select many → bulk **Reschedule**).

---

## 9. Every feature explained

### Task fields
Title, description, type, status, priority (Low/Medium/High/**Urgent** 🔴),
assignee, start + due **date/time**, reminder, repeat-reminder, recurrence, tags,
notes, comments, files, activity.

### Statuses (default)
`Not Started` → `In Progress` → `Waiting` → `Completed` / `Cancelled`.
Admin can add custom ones in Settings. Board columns = statuses.

### Priorities
LOW · MEDIUM · HIGH · **URGENT** (red left border — impossible to miss).
Priority never replaces the due date — both are always shown.

### Due labels (live)
`Overdue by 3h` 🔴 · `Due in 25m` · `Due today, 4:00 PM` · `Due tomorrow` ·
`Due Mon` — always visible, everywhere.

### Reminders (one-time)
At time / 5 / 15 / 30 min / 1 / 2 hr / 1 day before. Fires to bell 🔔 +
browser popup (allow notifications when browser asks).

### ⏰ Repeat reminders (nagging)
`Every 3 min / 5 min / 15 min / 1 hr / 2 hr` — keeps reminding until the task is
Completed/Cancelled. Set in New Task or task detail (orange `⏰ Every 5m` badge).
Example: *Reminder 1 hr before + repeat every 15 min* = nagged from 1 hr before
due until done. Perfect for "must not forget" jobs.

### ➕ Follow-ups
Any task → **➕ Follow-up** → Tomorrow / In 3 days / Next week (10 AM) →
child task linked to parent, same priority, reminder 30 min. Completing also
suggests one. Listed under 🔗 in task detail.

### 🔁 Recurring
NONE / DAILY / WEEKDAYS (Mon–Fri) / WEEKLY / MONTHLY / YEARLY.
Completing an occurrence creates the next one automatically (same person, time,
reminder). To stop: set recurrence back to NONE.

### 💬 Comments
Inside every task, with name + time. Assignee gets notified of new comments.
Enter = send.

### 📎 Attachments
PDF, images (png/jpg/webp/gif), Word/Excel, txt/csv. Max 25 MB per file.
Stored in `data/uploads/`. Download anytime; ✕ deletes.

### 🕓 Activity
Every change logged: created, edited, assigned, status/priority/due/reminder
changed, completed, reopened, comment, file. Timeline in task detail.

### 🔍 Search (top bar)
Searches tasks (title/description/tags/company). Understands:
`overdue tasks for Rahul` · `tasks due today` · `quotation` · `ABC Industries`.

### Filters (Tasks page)
Person · status · priority · keyword. Combine freely.

### Bulk actions (Tasks page)
Tick checkboxes → dark bar appears: set status / priority / assign /
📅 reschedule / 🏷 tag / 🗑 archive.

### Kanban Board (Tasks → ▦ Board)
Drag-free board grouped by status. Click card = open detail.

### 🔔 Notifications (bell)
Reminders, assignments, comments, follow-ups. Click item = jump to task.
**Mark all read** button. Auto-refreshes every 30 sec.

### 📈 Reports (Manager/Admin)
Tasks by status, by priority, overdue aging (`< 1 day`, `1–3 days`, `3–7 days`, `7+ days`).

### 💾 Backup (Admin, Settings)
One click → downloads full database copy. See Section 12.

---

## 10. How reminders work

1. Each task can have **one reminder** (e.g. 15 min before due) + optional **repeat**.
2. Server checks **every 60 seconds** for due reminders → creates notification.
3. App shows it in 🔔 bell + browser popup (if allowed).
4. **Repeat** then re-fires every X minutes **until task is closed**.
5. Editing reminder/repeat restarts that task's cycle. Completing stops it.

**Check time math:** all times stored in UTC, shown in *your* browser timezone.
Due labels recompute live — no refresh needed.

**No popup?** → Browser blocked it. Click the 🔒/🔔 icon in the address bar →
allow Notifications → reload page. Bell still works regardless.

---

## 11. Team on office network — all desks, one system

Run single-server mode (Section 5) on **one main PC** (always-on while working).

**Step 1 — find main PC's address:**

- Windows: open CMD → `ipconfig` → look for `IPv4 Address`, e.g. `192.168.1.50`
- Mac/Linux: terminal → `ip addr | grep inet` or `ifconfig`

**Step 2 — on every other desk PC, open browser:**

```
http://192.168.1.50:3001     (use YOUR main PC address)
```

Everyone logs in with their own email/password (Section 7). Same data, live. 🎉

**If other PCs can't open it:**

1. All PCs must be on the **same WiFi/LAN** (same office router).
2. **Windows Firewall** blocks port 3001 by default → allow it:
   - Settings → Privacy & Security → Windows Security → Firewall → *Allow an app*,
     or run this in **Admin PowerShell**:
     ```powershell
     New-NetFirewallRule -DisplayName "GraphTeam" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
     ```
3. Keep the main PC awake (sleep = app sleeps for all).
4. Antivirus with "network protection" can also block — allow port 3001 there.

---

## 12. Backup & restore

**Backup (anytime, Admin):** Settings → 💾 **Download backup** → saves
`grapteam-backup-<date>.db`. Do this weekly (or daily). Also copy the whole
`data/` folder sometimes (it has uploaded files too).

**Restore:**

```bash
# 1. stop the server (Ctrl+C)
# 2. replace the database file:
cp  /path/to/grapteam-backup-XXXX.db  data/grapteam.db
# (Windows: copy "backup file" "data\grapteam.db" — overwrite)
# 3. delete the helper files if present:
rm -f data/grapteam.db-shm data/grapteam.db-wal
# 4. start server again
```

**Move to another PC:** copy the whole `grapteam` folder (code + `data/`) →
`npm install` again on the new PC → `npm start`. Data comes along. 💪

---

## 13. Forgot password?

**A member forgot theirs:** Admin → Settings → Team members → **🔑 Password**
button → type new password → done.

**Admin forgot theirs (locked out):** run from terminal:

```bash
cd apps/api
node scripts/reset-password.mjs admin@grapteam.local MyNewPass123
```

Works for any email. Password min 6 letters.

**Nuclear option (start 100% fresh):** stop server → delete
`data/grapteam.db`, `data/grapteam.db-shm`, `data/grapteam.db-wal` →
start server → fresh demo data + demo logins return. ⚠️ Erases ALL tasks.

---

## 14. Settings page reference

| Card | Who sees | What |
|---|---|---|
| 👤 My profile | Everyone | Name/email/role, change own password |
| 💾 Backup | Everyone (download: Admin) | One-click DB download |
| 👥 Team members | Manager/Admin | List, add, reset password, on/off |
| Statuses | Everyone (add/remove: Admin) | Custom workflow states |
| Task types | Everyone (add: Admin) | Labels like Call/Email/Meeting |

---

## 15. Keyboard shortcuts

| Key | Action |
|---|---|
| `C` | New task (when not typing in a field) |
| `Esc` | Close popup / task detail |
| `Enter` | Send comment (in comment box) |

---

## 16. Files & folders (what is where)

```
grapteam/
├── README.md                  ← YOU ARE HERE (master guide)
├── package.json               ← helper scripts
├── apps/
│   ├── api/                   ← backend (Node + Express + SQLite)
│   │   ├── package.json
│   │   ├── scripts/
│   │   │   └── reset-password.mjs   ← emergency password reset
│   │   └── src/
│   │       ├── server.js      ← all API routes + reminder engine
│   │       └── db.js          ← database tables + demo seed data
│   └── web/                   ← frontend (React + Vite)
│       ├── package.json
│       ├── vite.config.js
│       ├── index.html
│       └── src/
│           ├── main.jsx, App.jsx, index.css
│           ├── lib/           ← api.js (server calls), time.js (dates)
│           ├── components/    ← Layout, QuickCreate, TaskDetail
│           └── pages/         ← Login, Dashboard, Tasks, Reports, Settings
└── data/                      ← YOUR DATA (back this up!)
    ├── grapteam.db            ← main database (SQLite)
    ├── grapteam.db-shm / -wal ← database helpers (auto)
    ├── uploads/               ← attached files
    └── backups/               ← backup copies
```

> `node_modules/` and `apps/web/dist/` are auto-generated — never edit or copy them.

---

## 17. Database (your data)

- **Type:** SQLite — single file, no database server to install/manage.
- **File:** `data/grapteam.db` (+ `-shm`/`-wal` helpers while running).
- **Tables:** users, tasks, task_statuses, task_types, contacts, companies,
  projects, comments, activities, notifications, attachments (+ email tables
  reserved for future use).
- **Auto-created** on first start, with demo data only if empty.
- **Size:** tiny for office use (thousands of tasks = few MB).
- **View/edit manually (advanced):** use "DB Browser for SQLite" (free) — stop
  the server first.

---

## 18. API list (for technical users)

Base: `http://localhost:3001/api` · Auth: cookie + `Authorization: Bearer <token>`.

```
POST /auth/login  {email, password} → {user..., token}
POST /auth/logout · GET /auth/me · PATCH /auth/me · POST /auth/change-password

GET /users · POST /users · PATCH /users/:id · DELETE /users/:id
GET /team/overview · GET /meta (statuses+types+users)

GET /tasks?view=today|overdue|upcoming|completed|open|mine&assignee=&status=&priority=&search=
POST /tasks · GET /tasks/:id · PATCH /tasks/:id · DELETE /tasks/:id
POST /tasks/:id/complete · POST /tasks/:id/reopen · POST /tasks/:id/follow-up
POST /tasks/bulk {ids, action, payload}

GET+POST /tasks/:id/comments · GET /tasks/:id/activity
POST /tasks/:id/attachments · GET /attachments/:id/download · DELETE /attachments/:id

GET /notifications · POST /notifications/:id/read · POST /notifications/read-all

GET /contacts|/companies|/projects (+ POST, GET/:id, PATCH/:id, DELETE/:id)

GET /dashboard · GET /search?q= · GET /reports/summary
GET /settings/statuses|/types (+ POST, DELETE for statuses)

GET /system/health · GET /system/backup (downloads .db)
```

Roles enforced server-side: MEMBER < MANAGER < ADMIN.

---

## 19. Ports, addresses & settings

| What | Default | Change how |
|---|---|---|
| App + API (single server) | port `3001` | `PORT=8080 npm start` |
| Frontend dev mode | port `5173` | edit `apps/web/vite.config.js` |
| Database file | `data/grapteam.db` | `DB_PATH=/path/... npm start` |
| Data folder | `data/` | `DATA_DIR=/path/... npm start` |
| Login secret | built-in dev key | ⚠️ set `SESSION_SECRET=long-random-text` for real use |

Example (Windows CMD):

```cmd
set SESSION_SECRET=my-office-secret-xyz-789 & npm start
```

Example (Mac/Linux):

```bash
SESSION_SECRET=my-office-secret-xyz-789 npm start
```

---

## 20. Rebuilding after changes

The running app uses the **built** copy (`apps/web/dist/`). If anyone edits
frontend files (`apps/web/src/...`), rebuild + refresh:

```bash
cd apps/web
npm run build
```

Then hard-refresh browser (`Ctrl + Shift + R`). No server restart needed.
Backend changes (`apps/api/src/...`) need a server restart (`Ctrl+C` → `npm start`).

---

## 21. Security notes

- ✅ Passwords hashed with bcrypt (never plain text)
- ✅ Login sessions via httpOnly cookie + token, role-checked on every request
- ✅ Members see only their own/assigned work; managers see their team
- ✅ File uploads: type + size checked (pdf, images, office docs, txt, csv; 25 MB max)
- ⚠️ Set your own `SESSION_SECRET` (Section 19) for real office use
- ⚠️ This v1 is built for **trusted office LAN**, not the public internet.
  Don't expose port 3001 to the internet without proper setup (VPN/reverse proxy).
- ⚠️ Remove/deactivate demo accounts after adding your real team.

---

## 22. TROUBLESHOOTING (read when stuck)

### "Invalid email or password" at login
1. Passwords are case-sensitive: `Admin#2026!Gt` (capital A, then `#2026!Gt`).
2. **Chrome may fill your OLD saved password** over the field → click the
   password box, select all (`Ctrl+A`), delete, type fresh — or just use the
   **1-click: Admin** button (bypasses typing completely).
3. Still fails? Someone changed it → Admin resets it in Settings, or use the
   terminal script (Section 13).

### Chrome popup: "password found in a data breach"
Not an app error — Chrome warning about a weak password. With the current demo
passwords it should not appear. If it pops once from memory, click **OK**.

### Page doesn't load / "can't reach site" (own PC)
1. Is the server window still open and showing `GraphTeam app + API...`?
   If not → start it (Section 5).
2. Address must be exactly `http://localhost:3001` (single-server mode).
3. Port busy? (`EADDRINUSE`) → another copy is running. Close it, or use
   another port: `PORT=3002 npm start` → open `:3002`.

### Other desk PC can't open `http://192.168.x.x:3001`
Same WiFi? → Firewall allow port 3001? (Section 11) → main PC awake? →
correct IP? (re-run `ipconfig` — IPs can change).

### Blank/old page after an update
Hard refresh: **`Ctrl + Shift + R`**. (Browser cached the old version.)

### Reminders / popups not coming
1. Server must be running (it checks every 60 sec).
2. Task must be open (not Completed) with reminder/repeat set.
3. Browser: allow Notifications for the site (🔒 icon in address bar).
4. Bell 🔔 inside app always works even if popups blocked.

### Forgot admin password → locked out
Terminal fix (Section 13) — 30 seconds, no data loss.

### "Database is locked" error
Two servers running at once (e.g. dev + single mode). Stop all, start one.

### Start completely fresh (erase everything)
Section 13 → Nuclear option. Backup first if unsure!

### Online preview (this chat) doesn't load
The preview depends on this session's sandbox. The **real setup is your own PC**
(Sections 4–5) — that always works and is where your office will run it anyway.

---

## 23. FAQ — quick answers

**Q: How many people can use it?**
A: Comfortably ~30 on office LAN from one PC. Data stays tiny.

**Q: Does it need internet?**
A: No. Only your office network (or even just one PC).

**Q: Where is my data?**
A: `data/grapteam.db` + `data/uploads/`. Copy the `data/` folder = you have everything.

**Q: Can two people edit the same task?**
A: Yes. Last save wins; activity log shows who changed what.

**Q: Phone/tablet?**
A: Opens in mobile browser on same WiFi (`http://MAIN-PC-IP:3001`). Basic layout
works; desktop is best.

**Q: Can I change "GraphTeam" name/logo?**
A: Yes — it's your app. Name appears in `apps/web/` files (Layout, Login,
index.html title). Edit → rebuild (Section 20).

**Q: Email/Gmail connection?**
A: Not in this lean version (tasks work 100% without it). Planned as a plugin —
see next section.

---

## 24. What is NOT in this version

Deliberately skipped to stay lean (all can be added later):

- Email integration (Gmail/Outlook/IMAP → tasks)
- Calendar page, Team workload page, Contacts/Companies/Projects pages
  (their small backend tables still exist for future use)
- Mobile apps, public-internet hosting, SMS/WhatsApp alerts
- Advanced reports/exports, full audit log

**Roadmap idea:** real team → use daily for 2 weeks → then decide what (if anything)
to add. Most offices need nothing more than what's here. 🎯

---

*GraphTeam v1 — local-first team task management. Built for offices that
just want work DONE.* ✅
