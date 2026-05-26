export type DriverStatus = 'Disponible' | 'Occupé' | 'Hors ligne';

export type Driver = {
  id: string;
  name: string;
  phone: string;
  car: string;
  plate: string;
  status: DriverStatus;
  rating: string;
};

export type RequestStatus =
  | 'En attente'
  | 'Confirmée'
  | 'Attribuée'
  | 'Terminée';

export type TaxiRequest = {
  id: string;
  client: string;
  phone: string;
  service: string;
  departure: string;
  destination: string;
  price: string;
  time: string;
  status: RequestStatus;
  driverName?: string;
  driverCar?: string;
  driverPhone?: string;
};

export const drivers: Driver[] = [
  {
    id: 'DRV-001',
    name: 'Taxi Mehdi 24',
    phone: '+213555111222',
    car: 'Renault Clio',
    plate: '24-000-16',
    status: 'Disponible',
    rating: '4.9',
  },
  {
    id: 'DRV-002',
    name: 'Walid',
    phone: '+213555222333',
    car: 'Hyundai Accent',
    plate: '18-222-24',
    status: 'Occupé',
    rating: '4.7',
  },
  {
    id: 'DRV-003',
    name: 'Sofiane',
    phone: '+213555333444',
    car: 'Dacia Logan',
    plate: '19-333-24',
    status: 'Hors ligne',
    rating: '4.8',
  },
];

export const taxiRequests: TaxiRequest[] = [
  {
    id: 'REQ-001',
    client: 'Client PROTAXI',
    phone: '+213555000111',
    service: 'Aéroport',
    departure: 'Guelma centre',
    destination: 'Aéroport Annaba',
    price: '4 000 DA',
    time: 'Aujourd’hui • 18:30',
    status: 'En attente',
  },
  {
    id: 'REQ-002',
    client: 'Mehdi Ramoul',
    phone: '+213555000222',
    service: 'Hôtel',
    departure: 'Guelma',
    destination: 'Constantine Marriott',
    price: '17 000 DA',
    time: 'Demain • 09:00',
    status: 'Confirmée',
  },
  {
    id: 'REQ-003',
    client: 'Client VIP',
    phone: '+213555000333',
    service: 'Prise en charge',
    departure: 'Guelma',
    destination: 'Annaba',
    price: '8 000 DA',
    time: 'Aujourd’hui • Maintenant',
    status: 'Attribuée',
  },
];
