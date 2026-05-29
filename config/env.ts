import Constants from 'expo-constants';

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export type AppFeatureFlags = {
  enableChatPush: boolean;
  enableRidePayment: boolean;
  enableRatingsV2: boolean;
};

export type AppApiConfig = {
  /** Reserved for future REST endpoints. */
  baseUrl: string;
  firebaseFunctionsRegion: string;
};

/** Local dev fallbacks — override via EXPO_PUBLIC_* or `.env`. */
export const ENV_DEFAULTS = {
  easProjectId: '6650d953-f840-42a9-8e99-edf8629a1042',
  googleMapsApiKey: 'AIzaSyDYdlqeE8VAWNC8zry90jywNt5ia7vte9E',
  firebase: {
    apiKey: 'AIzaSyCHQEB_GamG0xcZlmKxLF4jLX4-vuOx5hc',
    authDomain: 'protaxi24-8abf2.firebaseapp.com',
    projectId: 'protaxi24-8abf2',
    storageBucket: 'protaxi24-8abf2.firebasestorage.app',
    messagingSenderId: '750646832518',
    appId: '1:750646832518:web:2ea2e798c86c3529031007',
  } satisfies FirebaseClientConfig,
  bootstrapAdminEmail: 'admin@protaxi.dz',
  bootstrapAdminPassword: 'ProtaxiAdmin24!',
  apiBaseUrl: '',
  firebaseFunctionsRegion: 'europe-west1',
  features: {
    enableChatPush: true,
    enableRidePayment: true,
    enableRatingsV2: true,
  } satisfies AppFeatureFlags,
} as const;

type ExpoExtra = {
  eas?: { projectId?: string };
  googleMapsApiKey?: string;
  firebase?: Partial<FirebaseClientConfig>;
  api?: Partial<AppApiConfig>;
  features?: Partial<AppFeatureFlags>;
  bootstrapAdmin?: {
    email?: string;
    password?: string;
  };
};

export function readEnvString(
  key: string,
  fallback = '',
): string {
  const raw = process.env[key];
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return fallback;
}

export function readEnvBool(
  key: string,
  fallback: boolean,
): boolean {
  const raw = readEnvString(key);
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function readExpoExtra(): ExpoExtra {
  const extra = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object') {
    return {};
  }
  return extra as ExpoExtra;
}

function mergeFirebaseConfig(
  partial?: Partial<FirebaseClientConfig>,
): FirebaseClientConfig {
  const defaults = ENV_DEFAULTS.firebase;
  return {
    apiKey: partial?.apiKey?.trim() || defaults.apiKey,
    authDomain: partial?.authDomain?.trim() || defaults.authDomain,
    projectId: partial?.projectId?.trim() || defaults.projectId,
    storageBucket: partial?.storageBucket?.trim() || defaults.storageBucket,
    messagingSenderId:
      partial?.messagingSenderId?.trim() || defaults.messagingSenderId,
    appId: partial?.appId?.trim() || defaults.appId,
  };
}

function mergeFeatureFlags(
  partial?: Partial<AppFeatureFlags>,
): AppFeatureFlags {
  const defaults = ENV_DEFAULTS.features;
  return {
    enableChatPush: partial?.enableChatPush ?? defaults.enableChatPush,
    enableRidePayment: partial?.enableRidePayment ?? defaults.enableRidePayment,
    enableRatingsV2: partial?.enableRatingsV2 ?? defaults.enableRatingsV2,
  };
}

