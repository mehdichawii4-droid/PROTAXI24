/**
 * Vérification manuelle Lot 2 — partnerCoreService (node scripts/verify-partner-core.mjs)
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Compile via tsx runtime
const {
  normalizePartnerProfile,
  validatePartnerInput,
  assertPartnerStatusTransition,
  isPartnerActiveStatus,
  isPartnerEditable,
  buildPartnerFirestorePayload,
  getPartnerStatusLabel,
  resolveIsActiveForStatus,
} = await import('../services/partnerCoreService.ts');

const legacyActive = normalizePartnerProfile('uid1', {
  companyName: 'Hôtel Test',
  partnerType: 'hotel',
  contactName: 'Réception',
  phone: '+213555',
  email: 'hotel@test.com',
  isActive: true,
});
assert.equal(legacyActive?.status, 'active');
assert.equal(isPartnerActiveStatus(undefined, true), true);
assert.equal(isPartnerActiveStatus(undefined, false), false);

const legacySuspended = normalizePartnerProfile('uid2', {
  companyName: 'Hôtel Off',
  isActive: false,
  email: 'off@test.com',
});
assert.equal(legacySuspended?.status, 'suspended');

const pending = normalizePartnerProfile('uid3', {
  companyName: 'Nouveau',
  partnerType: 'hotel',
  status: 'pending_review',
  isActive: false,
  contactName: 'A',
  phone: '1',
  email: 'n@test.com',
});
assert.equal(pending?.status, 'pending_review');
assert.equal(isPartnerActiveStatus('pending_review', false), false);
assert.equal(isPartnerEditable('pending_review'), true);
assert.equal(isPartnerEditable('active'), false);

assert.throws(
  () => assertPartnerStatusTransition('pending_review', 'draft'),
  (err) => err.name === 'PartnerServiceError',
);

const invalid = validatePartnerInput(
  {
    partnerUid: '',
    companyName: '',
    partnerType: 'agency',
    contactName: '',
    phone: '',
    email: 'bad',
  },
  'create',
  { hotelSelf: true },
);
assert.equal(invalid.ok, false);
assert.ok(invalid.errors.length >= 4);

const validHotel = validatePartnerInput(
  {
    partnerUid: 'uid3',
    companyName: 'Hôtel Guelma',
    partnerType: 'hotel',
    contactName: 'Manager',
    phone: '+213555',
    email: 'ok@hotel.com',
    status: 'pending_review',
  },
  'create',
  { hotelSelf: true },
);
assert.equal(validHotel.ok, true);

const payload = buildPartnerFirestorePayload(
  {
    partnerUid: 'uid3',
    companyName: 'Hôtel Guelma',
    partnerType: 'hotel',
    contactName: 'Manager',
    phone: '+213555',
    email: 'ok@hotel.com',
  },
  { status: 'pending_review', createdAt: new Date(), updatedAt: new Date() },
);
assert.equal(payload.status, 'pending_review');
assert.equal(payload.isActive, false);
assert.equal(resolveIsActiveForStatus('active'), true);
assert.equal(getPartnerStatusLabel('pending_review'), 'En attente de validation');

console.log('[verify-partner-core] OK —', {
  legacyActive: legacyActive?.status,
  pending: pending?.status,
  errors: invalid.errors.length,
});
