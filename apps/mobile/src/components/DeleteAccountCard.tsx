import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { deleteMyAccount, errorText } from '../lib/api';
import { setSetting } from '../lib/db';
import { confirm, showMessage } from '../lib/dialog';
import { useSession } from '../lib/session';
import { colors, space } from '../lib/theme';
import { PinInput } from './PinInput';
import { Button, Card, SectionTitle } from './ui';

// "Delete my account" for someone signed in with a link name (the app stores
// require that an account made in the app can be deleted in the app).
// It asks for the PIN, then asks once more, because it cannot be undone.
export function DeleteAccountCard() {
  const { identity, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setPin('');
    setError(null);
  };

  const remove = async () => {
    if (!pin) return setError('Enter your PIN.');
    const sure = await confirm({
      title: 'Delete your account?',
      message: `"${identity?.name}" will be closed for good. Your PIN and picture are erased and nobody can sign in with this name again. This cannot be undone.`,
      confirmLabel: 'Delete account',
      destructive: true,
      icon: 'trash-outline',
    });
    if (!sure) return;

    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount(pin);
      await setSetting('profile_image', null);
      await signOut();
      router.replace('/welcome');
      showMessage('Account deleted', 'Your account was deleted.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>Account</SectionTitle>
      <Card style={styles.card}>
        {open ? (
          <>
            <Text style={styles.text}>
              Deleting your account erases your PIN and picture and closes this link name for good. Receipts you already sent stay with the office as its records.
            </Text>
            <Text style={styles.label}>Enter your PIN to continue</Text>
            <PinInput value={pin} onChangeText={setPin} label="PIN" autoFocus onSubmit={() => void remove()} />
            {!!error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}
            <Button label="Delete my account" icon="trash-outline" variant="danger" busy={busy} onPress={() => void remove()} />
            <Button label="Cancel" variant="secondary" onPress={close} />
          </>
        ) : (
          <>
            <Text style={styles.text}>You can delete your account at any time.</Text>
            <Button label="Delete my account" icon="trash-outline" variant="danger" onPress={() => setOpen(true)} />
          </>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  text: { fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: -space.xs },
  error: { color: colors.danger, fontSize: 14 },
});
