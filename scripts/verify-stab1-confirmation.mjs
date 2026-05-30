/**
 * STAB-1 — confirmation payload normalization (pure functions).
 * node scripts/verify-stab1-confirmation.mjs
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
  path.join(__dirname, '..', 'services', 'confirmationRidePayload.ts'),
).href;

const {
  resolveConfirmationContact,
  resolveConfirmationLocations,
} = await import(moduleUrl);

const locationsFromCity = resolveConfirmationLocations({
  departure: 'Place Centrale',
  destination: 'Théâtre romain',
});
assert.equal(locationsFromCity.departure, 'Place Centrale');
assert.equal(locationsFromCity.destination, 'Théâtre romain');

const locationsFromAirport = resolveConfirmationLocations({
  address: '12 rue Example',
  airport: 'Aéroport Annaba',
});
assert.equal(locationsFromAirport.departure, '12 rue Example');
assert.equal(locationsFromAirport.destination, 'Aéroport Annaba');

const departurePriority = resolveConfirmationLocations({
  departure: 'Départ prioritaire',
  address: 'Adresse secondaire',
});
assert.equal(departurePriority.departure, 'Départ prioritaire');

const contactFromParams = resolveConfirmationContact(
  { fullName: 'Client Formulaire', phone: '0555123456' },
  { fullName: 'Profil Auth', phone: '0666000000' },
);
assert.equal(contactFromParams.clientName, 'Client Formulaire');
assert.equal(contactFromParams.clientPhone, '0555123456');

const contactFromProfile = resolveConfirmationContact({}, { fullName: 'Profil Auth', phone: '0666000000' });
assert.equal(contactFromProfile.clientName, 'Profil Auth');
assert.equal(contactFromProfile.clientPhone, '0666000000');

console.log('verify-stab1-confirmation: OK');
