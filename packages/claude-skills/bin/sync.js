#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync, rmdirSync, existsSync, copyFileSync } from 'fs';
import { join, dirname, resolve, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatesDir = resolve(__dirname, '..', 'templates');

// The marker goes inside each SKILL.md and AGENT.md frontmatter as a YAML
// comment on line 2. Codex skips a SKILL.md whose first line is not `---`, and
// Claude Code shows a comment ahead of the frontmatter as the description.
const MANAGED_MARKER = '# managed by @austencloud/claude-skills - do not edit manually, run: npx @austencloud/claude-skills sync';
const FRONTMATTER = /^---(\r?\n)[\s\S]*?\r?\n---(?:\r?\n|$)/;

// Returns the rendered template with the marker as line 2, ending in the
// template's own line break, or null when the template does not open with a
// closed frontmatter block. Neither tool can read such a skill, so sync
// refuses it instead of writing it.
function markManaged(rendered) {
  const match = rendered.match(FRONTMATTER);
  if (!match) return null;
  const eol = match[1];
  return `---${eol}${MANAGED_MARKER}${eol}${rendered.slice(3 + eol.length)}`;
}

// Managed files carry the marker at the top: on line 2 inside the frontmatter,
// on line 1 of a helper script like ai_bust.py, or on line 1 as the HTML
// comment older syncs wrote. A file that only mentions it further down is
// hand-written.
function isManaged(content) {
  const [first = '', second = ''] = content.split(/\r?\n/, 2);
  const marked = (line) => /^(<!--|#) managed by @austencloud\/claude-skills\b/.test(line);
  return marked(first) || (first === '---' && marked(second));
}

const SKILL_TO_AGENTS = {
  audit: ['audit-evaluator', 'audit-fixer'],
};

function readConfig(cwd) {
  const configPath = join(cwd, '.claude', 'skills.config.json');
  if (!existsSync(configPath)) {
    console.error(`Error: ${configPath} not found.`);
    console.error('Create a .claude/skills.config.json with projectName and skills array.');
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  if (!config.projectName) {
    console.error('Error: skills.config.json missing required field "projectName".');
    process.exit(1);
  }
  if (!Array.isArray(config.skills)) {
    console.error('Error: skills.config.json missing required field "skills" (array).');
    process.exit(1);
  }
  return config;
}

function renderTemplate(templateContent, variables) {
  return templateContent.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
}

// Extensions rendered through the {{variable}} substitution. Anything else is
// copied byte for byte.
const RENDERABLE = new Set(['.md', '.py', '.sh', '.js', '.mjs', '.json', '.txt', '.toml', '.yml', '.yaml']);

// Copy every file in a skill template folder other than SKILL.md, preserving
// subdirectory structure, so helper scripts ship alongside the skill.
function syncSkillAssets(skillDir, outDir, variables) {
  let written = 0;
  for (const filePath of walkDir(skillDir)) {
    const rel = relative(skillDir, filePath).replace(/\\/g, '/');
    if (rel === 'SKILL.md' || rel.split('/').includes('__pycache__') || rel.endsWith('.pyc')) continue;
    const dest = join(outDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    if (RENDERABLE.has(extname(filePath).toLowerCase())) {
      writeFileSync(dest, renderTemplate(readFileSync(filePath, 'utf-8'), variables), 'utf-8');
    } else {
      copyFileSync(filePath, dest);
    }
    written++;
  }
  return written;
}

function syncCommand(cwd) {
  const config = readConfig(cwd);
  const variables = { ...config };
  delete variables.skills;

  const claudeDir = join(cwd, '.claude');
  let written = 0;

  // Render skills
  for (const skillName of config.skills) {
    const skillDir = join(templatesDir, 'skills', skillName);
    const templatePath = join(skillDir, 'SKILL.md');
    if (!existsSync(templatePath)) {
      console.error(`  ✗ Template not found: skills/${skillName}/SKILL.md`);
      continue;
    }
    const template = readFileSync(templatePath, 'utf-8');
    const rendered = markManaged(renderTemplate(template, variables));
    if (!rendered) {
      console.error(`  ✗ skills/${skillName}/SKILL.md needs YAML frontmatter (--- ... ---) starting on line 1`);
      process.exitCode = 1;
      continue;
    }
    const outDir = join(claudeDir, 'skills', skillName);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'SKILL.md'), rendered, 'utf-8');
    console.log(`  \u2713 skills/${skillName}/SKILL.md`);
    written++;
    const assets = syncSkillAssets(skillDir, outDir, variables);
    if (assets > 0) {
      console.log(`  \u2713 skills/${skillName}/ (${assets} asset file(s))`);
      written += assets;
    }
  }

  // Render agents mapped from skills
  for (const skillName of config.skills) {
    const agentNames = SKILL_TO_AGENTS[skillName];
    if (!agentNames) continue;
    for (const agentName of agentNames) {
      const templatePath = join(templatesDir, 'agents', agentName, 'AGENT.md');
      if (!existsSync(templatePath)) {
        console.error(`  \u2717 Template not found: agents/${agentName}/AGENT.md`);
        continue;
      }
      const template = readFileSync(templatePath, 'utf-8');
      const rendered = markManaged(renderTemplate(template, variables));
      if (!rendered) {
        console.error(`  ✗ agents/${agentName}/AGENT.md needs YAML frontmatter (--- ... ---) starting on line 1`);
        process.exitCode = 1;
        continue;
      }
      const outDir = join(claudeDir, 'agents', agentName);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'AGENT.md'), rendered, 'utf-8');
      console.log(`  \u2713 agents/${agentName}/AGENT.md`);
      written++;
    }
  }

  console.log(`\nSynced ${written} file(s).`);
}

function walkDir(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function tryRemoveEmptyDirs(dir, stopAt) {
  if (dir === stopAt || !existsSync(dir)) return;
  try {
    const entries = readdirSync(dir);
    if (entries.length === 0) {
      rmdirSync(dir);
      tryRemoveEmptyDirs(dirname(dir), stopAt);
    }
  } catch {
    // ignore
  }
}

function cleanCommand(cwd) {
  const claudeDir = join(cwd, '.claude');
  const dirsToScan = [join(claudeDir, 'skills'), join(claudeDir, 'agents')];
  let removed = 0;

  for (const scanDir of dirsToScan) {
    const files = walkDir(scanDir);
    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf-8');
      if (isManaged(content)) {
        unlinkSync(filePath);
        const relative = filePath.slice(claudeDir.length + 1).replace(/\\/g, '/');
        console.log(`  \u2717 removed ${relative}`);
        removed++;
        tryRemoveEmptyDirs(dirname(filePath), claudeDir);
      }
    }
  }

  console.log(`\nRemoved ${removed} managed file(s).`);
}

// Main
const args = process.argv.slice(2);
const command = args[0] || 'sync';
const cwd = process.cwd();

switch (command) {
  case 'sync':
    syncCommand(cwd);
    break;
  case 'clean':
    cleanCommand(cwd);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Usage: claude-skills [sync|clean]');
    process.exit(1);
}
