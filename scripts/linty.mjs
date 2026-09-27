#!/usr/bin/env node
// Linty run helper for the Bob IDE workflow (.bob/commands/linty-review.md).
//
//   node --no-warnings scripts/linty.mjs start <file>                  create runs/<name>/ and stamp the start time
//   node --no-warnings scripts/linty.mjs finalize <name> [--author X]  run the tests, measure, validate, publish the report
//
// Bob's agents write analysis.json, fixed.<ext>, fixes.json, linty.test.ts and report.json into
// runs/<name>/. finalize never asks a model anything: every number it adds is measured here.

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LintyReportSchema } from '../lib/linty/schema.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUNS = path.join(ROOT, 'runs');
const REPORTS = path.join(ROOT, 'public', 'reports');

const [command, target, ...rest] = process.argv.slice(2);
const author = rest.includes('--author') ? rest[rest.indexOf('--author') + 1] : undefined;

function fail(message) {
  console.error(`linty: ${message}`);
  process.exit(1);
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function start(file) {
  if (!file) fail('usage: node scripts/linty.mjs start <file>');
  const source = path.resolve(ROOT, file);
  if (!existsSync(source)) fail(`file not found: ${file}`);
  const ext = path.extname(source);
  if (!['.ts', '.js'].includes(ext)) fail('only .ts and .js files are supported');
  const name = path.basename(source, ext);
  const dir = path.join(RUNS, name);
  mkdirSync(dir, { recursive: true });
  copyFileSync(source, path.join(dir, `original${ext}`));
  writeFileSync(
    path.join(dir, 'meta.json'),
    JSON.stringify(
      {
        name,
        fileName: path.relative(ROOT, source).replaceAll('\\', '/'),
        language: ext === '.ts' ? 'typescript' : 'javascript',
        ext,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Run folder ready: runs/${name}/`);
  console.log(`Next: analyzer writes runs/${name}/analysis.json`);
}

// Runs the generated tests with `subject` bound to one version of the code.
function runTests(dir, ext, version) {
  copyFileSync(path.join(dir, `${version}${ext}`), path.join(dir, `subject${ext}`));
  const out = path.join(dir, `vitest-${version}.json`);
  const testFile = path.relative(ROOT, path.join(dir, 'linty.test.ts')).replaceAll('\\', '/');
  try {
    execSync(`npx vitest run "${testFile}" --reporter=json --outputFile="${out}"`, { cwd: ROOT, stdio: 'ignore' });
  } catch {
    // vitest exits non-zero when tests fail; that is an expected outcome on the original code.
  }
  if (!existsSync(out)) fail(`vitest produced no results for ${version}`);
  const result = readJson(out);
  return { passed: result.numPassedTests, failed: result.numFailedTests, total: result.numTotalTests, suites: result };
}

function finalize(name) {
  if (!name) fail('usage: node scripts/linty.mjs finalize <name> [--author <your name>]');
  const dir = path.join(RUNS, name);
  if (!existsSync(path.join(dir, 'meta.json'))) fail(`no run named ${name}; run "start" first`);
  const meta = readJson(path.join(dir, 'meta.json'));
  const { ext } = meta;

  const required = ['analysis.json', `fixed${ext}`, 'fixes.json', 'linty.test.ts', 'report.json'];
  const missing = required.filter((file) => !existsSync(path.join(dir, file)));
  if (missing.length) fail(`runs/${name}/ is missing ${missing.join(', ')}`);

  const analysis = readJson(path.join(dir, 'analysis.json'));
  const testCode = readFileSync(path.join(dir, 'linty.test.ts'), 'utf8');

  // Map each it('...') back to the issue id it guards, from "[E3]" tags in the test name.
  const cases = [...testCode.matchAll(/\bit\(\s*(['"`])(.+?)\1/g)].map((match) => ({
    name: match[2],
    issueId: match[2].match(/\[(E\d+)\]/)?.[1] ?? null,
  }));

  const original = runTests(dir, ext, 'original');
  const fixed = runTests(dir, ext, 'fixed');
  // A test file that crashes on import reports zero tests; count that as every case failing.
  const normalise = (run) =>
    run.total === 0 ? { passed: 0, failed: cases.length, total: cases.length } : { passed: run.passed, failed: run.failed, total: run.total };

  // Stage durations from when each agent's output file was written.
  const mtime = (file) => statSync(path.join(dir, file)).mtimeMs;
  const t0 = Date.parse(meta.startedAt);
  const tAnalyze = mtime('analysis.json');
  const tFix = Math.max(mtime(`fixed${ext}`), mtime('fixes.json'));
  const tTest = mtime('linty.test.ts');
  const tReport = mtime('report.json');
  const timings =
    t0 < tAnalyze && tAnalyze <= tFix && tFix <= tTest && tTest <= tReport
      ? {
          analyzeMs: Math.round(tAnalyze - t0),
          fixMs: Math.round(tFix - tAnalyze),
          testMs: Math.round(tTest - tFix),
          reportMs: Math.round(tReport - tTest),
          totalMs: Math.round(tReport - t0),
          method: 'Bob IDE run, measured from the time each agent wrote its output file',
        }
      : undefined;

  // Seeded-bug ground truth: an expected bug counts as caught if an issue lands within 2 lines of it.
  const expectedFile = path.join(ROOT, 'samples', `${name}.expected.json`);
  let detection;
  if (existsSync(expectedFile)) {
    const bugs = readJson(expectedFile).bugs;
    const lines = analysis.errors.map((e) => e.line).filter((l) => typeof l === 'number');
    const missed = bugs.filter((bug) => !lines.some((line) => Math.abs(line - bug.line) <= 2)).map((bug) => bug.id);
    detection = { expected: bugs.length, caught: bugs.length - missed.length, missed };
  }

  const report = LintyReportSchema.parse({
    schemaVersion: 1,
    id: name,
    title: name,
    fileName: meta.fileName,
    language: meta.language,
    source: { kind: 'bob', model: 'IBM Bob IDE', recordedAt: new Date(tReport).toISOString(), author },
    originalCode: readFileSync(path.join(dir, `original${ext}`), 'utf8'),
    analysis,
    fix: { fixedCode: readFileSync(path.join(dir, `fixed${ext}`), 'utf8'), fixes: readJson(path.join(dir, 'fixes.json')) },
    tests: { framework: 'vitest', code: testCode, cases },
    report: readJson(path.join(dir, 'report.json')),
    verification: { command: `npx vitest run runs/${name}/linty.test.ts`, original: normalise(original), fixed: normalise(fixed) },
    detection,
    timings,
  });

  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(path.join(REPORTS, `${name}.json`), JSON.stringify(report, null, 2) + '\n');

  const indexFile = path.join(REPORTS, 'index.json');
  const index = existsSync(indexFile) ? readJson(indexFile).filter((entry) => entry.id !== name) : [];
  index.push({
    id: name,
    fileName: report.fileName,
    recordedAt: report.source.recordedAt,
    author: report.source.author ?? null,
    issues: report.analysis.errors.length,
  });
  index.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');

  const v = report.verification;
  console.log(`Published public/reports/${name}.json`);
  console.log(`  issues found:       ${report.analysis.errors.length}`);
  if (detection) console.log(`  seeded bugs caught: ${detection.caught}/${detection.expected}`);
  console.log(`  tests on original:  ${v.original.passed}/${v.original.total} passed`);
  console.log(`  tests on fixed:     ${v.fixed.passed}/${v.fixed.total} passed`);
  if (timings) console.log(`  Bob run time:       ${(timings.totalMs / 1000).toFixed(1)}s`);
}

if (command === 'start') start(target);
else if (command === 'finalize') finalize(target);
else fail('usage: node scripts/linty.mjs <start|finalize> ...');
