// scripts/generate-data.js
//
// Builds the seed dataset used by scripts/seed.js and writes it to
// scripts/data/graph-data.json. Run with: node scripts/generate-data.js
//
// Package names, dependency shapes and version numbers are modeled on the
// real npm ecosystem for realism. Two packages and ALL vulnerability
// records are clearly-marked synthetic ("demoOnly": true) so the app has
// something interesting to show for the license-conflict and CVE-exposure
// queries without misattributing real security history or licenses to
// real projects.

const fs = require('fs');
const path = require('path');

const packages = [
  { name: 'react', version: '18.3.1', license: 'MIT', description: 'A library for building user interfaces.' },
  { name: 'react-dom', version: '18.3.1', license: 'MIT', description: 'React package for working with the DOM.' },
  { name: 'scheduler', version: '0.23.2', license: 'MIT', description: 'Cooperative scheduler for the browser.' },
  { name: 'redux', version: '5.0.1', license: 'MIT', description: 'Predictable state container for JS apps.' },
  { name: 'react-redux', version: '9.1.2', license: 'MIT', description: 'Official React bindings for Redux.' },
  { name: 'next', version: '14.2.5', license: 'MIT', description: 'The React framework for production.' },
  { name: 'vue', version: '3.4.31', license: 'MIT', description: 'Progressive JavaScript framework.' },
  { name: 'vue-router', version: '4.4.0', license: 'MIT', description: 'Official router for Vue.js.' },
  { name: 'pinia', version: '2.1.7', license: 'MIT', description: 'Store for Vue.' },

  { name: 'express', version: '4.19.2', license: 'MIT', description: 'Fast, unopinionated, minimalist web framework.' },
  { name: 'body-parser', version: '1.20.2', license: 'MIT', description: 'Node.js body parsing middleware.' },
  { name: 'cookie-parser', version: '1.4.6', license: 'MIT', description: 'Cookie parsing middleware.' },
  { name: 'cookie', version: '0.6.0', license: 'MIT', description: 'HTTP cookie parser and serializer.' },
  { name: 'morgan', version: '1.10.0', license: 'MIT', description: 'HTTP request logger middleware.' },
  { name: 'cors', version: '2.8.5', license: 'MIT', description: 'CORS middleware.' },
  { name: 'helmet', version: '7.1.0', license: 'MIT', description: 'Secures Express apps with HTTP headers.' },
  { name: 'multer', version: '1.4.5-lts.1', license: 'MIT', description: 'Middleware for handling multipart/form-data.' },
  { name: 'compression', version: '1.7.4', license: 'MIT', description: 'Node.js compression middleware.' },

  { name: 'mongoose', version: '8.5.1', license: 'MIT', description: 'MongoDB object modeling for Node.js.' },
  { name: 'mongodb', version: '6.8.0', license: 'Apache-2.0', description: 'The official MongoDB driver.' },
  { name: 'pg', version: '8.12.0', license: 'MIT', description: 'PostgreSQL client for Node.js.' },
  { name: 'sequelize', version: '6.37.3', license: 'MIT', description: 'ORM for Postgres, MySQL, SQLite and SQL Server.' },
  { name: 'knex', version: '3.1.0', license: 'MIT', description: 'SQL query builder for Node.js.' },
  { name: 'ioredis', version: '5.4.1', license: 'MIT', description: 'Robust Redis client.' },
  { name: 'redis', version: '4.6.14', license: 'MIT', description: 'Node.js Redis client.' },

  { name: 'jsonwebtoken', version: '9.0.2', license: 'MIT', description: 'JSON Web Token implementation.' },
  { name: 'passport', version: '0.7.0', license: 'MIT', description: 'Simple, unobtrusive authentication.' },
  { name: 'passport-local', version: '1.0.0', license: 'MIT', description: 'Local username/password strategy for Passport.' },
  { name: 'bcryptjs', version: '2.4.3', license: 'MIT', description: 'Password hashing library.' },

  { name: 'joi', version: '17.13.3', license: 'BSD-3-Clause', description: 'Schema description and data validation.' },
  { name: 'ajv', version: '8.16.0', license: 'MIT', description: 'JSON schema validator.' },
  { name: 'express-validator', version: '7.1.0', license: 'MIT', description: 'Validation middleware for Express.' },

  { name: 'lodash', version: '4.17.21', license: 'MIT', description: 'General-purpose JS utility library.' },
  { name: 'axios', version: '1.7.2', license: 'MIT', description: 'Promise-based HTTP client.' },
  { name: 'follow-redirects', version: '1.15.6', license: 'MIT', description: 'HTTP/HTTPS redirect-following.' },
  { name: 'debug', version: '4.3.5', license: 'MIT', description: 'Small debugging utility.' },
  { name: 'ms', version: '2.1.3', license: 'MIT', description: 'Millisecond conversion utility.' },
  { name: 'chalk', version: '5.3.0', license: 'MIT', description: 'Terminal string styling.' },
  { name: 'ansi-styles', version: '6.2.1', license: 'MIT', description: 'ANSI escape codes for styling terminal text.' },
  { name: 'uuid', version: '10.0.0', license: 'MIT', description: 'RFC-compliant UUID generator.' },
  { name: 'semver', version: '7.6.2', license: 'ISC', description: 'Semantic version parser.' },
  { name: 'glob', version: '10.4.2', license: 'ISC', description: 'File pattern matching.' },
  { name: 'minimatch', version: '9.0.5', license: 'ISC', description: 'Glob-pattern matcher.' },
  { name: 'brace-expansion', version: '2.0.1', license: 'MIT', description: 'Brace expansion, as in bash.' },
  { name: 'qs', version: '6.12.2', license: 'BSD-3-Clause', description: 'Query string parsing and stringifying.' },
  { name: 'mime-types', version: '2.1.35', license: 'MIT', description: 'MIME type lookup.' },
  { name: 'mime-db', version: '1.52.0', license: 'MIT', description: 'MIME type database.' },
  { name: 'moment', version: '2.30.1', license: 'MIT', description: 'Date manipulation library.' },
  { name: 'dayjs', version: '1.11.11', license: 'MIT', description: 'Lightweight date library.' },
  { name: 'dotenv', version: '16.4.5', license: 'BSD-2-Clause', description: 'Loads environment variables from .env.' },
  { name: 'minimist', version: '1.2.8', license: 'MIT', description: 'Argument options parser.' },
  { name: 'yargs', version: '17.7.2', license: 'MIT', description: 'Command-line argument parser.' },
  { name: 'yargs-parser', version: '21.1.1', license: 'ISC', description: 'Argument parser backing yargs.' },
  { name: 'commander', version: '12.1.0', license: 'MIT', description: 'Command-line interfaces made easy.' },

  { name: 'webpack', version: '5.92.1', license: 'MIT', description: 'Module bundler.' },
  { name: 'webpack-cli', version: '5.1.4', license: 'MIT', description: 'CLI for webpack.' },
  { name: 'babel-loader', version: '9.1.3', license: 'MIT', description: 'Babel loader for webpack.' },
  { name: 'eslint', version: '9.6.0', license: 'MIT', description: 'Pluggable JS linter.' },
  { name: 'eslint-plugin-react', version: '7.34.3', license: 'MIT', description: 'React linting rules for ESLint.' },
  { name: 'jest', version: '29.7.0', license: 'MIT', description: 'JavaScript testing framework.' },
  { name: 'babel-jest', version: '29.7.0', license: 'MIT', description: 'Babel transform for Jest.' },
  { name: 'typescript', version: '5.5.3', license: 'Apache-2.0', description: 'Typed superset of JavaScript.' },
  { name: 'ts-node', version: '10.9.2', license: 'MIT', description: 'TypeScript execution for Node.js.' },
  { name: 'prettier', version: '3.3.2', license: 'MIT', description: 'Opinionated code formatter.' },
  { name: 'nodemon', version: '3.1.4', license: 'MIT', description: 'Auto-restarting dev server.' },
  { name: 'cross-env', version: '7.0.3', license: 'MIT', description: 'Cross-platform env var setting.' },
  { name: 'rimraf', version: '5.0.7', license: 'ISC', description: 'Cross-platform rm -rf.' },
  { name: 'chokidar', version: '3.6.0', license: 'MIT', description: 'File watcher.' },

  { name: 'socket.io', version: '4.7.5', license: 'MIT', description: 'Real-time bidirectional event-based communication.' },
  { name: 'engine.io', version: '6.5.5', license: 'MIT', description: 'Transport-based cross-browser realtime engine.' },
  { name: 'ws', version: '8.17.1', license: 'MIT', description: 'WebSocket client and server.' },
  { name: 'winston', version: '3.13.0', license: 'MIT', description: 'Multi-transport logging library.' },
  { name: 'nodemailer', version: '6.9.14', license: 'MIT-0', description: 'Email sending for Node.js.' },
  { name: 'sharp', version: '0.33.4', license: 'Apache-2.0', description: 'High-performance image processing.' },
  { name: 'puppeteer', version: '22.13.0', license: 'Apache-2.0', description: 'Headless Chrome/Chromium automation.' },
  { name: 'cheerio', version: '1.0.0', license: 'MIT', description: 'jQuery-like HTML parsing on the server.' },

  { name: 'acme-copyleft-utils', version: '2.1.0', license: 'GPL-3.0', description: '[demo-only, fictional] Sample copyleft-licensed helper library used to exercise the license-conflict query.', demoOnly: true },
  { name: 'gpl-crypto-toolkit', version: '0.9.2', license: 'AGPL-3.0', description: '[demo-only, fictional] Sample AGPL-licensed crypto helper used to exercise the license-conflict query.', demoOnly: true },
];

