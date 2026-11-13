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
  },
};

export default config;
