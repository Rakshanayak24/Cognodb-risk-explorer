// server/routes/api.js
const express = require('express');
const { runQuery, verifyConnection, getLastConnectionError } = require('../db');
const Q = require('../queries/cypher');

const router = express.Router();

// Licenses treated as "copyleft" for the demo conflict-detection query.
// (A real tool would use SPDX license expressions; kept simple here.)
const COPYLEFT_LICENSES = ['GPL-3.0', 'GPL-2.0', 'AGPL-3.0', 'LGPL-3.0'];

// Wrap every handler so a database outage returns a clean 503 with a
// human-readable message instead of an unhandled exception / stack trace.
function safe(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[api] query failed:', err.message);
      res.status(503).json({
        error: 'database_unavailable',
        message:
          'Could not reach the CognoDB instance. It may be paused, ' +
          'misconfigured, or your free-tier instance may have been ' +
          'reclaimed. Check COGNODB_URI / COGNODB_USER / COGNODB_PASSWORD ' +
          'and that the instance is running.',
        detail: err.message,
      });
    }
  };
}

router.get('/health', async (req, res) => {
  const status = await verifyConnection();
  res.status(status.ok ? 200 : 503).json(status);
});

router.get('/stats', safe(async (req, res) => {
  const records = await runQuery(Q.GRAPH_STATS);
  const r = records[0];
  res.json(r ? r.toObject() : { packages: 0, maintainers: 0, vulnerabilities: 0, edges: 0 });
}));

router.get('/samples', safe(async (req, res) => {
  const records = await runQuery(Q.SAMPLE_PACKAGES);
  res.json(records.map((r) => r.toObject()));
}));

router.get('/search', safe(async (req, res) => {
  const term = (req.query.q || '').trim();
  if (!term) return res.json([]);
  const records = await runQuery(Q.SEARCH_PACKAGES, { term });
  res.json(records.map((r) => r.toObject()));
}));

router.get('/package/:name/tree', safe(async (req, res) => {
  const records = await runQuery(Q.DEPENDENCY_TREE, { name: req.params.name });
  res.json(records.map((r) => r.toObject()));
}));

router.get('/package/:name/vulnerabilities', safe(async (req, res) => {
  const records = await runQuery(Q.TRANSITIVE_VULNERABILITIES, { name: req.params.name });
  res.json(records.map((r) => r.toObject()));
}));

router.get('/package/:name/maintainers', safe(async (req, res) => {
  const [summary, shared] = await Promise.all([
    runQuery(Q.MAINTAINER_SUMMARY, { name: req.params.name }),
    runQuery(Q.SHARED_MAINTAINER_RISK, { name: req.params.name }),
  ]);
  res.json({
    summary: summary[0] ? summary[0].toObject() : { packageName: req.params.name, maintainers: [], maintainerCount: 0 },
    sharedRisk: shared.map((r) => r.toObject()),
  });
}));

router.get('/package/:name/license-conflicts', safe(async (req, res) => {
  const records = await runQuery(Q.LICENSE_CONFLICTS, {
    name: req.params.name,
    conflictingLicenses: COPYLEFT_LICENSES,
  });
  res.json(records.map((r) => r.toObject()));
}));

router.get('/path', safe(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'bad_request', message: 'Both "from" and "to" query params are required.' });
  }
  const records = await runQuery(Q.SHORTEST_PATH_BETWEEN, { from, to });
  if (records.length === 0) {
    return res.json({ chain: null, hops: null, message: 'No dependency path found between these packages.' });
  }
  res.json(records[0].toObject());
}));

module.exports = router;
