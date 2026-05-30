/**
 * Lot 4 — logique canPartnerLogin (miroir authUtils, sans charger config Firebase/RN)
 * npx tsx scripts/verify-partner-auth.mjs
 */
import assert from 'node:assert/strict';

const PARTNER_LOGIN_BLOCKED = new Set(['suspended']);

function canPartnerLogin(partnerStatus) {
  if (!partnerStatus) return true;
  return !PARTNER_LOGIN_BLOCKED.has(partnerStatus);
}

function canRestorePartnerSession(profile) {
  if (profile.partnerStatus) {
    return canPartnerLogin(profile.partnerStatus);
  }
  return profile.isApproved;
}

assert.equal(canPartnerLogin('draft'), true);
assert.equal(canPartnerLogin('pending_review'), true);
assert.equal(canPartnerLogin('active'), true);
assert.equal(canPartnerLogin('suspended'), false);
assert.equal(canPartnerLogin(undefined), true);

const pendingProfile = {
  isApproved: false,
  partnerStatus: 'pending_review',
};
assert.equal(canRestorePartnerSession(pendingProfile), true);

const suspendedProfile = { isApproved: false, partnerStatus: 'suspended' };
assert.equal(canRestorePartnerSession(suspendedProfile), false);

const legacyActive = { isApproved: true, partnerStatus: undefined };
assert.equal(canRestorePartnerSession(legacyActive), true);

const legacyOff = { isApproved: false, partnerStatus: undefined };
assert.equal(canRestorePartnerSession(legacyOff), false);

console.log('[verify-partner-auth] OK');
