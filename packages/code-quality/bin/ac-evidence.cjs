#!/usr/bin/env node

/**
 * Deterministic Evidence Collector for Audit Pipeline
 *
 * Scans source files using fs + RegExp (no LLM) and produces structured JSON
 * with per-dimension findings. Each finding includes file, line, and preview.
 *
 * Configuration:
 *   Place a .claude/skills.config.json in your project root with:
 *   { "srcFeatures": "src/lib/features", "srcShared": "src/lib/shared" }
 *
 *   Or pass CLI flags: --src-features <path> --src-shared <path>
 *   Falls back to src/lib if no config exists.
 *
 * Usage:
 *   ac-evidence <scope> [--out <path>]
 *
 * Examples:
 *   ac-evidence "features/compose"
 *   ac-evidence "features/compose" --out .audit-evidence.json
 *   ac-evidence "shared/pictograph" --out evidence.json
 *
 * Output: JSON to stdout (or file if --out specified) with per-dimension findings.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Path configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();

/**
 * Load path configuration from .claude/skills.config.json or CLI flags
 */
function loadConfig() {
  const args = process.argv.slice(2);

  // CLI flag overrides
  const srcFeaturesIdx = args.indexOf("--src-features");
  const srcSharedIdx = args.indexOf("--src-shared");
  const cliFeaturesPath = srcFeaturesIdx !== -1 ? args[srcFeaturesIdx + 1] : null;
  const cliSharedPath = srcSharedIdx !== -1 ? args[srcSharedIdx + 1] : null;

  // Try .claude/skills.config.json
  let configFeatures = null;
  let configShared = null;
  const configPath = path.join(PROJECT_ROOT, ".claude", "skills.config.json");
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      configFeatures = config.srcFeatures || null;
      configShared = config.srcShared || null;
    }
  } catch {
    // Config not readable, use defaults
  }

  // Priority: CLI flags > config file > defaults
  const featuresRel = cliFeaturesPath || configFeatures || "src/lib";
  const sharedRel = cliSharedPath || configShared || "src/lib";

  return {
    srcRoot: path.isAbsolute(featuresRel)
      ? path.dirname(featuresRel)
      : path.join(PROJECT_ROOT, path.dirname(featuresRel)),
    featuresDir: path.isAbsolute(featuresRel)
      ? featuresRel
      : path.join(PROJECT_ROOT, featuresRel),
    sharedDir: path.isAbsolute(sharedRel)
      ? sharedRel
      : path.join(PROJECT_ROOT, sharedRel),
  };
}

const config = loadConfig();

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const allArgs = process.argv.slice(2);

// Filter out config flags to get clean args
function getCleanArgs() {
  const clean = [];
  for (let i = 0; i < allArgs.length; i++) {
    if (allArgs[i] === "--src-features" || allArgs[i] === "--src-shared") {
      i++; // skip the value too
      continue;
    }
    clean.push(allArgs[i]);
  }
  return clean;
}

const cleanArgs = getCleanArgs();
const scope = cleanArgs.find((a) => !a.startsWith("--"));
const outIdx = cleanArgs.indexOf("--out");
const outPath = outIdx !== -1 ? cleanArgs[outIdx + 1] : null;

if (!scope) {
  console.error("Usage: ac-evidence <scope> [--out <path>]");
  console.error('Example: ac-evidence "features/compose"');
  process.exit(1);
}

// The scope is relative — resolve it against the srcRoot (parent of features/shared dirs)
// Try features dir first, then shared dir, then src root
function resolveScopeDir() {
  // Try as relative to the features parent (e.g., "features/compose" -> srcRoot/../features/compose)
  // The scope itself specifies "features/X" or "shared/X", so we resolve from the parent of those dirs
  const srcRoot = config.srcRoot;
  const candidate1 = path.join(srcRoot, scope);
  if (fs.existsSync(candidate1)) return { dir: candidate1, root: srcRoot };

  // Try directly from PROJECT_ROOT
  const candidate2 = path.join(PROJECT_ROOT, scope);
  if (fs.existsSync(candidate2)) return { dir: candidate2, root: PROJECT_ROOT };

  // Try from PROJECT_ROOT/src/lib (common SvelteKit layout)
  const candidate3 = path.join(PROJECT_ROOT, "src", "lib", scope);
  if (fs.existsSync(candidate3)) return { dir: candidate3, root: path.join(PROJECT_ROOT, "src", "lib") };

  return null;
}

const resolved = resolveScopeDir();
if (!resolved) {
  console.error(`Scope directory not found: ${scope}`);
  console.error(`Looked in:`);
  console.error(`  - ${path.join(config.srcRoot, scope)}`);
  console.error(`  - ${path.join(PROJECT_ROOT, scope)}`);
  console.error(`  - ${path.join(PROJECT_ROOT, "src", "lib", scope)}`);
  process.exit(1);
}

