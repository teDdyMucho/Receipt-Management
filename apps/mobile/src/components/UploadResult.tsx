import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../lib/theme';
import { Button } from './ui';

// The end of an upload. There are only two results:
// Success - the receipt is in the office database.
// Failed  - it is not. It stays on this phone and can be tried again.

interface Props {
  ok: boolean;
  /** Why it failed, in plain words. */
  error?: string | null;
  busy?: boolean;
  onRetry: () => void;
  onClose: () => void;
}

export function UploadResult({ ok, error, busy, onRetry, onClose }: Props) {
  return (
    <View style={styles.screen} accessibilityRole="alert">
      <View style={[styles.icon, { backgroundColor: ok ? colors.syncedBg : colors.failedBg }]}>
        <Ionicons name={ok ? 'checkmark' : 'close'} size={56} color={ok ? colors.synced : colors.failed} />
      </View>
      <Text style={[styles.title, { color: ok ? colors.synced : colors.failed }]}>{ok ? 'Success' : 'Failed'}</Text>
      <Text style={styles.text}>
        {ok ? 'The receipt was uploaded to the office.' : 'The receipt was NOT uploaded. It is still saved on this phone, so nothing is lost.'}
      </Text>
      {!ok && !!error && <Text style={styles.reason}>{error}</Text>}

      <View style={styles.buttons}>
        {ok ? (
          <Button label="Done" size="large" onPress={onClose} />
        ) : (
          <>
            <Button label="Try again" icon="refresh" size="large" busy={busy} onPress={onRetry} />
            <Button label="Close" variant="secondary" onPress={onClose} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  icon: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  text: { fontSize: 16, lineHeight: 23, color: colors.text, textAlign: 'center' },
  reason: { fontSize: 14, lineHeight: 20, color: colors.failed, textAlign: 'center', backgroundColor: colors.failedBg, padding: space.md, borderRadius: 12, overflow: 'hidden' },
  buttons: { alignSelf: 'stretch', gap: space.md, marginTop: space.xl },
});
