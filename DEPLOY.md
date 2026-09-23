# GraphTeam — GitHub + Vercel Deploy

Premium teal SaaS — Dashboard, Tasks, My Tasks, Reports, Settings.

## 1) Push to GitHub

```bash
# in grapteam folder
git init
git add .
git commit -m "GraphTeam premium teal — initial"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/grapteam.git
git push -u origin main
```

Your repo will be at `https://github.com/YOUR_USERNAME/grapteam`.
`.gitignore` already excludes `node_modules`, `dist`, `data/*.db`, uploads.

## 2) Host on Vercel (free)

### Option A — Full-stack on Vercel (demo, ephemeral SQLite)

Vercel's filesystem is ephemeral — SQLite will reset on redeploys. Great for demo, not for permanent office data.

1. Go to https://vercel.com → **Add New → Project** → Import your GitHub repo `grapteam`
2. Vercel auto-detects:
   - **Build Command:** `cd apps/web && npm install && npm run build`
   - **Output Directory:** `apps/web/dist`
   - **Install Command:** `cd apps/api && npm install && cd ../web && npm install`
   (already in `vercel.json`)
3. Add **Environment Variable** (optional but recommended):
   `SESSION_SECRET = a-long-random-string-32+chars`
4. **Deploy** → you get `https://grapteam-xxx.vercel.app`

`vercel.json` handles rewrites:
- `/api/*` → Express API (`apps/api/src/server.js` as serverless function)
- everything else → `apps/web/dist/index.html` (SPA)

### Option B — Recommended for office use (persistent data)

Keep frontend on Vercel, database elsewhere:

- **Frontend:** Vercel as above but set `VITE_API_URL` to your backend URL
- **Backend + DB:** Deploy `apps/api` to **Render / Railway / Fly.io** with a persistent disk or switch DB to Postgres (change `better-sqlite3` → `pg` + update `db.js`). Then data never resets.

For local office network (your original use-case), just run locally:
```bash
npm run install:all
npm run build
npm start
# open http://localhost:3001
# other desks: http://YOUR_PC_IP:3001
```

## 3) Local test before pushing

```bash
cd apps/api && npm install
cd ../web && npm install && npm run build
cd ../api && npm start
```

## 4) Vercel env notes

- Node 20+ is auto-selected (see `apps/api/package.json` engines if you add one)
- Server exports `export default app` when `process.env.VERCEL` is set — locally it still `listen`s on 3001
- To re-enable login (disable testing bypass), set in `apps/web/src/App.jsx` : `BYPASS_AUTH = false` and in `apps/api/src/server.js` : `BYPASS_AUTH_FOR_TESTING = false`, then rebuild.

## 5) Zip

`grapteam.zip` in this deliverable contains the full source (no `node_modules`/`dist` — run `npm run install:all` after unzip). `data/` has `.gitkeep` placeholders — real `grapteam.db` is created on first `npm start`.

Need help connecting a real Postgres for Vercel production? Ask and I'll migrate `db.js` to Postgres.
