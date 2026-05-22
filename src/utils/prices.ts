import type { ServiceId } from '../types/reservation';

export function getBasePrice(serviceId: ServiceId) {
  if (serviceId === 'airport') {
    return 'À partir de 3 500 DA';
  }

  if (serviceId === 'hotel') {
    return 'À partir de 4 000 DA';
  }

  if (serviceId === 'city') {
    return 'Sur réservation';
  }

  return 'Sur devis';
}