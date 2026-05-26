import { normalizeTourGroupTrackingStatus } from '@/services/tourGroupMatching';

export type TourWeatherCondition = 'sunny' | 'cloudy' | 'windy' | 'hot' | 'night';

export type TourWeather = {
  condition: TourWeatherCondition;
  temperatureC: number;
  conditionLabel: string;
  recommendation: string;
  badge: string;
  color: string;
  glow: string;
  border: string;
  icon: string;
};

export type GenerateTourWeatherInput = {
  departure?: string;
  trackingStatus?: string;
  experience?: string;
};

const WEATHER_CONFIG: Record<
  TourWeatherCondition,
  Omit<TourWeather, 'condition' | 'temperatureC'>
> = {
  sunny: {
    conditionLabel: 'Ensoleillé',
    recommendation: 'Conditions idéales pour l’excursion.',
    badge: '☀️ Conditions idéales',
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.18)',
    border: 'rgba(245,158,11,0.35)',
    icon: 'sunny-outline',
  },
  cloudy: {
    conditionLabel: 'Nuageux',
    recommendation: 'Ciel voilé — prévoir lunettes et eau.',
    badge: '🌥️ Ciel voilé',
    color: '#94A3B8',
    glow: 'rgba(148,163,184,0.18)',
    border: 'rgba(148,163,184,0.32)',
    icon: 'cloudy-outline',
  },
  windy: {
    conditionLabel: 'Vent modéré',
    recommendation: 'Prévoir veste légère et chapeau.',
    badge: '🌬️ Prévoir veste légère',
    color: '#38BDF8',
    glow: 'rgba(56,189,248,0.18)',
    border: 'rgba(56,189,248,0.32)',
    icon: 'flag-outline',
  },
  hot: {
    conditionLabel: 'Chaleur marquée',
    recommendation: 'Température élevée — hydratation conseillée.',
    badge: '🔥 Hydratation conseillée',
    color: '#EF4444',
    glow: 'rgba(239,68,68,0.18)',
    border: 'rgba(239,68,68,0.32)',
    icon: 'flame-outline',
  },
  night: {
    conditionLabel: 'Ambiance nocturne',
    recommendation: 'Excursion en soirée — veste légère recommandée.',
    badge: '🌙 Excursion nocturne',
    color: '#A78BFA',
    glow: 'rgba(167,139,250,0.18)',
    border: 'rgba(167,139,250,0.32)',
    icon: 'moon-outline',
  },
};

export function parseDepartureHour(departure?: string) {
  if (!departure) return 17;
  const match = departure.match(/(\d{1,2})[:h](\d{2})/i);
  if (!match) return 17;
  return Number(match[1]);
}

function hashExperience(value?: string) {
  const text = String(value || 'PROTAXI').toUpperCase();
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash + text.charCodeAt(index) * (index + 3)) % 997;
  }
  return hash;
}

function inferWeatherCondition(input: GenerateTourWeatherInput, hour: number): TourWeatherCondition {
  const experience = String(input.experience || '').toLowerCase();
  const trackingStatus = normalizeTourGroupTrackingStatus(input.trackingStatus) || 'preparing';

  if (
    hour >= 20 ||
    hour < 6 ||
    experience.includes('noct') ||
    experience.includes('soir') ||
    experience.includes('night')
  ) {
    return 'night';
  }

  if (
    experience.includes('mont') ||
    experience.includes('colline') ||
    experience.includes('randonn') ||
    experience.includes('vent')
  ) {
    return 'windy';
  }

  if (
    hour >= 12 &&
    hour <= 16 &&
    (experience.includes('guelma') ||
      experience.includes('therm') ||
      experience.includes('desert') ||
      experience.includes('sud') ||
      trackingStatus === 'in-tour')
  ) {
    return 'hot';
  }

  if (hour >= 10 && hour <= 17 && hashExperience(input.experience) % 3 === 0) {
    return 'sunny';
  }

  if (hour >= 7 && hour <= 11) {
    return 'cloudy';
  }

  if (trackingStatus === 'on-the-way' || trackingStatus === 'arrived') {
    return hour >= 15 ? 'windy' : 'sunny';
  }

  return hour >= 18 ? 'cloudy' : 'sunny';
}

function inferTemperature(condition: TourWeatherCondition, hour: number, experience?: string) {
  const seed = hashExperience(experience) % 5;

  switch (condition) {
    case 'night':
      return 14 + seed;
    case 'hot':
      return 32 + seed;
    case 'windy':
      return 22 + (seed % 3);
    case 'cloudy':
      return 20 + seed;
    case 'sunny':
    default:
      if (hour < 10) return 19 + seed;
      if (hour < 17) return 26 + seed;
      return 23 + seed;
  }
}

export function generateTourWeather(input: GenerateTourWeatherInput): TourWeather {
  const hour = parseDepartureHour(input.departure);
  const condition = inferWeatherCondition(input, hour);
  const config = WEATHER_CONFIG[condition];
  const temperatureC = inferTemperature(condition, hour, input.experience);

  return {
    condition,
    temperatureC,
    ...config,
  };
}

export function formatTourWeatherTemperature(temperatureC: number) {
  return `${temperatureC}°C`;
}

export function getTourWeatherGlowOpacity(trackingStatus?: string) {
  const status = normalizeTourGroupTrackingStatus(trackingStatus);
  if (status === 'in-tour') return 0.42;
  if (status === 'on-the-way' || status === 'arrived') return 0.28;
  return 0.16;
}

export function getGuideWeatherRecommendation(weather: TourWeather) {
  switch (weather.condition) {
    case 'hot':
      return 'Prioriser pauses ombragées et distribution d’eau avant le circuit.';
    case 'windy':
      return 'Adapter le briefing sécurité et prévoir arrêts abrités.';
    case 'night':
      return 'Vérifier éclairage groupe et timing retour avant la tombée de nuit.';
    case 'cloudy':
      return 'Anticiper ciel changeant et confirmer le confort des participants.';
    case 'sunny':
    default:
      return 'Conditions favorables — maintenir le rythme excursion premium.';
  }
}
