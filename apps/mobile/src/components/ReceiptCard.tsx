import { formatReceiptDate, typeColour, typeLabel } from '@lionrock/shared';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LocalReceipt } from '../lib/db';
import { receiptFileUri } from '../lib/files';
import { UPLOAD_BADGE, uploadState } from '../lib/status';
import { colors, radius, shadow, space, typeColors } from '../lib/theme';
import { openViewer } from '../lib/viewer';
import { typeCardColour } from './TypeFilter';
import { Button } from './ui';

// One receipt in the Uploads list: thumbnail, fields, status badges and actions.

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function StatusBadges({ receipt }: { receipt: LocalReceipt }) {
  const status = UPLOAD_BADGE[uploadState(receipt)];
  return (
    <View style={styles.badges}>
      <Badge {...status} />
      {!receipt.details_confirmed && (
        <Badge label="Needs details" color={colors.needsDetails} bg={colors.needsDetailsBg} />
      )}
    </View>
  );
}

interface Props {
  receipt: LocalReceipt;
  onOpen: () => void;
  onAddDetails: () => void;
  onRetry: () => void;
}

export function ReceiptCard({ receipt, onOpen, onAddDetails, onRetry }: Props) {
  const d = receipt.details;
  const uri = receiptFileUri(receipt.local_path);
  const isImage = receipt.content_type.startsWith('image/');
  const stripe = typeColors[typeColour(d.type)];
  const taken = new Date(receipt.taken_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    // The card itself is not a button. The picture opens the file full screen, the
    // text opens the receipt, and the action buttons sit below, so no button is
    // nested inside another.
    <View style={[styles.card, { borderLeftColor: stripe, backgroundColor: typeCardColour(d.type) }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View the receipt full screen"
          onPress={() => (uri ? openViewer({ title: receipt.file_name, contentType: receipt.content_type, uri, localPath: receipt.local_path }) : onOpen())}
          style={({ pressed }) => pressed && { opacity: 0.7 }}
        >
          {uri && isImage ? (
            <Image source={{ uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Text style={styles.thumbText}>{isImage ? 'Photo' : 'PDF'}</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open receipt" style={({ pressed }) => [styles.body, pressed && { opacity: 0.7 }]}>
          <Text style={styles.title} numberOfLines={1}>
            {d.total ? `$${d.total.replace(/^\$/, '')}` : 'No total yet'}
            {d.type ? `  ·  ${typeLabel(d.type, d.type_other)}` : ''}
          </Text>
          <Text style={styles.line} numberOfLines={1}>
            {d.receipt_date ? formatReceiptDate(d.receipt_date) : `Saved ${taken}`}
            {d.work_order ? `  ·  WO ${d.work_order}` : ''}
          </Text>
          {!!d.tenant_address && (
            <Text style={styles.line} numberOfLines={1}>
              {d.tenant_address}
            </Text>
          )}
          <StatusBadges receipt={receipt} />
        </Pressable>
      </View>
      {(uploadState(receipt) === 'failed' || !receipt.details_confirmed) && (
        <View style={styles.actions}>
          {uploadState(receipt) === 'failed' && <Button label="Retry" size="small" variant="secondary" onPress={onRetry} />}
          {!receipt.details_confirmed && <Button label="Add details" size="small" onPress={onAddDetails} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderLeftWidth: 5,
    ...shadow,
    padding: space.md,
    gap: space.md,
  },
  row: { flexDirection: 'row', gap: space.md },
  thumb: { width: 64, height: 80, borderRadius: 10, backgroundColor: colors.card },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  line: { fontSize: 14, color: colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  badge: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
});
