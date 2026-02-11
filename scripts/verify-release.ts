import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

type Step = {
  title: string;
  run: () => void | Promise<void>;
};

const npmCmd = 'npm';
const npxCmd = 'npx';

function runCommand(command: string, args: string[], title: string): void {
  const commandLine = [command, ...args].join(' ');
  console.log(`\n[verify:release] ${title}`);
  console.log(`[verify:release] > ${commandLine}`);

  const result = spawnSync(commandLine, {
    stdio: 'inherit',
    encoding: 'utf8',
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${title} failed with exit code ${result.status}`);
  }
}

function runLintGate(): void {
  console.log('\n[verify:release] Lint gate (react-hooks/rules-of-hooks + errors)');
  const eslintArgs = [
    'eslint',
    'client/src/**/*.{ts,tsx}',
    'server/**/*.{ts,tsx}',
    'shared/**/*.{ts,tsx}',
    '-f',
    'json',
  ];

  const result = spawnSync([npxCmd, ...eslintArgs].join(' '), {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 1024 * 1024 * 100,
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout?.trim();
  if (!stdout) {
    throw new Error('ESLint did not produce JSON output');
  }

  let parsed: Array<{
    filePath: string;
    errorCount: number;
    messages: Array<{ ruleId: string | null; severity: number; message: string; line?: number }>;
  }> = [];
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse ESLint output: ${error instanceof Error ? error.message : String(error)}`);
  }

  const totalErrors = parsed.reduce((sum, file) => sum + (file.errorCount || 0), 0);
  const hookViolations = parsed.flatMap((file) =>
    file.messages
      .filter((m) => m.ruleId === 'react-hooks/rules-of-hooks')
      .map((m) => ({
        filePath: file.filePath,
        line: m.line || 0,
        message: m.message,
      })),
  );

  if (hookViolations.length > 0) {
    console.error('\n[verify:release] Hook rule violations found:');
    hookViolations.slice(0, 20).forEach((violation) => {
      console.error(`  - ${violation.filePath}:${violation.line} ${violation.message}`);
    });
    throw new Error(`Found ${hookViolations.length} react-hooks/rules-of-hooks violation(s)`);
  }

  if (totalErrors > 0) {
    throw new Error(`ESLint reported ${totalErrors} error(s)`);
  }

  console.log('[verify:release] Lint gate passed');
}

function runMigrationSanityChecks(): void {
  console.log('\n[verify:release] Migration sanity checks');

  const migrationsDir = join(process.cwd(), 'migrations');
  const files = readdirSync(migrationsDir).filter((name) => /^\d{3}_.+\.sql$/i.test(name));
  if (files.length === 0) {
    throw new Error('No migration files found');
  }

  const latest = files
    .map((name) => parseInt(name.slice(0, 3), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0];

  if (latest < 12) {
    throw new Error(`Expected migration version >= 012, found ${latest}`);
  }

  const requiredMigration = '012_add_creation_integrity_to_generated_documents.sql';
  if (!files.includes(requiredMigration)) {
    throw new Error(`Required migration missing: ${requiredMigration}`);
  }

  const migrationSql = readFileSync(join(migrationsDir, requiredMigration), 'utf8');
  if (!/ADD COLUMN IF NOT EXISTS creation_integrity JSONB/i.test(migrationSql)) {
    throw new Error('Migration 012 does not include creation_integrity column definition');
  }

  console.log(`[verify:release] Migration checks passed (latest=${String(latest).padStart(3, '0')})`);
}

async function runReadinessSmokeChecks(): Promise<void> {
  console.log('\n[verify:release] Readiness smoke checks');
  const baseUrl = process.env.VERIFY_RELEASE_BASE_URL;

  if (!baseUrl) {
    const routesSource = readFileSync(join(process.cwd(), 'server', 'routes.ts'), 'utf8');
    if (!routesSource.includes("/api/health/ready")) {
      throw new Error('Readiness route contract missing: /api/health/ready');
    }
    console.log('[verify:release] VERIFY_RELEASE_BASE_URL not set, ran static readiness contract check');
    return;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const endpoints = ['/api/health', '/api/health/ready'];

  for (const endpoint of endpoints) {
    const response = await fetch(`${normalizedBase}${endpoint}`);
    const bodyText = await response.text();
    let body: any = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = bodyText;
    }

    if (response.status !== 200) {
      throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(body)}`);
    }

    if (endpoint === '/api/health/ready' && body?.status !== 'ready') {
      throw new Error(`/api/health/ready returned non-ready payload: ${JSON.stringify(body)}`);
    }
  }

  console.log('[verify:release] Runtime readiness smoke checks passed');
}

async function main() {
  const steps: Step[] = [
    { title: 'Type checking', run: () => runCommand(npmCmd, ['run', 'check'], 'Type checking') },
    { title: 'Lint gate', run: () => runLintGate() },
    { title: 'Geo tests', run: () => runCommand(npmCmd, ['run', 'test:geo'], 'Geo tests') },
    {
      title: 'Beneficiary sync tests',
      run: () => runCommand(npmCmd, ['run', 'test:beneficiary-sync'], 'Beneficiary sync tests'),
    },
    { title: 'Regiondet tests', run: () => runCommand(npmCmd, ['run', 'test:regiondet'], 'Regiondet tests') },
    { title: 'Migration sanity checks', run: () => runMigrationSanityChecks() },
    { title: 'Readiness smoke checks', run: () => runReadinessSmokeChecks() },
  ];

  for (const step of steps) {
    await step.run();
  }

  console.log('\n[verify:release] All release checks passed');
}

main().catch((error) => {
  console.error('\n[verify:release] FAILED');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
