export {
  appConfig,
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD,
  FEATURE_FLAGS,
  firebaseConfig,
  GOOGLE_MAPS_API_KEY,
  isFeatureEnabled,
} from '@/config/appConfig';

export {
  ENV_DEFAULTS,
  readEnvBool,
  readEnvString,
  resolveBuildTimeEnv,
  resolveRuntimeEnv,
  type AppApiConfig,
  type AppFeatureFlags,
  type FirebaseClientConfig,
} from '@/config/env';
