import {
  resolveRuntimeEnv,
  type AppApiConfig,
  type AppFeatureFlags,
  type FirebaseClientConfig,
} from '@/config/env';

const env = resolveRuntimeEnv();

export const appConfig = {
  app: {
    name: 'PROTAXI24',
    scheme: 'protaxi24',
    bundleId: 'com.protaxi24.app',
  },
  expo: {
    easProjectId: env.easProjectId,
  },
  firebase: env.firebase satisfies FirebaseClientConfig,
  googleMapsApiKey: env.googleMapsApiKey,
  api: env.api satisfies AppApiConfig,
  bootstrapAdmin: {
    email: env.bootstrapAdminEmail,
    password: env.bootstrapAdminPassword,
  },
  features: env.features satisfies AppFeatureFlags,
} as const;

/** @deprecated Import from `@/config/appConfig` — kept for stable legacy imports. */
export const firebaseConfig = appConfig.firebase;

/** @deprecated Import from `@/config/appConfig` — kept for stable legacy imports. */
export const BOOTSTRAP_ADMIN_EMAIL = appConfig.bootstrapAdmin.email;

/** @deprecated Import from `@/config/appConfig` — kept for stable legacy imports. */
export const BOOTSTRAP_ADMIN_PASSWORD = appConfig.bootstrapAdmin.password;

/** @deprecated Import from `@/config/appConfig` — kept for stable legacy imports. */
export const GOOGLE_MAPS_API_KEY = appConfig.googleMapsApiKey;

export function isFeatureEnabled(flag: keyof AppFeatureFlags): boolean {
  return appConfig.features[flag];
}

export const FEATURE_FLAGS = {
  ENABLE_CHAT_PUSH: 'enableChatPush',
  ENABLE_RIDE_PAYMENT: 'enableRidePayment',
  ENABLE_RATINGS_V2: 'enableRatingsV2',
} as const satisfies Record<string, keyof AppFeatureFlags>;
