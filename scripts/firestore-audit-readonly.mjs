/**
 * Read-only Firestore audit — PROTAXI24
 * Usage: node scripts/firestore-audit-readonly.mjs
 */
import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'protaxi24-8abf2' });
const db = admin.firestore();

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

function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function docIdLooksLikeUid(id) {
  return /^[A-Za-z0-9]{20,}$/.test(id);
}

async function fetchAll(collectionName) {
  const snap = await db.collection(collectionName).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

async function main() {
  const report = {
    scannedAt: new Date().toISOString(),
    projectId: 'protaxi24-8abf2',
    counts: {},
    anomalies: [],
  };

  const data = {};
  for (const name of COLLECTIONS) {
    try {
      data[name] = await fetchAll(name);
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

  // --- Profile collections ---
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

  // --- Duplicate emails across collections ---
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

  // --- driversLive orphans / rating fields ---
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

  // --- drivers without driversLive ---
  for (const driver of data.drivers) {
    if (!uidSets.driversLive.has(driver.id)) {
      add('low', 'drivers-no-live', `drivers/${driver.id} sans driversLive/${driver.id}`, pick(driver, [
        'fullName',
        'email',
        'isOnline',
      ]));
    }
  }

  // --- rides ---
  const statusCounts = {};
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
      // flagged for archival review only
    }
  }

  report.rideStatusCounts = statusCounts;

  // --- tourBookings / tourGroups ---
  for (const booking of data.tourBookings) {
    if (booking.clientUid && !uidSets.users.has(booking.clientUid)) {
      add('low', 'tour-client-missing', `tourBookings/${booking.id} clientUid absent users/`, {
        clientUid: booking.clientUid,
        status: booking.status,
      });
    }
  }

  // --- Confusable UID chars I vs l (document ids containing both patterns) ---
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

  // Summarize
  const byCategory = {};
  for (const a of report.anomalies) {
    byCategory[a.category] = (byCategory[a.category] || 0) + 1;
  }
  report.anomalySummary = byCategory;
  report.totalAnomalies = report.anomalies.length;

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('AUDIT FAILED', e);
  process.exit(1);
});
