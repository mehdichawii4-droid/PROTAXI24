/**
 * Read-only Firestore audit via REST API (Firebase CLI credentials).
 * Usage: node scripts/firestore-audit-rest.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const PROJECT_ID = 'protaxi24-8abf2';
const FIREBASE_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';

const COLLECTIONS = [
  'users',
  'drivers',
  'admins',
  'partners',
  'driversLive',
  'rides',
  'tourBookings',
  'tourGroups',
];

const LEGACY_DRIVER_ID = /^DRV-/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function configPath() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return path.join(home, '.config', 'configstore', 'firebase-tools.json');
  }
  return path.join(home, '.config', 'configstore', 'firebase-tools.json');
}

async function getAccessToken() {
  const raw = fs.readFileSync(configPath(), 'utf8');
  const cfg = JSON.parse(raw);
  const tokens = cfg.tokens;
  if (!tokens?.refresh_token) {
    throw new Error('Firebase CLI non connecté. Lancez: firebase login');
  }
  if (tokens.access_token && tokens.expires_at && Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }
  const body = new URLSearchParams({
    client_id: FIREBASE_CLIENT_ID,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

function firestoreValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) {
    return (v.arrayValue.values || []).map(firestoreValue);
  }
  if ('mapValue' in v) {
    const out = {};
    const fields = v.mapValue.fields || {};
    for (const [k, val] of Object.entries(fields)) out[k] = firestoreValue(val);
    return out;
  }
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('referenceValue' in v) return v.referenceValue;
  return v;
}

function docFromRest(doc) {
  const id = doc.name.split('/').pop();
  const data = {};
  const fields = doc.fields || {};
  for (const [k, v] of Object.entries(fields)) data[k] = firestoreValue(v);
  return { id, ...data };
}

async function fetchCollection(token, collectionName) {
  const docs = [];
  let pageToken = '';
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}`,
    );
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return [];
    if (!res.ok) {
      throw new Error(`${collectionName}: ${res.status} ${await res.text()}`);
    }
    const json = await res.json();
    for (const doc of json.documents || []) docs.push(docFromRest(doc));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return docs;
}

function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function docIdLooksLikeUid(id) {
  return /^[A-Za-z0-9]{20,}$/.test(id);
}

function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

async function main() {
  const token = await getAccessToken();
  const report = {
    scannedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    counts: {},
    anomalies: [],
  };

  const data = {};
  for (const name of COLLECTIONS) {
    try {
      data[name] = await fetchCollection(token, name);
      report.counts[name] = data[name].length;
    } catch (e) {
      data[name] = [];
      report.counts[name] = `ERROR: ${e.message}`;
    }
  }

  const emailIndex = new Map();
  const uidSets = {
    users: new Set(data.users.map((d) => d.id)),
    drivers: new Set(data.drivers.map((d) => d.id)),
    admins: new Set(data.admins.map((d) => d.id)),
    partners: new Set(data.partners.map((d) => d.id)),
    driversLive: new Set(data.driversLive.map((d) => d.id)),
  };

  const add = (severity, category, message, details = {}) => {
    report.anomalies.push({ severity, category, message, details });
  };

  for (const [coll, docs] of Object.entries({
    users: data.users,
    drivers: data.drivers,
    admins: data.admins,
    partners: data.partners,
  })) {
    for (const doc of docs) {
      const email = normEmail(doc.email);
      if (email) {
        if (!emailIndex.has(email)) emailIndex.set(email, []);
        emailIndex.get(email).push({ collection: coll, id: doc.id, role: doc.role });
      } else if (coll !== 'admins') {
        add('low', 'missing-email', `${coll}/${doc.id} sans email`, pick(doc, ['fullName', 'role']));
      }

      if (doc.uid && doc.uid !== doc.id) {
        add('high', 'uid-mismatch', `${coll}/${doc.id} uid field != doc id`, {
          docId: doc.id,
          uidField: doc.uid,
        });
      }

      const expectedRole =
        coll === 'users'
          ? 'client'
          : coll === 'drivers'
            ? 'driver'
            : coll === 'admins'
              ? 'admin'
              : 'partner';
      if (doc.role && doc.role !== expectedRole) {
        add('high', 'wrong-role-field', `${coll}/${doc.id} role=${doc.role} (attendu ${expectedRole})`, {
          docId: doc.id,
        });
      }

      if (!docIdLooksLikeUid(doc.id) && coll !== 'partners') {
        add('medium', 'non-firebase-id', `${coll}/${doc.id} id ne ressemble pas à un Auth UID`, {
          docId: doc.id,
        });
      }

      if (!doc.expoPushToken) {
        add('info', 'missing-push-token', `${coll}/${doc.id} sans expoPushToken`, {
          collection: coll,
          role: doc.role || expectedRole,
        });
      }

      if (coll === 'drivers') {
        if (doc.isSuspended === true || doc.isApproved === false) {
          add('medium', 'driver-status', `drivers/${doc.id} suspendu ou non approuvé`, pick(doc, [
            'fullName',
            'email',
            'isApproved',
            'isSuspended',
          ]));
        }
        const liveAvg = doc.ratingAverage ?? doc.averageRating;
        const liveCount = doc.ratingCount ?? doc.ratingsCount;
        if (liveAvg != null && Number(liveAvg) > 0 && liveCount == null) {
          add('low', 'rating-inconsistent', `drivers/${doc.id} ratingAverage sans ratingCount`, pick(doc, [
            'ratingAverage',
            'averageRating',
            'ratingCount',
            'ratingsCount',
          ]));
        }
      }
    }
  }

  for (const [email, entries] of emailIndex.entries()) {
    const collections = [...new Set(entries.map((e) => e.collection))];
    if (entries.length > 1) {
      add(
        entries.length > 2 || collections.length > 1 ? 'high' : 'medium',
        'duplicate-email',
        `Email ${email} présent ${entries.length} fois`,
        { entries },
      );
    }
  }

  for (const live of data.driversLive) {
    if (!uidSets.drivers.has(live.id)) {
      add('high', 'driversLive-orphan', `driversLive/${live.id} sans drivers/${live.id}`, pick(live, [
        'driverName',
        'isOnline',
        'isBusy',
      ]));
    }

    const avg = live.averageRating;
    const count = live.ratingsCount;
    const total = live.ratingsTotal;
    if (avg != null && count != null && total != null && count > 0) {
      const expected = total / count;
      if (Math.abs(expected - Number(avg)) > 0.01) {
        add('medium', 'rating-math', `driversLive/${live.id} averageRating incohérent`, {
          averageRating: avg,
          ratingsCount: count,
          ratingsTotal: total,
          expected,
        });
      }
    }

    const driverDoc = data.drivers.find((d) => d.id === live.id);
    if (driverDoc) {
      const dAvg = driverDoc.ratingAverage ?? driverDoc.averageRating;
      const lAvg = live.averageRating;
      if (dAvg != null && lAvg != null && Math.abs(Number(dAvg) - Number(lAvg)) > 0.01) {
        add('medium', 'rating-mirror', `drivers vs driversLive averageRating divergent pour ${live.id}`, {
          drivers: dAvg,
          driversLive: lAvg,
        });
      }
    }
  }

  for (const driver of data.drivers) {
    if (!uidSets.driversLive.has(driver.id)) {
      add('low', 'drivers-no-live', `drivers/${driver.id} sans driversLive/${driver.id}`, pick(driver, [
        'fullName',
        'email',
        'isOnline',
      ]));
    }
  }

  const statusCounts = {};
  const archivalCandidates = [];
  for (const ride of data.rides) {
    const st = String(ride.status || 'unknown');
    statusCounts[st] = (statusCounts[st] || 0) + 1;

    const driverId = String(ride.driverId || '').trim();
    if (LEGACY_DRIVER_ID.test(driverId)) {
      add('high', 'legacy-driverId', `rides/${ride.id} driverId legacy ${driverId}`, pick(ride, [
        'status',
        'clientUid',
        'createdAt',
      ]));
    }

    if (driverId && !uidSets.drivers.has(driverId) && !LEGACY_DRIVER_ID.test(driverId)) {
      add('medium', 'ride-driver-missing', `rides/${ride.id} driverId=${driverId} absent de drivers/`, pick(ride, [
        'status',
        'driverName',
      ]));
    }

    if (ride.clientUid && !uidSets.users.has(ride.clientUid)) {
      add('medium', 'ride-client-missing', `rides/${ride.id} clientUid absent de users/`, {
        clientUid: ride.clientUid,
        status: ride.status,
      });
    }

    const testHints = ['test', 'mehdi', 'demo', 'dummy', '+213555'];
    const blob = JSON.stringify(ride).toLowerCase();
    if (testHints.some((h) => blob.includes(h))) {
      add('info', 'ride-test-hint', `rides/${ride.id} ressemble à une course test`, pick(ride, [
        'client',
        'clientName',
        'phone',
        'status',
        'departure',
        'destination',
      ]));
    }

    if (['Annulée', 'Refusée', 'Terminée'].includes(st)) {
      archivalCandidates.push({
        id: ride.id,
        status: st,
        client: ride.client || ride.clientName,
        driverId: ride.driverId,
        createdAt: ride.createdAt,
      });
    }
  }

  report.rideStatusCounts = statusCounts;
  report.archivalCandidatesCount = archivalCandidates.length;
  report.archivalCandidatesSample = archivalCandidates.slice(0, 20);

  for (const booking of data.tourBookings) {
    if (booking.clientUid && !uidSets.users.has(booking.clientUid)) {
      add('low', 'tour-client-missing', `tourBookings/${booking.id} clientUid absent users/`, {
        clientUid: booking.clientUid,
        status: booking.status,
      });
    }
  }

  const profileSummary = {
    users: data.users.map((d) =>
      pick(d, ['id', 'email', 'fullName', 'role', 'expoPushToken', 'phone']),
    ),
    drivers: data.drivers.map((d) =>
      pick(d, [
        'id',
        'email',
        'fullName',
        'role',
        'isApproved',
        'isSuspended',
        'expoPushToken',
        'ratingAverage',
        'ratingCount',
      ]),
    ),
    admins: data.admins.map((d) => pick(d, ['id', 'email', 'fullName', 'role', 'expoPushToken'])),
    partners: data.partners.map((d) => pick(d, ['id', 'email', 'fullName', 'role', 'expoPushToken'])),
    driversLive: data.driversLive.map((d) =>
      pick(d, ['id', 'driverName', 'isOnline', 'isBusy', 'averageRating', 'ratingsCount']),
    ),
  };

  const allIds = [
    ...data.users.map((d) => ({ c: 'users', id: d.id })),
    ...data.drivers.map((d) => ({ c: 'drivers', id: d.id })),
    ...data.admins.map((d) => ({ c: 'admins', id: d.id })),
    ...data.rides.map((d) => ({ c: 'rides', id: d.id, driverId: d.driverId, clientUid: d.clientUid })),
  ];
  const knownUids = new Set(allIds.map((x) => x.id));
  for (const item of allIds) {
    if (!item.id || item.id.length < 20) continue;
    for (const other of knownUids) {
      if (other === item.id || other.length !== item.id.length) continue;
      let diff = 0;
      for (let i = 0; i < item.id.length; i++) {
        const a = item.id[i];
        const b = other[i];
        if (a === b) continue;
        const pair =
          (a === 'I' && b === 'l') ||
          (a === 'l' && b === 'I') ||
          (a === '1' && b === 'l') ||
          (a === 'l' && b === '1');
        if (!pair) {
          diff = -1;
          break;
        }
        diff++;
      }
      if (diff > 0 && diff <= 3) {
        add('high', 'uid-lookalike', `IDs similaires I/l : ${item.id} vs ${other}`, {
          sample: item,
        });
      }
    }
  }

  const byCategory = {};
  for (const a of report.anomalies) {
    byCategory[a.category] = (byCategory[a.category] || 0) + 1;
  }
  report.anomalySummary = byCategory;
  report.totalAnomalies = report.anomalies.length;
  report.profileSummary = profileSummary;

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('AUDIT FAILED', e.message || e);
  process.exit(1);
});
