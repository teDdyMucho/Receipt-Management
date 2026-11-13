import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../lib/session';
import { colors } from '../../lib/theme';

// The three screens every identity sees: Scan, Uploads, Settings.
export default function TabsLayout() {
  const { loading, identity, receipts } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!identity) return <Redirect href="/welcome" />;

  const waiting = receipts.filter((r) => r.sync_status !== 'synced').length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 20, fontWeight: '800', color: colors.text },
        headerTitleAlign: 'left',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Scan', tabBarIcon: ({ focused, size }) => <Ionicons name="camera" color={focused ? colors.primary : colors.muted} size={size} /> }}
      />
      <Tabs.Screen
        name="uploads"
        options={{
          title: 'Uploads',
          tabBarBadge: waiting > 0 ? waiting : undefined,
          tabBarIcon: ({ focused, size }) => <Ionicons name="cloud-upload" color={focused ? colors.primary : colors.muted} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ focused, size }) => <Ionicons name="settings" color={focused ? colors.primary : colors.muted} size={size} /> }}
      />
    </Tabs>
  );
}
