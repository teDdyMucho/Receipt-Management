import type { ExpoConfig } from 'expo/config';

// Public values only. The app holds no Supabase key; it talks to our API.
const config: ExpoConfig = {
  name: 'Lionrock',
  slug: 'lionrock-receipts',
  // 2.0.0: the version with PIN sign in, cloud history, staff accounts and the audit log.
  version: '2.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'lionrockreceipts',
  ios: {
    supportsTablet: true,
    // The app that already exists in App Store Connect under this id (the first build was submitted to it).
    bundleIdentifier: 'com.lionrock.receipts',
    infoPlist: {
      // The app uses only standard https encryption, so no export paperwork is needed.
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'Lionrock uses the camera to photograph receipts for upload.',
      NSPhotoLibraryUsageDescription: 'Lionrock uses your photo library so you can choose a receipt photo to upload.',
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
    // asyncRoutes off: with it on, the development server loads each tab the first time it is
    // opened and shows a black "Bundling..." box at the bottom of the screen while it does.
    ['expo-router', { asyncRoutes: false }],
    ['expo-camera', { cameraPermission: 'Lionrock uses the camera to photograph receipts for upload.', recordAudioAndroid: false }],
    'expo-sqlite',
    'expo-secure-store',
    'expo-sharing',
    '@react-native-community/datetimepicker',
    [
      'expo-image-picker',
      {
        cameraPermission: 'Lionrock uses the camera to photograph receipts for upload.',
        photosPermission: 'Lionrock uses your photo library so you can choose a receipt photo to upload.',
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
