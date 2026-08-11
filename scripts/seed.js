// scripts/seed.js
//
// Loads scripts/data/graph-data.json into your CognoDB instance.
//
// Usage:
//   npm run seed
//
// Reads connection details from environment variables (see .env.example).
// Safe to re-run: constraints + MERGE make this idempotent, so running it
// twice won't create duplicate nodes or relationships.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');

const { COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD } = process.env;

if (!COGNODB_URI || !COGNODB_USER || !COGNODB_PASSWORD) {
  console.error('Missing COGNODB_URI / COGNODB_USER / COGNODB_PASSWORD.');
  console.error('Copy .env.example to .env and fill in your CognoDB Cloud credentials first.');
  process.exit(1);
}

const dataPath = path.join(__dirname, 'data', 'graph-data.json');
if (!fs.existsSync(dataPath)) {
  console.error(`Seed data not found at ${dataPath}.`);
  console.error('Run "node scripts/generate-data.js" first (or "npm run seed" already does this).');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

async function main() {
  const driver = neo4j.driver(
    COGNODB_URI,
    neo4j.auth.basic(COGNODB_USER, COGNODB_PASSWORD)
  );

  try {
    console.log('Verifying connectivity to CognoDB…');
    await driver.verifyConnectivity();
    console.log('✅ Connected.\n');
  } catch (err) {
    console.error('❌ Could not connect to CognoDB:', err.message);
    console.error('   Double-check COGNODB_URI, COGNODB_USER and COGNODB_PASSWORD in .env,');
    console.error('   and confirm your instance is running at console.cognodb.com.');
    process.exit(1);
  }

  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });

  try {
    console.log('Creating uniqueness constraints…');
    await session.run('CREATE CONSTRAINT package_name IF NOT EXISTS FOR (p:Package) REQUIRE p.name IS UNIQUE');
    await session.run('CREATE CONSTRAINT maintainer_username IF NOT EXISTS FOR (m:Maintainer) REQUIRE m.npmUsername IS UNIQUE');
    await session.run('CREATE CONSTRAINT vuln_cve_id IF NOT EXISTS FOR (v:Vulnerability) REQUIRE v.cveId IS UNIQUE');

    console.log(`Loading ${data.packages.length} Package nodes…`);
    await session.run(
      `UNWIND $rows AS row
       MERGE (p:Package {name: row.name})
       SET p.version = row.version,
           p.license = row.license,
           p.description = row.description,
           p.demoOnly = coalesce(row.demoOnly, false)`,
      { rows: data.packages }
    );

    console.log(`Loading ${data.maintainers.length} Maintainer nodes…`);
    await session.run(
      `UNWIND $rows AS row
       MERGE (m:Maintainer {npmUsername: row.npmUsername})
       SET m.name = row.name`,
      { rows: data.maintainers }
    );

    console.log(`Loading ${data.vulnerabilities.length} Vulnerability nodes…`);
    await session.run(
      `UNWIND $rows AS row
       MERGE (v:Vulnerability {cveId: row.cveId})
       SET v.severity = row.severity,
           v.description = row.description,
           v.fixedIn = row.fixedIn`,
      { rows: data.vulnerabilities }
    );

    console.log(`Loading ${data.dependsOn.length} DEPENDS_ON relationships…`);
    await session.run(
      `UNWIND $rows AS row
       MATCH (from:Package {name: row.from})
       MATCH (to:Package {name: row.to})
       MERGE (from)-[r:DEPENDS_ON]->(to)
       SET r.dependencyType = row.dependencyType`,
      { rows: data.dependsOn }
    );

    console.log(`Loading ${data.maintains.length} MAINTAINS relationships…`);
    await session.run(
      `UNWIND $rows AS row
       MATCH (m:Maintainer {npmUsername: row.maintainerNpmUsername})
       MATCH (p:Package {name: row.packageName})
       MERGE (m)-[:MAINTAINS]->(p)`,
      { rows: data.maintains }
    );

    console.log(`Loading ${data.affectedBy.length} AFFECTED_BY relationships…`);
    await session.run(
      `UNWIND $rows AS row
       MATCH (p:Package {name: row.packageName})
       MATCH (v:Vulnerability {cveId: row.cveId})
       MERGE (p)-[:AFFECTED_BY]->(v)`,
      { rows: data.affectedBy }
    );

    const countResult = await session.run(`
      MATCH (p:Package) WITH count(p) AS packages
      MATCH (m:Maintainer) WITH packages, count(m) AS maintainers
      MATCH (v:Vulnerability) WITH packages, maintainers, count(v) AS vulnerabilities
      MATCH ()-[d:DEPENDS_ON]->() WITH packages, maintainers, vulnerabilities, count(d) AS deps
      RETURN packages, maintainers, vulnerabilities, deps
    `);
    const counts = countResult.records[0].toObject();

    console.log('\n✅ Seed complete.');
    console.log(
      `   ${counts.packages} packages, ${counts.maintainers} maintainers, ` +
      `${counts.vulnerabilities} vulnerabilities, ${counts.deps} DEPENDS_ON edges.`
    );
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