const dependsOn = [
  ['react-dom', 'react', 'peer'], ['react-dom', 'scheduler', 'runtime'],
  ['react-redux', 'react', 'peer'], ['react-redux', 'redux', 'peer'],
  ['next', 'react', 'peer'], ['next', 'react-dom', 'peer'], ['next', 'webpack', 'runtime'], ['next', 'sharp', 'optional'],
  ['vue-router', 'vue', 'peer'], ['pinia', 'vue', 'peer'],

  ['express', 'body-parser', 'runtime'], ['express', 'cookie-parser', 'runtime'],
  ['express', 'qs', 'runtime'], ['express', 'debug', 'runtime'],
  ['body-parser', 'qs', 'runtime'], ['body-parser', 'debug', 'runtime'],
  ['cookie-parser', 'cookie', 'runtime'],
  ['morgan', 'debug', 'runtime'],
  ['helmet', 'express', 'peer'],
  ['multer', 'debug', 'runtime'],
  ['compression', 'debug', 'runtime'],
  ['express-validator', 'express', 'peer'], ['express-validator', 'ajv', 'runtime'], ['express-validator', 'lodash', 'runtime'],

  ['mongoose', 'mongodb', 'runtime'], ['mongoose', 'ms', 'runtime'],
  ['sequelize', 'moment', 'optional'], ['sequelize', 'semver', 'runtime'],
  ['knex', 'pg', 'optional'], ['knex', 'debug', 'runtime'], ['knex', 'commander', 'runtime'],
  ['ioredis', 'debug', 'runtime'],

  ['passport-local', 'passport', 'peer'],

  ['axios', 'follow-redirects', 'runtime'],
  ['socket.io', 'engine.io', 'runtime'], ['socket.io', 'ws', 'optional'], ['socket.io', 'debug', 'runtime'],
  ['engine.io', 'ws', 'runtime'], ['engine.io', 'debug', 'runtime'],

  ['webpack', 'glob', 'runtime'], ['webpack', 'chalk', 'runtime'],
  ['webpack-cli', 'commander', 'runtime'], ['webpack-cli', 'webpack', 'peer'],
  ['babel-loader', 'webpack', 'peer'],
  ['eslint', 'debug', 'runtime'], ['eslint', 'minimatch', 'runtime'], ['eslint', 'ajv', 'runtime'],
  ['eslint-plugin-react', 'eslint', 'peer'],
  ['jest', 'babel-jest', 'runtime'], ['jest', 'chalk', 'runtime'], ['jest', 'glob', 'runtime'],
  ['ts-node', 'typescript', 'peer'],
  ['nodemon', 'chokidar', 'runtime'], ['nodemon', 'debug', 'runtime'],
  ['babel-jest', 'chalk', 'runtime'],

  ['glob', 'minimatch', 'runtime'], ['minimatch', 'brace-expansion', 'runtime'],
  ['rimraf', 'glob', 'runtime'],
  ['chalk', 'ansi-styles', 'runtime'],
  ['mime-types', 'mime-db', 'runtime'],
  ['yargs', 'yargs-parser', 'runtime'],
  ['sequelize', 'lodash', 'runtime'],
  ['knex', 'lodash', 'optional'],

  ['puppeteer', 'ws', 'runtime'],
  ['cheerio', 'ajv', 'optional'],

  ['winston', 'ms', 'runtime'],

  // synthetic edges pulling in the demo-only copyleft packages several
  // hops deep, so the license-conflict and vulnerability queries have
  // real traversal depth to exercise.
  ['knex', 'gpl-crypto-toolkit', 'optional'],
  ['gpl-crypto-toolkit', 'debug', 'runtime'],
  ['sequelize', 'acme-copyleft-utils', 'optional'],
  ['acme-copyleft-utils', 'lodash', 'runtime'],
];

