// server/index.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const apiRouter = require('./routes/api');
const { verifyConnection, closeDriver } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback to the SPA shell for any non-API route.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function start() {
  console.log('DepGraph — starting up…');

  let connection;
  try {
    connection = await verifyConnection();
  } catch (err) {
    connection = { ok: false, error: err.message };
  }

  if (!connection.ok) {
    console.error('⚠️  Could not verify connectivity to CognoDB on startup:');
    console.error('   ' + connection.error);
    console.error('   The server will still start, but API requests will');
    console.error('   return 503 until the database is reachable. Check');
    console.error('   your .env file against .env.example.');
  } else {
    console.log('✅ Connected to CognoDB.');
  }

  app.listen(PORT, () => {
    console.log(`DepGraph listening on http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  console.log('\nShutting down…');
  await closeDriver();
  process.exit(0);
});

start();
