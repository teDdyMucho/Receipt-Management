import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ProfileSettings } from '../../components/ProfileSettings';
import { ThisPhoneCard } from '../../components/ThisPhoneCard';
import { Button, Card, SectionTitle } from '../../components/ui';
import { confirm } from '../../lib/dialog';
import { useSession } from '../../lib/session';
import { colors, space } from '../../lib/theme';

// Settings (spec 8.6). Receipts live in the cloud, so there is nothing to set up for uploading.
export default function Settings() {
  const { identity, receipts, signOut } = useSession();
  const waiting = receipts.length;

  const leave = () => {
    const warning =
      waiting > 0
        ? `${waiting} receipt${waiting === 1 ? ' has' : 's have'} not uploaded yet. They stay on this phone under "${identity?.name}" until you sign in again and upload them.`
        : 'You will need your email and password to sign in again.';
    void confirm({ title: 'Sign out?', message: warning, confirmLabel: 'Sign out', destructive: true, icon: 'log-out-outline' }).then(
      async (ok) => {
        if (!ok) return;
        await signOut();
        router.replace('/welcome');
      },
    );
  };

  // A link name manages its own profile; the rest of this screen is for staff.
  if (identity?.kind === 'access') return <ProfileSettings />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle>Identity</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{identity?.name}</Text>
        <Text style={styles.label}>{identity?.role === 'admin' ? 'Admin' : 'Staff'}</Text>
        <Button label="Sign out" icon="log-out-outline" variant="secondary" onPress={leave} />
      </Card>

      <ThisPhoneCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg },
  card: { gap: space.md },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: -space.sm },
});
