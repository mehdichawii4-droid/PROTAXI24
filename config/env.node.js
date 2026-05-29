/** Build-time env for app.config.ts — plain Node, no TS/RN. */

const ENV_DEFAULTS = {
  easProjectId: '6650d953-f840-42a9-8e99-edf8629a1042',
  googleMapsApiKey: 'AIzaSyDYdlqeE8VAWNC8zry90jywNt5ia7vte9E',
  firebase: {
    apiKey: 'AIzaSyCHQEB_GamG0xcZlmKxLF4jLX4-vuOx5hc',
    authDomain: 'protaxi24-8abf2.firebaseapp.com',
    projectId: 'protaxi24-8abf2',
    storageBucket: 'protaxi24-8abf2.firebasestorage.app',
    messagingSenderId: '750646832518',
    appId: '1:750646832518:web:2ea2e798c86c3529031007',
  },
  bootstrapAdminEmail: 'admin@protaxi.dz',
  bootstrapAdminPassword: 'ProtaxiAdmin24!',
  apiBaseUrl: '',
  firebaseFunctionsRegion: 'europe-west1',
  features: {
    enableChatPush: true,
    enableRidePayment: true,
    enableRatingsV2: true,
  },
};

function readEnvString(key, fallback = '') {
  const raw = process.env[key];
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return fallback;
}

function readEnvBool(key, fallback) {
  const raw = readEnvString(key);
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function mergeFirebaseConfig(partial) {
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

function resolveBuildTimeEnv() {
  return {
    easProjectId: readEnvString(
      'EXPO_PUBLIC_EAS_PROJECT_ID',
      ENV_DEFAULTS.easProjectId,
    ),
    googleMapsApiKey: readEnvString(
      'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
      ENV_DEFAULTS.googleMapsApiKey,
    ),
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

module.exports = {
  ENV_DEFAULTS,
  resolveBuildTimeEnv,
};
