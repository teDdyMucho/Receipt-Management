import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../lib/session';
import { colors } from '../../lib/theme';

// A link name sees Scan, History and Settings (its own profile).
// For staff, History shows the receipts of every person who uses the app,
// and an admin also sees Staff (staff accounts).
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
          title: 'History',
          tabBarBadge: waiting > 0 ? waiting : undefined,
          tabBarIcon: ({ focused, size }) => <Ionicons name="time" color={focused ? colors.primary : colors.muted} size={size} />,
        }}
      />
      <Tabs.Screen
        name="staff"
        options={{
          title: 'Staff',
          // Admin only: make staff accounts. The server refuses everyone else.
          href: identity.kind === 'staff' && identity.role === 'admin' ? undefined : null,
          tabBarIcon: ({ focused, size }) => <Ionicons name="person-add" color={focused ? colors.primary : colors.muted} size={size} />,
        }}
      />
      <Tabs.Screen
        name="audit"
        options={{
          title: 'Audit',
          // Admin only: who uploaded, edited or deleted. The server refuses everyone else.
          href: identity.kind === 'staff' && identity.role === 'admin' ? undefined : null,
          tabBarIcon: ({ focused, size }) => <Ionicons name="list" color={focused ? colors.primary : colors.muted} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ focused, size }) => <Ionicons name="settings" color={focused ? colors.primary : colors.muted} size={size} /> }}
      />
    </Tabs>
  );
}
