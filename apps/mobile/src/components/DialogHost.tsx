import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { setDialogHost, type DialogRequest } from '../lib/dialog';
import { colors, radius, shadow, space } from '../lib/theme';
import { Button, type IconName } from './ui';

// Draws every message and question in the app's own style (sign out, delete,
// sync results...). Mounted once in the root layout; lib/dialog.ts feeds it.
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => {
    setDialogHost((request) => setQueue((q) => [...q, request]));
    return () => setDialogHost(null);
  }, []);

  const current = queue[0];
  if (!current) return null;

  const close = (confirmed: boolean) => {
    current.resolve(confirmed);
    setQueue((q) => q.slice(1));
  };

  const isQuestion = !!current.confirmLabel;
  const icon = (current.icon ?? (isQuestion ? 'help-circle-outline' : 'information-circle-outline')) as IconName;
  const tint = current.destructive ? colors.danger : colors.accent;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)} accessibilityLabel="Close">
        {/* Presses inside the card must not close it. */}
        <Pressable style={styles.card} onPress={() => undefined} accessibilityRole="alert">
          <View style={[styles.icon, { backgroundColor: current.destructive ? colors.failedBg : colors.accentBg }]}>
            <Ionicons name={icon} size={30} color={tint} />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          {!!current.message && <Text style={styles.message}>{current.message}</Text>}
          <View style={styles.buttons}>
            {isQuestion ? (
              <>
                <Button label="Cancel" variant="secondary" onPress={() => close(false)} style={styles.button} />
                <Button
                  label={current.confirmLabel ?? 'OK'}
                  variant={current.destructive ? 'danger' : 'primary'}
                  onPress={() => close(true)}
                  style={styles.button}
                />
              </>
            ) : (
              <Button label="OK" onPress={() => close(true)} style={styles.button} />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius + 6,
    padding: space.xl,
    alignItems: 'center',
    gap: space.sm,
    ...shadow,
  },
  icon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: space.md, marginTop: space.lg, alignSelf: 'stretch' },
  button: { flex: 1 },
});
