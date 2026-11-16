import { RECEIPT_TYPES, needsWorkOrder, validateDetails, type ReceiptDetails } from '@lionrock/shared';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip } from '../../components/ui';
import { errorText, updateRemoteReceipt } from '../../lib/api';
import { showMessage } from '../../lib/dialog';
import { getEditing } from '../../lib/editing';
import { colors, space } from '../../lib/theme';

// Staff and admins: correct the details of a receipt that is already in the
// office database. Every change is written to the audit log by the server.
type TypeKey = 'renovation' | 'turn_over' | 'work_order' | 'other';
const TYPE_CHOICES: { key: TypeKey; label: string }[] = [
  ...RECEIPT_TYPES.map((t) => ({ key: t.value as TypeKey, label: t.label })),
  { key: 'other', label: 'Other' },
];

export default function EditReceipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const receipt = getEditing(id);
  const known = RECEIPT_TYPES.some((t) => t.value === receipt?.type);

  const [typeKey, setTypeKey] = useState<TypeKey>(known ? (receipt?.type as TypeKey) : 'other');
  const [typeOther, setTypeOther] = useState(known ? '' : (receipt?.type_other ?? receipt?.type ?? ''));
  const [date, setDate] = useState(receipt?.receipt_date ?? '');
  const [total, setTotal] = useState(receipt?.total ?? '');
  const [workOrder, setWorkOrder] = useState(receipt?.work_order ?? '');
  const [address, setAddress] = useState(receipt?.tenant_address ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!receipt) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <Text style={styles.note}>Open History and tap Edit on a receipt.</Text>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const isOther = typeKey === 'other';
  const save = async () => {
    const details: ReceiptDetails = {
      type: isOther ? typeOther.trim() : typeKey,
      type_other: isOther ? typeOther.trim() : null,
      receipt_date: date.trim() || null,
      total: total.trim().replace(/^\$/, '') || null,
      work_order: needsWorkOrder(typeKey) ? workOrder.trim() || null : null,
      tenant_address: address.trim() || null,
    };
    const problem = Object.values(validateDetails(details, isOther))[0];
    if (problem) return setError(problem);

    setSaving(true);
    setError(null);
    try {
      const result = await updateRemoteReceipt(receipt.id, details);
      showMessage(result.changed > 0 ? 'Saved' : 'Nothing changed', result.changed > 0 ? 'The receipt was updated.' : 'The details are the same as before.');
      router.back();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>
          Receipt of <Text style={styles.strong}>{receipt.user || 'Unknown'}</Text>
        </Text>
        <Card style={styles.card}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {TYPE_CHOICES.map((t) => (
              <Chip key={t.key} label={t.label} small selected={typeKey === t.key} onPress={() => setTypeKey(t.key)} />
            ))}
          </View>
          {isOther && <TextInput value={typeOther} onChangeText={setTypeOther} placeholder="Label for Other" placeholderTextColor={colors.faint} style={styles.input} />}

          <Text style={styles.label}>Receipt Date</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            style={styles.input}
          />

          <Text style={styles.label}>Total</Text>
          <TextInput value={total} onChangeText={setTotal} placeholder="0.00" placeholderTextColor={colors.faint} keyboardType="decimal-pad" style={styles.input} />

          {needsWorkOrder(typeKey) && (
            <>
              <Text style={styles.label}>Work order</Text>
              <TextInput value={workOrder} onChangeText={setWorkOrder} placeholderTextColor={colors.faint} style={styles.input} />
            </>
          )}

          <Text style={styles.label}>Tenant Address</Text>
          <TextInput value={address} onChangeText={setAddress} placeholderTextColor={colors.faint} style={styles.input} />

          {!!error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
        </Card>
        <Button label="Save changes" icon="checkmark" size="large" busy={saving} onPress={() => void save()} />
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  missing: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  content: { padding: space.lg, gap: space.lg },
  card: { gap: space.sm },
  note: { fontSize: 14, color: colors.muted },
  strong: { fontWeight: '700', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: space.md, minHeight: 48, fontSize: 16, color: colors.text, backgroundColor: colors.bg },
  error: { color: colors.danger, fontSize: 14 },
});
