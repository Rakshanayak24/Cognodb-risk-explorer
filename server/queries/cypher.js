// server/queries/cypher.js
//
// Every query the application runs, in one place, so they're easy to read,
// review and reuse. All queries are parameterised — nothing here ever
// string-concatenates user input into Cypher.

module.exports = {
  // ---------------------------------------------------------------------
  // Search: used by the search box. Simple, single-hop, case-insensitive.
  // ---------------------------------------------------------------------
  SEARCH_PACKAGES: `
    MATCH (p:Package)
    WHERE toLower(p.name) CONTAINS toLower($term)
    RETURN p.name AS name, p.version AS version, p.ecosystem AS ecosystem,
           p.license AS license, p.description AS description
    ORDER BY p.name
    LIMIT 25
  `,

  // ---------------------------------------------------------------------
  // 1) MULTI-HOP TRAVERSAL (variable-length path)
  // Full transitive dependency tree of a package, up to 5 levels deep.
  // In SQL this is a recursive CTE with manual cycle-guarding; here it's
  // one line of Cypher because traversal depth is native to the model.
  // ---------------------------------------------------------------------
  DEPENDENCY_TREE: `
    MATCH path = (root:Package {name: $name})-[:DEPENDS_ON*1..5]->(dep:Package)
    WITH root, path, dep, length(path) AS depth
    RETURN root.name AS rootName,
           [n IN nodes(path) | n.name] AS chain,
           dep.name AS depName,
           dep.version AS depVersion,
           dep.license AS depLicense,
           depth
    ORDER BY depth, depName
  `,

  // ---------------------------------------------------------------------
  // 2) QUERY THAT'S AWKWARD IN A RELATIONAL DATABASE
  // Transitive vulnerability exposure: every CVE reachable anywhere in a
  // package's dependency tree, with the shortest path length at which it
  // is introduced and the chain of packages that pulls it in. A relational
  // schema needs a recursive CTE per depth plus a join fan-out to the
  // vulnerability table, and it degrades badly on graphs with cycles or
  // diamond dependencies (the same vulnerable package reachable via
  // multiple paths) — Cypher's shortestPath + variable-length match
  // handles both natively.
  // ---------------------------------------------------------------------
  // NOTE: previously used [p = shortestPath(...) | length(p)][0] — that
  // "path-variable pattern comprehension" is Neo4j-proprietary, not
  // standard openCypher, and CognoDB's parser rejects it (syntax error at
  // the "|"). Rewritten to MATCH the shortest path as its own clause, which
  // is standard Cypher and portable across engines.
  TRANSITIVE_VULNERABILITIES: `
    MATCH (root:Package {name: $name})
    MATCH (root)-[:DEPENDS_ON*0..5]->(dep:Package)-[:AFFECTED_BY]->(v:Vulnerability)
    WITH DISTINCT root, dep, v
    MATCH sp = shortestPath((root)-[:DEPENDS_ON*0..5]->(dep))
    WITH dep, v, length(sp) AS depth
    RETURN dep.name AS packageName,
           dep.version AS packageVersion,
           v.cveId AS cveId,
           v.severity AS severity,
           v.description AS description,
           v.fixedIn AS fixedIn,
           depth
    ORDER BY
      CASE v.severity
        WHEN 'CRITICAL' THEN 0
        WHEN 'HIGH' THEN 1
        WHEN 'MEDIUM' THEN 2
        ELSE 3
      END,
      depth
  `,

  // ---------------------------------------------------------------------
  // 3) Shared-maintainer / "bus factor" risk.
  // Packages that share at least one maintainer with the target package —
  // a 2-hop Package -> Maintainer -> Package pattern. Useful for spotting
  // single-point-of-failure clusters (one person maintaining many things
  // you depend on).
  // ---------------------------------------------------------------------
  SHARED_MAINTAINER_RISK: `
    MATCH (target:Package {name: $name})<-[:MAINTAINS]-(m:Maintainer)-[:MAINTAINS]->(other:Package)
    WHERE other.name <> target.name
    WITH m, collect(DISTINCT other.name) AS coMaintained
    RETURN m.name AS maintainer,
           m.npmUsername AS npmUsername,
           size(coMaintained) AS packageCount,
           coMaintained
    ORDER BY packageCount DESC
  `,

  // Bus-factor for the package itself: how many maintainers does it have,
  // and how many of *those* maintainers are single points of failure
  // (they maintain 3+ packages your tree depends on)?
  MAINTAINER_SUMMARY: `
    MATCH (p:Package {name: $name})<-[:MAINTAINS]-(m:Maintainer)
    OPTIONAL MATCH (m)-[:MAINTAINS]->(other:Package)
    WITH p, m, count(DISTINCT other) AS totalPackagesMaintained
    RETURN p.name AS packageName,
           collect({name: m.name, npmUsername: m.npmUsername, totalPackagesMaintained: totalPackagesMaintained}) AS maintainers,
           count(m) AS maintainerCount
  `,

  // ---------------------------------------------------------------------
  // 4) Shortest dependency path between two arbitrary packages.
  // ---------------------------------------------------------------------
  SHORTEST_PATH_BETWEEN: `
    MATCH (a:Package {name: $from}), (b:Package {name: $to})
    MATCH p = shortestPath((a)-[:DEPENDS_ON*1..8]->(b))
    RETURN [n IN nodes(p) | n.name] AS chain, length(p) AS hops
  `,

  // ---------------------------------------------------------------------
  // 5) License conflict detection along the dependency chain.
  // Flags transitive dependencies whose license is in a known-incompatible
  // set relative to the root package's license (e.g. a permissive-licensed
  // root pulling in a copyleft dependency several hops down).
  // ---------------------------------------------------------------------
  // Same fix as TRANSITIVE_VULNERABILITIES above — MATCH the shortest path
  // as its own clause instead of the non-portable [p = shortestPath(...) | ...]
  // pattern comprehension.
  LICENSE_CONFLICTS: `
    MATCH (root:Package {name: $name})
    MATCH (root)-[:DEPENDS_ON*1..5]->(dep:Package)
    WHERE dep.license IN $conflictingLicenses
    WITH DISTINCT root, dep
    MATCH sp = shortestPath((root)-[:DEPENDS_ON*1..5]->(dep))
    WITH dep, [n IN nodes(sp) | n.name] AS chain
    RETURN dep.name AS packageName,
           dep.license AS license,
           chain,
           size(chain) - 1 AS depth
    ORDER BY depth
  `,

  // ---------------------------------------------------------------------
  // Overview stats for the landing page / empty state.
  // ---------------------------------------------------------------------
  GRAPH_STATS: `
    MATCH (p:Package) WITH count(p) AS packages
    MATCH (m:Maintainer) WITH packages, count(m) AS maintainers
    MATCH (v:Vulnerability) WITH packages, maintainers, count(v) AS vulnerabilities
    MATCH ()-[d:DEPENDS_ON]->() WITH packages, maintainers, vulnerabilities, count(d) AS edges
    RETURN packages, maintainers, vulnerabilities, edges
  `,

  // A handful of packages to seed the UI's "try one of these" suggestions.
  // NOTE: previously used size((p)-[:DEPENDS_ON*1..3]->()) — that bare
  // pattern-as-expression form is deprecated/rejected on newer Cypher
  // engines (replaced by COUNT{...}). OPTIONAL MATCH + count(DISTINCT ...)
  // is the portable equivalent and works the same everywhere.
  SAMPLE_PACKAGES: `
    MATCH (p:Package)
    OPTIONAL MATCH (p)-[:DEPENDS_ON*1..3]->(reachable)
    WITH p, count(DISTINCT reachable) AS reach
    RETURN p.name AS name, p.description AS description, reach
    ORDER BY reach DESC
    LIMIT 6
  `,
};