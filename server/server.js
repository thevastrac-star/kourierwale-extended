require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
const uploadDirs = ['uploads/kyc', 'uploads/bulk'];
uploadDirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/wallet',        require('./routes/wallet'));
app.use('/api/kyc',           require('./routes/kyc'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/ndr',           require('./routes/ndr'));
app.use('/api/cod',           require('./routes/cod'));
app.use('/api/couriers',      require('./routes/couriers'));
app.use('/api/tickets',       require('./routes/tickets'));
app.use('/api/warehouses',    require('./routes/warehouses'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/analytics',     require('./routes/analytics'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ─── DATABASE + AUTO-SEED ─────────────────────────────────────────────────────
const autoSeed = require('./config/autoSeed');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✅ MongoDB connected');
  // Auto-seed runs after DB is ready — safe on every restart (idempotent)
  await autoSeed();
})
.catch(err => console.error('❌ MongoDB error:', err));

// ─── KEEP-ALIVE PING (prevent Render free tier sleep) ────────────────────────
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
const PING_INTERVAL = 7 * 60 * 1000; // 7 minutes

const keepAlive = () => {
  const url = new URL(BACKEND_URL + '/health');
  const lib = url.protocol === 'https:' ? https : http;
  lib.get(url.href, (res) => {
    console.log(`[Keep-Alive] Pinged at ${new Date().toISOString()} – status ${res.statusCode}`);
  }).on('error', (e) => {
    console.warn('[Keep-Alive] Ping failed:', e.message);
  });
};

// Start pinging 10s after boot (gives DB time to connect first)
setTimeout(() => {
  setInterval(keepAlive, PING_INTERVAL);
  console.log('🔔 Keep-alive pinger started (every 7 min)');
}, 10000);

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
