/**
 * Vérification Lot 3 — logique métier liée (sans charger Firebase/RN)
 * npx tsx scripts/verify-partner-self.mjs
 */
import assert from 'node:assert/strict';

const { PartnerServiceError } = await import('../types/partner.ts');
const { validatePartnerInput } = await import('../services/partnerCoreService.ts');

function getPartnerSelfErrorMessageLike(error) {
  if (error instanceof PartnerServiceError) {
    if (error.code === 'PARTNER_VALIDATION_FAILED' && error.fieldErrors?.length) {
      return error.fieldErrors.map((item) => item.message).join('\n');
    }
    const map = {
      PARTNER_PROFILE_NOT_EDITABLE: 'Profil non modifiable dans cet état.',
      PARTNER_HOTEL_SELF_ONLY: 'Action réservée aux comptes hôtel.',
    };
    return map[error.code] ?? error.message;
  }
  return 'fallback';
}

const validationError = new PartnerServiceError('PARTNER_VALIDATION_FAILED', 'x', {
  fieldErrors: [
    { field: 'email', message: 'Adresse email invalide.' },
    { field: 'phone', message: 'Téléphone requis.' },
  ],
});
assert.equal(
  getPartnerSelfErrorMessageLike(validationError),
  'Adresse email invalide.\nTéléphone requis.',
);

const validDescription = 'a'.repeat(30);

const hotelCreate = validatePartnerInput(
  {
    partnerUid: 'u1',
    companyName: 'Hôtel',
    partnerType: 'hotel',
    contactName: 'Contact',
    phone: '+2131',
    email: 'a@b.com',
    description: validDescription,
    status: 'pending_review',
  },
  'create',
  { hotelSelf: true },
);
assert.equal(hotelCreate.ok, true);

const agencySelf = validatePartnerInput(
  {
    partnerUid: 'u2',
    companyName: 'Agence',
    partnerType: 'agency',
    contactName: 'C',
    phone: '1',
    email: 'a@b.com',
    status: 'pending_review',
  },
  'create',
  { hotelSelf: true },
);
assert.equal(agencySelf.ok, false);

console.log('[verify-partner-self] OK — validation + error shape');