/** Build-time resolver (app.config.ts) — uses process.env only. */
export function resolveBuildTimeEnv() {
  return {
    easProjectId:
      readEnvString('EXPO_PUBLIC_EAS_PROJECT_ID', ENV_DEFAULTS.easProjectId),
    googleMapsApiKey:
      readEnvString('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', ENV_DEFAULTS.googleMapsApiKey),
    firebase: mergeFirebaseConfig({
      apiKey: readEnvString('EXPO_PUBLIC_FIREBASE_API_KEY'),
      authDomain: readEnvString('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
      projectId: readEnvString('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
      storageBucket: readEnvString('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: readEnvString('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
      appId: readEnvString('EXPO_PUBLIC_FIREBASE_APP_ID'),
    }),
    bootstrapAdminEmail: readEnvString(
      'EXPO_PUBLIC_BOOTSTRAP_ADMIN_EMAIL',
      ENV_DEFAULTS.bootstrapAdminEmail,
    ),
    bootstrapAdminPassword: readEnvString(
      'EXPO_PUBLIC_BOOTSTRAP_ADMIN_PASSWORD',
      ENV_DEFAULTS.bootstrapAdminPassword,
    ),
    api: {
      baseUrl: readEnvString('EXPO_PUBLIC_API_BASE_URL', ENV_DEFAULTS.apiBaseUrl),
      firebaseFunctionsRegion: readEnvString(
        'EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION',
        ENV_DEFAULTS.firebaseFunctionsRegion,
      ),
    },
    features: {
      enableChatPush: readEnvBool(
        'EXPO_PUBLIC_ENABLE_CHAT_PUSH',
        ENV_DEFAULTS.features.enableChatPush,
      ),
      enableRidePayment: readEnvBool(
        'EXPO_PUBLIC_ENABLE_RIDE_PAYMENT',
        ENV_DEFAULTS.features.enableRidePayment,
      ),
      enableRatingsV2: readEnvBool(
        'EXPO_PUBLIC_ENABLE_RATINGS_V2',
        ENV_DEFAULTS.features.enableRatingsV2,
      ),
    },
  };
}

/** Runtime resolver — process.env (inlined) + expo `extra` from app.config. */
export function resolveRuntimeEnv() {
  const extra = readExpoExtra();
  const build = resolveBuildTimeEnv();

  return {
    easProjectId:
      readEnvString('EXPO_PUBLIC_EAS_PROJECT_ID')
      || extra.eas?.projectId?.trim()
      || build.easProjectId,
    googleMapsApiKey:
      readEnvString('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY')
      || extra.googleMapsApiKey?.trim()
      || build.googleMapsApiKey,
    firebase: mergeFirebaseConfig({
      ...build.firebase,
      ...extra.firebase,
      apiKey:
        readEnvString('EXPO_PUBLIC_FIREBASE_API_KEY')
        || extra.firebase?.apiKey
        || build.firebase.apiKey,
      authDomain:
        readEnvString('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN')
        || extra.firebase?.authDomain
        || build.firebase.authDomain,
      projectId:
        readEnvString('EXPO_PUBLIC_FIREBASE_PROJECT_ID')
        || extra.firebase?.projectId
        || build.firebase.projectId,
      storageBucket:
        readEnvString('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET')
        || extra.firebase?.storageBucket
        || build.firebase.storageBucket,
      messagingSenderId:
        readEnvString('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')
        || extra.firebase?.messagingSenderId
        || build.firebase.messagingSenderId,
      appId:
        readEnvString('EXPO_PUBLIC_FIREBASE_APP_ID')
        || extra.firebase?.appId
        || build.firebase.appId,
    }),
    bootstrapAdminEmail:
      readEnvString('EXPO_PUBLIC_BOOTSTRAP_ADMIN_EMAIL')
      || extra.bootstrapAdmin?.email?.trim()
      || build.bootstrapAdminEmail,
    bootstrapAdminPassword:
      readEnvString('EXPO_PUBLIC_BOOTSTRAP_ADMIN_PASSWORD')
      || extra.bootstrapAdmin?.password
      || build.bootstrapAdminPassword,
    api: {
      baseUrl:
        readEnvString('EXPO_PUBLIC_API_BASE_URL')
        || extra.api?.baseUrl?.trim()
        || build.api.baseUrl,
      firebaseFunctionsRegion:
        readEnvString('EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION')
        || extra.api?.firebaseFunctionsRegion?.trim()
        || build.api.firebaseFunctionsRegion,
    },
    features: mergeFeatureFlags({
      ...build.features,
      ...extra.features,
      enableChatPush: readEnvBool(
        'EXPO_PUBLIC_ENABLE_CHAT_PUSH',
        extra.features?.enableChatPush ?? build.features.enableChatPush,
      ),
      enableRidePayment: readEnvBool(
        'EXPO_PUBLIC_ENABLE_RIDE_PAYMENT',
        extra.features?.enableRidePayment ?? build.features.enableRidePayment,
      ),
      enableRatingsV2: readEnvBool(
        'EXPO_PUBLIC_ENABLE_RATINGS_V2',
        extra.features?.enableRatingsV2 ?? build.features.enableRatingsV2,
      ),
    }),
  };
}