const scopeDir = resolved.dir;
const SRC_ROOT = resolved.root;

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function collectFiles(dir, extensions) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules" || entry.name === ".svelte-kit") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(full, extensions));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch {
    // directory not accessible
  }
  return results;
}

const allFiles = collectFiles(scopeDir, [".svelte", ".ts"]);
const svelteFiles = allFiles.filter((f) => f.endsWith(".svelte"));
const tsFiles = allFiles.filter((f) => f.endsWith(".ts"));
const cssFiles = collectFiles(scopeDir, [".css"]);
const allWithCss = [...allFiles, ...cssFiles];
const svelteAndCss = [...svelteFiles, ...cssFiles];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return path relative to SRC_ROOT for display */
function rel(absPath) {
  return path.relative(SRC_ROOT, absPath).replace(/\\/g, "/");
}

/** Scan a file's lines against a regex, returning findings */
function scanFile(filePath, regex, { skipInComment = false } = {}) {
  const findings = [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (skipInComment && /^\s*\/\//.test(line)) continue;
      if (regex.test(line)) {
        findings.push({
          file: rel(filePath),
          line: i + 1,
          preview: line.trim().substring(0, 120),
        });
      }
      // Reset lastIndex for global regexes
      regex.lastIndex = 0;
    }
  } catch {
    // file not readable
  }
  return findings;
}

/** Scan all files in a list against a regex */
function scanAll(files, regex, options) {
  const results = [];
  for (const f of files) {
    results.push(...scanFile(f, regex, options));
  }
  return results;
}

/** Check if a file contains a pattern (boolean) */
function fileContains(filePath, regex) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return regex.test(content);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dimension: Architecture
// ---------------------------------------------------------------------------

