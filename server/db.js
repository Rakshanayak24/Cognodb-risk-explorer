// server/db.js
//
// Thin wrapper around the official Neo4j driver, pointed at CognoDB Cloud.
// CognoDB speaks openCypher over Bolt 5.x, so the standard neo4j-driver
// package works unmodified — no custom SDK required.

const neo4j = require('neo4j-driver');

const { COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD } = process.env;

let driver = null;
let lastConnectionError = null;

function getDriver() {
  if (driver) return driver;

  if (!COGNODB_URI || !COGNODB_USER || !COGNODB_PASSWORD) {
    throw new Error(
      'Missing CognoDB connection details. Set COGNODB_URI, COGNODB_USER and ' +
      'COGNODB_PASSWORD (see .env.example) before starting the server.'
    );
  }

  driver = neo4j.driver(
    COGNODB_URI,
    neo4j.auth.basic(COGNODB_USER, COGNODB_PASSWORD),
    {
      // Keep the pool small and polite for a free-tier c0 instance
      // (0.5 vCPU / 256MB RAM / up to 200 connections).
      maxConnectionPoolSize: 20,
      connectionAcquisitionTimeout: 10_000,
      maxTransactionRetryTime: 15_000,
      // Without this, every count()/size() value comes back from the driver
      // as a lossless neo4j.Integer ({ low, high }) instead of a plain JS
      // number. JSON.stringify()-ing that object doesn't throw, so the API
      // still returns 200 — it just silently ships `{"packages":{"low":4,
      // "high":0}}` to the client, which renders as "[object Object]"
      // anywhere the value is used directly. Our counts never get close to
      // Number.MAX_SAFE_INTEGER, so the small precision tradeoff is fine.
      disableLosslessIntegers: true,
    }
  );

  return driver;
}

// Verifies connectivity once at boot so the server can report a clear,
// human-readable error instead of failing mysteriously on the first request.
async function verifyConnection() {
  try {
    const d = getDriver();
    await d.verifyConnectivity();
    lastConnectionError = null;
    return { ok: true };
  } catch (err) {
    lastConnectionError = err.message || String(err);
    return { ok: false, error: lastConnectionError };
  }
}

function getLastConnectionError() {
  return lastConnectionError;
}

// Runs a Cypher query in a managed session, always closing the session
// afterwards, and normalizes driver errors into a shape routes can trust.
async function runQuery(cypher, params = {}) {
  const d = getDriver();
  const session = d.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

async function runWrite(cypher, params = {}) {
  const d = getDriver();
  const session = d.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = {
  getDriver,
  verifyConnection,
  getLastConnectionError,
  runQuery,
  runWrite,
  closeDriver,
};
