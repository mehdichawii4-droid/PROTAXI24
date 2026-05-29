import type { ConfigContext, ExpoConfig } from 'expo/config';

import { resolveBuildTimeEnv } from './config/env.node.js';

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = resolveBuildTimeEnv();

  return {
    ...config,
    name: 'PROTAXI24',
    slug: 'PROTAXI24',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'protaxi24',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.protaxi24.app',
    },
    android: {
      package: 'com.protaxi24.app',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      '@react-native-community/datetimepicker',
      'expo-notifications',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    owner: 'mehdiramoul',
    extra: {
      router: {},
      eas: {
        projectId: env.easProjectId,
      },
      googleMapsApiKey: env.googleMapsApiKey,
      firebase: env.firebase,
      api: env.api,
      bootstrapAdmin: {
        email: env.bootstrapAdminEmail,
        password: env.bootstrapAdminPassword,
      },
      features: env.features,
    },
  };
};
