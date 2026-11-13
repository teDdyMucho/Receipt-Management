import { formatReceiptDate, typeLabel } from '@lionrock/shared';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBadges } from '../../components/ReceiptCard';
import { Button, Card } from '../../components/ui';
import { deleteReceiptRow, getReceipt, listEvents, resetForRetry, subscribe, type LocalReceipt, type ReceiptEvent } from '../../lib/db';
import { confirm } from '../../lib/dialog';
import { syncReceipt } from '../../lib/sync';
import { deleteReceiptFile, formatBytes, receiptFileUri } from '../../lib/files';
import { colors, radius, space } from '../../lib/theme';

// Receipt detail (spec 8.5): large preview, fields, status history, last error,
// Retry and Delete.
export default function ReceiptDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<LocalReceipt | null>(null);
  const [events, setEvents] = useState<ReceiptEvent[]>([]);

  const load = useCallback(async () => {
    setReceipt(await getReceipt(id));
    setEvents(await listEvents(id));
  }, [id]);

  useEffect(() => {
    void load();
    return subscribe(() => void load());
  }, [load]);

  if (!receipt) return <View style={styles.screen} />;

  const d = receipt.details;
  const uri = receiptFileUri(receipt.local_path);
  const isImage = receipt.content_type.startsWith('image/');
  const onServer = receipt.sync_status === 'synced';

  const remove = async () => {
    deleteReceiptFile(receipt.local_path);
    await deleteReceiptRow(receipt.client_uuid);
    router.back();
  };

  // A receipt that has not uploaded exists only on this phone, so ask twice.
  const confirmDelete = async () => {
    const ask = (title: string, message: string) => confirm({ title, message, confirmLabel: 'Delete', destructive: true });
    if (onServer) {
      if (await ask('Delete this receipt from this phone?', 'The office copy is not affected.')) await remove();
      return;
    }
    if (!(await ask('Delete this receipt?', 'It has not been uploaded yet.'))) return;
    const sure = await ask(
      'This cannot be undone',
      'The office has no copy of this receipt. Deleting it here removes it for good.',
    );
    if (sure) await remove();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {uri && isImage ? (
        <Image source={{ uri }} resizeMode="contain" style={styles.preview} accessibilityLabel="Receipt" />
      ) : (
        <Card style={styles.noPreview}>
          <Text style={styles.noPreviewText}>
            {uri ? `PDF · ${receipt.file_name}` : 'This file was removed from this phone. The office has the copy.'}
          </Text>
        </Card>
      )}

      <Card style={styles.card}>
        <StatusBadges receipt={receipt} />
        <Field label="Type" value={d.type ? typeLabel(d.type, d.type_other) : ''} />
        <Field label="Receipt Date" value={d.receipt_date ? formatReceiptDate(d.receipt_date) : ''} />
        <Field label="Total" value={d.total ? `$${d.total.replace(/^\$/, '')}` : ''} />
        <Field label="Work order" value={d.work_order ?? ''} />
        <Field label="Tenant Address" value={d.tenant_address ?? ''} />
        <Field label="File size" value={formatBytes(receipt.file_size)} />
        <Button
          label={receipt.details_confirmed ? 'Edit details' : 'Add details'}
          variant={receipt.details_confirmed ? 'secondary' : 'primary'}
          onPress={() => router.push({ pathname: '/wizard/[id]', params: { id: receipt.client_uuid } })}
        />
      </Card>

      {!!receipt.last_error && (
        <Card style={{ ...styles.card, borderColor: colors.failed }}>
          <Text style={styles.heading}>Last error</Text>
          <Text style={styles.errorText}>{receipt.last_error}</Text>
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.heading}>History</Text>
        {events.map((e, i) => (
          <View key={`${e.at}-${i}`} style={styles.event}>
            <Text style={styles.eventTime}>{new Date(e.at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</Text>
            <Text style={styles.eventText}>{e.message}</Text>
          </View>
        ))}
      </Card>

      {receipt.sync_status === 'failed' && <Button label="Retry" onPress={() => void resetForRetry(receipt.client_uuid).then(() => syncReceipt(receipt.client_uuid))} />}
      <Button label="Delete" variant="danger" onPress={() => void confirmDelete()} />
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg },
  preview: { width: '100%', height: 420, backgroundColor: colors.card, borderRadius: radius },
  noPreview: { alignItems: 'center', paddingVertical: space.xl * 2 },
  noPreviewText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  card: { gap: space.sm },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text },
  field: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs },
  fieldLabel: { fontSize: 15, color: colors.muted },
  fieldValue: { flex: 1, fontSize: 15, color: colors.text, textAlign: 'right' },
  errorText: { fontSize: 14, color: colors.failed },
  event: { flexDirection: 'row', gap: space.md },
  eventTime: { fontSize: 13, color: colors.muted, width: 120 },
  eventText: { flex: 1, fontSize: 14, color: colors.text },
});