// ---------------------------------------------------------------------
// Maintainers. Deliberately concentrated — a handful of people maintain
// many packages each, which is what makes the shared-maintainer /
// bus-factor query interesting.
// ---------------------------------------------------------------------
const maintainers = [
  { name: 'Priya Natarajan', npmUsername: 'pnatarajan', packages: ['express', 'body-parser', 'cookie-parser', 'compression', 'morgan', 'qs'] },
  { name: 'Marco Alves', npmUsername: 'marcoalves', packages: ['react', 'react-dom', 'scheduler'] },
  { name: 'Yuki Tanaka', npmUsername: 'yukit', packages: ['webpack', 'webpack-cli', 'babel-loader'] },
  { name: 'Sam Okafor', npmUsername: 'samokafor', packages: ['lodash', 'debug', 'ms', 'chalk', 'ansi-styles'] },
  { name: 'Elena Petrova', npmUsername: 'elenap', packages: ['mongoose', 'mongodb'] },
  { name: 'David Kim', npmUsername: 'davidkim', packages: ['axios', 'follow-redirects'] },
  { name: 'Fatima Zahra', npmUsername: 'fzahra', packages: ['jest', 'babel-jest', 'ts-node'] },
  { name: 'Tom Bergström', npmUsername: 'tbergstrom', packages: ['eslint', 'eslint-plugin-react', 'prettier'] },
  { name: 'Grace Liu', npmUsername: 'graceliu', packages: ['vue', 'vue-router', 'pinia'] },
  { name: 'Ravi Deshmukh', npmUsername: 'ravid', packages: ['knex', 'pg', 'sequelize'] },
  { name: 'Hannah Cohen', npmUsername: 'hcohen', packages: ['socket.io', 'engine.io', 'ws'] },
  { name: 'Lucas Ferreira', npmUsername: 'lucasf', packages: ['passport', 'passport-local', 'jsonwebtoken', 'bcryptjs'] },
  { name: 'Mei Chen', npmUsername: 'meichen', packages: ['semver', 'glob', 'minimatch', 'brace-expansion', 'rimraf'] },
  { name: 'Olusegun Adeyemi', npmUsername: 'oadeyemi', packages: ['joi', 'ajv', 'express-validator'] },
  { name: 'Anders Nielsen', npmUsername: 'anielsen', packages: ['moment', 'dayjs'] },
  { name: 'Isabella Rossi', npmUsername: 'irossi', packages: ['sharp', 'puppeteer', 'cheerio'] },
  { name: 'Noah Brandt', npmUsername: 'nbrandt', packages: ['winston', 'nodemailer'] },
  { name: 'Aisha Rahman', npmUsername: 'arahman', packages: ['next', 'redux', 'react-redux'] },
  { name: 'Chris Whitfield', npmUsername: 'cwhitfield', packages: ['yargs', 'yargs-parser', 'minimist', 'commander'] },
  { name: 'Dana Kowalski', npmUsername: 'dkowalski', packages: ['typescript', 'nodemon', 'cross-env', 'chokidar'] },
  { name: 'Igor Volkov', npmUsername: 'ivolkov', packages: ['uuid', 'dotenv', 'mime-types', 'mime-db'] },
  { name: 'Solo Maintainer (bus-factor risk)', npmUsername: 'lonewolf_dev', packages: ['acme-copyleft-utils', 'gpl-crypto-toolkit', 'redis', 'ioredis'] },
  { name: 'Helmet Team', npmUsername: 'helmetjs', packages: ['helmet', 'cors', 'multer'] },
];

