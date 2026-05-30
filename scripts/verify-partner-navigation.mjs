/**
 * Lot 5 — RouteGuard partenaire (sans RN)
 * npx tsx scripts/verify-partner-navigation.mjs
 */
import assert from 'node:assert/strict';

const PUBLIC = new Set(['login', 'register', 'guide-register', 'partner-register']);
const PARTNER_PROTECTED = new Set([
  'partner-dashboard',
  'partner-profile',
  'partner-new-booking',
  'hotel',
  'tour-booking',
  'discover-guelma',
  'discover-booking',
]);
const PARTNER_ROUTES = new Set(['partner-register', ...PARTNER_PROTECTED]);
const CLIENT_BLOCKED = new Set([
  'partner-dashboard',
  'partner-new-booking',
  'partner-register',
  'partner-profile',
]);
const ROLE_HOME = { partner: '/partner-dashboard' };

function canAccess(role, routeKey) {
  if (PUBLIC.has(routeKey)) return true;
  if (!role) return false;
  if (role === 'client') return !CLIENT_BLOCKED.has(routeKey);
  if (role === 'partner') return PARTNER_ROUTES.has(routeKey);
  if (role === 'guide') return routeKey === 'guide-register' || routeKey.startsWith('guide-');
  return false;
}

assert.equal(canAccess(null, 'partner-register'), true);
assert.equal(canAccess('client', 'partner-register'), true);
assert.equal(canAccess('client', 'partner-dashboard'), false);
assert.equal(canAccess('client', 'partner-profile'), false);
assert.equal(canAccess('partner', 'partner-dashboard'), true);
assert.equal(canAccess('partner', 'partner-profile'), true);
assert.equal(canAccess('partner', 'partner-register'), true);
assert.equal(canAccess('partner', 'hotel'), true);
assert.equal(canAccess('partner', 'admin-dashboard'), false);
assert.equal(canAccess('guide', 'partner-dashboard'), false);
assert.equal(canAccess('guide', 'partner-profile'), false);
assert.equal(ROLE_HOME.partner, '/partner-dashboard');

console.log('[verify-partner-navigation] OK');
