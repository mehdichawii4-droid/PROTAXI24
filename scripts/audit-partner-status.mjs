/**
 * Read-only audit — partners status / isActive (PROTAXI24 V1 closure)
 *
 * Usage:
 *   node scripts/audit-partner-status.mjs
 *   node scripts/audit-partner-status.mjs --json scripts/partner-status-audit.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import {
  buildMigrationPatch,
  detectStatusInconsistency,
  proposeMigrationUpdate,
} from './partner-status-migration-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'protaxi24-8abf2';

const jsonOutArg = process.argv.find((arg) => arg.startsWith('--json'));
const jsonOutPath = jsonOutArg
  ? jsonOutArg.includes('=')
    ? jsonOutArg.split('=')[1]
    : process.argv[process.argv.indexOf('--json') + 1]
  : null;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('partners').get();

  /** @type {Record<string, number>} */
  const counts = {
    total: snapshot.size,
    already_migrated: 0,
    needs_migration: 0,
    invalid_status: 0,
    inconsistent: 0,
  };

  /** @type {Array<Record<string, unknown>>} */
  const needsMigration = [];

  /** @type {Array<Record<string, unknown>>} */
  const anomalies = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const inconsistency = detectStatusInconsistency(data);

    if (inconsistency) {
      counts.inconsistent += 1;
      anomalies.push({
        id: docSnap.id,
        type: inconsistency,
        partnerType: data.partnerType ?? null,
        status: data.status ?? null,
        isActive: data.isActive ?? null,
      });
    }

    const proposal = proposeMigrationUpdate(data);

    if (!proposal) {
      const rawStatus = String(data.status ?? '').trim();
      if (rawStatus && !['draft', 'pending_review', 'active', 'suspended'].includes(rawStatus)) {
        counts.invalid_status += 1;
        anomalies.push({
          id: docSnap.id,
          type: 'invalid_status_value',
          status: rawStatus,
          partnerType: data.partnerType ?? null,
        });
      } else {
        counts.already_migrated += 1;
      }
      continue;
    }

    counts.needs_migration += 1;
    needsMigration.push({
      id: docSnap.id,
      partnerType: data.partnerType ?? 'hotel',
      isActive: data.isActive ?? null,
      proposedStatus: proposal.status,
      proposedIsActive: proposal.isActive,
      patch: buildMigrationPatch(data, proposal),
    });
  }

  const report = {
    scannedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    mode: 'read-only',
    counts,
    needsMigration,
    anomalies,
  };

  console.log('=== PROTAXI24 Partner Status Audit (read-only) ===');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Scanned: ${counts.total} partners`);
  console.log(`Already migrated (status present): ${counts.already_migrated}`);
  console.log(`Needs migration (no status): ${counts.needs_migration}`);
  console.log(`Inconsistent status/isActive: ${counts.inconsistent}`);
  console.log(`Invalid status values: ${counts.invalid_status}`);

  if (needsMigration.length > 0) {
    console.log('\n--- Needs migration (preview) ---');
    needsMigration.slice(0, 20).forEach((row) => {
      console.log(
        `  ${row.id} | type=${row.partnerType} | isActive=${row.isActive} → status=${row.proposedStatus}`,
      );
    });
    if (needsMigration.length > 20) {
      console.log(`  ... +${needsMigration.length - 20} more`);
    }
  }

  if (anomalies.length > 0) {
    console.log('\n--- Anomalies ---');
    anomalies.forEach((row) => {
      console.log(`  ${row.id} | ${row.type} | status=${row.status ?? '—'} | isActive=${row.isActive ?? '—'}`);
    });
  }

  if (jsonOutPath) {
    const absolutePath = path.isAbsolute(jsonOutPath)
      ? jsonOutPath
      : path.join(process.cwd(), jsonOutPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\nReport written: ${absolutePath}`);
  }

  if (counts.needs_migration > 0) {
    console.log('\nNext: node scripts/migrate-partner-status.mjs');
  } else {
    console.log('\nNo migration required.');
  }
}

main().catch((error) => {
  console.error('[audit-partner-status] failed', error);
  process.exit(1);
});
