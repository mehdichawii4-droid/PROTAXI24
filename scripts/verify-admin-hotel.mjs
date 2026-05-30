/**
 * Lot 9 — vérif transitions admin hôtel (inline, sans import @/).
 */
import assert from 'node:assert/strict';

const STATUS_TRANSITIONS = {
  draft: ['pending_review'],
  pending_review: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

function assertPartnerStatusTransition(from, to) {
  if (from === to) return;
  const allowed = STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`PARTNER_STATUS_TRANSITION_INVALID: ${from} → ${to}`);
  }
}

function expectTransition(from, to, shouldPass) {
  try {
    assertPartnerStatusTransition(from, to);
    assert.ok(shouldPass, `expected ${from} → ${to} to fail`);
  } catch (error) {
    assert.ok(!shouldPass, `expected ${from} → ${to} to pass`);
    assert.match(String(error.message), /TRANSITION_INVALID/);
  }
}

expectTransition('pending_review', 'active', true);
expectTransition('active', 'suspended', true);
expectTransition('suspended', 'active', true);
expectTransition('draft', 'active', false);

console.log('[verify-admin-hotel] OK');
