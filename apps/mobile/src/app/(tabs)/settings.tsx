import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, SectionTitle } from '../../components/ui';
import { DEFAULT_CLEANUP_DAYS, getCleanupDays } from '../../lib/cleanup';
import { getSetting, listEvents, setSetting } from '../../lib/db';
import { confirm, showMessage } from '../../lib/dialog';
import { formatBytes, shareTextFile, storageUsedBytes } from '../../lib/files';
import { APP_VERSION, getDeviceId } from '../../lib/identity';
import { useSession } from '../../lib/session';
import { syncNow } from '../../lib/sync';
import { colors, space } from '../../lib/theme';

// Settings (spec 8.6).
const CLEANUP_CHOICES = [0, 7, 14, 30, 90];

export default function Settings() {
  const { identity, receipts, signOut } = useSession();
  const [wifiOnly, setWifiOnly] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(DEFAULT_CLEANUP_DAYS);
  const [storage, setStorage] = useState(0);
  const [deviceId, setDeviceId] = useState('');

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setWifiOnly((await getSetting('wifi_only')) === '1');
        setCleanupDays(await getCleanupDays());
        setStorage(storageUsedBytes());
        setDeviceId(await getDeviceId());
      })();
    }, []),
  );

  const waiting = receipts.filter((r) => r.sync_status !== 'synced').length;

  const changeIdentity = () => {
    const warning =
      waiting > 0
        ? `${waiting} receipt${waiting === 1 ? ' is' : 's are'} still waiting to upload. They stay on this phone under "${identity?.name}" and upload when you switch back to that name.`
        : 'You will need your access name or staff sign in again.';
    void confirm({ title: 'Change who is scanning?', message: warning, confirmLabel: 'Change', destructive: true }).then(
      async (ok) => {
        if (!ok) return;
        await signOut();
        router.replace('/welcome');
      },
    );
  };

  const cycleCleanup = async () => {
    const next = CLEANUP_CHOICES[(CLEANUP_CHOICES.indexOf(cleanupDays) + 1) % CLEANUP_CHOICES.length] ?? DEFAULT_CLEANUP_DAYS;
    setCleanupDays(next);
    await setSetting('cleanup_days', String(next));
  };

  const sendDiagnostics = async () => {
    const events = await listEvents();
    const lines = [
      `Receipts diagnostics ${new Date().toISOString()}`,
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle>Identity</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.label}>{identity?.kind === 'staff' ? 'Signed in as' : 'Scanning as'}</Text>
        <Text style={styles.value}>{identity?.name}</Text>
        {identity && !identity.verified && <Text style={styles.note}>Not checked with the office yet.</Text>}
        <Button label="Change" icon="swap-horizontal" variant="secondary" onPress={changeIdentity} />
      </Card>

      <SectionTitle>Uploading</SectionTitle>
      <Card style={styles.card}>
        <Button
          label="Sync now"
          icon="sync"
          onPress={() => void syncNow(identity?.name).then((r) => showMessage('Sync', r.message))}
        />
        <View style={styles.row}>
          <Text style={styles.rowText}>Upload on Wi-Fi only</Text>
          <Switch
            value={wifiOnly}
            onValueChange={(v) => {
              setWifiOnly(v);
              void setSetting('wifi_only', v ? '1' : '0');
            }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowText}>Delete synced receipts from this phone after</Text>
          <Button
            label={cleanupDays === 0 ? 'Never' : `${cleanupDays} days`}
            size="small"
            variant="secondary"
            onPress={() => void cycleCleanup()}
          />
        </View>
        <Text style={styles.note}>Receipts that have not uploaded yet are never deleted.</Text>
      </Card>

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
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg },
  card: { gap: space.md },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: -space.sm },
  note: { fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 40 },
  rowText: { flex: 1, fontSize: 15, color: colors.text },
  infoValue: { fontSize: 15, color: colors.muted },
});