// ---------------------------------------------------------------------
// Vulnerabilities — ALL SYNTHETIC. IDs use a "DEMO-CVE-" prefix and do
// not correspond to real, published CVEs. They exist purely so the
// transitive-vulnerability-exposure query has real data to traverse.
// ---------------------------------------------------------------------
const vulnerabilities = [
  { cveId: 'DEMO-CVE-2024-0001', severity: 'CRITICAL', description: '[synthetic] Prototype pollution allowing remote property injection.', fixedIn: '2.1.1', affects: ['acme-copyleft-utils'] },
  { cveId: 'DEMO-CVE-2024-0002', severity: 'HIGH', description: '[synthetic] ReDoS via crafted input to a regex-based parser.', fixedIn: '6.12.3', affects: ['qs'] },
  { cveId: 'DEMO-CVE-2023-0091', severity: 'CRITICAL', description: '[synthetic] Server-side request forgery via unvalidated redirect handling.', fixedIn: '1.15.7', affects: ['follow-redirects'] },
  { cveId: 'DEMO-CVE-2023-0142', severity: 'MEDIUM', description: '[synthetic] Denial of service through unbounded object recursion.', fixedIn: '4.17.22', affects: ['lodash'] },
  { cveId: 'DEMO-CVE-2024-0210', severity: 'HIGH', description: '[synthetic] Insecure default cipher suite negotiation.', fixedIn: '0.9.3', affects: ['gpl-crypto-toolkit'] },
  { cveId: 'DEMO-CVE-2022-0087', severity: 'MEDIUM', description: '[synthetic] Path traversal in static file resolution.', fixedIn: '1.20.3', affects: ['body-parser'] },
  { cveId: 'DEMO-CVE-2024-0333', severity: 'LOW', description: '[synthetic] Information disclosure via verbose error messages.', fixedIn: '1.10.1', affects: ['morgan'] },
  { cveId: 'DEMO-CVE-2023-0410', severity: 'HIGH', description: '[synthetic] Authentication bypass via malformed JWT header.', fixedIn: '9.0.3', affects: ['jsonwebtoken'] },
  { cveId: 'DEMO-CVE-2024-0501', severity: 'CRITICAL', description: '[synthetic] Remote code execution via unsafe deserialization.', fixedIn: '8.16.1', affects: ['ajv'] },
  { cveId: 'DEMO-CVE-2023-0678', severity: 'MEDIUM', description: '[synthetic] Timing side-channel in password comparison.', fixedIn: '2.4.4', affects: ['bcryptjs'] },
  { cveId: 'DEMO-CVE-2024-0729', severity: 'HIGH', description: '[synthetic] Cross-site WebSocket hijacking due to missing origin check.', fixedIn: '8.17.2', affects: ['ws'] },
  { cveId: 'DEMO-CVE-2022-0955', severity: 'MEDIUM', description: '[synthetic] Regular expression denial of service in date parsing.', fixedIn: '2.30.2', affects: ['moment'] },
  { cveId: 'DEMO-CVE-2024-0812', severity: 'LOW', description: '[synthetic] Predictable UUID generation under low-entropy environments.', fixedIn: '10.0.1', affects: ['uuid'] },
  { cveId: 'DEMO-CVE-2023-1022', severity: 'HIGH', description: '[synthetic] Arbitrary file write via crafted archive path.', fixedIn: '5.0.8', affects: ['rimraf'] },
  { cveId: 'DEMO-CVE-2024-1140', severity: 'CRITICAL', description: '[synthetic] Command injection via unsanitized shell argument passthrough.', fixedIn: '12.1.1', affects: ['commander'] },
];

