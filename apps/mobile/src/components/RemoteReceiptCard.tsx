import { Ionicons } from '@expo/vector-icons';
import { formatCreatedAt, formatReceiptDate, typeColour, typeLabel } from '@lionrock/shared';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteRemoteReceipt, errorText, receiptFileUrl, type RemoteReceipt } from '../lib/api';
import { confirm, showMessage } from '../lib/dialog';
import { setEditing } from '../lib/editing';
import { colors, radius, shadow, space, typeColors } from '../lib/theme';
import { openViewer } from '../lib/viewer';
import { typeCardColour } from './TypeFilter';

// A receipt in the office database. Tapping it opens the file full screen.
// Staff and admins get Edit; the owner and staff get Delete.

interface Props {
  receipt: RemoteReceipt;
  showPerson?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Called after the receipt was deleted, so the list can refresh. */
  onChanged?: () => void;
}

export function RemoteReceiptCard({ receipt, showPerson, canEdit, canDelete, onChanged }: Props) {
  const [opening, setOpening] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const file = await receiptFileUrl(receipt.id);
      const title = `${receipt.user ?? 'Receipt'}${receipt.total ? ` · $${receipt.total}` : ''}`;
      openViewer({ title, contentType: file.content_type ?? receipt.content_type ?? 'image/jpeg', uri: file.url });
    } catch (e) {
      showMessage('Could not open the receipt', errorText(e));
    } finally {
      setOpening(false);
    }
  };

  const edit = () => {
    setEditing(receipt);
    router.push({ pathname: '/edit/[id]', params: { id: receipt.id } });
  };

  const remove = async () => {
    const sure = await confirm({
      title: 'Delete this receipt?',
      message: 'It will be removed from the app for everyone. This is written in the audit log.',
      confirmLabel: 'Delete',
      destructive: true,
      icon: 'trash-outline',
    });
    if (!sure) return;
    setDeleting(true);
    try {
      await deleteRemoteReceipt(receipt.id);
      onChanged?.();
    } catch (e) {
      showMessage('Not deleted', errorText(e));
    } finally {
      setDeleting(false);
    }
  };

  const lines = [
    receipt.work_order ? `Work order: ${receipt.work_order}` : null,
    receipt.tenant_address ? `Address: ${receipt.tenant_address}` : null,
  ].filter(Boolean);

  return (
    // The card itself is not a button: the text opens the file and the small
    // action buttons sit beside it, so no button is nested inside another.
    <View style={[styles.card, { borderLeftColor: typeColors[typeColour(receipt.type)], backgroundColor: typeCardColour(receipt.type) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View receipt ${receipt.total ?? ''} ${receipt.user ?? ''} full screen`}
        onPress={() => void open()}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.total} numberOfLines={1}>
          {receipt.total ? `$${receipt.total}` : 'No total'}
          {showPerson ? <Text style={styles.person}>{`  ·  ${receipt.user || 'Unknown'}`}</Text> : null}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {typeLabel(receipt.type, receipt.type_other)}
          {receipt.receipt_date ? `  ·  ${formatReceiptDate(receipt.receipt_date)}` : ''}
        </Text>
        {lines.map((line) => (
          <Text key={line} style={styles.line} numberOfLines={1}>
            {line}
          </Text>
        ))}
        <Text style={styles.small} numberOfLines={1}>
          {formatCreatedAt(receipt.created_at)}
          {receipt.details_confirmed === false ? '  ·  Needs details' : ''}
        </Text>
      </Pressable>
      <View style={styles.actions}>
        <IconButton icon="expand-outline" label="View full screen" busy={opening} onPress={() => void open()} />
        {canEdit && <IconButton icon="create-outline" label="Edit" onPress={edit} />}
        {canDelete && <IconButton icon="trash-outline" label="Delete" danger busy={deleting} onPress={() => void remove()} />}
      </View>
    </View>
  );
}

interface IconButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
  busy?: boolean;
}

/** A small round button; the label is read by screen readers. */
function IconButton({ icon, label, onPress, danger, busy }: IconButtonProps) {
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, danger && { backgroundColor: colors.failedBg }, pressed && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator size="small" color={tint} /> : <Ionicons name={icon} size={17} color={tint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderLeftWidth: 5,
    ...shadow,
  },
  main: { flex: 1, gap: 1 },
  total: { fontSize: 16, fontWeight: '800', color: colors.text },
  person: { fontSize: 14, fontWeight: '700', color: colors.accent },
  meta: { fontSize: 13, color: colors.text },
  line: { fontSize: 13, color: colors.muted },
  small: { fontSize: 11, color: colors.faint, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
});
