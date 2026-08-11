// public/app.js
// Vanilla JS SPA — no build step, no framework. Talks to the /api routes
// defined in server/routes/api.js.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  currentPackage: null,
};

// ---------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------
async function checkHealth() {
  const indicator = $('#conn-indicator');
  try {
    const res = await fetch('/api/health');
    const body = await res.json();
    if (body.ok) {
      indicator.className = 'conn-indicator ok';
      $('.conn-label', indicator).textContent = 'CognoDB connected';
      return true;
    }
    throw new Error(body.error || 'unreachable');
  } catch (err) {
    indicator.className = 'conn-indicator down';
    $('.conn-label', indicator).textContent = 'CognoDB unreachable';
    showDbError(err.message);
    return false;
  }
}

function showDbError(detail) {
  $('#landing').hidden = true;
  $('#package-view').hidden = true;
  $('#db-error').hidden = false;
  $('#db-error-detail').textContent = detail || 'Unknown connection error.';
}

function hideDbError() {
  $('#db-error').hidden = true;
}

// ---------------------------------------------------------------------
// Landing state: stats + sample packages
// ---------------------------------------------------------------------
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('stats unavailable');
    const stats = await res.json();
    $('[data-stat="packages"]').textContent = stats.packages ?? '—';
    $('[data-stat="edges"]').textContent = stats.edges ?? '—';
    $('[data-stat="maintainers"]').textContent = stats.maintainers ?? '—';
    $('[data-stat="vulnerabilities"]').textContent = stats.vulnerabilities ?? '—';
  } catch (err) {
    // Non-fatal — health check will already have surfaced the real error.
  }
}

async function loadSamples() {
  const row = $('#samples-row');
  try {
    const res = await fetch('/api/samples');
    if (!res.ok) throw new Error('samples unavailable');
    const samples = await res.json();
    if (samples.length === 0) {
      row.innerHTML = '<span class="hint-loading">No packages seeded yet — run "npm run seed".</span>';
      return;
    }
    row.innerHTML = '';
    samples.forEach((s) => {
      const chip = document.createElement('button');
      chip.className = 'sample-chip';
      chip.type = 'button';
      chip.textContent = s.name;
      chip.addEventListener('click', () => loadPackage(s.name));
      row.appendChild(chip);
    });
  } catch (err) {
    row.innerHTML = '<span class="hint-loading">Could not load samples.</span>';
  }
}

// ---------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------
$('#search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const term = $('#search-input').value.trim();
  if (!term) return;

  // If it's an exact-ish match, just load it directly; otherwise take the
  // first search result. Keeps the flow to one click for the common case.
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
    if (!res.ok) throw new Error('search failed');
    const results = await res.json();
    if (results.length === 0) {
      alert(`No package found matching "${term}".`);
      return;
    }
    const exact = results.find((r) => r.name.toLowerCase() === term.toLowerCase());
    loadPackage(exact ? exact.name : results[0].name);
  } catch (err) {
    alert('Search failed — the database may be unreachable.');
  }
});

