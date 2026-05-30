/**
 * V1 closure — partner transfer booking payload includes cash payment fields.
 * npx tsx scripts/verify-partner-booking.mjs
 */
import assert from 'node:assert/strict';

const {
  buildPartnerTransferRidePayload,
  PARTNER_TRANSFER_PRICE_LABEL,
} = await import('../services/partnerBookingPayload.ts');

const sampleInput = {
  partnerUid: 'partnerUid123',
  partnerName: 'Hôtel Test',
  clientName: 'Client Invité',
  clientPhone: '+213555000000',
  pickup: 'Hôtel Guelma',
  destination: 'Aéroport Constantine',
  date: '30/05/2026',
  time: '08:00',
  bookingType: 'transfer',
  notes: 'Vol matinal',
};

const payload = buildPartnerTransferRidePayload(sampleInput);

assert.equal(payload.price, PARTNER_TRANSFER_PRICE_LABEL);
assert.equal(payload.paymentMethod, 'cash');
assert.equal(payload.paymentStatus, 'pending');
assert.equal(payload.fareAmount, 0);
assert.equal(payload.partnerId, sampleInput.partnerUid);
assert.equal(payload.partnerName, sampleInput.partnerName);
assert.equal(payload.status, 'En attente');
assert.equal(payload.source, 'partner');
assert.equal(payload.clientUid, sampleInput.partnerUid);
assert.equal(payload.clientName, sampleInput.clientName);

console.log('[verify-partner-booking] OK');
