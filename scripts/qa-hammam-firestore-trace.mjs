/**
 * Trace QA — Hammam Debagh Signature (Expérience privée V1)
 * Usage: node scripts/qa-hammam-firestore-trace.mjs
 */
const hammamHighlights = [
  'Cascade de Hammam Debagh',
  'Cônes calcaires',
  'Sources thermales',
  'Points photo',
];
const protaxiIncludes = [
  'Transport privé PROTAXI',
  'Chauffeur privé PROTAXI',
  'Conciergerie PROTAXI',
];

const sampleDoc = {
  clientUid: '<uid>',
  experience: 'Hammam Debagh Signature',
  circuitName: 'Hammam Debagh Signature',
  formula: 'Expérience privée',
  bookingMode: 'private',
  duration: 'Demi-journée',
  steps: [...protaxiIncludes, ...hammamHighlights].join(', '),
  options: 'Guide local, Photographe',
  travelers: '2',
  date: '15/06/2026 • 09:30',
  meetingPoint: 'À confirmer par PROTAXI',
  notes: 'Aucune note',
  price: 'Sur confirmation',
  source: 'experiences-private',
  status: 'pending',
};

console.log('=== QA Hammam Debagh Signature — document tourBookings attendu ===\n');
console.log(JSON.stringify(sampleDoc, null, 2));
console.log('\n=== Vérifications manuelles ===');
console.log('[ ] Console Firebase : champs ci-dessus après réservation test');
console.log('[ ] Historique : Voir la demande → experience-confirmed');
console.log('[ ] Admin : Source = Expériences privées, Options visibles');
console.log('[ ] Prix affiché : Sur confirmation (pas vide, pas 0 DA)');
