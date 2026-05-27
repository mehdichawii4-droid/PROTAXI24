/**
 * Archive test rides from `rides` → `rides_archive` (PROTAXI24).
 *
 * Default: dry-run only — no Firestore writes.
 * Use --execute to copy to rides_archive and remove from rides.
 *
 * Usage:
 *   node scripts/firestore-archive-test-rides.mjs           # dry-run (default)
 *   node scripts/firestore-archive-test-rides.mjs --execute # archive for real
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'protaxi24-8abf2';
const FIREBASE_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const PROD_CLIENT_UID = 'GwnVLG6TV4hrROAjUvILMpkX8Xh2';
const ARCHIVE_COLLECTION = 'rides_archive';
const SOURCE_COLLECTION = 'rides';
const LEGACY_DRIVER_ID = /^DRV-/i;

/** 14 rides bloquées en Arrivé sans driver — audit 2026-05-25 */
const ORPHAN_ARRIVE_IDS = new Set([
  '1MPdKVQCSWO1CtmkWJbg',
  '8nZrcVs2qly4qB3tJX45',
  'MPcSb9oq8BtSkSQlFyOQ',
  'MmyJsmqRZMWV1RqWrG8Z',
  'RGyPRJUaEvdM2Gc4RMka',
  'TG89N3jQW9fW8ShHmzP4',
  'XblUgvDeptDgNYb8FyCe',
  'aLlHktaNMivf96DC7pA4',
  'cW5DEGkpI5wKn6DK98yo',
  'iurAEwfYwf9mhfnPfP9T',
  'jvHUO1yJDM6N2w4LM8P1',
  'pN7Ll0jcFitiAWK2HRas',
  'u9tLFNT1EUpofJfig0Pm',
  'wVIBsziz7ImzEGDHE6cy',
]);

/** 16 rides avec driverId legacy DRV-001 — audit 2026-05-25 */
const LEGACY_DRV001_IDS = new Set([
  '6Zxju0xpu5559UglnxcP',
  '8XI3w31SXaAxWf0whj7A',
  'CfwYuZup3ac7n1JAPAje',
  'FWiBnCD9HCCANhZ1biok',
  'H7GtadNtBl1BjaqkhoJS',
  'OX7fYa6ARUpenTr1xcGH',
  'T4pEOJp93Ruj6NvkyJov',
  'b2UcYuBoTtaqptUNiRcO',
  'bVCwG6r8RlascT7UGGVl',
  'f4fpO1T2ixeR37QE86wp',
  'l01VYUF9zHGeh6Fp1Whn',
  'oPMGVH5QftORkh42rvZU',
  'qNiHOppoZZBB7X6mQ6cL',
  'qsKrejEfIvR8JQMGswhr',
  'rG0u6hfIt3RFZ9uyJ2kM',
  'zor9hNhnP6PG7Dwt49Hw',
]);

const execute = process.argv.includes('--execute');
const dryRun = !execute;

function configPath() {
  return path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
}

async function getAccessToken() {
  const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  const tokens = cfg.tokens;
  if (!tokens?.refresh_token) {
    throw new Error('Firebase CLI non connecté. Lancez: firebase login');
  }
  if (tokens.access_token && tokens.expires_at && Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: FIREBASE_CLIENT_ID,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

function firestoreValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(firestoreValue);
  if ('mapValue' in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = firestoreValue(val);
    return out;
  }
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('referenceValue' in v) return v.referenceValue;
  return v;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object' && v.latitude != null && v.longitude != null) {
    return { geoPointValue: { latitude: v.latitude, longitude: v.longitude } };
  }
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function classifyRide(ride) {
  const phone = String(ride.phone || '');
  const client = String(ride.client || ride.clientName || '');
  if (ride.clientUid === PROD_CLIENT_UID) return 'prod-client';
  if (phone.includes('+213555000000') || (client === 'Mehdi' && phone.includes('555'))) {
    return 'seed-test';
  }
  if (
    /^[A-Za-z]{1,3}$/.test(client) ||
    phone.length < 8 ||
    /^(5+|8+|1+|6+)$/.test(phone.replace(/\D/g, ''))
  ) {
    return 'junk-test';
  }
  return 'other-test';
}

function archiveReasons(ride) {
  if (ride.clientUid === PROD_CLIENT_UID) return null;

  const reasons = [];
  if (ORPHAN_ARRIVE_IDS.has(ride.id)) reasons.push('orphan-arrive');
  if (ride.status === 'Arrivé' && !String(ride.driverId || '').trim()) {
    reasons.push('orphan-arrive');
  }
  if (LEGACY_DRV001_IDS.has(ride.id)) reasons.push('legacy-drv001');
  if (LEGACY_DRIVER_ID.test(String(ride.driverId || ''))) reasons.push('legacy-drv001');

  const cls = classifyRide(ride);
  if (cls === 'junk-test') reasons.push('junk-test');
  if (cls === 'seed-test') reasons.push('seed-test');
  if (cls === 'other-test') reasons.push('other-test');

  return reasons.length ? [...new Set(reasons)] : null;
}

async function fetchRidesRaw(token) {
  const docs = [];
  let pageToken = '';
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${SOURCE_COLLECTION}`,
    );
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`fetch rides: ${res.status} ${await res.text()}`);
    const json = await res.json();
    for (const doc of json.documents || []) {
      const id = doc.name.split('/').pop();
      const data = {};
      for (const [k, v] of Object.entries(doc.fields || {})) data[k] = firestoreValue(v);
      docs.push({ id, data, rawFields: doc.fields || {} });
    }
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function archiveExists(token, rideId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${ARCHIVE_COLLECTION}/${rideId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.status === 200;
}

async function copyToArchive(token, ride, reasons) {
  const fields = { ...ride.rawFields };
  fields.archivedAt = toFirestoreValue(new Date().toISOString());
  fields.archivedFrom = toFirestoreValue(SOURCE_COLLECTION);
  fields.archiveReasons = toFirestoreValue(reasons);
  fields.originalRideId = toFirestoreValue(ride.id);

  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${ARCHIVE_COLLECTION}`,
  );
  url.searchParams.set('documentId', ride.id);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`copy ${ride.id}: ${res.status} ${await res.text()}`);
  }
}

