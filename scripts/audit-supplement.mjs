import fs from 'fs';
import os from 'os';
import path from 'path';

const cfg = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'),
);
const token =
  cfg.tokens.expires_at > Date.now()
    ? cfg.tokens.access_token
    : (
        await (
          await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
              refresh_token: cfg.tokens.refresh_token,
              grant_type: 'refresh_token',
            }),
          })
        ).json()
      ).access_token;

function val(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(val);
  if (v.mapValue) {
    const o = {};
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x);
    return o;
  }
  return v;
}

async function all(col) {
  const docs = [];
  let pt = '';
  do {
    const u = new URL(
      `https://firestore.googleapis.com/v1/projects/protaxi24-8abf2/databases/(default)/documents/${col}`,
    );
    u.searchParams.set('pageSize', '300');
    if (pt) u.searchParams.set('pageToken', pt);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    for (const d of j.documents || []) {
      docs.push({
        id: d.name.split('/').pop(),
        ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)])),
      });
    }
    pt = j.nextPageToken || '';
  } while (pt);
  return docs;
}

const rides = await all('rides');
const tours = await all('tourBookings');
const groups = await all('tourGroups');
const REAL_CLIENT = 'GwnVLG6TV4hrROAjUvILMpkX8Xh2';
const arrivé = rides.filter((x) => x.status === 'Arrivé');
const byStatus = (arr) =>
  arr.reduce((a, x) => {
    a[x.status || 'unknown'] = (a[x.status || 'unknown'] || 0) + 1;
    return a;
  }, {});

function classify(ride) {
  const phone = String(ride.phone || '');
  const client = String(ride.client || ride.clientName || '');
  if (ride.clientUid === REAL_CLIENT) return 'prod-client';
  if (phone.includes('+213555000000') || (client === 'Mehdi' && phone.includes('555')))
    return 'seed-test';
  if (/^[A-Za-z]{1,3}$/.test(client) || phone.length < 8 || /^(5+|8+|1+|6+)$/.test(phone.replace(/\D/g, '')))
    return 'junk-test';
  if (client.includes('Mehdi Ram') || client.includes('PROTAXI')) return 'dev-real-name';
  return 'other';
}

const rideClass = rides.reduce((a, r) => {
  const c = classify(r);
  a[c] = (a[c] || 0) + 1;
  return a;
}, {});
const legacy = rides.filter((r) => /^DRV-/.test(String(r.driverId || '')));
const adminDriver = rides.filter((r) => r.driverId === 'KelkoNqlZXTQMpXVcFk8gXcA31y2');
const prodRides = rides.filter((r) => r.clientUid === REAL_CLIENT);

console.log(
  JSON.stringify(
    {
      rideStatus: byStatus(rides),
      rideClass,
      arriveCount: arrivé.length,
      arriveIds: arrivé.map((r) => ({
        id: r.id,
        client: r.client || r.clientName,
        driverId: r.driverId,
        createdAt: r.createdAt,
      })),
      legacyCount: legacy.length,
      legacyIds: legacy.map((r) => r.id),
      adminDriverRides: adminDriver.map((r) => ({
        id: r.id,
        status: r.status,
        client: r.client || r.clientName,
      })),
      prodRidesCount: prodRides.length,
      prodRidesByStatus: byStatus(prodRides),
      prodRideIds: prodRides.map((r) => ({ id: r.id, status: r.status, driverId: r.driverId })),
      tourBookingStatus: byStatus(tours),
      tourGroupsStatus: byStatus(groups),
      tourGroupsSample: groups.slice(0, 8).map((g) => ({
        id: g.id,
        status: g.status,
        driverId: g.driverId,
        title: g.title || g.destination,
      })),
    },
    null,
    2,
  ),
);
