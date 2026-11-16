import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ReceiptCard } from '../../components/ReceiptCard';
import { RemoteReceiptCard } from '../../components/RemoteReceiptCard';
import { TypeFilter, matchesType, type TypeChoice } from '../../components/TypeFilter';
import { Button, EmptyState, OfflineBanner, SectionTitle } from '../../components/ui';
import { errorText, listRemoteReceipts, type RemoteReceipt } from '../../lib/api';
import { resetForRetry } from '../../lib/db';
import { showMessage } from '../../lib/dialog';
import { useSession } from '../../lib/session';
import { uploadState } from '../../lib/status';
import { syncNow, syncReceipt } from '../../lib/sync';
import { colors, radius, shadow, space, type } from '../../lib/theme';

// History (spec 8.5, "Uploads"). Receipts live in the office database, so this
// list comes from the server: a link name sees its own, staff see everyone's.
// A receipt is only on the phone while it has not uploaded yet (or failed); those
// are shown first, with Try again.
export default function Uploads() {
  const { identity, receipts, online, refresh } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeChoice>('all');
  const [remote, setRemote] = useState<RemoteReceipt[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const name = identity?.name ?? null;
  const isStaff = identity?.kind === 'staff';
  const loadRemote = useCallback(async () => {
    if (!name) return;
    try {
      setRemote((await listRemoteReceipts(isStaff ? null : name)).receipts);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [name, isStaff]);

  useFocusEffect(
    useCallback(() => {
      void loadRemote();
    }, [loadRemote]),
  );
  // A receipt leaves the phone when it uploads, so the server list is read again then.
  const onPhone = receipts.length;
  useEffect(() => {
    void loadRemote();
  }, [onPhone, loadRemote]);

  const failed = receipts.filter((r) => uploadState(r) === 'failed').length;
  const notSent = receipts.length - failed;
  const waitingHere = useMemo(() => receipts.filter((r) => matchesType(r.details.type, typeFilter)), [receipts, typeFilter]);
  const uploaded = useMemo(() => {
    const here = new Set(receipts.map((r) => r.client_uuid));
    return remote.filter((r) => (!r.client_uuid || !here.has(r.client_uuid)) && matchesType(r.type, typeFilter));
  }, [remote, receipts, typeFilter]);

  const onSyncNow = async () => {
    setSyncing(true);
    const result = await syncNow(identity?.name);
    setSyncing(false);
    showMessage('Sync', result.message);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadRemote()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      {/* The counts and the Type filter stay in place while the list scrolls under them. */}
      <View style={styles.fixed}>
        <View style={styles.stats}>
          <Stat value={remote.length} label="Success" color={colors.synced} />
          <Stat value={failed} label="Failed" color={colors.failed} />
        </View>
        <TypeFilter value={typeFilter} onChange={setTypeFilter} />
      </View>
      <FlatList
        data={uploaded}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {!online && <OfflineBanner />}
            {(failed > 0 || notSent > 0) && (
              <View style={styles.summaryRow}>
                <Text style={styles.summary}>
                  {failed > 0
                    ? 'Failed receipts are not in the office database. Tap Sync now to try again.'
                    : `${notSent} receipt${notSent === 1 ? ' is' : 's are'} not uploaded yet. Finish the details to upload.`}
                </Text>
                <Button label="Sync now" icon="sync" size="small" variant="secondary" busy={syncing} onPress={() => void onSyncNow()} />
              </View>
            )}
            {!!loadError && (
              <Text style={styles.error} accessibilityRole="alert">
                {loadError}
              </Text>
            )}

            {waitingHere.length > 0 && (
              <View style={styles.section}>
                <SectionTitle>Not uploaded yet</SectionTitle>
                {waitingHere.map((item) => (
                  <ReceiptCard
                    key={item.client_uuid}
                    receipt={item}
                    onOpen={() => router.push({ pathname: '/receipt/[id]', params: { id: item.client_uuid } })}
                    onAddDetails={() => router.push({ pathname: '/wizard/[id]', params: { id: item.client_uuid } })}
                    onRetry={() => void resetForRetry(item.client_uuid).then(() => syncReceipt(item.client_uuid))}
                  />
                ))}
              </View>
            )}
            {uploaded.length > 0 && <SectionTitle>{isStaff ? "Everyone's receipts" : 'Uploaded receipts'}</SectionTitle>}
          </View>
        }
        ListEmptyComponent={
          waitingHere.length > 0 || loadError ? undefined : remote.length === 0 && receipts.length === 0 ? (
            <EmptyState icon="receipt-outline" title="No receipts yet" text="Use Scan to add your first one." />
          ) : (
            <EmptyState icon="funnel-outline" title="Nothing here" text="No receipts match this filter." />
          )
        }
        renderItem={({ item }) => (
          <RemoteReceiptCard
            receipt={item}
            showPerson={isStaff}
            canEdit={isStaff}
            // A link name can delete its own receipts; staff can delete any.
            canDelete
            onChanged={() => void loadRemote()}
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
  fixed: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: { padding: space.lg, flexGrow: 1 },
  header: { gap: space.md, marginBottom: space.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  summary: { flex: 1, ...type.small },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius, paddingVertical: space.sm, alignItems: 'center', ...shadow },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 2 },
  section: { gap: space.md, marginBottom: space.sm },
  error: { color: colors.danger, fontSize: 14 },
});
