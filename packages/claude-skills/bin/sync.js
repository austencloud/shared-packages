#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync, rmdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatesDir = resolve(__dirname, '..', 'templates');

const MANAGED_MARKER = '<!-- managed by @austencloud/claude-skills — do not edit manually, run: npx @austencloud/claude-skills sync -->';

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

function syncCommand(cwd) {
  const config = readConfig(cwd);
  const variables = { ...config };
  delete variables.skills;

  const claudeDir = join(cwd, '.claude');
  let written = 0;

  // Render skills
  for (const skillName of config.skills) {
    const templatePath = join(templatesDir, 'skills', skillName, 'SKILL.md');
    if (!existsSync(templatePath)) {
      console.error(`  ✗ Template not found: skills/${skillName}/SKILL.md`);
      continue;
    }
    const template = readFileSync(templatePath, 'utf-8');
    const rendered = MANAGED_MARKER + '\n\n' + renderTemplate(template, variables);
    const outDir = join(claudeDir, 'skills', skillName);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'SKILL.md'), rendered, 'utf-8');
    console.log(`  \u2713 skills/${skillName}/SKILL.md`);
    written++;
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
      const rendered = MANAGED_MARKER + '\n\n' + renderTemplate(template, variables);
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
      if (content.includes('managed by @austencloud/claude-skills')) {
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
