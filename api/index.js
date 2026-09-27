// Vercel serverless entry — forwards to Express app with bulletproof error diagnostics
let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      try {
        const mod = await import('../apps/api/src/server.js');
        return mod.default || mod;
      } catch (err) {
        console.error('Serverless import error:', err);
        throw err;
      }
    })();
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return await new Promise((resolve, reject) => {
      res.once('finish', resolve);
      res.once('close', resolve);
      res.once('error', reject);
      try {
        app(req, res);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.error('Serverless fatal invocation error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'SERVERLESS_INVOCATION_ERROR',
        message: err.message || String(err),
        code: err.code
      });
    }
  }
}
