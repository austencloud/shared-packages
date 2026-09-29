// Runs bin/sync.js as a real subprocess against scratch folders: a consuming
// project, and when a test needs its own templates, a copy of the package.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const MARKER =
  '# managed by @austencloud/claude-skills - do not edit manually, run: npx @austencloud/claude-skills sync';
// What sync.js wrote on line 1, ahead of the frontmatter, before the marker moved inside it.
const LEGACY_MARKER =
  '<!-- managed by @austencloud/claude-skills — do not edit manually, run: npx @austencloud/claude-skills sync -->';

function scratchDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'claude-skills-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

// sync.js reads the templates folder next to its own bin/, so a copy of bin/
// renders the templates given here instead of the real ones.
function scratchPackage(t, templates) {
  const dir = scratchDir(t);
  cpSync(join(packageDir, 'bin'), join(dir, 'bin'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const [relPath, content] of Object.entries(templates)) {
    write(join(dir, 'templates', relPath), content);
  }
  return dir;
}

function scratchProject(t, config) {
  const dir = scratchDir(t);
  write(join(dir, '.claude', 'skills.config.json'), JSON.stringify(config));
  return dir;
}

function run(pkg, project, command) {
  return spawnSync(process.execPath, [join(pkg, 'bin', 'sync.js'), command], { cwd: project, encoding: 'utf8' });
}

const shippedSkills = readdirSync(join(packageDir, 'templates', 'skills'));

test('every shipped template renders with frontmatter on line 1 and the marker on line 2', (t) => {
  const project = scratchProject(t, { projectName: 'Probe', skills: shippedSkills });
  const result = run(packageDir, project, 'sync');
  assert.equal(result.status, 0, result.stderr);

  const agentsDir = join(project, '.claude', 'agents');
  const written = [
    ...shippedSkills.map((name) => join(project, '.claude', 'skills', name, 'SKILL.md')),
    ...readdirSync(agentsDir).map((name) => join(agentsDir, name, 'AGENT.md')),
  ];
  for (const path of written) {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    assert.equal(lines[0], '---', path);
    assert.equal(lines[1], MARKER, path);
  }
});

test('clean removes everything sync wrote from the shipped templates', (t) => {
  const project = scratchProject(t, { projectName: 'Probe', skills: shippedSkills });
  assert.equal(run(packageDir, project, 'sync').status, 0);

  const result = run(packageDir, project, 'clean');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(join(project, '.claude')), ['skills.config.json']);
});

test('sync adds only the marker line and leaves the rest of the template as written', (t) => {
  const pkg = scratchPackage(t, {
    'skills/probe/SKILL.md': '---\ndescription: Use when probing {{projectName}}\n---\n\n# Probe\n',
  });
  const project = scratchProject(t, { projectName: 'Probe Project', skills: ['probe'] });

  const result = run(pkg, project, 'sync');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(join(project, '.claude', 'skills', 'probe', 'SKILL.md'), 'utf8'),
    `---\n${MARKER}\ndescription: Use when probing Probe Project\n---\n\n# Probe\n`
  );
});

test('sync ends the marker line with the template\'s own CRLF', (t) => {
  const pkg = scratchPackage(t, {
    'skills/probe/SKILL.md': '---\r\ndescription: Use when probing\r\n---\r\n\r\n# Probe\r\n',
  });
  const project = scratchProject(t, { projectName: 'Probe', skills: ['probe'] });

  const result = run(pkg, project, 'sync');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(join(project, '.claude', 'skills', 'probe', 'SKILL.md'), 'utf8'),
    `---\r\n${MARKER}\r\ndescription: Use when probing\r\n---\r\n\r\n# Probe\r\n`
  );
});

test('sync refuses a template with no frontmatter and still writes the others', (t) => {
  const pkg = scratchPackage(t, {
    'skills/plain/SKILL.md': '# Plain\n\nNo frontmatter here.\n',
    'skills/probe/SKILL.md': '---\ndescription: Use when probing\n---\n\n# Probe\n',
  });
  const project = scratchProject(t, { projectName: 'Probe', skills: ['plain', 'probe'] });

  const result = run(pkg, project, 'sync');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /skills\/plain\/SKILL\.md/);
  assert.equal(existsSync(join(project, '.claude', 'skills', 'plain', 'SKILL.md')), false);
  assert.equal(existsSync(join(project, '.claude', 'skills', 'probe', 'SKILL.md')), true);
});

test('sync refuses a template whose frontmatter never closes', (t) => {
  const pkg = scratchPackage(t, {
    'skills/open/SKILL.md': '---\ndescription: Use when probing\n\n# Open\n',
  });
  const project = scratchProject(t, { projectName: 'Probe', skills: ['open'] });

  const result = run(pkg, project, 'sync');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /skills\/open\/SKILL\.md/);
  assert.equal(existsSync(join(project, '.claude', 'skills', 'open', 'SKILL.md')), false);
});

test('clean removes files an older sync marked on line 1', (t) => {
  const project = scratchProject(t, { projectName: 'Probe', skills: [] });
  write(join(project, '.claude', 'skills', 'old', 'SKILL.md'), `${LEGACY_MARKER}\n\n---\ndescription: Old\n---\n`);

  const result = run(packageDir, project, 'clean');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(project, '.claude', 'skills', 'old')), false);
});

test('clean keeps hand-written skills that only mention the marker text', (t) => {
  const project = scratchProject(t, { projectName: 'Probe', skills: [] });
  const notes =
    '---\ndescription: Explains files managed by @austencloud/claude-skills\n---\n\n' +
    'A file managed by @austencloud/claude-skills says so at the top.\n';
  write(join(project, '.claude', 'skills', 'notes', 'SKILL.md'), notes);

  const result = run(packageDir, project, 'clean');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(project, '.claude', 'skills', 'notes', 'SKILL.md'), 'utf8'), notes);
});
