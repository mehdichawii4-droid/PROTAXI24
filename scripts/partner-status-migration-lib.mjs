/**
 * Shared partner status migration helpers (audit + migrate scripts).
 * Mirrors services/partnerCoreService.ts semantics.
 */

export const VALID_PARTNER_STATUSES = new Set([
  'draft',
  'pending_review',
  'active',
  'suspended',
]);

/**
 * @param {Record<string, unknown>} data
 * @returns {{ status: string, isActive: boolean } | null}
 */
export function proposeMigrationUpdate(data) {
  if (Object.prototype.hasOwnProperty.call(data, 'status')) {
    const rawStatus = String(data.status ?? '').trim();
    if (rawStatus && VALID_PARTNER_STATUSES.has(rawStatus)) {
      return null;
    }
  }

  if (data.isActive === false) {
    return { status: 'suspended', isActive: false };
  }

  return { status: 'active', isActive: true };
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string | null}
 */
export function detectStatusInconsistency(data) {
  if (!Object.prototype.hasOwnProperty.call(data, 'status')) {
    return null;
  }

  const status = String(data.status ?? '').trim();
  if (!VALID_PARTNER_STATUSES.has(status)) {
    return 'invalid_status';
  }

  if (status === 'active' && data.isActive === false) {
    return 'active_status_with_inactive_flag';
  }

  if (status === 'suspended' && data.isActive === true) {
    return 'suspended_status_with_active_flag';
  }

  if (status === 'pending_review' && data.isActive === true) {
    return 'pending_review_with_active_flag';
  }

  return null;
}

/**
 * @param {Record<string, unknown>} data
 * @param {{ status: string, isActive: boolean }} proposal
 * @returns {Record<string, unknown>}
 */
export function buildMigrationPatch(data, proposal) {
  /** @type {Record<string, unknown>} */
  const patch = {
    status: proposal.status,
    isActive: proposal.isActive,
  };

  if (proposal.status === 'active') {
    if (!data.validatedAt) {
      patch.validatedAt = data.updatedAt || data.createdAt || null;
    }
    if (!data.validatedBy) {
      patch.validatedBy = 'migration';
    }
  }

  return patch;
}
