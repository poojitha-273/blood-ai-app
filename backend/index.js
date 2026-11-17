const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load server/.env first regardless of current working directory, plus optional root .env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

// Import routes after env is loaded
const authRoutes = require('./routes/auth');
const hospitalRoutes = require('./routes/hospital');
const donorRoutes = require('./routes/donor');
const bloodRequestRoutes = require('./routes/bloodRequest');
const notificationRoutes = require('./routes/notification');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// API routes (Strict 2-Role Architecture: Hospital & Donor)
app.use('/api/auth', authRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/donor', donorRoutes);
app.use('/api/blood-requests', bloodRequestRoutes);
app.use('/api/notifications', notificationRoutes);

const CLIENT_DIST_DIR = path.resolve(__dirname, '../client/dist');
const CLIENT_INDEX_HTML = path.join(CLIENT_DIST_DIR, 'index.html');
const hasFrontendBuild = () => fs.existsSync(CLIENT_INDEX_HTML);

// Health check
app.get('/api/health', (_req, res) => {
  const isVercel = Boolean(process.env.VERCEL);
  const built = !isVercel && hasFrontendBuild();
  res.json({
    status: 'ok',
    mode: isVercel ? 'vercel-service' : built ? 'unified-fullstack' : 'api-only',
    frontendBuilt: built,
    timestamp: new Date().toISOString(),
  });
});

// Return JSON 404 for unknown API endpoints instead of SPA HTML
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve unified built React/Vite frontend + SPA history fallback in non-Vercel deployments
// (On Vercel Services, the separate "client" Vite service serves frontend assets & SPA routes.)
if (!process.env.VERCEL && hasFrontendBuild()) {
  app.use(
    express.static(CLIENT_DIST_DIR, {
      index: false,
      maxAge: '7d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(CLIENT_INDEX_HTML);
  });
}

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LifeLink unified server running on port ${PORT} (${hasFrontendBuild() ? 'frontend + API merged' : 'API mode'})`);
  });
}

module.exports = app;
