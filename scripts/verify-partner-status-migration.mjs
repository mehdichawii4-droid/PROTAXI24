/**
 * Unit checks for partner status migration helpers.
 * node scripts/verify-partner-status-migration.mjs
 */
import assert from 'node:assert/strict';
import {
  buildMigrationPatch,
  detectStatusInconsistency,
  proposeMigrationUpdate,
} from './partner-status-migration-lib.mjs';

assert.deepEqual(proposeMigrationUpdate({ isActive: true }), {
  status: 'active',
  isActive: true,
});

assert.deepEqual(proposeMigrationUpdate({ isActive: false }), {
  status: 'suspended',
  isActive: false,
});

assert.deepEqual(proposeMigrationUpdate({}), {
  status: 'active',
  isActive: true,
});

assert.equal(proposeMigrationUpdate({ status: 'pending_review', isActive: false }), null);

assert.equal(
  detectStatusInconsistency({ status: 'active', isActive: false }),
  'active_status_with_inactive_flag',
);

assert.equal(
  detectStatusInconsistency({ status: 'suspended', isActive: true }),
  'suspended_status_with_active_flag',
);

const patch = buildMigrationPatch(
  { companyName: 'Legacy Hotel', createdAt: '2024-01-01' },
  { status: 'active', isActive: true },
);
assert.equal(patch.status, 'active');
assert.equal(patch.isActive, true);
assert.equal(patch.validatedBy, 'migration');
assert.equal(patch.validatedAt, '2024-01-01');

console.log('[verify-partner-status-migration] OK');
