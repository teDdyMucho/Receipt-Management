import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, View } from 'react-native';
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
        <Stack.Screen name="receipt-management" options={{ headerShown: false }} />
      </Stack>
      </View>
    </SessionProvider>
  );
}
