import { router, type Href } from 'expo-router';

import type { DiscoverExperienceNavigationParams } from '@/types/discover';

export const PROTAXI_ROUTES = {
  home: '/',
  city: '/city',
  privateDriver: '/private-driver',
  airport: '/airport-transfer',
  hotel: '/hotel',
  longDistance: '/prise-en-charge',
  discoverGuelma: '/discover-guelma',
  discoverBooking: '/discover-booking',
  experiencesPrivate: '/experiences-private',
  experienceConfirmed: '/experience-confirmed',
  tourBooking: '/tour-booking',
  tourSummary: '/tour-summary',
  tourStaffDashboard: '/tour-staff-dashboard',
  partnerRegister: '/partner-register',
  partnerDashboard: '/partner-dashboard',
  partnerProfile: '/partner-profile',
  partnerNewBooking: '/partner-new-booking',
  adminPartners: '/admin-partners',
  adminPartnerDetails: '/admin-partner-details',
  adminHotels: '/admin-hotels',
  adminHotelDetails: '/admin-hotel-details',
  adminGuides: '/admin-guides',
  adminGuideDetails: '/admin-guide-details',
  guideRegister: '/guide-register',
  guideDashboard: '/guide-dashboard',
  guideProfile: '/guide-profile',
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

export type ExperiencesPrivateNavigationParams = DiscoverExperienceNavigationParams;

export function buildExperiencesPrivateRoute(
  params?: ExperiencesPrivateNavigationParams,
): { pathname: typeof PROTAXI_ROUTES.experiencesPrivate; params: Record<string, string> } {
  const routeParams: Record<string, string> = {};
  if (params?.experienceId) {
    routeParams.experienceId = params.experienceId;
  }
  if (params?.source) {
    routeParams.source = params.source;
  }
  if (params?.preselectOption) {
    routeParams.preselectOption = params.preselectOption;
  }
  return {
    pathname: PROTAXI_ROUTES.experiencesPrivate,
    params: routeParams,
  };
}

export function navigateToExperiencesPrivate(
  context: ProtaxiNavigationContext,
  params?: ExperiencesPrivateNavigationParams,
) {
  const route = buildExperiencesPrivateRoute(params);
  const query = Object.entries(route.params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const routeLabel = query
    ? `${route.pathname}?${query}`
    : route.pathname;
  logNavigation(routeLabel, context);
  router.push(route as Href);
}

export function navigateToHotelFromDiscover(
  context: ProtaxiNavigationContext,
  source: string,
) {
  navigateTo(
    {
      pathname: PROTAXI_ROUTES.hotel,
      params: { source },
    } as Href,
    context,
  );
}