async function deleteFromRides(token, rideId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${SOURCE_COLLECTION}/${rideId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`delete ${rideId}: ${res.status} ${await res.text()}`);
  }
}

function runPostAudit() {
  console.log('\n--- Re-lancement audit read-only ---\n');
  execFileSync('node', [path.join(__dirname, 'firestore-audit-rest.mjs')], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
}

async function main() {
  console.log(`Mode: ${dryRun ? 'DRY-RUN (aucune écriture Firestore)' : 'EXECUTE (archivage réel)'}`);
  console.log(`Projet: ${PROJECT_ID}`);
  console.log(`Prod clientUid protégé: ${PROD_CLIENT_UID}\n`);

  const token = await getAccessToken();
  const allRides = await fetchRidesRaw(token);

  const prodRides = allRides.filter((r) => r.data.clientUid === PROD_CLIENT_UID);
  const targets = [];
  const skippedProd = [];

  for (const ride of allRides) {
    if (ride.data.clientUid === PROD_CLIENT_UID) continue;
    const reasons = archiveReasons(ride.data);
    if (reasons) {
      targets.push({ ride, reasons });
    }
  }

  // Safety: never archive prod rides even if misclassified
  for (const ride of allRides) {
    if (ride.data.clientUid === PROD_CLIENT_UID && archiveReasons(ride.data)) {
      skippedProd.push(ride.id);
    }
  }
  if (skippedProd.length) {
    throw new Error(`Sécurité: rides prod classées archivables: ${skippedProd.join(', ')}`);
  }

  targets.sort((a, b) => a.ride.id.localeCompare(b.ride.id));

  console.log(`Rides totales: ${allRides.length}`);
  console.log(`Rides prod conservées: ${prodRides.length}`);
  console.log(`Rides à archiver: ${targets.length}\n`);

  if (targets.length === 0) {
    console.log('Rien à archiver.');
    return;
  }

  console.log('Liste des rideId ciblés:');
  for (const { ride, reasons } of targets) {
    const status = ride.data.status || '?';
    const client = ride.data.client || ride.data.clientName || '?';
    console.log(`  - ${ride.id}  [${reasons.join(', ')}]  status=${status}  client=${client}`);
  }

  if (dryRun) {
    console.log('\nDRY-RUN terminé. Aucune modification Firestore.');
    console.log('Pour archiver réellement: node scripts/firestore-archive-test-rides.mjs --execute');
    return;
  }

  console.log('\n--- Archivage en cours ---\n');
  let copied = 0;
  let deleted = 0;

  for (const { ride, reasons } of targets) {
    console.log(`→ ${ride.id}`);
    const exists = await archiveExists(token, ride.id);
    if (exists) {
      console.log(`  ⚠ déjà présent dans ${ARCHIVE_COLLECTION}/${ride.id}, skip copy`);
    } else {
      await copyToArchive(token, ride, reasons);
      copied++;
      console.log(`  ✓ copié vers ${ARCHIVE_COLLECTION}/${ride.id}`);
    }
    await deleteFromRides(token, ride.id);
    deleted++;
    console.log(`  ✓ supprimé de ${SOURCE_COLLECTION}/${ride.id}`);
  }

  console.log(`\nArchivage terminé: ${copied} copiés, ${deleted} supprimés de ${SOURCE_COLLECTION}.`);
  console.log(`${prodRides.length} rides prod conservées.`);

  runPostAudit();
}

main().catch((e) => {
  console.error('ARCHIVE FAILED:', e.message || e);
  process.exit(1);
});
