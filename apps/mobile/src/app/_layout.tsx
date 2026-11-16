import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, View } from 'react-native';
import { DialogHost } from '../components/DialogHost';
import { FileViewer } from '../components/FileViewer';
import { SessionProvider } from '../lib/session';

// Root navigator. The tab screens redirect to /welcome until an identity is set.
export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      {/* In a browser the app is shown at phone width, centred. */}
      <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' } : { flex: 1 }}>
      <Stack screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/[id]" options={{ title: 'Receipt Data', presentation: 'modal' }} />
        <Stack.Screen name="receipt/[id]" options={{ title: 'Receipt' }} />
        <Stack.Screen name="edit/[id]" options={{ title: 'Edit receipt', presentation: 'modal' }} />
        <Stack.Screen name="camera" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="privacy" options={{ headerShown: false, title: 'Privacy Policy' }} />
        <Stack.Screen name="receipt-management" options={{ headerShown: false }} />
      </Stack>
      </View>
      <FileViewer />
      <DialogHost />
    </SessionProvider>
  );
}
