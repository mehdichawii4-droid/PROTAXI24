import { Ionicons } from '@expo/vector-icons';

export type CityVehicleId =
  | 'Berline'
  | 'Confort'
  | 'Van'
  | 'VIP'
  | 'Famille'
  | 'Coffre+'
  | 'Access Standard'
  | 'Access Coffre+';

export type CityVehicleSection = 'featured' | 'essentials' | 'more' | 'accessibility';

export type CityVehicleDef = {
  id: CityVehicleId;
  title: string;
  subtitle: string;
  section: CityVehicleSection;
  extraPrice: number;
  available: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  etaOffset?: number;
  accent?: string;
};

export const CITY_VEHICLES: CityVehicleDef[] = [
  {
    id: 'Berline',
    title: 'PROTAXI Standard',
    subtitle: 'Simple et efficace',
    section: 'featured',
    extraPrice: 0,
    available: true,
    icon: 'car-sport-outline',
    accent: '#2a2a2a',
  },
  {
    id: 'Confort',
    title: 'PROTAXI Green',
    subtitle: 'Économique et écologique',
    section: 'essentials',
    extraPrice: 200,
    available: true,
    icon: 'leaf-outline',
    accent: '#1a281a',
  },
  {
    id: 'Van',
    title: 'PROTAXI Van',
    subtitle: 'Groupe et bagages',
    section: 'essentials',
    extraPrice: 400,
    available: true,
    icon: 'bus-outline',
    etaOffset: -2,
    accent: '#1a2228',
  },
  {
    id: 'VIP',
    title: 'PROTAXI VIP',
    subtitle: 'Confort premium',
    section: 'more',
    extraPrice: 600,
    available: false,
    icon: 'diamond-outline',
    accent: '#281818',
  },
  {
    id: 'Famille',
    title: 'PROTAXI Famille',
    subtitle: 'Siège enfant et famille',
    section: 'more',
    extraPrice: 300,
    available: true,
    icon: 'people-outline',
    accent: '#222018',
  },
  {
    id: 'Coffre+',
    title: 'PROTAXI Coffre+',
    subtitle: 'Bagages volumineux',
    section: 'more',
    extraPrice: 250,
    available: true,
    icon: 'briefcase-outline',
    accent: '#1c1c1c',
  },
  {
    id: 'Access Standard',
    title: 'PROTAXI Access',
    subtitle: 'Accessibilité',
    section: 'accessibility',
    extraPrice: 0,
    available: true,
    icon: 'accessibility-outline',
    etaOffset: 1,
    accent: '#182018',
  },
  {
    id: 'Access Coffre+',
    title: 'PROTAXI Access+',
    subtitle: 'Accessibilité et bagages volumineux',
    section: 'accessibility',
    extraPrice: 200,
    available: true,
    icon: 'accessibility-outline',
    etaOffset: 2,
    accent: '#182018',
  },
];

export function cityVehicleExtraPrice(id: CityVehicleId): number {
  return CITY_VEHICLES.find((item) => item.id === id)?.extraPrice ?? 0;
}

export function getCityVehicleDef(id: CityVehicleId): CityVehicleDef {
  return CITY_VEHICLES.find((item) => item.id === id) ?? CITY_VEHICLES[0];
}