function buildGraph() {
  const packageNames = new Set(packages.map((p) => p.name));

  for (const [from, to] of dependsOn) {
    if (!packageNames.has(from)) throw new Error(`Unknown package in dependsOn: ${from}`);
    if (!packageNames.has(to)) throw new Error(`Unknown package in dependsOn: ${to}`);
  }

  const maintains = [];
  for (const m of maintainers) {
    for (const pkgName of m.packages) {
      if (!packageNames.has(pkgName)) throw new Error(`Unknown package for maintainer ${m.name}: ${pkgName}`);
      maintains.push({ maintainerNpmUsername: m.npmUsername, packageName: pkgName });
    }
  }

  const affectedBy = [];
  for (const v of vulnerabilities) {
    for (const pkgName of v.affects) {
      if (!packageNames.has(pkgName)) throw new Error(`Unknown package for vulnerability ${v.cveId}: ${pkgName}`);
      affectedBy.push({ cveId: v.cveId, packageName: pkgName });
    }
  }

  return {
    packages,
    maintainers: maintainers.map(({ name, npmUsername }) => ({ name, npmUsername })),
    vulnerabilities: vulnerabilities.map(({ cveId, severity, description, fixedIn }) => ({ cveId, severity, description, fixedIn })),
    dependsOn: dependsOn.map(([from, to, dependencyType]) => ({ from, to, dependencyType })),
    maintains,
    affectedBy,
  };
}

const graph = buildGraph();
const outDir = path.join(__dirname, 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'graph-data.json');
fs.writeFileSync(outPath, JSON.stringify(graph, null, 2));

console.log(`Wrote ${outPath}`);
console.log(
  `  packages: ${graph.packages.length}, maintainers: ${graph.maintainers.length}, ` +
  `vulnerabilities: ${graph.vulnerabilities.length}, DEPENDS_ON edges: ${graph.dependsOn.length}, ` +
  `MAINTAINS edges: ${graph.maintains.length}, AFFECTED_BY edges: ${graph.affectedBy.length}`
);
