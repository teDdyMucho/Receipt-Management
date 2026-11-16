import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { listEvents } from '../lib/db';
import { showMessage } from '../lib/dialog';
import { formatBytes, shareTextFile, storageUsedBytes } from '../lib/files';
import { APP_VERSION, getDeviceId } from '../lib/identity';
import { useSession } from '../lib/session';
import { colors, space } from '../lib/theme';
import { Button, Card, SectionTitle } from './ui';

// "This phone": storage, device id, app version, update check and diagnostics.
// Shown in Settings for both link names and staff.
export function ThisPhoneCard() {
  const { identity, receipts } = useSession();
  const [storage, setStorage] = useState(0);
  const [deviceId, setDeviceId] = useState('');

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setStorage(storageUsedBytes());
        setDeviceId(await getDeviceId());
      })();
    }, []),
  );

  const sendDiagnostics = async () => {
    const waiting = receipts.filter((r) => r.sync_status !== 'synced').length;
    const events = await listEvents();
    const lines = [
      `Lionrock diagnostics ${new Date().toISOString()}`,
      `Identity: ${identity?.name} (${identity?.kind})`,
      `Device: ${deviceId}  ${Platform.OS} ${Platform.Version}  app ${APP_VERSION}`,
      `Receipts: ${receipts.length} total, ${waiting} not synced`,
      '',
      ...receipts.map((r) => `${r.client_uuid} ${r.sync_status} attempts=${r.attempts} ${r.last_error ?? ''}`),
      '',
      ...events.map((e) => `${e.at} ${e.client_uuid} ${e.message}`),
    ];
    const shared = await shareTextFile('receipts-diagnostics.txt', lines.join('\n'));
    if (!shared) showMessage('Sharing is not available on this device.');
  };

  return (
    <>
      <SectionTitle>This phone</SectionTitle>
      <Card style={styles.card}>
        <Info label="Storage used" value={formatBytes(storage)} />
        <Info label="Device id" value={deviceId.slice(0, 8)} />
        <Info label="App version" value={APP_VERSION} />
        <Button
          label="Check for updates"
          icon="cloud-download-outline"
          variant="secondary"
          onPress={() => showMessage('Updates', 'Update checks work in the installed store build.')}
        />
        <Button label="Send diagnostics" icon="share-outline" variant="secondary" onPress={() => void sendDiagnostics()} />
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 40 },
  rowText: { flex: 1, fontSize: 15, color: colors.text },
  value: { fontSize: 15, color: colors.muted },
});
