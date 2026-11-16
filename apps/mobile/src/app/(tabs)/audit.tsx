import { Ionicons } from '@expo/vector-icons';
import { formatCreatedAt } from '@lionrock/shared';
import { Redirect, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Chip, EmptyState, type IconName } from '../../components/ui';
import { errorText, listAudit, type AuditEntry } from '../../lib/api';
import { useSession } from '../../lib/session';
import { colors, radius, shadow, space } from '../../lib/theme';

// Admin only: who uploaded, edited or deleted which receipt, newest first.
type Action = AuditEntry['action'];
const ACTIONS: Record<Action, { label: string; verb: string; icon: IconName; color: string; bg: string }> = {
  upload: { label: 'Uploads', verb: 'uploaded', icon: 'cloud-upload-outline', color: colors.synced, bg: colors.syncedBg },
  edit: { label: 'Edits', verb: 'edited', icon: 'create-outline', color: colors.uploading, bg: colors.uploadingBg },
  delete: { label: 'Deletes', verb: 'deleted', icon: 'trash-outline', color: colors.failed, bg: colors.failedBg },
};
const FIELD_LABELS: Record<string, string> = {
  type: 'Type',
  type_other: 'Other label',
  receipt_date: 'Receipt Date',
  total: 'Total',
  work_order: 'Work order',
  tenant_address: 'Tenant Address',
};

export default function Audit() {
  const { identity } = useSession();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState<Action | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries((await listAudit()).entries);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const shown = useMemo(() => (filter === 'all' ? entries : entries.filter((e) => e.action === filter)), [entries, filter]);

  if (identity?.kind !== 'staff' || identity.role !== 'admin') return <Redirect href="/" />;

  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.chips}>
              <Chip label="All" small selected={filter === 'all'} onPress={() => setFilter('all')} />
              {(Object.keys(ACTIONS) as Action[]).map((a) => (
                <Chip key={a} label={ACTIONS[a].label} small selected={filter === a} onPress={() => setFilter(a)} />
              ))}
            </View>
            {!!error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={loading || error ? undefined : <EmptyState icon="list-outline" title="Nothing yet" text="Uploads, edits and deletes will be listed here." />}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => {
          const action = ACTIONS[item.action] ?? ACTIONS.upload;
          const ownReceipt = !item.receipt_owner || item.receipt_owner === item.actor;
          return (
            <View style={styles.card}>
              <View style={[styles.icon, { backgroundColor: action.bg }]}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <View style={styles.body}>
                <Text style={styles.line}>
                  <Text style={styles.actor}>{item.actor}</Text> {action.verb} {ownReceipt ? 'a receipt' : `${item.receipt_owner}'s receipt`}
                </Text>
                {!!item.summary && <Text style={styles.summary}>{item.summary}</Text>}
                {Object.entries(item.changes ?? {}).map(([field, change]) => (
                  <Text key={field} style={styles.change}>
                    {FIELD_LABELS[field] ?? field}: {change.from ?? 'empty'} → {change.to ?? 'empty'}
                  </Text>
                ))}
                <Text style={styles.when}>
                  {formatCreatedAt(item.at)} · {item.actor_kind === 'staff' ? 'Staff' : 'Link'}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, flexGrow: 1 },
  header: { gap: space.md, marginBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  error: { color: colors.danger, fontSize: 14 },
  card: { flexDirection: 'row', gap: space.md, backgroundColor: colors.card, borderRadius: radius, padding: space.md, ...shadow },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  line: { fontSize: 15, color: colors.text },
  actor: { fontWeight: '700' },
  summary: { fontSize: 14, color: colors.muted },
  change: { fontSize: 13, color: colors.text },
  when: { fontSize: 12, color: colors.faint, marginTop: 2 },
});