// ---------------------------------------------------------------------
// Package view
// ---------------------------------------------------------------------
async function loadPackage(name) {
  state.currentPackage = name;
  $('#landing').hidden = true;
  hideDbError();
  $('#package-view').hidden = false;

  $('#pkg-name').textContent = name;
  $('#pkg-meta').textContent = 'loading…';
  $('#pkg-desc').textContent = '';
  $('#pkg-badges').innerHTML = '';
  $('#path-from-label').textContent = name;
  $('#search-input').value = name;

  // Reset to first tab
  setActiveTab('tree');

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(name)}`);
    const results = await res.json();
    const meta = results.find((r) => r.name === name) || results[0];
    if (meta) {
      $('#pkg-meta').textContent = `v${meta.version} · ${meta.license} · ${meta.ecosystem || 'npm'}`;
      $('#pkg-desc').textContent = meta.description || '';
    }
  } catch (err) {
    $('#pkg-meta').textContent = '';
  }

  loadTree(name);
  loadVulns(name);
  loadMaintainers(name);
  loadLicenseConflicts(name);
  $('#path-result').innerHTML = '';
  $('#path-to-input').value = '';
}

// -- Tabs --
$$('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

function setActiveTab(tab) {
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
}

// ---------------------------------------------------------------------
// Tab: Dependency Tree (schematic SVG)
// ---------------------------------------------------------------------
async function loadTree(name) {
  const loading = $('#tree-loading');
  const empty = $('#tree-empty');
  const svg = $('#tree-svg');
  loading.hidden = false;
  empty.hidden = true;
  svg.innerHTML = '';

  try {
    const res = await fetch(`/api/package/${encodeURIComponent(name)}/tree`);
    if (!res.ok) throw new Error((await res.json()).message);
    const rows = await res.json();
    loading.hidden = true;

    // Also fetch which packages in the tree have vulnerabilities, so we
    // can flag nodes on the schematic itself.
    let vulnPackages = new Set();
    try {
      const vres = await fetch(`/api/package/${encodeURIComponent(name)}/vulnerabilities`);
      if (vres.ok) {
        const vrows = await vres.json();
        vulnPackages = new Set(vrows.map((r) => r.packageName));
      }
    } catch (_) { /* best-effort */ }

    if (rows.length === 0) {
      empty.hidden = false;
      renderSchematic(svg, name, [], vulnPackages);
      return;
    }
    renderSchematic(svg, name, rows, vulnPackages);
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    $('#tree-empty').textContent = 'Could not load dependency tree: ' + err.message;
  }
}

function renderSchematic(svg, rootName, rows, vulnPackages) {
  // Group unique (name, depth) pairs by depth, dedup across multiple paths.
  const byDepth = new Map(); // depth -> Set(name)
  byDepth.set(0, new Set([rootName]));

  const edges = []; // {fromName, toName}
  const seenNode = new Map(); // name -> {depth, license, version}

  seenNode.set(rootName, { depth: 0 });

  for (const row of rows) {
    const chain = row.chain; // array of names from root to dep
    for (let i = 0; i < chain.length - 1; i++) {
      edges.push({ from: chain[i], to: chain[i + 1] });
    }
    const depth = row.depth;
    if (!byDepth.has(depth)) byDepth.set(depth, new Set());
    byDepth.get(depth).add(row.depName);
    if (!seenNode.has(row.depName) || seenNode.get(row.depName).depth > depth) {
      seenNode.set(row.depName, { depth, license: row.depLicense, version: row.depVersion });
    }
  }

  // Dedup edges
  const edgeKey = (e) => `${e.from}=>${e.to}`;
  const uniqueEdges = Array.from(new Map(edges.map((e) => [edgeKey(e), e])).values());

  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  const colWidth = 190;
  const rowHeight = 54;
  const nodeW = 156;
  const nodeH = 38;
  const padTop = 24;
  const padLeft = 24;

  const positions = new Map(); // name -> {x, y, cx, cyLeft, cyRight}

  let maxRows = 1;
  depths.forEach((d) => {
    const names = Array.from(byDepth.get(d)).sort();
    maxRows = Math.max(maxRows, names.length);
    names.forEach((name, i) => {
      const x = padLeft + d * colWidth;
      const y = padTop + i * rowHeight;
      positions.set(name, { x, y, w: nodeW, h: nodeH });
    });
  });

  const width = padLeft * 2 + depths.length * colWidth;
  const height = padTop * 2 + maxRows * rowHeight;
  svg.setAttribute('viewBox', `0 0 ${Math.max(width, 640)} ${Math.max(height, 200)}`);

  const ns = 'http://www.w3.org/2000/svg';
  const edgeLayer = document.createElementNS(ns, 'g');
  const nodeLayer = document.createElementNS(ns, 'g');

  // Draw edges as orthogonal connector paths
  uniqueEdges.forEach((e) => {
    const from = positions.get(e.from);
    const to = positions.get(e.to);
    if (!from || !to) return;
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const midX = (x1 + x2) / 2;
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('class', 'edge-path');
    path.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
    edgeLayer.appendChild(path);
  });

  // Draw nodes
  positions.forEach((pos, name) => {
    const info = seenNode.get(name) || {};
    const isRoot = name === rootName;
    const hasVuln = vulnPackages.has(name);

    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', `node-chip${isRoot ? ' root' : ''}${hasVuln ? ' has-vuln' : ''}`);
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    g.style.cursor = 'pointer';

    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('width', pos.w);
    rect.setAttribute('height', pos.h);
    rect.setAttribute('rx', 6);
    g.appendChild(rect);

    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', 10);
    label.setAttribute('y', 16);
    label.setAttribute('font-size', '12');
    label.textContent = name.length > 20 ? name.slice(0, 19) + '…' : name;
    g.appendChild(label);

    const sub = document.createElementNS(ns, 'text');
    sub.setAttribute('class', 'node-sub');
    sub.setAttribute('x', 10);
    sub.setAttribute('y', 29);
    sub.textContent = isRoot ? 'root' : (info.license || '');
    g.appendChild(sub);

    if (hasVuln) {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', pos.w - 10);
      dot.setAttribute('cy', 10);
      dot.setAttribute('r', 4);
      dot.setAttribute('fill', 'var(--sev-high)');
      g.appendChild(dot);
    }

    g.addEventListener('click', () => loadPackage(name));
    nodeLayer.appendChild(g);
  });

  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);
}

// ---------------------------------------------------------------------
// Tab: Vulnerabilities
// ---------------------------------------------------------------------
async function loadVulns(name) {
  const loading = $('#vulns-loading');
  const empty = $('#vulns-empty');
  const table = $('#vulns-table');
  const tbody = $('tbody', table);
  loading.hidden = false;
  empty.hidden = true;
  table.hidden = true;
  tbody.innerHTML = '';

  try {
    const res = await fetch(`/api/package/${encodeURIComponent(name)}/vulnerabilities`);
    if (!res.ok) throw new Error((await res.json()).message);
    const rows = await res.json();
    loading.hidden = true;

    updateVulnBadge(rows);

    if (rows.length === 0) {
      empty.hidden = false;
      return;
    }
    table.hidden = false;
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="sev-pill sev-${r.severity}">${r.severity}</span></td>
        <td><code>${escapeHtml(r.cveId)}</code></td>
        <td>${escapeHtml(r.packageName)} <span style="color:var(--ink-faint)">v${escapeHtml(r.packageVersion || '')}</span></td>
        <td>${r.depth} hop${r.depth === 1 ? '' : 's'}</td>
        <td>${escapeHtml(r.fixedIn || '—')}</td>
        <td>${escapeHtml(r.description || '')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    empty.textContent = 'Could not load vulnerability data: ' + err.message;
  }
}

function updateVulnBadge(rows) {
  const badges = $('#pkg-badges');
  const existing = $('.badge-vuln-summary', badges);
  if (existing) existing.remove();

  const span = document.createElement('span');
  const critical = rows.filter((r) => r.severity === 'CRITICAL').length;
  const high = rows.filter((r) => r.severity === 'HIGH').length;

  if (rows.length === 0) {
    span.className = 'badge badge-ok badge-vuln-summary';
    span.textContent = 'no known CVEs';
  } else if (critical > 0) {
    span.className = 'badge badge-critical badge-vuln-summary';
    span.textContent = `${critical} critical CVE${critical === 1 ? '' : 's'} in tree`;
  } else if (high > 0) {
    span.className = 'badge badge-warn badge-vuln-summary';
    span.textContent = `${high} high-severity CVE${high === 1 ? '' : 's'} in tree`;
  } else {
    span.className = 'badge badge-neutral badge-vuln-summary';
    span.textContent = `${rows.length} CVE${rows.length === 1 ? '' : 's'} in tree`;
  }
  badges.appendChild(span);
}

// ---------------------------------------------------------------------
// Tab: Maintainer risk
// ---------------------------------------------------------------------
async function loadMaintainers(name) {
  const loading = $('#maintainers-loading');
  const content = $('#maintainers-content');
  loading.hidden = false;
  content.innerHTML = '';

  try {
    const res = await fetch(`/api/package/${encodeURIComponent(name)}/maintainers`);
    if (!res.ok) throw new Error((await res.json()).message);
    const data = await res.json();
    loading.hidden = true;

    const summaryHtml = data.summary.maintainers.length
      ? `<h3 style="font-size:14px;color:var(--ink-dim);margin:0 0 12px;">Maintainers of <code>${escapeHtml(name)}</code></h3>` +
        data.summary.maintainers.map((m) => `
          <div class="maintainer-card ${m.totalPackagesMaintained >= 3 ? 'risk' : ''}">
            <div>
              <div class="maintainer-name">${escapeHtml(m.name)}</div>
              <div class="maintainer-sub">@${escapeHtml(m.npmUsername)}</div>
            </div>
            <div>
              <div class="maintainer-count">${m.totalPackagesMaintained}</div>
              <div class="maintainer-count-label">packages maintained</div>
            </div>
          </div>
        `).join('')
      : `<p class="empty-row">No maintainer records for this package.</p>`;

    const sharedHtml = data.sharedRisk.length
      ? `<h3 style="font-size:14px;color:var(--ink-dim);margin:24px 0 12px;">Co-maintained packages (shared bus-factor risk)</h3>` +
        data.sharedRisk.map((s) => `
          <div class="maintainer-card ${s.packageCount >= 3 ? 'risk' : ''}">
            <div>
              <div class="maintainer-name">${escapeHtml(s.maintainer)}</div>
              <div class="maintainer-sub">also maintains: ${s.coMaintained.map(escapeHtml).join(', ')}</div>
            </div>
            <div>
              <div class="maintainer-count">${s.packageCount}</div>
              <div class="maintainer-count-label">shared packages</div>
            </div>
          </div>
        `).join('')
      : '';

    content.innerHTML = summaryHtml + sharedHtml;
  } catch (err) {
    loading.hidden = true;
    content.innerHTML = `<p class="empty-row">Could not load maintainer data: ${escapeHtml(err.message)}</p>`;
  }
}

// ---------------------------------------------------------------------
// Tab: License conflicts
// ---------------------------------------------------------------------
async function loadLicenseConflicts(name) {
  const loading = $('#license-loading');
  const empty = $('#license-empty');
  const content = $('#license-content');
  loading.hidden = false;
  empty.hidden = true;
  content.innerHTML = '';

  try {
    const res = await fetch(`/api/package/${encodeURIComponent(name)}/license-conflicts`);
    if (!res.ok) throw new Error((await res.json()).message);
    const rows = await res.json();
    loading.hidden = true;

    if (rows.length === 0) {
      empty.hidden = false;
      return;
    }
    content.innerHTML = rows.map((r) => `
      <div class="license-row">
        <div>
          <div class="maintainer-name">${escapeHtml(r.packageName)} <span class="sev-pill sev-HIGH">${escapeHtml(r.license)}</span></div>
          <div class="license-chain">${r.chain.map(escapeHtml).join(' → ')}</div>
        </div>
        <div class="maintainer-count-label">${r.depth} hop${r.depth === 1 ? '' : 's'} deep</div>
      </div>
    `).join('');
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    empty.textContent = 'Could not check license chain: ' + err.message;
  }
}

// ---------------------------------------------------------------------
// Tab: Path finder
// ---------------------------------------------------------------------
$('#path-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const from = state.currentPackage;
  const to = $('#path-to-input').value.trim();
  const resultEl = $('#path-result');
  if (!from || !to) return;

  resultEl.innerHTML = '<p class="loading-row">searching…</p>';
  try {
    const res = await fetch(`/api/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (!res.ok) throw new Error((await res.json()).message);
    const data = await res.json();
    if (!data.chain) {
      resultEl.innerHTML = `<p class="empty-row">${escapeHtml(data.message || 'No dependency path found.')}</p>`;
      return;
    }
    resultEl.innerHTML = `<div class="path-chain">${data.chain
      .map((n, i) => `<span class="node">${escapeHtml(n)}</span>${i < data.chain.length - 1 ? '<span class="arrow">→</span>' : ''}`)
      .join('')}</div><p style="color:var(--ink-faint);font-size:12px;margin-top:10px;">${data.hops} hop${data.hops === 1 ? '' : 's'}</p>`;
  } catch (err) {
    resultEl.innerHTML = `<p class="empty-row">${escapeHtml(err.message)}</p>`;
  }
});

// ---------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

$('#retry-connection').addEventListener('click', async () => {
  const ok = await checkHealth();
  if (ok) {
    hideDbError();
    $('#landing').hidden = false;
    loadStats();
    loadSamples();
  }
});

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
(async function init() {
  const ok = await checkHealth();
  if (ok) {
    loadStats();
    loadSamples();
  }
})();
