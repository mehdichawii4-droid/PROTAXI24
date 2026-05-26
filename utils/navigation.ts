import { router, type Href } from 'expo-router';

export const PROTAXI_ROUTES = {
  home: '/',
  city: '/city',
  airport: '/reservation-details',
  hotel: '/hotel',
  longDistance: '/prise-en-charge',
  discoverGuelma: '/discover-guelma',
  discoverBooking: '/discover-booking',
  tourBooking: '/tour-booking',
  tourSummary: '/tour-summary',
  tourStaffDashboard: '/tour-staff-dashboard',
  partnerDashboard: '/partner-dashboard',
  partnerNewBooking: '/partner-new-booking',
  adminPartners: '/admin-partners',
  adminPartnerDetails: '/admin-partner-details',
  menu: '/menu',
  reservation: '/reservation',
  history: '/history',
  notifications: '/notifications',
  profile: '/profile',
  support: '/support',
} as const;

export type ProtaxiNavigationContext = {
  source: string;
  label: string;
};

export function logNavigation(route: Href | string, context: ProtaxiNavigationContext) {
  if (__DEV__) {
    console.log(
      `[PROTAXI NAV] ${context.label} → ${String(route)} (source: ${context.source})`
    );
  }
}

export function navigateTo(route: Href | string, context: ProtaxiNavigationContext) {
  logNavigation(route, context);
  router.push(route as Href);
}

export function navigateReplace(route: Href | string, context: ProtaxiNavigationContext) {
  logNavigation(route, context);
  router.replace(route as Href);
}
