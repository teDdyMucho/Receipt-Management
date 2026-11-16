import type { ExpoConfig } from 'expo/config';

// Public values only. The app holds no Supabase key; it talks to our API.
const config: ExpoConfig = {
  name: 'Receipts',
  slug: 'lionrock-receipts',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'lionrockreceipts',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.lionrock.receipts',
    infoPlist: {
      // The app uses only standard https encryption, so no export paperwork is needed.
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'Receipts uses the camera to photograph receipts for upload.',
      NSPhotoLibraryUsageDescription: 'Receipts uses your photo library so you can choose a receipt photo to upload.',
    },
  },
  android: {
    package: 'com.lionrock.receipts',
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: { bundler: 'metro', output: 'server', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    // Test builds talk to a computer on the local network over plain http.
    // Remove usesCleartextTraffic once the server is hosted on https.
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
    'expo-sqlite',
    'expo-secure-store',
    'expo-sharing',
    '@react-native-community/datetimepicker',
    [
      'expo-image-picker',
      {
        cameraPermission: 'Receipts uses the camera to photograph receipts for upload.',
        photosPermission: 'Receipts uses your photo library so you can choose a receipt photo to upload.',
      },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
    appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0',
    eas: { projectId: '46ea388b-f184-4e68-9445-80db13df9941' },
  },
};

export default config;
