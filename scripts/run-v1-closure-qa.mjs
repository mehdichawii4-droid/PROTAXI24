/**
 * Run automated QA checks for V1 Production Closure.
 *
 * Usage:
 *   node scripts/run-v1-closure-qa.mjs
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

/** @type {Array<{ label: string, command: string, args: string[] }>} */
const CHECKS = [
  {
    label: 'partner-core',
    command: 'npx',
    args: ['tsx', 'scripts/verify-partner-core.mjs'],
  },
  {
    label: 'partner-auth',
    command: 'npx',
    args: ['tsx', 'scripts/verify-partner-auth.mjs'],
  },
  {
    label: 'partner-self',
    command: 'npx',
    args: ['tsx', 'scripts/verify-partner-self.mjs'],
  },
  {
    label: 'partner-navigation',
    command: 'node',
    args: ['scripts/verify-partner-navigation.mjs'],
  },
  {
    label: 'partner-profile-form',
    command: 'npx',
    args: ['tsx', 'scripts/verify-partner-profile-form.mjs'],
  },
  {
    label: 'admin-hotel',
    command: 'node',
    args: ['scripts/verify-admin-hotel.mjs'],
  },
  {
    label: 'partner-booking',
    command: 'npx',
    args: ['tsx', 'scripts/verify-partner-booking.mjs'],
  },
  {
    label: 'partner-status-migration-lib',
    command: 'node',
    args: ['scripts/verify-partner-status-migration.mjs'],
  },
  {
    label: 'experiences-catalog',
    command: 'node',
    args: ['scripts/validate-experiences-v1.mjs'],
  },
];

console.log('=== PROTAXI24 V1 Closure QA (automated) ===\n');

/** @type {string[]} */
const passed = [];
/** @type {Array<{ label: string, error: string }>} */
const failed = [];

for (const check of CHECKS) {
  process.stdout.write(`→ ${check.label} ... `);
  try {
    execFileSync(check.command, check.args, {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    console.log('OK');
    passed.push(check.label);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr || '')
        : '';
    console.log('FAIL');
    failed.push({ label: check.label, error: stderr.trim() || message });
  }
}

console.log('\n--- Summary ---');
console.log(`Passed: ${passed.length}/${CHECKS.length}`);

if (failed.length > 0) {
  console.log('\nFailures:');
  failed.forEach(({ label, error }) => {
    console.log(`  - ${label}`);
    console.log(`    ${error.split('\n')[0]}`);
  });
  process.exit(1);
}

console.log('\nAll automated QA checks passed.');
console.log('Manual QA still required: Partner/Hotel/Guide app flows on staging.');
