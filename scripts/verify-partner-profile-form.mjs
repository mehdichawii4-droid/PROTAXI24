/**
 * Lot 6 — HotelPartnerProfileForm validation
 * npx tsx scripts/verify-partner-profile-form.mjs
 */
import assert from 'node:assert/strict';

const {
  validateHotelPartnerProfileFormValues,
  isHotelPartnerProfileFormValid,
  HOTEL_DESCRIPTION_MIN_LENGTH,
} = await import('../utils/partnerProfileFormValidation.ts');
const { createEmptyHotelPartnerProfileFormValues } = await import('../types/partnerProfileForm.ts');

const empty = createEmptyHotelPartnerProfileFormValues();
const emptyErrors = validateHotelPartnerProfileFormValues(empty);
assert.ok(emptyErrors.length >= 6);
assert.equal(isHotelPartnerProfileFormValid(empty), false);

const valid = {
  companyName: 'Hôtel Test',
  contactName: 'Manager',
  phone: '+213555',
  email: 'hotel@test.com',
  address: '12 rue principale',
  city: 'Guelma',
  description: 'a'.repeat(HOTEL_DESCRIPTION_MIN_LENGTH),
  website: '',
};
assert.equal(isHotelPartnerProfileFormValid(valid), true);

const badEmail = { ...valid, email: 'not-an-email' };
assert.equal(isHotelPartnerProfileFormValid(badEmail), false);

const badWebsite = { ...valid, website: 'invalid' };
assert.equal(isHotelPartnerProfileFormValid(badWebsite), false);

const okWebsite = { ...valid, website: 'https://hotel.test.com' };
assert.equal(isHotelPartnerProfileFormValid(okWebsite), true);

console.log('[verify-partner-profile-form] OK', {
  emptyErrorCount: emptyErrors.length,
  descMin: HOTEL_DESCRIPTION_MIN_LENGTH,
});
