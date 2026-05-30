/**
 * Guide Missions V1 — normalize + public field exposure checks.
 * npx tsx scripts/verify-guide-missions.mjs
 */
import assert from 'node:assert/strict';

const {
  normalizeGuideMission,
  GUIDE_MISSION_PUBLIC_FIELD_KEYS,
} = await import('../services/guideMissionNormalize.ts');

const mission = normalizeGuideMission('booking123', {
  assignedGuideId: 'guideUid1',
  assignedGuideName: 'Guide Test',
  assignedGuidePhone: '+213555000000',
  clientName: 'Amine B.',
  clientPhone: '+213666111222',
  experience: 'Guelma Romaine',
  circuitName: 'Guelma Romaine',
  date: '15/06/2026',
  meetingPoint: 'Hôtel Guelma',
  travelers: '2',
  status: 'pending',
  source: 'experiences-private',
  createdAt: '2026-06-01T10:00:00.000Z',
});

assert.equal(mission.id, 'booking123');
assert.equal(mission.experience, 'Guelma Romaine');
assert.equal(mission.date, '15/06/2026');
assert.equal(mission.meetingPoint, 'Hôtel Guelma');
assert.equal(mission.clientName, 'Amine B.');
assert.equal(mission.travelers, '2');
assert.equal(mission.status, 'pending');
assert.equal(mission.statusLabel, 'En attente');

const missionKeys = Object.keys(mission).sort();
const allowedKeys = [...GUIDE_MISSION_PUBLIC_FIELD_KEYS].sort();
assert.deepEqual(missionKeys, allowedKeys);

assert.equal('clientPhone' in mission, false);
assert.equal('assignedGuidePhone' in mission, false);
assert.equal('phone' in mission, false);
assert.equal('notes' in mission, false);

console.log('[verify-guide-missions] OK');
