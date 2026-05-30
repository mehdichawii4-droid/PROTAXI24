/**
 * Migrate legacy partners without `status` → status + dual-write isActive
 *
 * Default: dry-run (no writes)
 * Execute: node scripts/migrate-partner-status.mjs --execute
 *
 * Usage:
 *   node scripts/migrate-partner-status.mjs
 *   node scripts/migrate-partner-status.mjs --execute
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import {
  buildMigrationPatch,
  proposeMigrationUpdate,
} from './partner-status-migration-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'protaxi24-8abf2';
const BATCH_SIZE = 400;
const execute = process.argv.includes('--execute');
const dryRun = !execute;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

/**
 * @param {FirebaseFirestore.DocumentSnapshot} docSnap
 * @param {{ status: string, isActive: boolean }} proposal
 */
function applyPatchToBatch(batch, docSnap, proposal) {
  const data = docSnap.data();
  const patch = buildMigrationPatch(data, proposal);

  /** @type {Record<string, unknown>} */
  const update = {
    status: patch.status,
    isActive: patch.isActive,
  };

  if (proposal.status === 'active' && !data.validatedAt) {
    update.validatedAt = patch.validatedAt || admin.firestore.FieldValue.serverTimestamp();
  }
  if (patch.validatedBy && !data.validatedBy) {
    update.validatedBy = patch.validatedBy;
  }

  batch.update(docSnap.ref, update);
}

async function main() {
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'EXECUTE (Firestore updates)'}`);
  console.log(`Project: ${PROJECT_ID}\n`);

  const snapshot = await db.collection('partners').get();

  /** @type {Array<{ id: string, proposal: { status: string, isActive: boolean } }>} */
  const targets = [];

  for (const docSnap of snapshot.docs) {
    const proposal = proposeMigrationUpdate(docSnap.data());
    if (!proposal) continue;
    targets.push({ id: docSnap.id, proposal });
  }

  console.log(`Partners scanned: ${snapshot.size}`);
  console.log(`Partners to update: ${targets.length}`);

  if (targets.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  /** @type {string[]} */
  const logLines = [
    `# Partner status migration ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`,
    `# ${new Date().toISOString()}`,
    `# project: ${PROJECT_ID}`,
    `# targets: ${targets.length}`,
    '',
  ];

  targets.forEach(({ id, proposal }) => {
    const line = `${id} → status=${proposal.status}, isActive=${proposal.isActive}`;
    console.log(dryRun ? `[dry-run] ${line}` : `[update] ${line}`);
    logLines.push(line);
  });

  if (dryRun) {
    console.log('\nDry-run complete. Re-run with --execute to apply.');
    return;
  }

  let updated = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const proposal = proposeMigrationUpdate(docSnap.data());
    if (!proposal) continue;

    applyPatchToBatch(batch, docSnap, proposal);
    batchCount += 1;
    updated += 1;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logLines.push('', `# updated: ${updated}`);
  const logPath = path.join(__dirname, 'migrate-partner-status-log.txt');
  fs.writeFileSync(logPath, `${logLines.join('\n')}\n`, 'utf8');

  console.log(`\nMigration complete. Updated: ${updated}`);
  console.log(`Log: ${logPath}`);
  console.log('\nRe-run: node scripts/audit-partner-status.mjs');
}

main().catch((error) => {
  console.error('[migrate-partner-status] failed', error);
  process.exit(1);
});
