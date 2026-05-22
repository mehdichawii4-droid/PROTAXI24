export type ServiceId =
  | 'airport'
  | 'hotel'
  | 'city'
  | 'distance';

export type Reservation = {
  id: string;
  serviceId: ServiceId;
  serviceTitle: string;
  from: string;
  to: string;
  date: string;
  time: string;
  passengers: number;
  bags: number;
  vehicle: string;
  payment: string;
  price: string;
  status: 'À venir' | 'Passée' | 'Annulée';
};