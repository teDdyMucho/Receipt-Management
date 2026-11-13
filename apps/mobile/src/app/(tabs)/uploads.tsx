import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ReceiptCard } from '../../components/ReceiptCard';
import { Button, Chip, EmptyState, OfflineBanner } from '../../components/ui';
import { resetForRetry, type LocalReceipt } from '../../lib/db';
import { showMessage } from '../../lib/dialog';
import { useSession } from '../../lib/session';
import { syncNow, syncReceipt } from '../../lib/sync';
import { colors, radius, shadow, space, type } from '../../lib/theme';

// Uploads (spec 8.5): every receipt on this phone with its status.
type Filter = 'All' | 'Pending' | 'Synced' | 'Failed' | 'Needs details';
const FILTERS: Filter[] = ['All', 'Pending', 'Synced', 'Failed', 'Needs details'];

function matches(r: LocalReceipt, filter: Filter): boolean {
  switch (filter) {
    case 'Pending':
      return r.sync_status === 'pending' || r.sync_status === 'uploading';
    case 'Synced':
      return r.sync_status === 'synced';
    case 'Failed':
      return r.sync_status === 'failed';
    case 'Needs details':
      return !r.details_confirmed;
    default:
      return true;
  }
}

export default function Uploads() {
  const { identity, receipts, online, refresh } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');
  const [refreshing, setRefreshing] = useState(false);

  const counts = useMemo(() => {
    const count = (status: LocalReceipt['sync_status']) => receipts.filter((r) => r.sync_status === status).length;
    return { synced: count('synced'), uploading: count('uploading'), pending: count('pending'), failed: count('failed') };
  }, [receipts]);

  const shown = useMemo(() => receipts.filter((r) => matches(r, filter)), [receipts, filter]);

  const onSyncNow = async () => {
    setSyncing(true);
    const result = await syncNow(identity?.name);
    setSyncing(false);
    showMessage('Sync', result.message);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.client_uuid}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {!online && <OfflineBanner />}
            <View style={styles.stats}>
              <Stat value={counts.synced} label="Synced" color={colors.synced} />
              <Stat value={counts.uploading} label="Uploading" color={colors.uploading} />
              <Stat value={counts.pending} label="Pending" color={colors.pending} />
              <Stat value={counts.failed} label="Failed" color={colors.failed} />
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summary}>
                {counts.synced} synced, {counts.uploading} uploading, {counts.pending} pending, {counts.failed} failed
              </Text>
              <Button label="Sync now" icon="sync" size="small" variant="secondary" busy={syncing} onPress={() => void onSyncNow()} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => (
                <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          receipts.length === 0 ? (
            <EmptyState icon="receipt-outline" title="No receipts yet" text="Use Scan to add your first one." />
          ) : (
            <EmptyState icon="funnel-outline" title="Nothing here" text="No receipts match this filter." />
          )
        }
        renderItem={({ item }) => (
          <ReceiptCard
            receipt={item}
            onOpen={() => router.push({ pathname: '/receipt/[id]', params: { id: item.client_uuid } })}
            onAddDetails={() => router.push({ pathname: '/wizard/[id]', params: { id: item.client_uuid } })}
            onRetry={() => void resetForRetry(item.client_uuid).then(() => syncReceipt(item.client_uuid))}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      />
    </View>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, flexGrow: 1 },
  header: { gap: space.md, marginBottom: space.lg },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  summary: { flex: 1, ...type.small },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius, paddingVertical: space.md, alignItems: 'center', ...shadow },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 2 },
  chips: { gap: space.sm },
});
