/**
 * Mobilité V1 — scheduled city ride type helpers.
 * npx tsx scripts/verify-scheduled-city-ride.mjs
 */
import assert from 'node:assert/strict';

const {
  SCHEDULED_AIRPORT_RIDE_MODE,
  canClientCancelReservation,
  canClientOpenCourseTracking,
  getClientReservationStatusLabel,
  isScheduledAirportRide,
  isScheduledCityRide,
  isScheduledManagedRide,
  isScheduledPrivateDriverRide,
} = await import('../types/driver.ts');

const scheduledCity = {
  rideType: 'city',
  rideMode: SCHEDULED_AIRPORT_RIDE_MODE,
};

const scheduledAirport = {
  rideType: 'airport',
  rideMode: SCHEDULED_AIRPORT_RIDE_MODE,
};

const scheduledPrivate = {
  rideType: 'private_driver',
  rideMode: SCHEDULED_AIRPORT_RIDE_MODE,
};

const immediateCity = {
  service: 'Ville 24H',
  rideMode: 'Maintenant',
  status: 'En attente',
};

assert.equal(isScheduledCityRide(scheduledCity), true);
assert.equal(isScheduledCityRide(scheduledAirport), false);
assert.equal(isScheduledCityRide(scheduledPrivate), false);
assert.equal(isScheduledCityRide({ rideType: 'city', rideMode: 'Maintenant' }), false);
assert.equal(isScheduledCityRide(null), false);

assert.equal(isScheduledManagedRide(scheduledCity), true);
assert.equal(isScheduledManagedRide(scheduledAirport), true);
assert.equal(isScheduledManagedRide(scheduledPrivate), true);
assert.equal(isScheduledManagedRide(immediateCity), false);

assert.equal(
  getClientReservationStatusLabel('Confirmée', scheduledCity),
  'Course confirmée',
);
assert.equal(
  getClientReservationStatusLabel('Confirmée', scheduledAirport),
  'Transfert confirmé',
);
assert.equal(
  getClientReservationStatusLabel('Confirmée', scheduledPrivate),
  'Demande confirmée',
);
assert.equal(
  getClientReservationStatusLabel('À attribuer', scheduledCity),
  'Préparation en cours',
);

assert.equal(canClientOpenCourseTracking('Confirmée', scheduledCity), false);
assert.equal(canClientOpenCourseTracking('En route', scheduledCity), true);
assert.equal(canClientOpenCourseTracking('Arrivé', scheduledCity), true);
assert.equal(canClientOpenCourseTracking('En attente', immediateCity), true);

assert.equal(canClientCancelReservation('Confirmée', scheduledCity), true);
assert.equal(canClientCancelReservation('Chauffeur confirmé', scheduledCity), true);
assert.equal(canClientCancelReservation('En route', scheduledCity), false);
assert.equal(canClientCancelReservation('En attente', immediateCity), true);

console.log('verify-scheduled-city-ride: OK');
