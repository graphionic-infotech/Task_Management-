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
    return app(req, res);
  } catch (err) {
    console.error('Serverless fatal invocation error:', err);
    res.status(500).json({
      error: 'SERVERLESS_IMPORT_ERROR',
      message: err.message,
      code: err.code,
      stack: err.stack
    });
  }
}