function collectArchitecture() {
  const findings = {};

  // Barrel imports: from './index' or from '.' or from '../something/index'
  findings.barrelImports = scanAll(
    allFiles,
    /from\s+['"][^'"]*\/index['"]/
  );

  // "Service" suffix in class names
  findings.serviceSuffix = scanAll(
    tsFiles,
    /class\s+\w+Service\s/
  );

  // utils/ or hooks/ directories
  findings.utilsOrHooks = [];
  for (const f of allFiles) {
    const relPath = rel(f);
    if (/\/(utils|hooks)\//.test(relPath)) {
      findings.utilsOrHooks.push({
        file: relPath,
        line: 0,
        preview: `File in ${relPath.includes("/utils/") ? "utils" : "hooks"} directory`,
      });
    }
  }

  // Missing DI: classes not registered in containers
  findings.potentialDiGaps = [];

  // Try to find DI container files (project-specific path)
  const containersDir = path.join(SRC_ROOT, "shared", "di", "containers");
  let containerContents = "";
  try {
    const containerFiles = fs.readdirSync(containersDir).filter((f) => f.endsWith(".ts"));
    containerContents = containerFiles
      .map((f) => fs.readFileSync(path.join(containersDir, f), "utf-8"))
      .join("\n");
  } catch {
    // containers dir not found
  }

  for (const f of tsFiles) {
    const relPath = rel(f);
    if (relPath.includes("/contracts/")) continue;
    if (relPath.includes("/implementations/")) {
      try {
        const content = fs.readFileSync(f, "utf-8");
        const classMatch = content.match(/export\s+class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          if (containerContents && containerContents.includes(className)) continue;
          findings.potentialDiGaps.push({
            file: relPath,
            line: 0,
            preview: `Class "${className}" in implementations/ - verify DI registration`,
          });
        }
      } catch {
        // skip
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: Code Quality
// ---------------------------------------------------------------------------

function collectCodeQuality() {
  const findings = {};

  findings.anyType = scanAll(allFiles, /:\s*any\b/, { skipInComment: true });
  findings.asAny = scanAll(allFiles, /as\s+any\b/, { skipInComment: true });
  findings.asUnknownAs = scanAll(allFiles, /as\s+unknown\s+as\b/, { skipInComment: true });

  findings.missingReturnType = scanAll(
    tsFiles,
    /export\s+(async\s+)?function\s+\w+\([^)]*\)\s*\{/,
    { skipInComment: true }
  );

  findings.serviceNaming = scanAll(
    allFiles,
    /import.*Service['";\s}]/,
    { skipInComment: true }
  );

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: Svelte 5 Compliance
// ---------------------------------------------------------------------------

function collectSvelte5() {
  const findings = {};

  findings.storeImports = scanAll(
    allFiles,
    /from\s+['"]svelte\/store['"]/
  );

  findings.writableReadable = scanAll(
    allFiles,
    /\b(writable|readable)\s*\(/
  );

  findings.dollarColon = scanAll(
    svelteFiles,
    /^\s*\$:\s/
  );

  findings.exportLet = scanAll(
    svelteFiles,
    /^\s*export\s+let\s/
  );

  findings.createEventDispatcher = scanAll(
    svelteFiles,
    /createEventDispatcher/
  );

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: Accessibility
// ---------------------------------------------------------------------------

function collectAccessibility() {
  const findings = {};

  // No external audit scripts — these are project-specific
  findings.reducedMotion = [];

  // Font sizes below 12px in CSS
  findings.smallFontSize = scanAll(
    svelteAndCss,
    /font-size\s*:\s*(([0-9]|1[01])(\.\d+)?px|0\.\d+rem)/
  );

  // {@html} usage (potential XSS + a11y risk)
  findings.htmlDirective = scanAll(svelteFiles, /\{@html\b/);

  // div/span with onclick but no role
  findings.clickWithoutRole = [];
  for (const f of svelteFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/on:click|onclick/.test(line) && /<(div|span)\b/.test(line) && !/role=/.test(line)) {
          findings.clickWithoutRole.push({
            file: rel(f),
            line: i + 1,
            preview: line.trim().substring(0, 120),
          });
        }
      }
    } catch {
      // skip
    }
  }

  // Missing aria-label on interactive elements
  findings.missingAriaLabel = [];
  for (const f of svelteFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/<button\b/.test(line) && !/aria-label/.test(line) && !/>.*<\/button>/.test(line)) {
          let hasAriaOnNextLines = false;
          for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            if (/aria-label/.test(lines[j])) {
              hasAriaOnNextLines = true;
              break;
            }
            if (/^\s*\/?>$/.test(lines[j].trim())) break;
          }
          if (!hasAriaOnNextLines) {
            findings.missingAriaLabel.push({
              file: rel(f),
              line: i + 1,
              preview: line.trim().substring(0, 120),
            });
          }
        }
      }
    } catch {
      // skip
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: UX States
// ---------------------------------------------------------------------------

function collectUxStates() {
  const findings = {};

  findings.hasLoadingState = false;
  findings.hasErrorState = false;
  findings.hasEmptyState = false;

  for (const f of svelteFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      if (/\{#if.*loading/i.test(content) || /isLoading|is_loading/i.test(content)) {
        findings.hasLoadingState = true;
      }
      if (/\{#if.*error/i.test(content) || /isError|hasError/i.test(content)) {
        findings.hasErrorState = true;
      }
      if (/\{#if.*empty/i.test(content) || /\.length\s*===?\s*0/i.test(content) || /no\s*(items|results|data)/i.test(content)) {
        findings.hasEmptyState = true;
      }
    } catch {
      // skip
    }
  }

  findings.bareCatch = scanAll(
    allFiles,
    /catch\s*\([^)]*\)\s*\{\s*\}/
  );

  const bareCatchArrow = scanAll(
    allFiles,
    /\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/
  );
  findings.bareCatch.push(...bareCatchArrow);

  findings.consoleErrorOnly = scanAll(
    allFiles,
    /console\.error\(/,
    { skipInComment: true }
  );

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: UI Consistency
// ---------------------------------------------------------------------------

function collectUiConsistency() {
  const findings = {};

  // No external audit scripts — these are project-specific
  findings.hardcodedDurations = { count: 0, files: [] };

  // Hardcoded colors: #hex or rgba() not inside var()
  findings.hardcodedColors = [];
  for (const f of svelteAndCss) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      let inStyle = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/<style/.test(line)) inStyle = true;
        if (/<\/style>/.test(line)) inStyle = false;

        if (!inStyle && !f.endsWith(".css")) continue;
        if (/^\s*\/[/*]/.test(line)) continue;
        if (/var\(/.test(line)) continue;
        if (/^\s*--[\w-]+\s*:/.test(line)) continue;

        if (/#[0-9a-fA-F]{3,8}\b/.test(line)) {
          findings.hardcodedColors.push({
            file: rel(f),
            line: i + 1,
            preview: line.trim().substring(0, 120),
          });
        }

        if (/rgba?\s*\(/.test(line)) {
          findings.hardcodedColors.push({
            file: rel(f),
            line: i + 1,
            preview: line.trim().substring(0, 120),
          });
        }
      }
    } catch {
      // skip
    }
  }

  // Blur on non-modal elements
  findings.blurOnContent = scanAll(
    svelteAndCss,
    /backdrop-filter\s*:\s*blur|filter\s*:\s*blur/
  );

  // Legacy --*-current CSS variables
  findings.legacyVars = scanAll(
    svelteAndCss,
    /var\(--[\w-]+-current/
  );

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: Performance
// ---------------------------------------------------------------------------

function collectPerformance() {
  const findings = {};

  // No external audit scripts — these are project-specific
  findings.directTransitionImports = { count: 0, files: [] };

  // Barrel imports (also in architecture, but perf-relevant)
  findings.barrelImports = scanAll(
    allFiles,
    /from\s+['"][^'"]*\/index['"]/
  );

  // $effect without cleanup return
  findings.effectWithoutCleanup = [];
  for (const f of allFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      let inEffect = false;
      let effectStart = 0;
      let braceDepth = 0;
      let hasReturn = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/\$effect\s*\(/.test(line)) {
          inEffect = true;
          effectStart = i;
          braceDepth = 0;
          hasReturn = false;
        }

        if (inEffect) {
          braceDepth += (line.match(/\{/g) || []).length;
          braceDepth -= (line.match(/\}/g) || []).length;
          if (/return\s/.test(line)) hasReturn = true;

          if (braceDepth <= 0 && i > effectStart) {
            const effectBlock = lines.slice(effectStart, i + 1).join("\n");
            const needsCleanup =
              /addEventListener|setInterval|setTimeout|subscribe/.test(effectBlock);
            if (needsCleanup && !hasReturn) {
              findings.effectWithoutCleanup.push({
                file: rel(f),
                line: effectStart + 1,
                preview: lines[effectStart].trim().substring(0, 120),
              });
            }
            inEffect = false;
          }
        }
      }
    } catch {
      // skip
    }
  }

  // setInterval/setTimeout without cleanup in .svelte files
  findings.timerWithoutCleanup = scanAll(
    svelteFiles,
    /\b(setInterval|setTimeout)\s*\(/,
    { skipInComment: true }
  );

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: Security
// ---------------------------------------------------------------------------

function collectSecurity() {
  const findings = {};

  // {@html} with 3-line context
  findings.htmlDirective = [];
  for (const f of svelteFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/\{@html\b/.test(lines[i])) {
          const contextStart = Math.max(0, i - 1);
          const contextEnd = Math.min(lines.length - 1, i + 1);
          const context = lines
            .slice(contextStart, contextEnd + 1)
            .map((l) => l.trim())
            .join(" | ");
          findings.htmlDirective.push({
            file: rel(f),
            line: i + 1,
            preview: context.substring(0, 200),
          });
        }
      }
    } catch {
      // skip
    }
  }

  // eval() or new Function()
  findings.evalUsage = scanAll(allFiles, /\beval\s*\(|new\s+Function\s*\(/);

  // Hardcoded secret patterns
  findings.hardcodedSecrets = scanAll(
    allFiles,
    /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}/i,
    { skipInComment: true }
  );

  // innerHTML assignment
  findings.innerHTML = scanAll(allFiles, /\.innerHTML\s*=/);

  return findings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const startTime = Date.now();

  const evidence = {
    meta: {
      scope,
      scopePath: path.relative(PROJECT_ROOT, scopeDir).replace(/\\/g, "/"),
      collectedAt: new Date().toISOString(),
      fileCount: {
        total: allFiles.length,
        svelte: svelteFiles.length,
        ts: tsFiles.length,
        css: cssFiles.length,
      },
    },
    dimensions: {
      architecture: collectArchitecture(),
      codeQuality: collectCodeQuality(),
      svelte5: collectSvelte5(),
      accessibility: collectAccessibility(),
      uxStates: collectUxStates(),
      uiConsistency: collectUiConsistency(),
      performance: collectPerformance(),
      security: collectSecurity(),
    },
  };

  // Add summary counts per dimension
  evidence.summary = {};
  for (const [dim, data] of Object.entries(evidence.dimensions)) {
    const counts = {};
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        counts[key] = value.length;
      } else if (typeof value === "object" && value !== null && "count" in value) {
        counts[key] = value.count;
      } else if (typeof value === "boolean") {
        counts[key] = value;
      }
    }
    evidence.summary[dim] = counts;
  }

  evidence.meta.durationMs = Date.now() - startTime;

  const json = JSON.stringify(evidence, null, 2);

  if (outPath) {
    const resolvedOut = path.isAbsolute(outPath)
      ? outPath
      : path.join(PROJECT_ROOT, outPath);
    fs.writeFileSync(resolvedOut, json);
    console.log(`Evidence written to ${resolvedOut}`);
    console.log(`Scope: ${scope} (${allFiles.length} files scanned in ${evidence.meta.durationMs}ms)`);

    // Print quick summary
    console.log("\nQuick Summary:");
    for (const [dim, counts] of Object.entries(evidence.summary)) {
      const total = Object.values(counts).reduce((sum, v) => {
        if (typeof v === "number") return sum + v;
        return sum;
      }, 0);
      console.log(`  ${dim}: ${total} finding(s)`);
    }
  } else {
    process.stdout.write(json);
  }
}

main();
